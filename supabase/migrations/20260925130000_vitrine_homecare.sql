-- Profissional de atendimento domiciliar (homecare): aparece em TODOS os bairros
-- da sua cidade na vitrine, não só no bairro cadastrado.
ALTER TABLE public.config_clinica ADD COLUMN IF NOT EXISTS vitrine_homecare boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.vitrine_terapeutas AS
SELECT
  c.terapeuta_id,
  COALESCE(c.vitrine_nome_exibicao, c.responsavel)  AS nome_exibicao,
  c.vitrine_bio                                       AS bio,
  c.vitrine_especialidades                            AS especialidades,
  c.vitrine_convenios                                 AS convenios,
  COALESCE(c.vitrine_cidade, c.cidade)                AS cidade,
  UPPER(COALESCE(NULLIF(c.vitrine_uf, ''), c.uf))     AS uf,
  c.vitrine_valor_sessao                              AS valor_sessao,
  COALESCE(c.vitrine_foto_url, c.logo_url)            AS foto_url,
  c.vitrine_modalidade                                AS modalidade,
  c.vitrine_bairro                                    AS bairro,
  c.vitrine_homecare                                  AS homecare
FROM public.config_clinica c
WHERE c.vitrine_ativo = true
  AND EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.user_id = c.terapeuta_id
      AND a.status IN ('ativa', 'trial')
      AND (a.data_fim IS NULL OR a.data_fim > now())
  );

GRANT SELECT ON public.vitrine_terapeutas TO anon, authenticated;
