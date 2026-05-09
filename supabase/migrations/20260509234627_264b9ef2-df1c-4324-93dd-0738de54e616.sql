
-- 1. Colunas novas em avaliacoes_identidade
ALTER TABLE public.avaliacoes_identidade
  ADD COLUMN IF NOT EXISTS fase_atual smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fase_concluida smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS myid_score_parcial numeric,
  ADD COLUMN IF NOT EXISTS dimensoes_preenchidas jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS concluido_em timestamptz,
  ADD COLUMN IF NOT EXISTS link_id uuid;

CREATE INDEX IF NOT EXISTS idx_avaliacoes_identidade_paciente_fase
  ON public.avaliacoes_identidade (paciente_id, fase_concluida DESC);

CREATE INDEX IF NOT EXISTS idx_avaliacoes_identidade_link
  ON public.avaliacoes_identidade (link_id) WHERE link_id IS NOT NULL;

-- 2. Backfill: avaliações já existentes viraram Fase 4 completa
UPDATE public.avaliacoes_identidade
SET fase_concluida = 4,
    fase_atual = 4,
    dimensoes_preenchidas = '["D","I","EFI","P","R","C","N"]'::jsonb,
    concluido_em = COALESCE(concluido_em, updated_at, created_at),
    myid_score_parcial = COALESCE(myid_score_parcial, myid_score)
WHERE fase_concluida = 0
  AND myid_score IS NOT NULL;

-- 3. RPC pública: ler MyID em andamento por token de link
CREATE OR REPLACE FUNCTION public.get_myid_em_andamento(p_token text)
RETURNS TABLE(
  id uuid,
  paciente_id uuid,
  terapeuta_id uuid,
  fase_atual smallint,
  fase_concluida smallint,
  dados_avaliacao jsonb,
  dimensoes_preenchidas jsonb,
  myid_score_parcial numeric,
  red_flags jsonb
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ai.id, ai.paciente_id, ai.terapeuta_id,
         ai.fase_atual, ai.fase_concluida, ai.dados_avaliacao,
         ai.dimensoes_preenchidas, ai.myid_score_parcial, ai.red_flags
  FROM public.avaliacoes_identidade ai
  JOIN public.links_avaliacao la ON la.id = ai.link_id
  WHERE la.token = p_token
    AND la.status = 'ativo'
    AND la.data_expiracao > now()
  ORDER BY ai.created_at DESC
  LIMIT 1;
$$;

-- 4. RPC pública: salvar fase do MyID
CREATE OR REPLACE FUNCTION public.salvar_fase_myid(
  p_token text,
  p_fase smallint,
  p_dados jsonb,
  p_score_parcial numeric,
  p_dimensoes jsonb,
  p_red_flags jsonb DEFAULT '[]'::jsonb,
  p_paciente_nome text DEFAULT NULL,
  p_data_avaliacao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link RECORD;
  v_avaliacao_id uuid;
  v_paciente_nome text;
BEGIN
  IF p_fase < 1 OR p_fase > 4 THEN
    RAISE EXCEPTION 'Fase inválida: %', p_fase;
  END IF;

  -- Valida link
  SELECT id, paciente_id, terapeuta_id INTO v_link
  FROM public.links_avaliacao
  WHERE token = p_token AND status = 'ativo' AND data_expiracao > now()
  LIMIT 1;

  IF v_link IS NULL THEN
    RAISE EXCEPTION 'Link inválido ou expirado';
  END IF;

  -- Busca avaliação em andamento (mais recente do link)
  SELECT id INTO v_avaliacao_id
  FROM public.avaliacoes_identidade
  WHERE link_id = v_link.id AND fase_concluida < 4
  ORDER BY created_at DESC
  LIMIT 1;

  -- Nome do paciente
  IF p_paciente_nome IS NULL THEN
    SELECT TRIM(COALESCE(nome,'') || ' ' || COALESCE(sobrenome,''))
    INTO v_paciente_nome
    FROM public.pacientes WHERE id = v_link.paciente_id;
  ELSE
    v_paciente_nome := p_paciente_nome;
  END IF;

  IF v_avaliacao_id IS NULL THEN
    -- Cria nova avaliação
    INSERT INTO public.avaliacoes_identidade (
      paciente_id, terapeuta_id, paciente_nome, data_avaliacao,
      dados_avaliacao, dimensoes_preenchidas, myid_score_parcial,
      red_flags, fase_atual, fase_concluida, link_id
    )
    VALUES (
      v_link.paciente_id, v_link.terapeuta_id, COALESCE(v_paciente_nome, 'Paciente'),
      COALESCE(p_data_avaliacao, to_char(now(), 'YYYY-MM-DD')),
      p_dados, p_dimensoes, p_score_parcial,
      p_red_flags, p_fase, p_fase, v_link.id
    )
    RETURNING id INTO v_avaliacao_id;
  ELSE
    -- Atualiza existente
    UPDATE public.avaliacoes_identidade
    SET dados_avaliacao = p_dados,
        dimensoes_preenchidas = p_dimensoes,
        myid_score_parcial = p_score_parcial,
        red_flags = COALESCE(p_red_flags, red_flags),
        fase_atual = GREATEST(fase_atual, p_fase),
        fase_concluida = GREATEST(fase_concluida, p_fase),
        concluido_em = CASE WHEN p_fase = 4 THEN now() ELSE concluido_em END,
        myid_score = CASE WHEN p_fase = 4 THEN p_score_parcial ELSE myid_score END,
        updated_at = now()
    WHERE id = v_avaliacao_id;
  END IF;

  RETURN v_avaliacao_id;
END;
$$;

-- 5. Trigger de notificação ao profissional a cada fase concluída
CREATE OR REPLACE FUNCTION public.notify_myid_fase_concluida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tem_red_flag boolean := false;
  v_titulo text;
  v_descricao text;
  v_tipo text;
BEGIN
  -- Só notifica quando fase_concluida avança
  IF NEW.fase_concluida IS NOT DISTINCT FROM COALESCE(OLD.fase_concluida, 0) THEN
    RETURN NEW;
  END IF;

  -- Detecta red flags (jsonb array com items)
  IF NEW.red_flags IS NOT NULL AND jsonb_typeof(NEW.red_flags) = 'array'
     AND jsonb_array_length(NEW.red_flags) > 0 THEN
    v_tem_red_flag := true;
  END IF;

  IF NEW.fase_concluida = 4 THEN
    v_tipo := CASE WHEN v_tem_red_flag THEN 'myid_red_flag' ELSE 'myid_completo' END;
    v_titulo := CASE WHEN v_tem_red_flag
      THEN '🚨 MyID concluído com Red Flags'
      ELSE '✅ MyID completo'
    END;
    v_descricao := COALESCE(NEW.paciente_nome, 'Paciente') ||
      ' finalizou o MyID. Score: ' || COALESCE(NEW.myid_score_parcial::text, '—');
  ELSIF NEW.fase_concluida = 1 AND v_tem_red_flag THEN
    v_tipo := 'myid_red_flag';
    v_titulo := '🚨 Red Flags detectados na Fase 1';
    v_descricao := COALESCE(NEW.paciente_nome, 'Paciente') ||
      ' apresentou sinais de alerta na primeira fase do MyID. Avaliação clínica recomendada.';
  ELSE
    v_tipo := 'myid_fase_concluida';
    v_titulo := '📝 MyID — Fase ' || NEW.fase_concluida || ' de 4 concluída';
    v_descricao := COALESCE(NEW.paciente_nome, 'Paciente') ||
      ' avançou para a Fase ' || (NEW.fase_concluida + 1) || ' do MyID.';
  END IF;

  INSERT INTO public.notificacoes (terapeuta_id, tipo, titulo, descricao, rota, metadata)
  VALUES (
    NEW.terapeuta_id, v_tipo, v_titulo, v_descricao,
    '/pacientes/' || NEW.paciente_id || '?tab=identidade',
    jsonb_build_object(
      'avaliacao_id', NEW.id,
      'paciente_id', NEW.paciente_id,
      'fase', NEW.fase_concluida,
      'red_flags', v_tem_red_flag
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_myid_fase ON public.avaliacoes_identidade;
CREATE TRIGGER trg_notify_myid_fase
AFTER INSERT OR UPDATE OF fase_concluida ON public.avaliacoes_identidade
FOR EACH ROW
EXECUTE FUNCTION public.notify_myid_fase_concluida();
