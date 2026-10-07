-- O paciente só enxerga o plano que o profissional LIBEROU, por RPC que remove da
-- resposta a revisão de segurança, a triagem e a justificativa (dados do profissional).
CREATE OR REPLACE FUNCTION public.gov_publico(p_conteudo jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN jsonb_typeof(p_conteudo) = 'object' THEN
    (p_conteudo - '_governanca') || jsonb_build_object('_governanca', jsonb_strip_nulls(jsonb_build_object(
      'versao_plano', p_conteudo -> '_governanca' -> 'versao_plano',
      'aprovacao', jsonb_strip_nulls(jsonb_build_object(
        'por_nome', p_conteudo -> '_governanca' -> 'aprovacao' -> 'por_nome',
        'em', p_conteudo -> '_governanca' -> 'aprovacao' -> 'em',
        'versao', p_conteudo -> '_governanca' -> 'aprovacao' -> 'versao')),
      'fonte', jsonb_strip_nulls(jsonb_build_object(
        'tipo', p_conteudo -> '_governanca' -> 'fonte' -> 'tipo',
        'modelo', p_conteudo -> '_governanca' -> 'fonte' -> 'modelo',
        'gerado_em', p_conteudo -> '_governanca' -> 'fonte' -> 'gerado_em')),
      'acompanhamento', p_conteudo -> '_governanca' -> 'acompanhamento')))
  ELSE p_conteudo END;
$$;

CREATE OR REPLACE FUNCTION public.meu_plano_liberado(p_tipo text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pac uuid; v_out jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_pac FROM public.pacientes WHERE user_id = auth.uid() LIMIT 1;
  IF v_pac IS NULL THEN RETURN NULL; END IF;
  IF p_tipo = 'treino' THEN
    SELECT jsonb_build_object('id', id, 'titulo', titulo, 'objetivo', objetivo,
             'created_at', created_at, 'updated_at', updated_at,
             'conteudo', public.gov_publico(estrutura))
      INTO v_out FROM public.planos_treino
     WHERE paciente_id = v_pac AND ativo AND aprovado
     ORDER BY created_at DESC LIMIT 1;
  ELSIF p_tipo = 'nutricao' THEN
    SELECT jsonb_build_object('id', id, 'titulo', titulo, 'objetivo', objetivo,
             'calorias_alvo', calorias_alvo, 'created_at', created_at, 'updated_at', updated_at,
             'conteudo', public.gov_publico(plano))
      INTO v_out FROM public.planos_alimentares
     WHERE paciente_id = v_pac AND ativo AND aprovado
     ORDER BY created_at DESC LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Tipo de plano inválido: %', p_tipo;
  END IF;
  RETURN v_out;
END; $$;

REVOKE ALL ON FUNCTION public.gov_publico(jsonb) FROM public, anon;
REVOKE ALL ON FUNCTION public.meu_plano_liberado(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gov_publico(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.meu_plano_liberado(text) TO authenticated;
