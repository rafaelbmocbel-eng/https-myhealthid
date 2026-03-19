
-- Table for LGPD consent terms
CREATE TABLE public.termos_consentimento (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'lgpd',
  versao text NOT NULL DEFAULT '1.0',
  texto_termo text NOT NULL,
  aceito boolean NOT NULL DEFAULT false,
  data_aceite timestamp with time zone,
  ip_aceite text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.termos_consentimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeutas gerenciam termos" ON public.termos_consentimento
  FOR ALL TO authenticated
  USING (auth.uid() = terapeuta_id)
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Pacientes leem próprios termos" ON public.termos_consentimento
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pacientes p WHERE p.id = termos_consentimento.paciente_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Pacientes aceitam próprios termos" ON public.termos_consentimento
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM pacientes p WHERE p.id = termos_consentimento.paciente_id AND p.user_id = auth.uid()
  ));

CREATE TRIGGER update_termos_consentimento_updated_at
  BEFORE UPDATE ON public.termos_consentimento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
