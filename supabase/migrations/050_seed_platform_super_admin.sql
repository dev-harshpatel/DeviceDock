-- Migration 050: Seed platform super admin
-- Idempotent — safe to run on both testing and production databases.
-- Creates the auth user, user_profiles row, and platform_super_admins entry
-- only if they do not already exist.

DO $$
DECLARE
  v_user_id  uuid;
  v_email    text := 'work.patelharsh@gmail.com';
  v_password text := 'whothehellitis';
BEGIN
  -- 1. Resolve existing auth user or create a new one
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();

    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      now(),
      now()
    );

    -- auth.identities is required for email/password sign-in
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email),
      'email',
      v_email,
      now(),
      now(),
      now()
    );

    RAISE NOTICE 'Created auth user: %', v_email;
  ELSE
    -- Reset password for existing user so the migration is always authoritative
    UPDATE auth.users
    SET encrypted_password = crypt(v_password, gen_salt('bf')),
        updated_at = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'Auth user already exists, password reset: %', v_email;
  END IF;

  -- 2. Ensure user_profiles row exists with role = admin
  INSERT INTO public.user_profiles (user_id, role)
  VALUES (v_user_id, 'admin')
  ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  -- 3. Register in platform_super_admins
  INSERT INTO public.platform_super_admins (user_id)
  VALUES (v_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RAISE NOTICE 'Super admin seeded successfully for %', v_email;
END $$;
