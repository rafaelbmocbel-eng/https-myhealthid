# Segurança do banco (RLS): achados e correções propostas

> Verificado em **01/11/2026** com os testes `supabase/tests/database/*.test.sql`, rodados num Postgres local
> reconstruído a partir das 325 migrações do repositório (`supabase/ensaios/rls/rodar.sh`), com dados **fictícios**.
> Nada foi lido ou alterado no banco de produção. Se alguém mudou políticas direto no painel do Supabase, o
> estado real pode divergir do que as migrações descrevem: conferir no painel (Advisors) antes de aplicar.
>
> **Status das correções (02/11/2026):** os quatro achados (A, B, C, D) têm migração nova em `supabase/migrations/20261102120*`
> e testes que provam a correção. A publicação segue o fluxo normal: o deploy do Supabase aplica as migrações ao dar push
> na `main`. As decisões de produto em C e D foram tomadas por Claude e estão marcadas abaixo: o Rafael pode mudar.

## O que está bom (coberto por teste)

- Todas as 154 tabelas de `public` têm RLS ligada; 355 políticas.
- Isolamento entre terapeutas em 12 tabelas clínicas (notas de prontuário, pagamentos, documentos, atestados, termos,
  chat, prescrições, história de vida, exames, agenda, avaliações por voz, conversas de WhatsApp): o terapeuta B não
  lê, não altera e não apaga o que é do A; visitante sem login não lê nada; o paciente não lê dados de outro paciente.
- Travas por coluna que funcionam: paciente não vira conta premium sozinho, nem terapeuta de si mesmo; profissional
  não se autoverifica nem se promove à equipe científica; `excluir_paciente_completo` nega outro terapeuta e visitante.
- Nenhuma função `SECURITY DEFINER` sem `search_path` fixo.

## Achados (todos corrigidos nas migrações `20261102120000` a `20261102120300`)

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

**Correção** (`20261102120000_seguranca_links_publicos_fechar.sql`): as cinco políticas públicas foram removidas.

Cuidado que a análise revelou: a política `pub_agendamentos_insert_via_token` (pedido de horário pelo link de agenda)
conferia o link com uma **subconsulta** em `links_agenda_paciente`, e subconsulta de política roda sob as regras da tabela
consultada. Ao fechar a leitura pública, o agendamento público quebraria. Por isso a conferência virou a função
`link_agenda_ativo_para(terapeuta, paciente)` (`SECURITY DEFINER`, devolve só verdadeiro/falso, sem expor token) e a
política passou a exigir também `status = 'pendente'` (visitante não cria horário já confirmado).

Testes que provam: `03_links_publicos.test.sql` (21 itens: visitante não lê nem escreve nas tabelas de link; o pedido de
horário continua funcionando só com link ativo, da terapeuta certa e como "pendente"; as funções por token seguem
respondendo sem login).

### B. MÉDIO: funções internas executáveis sem login

- `paciente_por_telefone_norm(uuid, text)` e `paciente_por_sufixo_telefone(uuid, text)` devolvem **id, nome e
  sobrenome** do paciente de um terapeuta a partir do telefone. Sem login, quem souber o UUID de um terapeuta (aparece
  nos links públicos de agenda) consegue confirmar se uma pessoa é paciente dele e ver o nome. Só as Edge Functions
  (WhatsApp) deveriam chamar.
- `incrementar_uso_ia(uuid, text)` deixa qualquer pessoa inflar o contador mensal de IA de outro usuário (esgota a
  cota dele). A Edge Function `voice-assessment` chama com a service role.

**Correção** (`20261102120100_seguranca_funcoes_internas_so_servidor.sql`): execução revogada de `public`, `anon` e
`authenticated`; liberada só para `service_role` (os chamadores são Edge Functions: `whatsapp-webhook`,
`whatsapp-bot-reply`, `voice-assessment`). O laço percorre as funções pelo nome (todas as sobrecargas), inclui
`match_evidence` e `increment_evidence_citation` (a migração antiga delas revogou só de `anon`/`authenticated`, sem tirar de
`PUBLIC`) e **falha o deploy** se alguma das três funções internas continuar executável sem ser pela service role.

Testes: `01_cobertura_rls.test.sql` (itens 6 e 7: visitante e usuário logado não executam; a service role executa). Há
ainda outras funções privilegiadas (`SECURITY DEFINER`) executáveis sem login: a maioria é de fluxo público por token
(esperado); `excluir_paciente_completo` e `ganhar_xp` foram conferidas e checam quem chama. O item 6 do mesmo arquivo
trava a lista: função nova nela exige decisão.

### C. MÉDIO/BAIXO: o paciente edita campos do próprio cadastro direto na tabela

A política "Paciente atualiza o proprio cadastro" libera o `UPDATE` da linha inteira. Provado: o paciente conseguia
mudar `xp_total` (a função `ganhar_xp` limita a 150 pontos por evento e é idempotente, mas o `UPDATE` direto ignorava
isso), `ativo`, `tipo_pagamento`, `plano_saude`, `carteirinha` e **`terapeuta_id`** (transferir o próprio cadastro para
outro terapeuta; o gatilho só bloqueava virar o próprio terapeuta). Impacto: ganho de XP e recompensas
(`recompensas_resgates`), cadastros jogados na lista de outro profissional, dados de convênio adulterados.

**Correção** (`20261102120200_seguranca_paciente_protege_campos_internos.sql`), **decisão tomada por Claude**: o paciente
edita só seus dados pessoais e de saúde (nome, contato, endereço, emergência, alergias, medicamentos, queixa, história,
histórico clínico, foto, aceite LGPD). Os campos internos (vínculo com terapeuta/clínica/convênio/responsável, `ativo`,
conta premium, XP e nível, convênio e CASSI, anotações do terapeuta, token do portal, status do cadastro...) são
devolvidos ao valor antigo por um gatilho `BEFORE UPDATE`, **só** quando quem altera é o próprio paciente pelo navegador
(papel `authenticated`). O terapeuta dono, o super admin, a service role e as funções do servidor (`ganhar_xp`,
`salvar_cadastro_paciente_*`, vínculo do portal), que rodam como dono do banco, continuam livres. Mandar um campo
travado junto com campos livres não derruba a gravação: o campo travado é ignorado.

Mudanças feitas por **outro gatilho** (`pg_trigger_depth() > 1`) também passam: `processar_resgate_recompensa` roda como o
paciente e debita o XP do resgate; sem essa exceção a trava desfazia o débito e o resgate ficava de graça (achado da revisão
independente, reproduzido e coberto por teste). A migração também **falha o deploy** se faltar alguma das 29 colunas que o
gatilho cita, em vez de quebrar toda gravação do paciente.

Regra para o futuro: coluna nova em `pacientes` nasce editável pelo paciente. O teste `02_pacientes.test.sql` falha se
houver coluna sem classificação (editável ou interna), forçando a decisão e a atualização do gatilho.

Testes: `02_pacientes.test.sql` (31 itens: campos internos travados um a um, dados pessoais editáveis, resgate de recompensa, super admin, terapeuta que é paciente de si mesma).

### D. BAIXO: catálogo de exercícios editável por qualquer usuário logado

`exercicios_biblioteca` permitia `UPDATE` e `DELETE` a qualquer `authenticated`, inclusive paciente. A migração
`20260712160000_catalogo_write_policies.sql` deixava o TODO de restringir a um papel de curadoria.

**Correção** (`20261102120300_seguranca_catalogo_exercicios_so_curadoria.sql`), **decisão tomada por Claude**: só a equipe
científica (`eh_equipe_cientifica()`, que inclui o super admin) edita e apaga. A leitura segue pública. A tela
`CatalogoEvidencia` esconde "Liberar/Ocultar/Remover" de quem não é da equipe e avisa se o banco não alterar nenhuma linha
(antes, sem permissão, a gravação "passava" sem erro e a tela mostrava sucesso).

Testes: `06_catalogo_exercicios.test.sql` (13 itens) e `01_cobertura_rls.test.sql` (item 3); `src/test/catalogoEvidencia.test.tsx`.

## Achados novos da revisão independente: NÃO corrigidos, decisão do Rafael

A revisão antes da publicação (um agente avulso e uma equipe de seis revisores, com céticos) confirmou a regressão do resgate
(já corrigida acima) e apontou os pontos abaixo. Nenhum nasce destas migrações; ficam registrados para decisão.

| # | Gravidade | O que é | Sugestão |
|---|---|---|---|
| E | média | `ganhar_xp` aceita qualquer chave: o paciente chama a função com chaves inventadas e ganha até 150 XP por chave, sem teto (provado: 150, 300, 450). A trava de `xp_total` só fecha o `UPDATE` direto. | Lista fechada de tipos de evento e teto por dia dentro de `ganhar_xp`, ou creditar XP só por eventos verificados no servidor. |
| F | média | A política de INSERT em `pacientes` só exige `auth.uid() = terapeuta_id`: um usuário pode criar ficha com `user_id` de outra pessoa (bloqueia a ficha verdadeira dela) ou uma ficha ligada a si mesmo, em que o gatilho o trata como terapeuta dono. | `with check (... and (user_id is null or user_id = auth.uid()))` e decidir se a autoficha entra como `wellness_free`. Conferir antes os fluxos que inserem paciente. |
| G | média | O pedido de horário público vale pelo par (terapeuta, paciente), não pelo token: continua valendo depois de cancelar ou regerar o link, não há limite de volume e quem fez o pedido não precisa do token. Tokens e pares que já vazaram antes do deploy continuam válidos até o link vencer. | RPC `agendar_por_token` (deriva terapeuta e paciente do token); limite de pedidos por link; depois do deploy, cancelar os links ativos (`update ... set status = 'cancelado' where status = 'ativo'`) e gerar novos. |
| H | média | `gerar-exercicios-evidencia` (Edge Function, service role) aceita qualquer usuário logado, até paciente, e grava rascunhos de IA no catálogo compartilhado; os rascunhos aparecem sem filtro em `DeverDeCasaDialog` e `ProtocoloDiretrizEditor`. O bucket público `exercise-gifs` também deixa qualquer logado editar e apagar GIFs. | Exigir profissional (ou equipe científica) na função; filtrar `aprovado` nas duas telas; restringir a escrita do bucket. |
| I | baixa | `processar_resgate_recompensa` não confere nível mínimo nem corrida entre dois resgates simultâneos, e o estoque nunca baixa para o paciente (sem permissão de UPDATE no catálogo). | Tornar a função `SECURITY DEFINER` com as conferências (recompensa do terapeuta do paciente, nível, bloqueio da linha). |
| J | baixa | `funil_config` legível sem login inclui chave PIX e link de cartão; `funil_leads` aceita insert anônimo sem funil ativo; pedidos de horário pelo link geral e pelo funil já eram recusados pela RLS (sem paciente ligado). | Decidir o que o funil público precisa mostrar; criar o paciente por função `SECURITY DEFINER`. |
| K | baixa | Defeitos de funcionalidade apontados de passagem: o bloco 6 da avaliação nunca grava (CHECK permite `bloco_numero` até 5) e `PortalControleTab` seleciona a coluna `status`, que não existe em `respostas_avaliacao_paciente`. | Conferir e corrigir à parte. |

**Passo "Import data (psql)" do deploy** (`.github/workflows/supabase-deploy.yml`): a cada push que toque migrações, funções ou
`supabase/data`, ele reaplica `supabase/data/*.sql`. Esses arquivos desligavam a RLS de `pacientes`, `profiles` e `agendamentos`
por ~15 s a cada deploy (e a deixariam desligada se a conexão caísse no meio). Eu tirei os `ALTER TABLE ... ROW LEVEL SECURITY` dos
dois arquivos (o usuário do `SUPABASE_DB_URL` ignora a RLS). Ainda está pendente a decisão de **remover o passo** (ver
`docs/ci-ajustes-deploy-supabase.md`, item 4), porque ele também recria cadastros importados que foram apagados depois.

**Fora do escopo:** `salvar_cadastro_paciente_autenticado` (migração `20260525014333_*`) insere em `termos_consentimento` a coluna
`aceito_em`, que a tabela não tem (tem `data_aceite`). Num banco reconstruído só com as migrações do repositório a função falha;
pode ser divergência entre repositório e produção ou erro real no "completar cadastro" do portal: **conferir em produção**.

## Conferência depois do deploy (somente leitura)

Rodar no SQL Editor do Supabase. Esperado em cada item:

```sql
-- 1. Nenhuma política pública sobrou nas tabelas de link e de respostas (só as do terapeuta dono) e o catálogo só tem leitura aberta:
select tablename, policyname, roles, cmd, qual from pg_policies
 where tablename in ('links_avaliacao','links_agenda_paciente','respostas_avaliacao_paciente','exercicios_biblioteca') order by 1, 2;
-- 2. Funções internas: anon = false, authenticated = false, service_role = true, dono = postgres
select p.oid::regprocedure, pg_get_userbyid(p.proowner) dono, has_function_privilege('anon', p.oid, 'execute') anon,
       has_function_privilege('authenticated', p.oid, 'execute') authenticated, has_function_privilege('service_role', p.oid, 'execute') service_role
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('paciente_por_telefone_norm','paciente_por_sufixo_telefone','incrementar_uso_ia','match_evidence','increment_evidence_citation');
-- 3. Toda tabela com RLS ligada (deve voltar vazio):
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
-- 4. Donos: a função de conferência do link e a tabela devem ter o mesmo dono (senão o pedido de horário público é negado)
select 'funcao' tipo, pg_get_userbyid(proowner) dono from pg_proc where proname = 'link_agenda_ativo_para'
union all select 'tabela', tableowner from pg_tables where tablename = 'links_agenda_paciente';
```

## Como rodar

```bash
supabase/ensaios/rls/rodar.sh          # Postgres 16 local e descartável; aplica as migrações e roda os testes
```

No Supabase CLI com Docker, `supabase test db` roda os mesmos arquivos com o pgTAP de verdade, **mas** o banco local
precisa reconstruir as migrações do zero e a `20260805130000_cadastrar_pacientes_cassi.sql` falha em banco vazio (ela
espera o terapeuta de produção). Por isso o script acima aplica as migrações tolerando erros de extensão e de dados.

Problema novo e ainda não corrigido entra como teste com `todo_start`/`todo_end`; quando for corrigido o teste passa a
mostrar "TODO passou": tire o `todo`.
