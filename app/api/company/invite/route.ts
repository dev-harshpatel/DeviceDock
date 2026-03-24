import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { logSuperAdminAudit } from '@/lib/superadmin/audit';
import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { ensureCompanyMember } from '@/lib/supabase/auth-helpers';

const INVITABLE_ROLES = ['manager', 'inventory_admin', 'analyst'];
const ROLE_LABELS: Record<string, string> = {
  manager: 'Manager',
  inventory_admin: 'Inventory Admin',
  analyst: 'Analyst',
};

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, role, companyId } = body as {
    email: string;
    role: string;
    companyId: string;
  };

  if (!email || !role || !companyId) {
    return NextResponse.json(
      { error: 'email, role, and companyId are required' },
      { status: 400 },
    );
  }

  if (!INVITABLE_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const auth = await ensureCompanyMember(companyId, ['owner']);
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .single();

  if (!company) {
    return NextResponse.json({ error: 'Company not found' }, { status: 404 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // Check if the email is already an active member
  const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  const existingUser = users.find((u) => u.email?.toLowerCase() === normalizedEmail);

  if (existingUser) {
    const { data: existingMember } = await supabaseAdmin
      .from('company_users')
      .select('id, status')
      .eq('user_id', existingUser.id)
      .eq('company_id', companyId)
      .single();

    if (existingMember?.status === 'active') {
      return NextResponse.json(
        { error: 'This user is already an active member of your company' },
        { status: 409 },
      );
    }
  }

  // Check for an existing pending (non-consumed, non-expired) invite
  const { data: pendingInvite } = await supabaseAdmin
    .from('company_invitations')
    .select('id')
    .eq('company_id', companyId)
    .eq('invitee_email', normalizedEmail)
    .is('consumed_at', null)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (pendingInvite) {
    return NextResponse.json(
      { error: 'A pending invitation already exists for this email' },
      { status: 409 },
    );
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invitation, error } = await supabaseAdmin
    .from('company_invitations')
    .insert({
      company_id: companyId,
      company_slug: company.slug,
      invitee_email: normalizedEmail,
      role_to_assign: role as 'owner' | 'manager' | 'inventory_admin' | 'analyst',
      token_hash: token,
      expires_at: expiresAt,
    })
    .select('id')
    .single();

  if (error || !invitation) {
    return NextResponse.json({ error: error?.message ?? 'Failed to create invitation' }, { status: 500 });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const inviteUrl = `${siteUrl}/invite/${token}`;

  // Send invitation email if Resend is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@devicedock.app';

  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: fromEmail,
        to: normalizedEmail,
        subject: `You've been invited to join ${company.slug} on DeviceDock`,
        html: buildInviteEmailHtml({
          companySlug: company.slug,
          role: ROLE_LABELS[role] ?? role,
          inviteUrl,
          expiresAt,
        }),
      });
    } catch (emailError) {
      // Email failure should not block the invitation creation — log and continue
      console.error('[invite] Failed to send invitation email:', emailError);
    }
  }

  await logSuperAdminAudit({
    action: 'invitation.sent',
    actorUserId: auth.userId,
    companyId,
    metadata: { inviteeEmail: normalizedEmail, role },
    request,
    resourceId: invitation.id,
    resourceType: 'invitation',
  });

  return NextResponse.json(
    { inviteUrl: `/invite/${token}`, invitationId: invitation.id },
    { status: 201 },
  );
}

function buildInviteEmailHtml(params: {
  companySlug: string;
  role: string;
  inviteUrl: string;
  expiresAt: string;
}): string {
  const { companySlug, role, inviteUrl, expiresAt } = params;
  const expiryDate = new Date(expiresAt).toLocaleDateString('en-CA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8" /></head>
      <body style="font-family: sans-serif; color: #111; max-width: 480px; margin: 40px auto; padding: 0 16px;">
        <h2 style="margin-bottom: 8px;">You've been invited</h2>
        <p>You've been invited to join <strong>${companySlug}</strong> on DeviceDock as a <strong>${role}</strong>.</p>
        <p>This invitation expires on <strong>${expiryDate}</strong>.</p>
        <a href="${inviteUrl}"
           style="display:inline-block; margin-top: 16px; padding: 12px 24px; background:#111; color:#fff; text-decoration:none; border-radius:6px; font-weight:600;">
          Accept Invitation
        </a>
        <p style="margin-top: 24px; font-size: 13px; color: #666;">
          Or copy this link: <a href="${inviteUrl}">${inviteUrl}</a>
        </p>
        <p style="font-size: 12px; color: #999; margin-top: 32px;">
          If you did not expect this invitation, you can safely ignore this email.
        </p>
      </body>
    </html>
  `;
}
