-- Implementação MÍNIMA e compatível das funções do pgTAP usadas nos testes (plan, ok, is, isnt, lives_ok, throws_ok,
-- cmp_ok, todo_start/todo_end, diag, finish). Serve só para rodar supabase/tests/database/*.test.sql num Postgres comum,
-- sem instalar o pgTAP. No Supabase (`supabase test db`) vale o pgTAP de verdade. Se um teste novo usar outra função do
-- pgTAP (results_eq, is_empty, ...), acrescente-a aqui com a mesma semântica.
create or replace function extensions._pg(nome text) returns int language sql as $$ select coalesce(nullif(current_setting('shim.'||nome, true), ''), '0')::int $$;
create or replace function extensions._ps(nome text, v int) returns void language sql as $$ select set_config('shim.'||nome, v::text, false) $$;
create or replace function extensions.plan(n int) returns text language plpgsql as $$
begin
  perform extensions._ps('plano', n); perform extensions._ps('n', 0); perform extensions._ps('falhas', 0);
  perform extensions._ps('todo', 0); perform extensions._ps('todo_falhou', 0); perform extensions._ps('todo_passou', 0);
  return '1..' || n;
end $$;
create or replace function extensions.todo_start(why text default '') returns text language plpgsql as $$
begin perform extensions._ps('todo', 1); perform set_config('shim.todo_why', why, false); return null; end $$;
create or replace function extensions.todo_end() returns text language plpgsql as $$
begin perform extensions._ps('todo', 0); return null; end $$;
create or replace function extensions.ok(cond boolean, descr text default '') returns text language plpgsql as $$
declare n int; em_todo boolean := extensions._pg('todo') = 1; linha text;
begin
  n := extensions._pg('n') + 1; perform extensions._ps('n', n);
  if cond is true then
    linha := 'ok ' || n || ' - ' || coalesce(descr, '');
    if em_todo then linha := linha || ' # TODO passou (já pode tirar o todo): ' || current_setting('shim.todo_why', true); perform extensions._ps('todo_passou', extensions._pg('todo_passou') + 1); end if;
  else
    if em_todo then
      perform extensions._ps('todo_falhou', extensions._pg('todo_falhou') + 1);
      linha := 'not ok ' || n || ' - ' || coalesce(descr, '') || ' # TODO ' || current_setting('shim.todo_why', true);
    else
      perform extensions._ps('falhas', extensions._pg('falhas') + 1);
      linha := 'not ok ' || n || ' - ' || coalesce(descr, '');
    end if;
  end if;
  return linha;
end $$;
create or replace function extensions.is(have anyelement, want anyelement, descr text default '') returns text language plpgsql as $$
declare r text;
begin
  r := extensions.ok(have is not distinct from want, descr);
  if r like 'not ok%' then r := r || E'\n#         have: ' || coalesce(have::text, 'NULL') || E'\n#         want: ' || coalesce(want::text, 'NULL'); end if;
  return r;
end $$;
create or replace function extensions.isnt(have anyelement, want anyelement, descr text default '') returns text language plpgsql as $$
begin return extensions.ok(have is distinct from want, descr); end $$;
create or replace function extensions.cmp_ok(have anyelement, op text, want anyelement, descr text default '') returns text language plpgsql as $$
declare res boolean;
begin execute format('select $1 %s $2', op) using have, want into res; return extensions.ok(res, descr); end $$;
create or replace function extensions.lives_ok(sql text, descr text default '') returns text language plpgsql as $$
begin
  begin execute sql; exception when others then return extensions.ok(false, descr) || E'\n#         erro: ' || sqlerrm; end;
  return extensions.ok(true, descr);
end $$;
create or replace function extensions.throws_ok(sql text, errcode text, errmsg text default null, descr text default null) returns text language plpgsql as $$
begin
  begin execute sql;
  exception when others then
    return extensions.ok((errcode is null or errcode = sqlstate) and (errmsg is null or errmsg = sqlerrm), coalesce(descr, 'lançou ' || coalesce(errcode, '?')));
  end;
  return extensions.ok(false, coalesce(descr, 'deveria lançar ' || coalesce(errcode, '?')));
end $$;
create or replace function extensions.diag(msg text) returns text language sql as $$ select '# ' || msg $$;
create or replace function extensions.finish() returns setof text language plpgsql as $$
begin
  if extensions._pg('n') <> extensions._pg('plano') then return next '# Plano diferente: esperava ' || extensions._pg('plano') || ' e rodou ' || extensions._pg('n'); end if;
  if extensions._pg('falhas') > 0 then return next '# FALHOU ' || extensions._pg('falhas') || ' teste(s) de ' || extensions._pg('n'); end if;
  return next '# resumo: ' || extensions._pg('n') || ' testes, ' || extensions._pg('falhas') || ' falhas, ' || extensions._pg('todo_falhou') || ' problemas conhecidos (todo), ' || extensions._pg('todo_passou') || ' todo que já passam';
end $$;
grant execute on all functions in schema extensions to public;
