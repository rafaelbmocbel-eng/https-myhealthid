-- Corrige achados musculoesqueléticos que o fallback antigo salvou como
-- regiao_id='abdomen' (ex.: "dor em região poplítea", "gastrocnêmio").
-- CONSERVADOR: só toca em linhas cujo TEXTO menciona claramente uma estrutura
-- de membro/joelho/perna — achados abdominais legítimos ficam intocados.
-- Respeita a lateralidade (esquerdo/direito) pelo texto.

WITH norm AS (
  SELECT
    id,
    lower(translate(coalesce(tipo_achado, ''),
      'áàâãéêíóôõúûüç', 'aaaaeeiooouuuc')) AS n
  FROM public.eventos_clinicos_anatomicos
  WHERE regiao_id = 'abdomen' AND sistema = 'musculoesqueletico'
)
UPDATE public.eventos_clinicos_anatomicos e
SET regiao_id = CASE
  -- Poplítea (trás do joelho)
  WHEN norm.n ~ 'poplite' AND norm.n ~ 'direit'  THEN 'cavo_d'
  WHEN norm.n ~ 'poplite' AND norm.n ~ 'esquerd' THEN 'cavo_e'
  WHEN norm.n ~ 'poplite'                        THEN 'cavo_e'
  -- Panturrilha / gastrocnêmio / sóleo / gêmeos / tríceps sural
  WHEN (norm.n ~ 'gastrocnemio' OR norm.n ~ 'panturril' OR norm.n ~ 'soleo' OR norm.n ~ 'triceps sural' OR norm.n ~ 'gemeos') AND norm.n ~ 'direit'  THEN 'panturr_d'
  WHEN (norm.n ~ 'gastrocnemio' OR norm.n ~ 'panturril' OR norm.n ~ 'soleo' OR norm.n ~ 'triceps sural' OR norm.n ~ 'gemeos') AND norm.n ~ 'esquerd' THEN 'panturr_e'
  WHEN (norm.n ~ 'gastrocnemio' OR norm.n ~ 'panturril' OR norm.n ~ 'soleo' OR norm.n ~ 'triceps sural' OR norm.n ~ 'gemeos')                        THEN 'panturr_e'
  -- Joelho (menisco, cruzado, LCA/LCP, patela, colateral, pata de ganso)
  WHEN (norm.n ~ 'joelho' OR norm.n ~ 'menisco' OR norm.n ~ 'cruzado' OR norm.n ~ '\ylca\y' OR norm.n ~ '\ylcp\y' OR norm.n ~ 'patela' OR norm.n ~ 'pata de ganso') AND norm.n ~ 'direit'  THEN 'joelho_d'
  WHEN (norm.n ~ 'joelho' OR norm.n ~ 'menisco' OR norm.n ~ 'cruzado' OR norm.n ~ '\ylca\y' OR norm.n ~ '\ylcp\y' OR norm.n ~ 'patela' OR norm.n ~ 'pata de ganso') AND norm.n ~ 'esquerd' THEN 'joelho_e'
  WHEN (norm.n ~ 'joelho' OR norm.n ~ 'menisco' OR norm.n ~ 'cruzado' OR norm.n ~ '\ylca\y' OR norm.n ~ '\ylcp\y' OR norm.n ~ 'patela' OR norm.n ~ 'pata de ganso')                        THEN 'joelho_e'
  ELSE e.regiao_id
END
FROM norm
WHERE e.id = norm.id
  AND (
    norm.n ~ 'poplite' OR norm.n ~ 'gastrocnemio' OR norm.n ~ 'panturril'
    OR norm.n ~ 'soleo' OR norm.n ~ 'triceps sural' OR norm.n ~ 'gemeos'
    OR norm.n ~ 'joelho' OR norm.n ~ 'menisco' OR norm.n ~ 'cruzado'
    OR norm.n ~ '\ylca\y' OR norm.n ~ '\ylcp\y' OR norm.n ~ 'patela'
    OR norm.n ~ 'pata de ganso'
  );
