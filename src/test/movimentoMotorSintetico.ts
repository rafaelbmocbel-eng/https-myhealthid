import { aleatorio } from '../lib/angular/video/figuraSintetica';
import type { EventoPasso } from '../lib/angular/video/eventos';
import type { Lado, PontoPose, QuadroPose, TrilhaPose } from '../lib/angular/video/tipos';

/*
 * Geradores sintéticos de trilha para os testes do motor da Etapa 3 (movimento): agachamento de lado e de frente e marcha, com
 * parâmetros por lado e por repetição (assimetria, tendência, valgo, desvio da pelve, tempo de apoio) e ruído gaussiano determinístico.
 * Nada aqui é dado clínico: são curvas suaves inventadas, com instantes conhecidos, só para exercitar os algoritmos. Mundo em metros
 * (x para a frente do paciente, y para cima); a imagem tem y para baixo. Fica em src/test porque nenhum código de produção o importa.
 */

const RAD = Math.PI / 180;
const L1 = 0.45, L2 = 0.45, LT = 0.52;
const ALTURA_TORNOZELO = 0.08;
const PE = { atras: 0.06, abaixo: 0.08, frente: 0.17 };

interface V { x: number; y: number }
type PontosMundo = Record<string, V>;

export interface BaseSintetica {
  fps?: number;
  largura?: number;
  altura?: number;
  /** +1: o paciente olha/anda para a direita da imagem (vista lateral). */
  direcao?: 1 | -1;
  /** Desvio aproximado do ruído, em pixels, somado a cada coordenada de cada ponto. */
  ruidoPx?: number;
  semente?: number;
  confianca?: number;
  /** Pontos que o detector perde: nomes dos pontos num quadro (ou true para o quadro inteiro). */
  perdidos?: (i: number, t: number) => string[] | boolean;
}

function aGaussiano(semente: number): () => number {
  const rnd = aleatorio(semente);
  return () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
}

const METROS_NA_ALTURA = 2.2;

function montarTrilha(
  b: Required<Pick<BaseSintetica, 'fps' | 'largura' | 'altura' | 'direcao' | 'ruidoPx' | 'semente' | 'confianca'>> & Pick<BaseSintetica, 'perdidos'>,
  duracao: number,
  pontosEm: (t: number) => PontosMundo,
  colunaX: number,
): TrilhaPose {
  const n = Math.max(1, Math.floor(duracao * b.fps));
  const ppm = b.altura / METROS_NA_ALTURA;
  const g = aGaussiano(b.semente);
  const quadros: QuadroPose[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / b.fps;
    const mundo = pontosEm(t);
    const perda = b.perdidos?.(i, t);
    const pontos: Record<string, PontoPose> = {};
    if (perda !== true) {
      for (const [nome, p] of Object.entries(mundo)) {
        if (Array.isArray(perda) && perda.includes(nome)) continue;
        const x = b.largura * colunaX + b.direcao * p.x * ppm + (b.ruidoPx > 0 ? g() * b.ruidoPx : 0);
        const y = 0.92 * b.altura - p.y * ppm + (b.ruidoPx > 0 ? g() * b.ruidoPx : 0);
        pontos[nome] = { x, y, conf: b.confianca };
      }
    }
    quadros.push({ i, t, pontos });
  }
  return { fps: b.fps, largura: b.largura, altura: b.altura, quadros };
}

const padrao = (b: BaseSintetica) => ({
  fps: b.fps ?? 30, largura: b.largura ?? 640, altura: b.altura ?? 480, direcao: b.direcao ?? 1, ruidoPx: b.ruidoPx ?? 0,
  semente: b.semente ?? 1, confianca: b.confianca ?? 0.95, perdidos: b.perdidos,
});

const soma = (a: V, k: number, d: V): V => ({ x: a.x + k * d.x, y: a.y + k * d.y });
const abaixo = (g: number): V => ({ x: Math.sin(g * RAD), y: -Math.cos(g * RAD) });
const acima = (g: number): V => ({ x: Math.sin(g * RAD), y: Math.cos(g * RAD) });

function cabecaLateral(m: PontosMundo, ombro: V, lean: number): void {
  const cabeca = soma(ombro, 0.2, acima(lean));
  m.nariz = { x: cabeca.x + 0.11, y: cabeca.y - 0.01 };
  m.orelha_d = { x: cabeca.x - 0.02, y: cabeca.y };
  m.orelha_e = { x: cabeca.x - 0.02, y: cabeca.y };
}

// ---------- agachamento de lado ----------

export interface ConfigAgachamentoLateral extends BaseSintetica {
  reps?: number;
  /** Duração de uma repetição, em segundos. */
  periodo?: number;
  /** Tempo em pé antes da primeira e depois da última repetição. */
  repouso?: number;
  /** Flexão máxima do joelho (°) por lado e repetição (r de 0 em diante). */
  flexao?: (lado: Lado, r: number) => number;
  /** Dorsiflexão máxima (°) por lado e repetição. */
  dorsiflexao?: (lado: Lado, r: number) => number;
}

export interface VerdadeAgachamento {
  duracao: number;
  /** Início, fundo e fim de cada repetição, em segundos. */
  inicio: number[];
  fundo: number[];
  fim: number[];
}

export function verdadeAgachamento(c: { reps?: number; periodo?: number; repouso?: number }): VerdadeAgachamento {
  const reps = c.reps ?? 5, T = c.periodo ?? 3, r0 = c.repouso ?? 1;
  return {
    duracao: 2 * r0 + reps * T,
    inicio: Array.from({ length: reps }, (_, r) => r0 + r * T),
    fundo: Array.from({ length: reps }, (_, r) => r0 + r * T + T / 2),
    fim: Array.from({ length: reps }, (_, r) => r0 + (r + 1) * T),
  };
}

/** Fase do agachamento no instante t: índice da repetição (−1 em pé) e u de 0 (em pé) a 1 (fundo). */
function faseAgachamento(t: number, reps: number, T: number, r0: number): { r: number; u: number } {
  if (t < r0 || t >= r0 + reps * T) return { r: -1, u: 0 };
  const r = Math.floor((t - r0) / T);
  return { r, u: (1 - Math.cos((2 * Math.PI * (t - r0 - r * T)) / T)) / 2 };
}

export function trilhaAgachamentoLateral(c: ConfigAgachamentoLateral = {}): TrilhaPose {
  const reps = c.reps ?? 5, T = c.periodo ?? 3, r0 = c.repouso ?? 1;
  const flexao = c.flexao ?? (() => 105);
  const dorsi = c.dorsiflexao ?? (() => 25);
  const duracao = verdadeAgachamento(c).duracao;
  const pontosEm = (t: number): PontosMundo => {
    const { r, u } = faseAgachamento(t, reps, T, r0);
    const m: PontosMundo = {};
    const quadris: V[] = [];
    for (const lado of ['D', 'E'] as const) {
      const s = lado.toLowerCase();
      const k = r < 0 ? 0 : flexao(lado, r) * u, a = r < 0 ? 0 : dorsi(lado, r) * u;
      const tornozelo = { x: 0, y: ALTURA_TORNOZELO };
      const joelho = soma(tornozelo, L2, acima(a));
      const quadril = soma(joelho, -L1, abaixo(k - a));
      m[`tornozelo_${s}`] = tornozelo; m[`joelho_${s}`] = joelho; m[`quadril_${s}`] = quadril;
      m[`calcanhar_${s}`] = { x: tornozelo.x - PE.atras, y: tornozelo.y - PE.abaixo };
      m[`pe_${s}`] = { x: tornozelo.x + PE.frente, y: tornozelo.y - PE.abaixo };
      quadris.push(quadril);
    }
    const lean = 8 + 22 * u;
    const centro = { x: (quadris[0].x + quadris[1].x) / 2, y: (quadris[0].y + quadris[1].y) / 2 };
    const ombro = soma(centro, LT, acima(lean));
    m.ombro_d = ombro; m.ombro_e = ombro;
    cabecaLateral(m, ombro, lean);
    return m;
  };
  return montarTrilha(padrao(c), duracao, pontosEm, 0.5);
}

/** Valores conhecidos no fundo de uma repetição (por lado), para conferir a análise contra a construção da figura. */
export function verdadeFundoLateral(flexao: number, dorsiflexao: number): { avancoPct: number; profundidadePct: number } {
  const joelhoX = L2 * Math.sin(dorsiflexao * RAD);
  const theta = flexao - dorsiflexao;
  return {
    avancoPct: ((joelhoX - PE.frente) / (PE.frente + PE.atras)) * 100,
    profundidadePct: -Math.cos(theta * RAD) * 100,
  };
}

// ---------- agachamento de frente ----------

export interface ConfigAgachamentoFrontal extends BaseSintetica {
  reps?: number;
  periodo?: number;
  repouso?: number;
  /** Descida do quadril (m) por repetição. */
  descida?: (r: number) => number;
  /** Deslocamento medial do joelho (m) por lado e repetição: positivo = joelho para dentro. */
  medial?: (lado: Lado, r: number) => number;
  /** Deslocamento da pelve (m) por repetição: positivo = para o lado direito do paciente. */
  pelve?: (r: number) => number;
  /** Paciente visto de costas: o lado direito dele fica à direita da imagem. */
  deCostas?: boolean;
}

export function trilhaAgachamentoFrontal(c: ConfigAgachamentoFrontal = {}): TrilhaPose {
  const reps = c.reps ?? 5, T = c.periodo ?? 3, r0 = c.repouso ?? 1;
  const descida = c.descida ?? (() => 0.3);
  const medial = c.medial ?? (() => 0.02);
  const pelve = c.pelve ?? (() => 0);
  const duracao = verdadeAgachamento(c).duracao;
  const ladoDireito = c.deCostas ? 1 : -1;
  const sinalDe = (lado: Lado) => (lado === 'D' ? ladoDireito : -ladoDireito);
  const pontosEm = (t: number): PontosMundo => {
    const { r, u } = faseAgachamento(t, reps, T, r0);
    const m: PontosMundo = {};
    const hy = ALTURA_TORNOZELO + 0.86 - (r < 0 ? 0 : descida(r) * u);
    const deslocPelve = r < 0 ? 0 : ladoDireito * pelve(r) * u;
    for (const lado of ['D', 'E'] as const) {
      const s = lado.toLowerCase(), sg = sinalDe(lado);
      const quadril = { x: sg * 0.1 + deslocPelve, y: hy };
      const tornozelo = { x: sg * 0.15, y: ALTURA_TORNOZELO };
      const para = r < 0 ? 0 : medial(lado, r) * u;
      m[`quadril_${s}`] = quadril;
      m[`tornozelo_${s}`] = tornozelo;
      m[`joelho_${s}`] = { x: (quadril.x + tornozelo.x) / 2 - sg * para, y: (quadril.y + tornozelo.y) / 2 };
      m[`calcanhar_${s}`] = { x: tornozelo.x, y: 0 };
      m[`pe_${s}`] = { x: tornozelo.x + sg * 0.03, y: 0 };
      m[`ombro_${s}`] = { x: sg * 0.19 + deslocPelve, y: hy + LT };
    }
    const cabeca = { x: deslocPelve, y: hy + LT + 0.2 };
    m.nariz = { x: cabeca.x, y: cabeca.y - 0.01 };
    m.orelha_d = { x: cabeca.x + ladoDireito * 0.09, y: cabeca.y };
    m.orelha_e = { x: cabeca.x - ladoDireito * 0.09, y: cabeca.y };
    return m;
  };
  return montarTrilha(padrao(c), duracao, pontosEm, 0.5);
}

// ---------- marcha ----------

export interface ConfigMarcha extends BaseSintetica {
  duracao?: number;
  /** Duração da passada (um pé até o mesmo pé), em segundos. */
  passada?: number;
  /** Fração da passada em apoio, por pé. */
  apoio?: Record<Lado, number>;
  /** Altura do pé no balanço (m), por pé. */
  elevacao?: Record<Lado, number>;
  /** Velocidade do paciente (m/s): define o deslocamento do pé em relação à pelve no apoio. */
  velocidade?: number;
}

export interface VerdadeMarcha {
  eventos: EventoPasso[];
  /** Tempo de apoio verdadeiro (s) por pé. */
  tempoApoio: Record<Lado, number>;
}

const fracao = (x: number) => x - Math.floor(x);

function pernaMarcha(cfg: Required<Pick<ConfigMarcha, 'passada' | 'velocidade'>> & { apoio: Record<Lado, number>; elevacao: Record<Lado, number> }, lado: Lado, t: number, quadril: V): { tornozelo: V; joelho: V } {
  const T = cfg.passada, ps = cfg.apoio[lado];
  const fase = fracao(t / T + (lado === 'E' ? 0.5 : 0));
  const A = (cfg.velocidade * ps * T) / 2;
  let x: number, y = ALTURA_TORNOZELO;
  if (fase < ps) x = A - 2 * A * (fase / ps);
  else {
    const s = (fase - ps) / (1 - ps);
    x = -A + 2 * A * ((1 - Math.cos(Math.PI * s)) / 2);
    y += cfg.elevacao[lado] * Math.sin(Math.PI * s);
  }
  const tornozelo = { x: quadril.x + x, y };
  const dx = tornozelo.x - quadril.x, dy = tornozelo.y - quadril.y;
  const d = Math.min(Math.hypot(dx, dy), (L1 + L2) * 0.999);
  const base = Math.atan2(dy, dx);
  const delta = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const joelho = { x: quadril.x + L1 * Math.cos(base + delta), y: quadril.y + L1 * Math.sin(base + delta) };
  return { tornozelo, joelho };
}

export function trilhaMarcha(c: ConfigMarcha = {}): TrilhaPose {
  const cfg = {
    passada: c.passada ?? 1.1, velocidade: c.velocidade ?? 1,
    apoio: c.apoio ?? { D: 0.6, E: 0.6 }, elevacao: c.elevacao ?? { D: 0.12, E: 0.12 },
  };
  const quadril = { x: 0, y: 0.88 };
  const pontosEm = (t: number): PontosMundo => {
    const m: PontosMundo = {};
    for (const lado of ['D', 'E'] as const) {
      const s = lado.toLowerCase();
      const { tornozelo, joelho } = pernaMarcha(cfg, lado, t, quadril);
      m[`quadril_${s}`] = quadril; m[`joelho_${s}`] = joelho; m[`tornozelo_${s}`] = tornozelo;
      m[`calcanhar_${s}`] = { x: tornozelo.x - PE.atras, y: tornozelo.y - PE.abaixo };
      m[`pe_${s}`] = { x: tornozelo.x + PE.frente, y: tornozelo.y - PE.abaixo };
    }
    const lean = 5;
    const ombro = soma(quadril, LT, acima(lean));
    m.ombro_d = ombro; m.ombro_e = ombro;
    cabecaLateral(m, ombro, lean);
    return m;
  };
  return montarTrilha(padrao(c), c.duracao ?? 12, pontosEm, 0.5);
}

/**
 * Eventos de contato e saída do pé como o profissional os confirmaria: o contato abre cada passada (fase 0 do pé) e a saída vem
 * ao fim do apoio. Os índices são do quadro mais próximo; `tFino` guarda o instante exato.
 */
export function eventosVerdadeMarcha(c: ConfigMarcha = {}): VerdadeMarcha {
  const T = c.passada ?? 1.1, fps = c.fps ?? 30, dur = c.duracao ?? 12;
  const apoio = c.apoio ?? { D: 0.6, E: 0.6 };
  const eventos: EventoPasso[] = [];
  const nQuadros = Math.floor(dur * fps);
  for (const lado of ['D', 'E'] as const) {
    const desloc = lado === 'E' ? T / 2 : 0;
    for (let k = 0; ; k++) {
      const tc = desloc + k * T, ts = tc + apoio[lado] * T;
      const ic = Math.round(tc * fps), is = Math.round(ts * fps);
      if (ic >= nQuadros) break;
      eventos.push({ id: `${lado}-contato-${ic}`, lado, tipo: 'contato', i: ic, t: ic / fps, sugerido: false, tFino: tc });
      if (is < nQuadros) eventos.push({ id: `${lado}-saida-${is}`, lado, tipo: 'saida', i: is, t: is / fps, sugerido: false, tFino: ts });
    }
  }
  eventos.sort((a, b) => a.i - b.i || (a.lado < b.lado ? -1 : 1));
  return { eventos, tempoApoio: { D: apoio.D * T, E: apoio.E * T } };
}
