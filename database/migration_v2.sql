-- Migration v2: Profile system + Verification
-- Run this in Supabase SQL Editor AFTER schema.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_change_count INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_month_year TEXT; -- 'YYYY-MM' format
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_info JSONB; -- teacher: {subject, code} / student: {roll_no}
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending'
  CHECK (verification_status IN ('pending','approved','rejected'));

-- Superadmin is auto-approved (set is_verified=true for superadmin)
-- This will be done via the app config, not SQL

-- Index for pending verification
CREATE INDEX IF NOT EXISTS idx_users_verification ON users(verification_status, role);
CREATE INDEX IF NOT EXISTS idx_users_profile ON users(profile_completed);

-- Storage bucket for profile photos (run in Supabase Dashboard > Storage)
-- Create bucket 'profile-photos' with public access
