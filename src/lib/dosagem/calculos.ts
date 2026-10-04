// Cálculos de dosagem. Aqui só entra aritmética e definição física (joule =
// watt × segundo; intensidade = potência ÷ área; EFD acumulada etc.). Qualquer
// faixa clínica fica em protocolos.ts, com a fonte.

export const arredondar = (v: number, casas = 2) => {
  const f = 10 ** casas;
  return Math.round((v + Number.EPSILON) * f) / f;
};
const ok = (...n: (number | null | undefined)[]) => n.every((x) => typeof x === 'number' && Number.isFinite(x) && x > 0);

// ───────────────────────── Laser / fotobiomodulação ─────────────────────────

/** Energia por ponto (J) = potência (W) × tempo (s). Potência em mW. */
export const laserEnergiaPorPonto = (potenciaMw: number, tempoS: number) =>
  ok(potenciaMw, tempoS) ? (potenciaMw / 1000) * tempoS : null;

/** Tempo por ponto (s) para entregar uma energia alvo (J). */
export const laserTempoParaEnergia = (energiaJ: number, potenciaMw: number) =>
  ok(energiaJ, potenciaMw) ? energiaJ / (potenciaMw / 1000) : null;

/** Densidade de energia (J/cm²) = energia (J) ÷ área do feixe na pele (cm²). */
export const laserFluencia = (energiaJ: number, areaCm2: number) =>
  ok(energiaJ, areaCm2) ? energiaJ / areaCm2 : null;

/** Irradiância (mW/cm²) = potência (mW) ÷ área do feixe na pele (cm²). */
export const laserIrradiancia = (potenciaMw: number, areaCm2: number) =>
  ok(potenciaMw, areaCm2) ? potenciaMw / areaCm2 : null;

/**
 * Potência média de um laser pulsado (mW) = pico (mW) × largura do pulso (s)
 * × frequência (Hz). Os fabricantes de 904 nm costumam informar o pico: a dose
 * depende da média.
 */
export const potenciaMediaPulsada = (picoMw: number, larguraPulsoNs: number, freqHz: number) =>
  ok(picoMw, larguraPulsoNs, freqHz) ? picoMw * (larguraPulsoNs * 1e-9) * freqHz : null;

export type FaixaOnda = '780-860' | '904' | 'outra';
export const faixaComprimentoOnda = (nm: number): FaixaOnda => {
  if (nm >= 780 && nm <= 860) return '780-860';
  if (Math.abs(nm - 904) <= 10) return '904';
  return 'outra';
};

export type ModoLaser = 'continuo' | 'pulsado';

export interface JanelaLaser {
  /** 'qualquer' = a fonte vale para luz vermelha ou infravermelha, sem separar por faixa. */
  faixa: Exclude<FaixaOnda, 'outra'> | 'qualquer';
  /** Não aplicar o fator 4× do 904 nm contínuo (a fonte não separa por modo). */
  semFatorContinuo?: boolean;
  /** Mínimo por ponto (J). */
  minJ: number;
  /** Teto da faixa estudada (J), quando a fonte traz uma. */
  maxJ?: number;
  /** Dose sugerida como ponto de partida (mediana relatada ou o próprio mínimo). */
  sugeridaJ?: number;
  fontes: string[];
  nota?: string;
}

export type StatusDoseLaser = 'abaixo' | 'no_minimo' | 'dentro' | 'acima' | 'sem_referencia';

export interface AvaliacaoLaser {
  status: StatusDoseLaser;
  minJ?: number;
  maxJ?: number;
  fator?: number;
  fontes: string[];
  mensagem: string;
}

/**
 * Compara a energia por ponto com a janela da fonte. Em 904 nm contínuo a
 * recomendação (WALT, via Stausholm 2019) é 4× a dose do superpulsado.
 */
export function avaliarDoseLaser(args: { nm: number; modo: ModoLaser; energiaPontoJ: number | null; janelas: JanelaLaser[] }): AvaliacaoLaser {
  const { nm, modo, energiaPontoJ, janelas } = args;
  const faixa = faixaComprimentoOnda(nm);
  if (!energiaPontoJ) {
    return { status: 'sem_referencia', fontes: [], mensagem: 'Informe potência e tempo para comparar com a literatura.' };
  }
  const j = janelas.find((x) => x.faixa === faixa) ?? janelas.find((x) => x.faixa === 'qualquer');
  if (!j) {
    return {
      status: 'sem_referencia', fontes: [],
      mensagem: janelas.length === 0
        ? 'Sem dose por ponto confirmada na literatura levantada para esta condição. Use o protocolo do fabricante e registre a dose.'
        : 'Sem faixa de referência para este comprimento de onda nesta condição. Use o protocolo do fabricante e registre a dose.',
    };
  }
  const fator = faixa === '904' && modo === 'continuo' && !j.semFatorContinuo ? 4 : 1;
  const min = j.minJ * fator;
  const max = j.maxJ !== undefined ? j.maxJ * fator : undefined;
  const base = { minJ: min, maxJ: max, fator, fontes: j.fontes };
  if (energiaPontoJ < min) {
    return { ...base, status: 'abaixo', mensagem: `Abaixo do mínimo de ${arredondar(min, 1)} J por ponto. Doses abaixo do mínimo tiveram pouco ou nenhum efeito nos ensaios.` };
  }
  if (max !== undefined && energiaPontoJ > max) {
    return { ...base, status: 'acima', mensagem: `Acima da faixa estudada (${arredondar(min, 1)}–${arredondar(max, 1)} J por ponto). Não há evidência de benefício adicional; há indício de limite superior na osteoartrite de joelho.` };
  }
  if (max !== undefined) {
    return { ...base, status: 'dentro', mensagem: `Dentro da faixa estudada (${arredondar(min, 1)}–${arredondar(max, 1)} J por ponto).` };
  }
  return { ...base, status: 'no_minimo', mensagem: `Atinge o mínimo recomendado de ${arredondar(min, 1)} J por ponto.` };
}

// ───────────────────────────── Ultrassom terapêutico ─────────────────────────

/** Intensidade SATA (W/cm²) = potência (W) ÷ ERA (cm²). */
export const usIntensidadeSata = (potenciaW: number, eraCm2: number) =>
  ok(potenciaW, eraCm2) ? potenciaW / eraCm2 : null;

/** Potência efetiva (W) = intensidade SATA (W/cm²) × ERA (cm²). */
export const usPotenciaEfetiva = (sataWcm2: number, eraCm2: number) =>
  ok(sataWcm2, eraCm2) ? sataWcm2 * eraCm2 : null;

/** SATA no modo pulsado = intensidade de pico no pulso (SATP) × ciclo de trabalho. */
export const usSataPulsado = (satpWcm2: number, cicloPct: number) =>
  ok(satpWcm2, cicloPct) && cicloPct <= 100 ? satpWcm2 * (cicloPct / 100) : null;

/** Energia total entregue (J) = potência efetiva (W) × tempo (s). */
export const usEnergiaTotalJ = (potenciaEfetivaW: number, tempoMin: number) =>
  ok(potenciaEfetivaW, tempoMin) ? potenciaEfetivaW * tempoMin * 60 : null;

/** Quantas “ERAs” cabem na área tratada. */
export const usAreaEmEras = (areaCm2: number, eraCm2: number) =>
  ok(areaCm2, eraCm2) ? areaCm2 / eraCm2 : null;

/** Minutos gastos em cada área do tamanho de uma ERA (para comparar com a sua prática). */
export const usMinutosPorEra = (tempoMin: number, areaCm2: number, eraCm2: number) => {
  const eras = usAreaEmEras(areaCm2, eraCm2);
  return ok(tempoMin) && eras ? tempoMin / eras : null;
};

/**
 * Aquecimento medido por Draper, Castel e Castel (1995), tríceps sural de
 * adultos saudáveis, 10 min por dose, ultrassom contínuo (°C/min).
 */
export const TAXA_AQUECIMENTO: Record<1 | 3, { intensidade: number; taxa: number }[]> = {
  1: [{ intensidade: 0.5, taxa: 0.04 }, { intensidade: 1.0, taxa: 0.16 }, { intensidade: 1.5, taxa: 0.33 }, { intensidade: 2.0, taxa: 0.38 }],
  3: [{ intensidade: 0.5, taxa: 0.3 }, { intensidade: 1.0, taxa: 0.58 }, { intensidade: 1.5, taxa: 0.89 }, { intensidade: 2.0, taxa: 1.4 }],
};

/** Taxa de aquecimento (°C/min) por interpolação entre as doses estudadas; fora de 0,5–2,0 W/cm² não extrapola. */
export function taxaAquecimento(freqMhz: 1 | 3, sataWcm2: number): number | null {
  if (!ok(sataWcm2)) return null;
  const t = TAXA_AQUECIMENTO[freqMhz];
  if (sataWcm2 < t[0].intensidade || sataWcm2 > t[t.length - 1].intensidade) return null;
  for (let i = 0; i < t.length - 1; i++) {
    const a = t[i], b = t[i + 1];
    if (sataWcm2 >= a.intensidade && sataWcm2 <= b.intensidade) {
      const f = (sataWcm2 - a.intensidade) / (b.intensidade - a.intensidade);
      return a.taxa + f * (b.taxa - a.taxa);
    }
  }
  return null;
}

/** Tempo estimado (min) para elevar a temperatura em ΔT, dado o ritmo de aquecimento (°C/min). */
export const tempoParaAquecer = (deltaC: number, taxaCporMin: number | null) =>
  ok(deltaC, taxaCporMin) ? deltaC / (taxaCporMin as number) : null;

// ───────────────────────────── Ondas de choque ───────────────────────────────

/** Duração da sessão (s) = impulsos ÷ frequência (Hz). */
export const eswtTempoSessaoS = (impulsos: number, hz: number) => (ok(impulsos, hz) ? impulsos / hz : null);

/** EFD acumulada (mJ/mm²) = EFD × impulsos por sessão × sessões (Schmitz 2015). */
export const eswtEfdAcumulada = (efdMjMm2: number, impulsos: number, sessoes = 1) =>
  ok(efdMjMm2, impulsos, sessoes) ? efdMjMm2 * impulsos * sessoes : null;

/** Energia por impulso (mJ) = EFD (mJ/mm²) × área focal (mm²). A área vem do fabricante. */
export const eswtEnergiaPorImpulsoMj = (efdMjMm2: number, areaFocalMm2: number) =>
  ok(efdMjMm2, areaFocalMm2) ? efdMjMm2 * areaFocalMm2 : null;

// ───────────────────────────── Formatação ────────────────────────────────────

export const fmt = (v: number | null | undefined, casas = 2) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : arredondar(v, casas).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: casas });

export const fmtTempo = (segundos: number | null | undefined) => {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return '—';
  const s = Math.round(segundos);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r ? `${m} min ${r} s` : `${m} min`;
};
