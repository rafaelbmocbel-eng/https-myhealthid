
CREATE TABLE public.tracking_config (
  terapeuta_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_pixel_id text,
  ga4_id text,
  ativos boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tracking_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can manage own tracking config"
  ON public.tracking_config FOR ALL
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

-- Pixel IDs are not secrets (they're injected into public HTML anyway).
-- Allow anonymous SELECT only when active so PublicTrackingPixels can fetch.
CREATE POLICY "Public can read active tracking config"
  ON public.tracking_config FOR SELECT
  TO anon, authenticated
  USING (ativos = true);

CREATE TRIGGER trg_tracking_config_updated_at
  BEFORE UPDATE ON public.tracking_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
