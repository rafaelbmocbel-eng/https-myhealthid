-- Garante que TODO paciente ativo com telefone tenha uma conversa no Zap, já
-- vinculada (paciente_id), e reconecta conversas que perderam o vínculo por
-- diferença de formato de telefone.
--
-- Contexto: a trigger trg_sync_paciente_whatsapp já cria a conversa ao cadastrar
-- o paciente, mas o backfill original rodou apontando para projetos Supabase
-- ERRADOS (ver migrations de cron). Este migration re-semeia no projeto REAL e
-- religa os órfãos. É idempotente (ON CONFLICT / só mexe em quem está sem link).

-- ── 1. Re-semeia: cada paciente ativo com telefone vira uma conversa ──────────
WITH dedup AS (
  SELECT DISTINCT ON (p.terapeuta_id, regexp_replace(p.telefone, '\D', '', 'g'))
    p.terapeuta_id,
    p.id AS paciente_id,
    regexp_replace(p.telefone, '\D', '', 'g') AS phone,
    TRIM(COALESCE(p.nome, '') || ' ' || COALESCE(p.sobrenome, '')) AS nome
  FROM public.pacientes p
  WHERE p.ativo = true
    AND p.telefone IS NOT NULL
    AND length(regexp_replace(p.telefone, '\D', '', 'g')) >= 8
  ORDER BY p.terapeuta_id, regexp_replace(p.telefone, '\D', '', 'g'), p.created_at ASC
)
INSERT INTO public.whatsapp_conversas (terapeuta_id, paciente_id, telefone, nome_contato, pipeline_stage)
SELECT terapeuta_id, paciente_id, phone, nome, 'fechado'::crm_pipeline_stage FROM dedup
ON CONFLICT (terapeuta_id, telefone) DO UPDATE
  SET paciente_id  = EXCLUDED.paciente_id,
      nome_contato = COALESCE(whatsapp_conversas.nome_contato, EXCLUDED.nome_contato);

-- ── 2. Religa conversas órfãs (paciente_id NULL) pelo fim do telefone ─────────
-- Cobre casos em que a conversa nasceu de uma mensagem recebida cujo número veio
-- com código do país (55...) enquanto o cadastro do paciente está sem — ou vice
-- versa. Casa pelos últimos 10 dígitos (DDD + número, sem o 55).
UPDATE public.whatsapp_conversas wc
SET paciente_id  = sub.pid,
    nome_contato = COALESCE(wc.nome_contato, sub.nome)
FROM (
  SELECT DISTINCT ON (c.id)
    c.id AS cid,
    p.id AS pid,
    TRIM(COALESCE(p.nome, '') || ' ' || COALESCE(p.sobrenome, '')) AS nome
  FROM public.whatsapp_conversas c
  JOIN public.pacientes p
    ON p.terapeuta_id = c.terapeuta_id
   AND p.ativo = true
   AND p.telefone IS NOT NULL
   AND length(regexp_replace(p.telefone, '\D', '', 'g')) >= 10
   AND right(regexp_replace(p.telefone, '\D', '', 'g'), 10)
     = right(regexp_replace(c.telefone, '\D', '', 'g'), 10)
  WHERE c.paciente_id IS NULL
  ORDER BY c.id, p.created_at ASC
) sub
WHERE wc.id = sub.cid;
