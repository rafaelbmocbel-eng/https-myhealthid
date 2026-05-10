# Esconder serviços descontinuados (COB° ZERO, Studio Personal, Método Identidade)

## Objetivo
- Os 3 serviços **não existem mais** como produtos.
- **Banco intacto**: nenhuma tabela, hook, RPC, RLS ou edge function será tocada.
- **Histórico**: pacientes que já fizeram avaliações continuam vendo os resultados (read-only).
- **MyID v2.0** continua sendo o questionário-mãe único e visível.

## Princípio
Esconder **entradas de criação** (botões "Nova Avaliação", links no menu, cards "Iniciar"), manter **listagens históricas** com selo "Descontinuado" quando houver dados antigos.

---

## Fase A — Remover pontos de entrada para criar novas avaliações

1. **`src/components/Navigation.tsx` / sidebar / sub-nav**: remover qualquer link para `/metodo-identidade`, `/cob-zero`, dashboards Studio.
2. **`src/components/PacientesSubNav.tsx`**: remover abas dos serviços, se existirem.
3. **`src/pages/PacientePerfil.tsx`**:
   - Esconder abas "Identidade", "COB° ZERO", "Studio Personal" da TabsList (mantém os dashboards montados, mas não acessíveis pela aba).
   - Desabilitar botões "Iniciar Avaliação" / "Nova Avaliação" → trocar por "Histórico (descontinuado)".
4. **`src/components/onboarding/OnboardingGuide.tsx`**: remover passos que mencionam esses serviços.
5. **`src/components/GlobalSearch.tsx`**: remover sugestões de rota desses serviços.
6. **`src/pages/Auth.tsx`**: remover menções na tela de login.
7. **`src/pages/MetodoIdentidade.tsx`**: substituir conteúdo da página por banner "Serviço descontinuado — veja histórico no perfil do paciente" + botão voltar. Não apagar a rota (links antigos não quebram).

## Fase B — Mostrar histórico read-only no perfil

8. **`src/pages/PacientePerfil.tsx`**: adicionar seção "Histórico de Avaliações Descontinuadas" que aparece **apenas** se o paciente tiver avaliações em `avaliacoes_identidade` ou `avaliacoes_cob_zero`. Lista cards com data + score + botão "Ver relatório" (read-only). Sem botão de criar/editar/excluir.
9. **`src/components/paciente/PacienteProtocolosTab.tsx`**: esconder botão "Gerar Diretriz COB° ZERO". Manter listagem de diretrizes já existentes.

## Fase C — Limpar dashboards gerais e relatórios

10. **`src/components/dashboard/AmostraEpidemiologica.tsx`** e **`AmostraIntegrada.tsx`**: substituir referências "Método Identidade" / "COB° ZERO" / "Studio Personal" por "Avaliações" genéricas. Esconder seções de cross-correlação cuja amostra deva ficar zerada (manter código, esconder card se vazio).
11. **`src/components/paciente/PatientIntegratedDashboard.tsx`**: esconder cards "COB° ZERO" e "Studio Personal" da seção 1.5 ("Avaliação Estrutural") quando não houver dados; quando houver, exibir como "Histórico".
12. **`src/components/paciente/ResumoNarrativo.tsx`**: já ajustado na Fase 1 anterior — usar termos genéricos.

## Fase D — Configurações e CRM

13. **Visibilidade de módulos** (`config/visibilidade-modulos-ativos`): garantir que toggles para esses serviços fiquem `false` por padrão e ocultos no painel de configurações.
14. **Funil de vendas / serviços pagos**: remover esses serviços das listas pré-cadastradas (se aparecerem como sugestão).

## Fase E — Atualizar memória do projeto

15. Atualizar `mem://index.md`:
    - Trocar `Architecture: Unifies Identidade, COB ZERO, Studio` → `Architecture: MyID v2.0 é o único produto de avaliação ativo. COB° ZERO/Studio/Identidade são dados históricos read-only.`
    - Trocar `Avaliações: COB° ZERO, Identidade, Studio são tipos de avaliação` → `Apenas MyID está ativo. Demais ficam como histórico no perfil do paciente.`
16. Marcar memórias `studio-personal-*`, `cob-zero-*`, `myid-100-v2-roadmap-fases` (parte que cita Studio) como **deprecated** com aviso no topo.

---

## O que NÃO será tocado
- Tabelas: `avaliacoes_identidade`, `avaliacoes_cob_zero`, `protocolos_tratamento`, `myid_*`
- Hooks: `useAvaliacoesIdentidade`, `useAvaliacoesCobZero`
- Componentes que renderizam relatórios antigos (continuam funcionando para read-only)
- Edge functions, RLS, RPCs
- `MyID v2.0` em qualquer lugar — continua visível e ativo

## Detalhes técnicos
- Estratégia de "esconder": condicional `{historico.length > 0 && (...)}` envolvendo seções históricas; remover botões com `// SERVICE DEPRECATED` comentado para futura referência.
- Página `/metodo-identidade` vira tela de aviso, não 404, para preservar bookmarks.
- Nenhuma rota será deletada.

## Risco
- **Baixo**: zero alteração de schema, zero alteração de lógica clínica, zero alteração de auth.
- Único risco real: quebrar imports se eu remover um componente referenciado em outro lugar. Mitigação: só esconder via condicional/remover JSX, não deletar arquivos.
