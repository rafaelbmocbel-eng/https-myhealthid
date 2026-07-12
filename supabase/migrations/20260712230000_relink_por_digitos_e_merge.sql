-- Causa raiz: pacientes.telefone é salvo COM máscara ("(91) 98765-4321"). O
-- webhook casava o paciente com ilike sobre esse texto mascarado, então as
-- respostas recebidas caíam em conversas SEM paciente_id — escondidas e não
-- juntadas à conversa do paciente. Aqui: (1) função de busca por dígitos,
-- (2) religa as conversas órfãs aos pacientes, (3) junta por paciente_id.

-- ── 1) Função: acha paciente pela terminação (10 dígitos), ignorando máscara/55
CREATE OR REPLACE FUNCTION public.paciente_por_sufixo_telefone(p_terapeuta uuid, p_sufixo text)
RETURNS TABLE(id uuid, nome text, sobrenome text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.sobrenome
  FROM public.pacientes p
  WHERE p.terapeuta_id = p_terapeuta
    AND p.telefone IS NOT NULL
    AND length(regexp_replace(p.telefone, '\D', '', 'g')) >= 10
    AND right(regexp_replace(p.telefone, '\D', '', 'g'), 10) = p_sufixo
  ORDER BY p.ativo DESC, p.created_at ASC
  LIMIT 1;
$$;

-- ── 2) Religa conversas órfãs (paciente_id NULL) aos pacientes, por dígitos
UPDATE public.whatsapp_conversas c
SET paciente_id  = sub.pid,
    nome_contato = COALESCE(c.nome_contato, sub.nome)
FROM (
  SELECT DISTINCT ON (c2.id)
    c2.id AS cid,
    p.id  AS pid,
    TRIM(COALESCE(p.nome, '') || ' ' || COALESCE(p.sobrenome, '')) AS nome
  FROM public.whatsapp_conversas c2
  JOIN public.pacientes p
    ON p.terapeuta_id = c2.terapeuta_id
   AND p.telefone IS NOT NULL
   AND length(regexp_replace(p.telefone, '\D', '', 'g')) >= 10
   AND right(regexp_replace(p.telefone, '\D', '', 'g'), 10)
     = right(regexp_replace(c2.telefone, '\D', '', 'g'), 10)
  WHERE c2.paciente_id IS NULL AND c2.arquivada = false
  ORDER BY c2.id, p.ativo DESC, p.created_at ASC
) sub
WHERE c.id = sub.cid;

-- ── 3) Junta conversas duplicadas do mesmo paciente (mover msgs → primária)
WITH grp AS (
  SELECT id,
    first_value(id) OVER (PARTITION BY terapeuta_id, paciente_id ORDER BY created_at ASC, id ASC) AS primaria_id
  FROM public.whatsapp_conversas
  WHERE paciente_id IS NOT NULL AND arquivada = false
)
UPDATE public.whatsapp_mensagens_inbox m
SET conversa_id = g.primaria_id
FROM grp g
WHERE m.conversa_id = g.id AND g.id <> g.primaria_id;

-- ── 4) Recalcula última mensagem/direção das primárias
UPDATE public.whatsapp_conversas c
SET ultima_mensagem    = sub.conteudo,
    ultima_mensagem_em = sub.created_at,
    ultima_direcao     = sub.direcao,
    updated_at         = now()
FROM (
  SELECT DISTINCT ON (conversa_id)
    conversa_id, COALESCE(conteudo, transcricao, '[mídia]') AS conteudo, created_at, direcao
  FROM public.whatsapp_mensagens_inbox
  ORDER BY conversa_id, created_at DESC
) sub
WHERE c.id = sub.conversa_id;

-- ── 5) Marca não-lidas nas primárias que juntaram e cuja última é de entrada
WITH grp AS (
  SELECT id,
    first_value(id) OVER (PARTITION BY terapeuta_id, paciente_id ORDER BY created_at ASC, id ASC) AS primaria_id
  FROM public.whatsapp_conversas
  WHERE paciente_id IS NOT NULL AND arquivada = false
)
UPDATE public.whatsapp_conversas c
SET nao_lidas = GREATEST(c.nao_lidas, 1)
WHERE c.ultima_direcao = 'entrada'
  AND c.id IN (SELECT DISTINCT primaria_id FROM grp WHERE id <> primaria_id);

-- ── 6) Arquiva as duplicadas (já sem mensagens próprias)
WITH grp AS (
  SELECT id,
    first_value(id) OVER (PARTITION BY terapeuta_id, paciente_id ORDER BY created_at ASC, id ASC) AS primaria_id
  FROM public.whatsapp_conversas
  WHERE paciente_id IS NOT NULL AND arquivada = false
)
UPDATE public.whatsapp_conversas c
SET arquivada = true
FROM grp g
WHERE c.id = g.id AND g.id <> g.primaria_id;
