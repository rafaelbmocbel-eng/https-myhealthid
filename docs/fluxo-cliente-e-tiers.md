# Fluxo do cliente e regras por tier (especificação do Rafael — 16/07/2026)

> Fonte da verdade do produto. Toda mudança no portal do cliente deve respeitar
> este fluxo. Não alterar sem decisão explícita do Rafael.

## O fluxo de entrada do cliente (ordem obrigatória)

1. **Responder o MyID** — sempre o primeiro passo.
2. **Histórico clínico** — as respostas geram *achados clínicos sugeridos*
   (via triagem por IA) que entram na **fila de revisão do profissional** e,
   aprovados, alimentam o **Avatar Clínico** do cliente (visível na área do
   cliente dentro do app do profissional).
3. **Contar o caso clínico (opcional)** — como começou, onde dói, o que piora
   etc., por voz (ditado) ou texto.
4. **Cliente sem terapeuta** — o app deve direcioná-lo (ex.: convite para o
   marketplace "Encontrar profissional").

## Regras por tier

### Cliente NÃO pago (free)
- Responde: MyID + histórico clínico + história atual de dor.
- Recebe: **somente dicas geradas pela IA** (nível gratuito, seguras e gerais)
  + o Relatório de Avaliação (devolutiva).
- NÃO recebe: avatar montado, planos de treino/nutrição personalizados.

### Cliente PREMIUM (paga a plataforma)
- Tudo do free, e:
- **Avatar Clínico montado por um profissional** — a conta é direcionada para
  um profissional revisar os achados e montar o avatar.
- **Questionários específicos baseados em evidência científica** (a criar) que
  norteiam: treino personalizado, dicas de tratamento fisioterapêutico e plano
  nutricional.
- Os planos gerados **não substituem um profissional**. Planos mais elaborados
  exigem **acompanhamento presencial** — modelo misto ("tratamento
  acompanhado").

## Princípios permanentes
- Mensagens automáticas: SÓ para cliente cadastrado e ativo; toda automática
  registrada na conversa do Zap.
- Conteúdo clínico gerado por IA: o profissional revisa antes de chegar ao
  cliente (exceto o nível gratuito de dicas/devolutiva, que é geral e seguro).
- Nomenclatura única: "Treinos" (prescritos), "Meu Plano (IA)" (premium),
  "Exercícios & dicas do MyID" (grátis); moeda única "XP".

## Atualização (decisão do Rafael) — Aba única "Plano de tratamento"

O portal do cliente passa a ter UMA aba **"Plano de tratamento"**
(`/paciente/exercicios`) que reúne TODAS as áreas num só lugar:
**Reabilitação, Personal (treino), Nutricional, Psicológico, Médico** — cada
uma mostra o plano/diretriz que o profissional **confirmou/liberou** (via o hub
"Diretrizes" na área do profissional). O treino interativo (marcar exercício
feito, XP, player de sessão — tabela `studio_treinos`) é uma **seção dentro**
dessa aba, não uma aba separada. As rotas antigas `/paciente/plano-ia` e
"Acesso rápido" apontam para essa aba única.

Onde o profissional cria: **Perfil do paciente → aba "Diretrizes"** (uma
sub-aba por área). Cada área tem "Liberar/enviar ao portal" (o "confirmar"). O
construtor manual de treino (exercício a exercício) fica na sub-aba **Personal**.

Regras por tier (reforço):
- **Free**: só o profissional cria o plano; o cliente apenas VÊ o que foi
  liberado. Sem botão de gerar por IA.
- **Premium**: além do que o profissional monta, o cliente pode GERAR o próprio
  plano por IA a partir de MyID + questionários + anamnese.
- **Free que respondeu todos os questionários**: o profissional pode montar o
  plano completo com tudo que tem (avaliação presencial + MyID + formulários),
  editar e confirmar — e aí aparece para o cliente na aba "Plano de tratamento".
- Prescrever/liberar treino: Educador Físico **ou** Fisioterapeuta.
