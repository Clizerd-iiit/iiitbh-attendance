CREATE TABLE IF NOT EXISTS public.reported_issues (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    details TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.reported_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anon insert" ON public.reported_issues FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow admin read" ON public.reported_issues FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM users WHERE users.email = auth.jwt()->>'email' AND users.role = 'admin'
  )
);
