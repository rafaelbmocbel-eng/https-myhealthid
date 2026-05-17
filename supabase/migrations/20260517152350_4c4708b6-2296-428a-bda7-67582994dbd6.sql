
-- 1) Expandir whatsapp_automacoes com configs do agente IA
ALTER TABLE public.whatsapp_automacoes
  ADD COLUMN IF NOT EXISTS tom_voz text NOT NULL DEFAULT 'amigavel',
  ADD COLUMN IF NOT EXISTS prompt_extra text,
  ADD COLUMN IF NOT EXISTS gatilhos_ativos jsonb NOT NULL DEFAULT '{
    "confirmacao_24h": true,
    "lembrete_2h": true,
    "pos_sessao": true,
    "exercicio_pendente": true,
    "myid_vencido": true,
    "reengajamento": true,
    "pagamento_pendente": false,
    "aniversario": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS palavras_escalonamento text[] NOT NULL DEFAULT ARRAY[
    'urgente','emergência','emergencia','dor forte','não aguento','nao aguento',
    'piorou muito','sangrando','desmaiei','cair','quedei'
  ],
  ADD COLUMN IF NOT EXISTS max_turnos_bot integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS usar_contexto_clinico boolean NOT NULL DEFAULT true;

-- 2) Log de disparos proativos (evita duplicar)
CREATE TABLE IF NOT EXISTS public.agente_disparos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE CASCADE,
  conversa_id uuid REFERENCES public.whatsapp_conversas(id) ON DELETE SET NULL,
  gatilho text NOT NULL,
  ref_id uuid,
  conteudo text NOT NULL,
  status text NOT NULL DEFAULT 'enviado',
  erro text,
  respondido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agente_disparos_terapeuta ON public.agente_disparos(terapeuta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agente_disparos_dedup ON public.agente_disparos(gatilho, ref_id);
CREATE INDEX IF NOT EXISTS idx_agente_disparos_paciente ON public.agente_disparos(paciente_id, gatilho, created_at DESC);

ALTER TABLE public.agente_disparos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "terapeuta ve seus disparos" ON public.agente_disparos
  FOR SELECT USING (auth.uid() = terapeuta_id);
CREATE POLICY "terapeuta atualiza seus disparos" ON public.agente_disparos
  FOR UPDATE USING (auth.uid() = terapeuta_id);

-- 3) Campanhas de broadcast com IA
CREATE TABLE IF NOT EXISTS public.agente_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  titulo text NOT NULL,
  intencao text NOT NULL,
  filtro jsonb NOT NULL DEFAULT '{}'::jsonb,
  paciente_ids uuid[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'rascunho',
  total integer NOT NULL DEFAULT 0,
  enviados integer NOT NULL DEFAULT 0,
  erros integer NOT NULL DEFAULT 0,
  iniciado_em timestamptz,
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agente_broadcasts_terapeuta ON public.agente_broadcasts(terapeuta_id, created_at DESC);

ALTER TABLE public.agente_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "terapeuta gerencia broadcasts" ON public.agente_broadcasts
  FOR ALL USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

CREATE TRIGGER trg_agente_broadcasts_updated
  BEFORE UPDATE ON public.agente_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Marca conversa quando IA escala para humano
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS requer_atencao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_escalonamento text,
  ADD COLUMN IF NOT EXISTS turnos_bot integer NOT NULL DEFAULT 0;
