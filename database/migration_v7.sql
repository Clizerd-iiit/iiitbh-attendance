-- Add branch and is_cr to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_cr BOOLEAN DEFAULT false;

-- Add targeting columns to announcements
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_branch TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_group TEXT;
