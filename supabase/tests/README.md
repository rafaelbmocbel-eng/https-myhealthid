# Testes de banco (pgTAP)

Arquivos em `database/*.test.sql`, na sintaxe do pgTAP, rodam com `supabase test db` (banco **local** do Supabase CLI).
Também rodam num Postgres comum com `supabase/ensaios/rls/rodar.sh`, que aplica as migrações e usa uma implementação mínima
do pgTAP (`supabase/ensaios/rls/pgtap-minimo.sql`). **Nunca apontar para o banco de produção.**

| Arquivo | O que garante |
|---|---|
| `01_cobertura_rls` | toda tabela com RLS; nenhuma política aberta nova; superfície pública e funções privilegiadas sem login travadas em lista |
| `02_pacientes` | cada terapeuta só vê/altera os próprios pacientes; paciente vê só o próprio cadastro; o paciente edita dados pessoais e de saúde mas não os campos internos; alarme para coluna nova |
| `03_links_publicos` | links e respostas de avaliação e agenda fechados para visitante; pedido de horário só por link ativo; funções por token |
| `04_dados_clinicos_entre_terapeutas` | isolamento em 12 tabelas clínicas (A não vê B, visitante não vê nada, paciente não vê outro paciente) |
| `05_privilegios_perfis` | profissional não se autoverifica nem se promove à equipe científica |
| `06_catalogo_exercicios` | catálogo de exercícios: leitura pública, escrita só da equipe científica |

`todo_start`/`todo_end` marcam **problemas conhecidos** (ver `docs/seguranca-rls-achados.md`): aparecem como `not ok ... # TODO` e não
derrubam a suíte. Ao corrigir o problema o teste passa a avisar "TODO passou": tire o `todo`.

Os testes criam seus dados dentro de uma transação e terminam com `rollback`.
