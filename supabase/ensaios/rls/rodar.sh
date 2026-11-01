#!/usr/bin/env bash
# Roda os testes de banco (supabase/tests/database/*.test.sql) num Postgres LOCAL e DESCARTÁVEL:
#   1) cria um cluster novo numa pasta temporária (porta própria, só 127.0.0.1);
#   2) aplica o prelúdio do Supabase e TODAS as migrações do repositório (erros de extensão/dados são esperados e só listados);
#   3) roda cada teste com uma implementação mínima do pgTAP (pgtap-minimo.sql) e resume;
#   4) apaga o cluster.
# Não usa nenhuma variável de conexão do projeto: nunca encosta em produção. Precisa de Postgres 16 (servidor + psql).
# Uso: supabase/ensaios/rls/rodar.sh [--manter]   (--manter deixa o banco de pé para investigar; pare com `... parar`)
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
REPO="$(cd "$AQUI/../../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
PASTA="${PASTA:-/var/tmp/mhid-rls-pg}"
PORTA="${PORTA:-55491}"
[ -x "$PGBIN/initdb" ] || { echo "Postgres não encontrado (defina PGBIN com a pasta bin do Postgres 16)"; exit 2; }
como_pg() { if [ "$(id -u)" = 0 ]; then runuser -u postgres -- "$@"; else "$@"; fi; }
parar() { como_pg "$PGBIN/pg_ctl" -D "$PASTA/pgdata" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$PASTA"; }
if [ "${1:-}" = "parar" ]; then parar; exit 0; fi
MANTER=0; [ "${1:-}" = "--manter" ] && MANTER=1
[ "$MANTER" = 1 ] || trap parar EXIT

parar; mkdir -p "$PASTA"; [ "$(id -u)" = 0 ] && chown postgres "$PASTA"
como_pg "$PGBIN/initdb" -D "$PASTA/pgdata" -U postgres --auth=trust -E UTF8 --locale=C.utf8 >/dev/null || exit 2
como_pg "$PGBIN/pg_ctl" -D "$PASTA/pgdata" -o "-p $PORTA -k $PASTA -c listen_addresses=127.0.0.1 -c fsync=off" -w -l "$PASTA/log" start >/dev/null || exit 2
P=("$PGBIN/psql" -X -q -h 127.0.0.1 -p "$PORTA" -U postgres)
"${P[@]}" -d postgres -c "create database app" >/dev/null
# No Supabase o search_path inclui "extensions" (onde ficam pgcrypto/unaccent): sem isso as migrações antigas falham em cascata.
"${P[@]}" -d postgres -c "alter database app set search_path to \"\$user\", public, extensions" >/dev/null
"${P[@]}" -d app -v ON_ERROR_STOP=1 -f "$AQUI/prelude.sql" >/dev/null 2>&1 || { echo "prelúdio falhou"; exit 2; }
"${P[@]}" -d app -c "create extension if not exists pgcrypto schema extensions; create extension if not exists pg_trgm schema extensions; create extension if not exists unaccent schema extensions;" >/dev/null 2>&1

COM_ERRO=0; TOTAL=0
for f in $(ls "$REPO"/supabase/migrations/*.sql | sort); do
  TOTAL=$((TOTAL + 1))
  if "${P[@]}" -d app -f "$f" 2>&1 >/dev/null | grep -q "ERROR"; then COM_ERRO=$((COM_ERRO + 1)); fi
done
echo "migrações aplicadas: $TOTAL (com algum erro esperado de extensão/dados: $COM_ERRO)"
SEM_RLS=$("${P[@]}" -d app -At -c "select count(*) from pg_tables where schemaname='public' and not rowsecurity")
echo "tabelas em public: $("${P[@]}" -d app -At -c "select count(*) from pg_tables where schemaname='public'") | sem RLS: $SEM_RLS"

"${P[@]}" -d app -f "$AQUI/pgtap-minimo.sql" >/dev/null 2>&1
RC=0
for t in $(ls "$REPO"/supabase/tests/database/*.test.sql | sort); do
  echo "=== $(basename "$t") ==="
  saida=$("${P[@]}" -d app -At -f "$t" 2>&1)
  echo "$saida" | grep -E "^(1\.\.|ok |not ok|#|psql:|ERROR)" | grep -vE "^# +(have|want):" 
  if echo "$saida" | grep -E "^not ok" | grep -vq "# TODO"; then RC=1; fi
  if echo "$saida" | grep -qE "(^psql:|ERROR:|transaction is aborted|Plano diferente)"; then RC=1; echo "!! ERRO de SQL ou de plano neste arquivo (tratado como falha)"; fi
done
[ "$RC" = 0 ] && echo "RESULTADO: OK (problemas conhecidos aparecem como TODO)" || echo "RESULTADO: FALHOU"
if [ "$MANTER" = 1 ]; then echo "banco de pé em 127.0.0.1:$PORTA (usuário postgres, base app). Para parar: $0 parar"; fi
exit $RC
