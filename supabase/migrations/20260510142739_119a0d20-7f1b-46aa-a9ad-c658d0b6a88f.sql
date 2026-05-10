
ALTER TABLE public.eventos
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS link_video text,
  ADD COLUMN IF NOT EXISTS publico_alvo text NOT NULL DEFAULT 'publico',
  ADD COLUMN IF NOT EXISTS recorrencia_grupo_id uuid,
  ADD COLUMN IF NOT EXISTS lembrete_24h_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS lembrete_1h_enviado boolean NOT NULL DEFAULT false;

ALTER TABLE public.eventos
  DROP CONSTRAINT IF EXISTS eventos_categoria_check,
  ADD CONSTRAINT eventos_categoria_check
    CHECK (categoria IN ('aula_online','workshop','live','triagem','desafio','sazonal','outro'));

ALTER TABLE public.eventos
  DROP CONSTRAINT IF EXISTS eventos_publico_alvo_check,
  ADD CONSTRAINT eventos_publico_alvo_check
    CHECK (publico_alvo IN ('publico','pacientes_ativos'));

CREATE INDEX IF NOT EXISTS idx_eventos_recorrencia_grupo ON public.eventos(recorrencia_grupo_id) WHERE recorrencia_grupo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_eventos_lembretes ON public.eventos(data_evento, ativo) WHERE ativo = true;

DROP VIEW IF EXISTS public.eventos_publicos;
CREATE VIEW public.eventos_publicos AS
  SELECT id, terapeuta_id, data_evento, horario_inicio, horario_fim, vagas_max,
         valor, cobrar_pagamento, ativo, created_at, updated_at, titulo, descricao,
         local, descricao_formulario, categoria, link_video
  FROM public.eventos
  WHERE ativo = true AND publico_alvo = 'publico';
