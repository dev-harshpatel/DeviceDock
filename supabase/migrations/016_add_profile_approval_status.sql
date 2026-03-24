-- Migration: 016_add_profile_approval_status.sql
-- Description: Add approval_status column to user_profiles table for profile approval workflow

-- Add approval_status column
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending' 
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Add approval_status_updated_at timestamp for tracking when status changed
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS approval_status_updated_at TIMESTAMP WITH TIME ZONE;

-- Update existing users to 'approved' status for backward compatibility
UPDATE user_profiles
SET approval_status = 'approved', approval_status_updated_at = NOW()
WHERE approval_status = 'pending' OR approval_status IS NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_approval_status ON user_profiles(approval_status);

-- Add comments for documentation
COMMENT ON COLUMN user_profiles.approval_status IS 'Profile approval status: pending, approved, or rejected';
COMMENT ON COLUMN user_profiles.approval_status_updated_at IS 'Timestamp when the approval status was last updated';
