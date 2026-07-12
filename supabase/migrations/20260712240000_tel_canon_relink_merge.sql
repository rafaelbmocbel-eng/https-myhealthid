-- Casamento de telefone robusto: normaliza para DDD + últimos 8 dígitos,
-- ignorando código do país (55) E o 9º dígito do celular. Assim o cadastro
-- "(91) 8888-7777" e o número da Z-API "5591988887777" batem.

-- ── Função de normalização canônica do telefone ──────────────────────────────
CREATE OR REPLACE FUNCTION public.tel_canon(t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN length(ds) >= 10 THEN left(ds, 2) || right(ds, 8)
    ELSE ds
  END
  FROM (
    SELECT CASE WHEN length(d) >= 12 AND left(d, 2) = '55' THEN substr(d, 3) ELSE d END AS ds
    FROM (SELECT regexp_replace(COALESCE(t, ''), '\D', '', 'g') AS d) a
  ) b;
$$;

-- ── RPC: acha paciente pelo telefone normalizado (usada pelo webhook) ─────────
CREATE OR REPLACE FUNCTION public.paciente_por_telefone_norm(p_terapeuta uuid, p_telefone text)
RETURNS TABLE(id uuid, nome text, sobrenome text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.sobrenome
  FROM public.pacientes p
  WHERE p.terapeuta_id = p_terapeuta
    AND p.telefone IS NOT NULL
    AND public.tel_canon(p.telefone) = public.tel_canon(p_telefone)
    AND length(public.tel_canon(p_telefone)) >= 10
  ORDER BY p.ativo DESC, p.created_at ASC
  LIMIT 1;
$$;

-- ── 1) Religa conversas órfãs (paciente_id NULL) aos pacientes, por canônico ──
UPDATE public.whatsapp_conversas c
SET paciente_id  = sub.pid,
    nome_contato = COALESCE(c.nome_contato, sub.nome)
FROM (
  SELECT DISTINCT ON (c2.id)
    c2.id AS cid, p.id AS pid,
    TRIM(COALESCE(p.nome, '') || ' ' || COALESCE(p.sobrenome, '')) AS nome
  FROM public.whatsapp_conversas c2
  JOIN public.pacientes p
    ON p.terapeuta_id = c2.terapeuta_id
   AND p.telefone IS NOT NULL
   AND public.tel_canon(p.telefone) = public.tel_canon(c2.telefone)
   AND length(public.tel_canon(c2.telefone)) >= 10
  WHERE c2.paciente_id IS NULL AND c2.arquivada = false
  ORDER BY c2.id, p.ativo DESC, p.created_at ASC
) sub
WHERE c.id = sub.cid;

-- ── 2) Move mensagens das duplicadas do mesmo paciente para a primária ────────
WITH grp AS (
  SELECT id, first_value(id) OVER (PARTITION BY terapeuta_id, paciente_id ORDER BY created_at ASC, id ASC) AS primaria_id
  FROM public.whatsapp_conversas WHERE paciente_id IS NOT NULL AND arquivada = false
)
UPDATE public.whatsapp_mensagens_inbox m
SET conversa_id = g.primaria_id
FROM grp g
WHERE m.conversa_id = g.id AND g.id <> g.primaria_id;

-- ── 3) Recalcula última mensagem/direção das primárias ────────────────────────
UPDATE public.whatsapp_conversas c
SET ultima_mensagem = sub.conteudo, ultima_mensagem_em = sub.created_at,
    ultima_direcao = sub.direcao, updated_at = now()
FROM (
  SELECT DISTINCT ON (conversa_id) conversa_id,
    COALESCE(conteudo, transcricao, '[mídia]') AS conteudo, created_at, direcao
  FROM public.whatsapp_mensagens_inbox ORDER BY conversa_id, created_at DESC
) sub
WHERE c.id = sub.conversa_id;

-- ── 4) Não-lidas nas primárias que juntaram e cuja última é de entrada ────────
WITH grp AS (
  SELECT id, first_value(id) OVER (PARTITION BY terapeuta_id, paciente_id ORDER BY created_at ASC, id ASC) AS primaria_id
  FROM public.whatsapp_conversas WHERE paciente_id IS NOT NULL AND arquivada = false
)
UPDATE public.whatsapp_conversas c
SET nao_lidas = GREATEST(c.nao_lidas, 1)
WHERE c.ultima_direcao = 'entrada'
  AND c.id IN (SELECT DISTINCT primaria_id FROM grp WHERE id <> primaria_id);

-- ── 5) Arquiva as duplicadas ──────────────────────────────────────────────────
WITH grp AS (
  SELECT id, first_value(id) OVER (PARTITION BY terapeuta_id, paciente_id ORDER BY created_at ASC, id ASC) AS primaria_id
  FROM public.whatsapp_conversas WHERE paciente_id IS NOT NULL AND arquivada = false
)
UPDATE public.whatsapp_conversas c
SET arquivada = true
FROM grp g
WHERE c.id = g.id AND g.id <> g.primaria_id;
