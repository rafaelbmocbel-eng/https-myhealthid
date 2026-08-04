-- ATIVAÇÃO EM MASSA dos clientes migrados que já têm MyID respondido.
--
-- Contexto: os clientes foram trazidos de outro app. Quem já respondeu o MyID
-- precisa: (a) o profissional poder criar planos (tratamento/nutrição/fisio) e
-- (b) o cliente conseguir acessar o portal.
--
-- Esta migração deixa a LINHA de paciente PRONTA:
--   - ativo = true                    (o vínculo por token/e-mail exige ativo)
--   - cadastro_status = 'completo'    (senão o portal manda para "completar cadastro")
--   - portal_token                    (link do portal para enviar ao cliente)
--   - terapeuta_id                    (para o profissional criar/ver os planos)
--   - tipo_conta = 'clinico'          (acesso clínico ao que o profissional liberar)
--
-- O user_id (login) NÃO é setado aqui: o cliente cria a conta ao entrar pelo
-- portal e é vinculado automaticamente (link_patient_user_by_token / por e-mail).
-- Não há como criar o login do cliente por ele.
--
-- IMPORTANTE: ao preencher terapeuta_id (antes NULL), a linha pode colidir com o
-- índice único (terapeuta_id, email) se já houver OUTRO paciente com o mesmo
-- e-mail sob esse terapeuta (ex.: cadastro duplicado). Essas linhas são PULADAS
-- para a migração ser segura e idempotente — o duplicado é resolvido à parte.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

WITH alvo AS (
  SELECT p.id,
    COALESCE(
      p.terapeuta_id,
      (SELECT m.terapeuta_id FROM public.myid_avaliacoes m
         WHERE m.paciente_id = p.id AND m.terapeuta_id IS NOT NULL
         ORDER BY m.updated_at DESC NULLS LAST LIMIT 1),
      (SELECT a.terapeuta_id FROM public.avaliacoes_identidade a
         WHERE a.paciente_id = p.id AND a.terapeuta_id IS NOT NULL
         ORDER BY a.created_at DESC NULLS LAST LIMIT 1)
    ) AS novo_terapeuta
  FROM public.pacientes p
  WHERE (
    EXISTS (SELECT 1 FROM public.myid_avaliacoes m WHERE m.paciente_id = p.id AND m.status = 'concluido')
    OR EXISTS (SELECT 1 FROM public.avaliacoes_identidade a WHERE a.paciente_id = p.id)
  )
  AND (
    -- só toca linhas que ainda não estão 100% prontas (idempotente)
    p.ativo IS DISTINCT FROM true
    OR p.cadastro_status IS DISTINCT FROM 'completo'
    OR p.portal_token IS NULL
    OR p.tipo_conta IS NULL OR p.tipo_conta = ''
    OR p.terapeuta_id IS NULL
  )
)
UPDATE public.pacientes p SET
  ativo = true,
  cadastro_status = 'completo',
  portal_token = COALESCE(p.portal_token, encode(gen_random_bytes(16), 'hex')),
  tipo_conta = COALESCE(NULLIF(p.tipo_conta, ''), 'clinico'),
  terapeuta_id = alvo.novo_terapeuta,
  updated_at = now()
FROM alvo
WHERE p.id = alvo.id
  -- Não ativa uma linha se o resultado colidiria com o índice único
  -- (terapeuta_id, email): outro paciente com o mesmo e-mail sob o mesmo terapeuta.
  AND (
    p.email IS NULL
    OR alvo.novo_terapeuta IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.pacientes q
      WHERE q.id <> p.id
        AND q.terapeuta_id = alvo.novo_terapeuta
        AND q.email IS NOT NULL
        AND lower(q.email) = lower(p.email)
    )
  );
