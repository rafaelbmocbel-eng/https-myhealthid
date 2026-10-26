#!/usr/bin/env bash
# ENSAIO LOCAL das migrações da lista do Faturamento CASSI + lançamentos + função de juntar cadastros (esquema do Supabase simulado:
# papéis anon/authenticated/service_role, auth.uid(), privilégios padrão, RLS, privilégio por coluna, concorrência com pgbench).
# Precisa de PostgreSQL 16 instalado localmente (initdb, pg_ctl, psql e, no ensaio de lançamentos, pgbench). Sobe um servidor
# DESCARTÁVEL numa pasta temporária (porta própria, sem rede) e o apaga no fim; nunca toca em banco de verdade.
# Não roda no CI: é o ensaio manual que se faz antes de publicar uma migração (o vitest só confere o texto do SQL).
# Como rodar:  bash supabase/ensaios/lancamentos.sh     (como root usa o usuário postgres; fora de root, o seu usuário)
set -u
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
M1="${M1:-$AQUI/../migrations/20261025190000_cassi_financeiro_clientes.sql}"
M2="${M2:-$AQUI/../migrations/20261025230000_cassi_financeiro_lancamentos.sql}"
PGBIN="${PGBIN:-$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)}"; PASTA="${PASTA:-/var/tmp/cassi-lanc-pg}"; PORTA="${PORTA:-55442}"; DB=ensaio
como_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
PSQL=("$PGBIN/psql" -X -q -h "$PASTA" -p "$PORTA" -U postgres)
parar() { como_pg "$PGBIN/pg_ctl" -D "$PASTA/pgdata" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PASTA"; }
parar; mkdir -p "$PASTA" && { [ "$(id -u)" != 0 ] || chown postgres "$PASTA"; }
como_pg "$PGBIN/initdb" -D "$PASTA/pgdata" -U postgres --auth=trust >/dev/null
como_pg "$PGBIN/pg_ctl" -D "$PASTA/pgdata" -o "-p $PORTA -k $PASTA -c listen_addresses=''" -w -l "$PASTA/log" start >/dev/null
trap parar EXIT
"${PSQL[@]}" -d postgres -c "create database $DB" >/dev/null
sql() { "${PSQL[@]}" -d "$DB" -v ON_ERROR_STOP=1 -At "$@"; }
PASSOU=0; FALHOU=0
ok()  { PASSOU=$((PASSOU+1)); echo "  [ok]    $1"; }
bad() { FALHOU=$((FALHOU+1)); echo "  [FALHA] $1  -> $2"; }
igual() { [ "$2" = "$3" ] && ok "$1" || bad "$1" "esperado [$3] veio [$2]"; }
sql <<'SQL'
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role; grant usage on schema public to anon, authenticated, service_role;
create table public.pacientes (id uuid primary key default gen_random_uuid(), terapeuta_id uuid not null, nome text);
grant select, insert, update, delete on public.pacientes to authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
SQL
sql -f "$M1" >/dev/null 2>&1 && ok "migração 1 (lista) roda" || { bad "migração 1" "$(sql -f "$M1" 2>&1 | tail -3)"; exit 1; }
A=11111111-1111-1111-1111-111111111111; B=22222222-2222-2222-2222-222222222222
PA1=aaaaaaaa-0000-0000-0000-000000000001; PA2=aaaaaaaa-0000-0000-0000-000000000002; PB1=bbbbbbbb-0000-0000-0000-000000000001
sql -c "insert into public.pacientes(id, terapeuta_id, nome) values ('$PA1','$A','Ana'),('$PA2','$A','Bia'),('$PB1','$B','Caio')"
# linhas que já existem em produção quando a migração 2 chegar (a lista de outubro, sem lançamento)
sql -c "set role authenticated; select set_config('request.jwt.claim.sub','$A',false); insert into public.cassi_financeiro_clientes(mes, paciente_id) values ('2026-10','$PA1'),('2026-10','$PA2')" >/dev/null
sql -f "$M2" >/dev/null 2>&1 && ok "migração 2 (lançamentos) roda sobre linhas que já existem" || { bad "migração 2" "$(sql -f "$M2" 2>&1 | tail -3)"; exit 1; }
sql -f "$M2" >/dev/null 2>&1 && ok "rodar de novo não quebra (idempotente)" || bad "idempotente" "$(sql -f "$M2" 2>&1 | tail -3)"
[ "$(sql -c "select count(*) from public.cassi_financeiro_clientes where lancamentos = '[]'::jsonb")" = "2" ] && ok "linhas antigas ficam com lançamento vazio" || bad "linhas antigas" "default errado"

como() { sql -v VERBOSITY=terse 2>&1 -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); $2" | grep -v '^$' | tr '\n' ' '; }
esperaErro() { local r; r="$(como "$2" "$3")"; if echo "$r" | grep -qi "$4"; then ok "$1"; else bad "$1" "$r"; fi; }
esperaOk()   { local r; r="$(como "$2" "$3")"; if echo "$r" | grep -qi "error"; then bad "$1" "$r"; else ok "$1"; fi; }
upd() { echo "update public.cassi_financeiro_clientes set lancamentos = '$1'::jsonb where mes='2026-10' and paciente_id='$PA1'"; }

esperaOk "A lança uma guia completa" $A "$(upd '[{"012":10,"144":1},{"012":4,"301":2}]')"
[ "$(sql -c "select lancamentos::text from public.cassi_financeiro_clientes where paciente_id='$PA1'")" = '[{"012": 10, "144": 1}, {"012": 4, "301": 2}]' ] && ok "o lançamento ficou gravado" || bad "gravado" "$(sql -c "select lancamentos::text from public.cassi_financeiro_clientes where paciente_id='$PA1'")"
esperaOk "lista vazia é válida (apagar o lançamento)" $A "$(upd '[]')"
esperaOk "12 guias é o máximo aceito" $A "$(upd "[$(printf '{"012":1},%.0s' {1..11}){\"012\":1}]")"
esperaErro "13 guias é recusado" $A "$(upd "[$(printf '{"012":1},%.0s' {1..12}){\"012\":1}]")" "cassi_financeiro_clientes_lancamentos_validos\|violates check"
esperaErro "objeto no lugar de lista é recusado" $A "$(upd '{"012":10}')" "violates check\|lancamentos_validos"
esperaErro "guia que não é objeto é recusada" $A "$(upd '[1,2]')" "violates check\|lancamentos_validos"
esperaErro "quantidade em texto é recusada" $A "$(upd '[{"012":"10"}]')" "violates check\|lancamentos_validos"
esperaErro "quantidade com decimal é recusada" $A "$(upd '[{"012":1.5}]')" "violates check\|lancamentos_validos"
esperaErro "quantidade negativa é recusada" $A "$(upd '[{"012":-1}]')" "violates check\|lancamentos_validos"
esperaErro "quantidade acima de 999 é recusada" $A "$(upd '[{"012":1000}]')" "violates check\|lancamentos_validos"
esperaOk "quantidade 999 é aceita" $A "$(upd '[{"012":999}]')"
esperaErro "código com mais de 12 caracteres é recusado" $A "$(upd '[{"abcdefghijklm":1}]')" "violates check\|lancamentos_validos"
esperaErro "código vazio é recusado" $A "$(upd '[{"":1}]')" "violates check\|lancamentos_validos"
esperaErro "NULL é recusado" $A "update public.cassi_financeiro_clientes set lancamentos = null where paciente_id='$PA1'" "null value\|not-null\|violates"
sql -c "set role authenticated; select set_config('request.jwt.claim.sub','$B',false); update public.cassi_financeiro_clientes set lancamentos = '[{\"012\":7}]'::jsonb where paciente_id='$PA1'" >/dev/null
[ "$(sql -c "select lancamentos::text from public.cassi_financeiro_clientes where paciente_id='$PA1'")" = '[{"012": 999}]' ] && ok "B não altera o lançamento de A (a segurança por linha esconde a linha)" || bad "isolamento de UPDATE" "mudou"
esperaErro "ninguém troca o mês da linha (privilégio só na coluna lancamentos)" $A "update public.cassi_financeiro_clientes set mes='2026-11' where paciente_id='$PA1'" "permission denied"
esperaErro "ninguém troca o cliente da linha" $A "update public.cassi_financeiro_clientes set paciente_id='$PA2' where paciente_id='$PA1'" "permission denied"
esperaErro "ninguém troca o profissional da linha" $A "update public.cassi_financeiro_clientes set terapeuta_id='$B' where paciente_id='$PA1'" "permission denied"
esperaErro "TRUNCATE continua negado" $A "truncate public.cassi_financeiro_clientes" "permission denied"
r="$(sql -v VERBOSITY=terse 2>&1 -c "set role anon; update public.cassi_financeiro_clientes set lancamentos='[]'::jsonb")"; echo "$r" | grep -qi "permission denied" && ok "anon não atualiza" || bad "anon" "$r"
# inserir já com lançamento (o app pode inserir assim)
esperaOk "inserir cliente já com lançamento válido" $A "insert into public.cassi_financeiro_clientes(mes, paciente_id, lancamentos) values ('2026-11','$PA1','[{\"012\":3}]')"
esperaErro "inserir com lançamento inválido é recusado" $A "insert into public.cassi_financeiro_clientes(mes, paciente_id, lancamentos) values ('2026-12','$PA1','[{\"012\":-3}]')" "violates check\|lancamentos_validos"

# ---- teto de códigos por guia (30)
chaves() { local n=$1 out="" i; for ((i=1;i<=n;i++)); do out+="\"k$i\":1,"; done; echo "${out%,}"; }
esperaOk "30 códigos numa guia é o máximo aceito" $A "$(upd "[{$(chaves 30)}]")"
esperaErro "31 códigos numa guia é recusado" $A "$(upd "[{$(chaves 31)}]")" "violates check\|lancamentos_validos"

# ---- juntar cadastros (função atômica)
PA3=aaaaaaaa-0000-0000-0000-000000000003; PA4=aaaaaaaa-0000-0000-0000-000000000004
sql -c "insert into public.pacientes(id, terapeuta_id, nome) values ('$PA3','$A','Duplicado'),('$PA4','$A','Fica')"
ins() { sql -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); insert into public.cassi_financeiro_clientes(mes, paciente_id, lancamentos) values ('$2','$3','$4'::jsonb)" >/dev/null; }
lan() { sql -c "select coalesce((select lancamentos::text from public.cassi_financeiro_clientes where mes='$1' and paciente_id='$2'), '(sem linha)')"; }
juntar() { sql -v VERBOSITY=terse 2>&1 -c "set role authenticated; select set_config('request.jwt.claim.sub','$1',false); select public.cassi_juntar_financeiro_clientes('$2','$3')" | grep -v '^$' | tail -2 | tr '\n' ' '; }
ins $A 2026-09 $PA3 '[{"012":2}]'
ins $A 2026-08 $PA3 '[{"012":3}]'
ins $A 2026-08 $PA4 '[{"144":1}]'
r="$(juntar $A $PA3 $PA4)"; echo "$r" | grep -q "2" && ok "juntar devolve quantos meses tratou (2)" || bad "retorno" "$r"
igual "mês que só o duplicado tinha: linha copiada para quem fica" "$(lan 2026-09 $PA4)" '[{"012": 2}]'
igual "mês dos dois: guias de quem fica primeiro, depois as do duplicado" "$(lan 2026-08 $PA4)" '[{"144": 1}, {"012": 3}]'
igual "o duplicado fica sem linhas" "$(sql -c "select count(*) from public.cassi_financeiro_clientes where paciente_id='$PA3'")" "0"
r="$(juntar $A $PA3 $PA4)"; igual "rodar de novo não soma outra vez (nada a juntar)" "$(lan 2026-08 $PA4)" '[{"144": 1}, {"012": 3}]'
# guia vazia não conta
ins $A 2026-05 $PA3 '[{}]'; ins $A 2026-05 $PA4 '[{"012":1}]'
juntar $A $PA3 $PA4 >/dev/null
igual "guia vazia do duplicado é descartada" "$(lan 2026-05 $PA4)" '[{"012": 1}]'
# estouro de 6 guias: nada é feito, nem os meses anteriores (atômico)
ins $A 2026-06 $PA3 '[{"012":1}]'
ins $A 2026-07 $PA3 '[{"012":1},{"012":2},{"012":3},{"012":4}]'
ins $A 2026-07 $PA4 '[{"144":1},{"144":1},{"144":1}]'
r="$(juntar $A $PA3 $PA4)"; echo "$r" | grep -qi "máximo é 6\|maximo e 6\|ficaria com 7" && ok "mais de 6 guias no mês: recusa com mensagem clara" || bad "estouro" "$r"
igual "falha no 2º mês desfaz também o 1º (nada foi copiado)" "$(lan 2026-06 $PA4)" "(sem linha)"
igual "e o duplicado continua com as linhas dele" "$(sql -c "select count(*) from public.cassi_financeiro_clientes where paciente_id='$PA3'")" "2"
# corrige e tenta de novo: cada guia entra uma vez só
sql -c "update public.cassi_financeiro_clientes set lancamentos='[{\"012\":9}]'::jsonb where mes='2026-07' and paciente_id='$PA3'"
juntar $A $PA3 $PA4 >/dev/null
igual "nova tentativa depois do ajuste: mês 06 entra uma vez" "$(lan 2026-06 $PA4)" '[{"012": 1}]'
igual "nova tentativa depois do ajuste: mês 07 soma certo" "$(lan 2026-07 $PA4)" '[{"144": 1}, {"144": 1}, {"144": 1}, {"012": 9}]'
# outro profissional não consegue juntar cadastros alheios
ins $A 2026-04 $PA3 '[{"012":4}]'
r="$(juntar $B $PA3 $PA4)"; igual "B juntando cadastros de A não leva nem apaga nada" "$(lan 2026-04 $PA3)" '[{"012": 4}]'
r="$(juntar $A $PA4 $PA4)"; echo "$r" | grep -qi "dois cadastros diferentes" && ok "origem igual ao destino é recusada" || bad "mesmo cadastro" "$r"
r="$(juntar '' $PA3 $PA4)"; echo "$r" | grep -qi "Sem sessão" && ok "sem sessão é recusado" || bad "sem sessão" "$r"
r="$(sql -v VERBOSITY=terse 2>&1 -c "set role anon; select public.cassi_juntar_financeiro_clientes('$PA3','$PA4')")"; echo "$r" | grep -qi "permission denied" && ok "anon não executa a função" || bad "anon executa" "$r"


# ---- concorrência: junções em sentidos opostos ao mesmo tempo não podem travar uma na outra (deadlock) nem bater na chave única
PX=aaaaaaaa-0000-0000-0000-0000000000a1; PY=aaaaaaaa-0000-0000-0000-0000000000a2
sql -c "insert into public.pacientes(id, terapeuta_id, nome) values ('$PX','$A','X'),('$PY','$A','Y')"
cat > "$PASTA/conc.sql" <<SQLB
\set dir random(0, 1)
set role authenticated;
select set_config('request.jwt.claim.sub','$A',false);
begin;
select pg_advisory_xact_lock(hashtextextended('$A', 0));
insert into public.cassi_financeiro_clientes(mes, paciente_id, lancamentos) values ('2026-01','$PX','[{"012":1}]'),('2026-02','$PX','[{"012":1}]') on conflict do nothing;
insert into public.cassi_financeiro_clientes(mes, paciente_id, lancamentos) values ('2026-01','$PY','[{"144":1}]'),('2026-02','$PY','[{"144":1}]') on conflict do nothing;
commit;
\if :dir = 0
select public.cassi_juntar_financeiro_clientes('$PX','$PY');
\else
select public.cassi_juntar_financeiro_clientes('$PY','$PX');
\endif
reset role;
SQLB
saida="$("$PGBIN/pgbench" -n -h "$PASTA" -p "$PORTA" -U postgres -d "$DB" -c 6 -j 6 -t 40 -f "$PASTA/conc.sql" 2>&1)"
echo "$saida" | grep -qiE "deadlock|duplicate key|unique" && bad "junções concorrentes em sentidos opostos" "$(echo "$saida" | grep -iE 'deadlock|duplicate|unique' | head -2)" || ok "junções concorrentes em sentidos opostos não dão deadlock nem violam a chave única"

echo; echo "RESULTADO: $PASSOU ok, $FALHOU falhas"; [ "$FALHOU" = "0" ]
