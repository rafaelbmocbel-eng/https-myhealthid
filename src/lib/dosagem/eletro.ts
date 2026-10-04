// Contas das correntes elétricas (TENS, FES/NMES, russa, interferencial).
// Só aritmética e definição física; faixas clínicas ficam em protocolosEletro.ts.

const ok = (...n: (number | null | undefined)[]) => n.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0);

/** Período (ms) = 1000 ÷ frequência (Hz). */
export const periodoMs = (freqHz: number) => (ok(freqHz) ? 1000 / freqHz : null);

/** Carga por fase do pulso (µC) = corrente (mA) × largura (µs) ÷ 1000. */
export const cargaPorPulsoUc = (correnteMa: number, larguraUs: number) =>
  ok(correnteMa, larguraUs) ? (correnteMa * larguraUs) / 1000 : null;

/** Ocupação do pulso no período (%) = largura × frequência. */
export const ocupacaoPulsoPct = (larguraUs: number, freqHz: number) =>
  ok(larguraUs, freqHz) ? ((larguraUs * 1e-6) * freqHz) * 100 : null;

/** Corrente média (mA) de um trem de pulsos retangulares = pico × largura × frequência. */
export const correnteMediaMa = (correnteMa: number, larguraUs: number, freqHz: number) =>
  ok(correnteMa, larguraUs, freqHz) ? correnteMa * (larguraUs * 1e-6) * freqHz : null;

/** Densidade de corrente (mA/cm²) = corrente ÷ área do eletrodo. */
export const densidadeCorrenteMaCm2 = (correnteMa: number, areaCm2: number) =>
  ok(correnteMa, areaCm2) ? correnteMa / areaCm2 : null;

/** Ciclo de trabalho (%) = on ÷ (on + off). */
export const cicloTrabalhoPct = (onS: number, offS: number) =>
  ok(onS) && typeof offS === 'number' && offS >= 0 ? (onS / (onS + offS)) * 100 : null;

/** Razão off por on (1 : x). */
export const razaoOffOn = (onS: number, offS: number) => (ok(onS) && typeof offS === 'number' && offS >= 0 ? offS / onS : null);

/** Contrações completas numa sessão. */
export const contracoesPorSessao = (tempoMin: number, onS: number, offS: number) =>
  ok(tempoMin, onS) && typeof offS === 'number' && offS >= 0 ? Math.floor((tempoMin * 60) / (onS + offS)) : null;

/** Tempo total sob estímulo (s) = contrações × on. */
export const tempoSobEstimuloS = (contracoes: number, onS: number) => (ok(onS) && typeof contracoes === 'number' && contracoes >= 0 ? contracoes * onS : null);

/** Duração do burst (ms) a partir do ciclo de trabalho do burst (%) e da frequência de burst (Hz). */
export const duracaoBurstMs = (burstHz: number, cicloPct: number) =>
  ok(burstHz, cicloPct) && cicloPct <= 100 ? (1000 / burstHz) * (cicloPct / 100) : null;

/** Ciclo de trabalho do burst (%) a partir da duração (ms) e da frequência de burst (Hz). */
export const cicloBurstPct = (burstHz: number, duracaoMs: number) => {
  if (!ok(burstHz, duracaoMs)) return null;
  const v = duracaoMs * burstHz / 10;
  return v <= 100 ? v : null;
};

/** Ciclos da portadora dentro de um burst. */
export const ciclosPorBurst = (portadoraHz: number, duracaoMs: number) =>
  ok(portadoraHz, duracaoMs) ? portadoraHz * (duracaoMs / 1000) : null;

/** Frequência de batimento da interferencial (Hz) = |f2 − f1|. */
export const batimentoHz = (f1Hz: number, f2Hz: number) =>
  ok(f1Hz, f2Hz) ? Math.abs(f2Hz - f1Hz) : null;

// ───────── Limites usados nos estudos (meta-TENS, Johnson 2022) ─────────

export const LIMITES_META_TENS = { freqHzMax: 250, larguraUsMax: 500, picoAPicoMaMax: 60 } as const;

export interface AvaliacaoLimitesTens {
  dentro: boolean;
  avisos: string[];
}

/**
 * Compara com os limites dos estudos incluídos no meta-TENS. Não é
 * recomendação: são os valores acima dos quais os estudos foram excluídos.
 */
export function avaliarLimitesTens(args: { freqHz: number | null; larguraUs: number | null; picoMa?: number | null }): AvaliacaoLimitesTens {
  const avisos: string[] = [];
  if (args.freqHz && args.freqHz > LIMITES_META_TENS.freqHzMax) avisos.push(`Frequência acima de ${LIMITES_META_TENS.freqHzMax} pps, limite dos estudos do meta-TENS.`);
  if (args.larguraUs && args.larguraUs > LIMITES_META_TENS.larguraUsMax) avisos.push(`Largura de pulso acima de ${LIMITES_META_TENS.larguraUsMax} µs, limite dos estudos do meta-TENS.`);
  // 60 mA é pico a pico; a corrente de pico por fase de um pulso simétrico equivale à metade só se bifásico simétrico — por isso só avisamos acima do valor cheio.
  if (args.picoMa && args.picoMa > LIMITES_META_TENS.picoAPicoMaMax) avisos.push(`Amplitude acima de ${LIMITES_META_TENS.picoAPicoMaMax} mA, limite pico a pico dos estudos do meta-TENS.`);
  return { dentro: avisos.length === 0, avisos };
}
