
-- ── Conversas (uma por número de telefone por terapeuta) ───────────
CREATE TABLE public.whatsapp_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id UUID NOT NULL,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL,
  telefone TEXT NOT NULL,
  nome_contato TEXT,
  foto_url TEXT,
  ultima_mensagem TEXT,
  ultima_mensagem_em TIMESTAMPTZ DEFAULT now(),
  ultima_direcao TEXT CHECK (ultima_direcao IN ('entrada','saida')),
  nao_lidas INTEGER NOT NULL DEFAULT 0,
  arquivada BOOLEAN NOT NULL DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (terapeuta_id, telefone)
);

CREATE INDEX idx_wa_conversas_terapeuta_data ON public.whatsapp_conversas (terapeuta_id, ultima_mensagem_em DESC);
CREATE INDEX idx_wa_conversas_paciente ON public.whatsapp_conversas (paciente_id);

ALTER TABLE public.whatsapp_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta vê suas conversas"
  ON public.whatsapp_conversas FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeuta insere suas conversas"
  ON public.whatsapp_conversas FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeuta atualiza suas conversas"
  ON public.whatsapp_conversas FOR UPDATE
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeuta apaga suas conversas"
  ON public.whatsapp_conversas FOR DELETE
  USING (auth.uid() = terapeuta_id);

-- ── Mensagens da inbox ────────────────────────────────────────────
CREATE TABLE public.whatsapp_mensagens_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.whatsapp_conversas(id) ON DELETE CASCADE,
  terapeuta_id UUID NOT NULL,
  direcao TEXT NOT NULL CHECK (direcao IN ('entrada','saida')),
  tipo TEXT NOT NULL DEFAULT 'texto' CHECK (tipo IN ('texto','audio','imagem','documento','video','sistema')),
  conteudo TEXT,
  midia_url TEXT,
  transcricao TEXT,
  zapi_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','enviando','enviada','entregue','lida','erro')),
  erro TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_wa_msgs_conversa_data ON public.whatsapp_mensagens_inbox (conversa_id, created_at DESC);
CREATE INDEX idx_wa_msgs_terapeuta ON public.whatsapp_mensagens_inbox (terapeuta_id);
CREATE INDEX idx_wa_msgs_zapi_id ON public.whatsapp_mensagens_inbox (zapi_message_id);

ALTER TABLE public.whatsapp_mensagens_inbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Terapeuta vê suas mensagens inbox"
  ON public.whatsapp_mensagens_inbox FOR SELECT
  USING (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeuta insere mensagens inbox"
  ON public.whatsapp_mensagens_inbox FOR INSERT
  WITH CHECK (auth.uid() = terapeuta_id);

CREATE POLICY "Terapeuta atualiza mensagens inbox"
  ON public.whatsapp_mensagens_inbox FOR UPDATE
  USING (auth.uid() = terapeuta_id);

-- ── Trigger: ao inserir mensagem, atualiza conversa ───────────────
CREATE OR REPLACE FUNCTION public.update_conversa_on_msg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.whatsapp_conversas
  SET ultima_mensagem = COALESCE(NEW.conteudo, NEW.transcricao, '[mídia]'),
      ultima_mensagem_em = NEW.created_at,
      ultima_direcao = NEW.direcao,
      nao_lidas = CASE WHEN NEW.direcao = 'entrada' THEN nao_lidas + 1 ELSE nao_lidas END,
      updated_at = now()
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_conversa_on_msg
AFTER INSERT ON public.whatsapp_mensagens_inbox
FOR EACH ROW EXECUTE FUNCTION public.update_conversa_on_msg();

CREATE TRIGGER trg_wa_conversas_updated
BEFORE UPDATE ON public.whatsapp_conversas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Realtime ──────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_conversas REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_mensagens_inbox REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_mensagens_inbox;
