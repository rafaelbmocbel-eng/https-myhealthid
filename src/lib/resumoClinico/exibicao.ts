import { semAcentoEmMinuscula, tituloParaExibir } from './marcos';
import type { ItemSemData, Marco } from './tipos';

const SEPARADOR_DO_DETALHE = ' · ';

// O título já abre com o rótulo ("Cirurgia ou internação: Coluna"): dizer o rótulo de novo na linha de baixo só duplica.
// Sem acento e sem caixa, e só vale se o rótulo termina ali (a palavra "Cirurgião" não abre com "Cirurgia").
function tituloAbreComORotulo(titulo: string, rotulo: string): boolean {
  const t = semAcentoEmMinuscula(titulo.trim());
  const r = semAcentoEmMinuscula(rotulo.trim());
  if (!r || !t.startsWith(r)) return false;
  return !/[a-z0-9]/.test(t.charAt(r.length));
}

/** Rótulo do tipo para a linha da data, ou nulo quando o título que a tela mostra já começa com ele. */
export function rotuloDoTipoParaExibir(marco: Marco): string | null {
  return tituloAbreComORotulo(tituloParaExibir(marco), marco.rotuloTipo) ? null : marco.rotuloTipo;
}

/**
 * Detalhe de um item de "Sem data". Ele abre com um rótulo fixo seguido de " · " ("Cirurgia ou internação · Ano que o
 * cliente escreveu: ..."); se o título que a tela mostra já começa com esse rótulo, o rótulo sai do detalhe.
 */
export function detalheParaExibir(item: ItemSemData): string {
  const corte = item.detalhe.indexOf(SEPARADOR_DO_DETALHE);
  if (corte <= 0) return item.detalhe;
  const rotulo = item.detalhe.slice(0, corte);
  if (!tituloAbreComORotulo(tituloParaExibir(item), rotulo)) return item.detalhe;
  return item.detalhe.slice(corte + SEPARADOR_DO_DETALHE.length);
}

/** Nome da fonte de um registro que ficou de fora, ou nulo quando o próprio rótulo do registro já é esse nome. */
export function nomeDaFonteParaExibir(rotulo: string, nomeDaFonte: string): string | null {
  return semAcentoEmMinuscula(rotulo.trim()) === semAcentoEmMinuscula(nomeDaFonte.trim()) ? null : nomeDaFonte;
}

/** Frase do aviso dos achados do histórico: "3 achados do histórico aguardando a sua revisão" (singular com 1). */
export function textoDoAvisoDosAchados(total: number, contagemIncompleta = false): string {
  const achados = `${total} ${total === 1 ? 'achado' : 'achados'} do histórico aguardando a sua revisão`;
  return contagemIncompleta ? `Pelo menos ${achados}` : achados;
}
