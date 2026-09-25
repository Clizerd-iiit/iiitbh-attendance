-- Migration v4: Announcements targeting + Enrollments
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS target_student_ids JSONB;
