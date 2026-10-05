export interface Aceleracao { x: number; y: number; z: number }

/**
 * Inclinação do aparelho em graus, como num nível: quanto a borda do celular mais próxima
 * da vertical está torta. Positivo = aparelho girado no sentido horário, visto de frente para a tela.
 * Usa só o plano da tela (x, y) da aceleração com gravidade. O sinal da leitura muda entre
 * iPhone e Android, mas o ângulo calculado é o mesmo nos dois (girar leitura e eixo juntos não muda a diferença).
 * Devolve null com o aparelho deitado (a tela aponta para cima ou para baixo): não há borda "vertical".
 */
export function inclinacaoDoAparelho(a: Aceleracao): number | null {
  const plano = Math.hypot(a.x, a.y);
  const total = Math.hypot(a.x, a.y, a.z);
  if (total < 1 || plano < 0.6 * total) return null;
  // Eixo do aparelho mais alinhado com a leitura: (±1, 0) ou (0, ±1).
  const u0 = Math.abs(a.y) >= Math.abs(a.x) ? { x: 0, y: Math.sign(a.y) || 1 } : { x: Math.sign(a.x) || 1, y: 0 };
  const cross = u0.x * a.y - u0.y * a.x;
  const dot = u0.x * a.x + u0.y * a.y;
  return (Math.atan2(cross, dot) * 180) / Math.PI;
}

/** Suavização exponencial: valor' = valor + k·(novo − valor). */
export const suavizarLeitura = (anterior: number | null, novo: number, k = 0.25) =>
  anterior === null ? novo : anterior + k * (novo - anterior);

/** Giro da foto (mesma convenção de `rotacaoDoNivel`) a partir da inclinação do aparelho ao fotografar. */
export const giroDaFoto = (inclinacao: number, inverter = false) => (inverter ? inclinacao : -inclinacao);
