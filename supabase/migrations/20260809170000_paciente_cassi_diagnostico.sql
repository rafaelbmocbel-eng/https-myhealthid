-- Diagnóstico CASSI fixo no CADASTRO do cliente (igual carteirinha e códigos):
-- só muda quando o profissional mudar. Pré-preenche pedidos e guias novas.
alter table public.pacientes
  add column if not exists cassi_diagnostico text;

notify pgrst, 'reload schema';
