/** Devolve true no máximo uma vez a cada `intervaloMs`. Serve para não redesenhar uma tela inteira a cada quadro de animação. */
export function criarLimitador(intervaloMs: number): (agora: number) => boolean {
  let ultimo = Number.NEGATIVE_INFINITY;
  return (agora) => {
    if (agora - ultimo < intervaloMs) return false;
    ultimo = agora;
    return true;
  };
}
