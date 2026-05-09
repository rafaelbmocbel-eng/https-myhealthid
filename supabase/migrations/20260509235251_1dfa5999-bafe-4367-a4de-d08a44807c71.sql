
-- 1. Limpar trigger e RPCs antigos da tabela errada
DROP TRIGGER IF EXISTS trg_notify_myid_fase ON public.avaliacoes_identidade;
DROP FUNCTION IF EXISTS public.notify_myid_fase_concluida();
DROP FUNCTION IF EXISTS public.salvar_fase_myid(text, smallint, jsonb, numeric, jsonb, jsonb, text, text);
DROP FUNCTION IF EXISTS public.get_myid_em_andamento(text);

-- 2. Adicionar tracking de fases em myid_avaliacoes (tabela correta)
ALTER TABLE public.myid_avaliacoes
  ADD COLUMN IF NOT EXISTS fase_atual smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fase_concluida smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS myid_score_parcial numeric,
  ADD COLUMN IF NOT EXISTS dimensoes_preenchidas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS red_flags_detectadas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultima_atividade_em timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_myid_avaliacoes_fase
  ON public.myid_avaliacoes (paciente_id, fase_concluida);

CREATE INDEX IF NOT EXISTS idx_myid_avaliacoes_lembrete
  ON public.myid_avaliacoes (ultima_atividade_em)
  WHERE status = 'em_andamento' AND fase_concluida BETWEEN 1 AND 3;

-- Backfill: avaliações já concluídas
UPDATE public.myid_avaliacoes
SET fase_concluida = 4, fase_atual = 4,
    dimensoes_preenchidas = '["D","I","EFI","P","R","C","N"]'::jsonb,
    myid_score_parcial = COALESCE(myid_score_parcial,
      (resultado_processado->>'myidScore')::numeric)
WHERE status = 'concluido' AND fase_concluida = 0;

-- 3. RPC pública: ler MyID em andamento por token
CREATE OR REPLACE FUNCTION public.get_myid_em_andamento(p_token text)
RETURNS TABLE(
  id uuid,
  paciente_id uuid,
  terapeuta_id uuid,
  status text,
  fase_atual smallint,
  fase_concluida smallint,
  respostas_brutas jsonb,
  resultado_processado jsonb,
  dimensoes_preenchidas jsonb,
  myid_score_parcial numeric,
  red_flags_detectadas boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.paciente_id, m.terapeuta_id, m.status,
         m.fase_atual, m.fase_concluida,
         m.respostas_brutas, m.resultado_processado,
         m.dimensoes_preenchidas, m.myid_score_parcial,
         m.red_flags_detectadas
  FROM public.myid_avaliacoes m
  WHERE m.token_acesso = p_token
  LIMIT 1;
$$;

-- 4. RPC pública: salvar fase do MyID
CREATE OR REPLACE FUNCTION public.salvar_fase_myid(
  p_token text,
  p_fase smallint,
  p_respostas jsonb,
  p_score_parcial numeric,
  p_dimensoes jsonb,
  p_red_flags boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_status_atual text;
BEGIN
  IF p_fase < 1 OR p_fase > 4 THEN
    RAISE EXCEPTION 'Fase inválida: %', p_fase;
  END IF;

  SELECT id, status INTO v_id, v_status_atual
  FROM public.myid_avaliacoes
  WHERE token_acesso = p_token
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Token de avaliação inválido';
  END IF;

  IF v_status_atual = 'concluido' THEN
    RAISE EXCEPTION 'Avaliação já concluída';
  END IF;

  UPDATE public.myid_avaliacoes
  SET respostas_brutas = p_respostas,
      myid_score_parcial = p_score_parcial,
      dimensoes_preenchidas = p_dimensoes,
      red_flags_detectadas = COALESCE(p_red_flags, red_flags_detectadas),
      fase_atual = GREATEST(fase_atual, p_fase),
      fase_concluida = GREATEST(fase_concluida, p_fase),
      status = CASE
        WHEN p_fase = 4 THEN status -- complete-myid edge fn marca como 'concluido'
        WHEN status = 'pendente' THEN 'em_andamento'
        ELSE status
      END,
      ultima_atividade_em = now(),
      updated_at = now()
  WHERE id = v_id;

  RETURN v_id;
END;
$$;

-- 5. Trigger de notificação ao profissional
CREATE OR REPLACE FUNCTION public.notify_myid_fase_concluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_titulo text;
  v_descricao text;
  v_tipo text;
  v_paciente_nome text;
BEGIN
  IF NEW.fase_concluida IS NOT DISTINCT FROM COALESCE(OLD.fase_concluida, 0) THEN
    RETURN NEW;
  END IF;

  -- Nome do paciente
  IF NEW.paciente_id IS NOT NULL THEN
    SELECT TRIM(COALESCE(nome,'') || ' ' || COALESCE(sobrenome,''))
    INTO v_paciente_nome
    FROM public.pacientes WHERE id = NEW.paciente_id;
  END IF;
  v_paciente_nome := COALESCE(NULLIF(v_paciente_nome, ''), 'Paciente');

  IF NEW.fase_concluida = 4 THEN
    v_tipo := CASE WHEN NEW.red_flags_detectadas THEN 'myid_red_flag' ELSE 'myid_completo' END;
    v_titulo := CASE WHEN NEW.red_flags_detectadas
      THEN '🚨 MyID concluído com Red Flags'
      ELSE '✅ MyID completo'
    END;
    v_descricao := v_paciente_nome || ' finalizou o MyID. Score: ' ||
      COALESCE(round(NEW.myid_score_parcial)::text, '—');
  ELSIF NEW.fase_concluida = 1 AND NEW.red_flags_detectadas THEN
    v_tipo := 'myid_red_flag';
    v_titulo := '🚨 Red Flags detectados na Fase 1';
    v_descricao := v_paciente_nome || ' apresentou sinais de alerta na primeira fase do MyID. Avaliação clínica recomendada.';
  ELSE
    v_tipo := 'myid_fase_concluida';
    v_titulo := '📝 MyID — Fase ' || NEW.fase_concluida || '/4 concluída';
    v_descricao := v_paciente_nome || ' avançou para a Fase ' || (NEW.fase_concluida + 1) || ' do MyID.';
  END IF;

  INSERT INTO public.notificacoes (terapeuta_id, tipo, titulo, descricao, rota, metadata)
  VALUES (
    NEW.terapeuta_id, v_tipo, v_titulo, v_descricao,
    CASE WHEN NEW.paciente_id IS NOT NULL
      THEN '/pacientes/' || NEW.paciente_id || '?tab=identidade'
      ELSE '/pacientes' END,
    jsonb_build_object(
      'myid_avaliacao_id', NEW.id,
      'paciente_id', NEW.paciente_id,
      'fase', NEW.fase_concluida,
      'red_flags', NEW.red_flags_detectadas,
      'score_parcial', NEW.myid_score_parcial
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_myid_fase ON public.myid_avaliacoes;
CREATE TRIGGER trg_notify_myid_fase
AFTER UPDATE OF fase_concluida ON public.myid_avaliacoes
FOR EACH ROW
EXECUTE FUNCTION public.notify_myid_fase_concluida();

-- Permite execução pública das RPCs (token-based, já validam internamente)
GRANT EXECUTE ON FUNCTION public.get_myid_em_andamento(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.salvar_fase_myid(text, smallint, jsonb, numeric, jsonb, boolean) TO anon, authenticated;
