-- Global layout configuration for the professional-side UI.
-- Single row enforced via CHECK; no owner_id — changes are app-wide.
CREATE TABLE IF NOT EXISTS app_layout_config (
  id         int         PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  config     jsonb       NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the single row so reads never return empty.
INSERT INTO app_layout_config (id, config) VALUES (1, '{}')
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_layout_config ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read; any authenticated user can write.
-- (Writing is limited to professionals via the app's UI guards.)
CREATE POLICY "authenticated users can read layout config"
  ON app_layout_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated users can update layout config"
  ON app_layout_config FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
