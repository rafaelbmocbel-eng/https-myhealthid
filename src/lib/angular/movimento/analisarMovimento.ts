import type { TrilhaPose } from '../video/tipos';
import type { AnaliseMovimento, IdProtocolo, OpcoesAnalise, Protocolo } from './tipos';

/*
 * DONO: agente M (análise). Este arquivo é a assinatura do contrato; o corpo abaixo é provisório e só M o substitui.
 *
 * O que M entrega (tudo puro, determinístico, sem rede e sem modelo de linguagem):
 *  1. Resolver o protocolo (`protocoloDo` se vier um id) e a direção (`opcoes.direcao ?? estimarDirecao(trilha)`).
 *  2. Séries angulares suavizadas das `protocolo.articulacoes` (reuse angulosPorQuadro/suavizar do motor em ../video, como em
 *     analisarGesto) e, na marcha, os eventos (`opcoes.eventos ?? detectarEventosMarcha`).
 *  3. Segmentar `repeticoes` conforme `protocolo.segmentacao`; marcar `sinalizadores`. Repetição incompleta fica na lista com
 *     valores null (os arrays de valores têm SEMPRE o comprimento de `repeticoes`).
 *  4. `medidas`: uma por `protocolo.medidas`, extraídas da fase/extração declaradas; `resumos` por medida e lado (ResumoMedida).
 *  5. `incerteza`: texto de `formulaDaIncerteza(protocolo)` e `DESCRICAO_INCERTEZA`; u por medida e lado conforme FORMULAS_INCERTEZA.
 *  6. `achados`: só dos `achadosAvaliaveis(protocolo)`, pelas regras de GATILHOS (mínimo de repetições incluído), com o sinal e as
 *     unidades documentados em `Achado.valor`. Critérios: só os que passam em `criterioAplicavel` e `criterioValidoNoProtocolo`;
 *     veredito por `avaliarCriterio`. Sem critério ativo a situação é 'sem_referencia'.
 *  7. `indisponiveis`: `indisponiveisDoProtocolo(protocolo)`.
 *  8. Nunca lançar por dados ruins (trilha vazia, poucos pontos): devolver listas vazias e explicar em `avisos`.
 */
export function analisarMovimento(protocolo: Protocolo | IdProtocolo, trilha: TrilhaPose, opcoes: OpcoesAnalise = {}): AnaliseMovimento {
  void protocolo;
  void trilha;
  void opcoes;
  throw new Error('não implementado');
}
