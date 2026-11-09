// Cálculos puros da tela de EMG (sem React e sem DOM): decimação do gráfico ao vivo, escala
// automática, RMS recente, envelope do resultado e formatação de números em português.

import { envelopeRms, rms } from '@/lib/emg/metricas';

export const JANELA_GRAFICO_S = 5;
export const JANELA_RMS_VIVO_MS = 250;
export const ESCALA_MINIMA_UV = 10;

export interface ColunasMinMax {
  min: Float64Array;
  max: Float64Array;
}

/**
 * Reduz o sinal a uma faixa de mínimo e máximo por coluna de pixel. A janela tem `tamanhoJanela`
 * posições e o final do sinal fica encostado na direita (a amostra mais nova na última posição), como
 * num osciloscópio: sinal mais curto que a janela deixa a esquerda vazia. Coluna sem amostra e amostra
 * não finita ficam de fora (NaN no resultado para a coluna vazia).
 */
export function decimarMinMax(amostras: ArrayLike<number>, tamanhoJanela: number, colunas: number): ColunasMinMax {
  const n = Math.max(0, Math.floor(colunas));
  const min = new Float64Array(n).fill(Number.NaN);
  const max = new Float64Array(n).fill(Number.NaN);
  const total = amostras.length;
  if (n === 0 || total === 0 || !(tamanhoJanela >= 1)) return { min, max };
  const primeira = Math.max(0, total - tamanhoJanela);
  for (let i = primeira; i < total; i++) {
    const v = amostras[i];
    if (!Number.isFinite(v)) continue;
    const posicao = tamanhoJanela - (total - i);
    const coluna = Math.min(n - 1, Math.floor((posicao * n) / tamanhoJanela));
    if (Number.isNaN(min[coluna]) || v < min[coluna]) min[coluna] = v;
    if (Number.isNaN(max[coluna]) || v > max[coluna]) max[coluna] = v;
  }
  return { min, max };
}

/** Maior valor absoluto entre as amostras finitas (0 se não há nenhuma). */
export function maiorAbsoluto(amostras: ArrayLike<number>): number {
  let maior = 0;
  for (let i = 0; i < amostras.length; i++) {
    const v = Math.abs(amostras[i]);
    if (Number.isFinite(v) && v > maior) maior = v;
  }
  return maior;
}

/** Menor degrau "redondo" (1, 2 ou 5 vezes uma potência de 10) que é >= v. */
export function degrauRedondo(v: number): number {
  if (!(v > 0) || !Number.isFinite(v)) return 1;
  const potencia = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 5, 10]) {
    if (m * potencia >= v * (1 - 1e-12)) return m * potencia;
  }
  return 10 * potencia;
}

/**
 * Escala (meia faixa, em µV) do gráfico ao vivo. Sobe na hora quando o sinal pede e só desce quando o
 * sinal cabe com folga numa escala bem menor: sem isso a escala oscilaria a cada rajada.
 */
export function proximaEscala(atual: number | null, maiorAbs: number, minimo = ESCALA_MINIMA_UV): number {
  const alvo = degrauRedondo(Math.max(minimo, maiorAbs * 1.1));
  if (atual === null || alvo > atual) return alvo;
  if (alvo < atual * 0.45) return alvo;
  return atual;
}

/** RMS das últimas `ms` milissegundos de um buffer; null se ainda não há uma janela inteira. */
export function rmsRecente(
  buffer: { ultimas(n: number): Float64Array },
  fsHz: number,
  ms: number = JANELA_RMS_VIVO_MS,
): number | null {
  const n = Math.max(1, Math.round((fsHz * ms) / 1000));
  const amostras = buffer.ultimas(n);
  if (amostras.length < n) return null;
  return rms(amostras);
}

export interface EnvelopeDecimado {
  tempoS: number[];
  uv: number[];
  duracaoS: number;
}

/**
 * Envelope RMS (janela de `janelaMs`) reduzido a no máximo `maxPontos` pontos, guardando o maior valor
 * de cada grupo para não esconder um pico. Para o gráfico do resultado.
 */
export function envelopeParaGrafico(
  amostras: ArrayLike<number>,
  fsHz: number,
  janelaMs = 100,
  maxPontos = 400,
): EnvelopeDecimado {
  const n = amostras.length;
  if (n === 0 || !(fsHz > 0)) return { tempoS: [], uv: [], duracaoS: 0 };
  const envelope = envelopeRms(amostras, fsHz, janelaMs);
  const grupo = Math.max(1, Math.ceil(n / Math.max(1, maxPontos)));
  const tempoS: number[] = [];
  const uv: number[] = [];
  for (let i = 0; i < n; i += grupo) {
    let maior = 0;
    const fim = Math.min(n, i + grupo);
    for (let j = i; j < fim; j++) if (envelope[j] > maior) maior = envelope[j];
    tempoS.push((i + (fim - i) / 2) / fsHz);
    uv.push(maior);
  }
  return { tempoS, uv, duracaoS: n / fsHz };
}

/** Número com vírgula decimal. */
export function numeroPt(v: number, casas: number): string {
  if (!Number.isFinite(v)) return '—';
  return v.toFixed(casas).replace('.', ',');
}

/** µV com 1 casa abaixo de 100 e sem casas a partir daí. */
export function uvPt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return numeroPt(v, Math.abs(v) >= 100 ? 0 : 1);
}

export function pctPt(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return numeroPt(v, 0);
}

/** Data de hoje (aaaa-mm-dd) no calendário local, não em UTC: à noite o UTC já é o dia seguinte no Brasil. */
export function dataLocalISO(d: Date = new Date()): string {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Texto seguro para nome de arquivo: minúsculo, sem acento e com hífens. */
export function nomeParaArquivo(texto: string): string {
  const base = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  // O corte pode cair logo depois de um hífen: tira o que sobrar.
  return base.slice(0, 40).replace(/-+$/, '');
}

// ---------------------------------------------------------------------------
// Canvas do gráfico ao vivo
// ---------------------------------------------------------------------------

export interface CoresGrafico {
  tracado: string;
  grade: string;
  zero: string;
}

const CORES_CLARO: CoresGrafico = { tracado: '#1e3a5f', grade: '#d6dbe4', zero: '#8a93a3' };
const CORES_ESCURO: CoresGrafico = { tracado: '#f5b82e', grade: '#3a3f4b', zero: '#7d8596' };

function corDoToken(nome: string): string | null {
  try {
    const bruto = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
    // Os tokens do tema são "H S% L%" (sem hsl()): o canvas entende a forma com vírgulas em qualquer navegador.
    const partes = /^([\d.]+)\s+([\d.]+%)\s+([\d.]+%)$/.exec(bruto);
    return partes ? `hsl(${partes[1]}, ${partes[2]}, ${partes[3]})` : null;
  } catch {
    // Sem getComputedStyle (ambiente sem DOM completo): usa as cores de reserva.
    return null;
  }
}

/** Cores do gráfico a partir dos tokens do tema atual (claro ou escuro), com reserva se o CSS não está disponível. */
export function lerCoresDoTema(): CoresGrafico {
  const escuro = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const reserva = escuro ? CORES_ESCURO : CORES_CLARO;
  if (typeof document === 'undefined') return reserva;
  return {
    tracado: corDoToken('--primary') ?? reserva.tracado,
    grade: corDoToken('--border') ?? reserva.grade,
    zero: corDoToken('--muted-foreground') ?? reserva.zero,
  };
}

export interface ParametrosDesenho {
  /** Largura e altura em pixels CSS (o chamador já aplicou a escala do dispositivo no contexto). */
  largura: number;
  altura: number;
  amostras: ArrayLike<number>;
  /** Quantas amostras cabem na janela inteira (taxa x segundos). */
  tamanhoJanela: number;
  janelaS: number;
  /** Meia faixa vertical, em µV. */
  escala: number;
  cores: CoresGrafico;
}

/** Desenha grade, linha do zero e o traçado (um segmento vertical de mínimo a máximo por coluna de pixel). */
export function desenharSinal(ctx: CanvasRenderingContext2D, p: ParametrosDesenho): void {
  const { largura, altura, escala, cores } = p;
  ctx.clearRect(0, 0, largura, altura);
  const meio = altura / 2;
  const yDe = (uv: number): number => Math.min(altura, Math.max(0, meio - (uv / escala) * (meio - 2)));

  ctx.lineWidth = 1;
  ctx.strokeStyle = cores.grade;
  ctx.beginPath();
  for (let s = 1; s < p.janelaS; s++) {
    const x = Math.round((s / p.janelaS) * largura) + 0.5;
    ctx.moveTo(x, 0);
    ctx.lineTo(x, altura);
  }
  for (const fracao of [-0.5, 0.5]) {
    const y = Math.round(yDe(fracao * escala)) + 0.5;
    ctx.moveTo(0, y);
    ctx.lineTo(largura, y);
  }
  ctx.stroke();

  ctx.strokeStyle = cores.zero;
  ctx.beginPath();
  ctx.moveTo(0, Math.round(meio) + 0.5);
  ctx.lineTo(largura, Math.round(meio) + 0.5);
  ctx.stroke();

  const colunas = Math.max(1, Math.floor(largura));
  const { min, max } = decimarMinMax(p.amostras, p.tamanhoJanela, colunas);
  ctx.strokeStyle = cores.tracado;
  ctx.beginPath();
  for (let c = 0; c < colunas; c++) {
    if (Number.isNaN(min[c])) continue;
    const x = c + 0.5;
    let topo = yDe(max[c]);
    let base = yDe(min[c]);
    if (base - topo < 1) {
      topo -= 0.5;
      base += 0.5;
    }
    ctx.moveTo(x, topo);
    ctx.lineTo(x, base);
  }
  ctx.stroke();
}
