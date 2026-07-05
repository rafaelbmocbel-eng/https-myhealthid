-- Adiciona 'historico_confirmado' ao CHECK constraint de tipo_diagnostico.
-- Diferencia achados confirmados do histórico autorelatado (maior peso visual
-- no Avatar Clínico) de achados clínicos presenciais (achado_clinico).

ALTER TABLE public.eventos_clinicos_anatomicos
  DROP CONSTRAINT IF EXISTS eventos_clinicos_anatomicos_tipo_diagnostico_check;

ALTER TABLE public.eventos_clinicos_anatomicos
  ADD CONSTRAINT eventos_clinicos_anatomicos_tipo_diagnostico_check
  CHECK (tipo_diagnostico IN (
    'relato_paciente',
    'historico_relatado',
    'historico_confirmado',
    'achado_clinico',
    'diagnostico_medico',
    'diagnostico_fisioterapia',
    'diagnostico_psicologia',
    'diagnostico_nutricao',
    'diagnostico_fonoaudiologia',
    'diagnostico_outro'
  ));
