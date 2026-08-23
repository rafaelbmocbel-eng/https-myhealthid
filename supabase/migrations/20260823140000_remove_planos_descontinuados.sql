-- Remove planos descontinuados que ainda apareciam em Planos e preços do painel
-- admin: 'COB° ZERO', 'Studio' e 'Identidade'. Não são mais serviços/produtos.
-- Trava de segurança: só apaga o plano se NÃO houver assinatura ATIVA nele
-- (todos estão inativos e com 0 assinaturas). Idempotente.
DELETE FROM public.planos p
WHERE (p.nome ILIKE 'COB%ZERO' OR p.nome IN ('Studio', 'Identidade'))
  AND NOT EXISTS (
    SELECT 1 FROM public.assinaturas a
    WHERE a.plano_id = p.id AND a.status = 'ativa'
  );
