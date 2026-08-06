-- Códigos CASSI habituais do paciente (pré-preenchem novas guias). Complementa a
-- carteirinha — ambos podem ser preenchidos no cadastro normal ou no Controle CASSI.
alter table public.pacientes add column if not exists codigos_cassi jsonb not null default '[]'::jsonb;
