import { BIBLIOTECA } from './biblioteca';
import type { AnaliseMovimento, Biblioteca, ContextoLaudo, LaudoMovimento } from './tipos';

/*
 * DONO: agente L (laudo). Assinatura do contrato; o corpo é provisório e só L o substitui.
 *
 * O que L entrega (puro e determinístico: modelos de frase, nenhum modelo de linguagem, nenhuma rede):
 *  - Estrutura `LaudoMovimento` com todas as seções, textos em português do Brasil e rodapé fixo `AVISO_ESTIMATIVA_VIDEO`.
 *  - Cada achado leva as hipóteses e os itens a conferir da `biblioteca[achado.chave]`. Sem entrada, `semBiblioteca: true` e
 *    nenhuma causa improvisada. Hipótese com força 'a_confirmar' não cita referência; as demais citam `ReferenciaLaudo`.
 *  - Vocabulário de vocabulario.ts (ROTULO_SITUACAO, ROTULO_FORCA...): nada de julgar o corpo ou o desempenho.
 *  - `responsavelRevisao` em branco no cabeçalho quando o contexto não o traz; o laudo nunca presume revisão.
 *  - Método: fórmula da incerteza, regras dos gatilhos usados (GATILHOS), critérios usados e a nota de `notaCriterio`.
 */
export function montarLaudo(analise: AnaliseMovimento, contexto: ContextoLaudo, biblioteca: Biblioteca = BIBLIOTECA): LaudoMovimento {
  void analise;
  void contexto;
  void biblioteca;
  throw new Error('não implementado');
}
