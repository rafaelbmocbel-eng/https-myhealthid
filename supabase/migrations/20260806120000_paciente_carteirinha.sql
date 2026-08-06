-- Carteirinha do plano (CASSI) no paciente — número da carteirinha é atributo do
-- paciente (estável), diferente do nº da guia. Usado no Controle CASSI.
alter table public.pacientes add column if not exists carteirinha text;
