# Segurança do banco (RLS): achados e correções propostas

> Verificado em **01/11/2026** com os testes `supabase/tests/database/*.test.sql`, rodados num Postgres local
> reconstruído a partir das 325 migrações do repositório (`supabase/ensaios/rls/rodar.sh`), com dados **fictícios**.
> Nada foi lido ou alterado no banco de produção. Se alguém mudou políticas direto no painel do Supabase, o
> estado real pode divergir do que as migrações descrevem: conferir no painel (Advisors) antes de aplicar.
>
> **Nenhuma das correções abaixo foi aplicada.** Mudar RLS em produção é decisão do Rafael: cada correção entra
> como migração nova (o deploy do Supabase aplica migrações ao dar push na `main`).

## O que está bom (coberto por teste)

- Todas as 154 tabelas de `public` têm RLS ligada; 355 políticas.
- Isolamento entre terapeutas em 12 tabelas clínicas (notas de prontuário, pagamentos, documentos, atestados, termos,
  chat, prescrições, história de vida, exames, agenda, avaliações por voz, conversas de WhatsApp): o terapeuta B não
  lê, não altera e não apaga o que é do A; visitante sem login não lê nada; o paciente não lê dados de outro paciente.
- Travas por coluna que funcionam: paciente não vira conta premium sozinho, nem terapeuta de si mesmo; profissional
  não se autoverifica nem se promove à equipe científica; `excluir_paciente_completo` nega outro terapeuta e visitante.
- Nenhuma função `SECURITY DEFINER` sem `search_path` fixo.

## Achados

### A. ALTO: links e respostas de avaliação legíveis sem login (e links de agenda reescritos sem login)

Qualquer pessoa com a chave pública do front-end (`anon`) consegue:
- listar **todos** os links ativos de avaliação e de agenda, **com os tokens** (`links_avaliacao`, `links_agenda_paciente`);
- ler as **respostas do paciente** (`respostas_avaliacao_paciente`, ex.: dor, medicamentos) enquanto o link estiver
  ativo e não vencido; o status só muda para "cancelado" manualmente e o prazo padrão é de 30 dias;
- **alterar** qualquer link de agenda ativo (provado: trocar o terapeuta dono e estender a validade para 10 anos).

Outro terapeuta logado também lê os links e as respostas de pacientes que não são dele.

Causa: políticas públicas que ficaram sobrando (`Leitura pública via link válido`, `Inserção pública via link válido`,
`pub_links_avaliacao_read`, `pub_links_agenda_read`, `pub_links_agenda_update_access`). As páginas públicas **não
dependem delas**: `AvaliacaoPublica` usa as Edge Functions `validar-token-avaliacao` e `salvar-bloco-avaliacao`
(service role) e `AgendaPublica` usa RPCs por token (`get_agenda_link_by_token` etc., `SECURITY DEFINER`).

Correção proposta (migração nova; **testar em ambiente de homologação**: abrir um link de avaliação e um de agenda
sem login e confirmar que continuam funcionando):

```sql
drop policy if exists "Leitura pública via link válido" on public.respostas_avaliacao_paciente;
drop policy if exists "Inserção pública via link válido" on public.respostas_avaliacao_paciente;
drop policy if exists pub_links_avaliacao_read on public.links_avaliacao;
drop policy if exists pub_links_agenda_read on public.links_agenda_paciente;
drop policy if exists pub_links_agenda_update_access on public.links_agenda_paciente;
```

Observação: `agendamentos` mantém a inserção pública por token (`pub_agendamentos_insert_via_token`), que é outra política.

Testes que provam: `03_links_publicos.test.sql` (itens 5 a 10, marcados `todo`).

### B. MÉDIO: funções internas executáveis sem login

- `paciente_por_telefone_norm(uuid, text)` e `paciente_por_sufixo_telefone(uuid, text)` devolvem **id, nome e
  sobrenome** do paciente de um terapeuta a partir do telefone. Sem login, quem souber o UUID de um terapeuta (aparece
  nos links públicos de agenda) consegue confirmar se uma pessoa é paciente dele e ver o nome. Só as Edge Functions
  (WhatsApp) deveriam chamar.
- `incrementar_uso_ia(uuid, text)` deixa qualquer pessoa inflar o contador mensal de IA de outro usuário (esgota a
  cota dele). A Edge Function `voice-assessment` chama com a service role.

Correção proposta (conferir antes que os chamadores usam a service role: `whatsapp-webhook`, `whatsapp-bot-reply`,
`voice-assessment`):

```sql
revoke execute on function public.paciente_por_telefone_norm(uuid, text) from public, anon, authenticated;
revoke execute on function public.paciente_por_sufixo_telefone(uuid, text) from public, anon, authenticated;
revoke execute on function public.incrementar_uso_ia(uuid, text) from public, anon, authenticated;
grant execute on function public.paciente_por_telefone_norm(uuid, text) to service_role;
grant execute on function public.paciente_por_sufixo_telefone(uuid, text) to service_role;
grant execute on function public.incrementar_uso_ia(uuid, text) to service_role;
```

Teste: `01_cobertura_rls.test.sql` (item 7, `todo`). Há ainda 43 outras funções privilegiadas (`SECURITY DEFINER`) executáveis sem login: a maioria
é de fluxo público por token (esperado); `excluir_paciente_completo` e `ganhar_xp` foram conferidas e checam quem chama. O teste 6 do mesmo arquivo trava a lista: função nova nela exige decisão.

### C. MÉDIO/BAIXO: o paciente edita campos do próprio cadastro direto na tabela

A política "Paciente atualiza o proprio cadastro" libera o `UPDATE` da linha inteira. Provado: o paciente consegue
mudar `xp_total` (a função `ganhar_xp` limita a 150 pontos por evento e é idempotente, mas o `UPDATE` direto ignora
isso), `ativo`, `tipo_pagamento`, `plano_saude`, `carteirinha` e **`terapeuta_id`** (transferir o próprio cadastro para
outro terapeuta; o gatilho só bloqueia virar o próprio terapeuta). Impacto: ganho de XP e recompensas
(`recompensas_resgates`), cadastros jogados na lista de outro profissional, dados de convênio adulterados.

Correção a decidir: quais colunas o paciente pode editar. Opções: (1) gatilho `BEFORE UPDATE` que, quando
`auth.uid() = OLD.user_id` e quem chama não é o terapeuta dono, restaura as colunas protegidas (`xp_total`,
`terapeuta_id`, `ativo`, `tipo_pagamento`, `plano_saude`, `carteirinha`, campos `cassi_*`), no mesmo estilo de
`pacientes_protege_tipo_conta`; (2) mover as edições legítimas do paciente para uma função `SECURITY DEFINER`
com lista fechada de campos.

Teste: `02_pacientes.test.sql` (itens 14 e 15, `todo`).

### D. BAIXO (já conhecido): catálogo de exercícios editável por qualquer usuário logado

`exercicios_biblioteca` permite `UPDATE` e `DELETE` a qualquer `authenticated`, inclusive paciente. A própria migração
`20260712160000_catalogo_write_policies.sql` deixa o TODO de restringir a um papel de admin da plataforma.
Correção: trocar `using (true)` por `public.eh_super_admin()` (ou o papel de curadoria que existir).

Teste: `01_cobertura_rls.test.sql` (item 3, `todo`).

## Como rodar

```bash
supabase/ensaios/rls/rodar.sh          # Postgres 16 local e descartável; aplica as migrações e roda os testes
```

No Supabase CLI com Docker, `supabase test db` roda os mesmos arquivos com o pgTAP de verdade, **mas** o banco local
precisa reconstruir as migrações do zero e a `20260805130000_cadastrar_pacientes_cassi.sql` falha em banco vazio (ela
espera o terapeuta de produção). Por isso o script acima aplica as migrações tolerando erros de extensão e de dados.

Quando uma correção for aplicada, o teste `todo` correspondente passa a mostrar "TODO passou": tire o
`todo_start`/`todo_end` dele, e atualize as listas do `01_cobertura_rls.test.sql` que ficarem menores.
