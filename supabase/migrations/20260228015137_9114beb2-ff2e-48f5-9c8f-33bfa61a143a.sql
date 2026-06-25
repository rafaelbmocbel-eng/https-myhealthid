
CREATE TABLE IF NOT EXISTS public.myid_avaliacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  terapeuta_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id),
  token_acesso TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  status TEXT NOT NULL DEFAULT 'pendente',
  respostas_brutas JSONB,
  resultado_processado JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.myid_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Terapeutas podem ver suas avaliações MyID" ON public.myid_avaliacoes;
CREATE POLICY "Terapeutas podem ver suas avaliações MyID"
  ON public.myid_avaliacoes
  FOR SELECT
  USING (auth.uid() = terapeuta_id);

DROP POLICY IF EXISTS "Terapeutas podem criar avaliações MyID" ON public.myid_avaliacoes;
CREATE POLICY "Terapeutas podem criar avaliações MyID"
  ON public.myid_avaliacoes
  FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

DROP POLICY IF EXISTS "Terapeutas podem atualizar suas avaliações MyID" ON public.myid_avaliacoes;
CREATE POLICY "Terapeutas podem atualizar suas avaliações MyID"
  ON public.myid_avaliacoes
  FOR UPDATE
  USING (auth.uid() = terapeuta_id);

DROP POLICY IF EXISTS "Acesso público via token" ON public.myid_avaliacoes;
CREATE POLICY "Acesso público via token"
  ON public.myid_avaliacoes
  FOR SELECT
  USING (token_acesso IS NOT NULL);

DROP POLICY IF EXISTS "Atualização pública via token" ON public.myid_avaliacoes;
CREATE POLICY "Atualização pública via token"
  ON public.myid_avaliacoes
  FOR UPDATE
  USING (token_acesso IS NOT NULL);
