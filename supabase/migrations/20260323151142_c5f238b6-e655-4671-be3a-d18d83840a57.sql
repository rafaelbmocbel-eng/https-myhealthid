ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS origem text DEFAULT 'manual';
ALTER TABLE public.eventos ADD COLUMN IF NOT EXISTS descricao_formulario text;