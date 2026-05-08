
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.myid_acoes_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid NOT NULL,
  terapeuta_id uuid NOT NULL,
  avaliacao_id uuid,
  action_key text NOT NULL,
  action_label text NOT NULL,
  action_text text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (avaliacao_id, action_key)
);

CREATE INDEX idx_myid_acoes_paciente ON public.myid_acoes_checklist(paciente_id);
CREATE INDEX idx_myid_acoes_avaliacao ON public.myid_acoes_checklist(avaliacao_id);

ALTER TABLE public.myid_acoes_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam checklist acoes"
ON public.myid_acoes_checklist FOR ALL TO authenticated
USING (auth.uid() = terapeuta_id)
WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Pacientes leem proprias acoes"
ON public.myid_acoes_checklist FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = myid_acoes_checklist.paciente_id AND p.user_id = auth.uid()));

CREATE POLICY "Pacientes inserem proprias acoes"
ON public.myid_acoes_checklist FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = myid_acoes_checklist.paciente_id AND p.user_id = auth.uid() AND p.terapeuta_id = myid_acoes_checklist.terapeuta_id));

CREATE POLICY "Pacientes atualizam proprias acoes"
ON public.myid_acoes_checklist FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = myid_acoes_checklist.paciente_id AND p.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM pacientes p WHERE p.id = myid_acoes_checklist.paciente_id AND p.user_id = auth.uid()));

CREATE TRIGGER trg_myid_acoes_updated_at
BEFORE UPDATE ON public.myid_acoes_checklist
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
