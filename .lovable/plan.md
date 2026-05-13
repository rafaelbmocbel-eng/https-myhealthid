
# Contar Minha História — Voz Guiada do Paciente

## Visão geral
Adicionar no **portal do paciente** um botão "Contar minha história de dor" que abre uma página com perguntas guiadas curtas. O paciente responde por voz (ou texto), a IA estrutura tudo e o resultado entra como **avaliação inicial** (se for a primeira) ou como **atualização** (se já existir histórico) no perfil clínico — pronta para o profissional revisar e complementar com o exame físico.

## Por que faz sentido
- Já existe a infra: `VoiceAssessment`, `useSpeechToText`, edge functions `voice-assessment` e `extract-pain-from-voice`, e `avaliacoes_voz` no banco.
- Já existe o `MyID` (questionário mãe). Hoje o paciente preenche por formulário; isso adiciona um caminho **conversacional por voz** mais leve para queixas/atualizações entre MyIDs.
- Mantém a regra de ouro: IA é **suporte à decisão**, profissional valida.

## Fluxo do paciente
1. No dashboard do portal aparece um card "Conte como você está" (CTA primário se nunca avaliou; CTA secundário "Atualizar minha história" se já tem avaliação).
2. Clica → abre `/portal/historia` (rota dentro do PortalGate).
3. Tela com 4–6 perguntas guiadas, uma por vez (cartões grandes, mobile-first):
   - Onde dói? (com avatar para tocar regiões — opcional)
   - Como começou? Quando?
   - Como é a dor (pontada, queimação, peso…)?
   - O que melhora / o que piora?
   - Algo mudou nas últimas semanas?
   - Como isso afeta seu dia (sono, trabalho, humor)?
4. Cada pergunta tem botão grande de **microfone** + textarea. Pode ditar e editar.
5. Ao final: tela de revisão + "Enviar para meu profissional".

## O que a IA faz no envio
- Junta as respostas em um transcript único.
- Chama `extract-pain-from-voice` para mapa de dor (regiões + intensidade + estruturas).
- Chama `voice-assessment` para gerar resumo clínico estruturado (queixa principal, início, características, fatores, impacto funcional, red flags).
- Salva em `avaliacoes_voz` com `_meta.origem = 'portal_paciente'`, `_meta.mapa_dor`, `_meta.tipo = 'inicial' | 'atualizacao'`.
- Cria notificação para o profissional (`tipo = 'historia_paciente'`).
- Se for a primeira avaliação, marca como **avaliação inicial pendente de exame físico**.

## O que o profissional vê
- Notificação "🎙️ {Paciente} contou a história — pronto para revisar".
- No perfil do paciente, na aba **Acompanhamento / Histórico**, aparece o card da história com:
  - Resumo IA + transcript original + avatar com mapa de dor.
  - Botão "Continuar avaliação" → abre `AvaliacaoPresencial` já pré-preenchido (mapa de dor + contexto).
  - Botão "Marcar como avaliação inicial" (se ainda não houver).
- Tudo rastreado em `evolucao_paciente` automaticamente (já existe trigger).

## Regras
- **Inicial vs atualização**: a primeira história do paciente conta como avaliação inicial (status "aguardando exame físico"). As próximas são atualizações que entram no histórico longitudinal.
- **Frequência**: máx. 1 envio a cada 24h (anti-spam, igual padrão do MyID mensal).
- **LGPD**: reusar `PacienteConsentimentoLGPD` — bloqueia o envio se não aceito.
- **Privacidade**: áudio não é armazenado; só transcript + resumo (mesma política atual do `VoiceAssessment`).
- **Espelhamento Portal↔Pro**: respeita a regra do projeto — toda feature do paciente tem contrapartida no painel do profissional.

## Tech (resumo)
- Frontend paciente: nova página `src/pages/paciente/PacienteHistoria.tsx` + card no `PacienteDashboard`.
- Rota dentro de `PortalGate`.
- Reusa `useSpeechToText`, `VoiceAssessment` (modo `voice` simplificado) e `Body3DAvatar` opcional.
- Backend: reusa edge functions existentes `voice-assessment` + `extract-pain-from-voice`. Sem novas tabelas — usa `avaliacoes_voz` com flags em `_meta`.
- Sem mudança de RLS (paciente já pode inserir em `avaliacoes_voz` do próprio `paciente_id`).

## Entregáveis
1. Página `PacienteHistoria` com perguntas guiadas + voz.
2. Card de entrada no `PacienteDashboard`.
3. Hook `useEnviarHistoria` que chama as edges e salva.
4. Card "História do paciente" na aba de Acompanhamento do perfil pro.
5. Notificação + auto-evolução.

## Fora de escopo
- Nova IA/modelo (usa Gemini Flash já configurado).
- Substituir o MyID — ele continua sendo o questionário mãe oficial.
- Áudio persistido / transcrição offline.
