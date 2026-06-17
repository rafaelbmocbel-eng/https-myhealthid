-- Tipo de diagnóstico/achado no avatar: distingue relato do paciente,
-- diagnóstico médico (CID), diagnóstico fisioterápico, psicológico, etc.

ALTER TABLE public.eventos_clinicos_anatomicos
  ADD COLUMN IF NOT EXISTS tipo_diagnostico text
    DEFAULT 'achado_clinico'
    CHECK (tipo_diagnostico IN (
      'relato_paciente',       -- Sintoma autodeclarado (não confirmado profissionalmente)
      'achado_clinico',        -- Achado genérico de avaliação presencial
      'diagnostico_medico',    -- Diagnóstico nosológico (médico) — pode ter CID
      'diagnostico_fisioterapia', -- Diagnóstico cinético-funcional (fisioterapeuta)
      'diagnostico_psicologia',   -- Diagnóstico psicológico
      'diagnostico_nutricao',     -- Diagnóstico nutricional
      'diagnostico_fonoaudiologia', -- Diagnóstico fonoaudiológico
      'diagnostico_outro'      -- Outro especialista
    ));

COMMENT ON COLUMN public.eventos_clinicos_anatomicos.tipo_diagnostico IS
  'Classifica a natureza clínica do achado: relato do paciente, achado presencial,
   diagnóstico médico nosológico (com CID), ou diagnóstico específico por profissão.';
