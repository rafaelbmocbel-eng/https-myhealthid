-- Adiciona modalidade de atendimento ao perfil da vitrine
ALTER TABLE public.config_clinica
  ADD COLUMN IF NOT EXISTS vitrine_modalidade text DEFAULT 'presencial'
    CHECK (vitrine_modalidade IN ('presencial', 'online', 'ambos'));

-- Recria a view incluindo o novo campo
CREATE OR REPLACE VIEW public.vitrine_terapeutas AS
SELECT
  c.terapeuta_id,
  COALESCE(c.vitrine_nome_exibicao, c.responsavel)  AS nome_exibicao,
  c.vitrine_bio                                       AS bio,
  c.vitrine_especialidades                            AS especialidades,
  c.vitrine_convenios                                 AS convenios,
  COALESCE(c.vitrine_cidade, c.cidade)                AS cidade,
  c.uf,
  c.vitrine_valor_sessao                              AS valor_sessao,
  COALESCE(c.vitrine_foto_url, c.logo_url)            AS foto_url,
  c.vitrine_modalidade                                AS modalidade
FROM public.config_clinica c
WHERE c.vitrine_ativo = true;

GRANT SELECT ON public.vitrine_terapeutas TO anon, authenticated;
