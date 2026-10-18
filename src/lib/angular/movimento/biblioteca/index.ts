import type { Biblioteca, EntradaBiblioteca } from '../tipos';
import { ASSIMETRIA_DORSIFLEXAO, ASSIMETRIA_FLEXAO_JOELHO, ASSIMETRIA_FLEXAO_QUADRIL } from './agachamentoAssimetrias';
import { DESVIO_LATERAL_PELVE, VALGO_DINAMICO } from './agachamentoFrontal';
import { AVANCO_JOELHO, INCLINACAO_TRONCO, VARIACAO_PROFUNDIDADE } from './agachamentoLateral';
import { TENDENCIA_NA_SERIE } from './agachamentoSerie';
import {
  ASSIMETRIA_AMPLITUDE_QUADRIL, ASSIMETRIA_FLEXAO_JOELHO_MARCHA, ASSIMETRIA_TEMPO_APOIO, INCLINACAO_TRONCO_MARCHA,
} from './marcha';

/*
 * Biblioteca curada de hipóteses (agente R). O laudo só repete o que está aqui; a IA não acrescenta causa. Cada fator é uma hipótese
 * para o profissional confirmar, com fonte conferida no PubMed (ver fontes.ts) ou marcado "a confirmar". Documento de leitura, com
 * as fontes por chave e o que ficou sem referência: docs/biblioteca-hipoteses-movimento.md.
 *
 * Regras (o teste src/test/movimentoBiblioteca.test.ts confere o que dá para conferir por máquina):
 *  - A chave de cada entrada é uma ChaveAchado do catálogo (protocolos.ts); `entrada.chave` repete a chave do registro.
 *  - Todo fator contribuinte é hipótese ("pode contribuir"), com `ressalva` preenchida. Força diferente de 'a_confirmar' exige ao menos
 *    uma fonte; sem fonte verificada o fator entra como 'a_confirmar', e o item a conferir sem fonte declara `semReferenciaVerificada`.
 *  - Fonte só com PMID conferido no PubMed e `trecho` copiado LITERALMENTE do resumo indexado (em inglês). Nada de número, dose,
 *    referência ou trecho inventado ou "de memória".
 *  - Fonte só com avaliação metodológica (avaliacaoMetodologica.ts; critérios em docs/avaliacao-metodologica-fontes.md) e decisão diferente de
 *    "remover". Qualidade baixa nunca aparece sem ressalva; a qualidade e a limitação principal vão para o laudo junto da fonte.
 *  - Vocabulário: nada que julgue o corpo ou o desempenho (ver vocabulario.ts) e nada de verbo causal.
 */
const ENTRADAS: EntradaBiblioteca[] = [
  ASSIMETRIA_FLEXAO_JOELHO,
  ASSIMETRIA_FLEXAO_QUADRIL,
  ASSIMETRIA_DORSIFLEXAO,
  VALGO_DINAMICO,
  DESVIO_LATERAL_PELVE,
  INCLINACAO_TRONCO,
  AVANCO_JOELHO,
  VARIACAO_PROFUNDIDADE,
  TENDENCIA_NA_SERIE,
  ASSIMETRIA_TEMPO_APOIO,
  ASSIMETRIA_FLEXAO_JOELHO_MARCHA,
  ASSIMETRIA_AMPLITUDE_QUADRIL,
  INCLINACAO_TRONCO_MARCHA,
];

export const BIBLIOTECA: Biblioteca = Object.fromEntries(ENTRADAS.map((e) => [e.chave, e]));

/** Entrada da biblioteca para uma chave de achado; null quando não há (o laudo então diz que não há hipóteses curadas). */
export function entradaDaBiblioteca(chave: string): EntradaBiblioteca | null {
  return Object.prototype.hasOwnProperty.call(BIBLIOTECA, chave) ? BIBLIOTECA[chave] : null;
}
