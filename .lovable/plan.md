
# Fase 1 — Multi-profissional (Fisio + Medicina + Educação Física)

Objetivo: abrir o MY HEALTH ID para 3 profissões com o **menor risco possível**, mantendo o app atual 100% funcional. Tudo aditivo, modo Solo continua default, lente é opcional.

---

## Princípio guia

**"Um núcleo, várias lentes."**
- MyID v2.0, Agenda, Pacientes, Prontuário e Portal do Paciente **não mudam**.
- Cada profissional escolhe uma **lente** (perfil profissional) no cadastro/configurações.
- A lente só altera: blocos extras na avaliação, template de evolução, dashboard e PDF.
- Quem não trocar de lente continua vendo o app exatamente como hoje (default = Fisioterapeuta).

A infraestrutura de lentes já existe (`useLenteAtiva`, tabela `perfis_profissionais`, coluna `profiles.perfil_profissional`). Esta fase **ativa e amadurece** essa estrutura — não cria nada do zero.

---

## Escopo das 3 lentes

### 1. Fisioterapeuta (já é o default — só formaliza)
- Blocos: MyID v2.0 + Avaliação Presencial + Voz + Avatar (como hoje)
- Template evolução: **SOAP** (já existe)
- Nada muda visualmente

### 2. Medicina (cobertura ampla das especialidades mais comuns)
Sub-lentes opcionais dentro de "Médico" para cobrir várias especialidades sem duplicar módulo:
- **Clínico Geral / Família** — anamnese SOAP + sinais vitais + prescrição
- **Ortopedista** — usa MyID + bloco "Exame ortopédico" (testes especiais por região)
- **Endocrinologista** — bloco metabólico (glicemia, HbA1c, perfil lipídico, TSH, peso/IMC, circunferência)
- **Cardiologista** — bloco cardiovascular (PA, FC, ECG anexável, risco Framingham)
- **Psiquiatra** — bloco saúde mental (PHQ-9, GAD-7, sono, medicação)
- **Ginecologista** — bloco saúde da mulher (ciclo, gestação, exames preventivos)
- **Pediatra** — bloco crescimento/desenvolvimento (percentil, marcos, vacinação)
- **Dermatologista** — bloco lesões (fotos + checklist ABCDE)

**Ferramentas que reduzem digitação:**
- **Anamnese por voz** (Whisper já integrado) com template SOAP
- **Prescrição assistida** — busca de medicamentos com posologia padrão (autocomplete)
- **Atestado e receita em 1 clique** com PDF carimbado
- **CID-10 com autocomplete** + sugestão por queixa
- **Solicitação de exames** com templates por especialidade
- **Importar PDF de exame** → IA extrai resultado e preenche prontuário (Gemini Vision)
- **Bloco "Sinais Vitais" rápido** (PA, FC, Tax, SpO2, peso) com tendência gráfica

### 3. Educação Física (Personal / Treinador)
Cobre personal, treinador esportivo, preparador físico, academia.

Blocos:
- **Anamnese de treino** (objetivos, histórico esportivo, lesões prévias, restrições)
- **PAR-Q+** (questionário de prontidão — auto-preenchido pelo paciente)
- **Avaliação física** — peso, altura, IMC, % gordura (Pollock 3/7 dobras), circunferências
- **Testes de performance** — 1RM estimado (Brzycki), VO2máx (Cooper/Astrand), flexibilidade (sentar-alcançar), Yoyo
- **Periodização** — montagem de microciclo/mesociclo com templates (hipertrofia, força, resistência, emagrecimento)
- **Prescrição de treino** — biblioteca de exercícios com vídeo, séries/reps/carga/descanso
- **Diário de treino do aluno** — aluno marca treinos feitos no portal (já existe estrutura de portal)

**Ferramentas que reduzem digitação:**
- **Biblioteca de exercícios pronta** (~300 exercícios com vídeo) — clique e adiciona ao treino
- **Templates de treino por objetivo** (hipertrofia full body, ABC, ABCD, push-pull-legs, emagrecimento HIIT, etc.)
- **Cálculos automáticos** — IMC, %GC, FCmáx (Tanaka), zonas de FC, 1RM
- **Progressão automática** — sugere aumento de carga baseado no histórico do aluno
- **Wearables (já temos Capacitor Health)** — puxa passos, FC, calorias para fechar a sessão sem digitar
- **PDF do treino** com QR code que abre vídeo do exercício para o aluno

---

## Princípio anti-digitação (vale para as 3 lentes)

| Recurso | Onde se aplica |
|---|---|
| **Voz → texto** (Whisper, já integrado) | Anamnese, evolução, observações |
| **IA preenche por contexto** (Gemini, já integrada) | Sugestão de hipótese diagnóstica, plano, missões, treino |
| **Templates por especialidade** | Anamnese, evolução, prescrição, treino |
| **Autocomplete inteligente** | CID-10, medicamentos, exercícios, exames |
| **Importar PDF/imagem** | Exames laboratoriais, exames de imagem, receitas antigas |
| **Wearables** | Sinais vitais, atividade, sono, FC |
| **Portal do paciente preenche sozinho** | PAR-Q+, MyID, questionários, diário |
| **Histórico carrega automaticamente** | Última consulta vira ponto de partida da próxima |

---

## Entregas técnicas (3 sprints curtos)

### Sprint A — Fundação das lentes (1 etapa, baixíssimo risco)
1. Seed da tabela `perfis_profissionais` com as 3 lentes (Fisio já existe — adicionar Médico e Edu Física)
2. Tela em **Configurações → Meu Perfil** para o profissional escolher/trocar lente
3. Sub-seleção de especialidade dentro de Medicina (Clínico, Orto, Endo, Cardio, Psiq, Gineco, Pedi, Dermato)
4. `useLenteAtiva` já existe — apenas adicionar uso em mais lugares
5. **Default continua Fisio** — nenhum usuário existente é afetado

### Sprint B — Lente Medicina
1. Bloco "Sinais Vitais" reutilizável
2. Bloco "Exame Ortopédico" (testes por região, checkbox + observação por voz)
3. Bloco "Metabólico" (campos laboratoriais + alertas de fora da faixa)
4. PDFs: Receita, Atestado, Solicitação de exames
5. Autocomplete CID-10 e medicamentos (lista local, ~5k itens)
6. Importar PDF de exame via Gemini Vision (edge function)

### Sprint C — Lente Educação Física
1. Bloco "Avaliação Física" (antropometria + cálculos automáticos)
2. Bloco "Testes de Performance"
3. Biblioteca de exercícios (tabela `exercicios_biblioteca` com vídeo URL)
4. Montagem de treino (drag-and-drop, templates por objetivo)
5. PAR-Q+ no portal do paciente (já temos infra de questionários)
6. Diário de treino no portal (já temos `progresso_exercicios`)
7. PDF do treino com QR code

---

## O que NÃO vai mudar

- MyID v2.0 e cálculo de score (intocado)
- Agenda, CRM, Financeiro, Eventos, Pagamentos
- Portal do paciente atual (só ganha PAR-Q+ e diário de treino como opcionais)
- Sistema de autenticação, RLS, planos comerciais
- Layout, branding, navegação principal

---

## Detalhes técnicos (seção para revisão técnica)

**Banco — tudo aditivo, zero `DROP`:**
- `perfis_profissionais` — seed de novas linhas (Medicina, EduFisica)
- `profiles.especialidade_medica` — nova coluna nullable
- `exercicios_biblioteca` — nova tabela (catálogo global + custom por profissional)
- `treinos_montados` — nova tabela (link com paciente + exercicios)
- `medicamentos_catalogo` / `cid10_catalogo` — tabelas read-only com seed
- `exames_importados` — nova tabela (PDF + extração IA)
- Sinais vitais e blocos extras vão em `avaliacoes_identidade.dados_adicionais` (jsonb já existe) — sem nova tabela

**Edge functions novas:**
- `extract-exame-pdf` (Gemini Vision)
- `sugerir-treino` (Gemini, opcional)

**Frontend:**
- Componentes condicionais via `temBloco(lente, 'sinais_vitais')` — padrão já existente
- Templates de evolução por lente (já suportado em `perfis_profissionais.template_evolucao`)

**Migrations:** uma por sprint, com `IF NOT EXISTS` em tudo, GRANTs explícitos, RLS por terapeuta_id.

**Validação:** cada sprint sobe em preview, eu testo cadastro/login/MyID antes de publicar.

---

## Próximo passo

Confirma se a divisão das 3 sprints faz sentido e eu começo pelo **Sprint A (fundação das lentes)** — é o de menor risco e já libera a UI de escolher perfil profissional. Depois decidimos a ordem entre Medicina e Educação Física.

Se preferir, posso também:
- Reduzir o escopo médico inicial para só Clínico + Orto (deixar as outras especialidades pra fase seguinte)
- Começar pela Educação Física se for prioridade comercial
