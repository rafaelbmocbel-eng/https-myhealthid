-- Atualiza a view vitrine_terapeutas para exibir apenas profissionais
-- com assinatura ativa ou em trial. Quando a assinatura vencer ou for
-- cancelada, o profissional some automaticamente do marketplace do paciente.
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
WHERE c.vitrine_ativo = true
  AND EXISTS (
    SELECT 1
    FROM public.assinaturas a
    WHERE a.user_id = c.terapeuta_id
      AND a.status IN ('ativa', 'trial')
      AND (a.data_fim IS NULL OR a.data_fim > now())
  );

GRANT SELECT ON public.vitrine_terapeutas TO anon, authenticated;
