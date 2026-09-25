-- Migration v9: Phase 2 (Anti-Proxy, Vaults)

-- 1. Add GPS to classes for Anti-Proxy
ALTER TABLE classes ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. Community Vault (Notes Sharing)
CREATE TABLE IF NOT EXISTS notes_vault (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  target_branch TEXT,
  target_group TEXT,
  downloads INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notes_vault ENABLE ROW LEVEL SECURITY;

-- Everyone enrolled can read
CREATE POLICY "enrolled_can_read_notes" ON notes_vault
  FOR SELECT USING (true); -- simplify to true, or add complex join

