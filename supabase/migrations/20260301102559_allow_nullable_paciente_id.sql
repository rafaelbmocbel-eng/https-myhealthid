-- Migração para permitir que o link de agendamento online não exija um paciente_id (Link Geral)
ALTER TABLE links_agenda_paciente ALTER COLUMN paciente_id DROP NOT NULL;

-- Adicionando comentário para documentação
COMMENT ON COLUMN links_agenda_paciente.paciente_id IS 'Opcional. Se nulo, o link é considerado geral para novos pacientes.';
