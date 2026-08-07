-- Garante as colunas CASSI no paciente e força o PostgREST a recarregar o cache
-- de schema. Sem o reload, salvar paciente pode falhar com
-- "Could not find the 'codigos_cassi'/'carteirinha' column ... in the schema cache"
-- mesmo com a coluna já existindo no banco.
alter table public.pacientes add column if not exists carteirinha text;
alter table public.pacientes add column if not exists codigos_cassi jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
