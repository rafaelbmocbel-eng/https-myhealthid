import type { Landmark } from '../pose';
import { PONTOS_MEDIAPIPE, type DetectorQuadro, type Lado, type TrilhaPose } from './tipos';
import { criarTrilha, pontosDeLandmarks } from './trilha';

/*
 * Figura articulada sintética com ângulos conhecidos, para testes: gera os 33 pontos de pose (como o MediaPipe) a partir de ângulos
 * articulares prescritos, e devolve também a "verdade" de cada ângulo no mesmo instante. Nada aqui é dado clínico: as curvas são
 * formas suaves inventadas só para exercitar os algoritmos (picos, eventos, simetria), com tempos e amplitudes configuráveis.
 * Convenções: mundo em metros (x para a frente do paciente, y para cima); a imagem tem y para baixo. Com `direcao` = −1 a cena é espelhada.
 */

export type GestoSintetico = 'marcha' | 'corrida' | 'agachamento' | 'salto' | 'ombro';

export interface ConfigFigura {
  gesto: GestoSintetico;
  largura: number;
  altura: number;
  /** +1: o paciente anda/olha para a direita da imagem. */
  direcao: 1 | -1;
  /** Marcha e corrida: câmera parada (o paciente atravessa o quadro) em vez de acompanhar o paciente. */
  cameraFixa: boolean;
  /** Metros do mundo que cabem na altura da imagem (define o tamanho do boneco). */
  metrosNaAltura: number;
  visibilidade: number;

  /** Marcha e corrida: duração da passada (um pé até o mesmo pé), em segundos. */
  tempoPassada: number;
  /** Marcha: fração da passada em apoio. */
  apoio: number;
  /** Marcha e corrida: atraso do contato do pé E, em fração da passada, além de meia passada (cria assimetria no tempo do passo). */
  atrasoE: number;
  /** Corrida: tempo de contato de cada pé, em segundos. */
  tempoContato: { D: number; E: number };
  /** Marcha em câmera fixa e corrida: velocidade do paciente em m/s. */
  velocidade: number;

  /** Agachamento e ombro: duração de uma repetição. */
  periodo: number;
  /** Agachamento: flexão máxima do joelho (°) e dorsiflexão máxima (°). */
  flexaoMax: number;
  dorsiflexaoMax: number;

  /** Salto: instante da decolagem e duração do voo (s); deslocamento medial máximo do joelho em cada lado (m). */
  inicioSalto: number;
  voo: number;
  valgoMax: { D: number; E: number };

  /** Ombro: elevação máxima de cada braço (°) e inclinação lateral do tronco no pico (°, + para a direita da imagem). */
  elevacaoMax: { D: number; E: number };
  compensacao: number;
}

export function configurar(gesto: GestoSintetico, mudancas: Partial<ConfigFigura> = {}): ConfigFigura {
  const base: ConfigFigura = {
    gesto, largura: 640, altura: 480, direcao: 1, cameraFixa: false, metrosNaAltura: 2.2, visibilidade: 0.97,
    tempoPassada: 1.1, apoio: 0.6, atrasoE: 0, tempoContato: { D: 0.22, E: 0.22 }, velocidade: 1.2,
    periodo: 3, flexaoMax: 105, dorsiflexaoMax: 25,
    inicioSalto: 0.8, voo: 0.5, valgoMax: { D: 0.035, E: 0.02 },
    elevacaoMax: { D: 160, E: 140 }, compensacao: 6,
  };
  if (gesto === 'corrida') Object.assign(base, { tempoPassada: 0.7, velocidade: 3 });
  return { ...base, ...mudancas };
}

// ---------- utilitários ----------

const RAD = Math.PI / 180;
interface V { x: number; y: number }
const L1 = 0.45, L2 = 0.45, LT = 0.52, LUA = 0.3, LFA = 0.26;
const PE_AO_TORNOZELO = { atras: 0.06, abaixo: 0.08, frente: 0.17 };
const ALTURA_TORNOZELO = 0.08;

const fracao = (x: number) => x - Math.floor(x);
const suave = (u: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;
const onda = (p: number, centro: number, largura: number) => {
  let d = Math.abs(p - centro);
  d = Math.min(d, 1 - d);
  return Math.exp(-0.5 * (d / largura) ** 2);
};
const soma = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
const mais = (a: V, k: number, dir: V): V => ({ x: a.x + k * dir.x, y: a.y + k * dir.y });
/** Vetor unitário a `graus` da vertical para baixo, positivo para a frente. */
const abaixo = (graus: number): V => ({ x: Math.sin(graus * RAD), y: -Math.cos(graus * RAD) });
const acima = (graus: number): V => ({ x: Math.sin(graus * RAD), y: Math.cos(graus * RAD) });

/** Verdade dos ângulos num instante, nas mesmas convenções das definições de `angulos.ts`. */
export type VerdadeQuadro = Record<string, number>;

export interface PoseSintetica {
  landmarks: Landmark[];
  verdade: VerdadeQuadro;
  /** Pontos no mundo, em metros (para conferir geometria). */
  mundo: Record<string, V>;
}

// ---------- esqueleto lateral por cinemática direta ----------

interface PosturaLateral {
  pelvis: V;
  /** Inclinação do tronco para a frente, em graus. */
  tronco: number;
  /** Ângulo da coxa (quadril → joelho) com a vertical para baixo, positivo para a frente. */
  coxa: Record<Lado, number>;
  /** Flexão do joelho. */
  joelho: Record<Lado, number>;
  /** Pé: ângulo absoluto do eixo calcanhar → ponta com a horizontal (phi) ou ângulo entre a perna e o eixo do pé (beta). */
  pe: Record<Lado, { phi?: number; beta?: number }>;
  /** Ombro: ângulo do braço com a vertical para baixo; cotovelo: flexão. */
  braco: Record<Lado, { ombro: number; cotovelo: number }>;
}

function esqueletoLateral(c: PosturaLateral): { mundo: Record<string, V>; verdade: VerdadeQuadro } {
  const m: Record<string, V> = {};
  const verdade: VerdadeQuadro = { tronco: c.tronco };
  const dirTronco = acima(c.tronco);
  const ombro = mais(c.pelvis, LT, dirTronco);
  const cabeca = mais(ombro, 0.2, dirTronco);
  m.quadril_d = c.pelvis; m.quadril_e = c.pelvis; m.ombro_d = ombro; m.ombro_e = ombro;
  m.nariz = soma(cabeca, { x: 0.11, y: -0.01 });
  m.olho_d = m.olho_e = soma(cabeca, { x: 0.07, y: 0.03 });
  m.olho_d_int = m.olho_e_int = soma(cabeca, { x: 0.05, y: 0.03 });
  m.olho_d_ext = m.olho_e_ext = soma(cabeca, { x: 0.09, y: 0.03 });
  m.orelha_d = m.orelha_e = soma(cabeca, { x: -0.02, y: 0 });
  m.boca_d = m.boca_e = soma(cabeca, { x: 0.075, y: -0.05 });

  for (const lado of ['D', 'E'] as const) {
    const s = lado.toLowerCase();
    const th = c.coxa[lado], k = c.joelho[lado];
    const joelho = mais(c.pelvis, L1, abaixo(th));
    const psi = th - k;
    const tornozelo = mais(joelho, L2, abaixo(psi));
    const paraCima = { x: -(tornozelo.x - joelho.x) / L2, y: -(tornozelo.y - joelho.y) / L2 };
    const { phi, beta } = c.pe[lado];
    let dir: V;
    if (phi !== undefined) dir = { x: Math.cos(phi), y: Math.sin(phi) };
    else {
      const b = (beta ?? 90) * RAD;
      dir = { x: paraCima.x * Math.cos(-b) - paraCima.y * Math.sin(-b), y: paraCima.x * Math.sin(-b) + paraCima.y * Math.cos(-b) };
    }
    const perp = { x: -dir.y, y: dir.x };
    const calcanhar = mais(mais(tornozelo, -PE_AO_TORNOZELO.atras, dir), -PE_AO_TORNOZELO.abaixo, perp);
    const ponta = mais(mais(tornozelo, PE_AO_TORNOZELO.frente, dir), -PE_AO_TORNOZELO.abaixo, perp);
    m[`joelho_${s}`] = joelho; m[`tornozelo_${s}`] = tornozelo; m[`calcanhar_${s}`] = calcanhar; m[`pe_${s}`] = ponta;

    const { ombro: so, cotovelo: ce } = c.braco[lado];
    const cot = mais(ombro, LUA, abaixo(so));
    const pun = mais(cot, LFA, abaixo(so + ce));
    m[`cotovelo_${s}`] = cot; m[`punho_${s}`] = pun;

    const cosBeta = paraCima.x * (ponta.x - calcanhar.x) + paraCima.y * (ponta.y - calcanhar.y);
    const comp = Math.hypot(ponta.x - calcanhar.x, ponta.y - calcanhar.y);
    const betaReal = (Math.acos(Math.min(1, Math.max(-1, cosBeta / comp))) * 180) / Math.PI;
    verdade[`joelho_${s}`] = k;
    verdade[`coxa_${s}`] = th;
    verdade[`tibia_${s}`] = psi;
    verdade[`quadril_${s}`] = th + c.tronco;
    verdade[`tornozelo_${s}`] = 90 - betaReal;
  }
  return { mundo: m, verdade };
}

// ---------- gestos ----------

const cabecaLateralZero = { ombro: 0, cotovelo: 20 };

function marcha(cfg: ConfigFigura, t: number): { postura: PosturaLateral; xPelve: number } {
  const T = cfg.tempoPassada;
  const p: Record<Lado, number> = { D: fracao(t / T), E: fracao(t / T + 0.5 - cfg.atrasoE) };
  const quadril = (q: number) => {
    const flex = 28, ext = -14;
    return q < cfg.apoio ? flex + (ext - flex) * suave(q / cfg.apoio) : ext + (flex - ext) * suave((q - cfg.apoio) / (1 - cfg.apoio));
  };
  const joelho = (q: number) => 4 + 12 * onda(q, 0.13, 0.05) + 56 * onda(q, 0.72, 0.08);
  const dorsi = (q: number) => 5 * onda(q, 0.38, 0.12) - 14 * onda(q, 0.62, 0.05) - 3 * onda(q, 0.03, 0.03);
  const coxa = { D: quadril(p.D), E: quadril(p.E) };
  const swing = { D: -0.5 * coxa.E, E: -0.5 * coxa.D };
  return {
    xPelve: cfg.velocidade * t,
    postura: {
      pelvis: { x: 0, y: ALTURA_TORNOZELO + 0.86 },
      tronco: 5 + 2 * Math.sin((2 * Math.PI * t) / (T / 2)),
      coxa,
      joelho: { D: joelho(p.D), E: joelho(p.E) },
      pe: { D: { beta: 90 - dorsi(p.D) }, E: { beta: 90 - dorsi(p.E) } },
      braco: { D: { ombro: swing.D, cotovelo: 20 }, E: { ombro: swing.E, cotovelo: 20 } },
    },
  };
}

interface PernaIK { theta: number; k: number; phi: number }

function pernaCorrida(cfg: ConfigFigura, t: number, lado: Lado, pelvis: V): PernaIK {
  const T = cfg.tempoPassada, v = cfg.velocidade, tc = cfg.tempoContato[lado];
  const desloc = lado === 'D' ? 0 : T / 2 + cfg.atrasoE * T;
  const k = Math.floor((t - desloc) / T);
  const u = t - desloc - k * T;
  const xPlantado = (n: number) => v * (desloc + n * T + tc / 2);
  let alvo: V;
  let phi = 0;
  if (u < tc) alvo = { x: xPlantado(k), y: ALTURA_TORNOZELO };
  else {
    const s = (u - tc) / (T - tc);
    alvo = { x: xPlantado(k) + v * T * suave(s), y: ALTURA_TORNOZELO + 0.4 * Math.sin(Math.PI * s) };
    phi = -0.35 * Math.sin(Math.PI * s);
  }
  const dx = alvo.x - pelvis.x, dy = alvo.y - pelvis.y;
  const d = Math.min(Math.hypot(dx, dy), (L1 + L2) * 0.999);
  const gama = Math.atan2(dx, -dy);
  const delta = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d))));
  const interno = Math.acos(Math.min(1, Math.max(-1, (L1 * L1 + L2 * L2 - d * d) / (2 * L1 * L2))));
  return { theta: ((gama + delta) * 180) / Math.PI, k: ((Math.PI - interno) * 180) / Math.PI, phi };
}

function corrida(cfg: ConfigFigura, t: number): { postura: PosturaLateral; xPelve: number } {
  const T = cfg.tempoPassada;
  const tcMedio = (cfg.tempoContato.D + cfg.tempoContato.E) / 2;
  const oscilacao = 0.04;
  const y = ALTURA_TORNOZELO + 0.82 - (oscilacao / 2) * Math.cos((2 * Math.PI * (t - tcMedio / 2)) / (T / 2));
  const pelvis = { x: cfg.velocidade * t, y };
  const D = pernaCorrida(cfg, t, 'D', pelvis), E = pernaCorrida(cfg, t, 'E', pelvis);
  const swing = { D: -0.5 * E.theta, E: -0.5 * D.theta };
  return {
    xPelve: pelvis.x,
    postura: {
      pelvis: { x: 0, y },
      tronco: 8 + Math.sin((2 * Math.PI * t) / (T / 2)),
      coxa: { D: D.theta, E: E.theta },
      joelho: { D: D.k, E: E.k },
      pe: { D: { phi: D.phi }, E: { phi: E.phi } },
      braco: { D: { ombro: swing.D, cotovelo: 90 }, E: { ombro: swing.E, cotovelo: 90 } },
    },
  };
}

function agachamento(cfg: ConfigFigura, t: number): PosturaLateral {
  const u = (1 - Math.cos((2 * Math.PI * t) / cfg.periodo)) / 2;
  const k = cfg.flexaoMax * u, a = cfg.dorsiflexaoMax * u;
  const lean = 8 + 22 * u;
  const tornozelo = { x: 0, y: ALTURA_TORNOZELO };
  const joelho = mais(tornozelo, L2, acima(a));
  const theta = k - a;
  const quadril = mais(joelho, -L1, abaixo(theta));
  return {
    pelvis: quadril, tronco: lean,
    coxa: { D: theta, E: theta }, joelho: { D: k, E: k },
    pe: { D: { phi: 0 }, E: { phi: 0 } },
    braco: { D: { ombro: 60 * u, cotovelo: 0 }, E: { ombro: 60 * u, cotovelo: 0 } },
  };
}

// ---------- esqueleto frontal ----------

function frontal(cfg: ConfigFigura, t: number): { mundo: Record<string, V>; verdade: VerdadeQuadro } {
  const m: Record<string, V> = {};
  const verdade: VerdadeQuadro = {};
  const sinal: Record<Lado, number> = { D: -1, E: 1 };

  if (cfg.gesto === 'salto') {
    const tl = cfg.inicioSalto + cfg.voo;
    const noAr = t > cfg.inicioSalto && t < tl;
    const alt = noAr ? (9.81 / 2) * (t - cfg.inicioSalto) * (tl - t) : 0;
    const u = t >= tl ? Math.min(1, (t - tl) / 0.5) : 0;
    const agach = t >= tl ? 0.18 * Math.sin(Math.PI * u) : 0;
    const hipY = ALTURA_TORNOZELO + alt + 0.86 - agach;
    const ankleY = ALTURA_TORNOZELO + alt;
    const medial = t >= tl ? Math.sin(Math.PI * u) : 0;
    const lat: Record<string, number> = {};
    for (const lado of ['D', 'E'] as const) {
      const s = lado.toLowerCase(), sg = sinal[lado];
      const quadril = { x: sg * 0.1, y: hipY }, tornozelo = { x: sg * 0.15, y: ankleY };
      const deslocamento = cfg.valgoMax[lado] * medial;
      const joelho = { x: (quadril.x + tornozelo.x) / 2 - sg * deslocamento, y: (quadril.y + tornozelo.y) / 2 };
      m[`quadril_${s}`] = quadril; m[`joelho_${s}`] = joelho; m[`tornozelo_${s}`] = tornozelo;
      m[`calcanhar_${s}`] = { x: tornozelo.x, y: ankleY - ALTURA_TORNOZELO }; m[`pe_${s}`] = { x: tornozelo.x + sg * 0.03, y: ankleY - ALTURA_TORNOZELO };
      m[`ombro_${s}`] = { x: sg * 0.19, y: hipY + LT }; m[`cotovelo_${s}`] = { x: sg * 0.23, y: hipY + LT - LUA }; m[`punho_${s}`] = { x: sg * 0.25, y: hipY + LT - LUA - LFA };
      const lateral = (p: V) => sg * p.x;
      const alfaCoxa = Math.atan2(lateral(joelho) - lateral(quadril), quadril.y - joelho.y);
      const alfaPerna = Math.atan2(lateral(tornozelo) - lateral(joelho), joelho.y - tornozelo.y);
      lat[s] = ((alfaPerna - alfaCoxa) * 180) / Math.PI;
      verdade[`valgo_${s}`] = lat[s];
    }
    verdade.kasr = Math.abs(m.joelho_e.x - m.joelho_d.x) / Math.abs(m.tornozelo_e.x - m.tornozelo_d.x);
    verdade.linha_pelve = 0;
    verdade.linha_ombros = 0;
    verdade.tronco_lateral = 0;
    cabecaFrontal(m, hipY + LT + 0.2);
    return { mundo: m, verdade };
  }

  // ombro
  const u = (1 - Math.cos((2 * Math.PI * t) / cfg.periodo)) / 2;
  const lateralTronco = cfg.compensacao * u;
  const dir = acima(lateralTronco);
  const pelve = { x: 0, y: ALTURA_TORNOZELO + 0.86 };
  const meioOmbro = mais(pelve, LT, dir);
  const direita = { x: Math.cos(lateralTronco * RAD), y: -Math.sin(lateralTronco * RAD) };
  for (const lado of ['D', 'E'] as const) {
    const s = lado.toLowerCase(), sg = sinal[lado];
    const ombro = mais(meioOmbro, sg * 0.19, direita);
    const A = cfg.elevacaoMax[lado] * u;
    const cot = mais(ombro, LUA, { x: sg * Math.sin(A * RAD), y: -Math.cos(A * RAD) });
    const pun = mais(cot, LFA, { x: sg * Math.sin(A * RAD), y: -Math.cos(A * RAD) });
    m[`quadril_${s}`] = { x: sg * 0.1, y: pelve.y };
    m[`joelho_${s}`] = { x: sg * 0.11, y: pelve.y - L1 }; m[`tornozelo_${s}`] = { x: sg * 0.12, y: ALTURA_TORNOZELO };
    m[`calcanhar_${s}`] = { x: sg * 0.12, y: 0 }; m[`pe_${s}`] = { x: sg * 0.15, y: 0 };
    m[`ombro_${s}`] = ombro; m[`cotovelo_${s}`] = cot; m[`punho_${s}`] = pun;
    verdade[`elevacao_${s}`] = A;
    verdade[`elevacao_tronco_${s}`] = A + sg * lateralTronco;
  }
  verdade.tronco_lateral = lateralTronco;
  verdade.linha_ombros = 0;
  cabecaFrontal(m, meioOmbro.y + 0.2, meioOmbro.x + dir.x * 0.2);
  return { mundo: m, verdade };
}

function cabecaFrontal(m: Record<string, V>, yCabeca: number, xCabeca = 0): void {
  const c = { x: xCabeca, y: yCabeca };
  m.nariz = soma(c, { x: 0, y: -0.01 });
  m.olho_d = soma(c, { x: -0.035, y: 0.03 }); m.olho_e = soma(c, { x: 0.035, y: 0.03 });
  m.olho_d_int = soma(c, { x: -0.015, y: 0.03 }); m.olho_e_int = soma(c, { x: 0.015, y: 0.03 });
  m.olho_d_ext = soma(c, { x: -0.055, y: 0.03 }); m.olho_e_ext = soma(c, { x: 0.055, y: 0.03 });
  m.orelha_d = soma(c, { x: -0.09, y: 0 }); m.orelha_e = soma(c, { x: 0.09, y: 0 });
  m.boca_d = soma(c, { x: -0.03, y: -0.05 }); m.boca_e = soma(c, { x: 0.03, y: -0.05 });
}

// ---------- pose no tempo ----------

/** Posição do ponto na imagem (0–1), com o chão a 92% da altura. Em câmera fixa, o paciente parte de 8% da largura. */
function paraImagem(cfg: ConfigFigura, p: V, xCamera: number): V {
  const ppm = cfg.altura / cfg.metrosNaAltura;
  const lateral = cfg.gesto === 'marcha' || cfg.gesto === 'corrida' || cfg.gesto === 'agachamento';
  const x = cfg.cameraFixa && lateral ? 0.08 + ((p.x - xCamera) * ppm) / cfg.largura : 0.5 + ((p.x - xCamera) * ppm) / cfg.largura;
  const y = 0.92 - (p.y * ppm) / cfg.altura;
  return { x: cfg.direcao === 1 ? x : 1 - x, y };
}

export function poseSintetica(cfg: ConfigFigura, t: number): PoseSintetica {
  let mundo: Record<string, V>;
  let verdade: VerdadeQuadro;
  let xCamera = 0;
  let xPelve = 0;
  if (cfg.gesto === 'marcha' || cfg.gesto === 'corrida') {
    const r = cfg.gesto === 'marcha' ? marcha(cfg, t) : corrida(cfg, t);
    const e = esqueletoLateral(r.postura);
    mundo = e.mundo; verdade = e.verdade;
    xPelve = r.xPelve;
    for (const k of Object.keys(mundo)) mundo[k] = { x: mundo[k].x + xPelve, y: mundo[k].y };
    xCamera = cfg.cameraFixa ? 0 : xPelve;
  } else if (cfg.gesto === 'agachamento') {
    const e = esqueletoLateral(agachamento(cfg, t));
    mundo = e.mundo; verdade = e.verdade;
  } else {
    const e = frontal(cfg, t);
    mundo = e.mundo; verdade = e.verdade;
  }

  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  const proximo: Lado = cfg.direcao === 1 ? 'D' : 'E';
  const lateralVista = cfg.gesto === 'marcha' || cfg.gesto === 'corrida' || cfg.gesto === 'agachamento';
  for (const [nome, indice] of Object.entries(PONTOS_MEDIAPIPE)) {
    const p = mundo[nome];
    if (!p) continue;
    const img = paraImagem(cfg, p, xCamera);
    const doLadoLonge = lateralVista && /_(d|e)(_|$)/.test(nome) && !nome.endsWith(`_${proximo.toLowerCase()}`) && !/(ombro|quadril|orelha|olho|boca)/.test(nome);
    lm[indice] = { x: img.x, y: img.y, visibility: doLadoLonge ? cfg.visibilidade - 0.1 : cfg.visibilidade };
  }
  return { landmarks: lm, verdade, mundo };
}

// ---------- eventos e valores conhecidos ----------

export interface EventosVerdade {
  contato: Record<Lado, number[]>;
  saida: Record<Lado, number[]>;
}

/**
 * Corrida: contatos e saídas conhecidos (a figura é construída com o pé plantado durante o contato). Marcha: contato = pé mais à frente
 * da pelve, saída = ponta do pé mais atrás, achados por varredura fina da própria geometria (a figura da marcha não planta o pé).
 */
export function eventosVerdade(cfg: ConfigFigura, duracao: number): EventosVerdade {
  const T = cfg.tempoPassada;
  const r: EventosVerdade = { contato: { D: [], E: [] }, saida: { D: [], E: [] } };
  if (cfg.gesto === 'corrida') {
    for (const lado of ['D', 'E'] as const) {
      const desloc = lado === 'D' ? 0 : T / 2 + cfg.atrasoE * T;
      for (let k = 0; desloc + k * T < duracao; k++) {
        const c = desloc + k * T;
        r.contato[lado].push(c);
        if (c + cfg.tempoContato[lado] < duracao) r.saida[lado].push(c + cfg.tempoContato[lado]);
      }
    }
    return r;
  }
  if (cfg.gesto === 'marcha') {
    const passo = 0.002;
    for (const lado of ['D', 'E'] as const) {
      const s = lado.toLowerCase();
      const desloc = lado === 'D' ? 0 : T * (0.5 + cfg.atrasoE);
      for (let k = 0; desloc + (k + 1) * T < duracao; k++) {
        let melhorC = -Infinity, tc = 0, melhorS = Infinity, ts = 0;
        for (let t = desloc + k * T - T * 0.25; t < desloc + (k + 1) * T - T * 0.25; t += passo) {
          const q = poseSintetica(cfg, t).mundo;
          const pelve = q.quadril_d.x;
          const calc = q[`calcanhar_${s}`].x - pelve, pe = q[`pe_${s}`].x - pelve;
          if (calc > melhorC) { melhorC = calc; tc = t; }
          if (pe < melhorS) { melhorS = pe; ts = t; }
        }
        if (tc >= 0 && tc < duracao) r.contato[lado].push(tc);
        if (ts >= 0 && ts < duracao) r.saida[lado].push(ts);
      }
    }
  }
  return r;
}

// ---------- trilha, detector e vídeo ----------

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function aleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface OpcoesDetectorFalso {
  /** Ruído (desvio aproximado) em pixels somado a cada ponto, determinístico por instante e ponto. */
  ruidoPx?: number;
  semente?: number;
  /** Instantes em que o detector não acha ninguém (devolve null) ou perde pontos (devolve visibilidade 0 nos listados). */
  ausentes?: (t: number) => boolean | number[];
}

function comRuido(cfg: ConfigFigura, lm: Landmark[], t: number, op: OpcoesDetectorFalso): Landmark[] {
  const sigma = op.ruidoPx ?? 0;
  if (!(sigma > 0)) return lm;
  return lm.map((l, i) => {
    const rnd = aleatorio((op.semente ?? 1) * 1000003 + Math.round(t * 1000) * 7919 + i * 104729);
    const g = () => (rnd() + rnd() + rnd() + rnd() - 2) * 1.732;
    return { ...l, x: l.x + (g() * sigma) / cfg.largura, y: l.y + (g() * sigma) / cfg.altura };
  });
}

export function landmarksSinteticos(cfg: ConfigFigura, t: number, op: OpcoesDetectorFalso = {}): Landmark[] | null {
  const falta = op.ausentes?.(t);
  if (falta === true) return null;
  const lm = comRuido(cfg, poseSintetica(cfg, t).landmarks, t, op);
  if (Array.isArray(falta)) for (const i of falta) lm[i] = { ...lm[i], visibility: 0 };
  return lm;
}

/** Trilha direta (sem vídeo) com a figura sintética: `quadros` amostras a `fps`, a partir de `inicio`. */
export function trilhaSintetica(cfg: ConfigFigura, fps: number, duracao: number, op: OpcoesDetectorFalso & { inicio?: number } = {}): TrilhaPose {
  const n = Math.max(1, Math.floor(duracao * fps));
  const inicio = op.inicio ?? 0;
  return criarTrilha(fps, cfg.largura, cfg.altura, Array.from({ length: n }, (_, i) => {
    const t = inicio + i / fps;
    return { i, t, pontos: pontosDeLandmarks(landmarksSinteticos(cfg, t, op), cfg.largura, cfg.altura) };
  }));
}

/**
 * Detector falso determinístico: ignora a imagem e devolve os pontos da figura sintética no instante `t` do vídeo.
 * Serve para testar o rastreio e as medidas sem o MediaPipe (que não roda sem rede).
 */
export function detectorFalso(cfg: ConfigFigura, op: OpcoesDetectorFalso = {}): DetectorQuadro {
  return async (_quadro, t) => landmarksSinteticos(cfg, t, op);
}

const LIGACOES: [string, string][] = [
  ['ombro_d', 'ombro_e'], ['quadril_d', 'quadril_e'], ['ombro_d', 'quadril_d'], ['ombro_e', 'quadril_e'],
  ['ombro_d', 'cotovelo_d'], ['cotovelo_d', 'punho_d'], ['ombro_e', 'cotovelo_e'], ['cotovelo_e', 'punho_e'],
  ['quadril_d', 'joelho_d'], ['joelho_d', 'tornozelo_d'], ['tornozelo_d', 'calcanhar_d'], ['calcanhar_d', 'pe_d'], ['tornozelo_d', 'pe_d'],
  ['quadril_e', 'joelho_e'], ['joelho_e', 'tornozelo_e'], ['tornozelo_e', 'calcanhar_e'], ['calcanhar_e', 'pe_e'], ['tornozelo_e', 'pe_e'],
];

/** Desenha o boneco da figura sintética num canvas (para gerar vídeos de teste). */
export function desenharFigura(ctx: CanvasRenderingContext2D, lm: Landmark[], largura: number, altura: number): void {
  ctx.fillStyle = '#10243b';
  ctx.fillRect(0, 0, largura, altura);
  ctx.fillStyle = '#17324f';
  ctx.fillRect(0, altura * 0.92, largura, altura * 0.08);
  const ponto = (nome: string) => {
    const l = lm[(PONTOS_MEDIAPIPE as Record<string, number>)[nome]];
    return l && (l.visibility ?? 1) > 0.1 ? { x: l.x * largura, y: l.y * altura } : null;
  };
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(3, altura / 90);
  for (const [a, b] of LIGACOES) {
    const pa = ponto(a), pb = ponto(b);
    if (!pa || !pb) continue;
    ctx.strokeStyle = a.endsWith('_e') || b.endsWith('_e') ? '#8fb7d8' : '#e8edf3';
    ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
  }
  const nariz = ponto('nariz'), oD = ponto('orelha_d'), oE = ponto('orelha_e');
  const centro = oD && oE ? { x: (oD.x + oE.x) / 2, y: (oD.y + oE.y) / 2 } : oD ?? oE ?? nariz;
  if (centro) {
    ctx.fillStyle = '#d9c3a5';
    ctx.beginPath(); ctx.arc(centro.x, centro.y, altura * 0.05, 0, Math.PI * 2); ctx.fill();
    if (nariz) { ctx.fillStyle = '#b08968'; ctx.beginPath(); ctx.arc(nariz.x, nariz.y, altura * 0.012, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.fillStyle = '#eaaa14';
  for (const n of ['ombro_d', 'ombro_e', 'quadril_d', 'quadril_e', 'joelho_d', 'joelho_e', 'tornozelo_d', 'tornozelo_e', 'cotovelo_d', 'cotovelo_e', 'punho_d', 'punho_e']) {
    const p = ponto(n);
    if (p) { ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(4, altura / 70), 0, Math.PI * 2); ctx.fill(); }
  }
}
