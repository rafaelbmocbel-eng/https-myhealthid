# Avaliação biomecânica do movimento — Etapa 3 (especificação)

Decisão do Rafael (18/10/2026): a análise de vídeo serve para **auxiliar a avaliação
biomecânica do movimento pelo profissional de saúde**. Não é um personal trainer
virtual e não treina o cliente.

Referência funcional estudada: o app Bodypark (vídeos de demonstração do canal
Insider Physical Therapy). Usado apenas como referência de fluxo e de organização
da informação, sem cópia de código, texto ou marca.

## O que a Etapa 3 é

- Mede ângulos, deslocamentos e simetria durante um movimento, por fase e por repetição.
- Mostra como a medida varia entre repetições, entre os lados e entre avaliações.
- Gera um laudo para o profissional com os achados medidos, as possíveis causas
  (hipóteses com referência) e o que conferir na avaliação presencial.

## O que a Etapa 3 NÃO é

- Treino guiado, contagem de repetições como meta, notas "perfeito/bom", pontuação
  de desempenho, ranking, gamificação.
- Avisos em tempo real ou por voz ao cliente durante o exercício.
- Montagem de treino, registro de carga/volume, "mapa de calor" de ativação muscular
  (estimativa sem validação por câmera).
- Diagnóstico. O laudo apresenta hipóteses para o profissional confirmar.

## Vocabulário

Usar "dentro do critério", "no limite", "fora do critério" e "sem referência".
Nunca "certo/errado", "perfeito/bom", "falha". O veredito só existe quando houver
limite com fonte confirmada ou critério definido pelo profissional; sem isso, a
medida aparece como observação.

## Estrutura de um protocolo de movimento

Cada movimento avaliado é um perfil com:

1. **Fases** (por exemplo: em pé, descida, ponto mais baixo, subida), usadas para
   segmentar as repetições e extrair as medidas em instantes comparáveis.
2. **Medidas** por fase (ângulos, deslocamentos, índice de assimetria entre os lados,
   variação entre repetições), cada uma com o plano de câmera necessário.
3. **Achados nomeados**, cada um com: regra de detecção, texto curto para o
   profissional, **possíveis fatores contribuintes** (cada um com referência
   verificada ou marcado "a confirmar"), e o que conferir na avaliação presencial.
4. **Limitações** que entram no laudo: medida 2D só vale no plano filmado; erro de
   um quadro; diferença menor que a incerteza não é achado; pontos que o modelo de
   pose não mede (por exemplo, curvatura lombar).

Primeiros movimentos: agachamento (de lado e de frente) e marcha, que já têm modelo
de gesto. Os demais (avanço, descida de degrau, aterrissagem, sentar e levantar,
ombro) entram depois, cada um só com critérios que tenham fonte ou que o
profissional defina.

## Laudo

- Para o profissional: achados por repetição e por lado, gráfico ângulo × tempo,
  hipóteses com referência, o que conferir, limitações da medida, identificação do
  vídeo, data e responsável pela revisão.
- Para o cliente (se o Rafael decidir): versão em linguagem simples, liberada pelo
  profissional.
- Cruzamento com o histórico clínico e o MyID só com consentimento.
- Todo texto gerado por IA é montado sobre medidas e referências já existentes; a IA
  não acrescenta causa que não esteja na biblioteca curada.

## Salvaguardas

- Rosto desfocado por padrão; vídeo só guardado com consentimento (LGPD).
- Alegações de precisão só com validação própria (medida automática contra medida
  manual), nunca copiadas de terceiros.
- Critérios debatidos na literatura (por exemplo, limite de avanço do joelho no
  agachamento e no avanço) ficam desligados por padrão e só viram veredito quando o
  profissional ou o time científico ativar.

## Decisões em aberto (do Rafael)

1. Quem vê o laudo: só o profissional, ou o cliente também?
2. O laudo é Premium ou vale para todos?
3. Quem define os critérios de cada movimento: o Rafael, o time científico, ou só
   os que tiverem fonte?

Enquanto não houver decisão, o protótipo é visível só para o profissional.
