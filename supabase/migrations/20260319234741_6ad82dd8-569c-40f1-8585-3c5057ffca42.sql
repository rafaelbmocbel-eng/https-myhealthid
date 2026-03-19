
-- NPS satisfaction surveys
CREATE TABLE public.pesquisas_nps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  sessao_id uuid REFERENCES public.controle_sessoes(id) ON DELETE SET NULL,
  nota integer NOT NULL CHECK (nota >= 0 AND nota <= 10),
  comentario text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.pesquisas_nps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam NPS" ON public.pesquisas_nps
  FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Pacientes inserem próprio NPS" ON public.pesquisas_nps
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM pacientes p WHERE p.id = pesquisas_nps.paciente_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Pacientes leem próprio NPS" ON public.pesquisas_nps
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pacientes p WHERE p.id = pesquisas_nps.paciente_id AND p.user_id = auth.uid()
  ));

CREATE INDEX idx_pesquisas_nps_terapeuta ON public.pesquisas_nps(terapeuta_id);
CREATE INDEX idx_pesquisas_nps_paciente ON public.pesquisas_nps(paciente_id);
