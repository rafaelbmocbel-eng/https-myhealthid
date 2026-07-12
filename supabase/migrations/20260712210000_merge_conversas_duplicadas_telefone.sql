-- Junta conversas de WhatsApp duplicadas pelo MESMO número em formatos
-- diferentes (com/sem o código do país 55). Sintoma: o lembrete cai numa
-- conversa (telefone do cadastro, sem 55) e a resposta da cliente cai em outra
-- (telefone da Z-API, com 55). Consolidamos tudo na conversa mais antiga.
--
-- Chave de agrupamento: últimos 10 dígitos do telefone (DDD-ish + número),
-- por terapeuta. Mantém a conversa criada primeiro como PRIMÁRIA; move as
-- mensagens das duplicadas para ela e arquiva as duplicadas (não apaga, para
-- não mexer em FKs de cadências/notas).

WITH grp AS (
  SELECT
    id,
    terapeuta_id,
    paciente_id,
    nome_contato,
    created_at,
    right(regexp_replace(telefone, '\D', '', 'g'), 10) AS chave,
    first_value(id) OVER (
      PARTITION BY terapeuta_id, right(regexp_replace(telefone, '\D', '', 'g'), 10)
      ORDER BY created_at ASC, id ASC
    ) AS primaria_id
  FROM public.whatsapp_conversas
  WHERE length(regexp_replace(telefone, '\D', '', 'g')) >= 10
    AND arquivada = false
),
dups AS (
  SELECT id, primaria_id, paciente_id, nome_contato
  FROM grp
  WHERE id <> primaria_id
)
-- 1) Move as mensagens das duplicadas para a conversa primária
UPDATE public.whatsapp_mensagens_inbox m
SET conversa_id = d.primaria_id
FROM dups d
WHERE m.conversa_id = d.id;

-- 2) Religa paciente_id/nome na primária, se ela estiver sem
UPDATE public.whatsapp_conversas p
SET paciente_id  = COALESCE(p.paciente_id, d.paciente_id),
    nome_contato = COALESCE(p.nome_contato, d.nome_contato)
FROM (
  SELECT DISTINCT ON (primaria_id) primaria_id, paciente_id, nome_contato
  FROM public.whatsapp_conversas c
  JOIN (
    SELECT id, terapeuta_id,
      right(regexp_replace(telefone, '\D', '', 'g'), 10) AS chave,
      first_value(id) OVER (
        PARTITION BY terapeuta_id, right(regexp_replace(telefone, '\D', '', 'g'), 10)
        ORDER BY created_at ASC, id ASC
      ) AS primaria_id
    FROM public.whatsapp_conversas
    WHERE length(regexp_replace(telefone, '\D', '', 'g')) >= 10 AND arquivada = false
  ) g ON g.id = c.id
  WHERE g.id <> g.primaria_id AND c.paciente_id IS NOT NULL
) d
WHERE p.id = d.primaria_id;

-- 3) Recalcula a última mensagem da conversa primária (o trigger de rollup só
--    dispara em INSERT, então após mover mensagens precisamos recomputar)
UPDATE public.whatsapp_conversas c
SET ultima_mensagem    = sub.conteudo,
    ultima_mensagem_em = sub.created_at,
    ultima_direcao     = sub.direcao,
    updated_at         = now()
FROM (
  SELECT DISTINCT ON (conversa_id)
    conversa_id,
    COALESCE(conteudo, transcricao, '[mídia]') AS conteudo,
    created_at,
    direcao
  FROM public.whatsapp_mensagens_inbox
  ORDER BY conversa_id, created_at DESC
) sub
WHERE c.id = sub.conversa_id;

-- 4) Arquiva as conversas duplicadas (já sem mensagens próprias)
UPDATE public.whatsapp_conversas c
SET arquivada = true
FROM (
  SELECT id, terapeuta_id,
    right(regexp_replace(telefone, '\D', '', 'g'), 10) AS chave,
    first_value(id) OVER (
      PARTITION BY terapeuta_id, right(regexp_replace(telefone, '\D', '', 'g'), 10)
      ORDER BY created_at ASC, id ASC
    ) AS primaria_id
  FROM public.whatsapp_conversas
  WHERE length(regexp_replace(telefone, '\D', '', 'g')) >= 10 AND arquivada = false
) g
WHERE c.id = g.id AND g.id <> g.primaria_id;
