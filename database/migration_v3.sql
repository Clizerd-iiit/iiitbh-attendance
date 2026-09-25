-- Migration v3: Announcements expiry + Online status
-- Run in Supabase SQL Editor

-- Announcement auto-expiry
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
-- Default 48h from creation (for existing rows)
UPDATE announcements SET expires_at = created_at + INTERVAL '48 hours' WHERE expires_at IS NULL;

-- User online status tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Index for quick online users lookup
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);
