-- Migration v5: Subject branches and multiple teachers
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS teacher_ids JSONB DEFAULT '[]'::jsonb;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS branch TEXT;

-- Migrate existing teacher_id to teacher_ids array
UPDATE subjects SET teacher_ids = jsonb_build_array(teacher_id) WHERE teacher_id IS NOT NULL AND jsonb_array_length(teacher_ids) = 0;
