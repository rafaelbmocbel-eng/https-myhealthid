
CREATE TABLE public.myid_dimension_insights_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  terapeuta_id uuid NOT NULL,
  dimensao text NOT NULL,
  inputs_hash text NOT NULL,
  score_valor numeric,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (paciente_id, dimensao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.myid_dimension_insights_cache TO authenticated;
GRANT ALL ON public.myid_dimension_insights_cache TO service_role;
ALTER TABLE public.myid_dimension_insights_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Terapeuta gerencia cache de insights" ON public.myid_dimension_insights_cache
  FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);
CREATE TRIGGER trg_myid_dim_cache_updated_at
  BEFORE UPDATE ON public.myid_dimension_insights_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
