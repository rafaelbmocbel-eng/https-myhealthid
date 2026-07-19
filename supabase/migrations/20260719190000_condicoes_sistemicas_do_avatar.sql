-- NORMALIZAÇÃO: condições SISTÊMICAS que estavam presas a uma região do corpo
-- (ansiedade na cabeça, diabetes no abdômen, etc.) passam a regiao_id='sistemico'
-- com o SISTEMA correto. Assim saem do mapa do corpo, acendem o sistema no
-- avatar e aparecem no card "Condições sistêmicas".
--
-- SEGURA: só toca achados cujo NOME é uma condição sistêmica conhecida. Não
-- mexe em achados regionais legítimos (ex.: "dor no joelho", "tendinite no ombro").

UPDATE public.eventos_clinicos_anatomicos e
SET regiao_id = 'sistemico',
    sistema = (CASE
      WHEN lower(e.tipo_achado) ~ 'ansiedad|depress|ins[oô]nia|enxaqueca|fibromialgia|p[aâ]nico|estresse|transtorno' THEN 'nervoso'
      WHEN lower(e.tipo_achado) ~ 'hipertens|press[aã]o alta|dislipidemia|colesterol|arritmia|cardiopat|insufici[eê]ncia card' THEN 'cardiovascular'
      WHEN lower(e.tipo_achado) ~ 'diabet|hipotireoid|hipertireoid|tireoid|obesidad|s[ií]ndrome metab' THEN 'endocrino'
      WHEN lower(e.tipo_achado) ~ 'asma|dpoc|bronquit|enfisema' THEN 'respiratorio'
      WHEN lower(e.tipo_achado) ~ 'refluxo|gastrit|[uú]lcera|c[oó]lon irrit|intestin' THEN 'digestorio'
      WHEN lower(e.tipo_achado) ~ 'renal|\brim\b|nefro|urin' THEN 'urinario'
      WHEN lower(e.tipo_achado) ~ 'reumat|l[uú]pus|osteoporos|artrite reumat' THEN 'musculoesqueletico'
      WHEN lower(e.tipo_achado) ~ 'anemia|leucem|linfom' THEN 'linfatico'
      ELSE e.sistema
    END)::public.sistema_corporal,
    updated_at = now()
WHERE e.regiao_id IS DISTINCT FROM 'sistemico'
  AND lower(e.tipo_achado) ~ ('ansiedad|depress|ins[oô]nia|enxaqueca|fibromialgia|p[aâ]nico|estresse|transtorno|'
    || 'hipertens|press[aã]o alta|dislipidemia|colesterol|arritmia|cardiopat|insufici[eê]ncia card|'
    || 'diabet|hipotireoid|hipertireoid|tireoid|obesidad|s[ií]ndrome metab|'
    || 'asma|dpoc|bronquit|enfisema|'
    || 'refluxo|gastrit|[uú]lcera|c[oó]lon irrit|intestin|'
    || 'renal|\brim\b|nefro|urin|'
    || 'reumat|l[uú]pus|osteoporos|artrite reumat|'
    || 'anemia|leucem|linfom');
