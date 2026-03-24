-- Add IMEI numbers storage to orders
-- Stores a JSON object mapping order item index (as string) to IMEI number string
-- e.g. {"0": "123456789012345", "1": "987654321098765"}

ALTER TABLE orders
ADD COLUMN IF NOT EXISTS imei_numbers JSONB DEFAULT '{}';
