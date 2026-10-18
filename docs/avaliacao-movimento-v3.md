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

## Implementação (Etapa 3, primeira fatia)

Primeira fatia: agachamento (vista lateral e vista frontal) e marcha (vista lateral). Tudo roda no dispositivo: nenhuma chamada
de rede nova, nenhum envio de vídeo e **nenhum modelo de linguagem** (o texto do laudo vem de modelos de frase, para ser
testável). A interface fica em Aplicações > Análise angular > Análise em vídeo, rotulada "beta", e reaproveita o motor de
`src/lib/angular/video/*` (rastreio, ângulos, suavização, eventos, correção manual).

### Mapa de arquivos e donos

Código novo em `src/lib/angular/movimento/` (módulos puros, sem React).

| Arquivo | Dono | Conteúdo |
| --- | --- | --- |
| `tipos.ts` | Arquiteto | Todos os tipos do contrato (protocolo, repetição, medida, achado, critério, fonte, fator, laudo). Só tipos. |
| `vocabulario.ts` | Arquiteto | Rótulos (situação, força da evidência, lado, plano) e `termoProibido` (certo, errado, normal, perfeito, falha...). |
| `protocolos.ts` | Arquiteto | Catálogo dos 13 achados, os 5 gatilhos (`GATILHOS`), os 3 protocolos (`PROTOCOLOS`), fórmulas da incerteza e auxiliares (`protocoloDo`, `protocolosDoGesto`, `achadosAvaliaveis`, `indisponiveisDoProtocolo`, `formulaDaIncerteza`). |
| `criterios.ts` | Arquiteto | Critério do profissional: `novoCriterio` (sempre desligado), `criterioAplicavel`, `criterioValidoNoProtocolo`, `avaliarCriterio` (dentro, no limite, fora). |
| `analisarMovimento.ts` | M | `analisarMovimento(protocolo, trilha, opcoes?)`: repetições, medidas por repetição e por lado, resumos, incerteza, achados. |
| `laudo.ts` | L | `montarLaudo(analise, contexto, biblioteca?)`: laudo estruturado, textos determinísticos. |
| `laudoPdf.ts` | L | `gerarPdfLaudo(laudo)`: PDF com jsPDF, no padrão de `relatorioVideo.ts`, rodapé fixo "Estimativa por vídeo · não é diagnóstico". |
| `biblioteca/` | R | `BIBLIOTECA` e `entradaDaBiblioteca(chave)`: fatores contribuintes e itens a conferir, cada um com fonte verificada ou marcado "a confirmar". |
| `index.ts` | Arquiteto | Reexporta tudo (importar `laudoPdf` sob demanda na tela, para o jsPDF não entrar no pacote principal). |
| `src/test/movimentoContrato.test.ts` | Arquiteto | Teste de contrato: protocolos, catálogo, gatilhos, critérios, vocabulário e regras da biblioteca. |
| Tela em `src/components/angular/video/` | Interface | Escolha do protocolo, tabela por repetição e por lado, achados, critério do profissional, laudo e PDF. |

### Fluxo de dados

```
vídeo → rastrearVideo → TrilhaPose (motor ../video; pontos corrigidos pelo profissional)
      → analisarMovimento(protocolo, trilha, { criterios, escalaCmPorPixel, eventos? })   → AnaliseMovimento
      → montarLaudo(analise, contexto, BIBLIOTECA)                                        → LaudoMovimento
      → tela (renderiza as seções do laudo)  |  gerarPdfLaudo(laudo) → Blob (PDF)
```

O plano de câmera é uma propriedade **declarada** pelo protocolo escolhido (`planoFilmado`); o rastreio é o mesmo para todos.
Achado que exige o outro plano não é calculado: vira `indisponiveis`, com o motivo e o que gravar para obtê-lo
(`indisponiveisDoProtocolo`), e a tela avisa.

### Regras do contrato que os construtores precisam respeitar

- **Repetições e marcos.** Toda repetição tem três marcos (`inicio`, `fundo`, `fim`). No agachamento, `fundo` é o ponto mais baixo;
  na marcha, uma repetição é uma passada (contato do pé até o contato seguinte do mesmo pé) e `fundo` é a saída do pé. As fases
  são janelas entre marcos; cada medida declara a fase e a extração (`valor_no_marco`, `maximo`, `amplitude`, `media`, `duracao`).
- **Alinhamento.** Cada array de `MedidaPorRepeticao.valores` tem o comprimento de `repeticoes`, com `null` onde não houve medida.
  Na marcha, numa medida por lado, `valores.D` só tem número nas passadas do pé D e `valores.E` nas do pé E. As posições (0-based)
  são o que `Achado.repeticoes` guarda; `Repeticao.numero` (1-based) é só para leitura.
- **Sem juízo.** Sem critério ativo, todo achado tem `situacao: 'sem_referencia'`. Veredito (dentro do critério, no limite, fora do
  critério) só existe com critério do profissional ativo, aplicável e válido para a medida do protocolo. Critério debatido
  (avanço do joelho além do pé) fica desligado por padrão e sem valor presumido.
- **Incerteza do próprio vídeo.** Estimada empiricamente (resíduo entre a série bruta e a suavizada para ângulos e deslocamentos;
  um quadro para tempos). A fórmula (`FORMULAS_INCERTEZA`, `formulaDaIncerteza`) entra no método do laudo. Nenhuma tolerância fixa
  em graus.
- **Gatilhos.** Um achado só existe se um gatilho disparar: (a) diferença entre lados maior que a incerteza e que a variação entre
  repetições; (b) variação entre repetições maior que a incerteza; (c) mudança da primeira para a última repetição maior que a
  incerteza; (d) repetição discrepante (escore z modificado de Iglewicz e Hoaglin, 1993: critério estatístico, não clínico);
  (e) critério do profissional. As regras literais e o mínimo de repetições de cada uma estão em `GATILHOS` (`protocolos.ts`); M
  implementa o que está escrito ali e L imprime o mesmo texto. Sem gatilho, a medida continua na tabela como observação.
- **Biblioteca.** O laudo só repete causas e itens a conferir que estão em `BIBLIOTECA`; chave sem entrada = "sem hipóteses
  curadas". Fonte só com PMID conferido e trecho literal do resumo; sem isso, o fator entra como "a confirmar".
- **Texto.** Português do Brasil, sem as palavras de `VOCABULARIO_PROIBIDO`, e apenas caracteres que o gerador de PDF imprime
  (Latin-1 mais ≥ ≤ − – — · → e aspas); por isso as fórmulas escrevem `raiz(...)` em vez de símbolos fora dessa lista.
- **Laudo.** `responsavelRevisao` sai em branco quando o contexto não o traz. Rodapé fixo `AVISO_ESTIMATIVA_VIDEO`.

### Decisões de produto registradas nesta fatia

- O valgo dinâmico simétrico e alto, sem critério definido, aparece só na tabela de medidas (não vira achado), porque nenhum gatilho
  sem limite clínico o captura. Se o Rafael quiser destacá-lo, o caminho é um critério do profissional.
- A comparação D×E no agachamento de lado depende do membro mais distante da câmera, que é menos confiável; a limitação consta no
  protocolo e em cada achado de assimetria.
- A recomendação de gravação da marcha para esta etapa é de pelo menos 10 passos (5 de cada pé), para haver passadas suficientes por
  pé para as estatísticas dos gatilhos.
