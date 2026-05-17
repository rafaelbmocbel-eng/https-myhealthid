
ALTER TABLE public.whatsapp_conversas
  ADD COLUMN IF NOT EXISTS atribuido_a uuid,
  ADD COLUMN IF NOT EXISTS sla_responder_ate timestamptz,
  ADD COLUMN IF NOT EXISTS primeiro_resposta_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_conversas_atribuido
  ON public.whatsapp_conversas (terapeuta_id, atribuido_a, ultima_mensagem_em DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_sla_pendente
  ON public.whatsapp_conversas (terapeuta_id, sla_responder_ate)
  WHERE sla_responder_ate IS NOT NULL AND primeiro_resposta_em IS NULL;

ALTER TABLE public.whatsapp_automacoes
  ADD COLUMN IF NOT EXISTS sla_minutos integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS sla_ativo boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.whatsapp_filtros_salvos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  nome text NOT NULL,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_filtros_salvos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "terapeuta gerencia filtros salvos" ON public.whatsapp_filtros_salvos
  FOR ALL USING (auth.uid() = terapeuta_id) WITH CHECK (auth.uid() = terapeuta_id);

-- Trigger: atualiza SLA quando mensagem nova do paciente / marca primeira resposta
CREATE OR REPLACE FUNCTION public.aplicar_sla_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sla_min integer;
  v_sla_ativo boolean;
BEGIN
  IF NEW.direcao = 'entrada' THEN
    SELECT sla_minutos, sla_ativo INTO v_sla_min, v_sla_ativo
    FROM public.whatsapp_automacoes
    WHERE terapeuta_id = NEW.terapeuta_id;
    IF COALESCE(v_sla_ativo, true) THEN
      UPDATE public.whatsapp_conversas
      SET sla_responder_ate = NEW.created_at + ((COALESCE(v_sla_min, 30)) || ' minutes')::interval,
          primeiro_resposta_em = NULL
      WHERE id = NEW.conversa_id;
    END IF;
  ELSIF NEW.direcao = 'saida' THEN
    UPDATE public.whatsapp_conversas
    SET primeiro_resposta_em = COALESCE(primeiro_resposta_em, NEW.created_at)
    WHERE id = NEW.conversa_id AND primeiro_resposta_em IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sla_whatsapp ON public.whatsapp_mensagens_inbox;
CREATE TRIGGER trg_sla_whatsapp
  AFTER INSERT ON public.whatsapp_mensagens_inbox
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_sla_whatsapp();
