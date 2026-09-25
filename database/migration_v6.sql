-- Fix missing columns if any previous migrations were skipped

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_last_seen ON users(last_seen_at DESC);

ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_student_ids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS teacher_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS branch TEXT;

-- Safely migrate single teacher to multiple teachers array if needed
UPDATE subjects SET teacher_ids = jsonb_build_array(teacher_id) WHERE teacher_id IS NOT NULL AND (teacher_ids IS NULL OR jsonb_array_length(teacher_ids) = 0);
