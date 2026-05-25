
-- ═══════════════════════════════════════════════════════════
-- SPRINT 1: Notificações Inteligentes Contextuais (MyID)
-- ═══════════════════════════════════════════════════════════

-- Enum de dimensões MyID
DO $$ BEGIN
  CREATE TYPE public.myid_dimensao AS ENUM ('D','EFI','P','I','R','C','AF','HID','NUT','ERG','N','MED','ANY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notif_canal AS ENUM ('in_app','whatsapp','push');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabela de regras (por terapeuta)
CREATE TABLE IF NOT EXISTS public.notificacao_regras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  driver public.myid_dimensao NOT NULL,
  titulo TEXT NOT NULL,
  template_mensagem TEXT NOT NULL,
  canal public.notif_canal NOT NULL DEFAULT 'in_app',
  horario_envio TIME NOT NULL DEFAULT '09:00',
  dias_semana SMALLINT[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6,0],
  intervalo_repeticao_horas SMALLINT,
  ativo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notif_regras_terapeuta ON public.notificacao_regras(terapeuta_id, ativo);

ALTER TABLE public.notificacao_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia suas regras"
  ON public.notificacao_regras
  FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());

-- Log de envios
CREATE TABLE IF NOT EXISTS public.notificacao_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id UUID REFERENCES public.notificacao_regras(id) ON DELETE SET NULL,
  terapeuta_id UUID NOT NULL,
  paciente_id UUID NOT NULL,
  driver public.myid_dimensao NOT NULL,
  canal public.notif_canal NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'enviado',
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  lida_em TIMESTAMPTZ,
  erro TEXT
);

CREATE INDEX IF NOT EXISTS idx_notif_envios_terapeuta ON public.notificacao_envios(terapeuta_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_notif_envios_paciente ON public.notificacao_envios(paciente_id, enviado_em DESC);
CREATE INDEX IF NOT EXISTS idx_notif_envios_dedupe ON public.notificacao_envios(paciente_id, regra_id, enviado_em);

ALTER TABLE public.notificacao_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta vê seus envios"
  ON public.notificacao_envios
  FOR SELECT TO authenticated
  USING (terapeuta_id = auth.uid());

CREATE POLICY "Paciente vê suas notificações"
  ON public.notificacao_envios
  FOR SELECT TO authenticated
  USING (paciente_id IN (SELECT id FROM public.pacientes WHERE user_id = auth.uid()));

CREATE POLICY "Service role insere envios"
  ON public.notificacao_envios
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Trigger updated_at
CREATE TRIGGER trg_notif_regras_updated
  BEFORE UPDATE ON public.notificacao_regras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed templates default (insere para cada terapeuta novo via função)
CREATE OR REPLACE FUNCTION public.seed_notificacao_regras_default(p_terapeuta_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notificacao_regras (terapeuta_id, driver, titulo, template_mensagem, canal, horario_envio, intervalo_repeticao_horas, ativo) VALUES
    (p_terapeuta_id, 'D',   'Pausa para alívio',     'Olá {nome}! Que tal 3 min de respiração diafragmática agora? Pode aliviar sua dor.', 'in_app', '14:00', NULL, false),
    (p_terapeuta_id, 'R',   'Hora de desacelerar',   'Boa noite, {nome}. Comece a se preparar para dormir — luz baixa, sem telas por 30 min.', 'in_app', '22:00', NULL, false),
    (p_terapeuta_id, 'C',   'Respira fundo',         'Bom dia, {nome}! Faça 4 ciclos de respiração quadrada antes de começar o dia.', 'in_app', '08:00', NULL, false),
    (p_terapeuta_id, 'HID', 'Hora da água',          'Lembrete: beba um copo de água agora 💧', 'in_app', '10:00', 3, false),
    (p_terapeuta_id, 'AF',  'Movimente-se',          '{nome}, levante e faça 5 min de alongamento. Seu corpo agradece.', 'in_app', '15:00', NULL, false),
    (p_terapeuta_id, 'NUT', 'Refeição consciente',   'Hora do almoço, {nome}. Mastigue devagar e inclua proteína + vegetais.', 'in_app', '12:00', NULL, false),
    (p_terapeuta_id, 'ERG', 'Cheque sua postura',    '{nome}, ajuste sua postura agora: ombros relaxados, tela na altura dos olhos.', 'in_app', '11:00', 4, false),
    (p_terapeuta_id, 'P',   'Você consegue',         'Lembrete, {nome}: você está mais forte do que pensa. Movimento é seguro.', 'in_app', '09:00', NULL, false),
    (p_terapeuta_id, 'EFI', 'Função em foco',        'Que tal praticar 1 atividade do seu plano hoje, {nome}? Pequenos passos contam.', 'in_app', '16:00', NULL, false),
    (p_terapeuta_id, 'I',   'Atenção às mudanças',   '{nome}, observe hoje: alguma nova carga, tênis, postura? Anote para sua próxima consulta.', 'in_app', '19:00', NULL, false),
    (p_terapeuta_id, 'N',   'Cuide do intestino',    'Bom dia, {nome}! Inclua fibras e probióticos hoje. Seu intestino é seu segundo cérebro.', 'in_app', '08:30', NULL, false)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Settings de feature por terapeuta
CREATE TABLE IF NOT EXISTS public.notificacao_inteligente_config (
  terapeuta_id UUID PRIMARY KEY,
  ativa BOOLEAN NOT NULL DEFAULT false,
  enviar_para_paciente BOOLEAN NOT NULL DEFAULT true,
  enviar_para_terapeuta BOOLEAN NOT NULL DEFAULT false,
  janela_minutos SMALLINT NOT NULL DEFAULT 30,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacao_inteligente_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta gerencia config"
  ON public.notificacao_inteligente_config
  FOR ALL TO authenticated
  USING (terapeuta_id = auth.uid())
  WITH CHECK (terapeuta_id = auth.uid());

CREATE TRIGGER trg_notif_config_updated
  BEFORE UPDATE ON public.notificacao_inteligente_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
