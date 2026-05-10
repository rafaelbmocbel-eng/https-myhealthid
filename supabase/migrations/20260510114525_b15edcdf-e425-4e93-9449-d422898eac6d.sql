-- RPC pública para visualizar MyID concluído read-only via token_acesso
CREATE OR REPLACE FUNCTION public.get_myid_concluido_publico(p_token text)
RETURNS TABLE(
  id uuid,
  paciente_nome text,
  data_conclusao timestamptz,
  resultado_processado jsonb,
  myid_score numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ma.id,
    (p.nome || ' ' || COALESCE(p.sobrenome, '')) AS paciente_nome,
    ma.updated_at AS data_conclusao,
    ma.resultado_processado,
    ma.myid_score_parcial AS myid_score
  FROM public.myid_avaliacoes ma
  LEFT JOIN public.pacientes p ON p.id = ma.paciente_id
  WHERE ma.token_acesso = p_token
    AND ma.status = 'concluido'
    AND ma.resultado_processado IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_myid_concluido_publico(text) TO anon, authenticated;