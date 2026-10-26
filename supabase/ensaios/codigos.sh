#!/usr/bin/env bash
# ENSAIO LOCAL da migração que atualiza os códigos e valores salvos em cassi_config (dados inventados: valores, ordem, campos extras,
# backup, escopo por e-mail, caminhos em que não faz nada, idempotência).
# Precisa de PostgreSQL 16 instalado localmente (initdb, pg_ctl, psql e, no ensaio de lançamentos, pgbench). Sobe um servidor
# DESCARTÁVEL numa pasta temporária (porta própria, sem rede) e o apaga no fim; nunca toca em banco de verdade.
# Não roda no CI: é o ensaio manual que se faz antes de publicar uma migração (o vitest só confere o texto do SQL).
# Como rodar:  bash supabase/ensaios/codigos.sh     (como root usa o usuário postgres; fora de root, o seu usuário)
set -u
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
M="${M:-$AQUI/../migrations/20261025233000_cassi_config_codigos_tabela_cassi.sql}"
PGBIN="${PGBIN:-$(pg_config --bindir 2>/dev/null || echo /usr/lib/postgresql/16/bin)}"; PASTA="${PASTA:-/var/tmp/cassi-cod-pg}"; PORTA="${PORTA:-55443}"; DB=ensaio
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
create schema auth; create table auth.users (id uuid primary key, email text, created_at timestamptz default now());
create table public.cassi_config (terapeuta_id uuid primary key, codigos jsonb not null default '[]', imposto_percentual numeric default 0, updated_at timestamptz default now());
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
SQL
R=11111111-1111-1111-1111-111111111111; O=22222222-2222-2222-2222-222222222222
sql -c "insert into auth.users(id,email) values ('$R','RafaelBMocbel@gmail.com'),('$O','outra@exemplo.com')"
ANTIGO='[{"codigo":"144","descricao":"Avaliação","valor":65.62,"codigo_oficial":"50000144"},{"codigo":"012","descricao":"Sessão","valor":57.7,"codigo_oficial":"50000012","nota":"meu"},{"codigo":"185","descricao":"Eletroterapia","valor":97.73,"codigo_oficial":"31602185"},{"codigo":"160","descricao":"Meu código","valor":10,"codigo_oficial":""}]'
sql -c "insert into public.cassi_config(terapeuta_id, codigos, imposto_percentual) values ('$R', '$ANTIGO'::jsonb, 15), ('$O', '$ANTIGO'::jsonb, 9)"
sql -f "$M" >/dev/null 2>&1 && ok "a migração roda" || { bad "a migração roda" "$(sql -f "$M" 2>&1 | tail -3)"; exit 1; }
v() { sql -c "select (select e->>'$2' from jsonb_array_elements(codigos) e where e->>'codigo'='$3') from public.cassi_config where terapeuta_id='$1'"; }
igual "185 passou para R\$ 108,44" "$(v $R valor 185)" "108.44"
igual "185 ganhou a descrição nova" "$(v $R descricao 185)" "Estimulação elétrica transcutânea"
igual "012 mantém 57,7 e recebe a descrição da lista" "$(v $R descricao 012)" "Sessão de psicomotricidade individual"
igual "campo extra do 012 ('nota') é preservado" "$(v $R nota 012)" "meu"
igual "020 entrou com 57,7" "$(v $R valor 020)" "57.7"
igual "301 entrou com 35,55" "$(v $R valor 301)" "35.55"
igual "131 entrou com 67,79" "$(v $R valor 131)" "67.79"
igual "144 (fora da lista) não mudou" "$(v $R valor 144)" "65.62"
igual "160 (código dele) não mudou" "$(v $R valor 160)" "10"
igual "a ordem original é mantida e os novos entram no fim" "$(sql -c "select string_agg(e->>'codigo', ',' order by ord) from public.cassi_config, jsonb_array_elements(codigos) with ordinality t(e, ord) where terapeuta_id='$R'")" "144,012,185,160,020,301,131"
igual "o resto da configuração não mudou (imposto)" "$(sql -c "select imposto_percentual from public.cassi_config where terapeuta_id='$R'")" "15"
igual "a configuração de OUTRO profissional não foi tocada" "$(sql -c "select codigos = '$ANTIGO'::jsonb from public.cassi_config where terapeuta_id='$O'")" "t"
igual "o backup guardou a configuração original" "$(sql -c "select codigos = '$ANTIGO'::jsonb from public.bkp_cassi_config_codigos_20261025 where terapeuta_id='$R'")" "t"
igual "só o profissional dele tem backup" "$(sql -c "select count(*) from public.bkp_cassi_config_codigos_20261025")" "1"
DEPOIS="$(sql -c "select codigos::text from public.cassi_config where terapeuta_id='$R'")"
sql -f "$M" >/dev/null 2>&1 && ok "rodar de novo não quebra" || bad "idempotente" "falhou"
igual "rodar de novo não muda o resultado" "$(sql -c "select codigos::text from public.cassi_config where terapeuta_id='$R'")" "$DEPOIS"
igual "rodar de novo não troca o backup pelo valor já atualizado" "$(sql -c "select codigos = '$ANTIGO'::jsonb from public.bkp_cassi_config_codigos_20261025 where terapeuta_id='$R'")" "t"
r="$(sql -v VERBOSITY=terse 2>&1 -c "set role authenticated; select * from public.bkp_cassi_config_codigos_20261025")"; echo "$r" | grep -qi "permission denied" && ok "o backup não é lido pela API (authenticated)" || bad "backup exposto" "$r"
# sem configuração salva: nada acontece
sql -c "delete from public.cassi_config where terapeuta_id='$R'; delete from public.bkp_cassi_config_codigos_20261025"
sql -f "$M" >/dev/null 2>&1 && ok "sem configuração salva a migração passa sem fazer nada" || bad "sem config" "falhou"
igual "e não cria configuração" "$(sql -c "select count(*) from public.cassi_config where terapeuta_id='$R'")" "0"
# codigos que não é lista
sql -c "insert into public.cassi_config(terapeuta_id, codigos) values ('$R', '{\"a\":1}'::jsonb)"
sql -f "$M" >/dev/null 2>&1 && ok "configuração em formato estranho é deixada em paz" || bad "formato estranho" "falhou"
igual "e continua como estava" "$(sql -c "select codigos::text from public.cassi_config where terapeuta_id='$R'")" '{"a": 1}'
# itens que não são objeto
sql -c "update public.cassi_config set codigos = '[1, \"x\", {\"codigo\":\"012\",\"valor\":1}]'::jsonb where terapeuta_id='$R'"
sql -f "$M" >/dev/null 2>&1 && ok "itens que não são objeto não quebram" || bad "itens estranhos" "$(sql -f "$M" 2>&1 | tail -2)"
igual "e o 012 dentro dessa lista foi atualizado" "$(v $R valor 012)" "57.7"
# fallback: uma única configuração e e-mail desconhecido
sql -c "delete from auth.users where id='$R'; delete from public.cassi_config; delete from public.bkp_cassi_config_codigos_20261025; insert into public.cassi_config(terapeuta_id, codigos) values ('$O', '$ANTIGO'::jsonb)"
sql -f "$M" >/dev/null 2>&1 && ok "e-mail não achado mas com UMA configuração só: atualiza essa" || bad "fallback" "falhou"
igual "185 atualizado no fallback" "$(v $O valor 185)" "108.44"
sql -c "delete from public.cassi_config; delete from public.bkp_cassi_config_codigos_20261025; insert into public.cassi_config(terapeuta_id, codigos) values ('$O', '$ANTIGO'::jsonb), ('33333333-3333-3333-3333-333333333333', '$ANTIGO'::jsonb)"
sql -f "$M" >/dev/null 2>&1 && ok "e-mail não achado e VÁRIAS configurações: não adivinha, não mexe" || bad "ambíguo" "falhou"
igual "ninguém foi alterado" "$(sql -c "select count(*) from public.cassi_config where codigos = '$ANTIGO'::jsonb")" "2"
echo; echo "RESULTADO: $PASSOU ok, $FALHOU falhas"; [ "$FALHOU" = "0" ]
