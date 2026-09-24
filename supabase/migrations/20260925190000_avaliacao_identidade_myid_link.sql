-- Liga cada avaliacoes_identidade ao MyID de origem. Permite ao complete-myid
-- saber se um MyID "concluído" chegou mesmo ao histórico/prontuário (havia MyIDs
-- concluídos sem avaliação — ex.: criados antes de o paciente ter profissional).
ALTER TABLE public.avaliacoes_identidade ADD COLUMN IF NOT EXISTS myid_avaliacao_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS uq_aval_identidade_myid
  ON public.avaliacoes_identidade (myid_avaliacao_id) WHERE myid_avaliacao_id IS NOT NULL;

-- Vincula as já sincronizadas (mesmas respostas).
UPDATE public.avaliacoes_identidade a
SET myid_avaliacao_id = m.id
FROM public.myid_avaliacoes m
WHERE a.myid_avaliacao_id IS NULL
  AND a.paciente_id = m.paciente_id
  AND a.dados_avaliacao->'respostas' = m.respostas_brutas;

-- MyID sem profissional mas cujo paciente hoje tem um: herda o vínculo.
UPDATE public.myid_avaliacoes m
SET terapeuta_id = p.terapeuta_id
FROM public.pacientes p
WHERE m.terapeuta_id IS NULL AND p.id = m.paciente_id AND p.terapeuta_id IS NOT NULL;

-- Padrão da dor dos MyIDs já salvos: sinais de alerta (febre/perda de peso,
-- dor noturna sem alívio) não são padrão "mecânico" (mesma regra do cálculo v2.3.1).
WITH novo AS (
  SELECT id,
    CASE
      WHEN (respostas_brutas->'bloco_2_red_flags'->>'fever')::boolean IS TRUE
        OR (respostas_brutas->'bloco_2_red_flags'->>'weight_loss')::boolean IS TRUE
        THEN 'Sinais sistêmicos (febre/perda de peso) — investigação médica'
      WHEN (respostas_brutas->'bloco_2_red_flags'->>'night_pain')::boolean IS TRUE
        THEN 'Não mecânico — dor noturna sem alívio postural (investigar)'
    END AS padrao
  FROM public.myid_avaliacoes
  WHERE status = 'concluido' AND resultado_processado IS NOT NULL
)
UPDATE public.myid_avaliacoes m
SET resultado_processado = jsonb_set(m.resultado_processado, '{pain_pattern}', to_jsonb(novo.padrao))
FROM novo WHERE novo.id = m.id AND novo.padrao IS NOT NULL;

UPDATE public.avaliacoes_identidade a
SET myid_analysis = jsonb_set(a.myid_analysis, '{pain_pattern}', m.resultado_processado->'pain_pattern'),
    dados_avaliacao = jsonb_set(a.dados_avaliacao, '{resultado,pain_pattern}', m.resultado_processado->'pain_pattern')
FROM public.myid_avaliacoes m
WHERE a.myid_avaliacao_id = m.id AND a.myid_analysis IS NOT NULL AND m.resultado_processado ? 'pain_pattern';
