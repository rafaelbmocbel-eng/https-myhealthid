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
