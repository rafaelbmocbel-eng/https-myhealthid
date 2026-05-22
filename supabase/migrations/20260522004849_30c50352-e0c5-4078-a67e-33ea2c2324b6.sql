CREATE TABLE IF NOT EXISTS public.links_rastreaveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  label text NOT NULL,
  url_destino text NOT NULL,
  url_final text NOT NULL,
  utms jsonb NOT NULL DEFAULT '{}'::jsonb,
  cliques integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_links_rastreaveis_terapeuta ON public.links_rastreaveis(terapeuta_id, created_at DESC);

ALTER TABLE public.links_rastreaveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia seus links rastreaveis"
ON public.links_rastreaveis
FOR ALL
TO authenticated
USING (terapeuta_id = auth.uid())
WITH CHECK (terapeuta_id = auth.uid());

CREATE TRIGGER trg_links_rastreaveis_updated_at
BEFORE UPDATE ON public.links_rastreaveis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RPC pública para incrementar cliques (chamada do redirector)
CREATE OR REPLACE FUNCTION public.incrementar_clique_link(p_link_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.links_rastreaveis
  SET cliques = cliques + 1, updated_at = now()
  WHERE id = p_link_id AND ativo = true;
$$;

GRANT EXECUTE ON FUNCTION public.incrementar_clique_link(uuid) TO anon, authenticated;