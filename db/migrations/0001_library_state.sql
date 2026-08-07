CREATE TABLE IF NOT EXISTS library_state (
  user_id text PRIMARY KEY DEFAULT 'local-user',
  experiences jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO library_state (user_id, experiences)
VALUES ('local-user', '[]'::jsonb)
ON CONFLICT (user_id) DO NOTHING;
