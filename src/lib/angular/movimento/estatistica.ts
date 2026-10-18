import type { ResumoMedida } from './tipos';

/*
 * Estatística básica da análise do movimento (agente M). Tudo puro e tolerante a lacunas: valores null/NaN são ignorados e,
 * sem dados suficientes, o resultado é null (nada é inventado).
 */

export type Num = number | null | undefined;

export const finito = (v: Num): v is number => typeof v === 'number' && Number.isFinite(v);

export const validos = (s: readonly Num[]): number[] => s.filter(finito);

export const media = (v: readonly number[]): number | null => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);

/** Desvio-padrão amostral (n − 1); null com menos de 2 valores. */
export function desvioPadrao(v: readonly number[]): number | null {
  if (v.length < 2) return null;
  const m = media(v) as number;
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}

export function mediana(v: readonly number[]): number | null {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Percentil `p` (0 a 1) por interpolação linear; null sem valores. */
export function percentil(v: readonly number[], p: number): number | null {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const pos = (o.length - 1) * Math.min(1, Math.max(0, p));
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return o[lo] + (o[hi] - o[lo]) * (pos - lo);
}

/** Mediana dos desvios absolutos em relação à mediana (MAD). */
export function mad(v: readonly number[]): number | null {
  const med = mediana(v);
  return med === null ? null : mediana(v.map((x) => Math.abs(x - med)));
}

/** Escore z modificado de Iglewicz e Hoaglin (1993): M = 0,6745 × (valor − mediana) ÷ MAD. Com MAD = 0 não é avaliado (null). */
export function escoreZModificado(valor: number, med: number, madValor: number | null): number | null {
  if (madValor === null || !(madValor > 0)) return null;
  return (0.6745 * (valor - med)) / madValor;
}

/** Resumo dos valores não nulos (as posições `iPrimeira` e `iUltima` são índices na lista recebida, de 0 em diante). */
export function resumir(valores: readonly Num[]): ResumoMedida {
  let iPrimeira: number | null = null, iUltima: number | null = null;
  valores.forEach((x, i) => {
    if (!finito(x)) return;
    if (iPrimeira === null) iPrimeira = i;
    iUltima = i;
  });
  const v = validos(valores);
  const primeira = iPrimeira === null ? null : (valores[iPrimeira] as number);
  const ultima = iUltima === null ? null : (valores[iUltima] as number);
  return {
    n: v.length,
    media: media(v),
    dp: desvioPadrao(v),
    mediana: mediana(v),
    min: v.length ? Math.min(...v) : null,
    max: v.length ? Math.max(...v) : null,
    primeira, ultima, iPrimeira, iUltima,
    tendencia: v.length >= 2 && primeira !== null && ultima !== null ? ultima - primeira : null,
  };
}

/** Número em pt-BR (vírgula decimal, sinal de menos "−"), com `casas` decimais; "–" quando não há valor. */
export function fmt(n: Num, casas = 1): string {
  if (!finito(n)) return '–';
  const arred = Number(n.toFixed(casas));
  const texto = Math.abs(arred).toFixed(casas).replace('.', ',');
  return arred < 0 ? `−${texto}` : texto;
}

/** Casas decimais com que a unidade é exibida: tempos em centésimos de segundo; ângulos e percentuais em décimos. */
const casasDaUnidade = (unidade: string): number => (unidade === 's' ? 2 : 1);

/**
 * Menor passo que o número exibido distingue (0,1 para ° e %, 0,01 para s). Serve de piso numérico para a incerteza: uma incerteza
 * menor que o último dígito exibido sairia no laudo como "0,0" e deixaria resíduo de ponto flutuante virar achado. Não é tolerância clínica.
 */
export const resolucaoDaUnidade = (unidade: string): number => 10 ** -casasDaUnidade(unidade);

/** Número com unidade: o grau cola no número ("98,2°"); as demais unidades vão depois de um espaço. */
export function fmtUn(n: Num, unidade: string, casas?: number): string {
  const c = casas ?? casasDaUnidade(unidade);
  const t = fmt(n, c);
  if (t === '–') return t;
  return unidade === '°' ? `${t}°` : `${t} ${unidade}`;
}
