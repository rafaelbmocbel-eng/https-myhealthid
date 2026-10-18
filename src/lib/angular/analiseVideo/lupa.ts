export interface EntradaPosicaoLupa {
  /** Posição do dedo dentro da caixa do player, em px. */
  cx: number;
  cy: number;
  /** Diâmetro da lupa. */
  tamanho: number;
  larguraCaixa: number;
  /** Distância do topo da caixa até o topo da janela do navegador (negativa se a caixa já rolou para cima). */
  topoDaCaixaNaTela: number;
  /** Faixa do topo da janela ocupada pelo cabeçalho fixo do app: a lupa não passa dela. */
  margemTopoTela?: number;
  /** Distância entre o dedo e a borda da lupa. */
  folga?: number;
}

export type LadoDaLupa = 'acima' | 'direita' | 'esquerda' | 'abaixo';

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Onde pôr a lupa para a mão não a cobrir: acima do dedo, mesmo que isso passe do topo do player (num vídeo deitado o player é baixo
 * e quase todo ponto fica a menos de uma lupa do topo). Só se não houver lugar na janela ela vai para o lado do dedo (o lado com mais
 * espaço), e embaixo apenas se nenhum dos lados couber.
 */
export function posicaoDaLupa(e: EntradaPosicaoLupa): { left: number; top: number; lado: LadoDaLupa } {
  const { cx, cy, tamanho, larguraCaixa } = e;
  const folga = e.folga ?? 32;
  const margem = e.margemTopoTela ?? 64;
  const minEsq = 4, maxEsq = Math.max(4, larguraCaixa - tamanho - 4);

  const topoAcima = cy - tamanho - folga;
  if (e.topoDaCaixaNaTela + topoAcima >= margem) return { left: limitar(cx - tamanho / 2, minEsq, maxEsq), top: topoAcima, lado: 'acima' };

  const cabeDireita = cx + folga + tamanho <= larguraCaixa - 4;
  const cabeEsquerda = cx - folga - tamanho >= minEsq;
  const topoLateral = Math.max(cy - tamanho * 0.75, margem - e.topoDaCaixaNaTela);
  if (cabeDireita || cabeEsquerda) {
    const direita = cabeDireita && (!cabeEsquerda || larguraCaixa - cx >= cx);
    return { left: direita ? cx + folga : cx - folga - tamanho, top: topoLateral, lado: direita ? 'direita' : 'esquerda' };
  }
  return { left: limitar(cx - tamanho / 2, minEsq, maxEsq), top: cy + folga, lado: 'abaixo' };
}
