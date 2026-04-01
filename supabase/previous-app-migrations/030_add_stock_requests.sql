-- Stock requests: users pre-block out-of-stock devices they want
-- Admin sees grouped demand to know what to restock
CREATE TABLE IF NOT EXISTS stock_requests (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_item_id   UUID         NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  quantity            INT          NOT NULL DEFAULT 1 CHECK (quantity >= 1 AND quantity <= 50),
  note                TEXT,
  status              TEXT         NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- One active request per user per item (upsert-safe)
  UNIQUE (user_id, inventory_item_id)
);

ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;

-- Users can read their own requests
CREATE POLICY "Users can read own stock requests"
  ON stock_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can create requests
CREATE POLICY "Users can insert own stock requests"
  ON stock_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update (cancel) their own requests
CREATE POLICY "Users can update own stock requests"
  ON stock_requests FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all requests
CREATE POLICY "Admins can read all stock requests"
  ON stock_requests FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can update all requests (mark fulfilled)
CREATE POLICY "Admins can update all stock requests"
  ON stock_requests FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
