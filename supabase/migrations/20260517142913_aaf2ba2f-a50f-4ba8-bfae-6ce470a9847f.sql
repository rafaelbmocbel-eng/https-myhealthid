-- Cadências
CREATE TABLE public.crm_cadencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  terapeuta_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  estagio_gatilho text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_cadencia_passos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cadencia_id uuid NOT NULL REFERENCES public.crm_cadencias(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  delay_horas int NOT NULL DEFAULT 24,
  mensagem text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_cadencia_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL,
  cadencia_id uuid NOT NULL REFERENCES public.crm_cadencias(id) ON DELETE CASCADE,
  passo_id uuid NOT NULL REFERENCES public.crm_cadencia_passos(id) ON DELETE CASCADE,
  terapeuta_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  agendado_para timestamptz NOT NULL,
  enviado_em timestamptz,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cadencias_terapeuta ON public.crm_cadencias(terapeuta_id, ativo);
CREATE INDEX idx_cadencia_passos_cad ON public.crm_cadencia_passos(cadencia_id, ordem);
CREATE INDEX idx_cadencia_exec_pend ON public.crm_cadencia_execucoes(status, agendado_para) WHERE status = 'pendente';
CREATE INDEX idx_cadencia_exec_conv ON public.crm_cadencia_execucoes(conversa_id);

ALTER TABLE public.crm_cadencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_cadencia_passos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_cadencia_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cad_own_all" ON public.crm_cadencias FOR ALL USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());
CREATE POLICY "cad_passos_own" ON public.crm_cadencia_passos FOR ALL
  USING (EXISTS (SELECT 1 FROM public.crm_cadencias c WHERE c.id = cadencia_id AND c.terapeuta_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crm_cadencias c WHERE c.id = cadencia_id AND c.terapeuta_id = auth.uid()));
CREATE POLICY "cad_exec_own" ON public.crm_cadencia_execucoes FOR ALL USING (terapeuta_id = auth.uid()) WITH CHECK (terapeuta_id = auth.uid());

CREATE TRIGGER trg_cadencias_updated BEFORE UPDATE ON public.crm_cadencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: quando pipeline_stage muda, agenda passos da cadência do novo estágio
CREATE OR REPLACE FUNCTION public.agendar_cadencia_on_stage_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cad RECORD;
  v_passo RECORD;
BEGIN
  IF NEW.pipeline_stage IS NOT DISTINCT FROM OLD.pipeline_stage THEN
    RETURN NEW;
  END IF;

  -- Cancela execuções pendentes antigas
  UPDATE public.crm_cadencia_execucoes
  SET status = 'cancelado'
  WHERE conversa_id = NEW.id AND status = 'pendente';

  -- Busca cadência ativa do novo estágio
  FOR v_cad IN
    SELECT * FROM public.crm_cadencias
    WHERE terapeuta_id = NEW.terapeuta_id
      AND estagio_gatilho = NEW.pipeline_stage::text
      AND ativo = true
  LOOP
    FOR v_passo IN
      SELECT * FROM public.crm_cadencia_passos
      WHERE cadencia_id = v_cad.id AND ativo = true
      ORDER BY ordem
    LOOP
      INSERT INTO public.crm_cadencia_execucoes
        (conversa_id, cadencia_id, passo_id, terapeuta_id, agendado_para)
      VALUES
        (NEW.id, v_cad.id, v_passo.id, NEW.terapeuta_id,
         now() + (v_passo.delay_horas || ' hours')::interval);
    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pipeline_cadencia
  AFTER UPDATE OF pipeline_stage ON public.whatsapp_conversas
  FOR EACH ROW EXECUTE FUNCTION public.agendar_cadencia_on_stage_change();