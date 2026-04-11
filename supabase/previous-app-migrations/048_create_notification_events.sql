-- Notification events feed for in-app alerts/activity.
-- Supports multi-admin realtime visibility for company-scoped events.

CREATE TABLE IF NOT EXISTS public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'inventory_product_added',
      'invitation_sent',
      'manual_sale_recorded'
    )
  ),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  entity_type text,
  entity_id uuid,
  actor_user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_events_company_created_at
  ON public.notification_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_events_event_type
  ON public.notification_events (event_type);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_events_select_company_members" ON public.notification_events;
CREATE POLICY "notification_events_select_company_members"
  ON public.notification_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = notification_events.company_id
        AND cu.status = 'active'
    )
  );

DROP POLICY IF EXISTS "notification_events_insert_company_admins" ON public.notification_events;
CREATE POLICY "notification_events_insert_company_admins"
  ON public.notification_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.company_users cu
      WHERE cu.user_id = auth.uid()
        AND cu.company_id = notification_events.company_id
        AND cu.status = 'active'
        AND cu.role IN ('owner', 'manager', 'inventory_admin')
    )
  );

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_events;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL;
  END;
END $$;
