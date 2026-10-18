import type { Landmark } from '../pose';
import { caixaDoRostoPorLandmarks, caixaRostoPadrao, type CaixaRosto } from '@/lib/social/rosto';
import { PONTOS_MEDIAPIPE, PONTOS_ROSTO, type QuadroPose, type TrilhaPose } from './tipos';

/**
 * Caixa do rosto por quadro, a partir dos pontos de pose (nariz, olhos, orelhas e boca), para esconder o rosto no vídeo e na arte.
 * Privacidade primeiro: a caixa sempre erra para maior. Ela é a união das caixas dos quadros vizinhos (o rosto se mexe entre uma
 * amostra e outra) e cresce por uma margem. Um quadro sem rosto detectado só é dado como coberto ('vizinho') quando há rosto detectado
 * dos DOIS lados dele: a união das duas caixas cobre o trajeto entre elas. Com um vizinho só, ou nenhum, o rosto pode ter ido para
 * qualquer lugar (o paciente saindo ou entrando no quadro): o quadro vira 'fixa', cobre a última posição conhecida e a caixa fixa,
 * e o app pede ao profissional que confira a cobertura na prévia. A caixa fixa pode ser arrastada por ele até o rosto (caixaFixaRosto.ts):
 * a posição escolhida vale para todos os quadros 'fixa', e a união com a última posição conhecida continua valendo.
 */
export type OrigemCaixa = 'pose' | 'vizinho' | 'fixa';

export interface CaixaDoQuadro { caixa: CaixaRosto; origem: OrigemCaixa }

export interface OpcoesRosto {
  /** Caixa usada onde não há rosto detectado por perto. Padrão: a caixa de partida da arte social (alto e ao centro). */
  caixaFixa?: CaixaRosto;
  /** Até onde, em segundos, um quadro sem rosto procura o rosto detectado de cada lado (só vale quando acha os dois). */
  maxLacunaS?: number;
  /** Quantos segundos antes e depois entram na união de caixas (cobre o movimento entre amostras). */
  folgaTemporalS?: number;
  /** Multiplicador de largura e altura aplicado depois da união. */
  margem?: number;
  /** Caixas próprias de cada quadro (de `caixasPropriasDoRosto`), para refazer a cobertura sem recalcular os pontos; ignoradas se não houver uma por quadro. */
  proprias?: (CaixaRosto | null)[];
}

const MAX_LACUNA_S = 0.5;
const FOLGA_TEMPORAL_S = 0.08;
/** Margem aplicada à caixa do rosto depois da união (multiplica largura e altura). */
export const MARGEM_ROSTO = 1.15;

const limitar01 = (v: number) => Math.min(1, Math.max(0, v));

/** Menor caixa que contém todas as caixas dadas (null se não houver nenhuma). */
export function unirCaixas(caixas: CaixaRosto[]): CaixaRosto | null {
  if (!caixas.length) return null;
  let esq = Infinity, dir = -Infinity, topo = Infinity, base = -Infinity;
  for (const c of caixas) {
    esq = Math.min(esq, c.cx - c.w / 2); dir = Math.max(dir, c.cx + c.w / 2);
    topo = Math.min(topo, c.cy - c.h / 2); base = Math.max(base, c.cy + c.h / 2);
  }
  return { cx: (esq + dir) / 2, cy: (topo + base) / 2, w: dir - esq, h: base - topo };
}

/** Caixa com largura e altura multiplicadas por `k` (sem passar do quadro) e o centro dentro dele. */
export function ampliarCaixa(c: CaixaRosto, k: number): CaixaRosto {
  const w = Math.min(1, c.w * k), h = Math.min(1, c.h * k);
  return { cx: limitar01(c.cx), cy: limitar01(c.cy), w, h };
}

/** Pontos do rosto de um quadro no formato do detector (normalizados), para reaproveitar a estimativa da cabeça do módulo social. */
export function landmarksDoRosto(trilha: TrilhaPose, indice: number): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 33 }, () => ({ x: 0, y: 0, visibility: 0 }));
  const q = trilha.quadros[indice];
  if (!q) return lm;
  for (const nome of PONTOS_ROSTO) {
    const p = q.pontos[nome];
    if (p) lm[PONTOS_MEDIAPIPE[nome]] = { x: p.x / trilha.largura, y: p.y / trilha.altura, visibility: p.manual ? 1 : p.conf ?? 1 };
  }
  return lm;
}

const NOMES_ROSTO = new Set<string>(PONTOS_ROSTO);

/** O quadro sem os pontos do rosto: com o rosto coberto, desenhá-los só entregaria a posição dos olhos e do nariz. */
export function semPontosDoRosto(q: QuadroPose): QuadroPose {
  if (!PONTOS_ROSTO.some((n) => q.pontos[n])) return q;
  const pontos: QuadroPose['pontos'] = {};
  for (const [nome, p] of Object.entries(q.pontos)) if (!NOMES_ROSTO.has(nome)) pontos[nome] = p;
  return { ...q, pontos };
}

/** Caixa de cada quadro só pelos pontos do próprio quadro (null onde o rosto não foi localizado). Não depende da caixa fixa. */
export function caixasPropriasDoRosto(trilha: TrilhaPose): (CaixaRosto | null)[] {
  return trilha.quadros.map((_, i) => caixaDoRostoPorLandmarks(landmarksDoRosto(trilha, i), trilha.largura, trilha.altura));
}

/** Caixa do rosto de cada quadro da trilha (uma por quadro). */
export function caixasDoRosto(trilha: TrilhaPose, opcoes: OpcoesRosto = {}): CaixaDoQuadro[] {
  const n = trilha.quadros.length;
  const fixa = opcoes.caixaFixa ?? caixaRostoPadrao(trilha.largura, trilha.altura);
  const maxLacuna = Math.max(0, Math.round((opcoes.maxLacunaS ?? MAX_LACUNA_S) * trilha.fps));
  const folga = Math.max(0, Math.round((opcoes.folgaTemporalS ?? FOLGA_TEMPORAL_S) * trilha.fps));
  const margem = Math.max(1, opcoes.margem ?? MARGEM_ROSTO);

  const proprias = opcoes.proprias?.length === n ? opcoes.proprias : caixasPropriasDoRosto(trilha);

  const base: CaixaDoQuadro[] = proprias.map((c, i) => {
    if (c) return { caixa: c, origem: 'pose' as const };
    let antes: CaixaRosto | null = null, depois: CaixaRosto | null = null;
    for (let j = i - 1; j >= Math.max(0, i - maxLacuna) && !antes; j--) antes = proprias[j];
    for (let j = i + 1; j <= Math.min(n - 1, i + maxLacuna) && !depois; j++) depois = proprias[j];
    if (antes && depois) return { caixa: unirCaixas([antes, depois]) ?? fixa, origem: 'vizinho' as const };
    const unico = antes ?? depois;
    return { caixa: unico ? unirCaixas([unico, fixa]) ?? fixa : fixa, origem: 'fixa' as const };
  });

  return base.map((b, i) => {
    const janela = base.slice(Math.max(0, i - folga), Math.min(n, i + folga + 1)).map((x) => x.caixa);
    const uniao = unirCaixas(janela) ?? b.caixa;
    return { caixa: ampliarCaixa(uniao, margem), origem: b.origem };
  });
}

/** Caixa do rosto de um quadro, já com a folga dos vizinhos (para usar sem calcular a trilha toda). */
export function caixaDoRostoNoQuadro(trilha: TrilhaPose, indice: number, opcoes: OpcoesRosto = {}): CaixaDoQuadro {
  const de = Math.max(0, indice - 40), ate = Math.min(trilha.quadros.length, indice + 41);
  const recorte: TrilhaPose = { ...trilha, quadros: trilha.quadros.slice(de, ate) };
  const caixas = caixasDoRosto(recorte, opcoes);
  return caixas[Math.min(caixas.length - 1, Math.max(0, indice - de))] ?? { caixa: opcoes.caixaFixa ?? caixaRostoPadrao(trilha.largura, trilha.altura), origem: 'fixa' };
}

/**
 * Caixa do rosto no instante `t` do vídeo, para renderizar em uma taxa maior que a do rastreio: une as caixas dos dois quadros
 * rastreados que cercam `t`. Fora do intervalo rastreado usa o quadro mais próximo.
 */
export function caixaDoRostoEm(trilha: TrilhaPose, caixas: CaixaDoQuadro[], t: number): CaixaDoQuadro {
  const n = caixas.length;
  if (!n) return { caixa: caixaRostoPadrao(trilha.largura, trilha.altura), origem: 'fixa' };
  const pos = (t - trilha.quadros[0].t) * trilha.fps;
  const a = Math.min(n - 1, Math.max(0, Math.floor(pos))), b = Math.min(n - 1, Math.max(0, Math.ceil(pos)));
  if (a === b) return caixas[a];
  const uniao = unirCaixas([caixas[a].caixa, caixas[b].caixa]);
  const origem: OrigemCaixa = caixas[a].origem === 'fixa' || caixas[b].origem === 'fixa' ? 'fixa' : caixas[a].origem === 'vizinho' || caixas[b].origem === 'vizinho' ? 'vizinho' : 'pose';
  return { caixa: uniao ?? caixas[a].caixa, origem };
}

/** Porcentagem de quadros por origem da caixa: permite avisar "o rosto não foi localizado; confira a cobertura". */
export function resumoDoRosto(caixas: CaixaDoQuadro[]): Record<OrigemCaixa, number> {
  const total = Math.max(1, caixas.length);
  const conta = (o: OrigemCaixa) => (caixas.filter((c) => c.origem === o).length / total) * 100;
  return { pose: conta('pose'), vizinho: conta('vizinho'), fixa: conta('fixa') };
}
