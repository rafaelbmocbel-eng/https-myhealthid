-- Junta conversas de WhatsApp duplicadas do MESMO paciente (o lembrete numa
-- conversa e a resposta em outra, por diferença de formato de telefone —
-- código do país 55, 9º dígito, etc.). Chave: paciente_id (o vínculo é à prova
-- de formato). Consolida na conversa mais antiga; move mensagens; arquiva as
-- duplicadas (não apaga, para preservar FKs de cadências/notas).

WITH grp AS (
  SELECT
    id, terapeuta_id, paciente_id, nome_contato, created_at,
    first_value(id) OVER (
      PARTITION BY terapeuta_id, paciente_id
      ORDER BY created_at ASC, id ASC
    ) AS primaria_id
  FROM public.whatsapp_conversas
  WHERE paciente_id IS NOT NULL AND arquivada = false
)
-- 1) Move mensagens das duplicadas para a conversa primária
UPDATE public.whatsapp_mensagens_inbox m
SET conversa_id = g.primaria_id
FROM grp g
WHERE m.conversa_id = g.id AND g.id <> g.primaria_id;

-- 2) Recalcula última mensagem / direção da primária (o trigger de rollup só
--    dispara em INSERT; após mover mensagens é preciso recomputar)
UPDATE public.whatsapp_conversas c
SET ultima_mensagem    = sub.conteudo,
    ultima_mensagem_em = sub.created_at,
    ultima_direcao     = sub.direcao,
    updated_at         = now()
FROM (
  SELECT DISTINCT ON (conversa_id)
    conversa_id,
    COALESCE(conteudo, transcricao, '[mídia]') AS conteudo,
    created_at, direcao
  FROM public.whatsapp_mensagens_inbox
  ORDER BY conversa_id, created_at DESC
) sub
WHERE c.id = sub.conversa_id;

-- 3) Marca não-lidas na primária se a última mensagem consolidada é de entrada
UPDATE public.whatsapp_conversas c
SET nao_lidas = GREATEST(c.nao_lidas, 1)
WHERE c.ultima_direcao = 'entrada'
  AND c.id IN (SELECT DISTINCT primaria_id FROM grp);

-- 4) Arquiva as conversas duplicadas (já sem mensagens próprias)
UPDATE public.whatsapp_conversas c
SET arquivada = true
FROM grp g
WHERE c.id = g.id AND g.id <> g.primaria_id;
