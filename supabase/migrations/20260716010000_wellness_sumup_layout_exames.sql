-- 1) Assinatura Wellness paga via SumUp: amplia o CHECK de provider.
ALTER TABLE public.wellness_assinaturas DROP CONSTRAINT IF EXISTS wellness_assinaturas_provider_check;
ALTER TABLE public.wellness_assinaturas
  ADD CONSTRAINT wellness_assinaturas_provider_check
  CHECK (provider IN ('stripe','paddle','manual','sumup'));

-- 2) Layout do perfil POR USUÁRIO: cada profissional tem o seu; a linha id=1
--    de app_layout_config vira só o modelo padrão (leitura).
CREATE TABLE IF NOT EXISTS public.layout_config_usuario (
  user_id uuid PRIMARY KEY,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.layout_config_usuario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuario gerencia proprio layout" ON public.layout_config_usuario;
CREATE POLICY "Usuario gerencia proprio layout" ON public.layout_config_usuario
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Fecha a escrita global antiga: ninguém mais edita o layout de todo mundo.
DROP POLICY IF EXISTS "authenticated users can update layout config" ON public.app_layout_config;

-- 3) Paciente pode LER os próprios exames importados (para a curva de
--    marcadores na Evolução). Escrita continua exclusiva do terapeuta.
DROP POLICY IF EXISTS "Paciente le proprios exames" ON public.exames_importados;
CREATE POLICY "Paciente le proprios exames" ON public.exames_importados
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));
