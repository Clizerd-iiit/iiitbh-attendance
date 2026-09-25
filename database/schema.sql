-- =============================================
-- IIIT Bhagalpur Attendance System - DB Schema
-- Run this in Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---- USERS ----
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'superadmin')),
  roll_no TEXT,           -- students only
  section TEXT,           -- students only
  semester INTEGER,       -- students only
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- SUBJECTS ----
CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  teacher_id UUID REFERENCES users(id),
  section TEXT NOT NULL,
  semester INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- ENROLLMENTS (student <-> subject) ----
CREATE TABLE enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, subject_id)
);

-- ---- CLASSES (each session) ----
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME,
  qr_code TEXT UNIQUE,             -- random token for QR
  qr_expires_at TIMESTAMPTZ,       -- short-lived
  otp TEXT,                        -- 4-digit OTP
  otp_expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','closed')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- ATTENDANCE RECORDS ----
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
  student_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('P', 'A', 'L', 'Late')),
  method TEXT CHECK (method IN ('qr', 'otp', 'manual', 'auto')),
  marked_at TIMESTAMPTZ DEFAULT NOW(),
  edited_by UUID REFERENCES users(id),  -- if manually changed
  edited_at TIMESTAMPTZ,
  UNIQUE(class_id, student_id)
);

-- ---- SESSIONS (anti-proxy: one device per user) ----
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,  -- hash of UA + timezone + screen
  ip_address TEXT,
  session_token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- ---- ANNOUNCEMENTS ----
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  teacher_id UUID REFERENCES users(id),
  subject_id UUID REFERENCES subjects(id),  -- NULL = all subjects of teacher
  type TEXT CHECK (type IN ('extra_class','cancellation','test','quiz','update','pdf','link','text')),
  title TEXT NOT NULL,
  content TEXT,
  file_url TEXT,
  link_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- LEAVE REQUESTS ----
CREATE TABLE leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES users(id),
  subject_id UUID REFERENCES subjects(id),
  class_id UUID REFERENCES classes(id),
  reason TEXT NOT NULL,
  proof_url TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- AUDIT LOGS ----
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  action TEXT NOT NULL,       -- e.g., 'UPDATE_ATTENDANCE', 'ADD_STUDENT'
  table_name TEXT,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- TIMETABLE ----
CREATE TABLE timetable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id),
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Mon
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  room TEXT
);

-- ---- SYSTEM SETTINGS ----
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default settings
INSERT INTO system_settings (key, value) VALUES
  ('attendance_threshold', '75'),
  ('allowed_email_domain', 'iiitbh.ac.in'),
  ('qr_expiry_seconds', '60'),
  ('otp_expiry_minutes', '2'),
  ('teacher_edit_window_days', '5'),
  ('attendance_mark_window_minutes', '30');

-- =============================================
-- INDEXES for performance
-- =============================================
CREATE INDEX idx_attendance_class_id ON attendance(class_id);
CREATE INDEX idx_attendance_student_id ON attendance(student_id);
CREATE INDEX idx_classes_subject_id ON classes(subject_id);
CREATE INDEX idx_classes_date ON classes(date);
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_subject ON enrollments(subject_id);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- =============================================
-- ROW LEVEL SECURITY (RLS) - Important!
-- =============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

-- Students can only read their own data
CREATE POLICY "student_own_attendance" ON attendance
  FOR SELECT USING (student_id = auth.uid());

-- Teachers can read attendance for their subjects only
CREATE POLICY "teacher_subject_attendance" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM classes c
      JOIN subjects s ON c.subject_id = s.id
      WHERE c.id = attendance.class_id
      AND s.teacher_id = auth.uid()
    )
  );

-- =============================================
-- HELPER VIEWS
-- =============================================

-- Student attendance summary view
CREATE VIEW student_attendance_summary AS
SELECT
  e.student_id,
  e.subject_id,
  s.name AS subject_name,
  s.code AS subject_code,
  COUNT(c.id) AS total_classes,
  COUNT(CASE WHEN a.status IN ('P','Late') THEN 1 END) AS attended,
  ROUND(
    COUNT(CASE WHEN a.status IN ('P','Late') THEN 1 END) * 100.0 /
    NULLIF(COUNT(c.id), 0), 2
  ) AS percentage
FROM enrollments e
JOIN subjects s ON e.subject_id = s.id
LEFT JOIN classes c ON c.subject_id = e.subject_id AND c.status = 'closed'
LEFT JOIN attendance a ON a.class_id = c.id AND a.student_id = e.student_id
GROUP BY e.student_id, e.subject_id, s.name, s.code;
