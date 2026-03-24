import { supabaseAdmin } from '@/lib/supabase/client/admin';
import { notFound } from 'next/navigation';
import AcceptInvite from '@/page-components/AcceptInvite';

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;

  const { data: invitation } = await supabaseAdmin
    .from('company_invitations')
    .select('id, invitee_email, role_to_assign, company_slug, company_id, expires_at, consumed_at')
    .eq('token_hash', token)
    .single();

  // Token doesn't exist at all
  if (!invitation) notFound();

  const alreadyUsed = !!invitation.consumed_at;
  const expired = new Date(invitation.expires_at) < new Date();

  const { data: company } = await supabaseAdmin
    .from('companies')
    .select('name')
    .eq('id', invitation.company_id)
    .single();

  return (
    <AcceptInvite
      token={token}
      inviteeEmail={invitation.invitee_email}
      role={invitation.role_to_assign}
      companyName={company?.name ?? invitation.company_slug}
      companySlug={invitation.company_slug}
      expired={expired}
      alreadyUsed={alreadyUsed}
    />
  );
}
