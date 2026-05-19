## Objetivo

Permitir que **médicos, psicólogos, nutricionistas, educadores físicos, terapeutas ocupacionais** e **fisioterapeutas** usem a mesma avaliação presencial — cada um com **a sua lente** (ferramentas, IA e template adequados à profissão), sem fragmentar o app e sem mexer em MyID, Portal do Paciente ou agenda.

Princípio: **"mesma espinha, lentes diferentes"**. Uma única tela de avaliação que troca blocos opcionais conforme o profissional logado. Em contas com vários profissionais (clínica), cada membro tem a sua lente — abre a avaliação e já vê a versão certa, sem configurar nada por sessão.

---

## 1. Lentes Profissionais (6)

| Lente | Blocos ativos | Foco da IA | Template |
|---|---|---|---|
| Fisioterapeuta (default) | Avatar 3D + dor + estruturas | Dor, ADM, força, biomecânica | SOAP fisio |
| Médico | Vitais, CID-10, prescrição | HMA, antecedentes, exame físico | SOAP médico |
| Psicólogo | Escalas (PHQ-9, GAD-7), genograma simples | Queixa, humor, cognição, vínculo | Evolução psi |
| Nutricionista | Antropometria, recordatório 24h, hábitos | Hábitos alimentares, sintomas GI, metas | Plano nutricional |
| Educador Físico | Avatar leve, testes funcionais, periodização | Capacidade, performance, metas | Plano de treino |
| Terapeuta Ocupacional | Avatar + AVDs + ambiente + função | Independência, ocupação, adaptações | Plano ocupacional |

---

## 2. Mudanças de banco (1 migração)

```text
1. ENUM perfil_profissional:
   ('fisioterapeuta','medico','psicologo','nutricionista','educador_fisico','terapeuta_ocupacional')
2. profiles            + perfil_profissional (default 'fisioterapeuta')
3. clinica_membros     + perfil_profissional (nullable; herda do profile)
4. avaliacoes_voz      + perfil_profissional (registra com qual lente foi feita)
5. perfis_profissionais (catálogo, read-only):
   id (enum) | nome_exibicao | blocos_ativos jsonb |
   prompt_sistema text | schema_saida jsonb | template_evolucao text
   → seed dos 6 perfis
```

Backwards-compat: default `fisioterapeuta` — nenhuma conta atual quebra.

---

## 3. Refator de `AvaliacaoPresencial.tsx` — vira shell

Hoje é fisio-cêntrico. Vira orquestrador:

```text
<AvaliacaoShell>
  <LenteSelector />            ← chip discreto, só se houver >1 lente
  <MyIDLink />                 ← sempre
  <VoiceAssessment prompt={lente.prompt} schema={lente.schema} />
  {lente.blocos.includes('avatar')        && <AvatarBlock/>}
  {lente.blocos.includes('escalas_psi')   && <EscalasPsiBlock/>}
  {lente.blocos.includes('vitais')        && <VitaisBlock/>}
  {lente.blocos.includes('antropometria') && <AntropometriaBlock/>}
  {lente.blocos.includes('avds')          && <AVDsBlock/>}
  {lente.blocos.includes('testes_func')   && <TestesFuncionaisBlock/>}
</AvaliacaoShell>
```

Cada bloco é **lazy-loaded**. Lente padrão = fisio → comportamento atual preservado.

---

## 4. Edge function `voice-assessment` adaptativa

Recebe `perfil_profissional` no body, carrega prompt/schema do catálogo, monta o system prompt da profissão e devolve dados já no schema certo. Grava `perfil_profissional` no registro.

---

## 5. Frontend — telas afetadas

- **AvaliacaoPresencial** → shell + blocos.
- **Configurações → Perfil** → seletor "Minha profissão / lente padrão".
- **Configurações → Equipe** → coluna "Lente" editável por membro.
- **PacientePerfil → histórico de avaliações** → badge da lente usada.
- **Onboarding novo profissional** → primeira escolha após signup.

---

## 6. O que NÃO muda

MyID v2.0, Portal do Paciente, COB° ZERO/dados legados, Agenda, CRM, financeiro. Tela de fisio segue idêntica.

---

## Ordem de entrega

```text
LEVA 1 — Fundação (entrego primeiro):
  1. Migração + seed dos 6 perfis (prompts/schemas)
  2. Hook useLenteAtiva() + ajuste no voice-assessment
  3. Refator AvaliacaoPresencial em shell + AvatarBlock extraído
  4. Seletor de lente em Configurações > Perfil
  → Resultado: fisio funciona igual, base pronta para as lentes

LEVA 2 — Primeira lente nova (valida o conceito):
  5. Lente Médico (mais próxima do fisio) com VitaisBlock + prescrição

LEVA 3 — Lentes distantes (valida isolamento):
  6. Nutricionista (AntropometriaBlock + recordatório)
  7. Psicólogo (EscalasPsiBlock)

LEVA 4 — Encerramento:
  8. Educador Físico (TestesFuncionaisBlock)
  9. Terapeuta Ocupacional (AVDsBlock)
 10. Coluna "Lente" em Equipe + badge no histórico
```

---

## Detalhes técnicos

- **RLS:** `perfis_profissionais` read-only para autenticados.
- **Custo IA:** mesmo (1 chamada/avaliação), só o prompt muda.
- **Plano comercial:** todas as lentes liberadas em qualquer plano (não é gating).
- **Mobile:** blocos seguem sistema de ícones e tipografia já padronizados.

---

Posso começar pela **LEVA 1** agora?
