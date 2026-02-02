ALTER TABLE produce ENABLE ROW LEVEL SECURITY;

CREATE POLICY "produce_read"
ON produce FOR SELECT
USING (
  agent_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('Audit Officer', 'Director', 'System Developer')
  )
);

CREATE POLICY "produce_insert"
ON produce FOR INSERT
WITH CHECK (agent_id = auth.uid());