-- Recreate eventos_publicos view with SECURITY INVOKER
DROP VIEW IF EXISTS public.eventos_publicos;

CREATE VIEW public.eventos_publicos
WITH (security_invoker = true)
AS
SELECT
  id,
  terapeuta_id,
  data_evento,
  horario_inicio,
  horario_fim,
  vagas_max,
  valor,
  cobrar_pagamento,
  ativo,
  created_at,
  updated_at,
  titulo,
  descricao,
  local,
  descricao_formulario
FROM eventos
WHERE ativo = true;