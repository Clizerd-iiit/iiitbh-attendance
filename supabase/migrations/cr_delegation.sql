-- CR Delegation table: allows teachers to grant temporary attendance-taking
-- permission to a CR (Class Representative) student for a specific subject.

CREATE TABLE IF NOT EXISTS cr_delegations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cr_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  granted_hours NUMERIC(6,2),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast CR lookups (only active rows)
CREATE INDEX IF NOT EXISTS idx_cr_delegations_cr_user ON cr_delegations(cr_user_id) WHERE is_active = TRUE;
-- Index for teacher dashboard queries
CREATE INDEX IF NOT EXISTS idx_cr_delegations_teacher ON cr_delegations(teacher_id);
-- Index for subject-level queries
CREATE INDEX IF NOT EXISTS idx_cr_delegations_subject ON cr_delegations(subject_id);
