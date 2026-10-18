import type { Biblioteca, EntradaBiblioteca } from '../tipos';

/*
 * DONO: agente R (biblioteca curada de hipóteses). R preenche BIBLIOTECA (pode dividir em um arquivo por achado nesta pasta e
 * juntá-los aqui). O laudo só repete o que está aqui; a IA não acrescenta causa.
 *
 * Regras da biblioteca (o teste de contrato confere o que dá para conferir por máquina):
 *  - A chave de cada entrada é uma ChaveAchado do catálogo (protocolos.ts); `entrada.chave` repete a chave do registro.
 *  - Todo fator contribuinte é hipótese ("pode contribuir"), com `ressalva` preenchida. Força diferente de 'a_confirmar' exige
 *    ao menos uma fonte; sem fonte verificada o fator entra como 'a_confirmar', e o item a conferir sem fonte declara
 *    `semReferenciaVerificada: true`.
 *  - Fonte só com PMID conferido no PubMed e `trecho` copiado LITERALMENTE do resumo indexado (em inglês). Nada de número, dose,
 *    referência ou trecho inventado ou "de memória".
 *  - Vocabulário: nada que julgue o corpo ou o desempenho (ver vocabulario.ts).
 */
export const BIBLIOTECA: Biblioteca = {};

/** Entrada da biblioteca para uma chave de achado; null quando não há (o laudo então diz que não há hipóteses curadas). */
export function entradaDaBiblioteca(chave: string): EntradaBiblioteca | null {
  return Object.prototype.hasOwnProperty.call(BIBLIOTECA, chave) ? BIBLIOTECA[chave] : null;
}
