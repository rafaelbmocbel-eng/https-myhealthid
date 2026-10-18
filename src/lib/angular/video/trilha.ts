import type { Landmark } from '../pose';
import { CONF_GUARDAR, CONF_MINIMA, NOMES_PONTOS, PONTOS_MEDIAPIPE, type PontoPose, type QuadroPose, type TrilhaPose } from './tipos';

export function criarTrilha(fps: number, largura: number, altura: number, quadros: QuadroPose[] = []): TrilhaPose {
  return { fps, largura, altura, quadros };
}

/** Converte os pontos normalizados do detector em pontos em pixels. Pontos quase invisíveis ficam de fora. */
export function pontosDeLandmarks(lm: Landmark[] | null | undefined, largura: number, altura: number): Record<string, PontoPose> {
  const saida: Record<string, PontoPose> = {};
  if (!lm) return saida;
  for (const nome of NOMES_PONTOS) {
    const l = lm[PONTOS_MEDIAPIPE[nome]];
    if (!l || !Number.isFinite(l.x) || !Number.isFinite(l.y)) continue;
    const conf = l.visibility ?? 1;
    if (conf < CONF_GUARDAR) continue;
    saida[nome] = { x: l.x * largura, y: l.y * altura, conf };
  }
  return saida;
}

/** Monta a trilha a partir de poses já detectadas (um item por quadro, na ordem). */
export function trilhaDeLandmarks(quadros: { t: number; lm: Landmark[] | null }[], fps: number, largura: number, altura: number): TrilhaPose {
  return criarTrilha(fps, largura, altura, quadros.map((q, i) => ({ i, t: q.t, pontos: pontosDeLandmarks(q.lm, largura, altura) })));
}

/**
 * Instante em que o vídeo é parado para mostrar o quadro de tempo `t`: um pouco depois do início do quadro,
 * porque parar exatamente no carimbo de tempo pode mostrar o quadro anterior por erro de arredondamento
 * (vídeos a 29,97 ou 59,94 q/s têm carimbos que não caem em i/30). O rastreio, o player e as exportações usam esta mesma regra
 * para a pose de um quadro ser a da imagem que o profissional vê.
 */
export const tempoDeExibicao = (t: number, fps: number): number => t + 0.25 / Math.max(1, fps);

export const duracaoDaTrilha = (trilha: TrilhaPose): number => (trilha.quadros.length > 1 ? trilha.quadros[trilha.quadros.length - 1].t - trilha.quadros[0].t : 0);

/** Índice do quadro mais próximo do instante `t` (em segundos do vídeo), limitado à trilha. */
export function indiceNoTempo(trilha: TrilhaPose, t: number): number {
  const n = trilha.quadros.length;
  if (!n) return 0;
  const t0 = trilha.quadros[0].t;
  const i = Math.round((t - t0) * trilha.fps);
  return Math.min(n - 1, Math.max(0, Number.isFinite(i) ? i : 0));
}

/** O ponto pode ser usado nas medidas? Um ponto corrigido à mão vale sempre; os automáticos precisam de confiança mínima. */
export const pontoUsavel = (p: PontoPose | undefined | null, confMin = CONF_MINIMA): p is PontoPose =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.manual === true || (p.conf ?? 1) >= confMin);

/**
 * Ponto pelo nome. Nomes terminados em `_medio` (quadril_medio, ombro_medio...) são o ponto médio entre os lados D e E
 * e só existem quando os dois estão utilizáveis.
 */
export function pontoDoQuadro(quadro: QuadroPose | undefined, nome: string, confMin = CONF_MINIMA): { x: number; y: number } | null {
  if (!quadro) return null;
  const direto = quadro.pontos[nome];
  if (direto) return pontoUsavel(direto, confMin) ? { x: direto.x, y: direto.y } : null;
  const m = /^(.+)_medio$/.exec(nome);
  if (!m) return null;
  const d = quadro.pontos[`${m[1]}_d`], e = quadro.pontos[`${m[1]}_e`];
  if (!pontoUsavel(d, confMin) || !pontoUsavel(e, confMin)) return null;
  return { x: (d.x + e.x) / 2, y: (d.y + e.y) / 2 };
}

/** Série de um eixo de um ponto, uma amostra por quadro (null onde o ponto não é utilizável). */
export function serieDoPonto(trilha: TrilhaPose, nome: string, eixo: 'x' | 'y', confMin = CONF_MINIMA): (number | null)[] {
  return trilha.quadros.map((q) => pontoDoQuadro(q, nome, confMin)?.[eixo] ?? null);
}

/** Porcentagem de quadros em que o corpo foi detectado (pelo menos 8 pontos do tronco e das pernas utilizáveis). */
export function deteccaoPct(trilha: TrilhaPose): number {
  if (!trilha.quadros.length) return 0;
  const corpo = ['ombro_d', 'ombro_e', 'quadril_d', 'quadril_e', 'joelho_d', 'joelho_e', 'tornozelo_d', 'tornozelo_e'];
  const bons = trilha.quadros.filter((q) => corpo.filter((n) => pontoUsavel(q.pontos[n])).length >= 4).length;
  return (bons / trilha.quadros.length) * 100;
}

const direcaoEmCache = new WeakMap<TrilhaPose, 1 | -1>();

/**
 * Para onde o paciente está virado/andando na imagem: +1 para a direita, -1 para a esquerda. Usa a orientação dos pés
 * (calcanhar → ponta) e, sem pés, o nariz em relação às orelhas.
 */
export function estimarDirecao(trilha: TrilhaPose): 1 | -1 {
  const guardada = direcaoEmCache.get(trilha);
  if (guardada) return guardada;
  let pes = 0, rosto = 0;
  for (const q of trilha.quadros) {
    for (const lado of ['d', 'e'] as const) {
      const c = pontoDoQuadro(q, `calcanhar_${lado}`), p = pontoDoQuadro(q, `pe_${lado}`);
      if (c && p) pes += p.x - c.x;
    }
    const nariz = pontoDoQuadro(q, 'nariz'), orelha = pontoDoQuadro(q, 'orelha_d') ?? pontoDoQuadro(q, 'orelha_e');
    if (nariz && orelha) rosto += nariz.x - orelha.x;
  }
  const soma = pes !== 0 ? pes : rosto;
  const dir: 1 | -1 = soma >= 0 ? 1 : -1;
  direcaoEmCache.set(trilha, dir);
  return dir;
}

// ---------- salvar / retomar ----------

const VERSAO_ARQUIVO = 1;
const TIPO_ARQUIVO = 'trilha-pose';
const FLAG_MANUAL = 1, FLAG_INTERP = 2;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

/** Texto JSON compacto da trilha (inclui os quadros-chave e as detecções originais), para salvar e retomar a análise. */
export function serializarTrilha(trilha: TrilhaPose): string {
  const quadros = trilha.quadros.map((q) => {
    const p: Record<string, number[]> = {};
    for (const [nome, pt] of Object.entries(q.pontos)) {
      const flags = (pt.manual ? FLAG_MANUAL : 0) | (pt.interp ? FLAG_INTERP : 0);
      const linha = [r2(pt.x), r2(pt.y), pt.conf === undefined ? -1 : r2(pt.conf), flags];
      if (pt.auto) linha.push(r2(pt.auto.x), r2(pt.auto.y), pt.auto.conf === undefined ? -1 : r2(pt.auto.conf));
      p[nome] = linha;
    }
    return { t: r3(q.t), p };
  });
  return JSON.stringify({ tipo: TIPO_ARQUIVO, versao: VERSAO_ARQUIVO, fps: trilha.fps, largura: trilha.largura, altura: trilha.altura, quadros });
}

const ehNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Lê o texto (ou objeto) salvo por `serializarTrilha`. Lança `Error` com mensagem em português se o arquivo não for uma trilha válida. */
export function lerTrilha(entrada: string | unknown): TrilhaPose {
  let bruto: unknown = entrada;
  if (typeof entrada === 'string') {
    try {
      bruto = JSON.parse(entrada);
    } catch {
      throw new Error('O arquivo da análise não é um JSON válido.');
    }
  }
  const o = bruto as { tipo?: unknown; versao?: unknown; fps?: unknown; largura?: unknown; altura?: unknown; quadros?: unknown } | null;
  if (!o || typeof o !== 'object' || o.tipo !== TIPO_ARQUIVO) throw new Error('O arquivo não é uma análise de vídeo salva por este app.');
  if (!ehNumero(o.versao) || o.versao > VERSAO_ARQUIVO) throw new Error('Este arquivo foi salvo por uma versão mais nova do app.');
  if (!ehNumero(o.fps) || o.fps <= 0 || !ehNumero(o.largura) || o.largura <= 0 || !ehNumero(o.altura) || o.altura <= 0 || !Array.isArray(o.quadros)) {
    throw new Error('Análise de vídeo incompleta: faltam dados do vídeo.');
  }
  const validos = new Set<string>(NOMES_PONTOS);
  const quadros: QuadroPose[] = o.quadros.map((qb, i) => {
    const q = qb as { t?: unknown; p?: unknown };
    if (!q || !ehNumero(q.t) || !q.p || typeof q.p !== 'object') throw new Error(`Quadro ${i + 1} da análise está inválido.`);
    const pontos: Record<string, PontoPose> = {};
    for (const [nome, v] of Object.entries(q.p as Record<string, unknown>)) {
      if (!validos.has(nome) || !Array.isArray(v) || v.length < 4 || !v.slice(0, 4).every(ehNumero)) continue;
      const pt: PontoPose = { x: v[0], y: v[1] };
      if (v[2] >= 0) pt.conf = v[2];
      if ((v[3] & FLAG_MANUAL) !== 0) pt.manual = true;
      if ((v[3] & FLAG_INTERP) !== 0) pt.interp = true;
      if (v.length >= 7 && ehNumero(v[4]) && ehNumero(v[5]) && ehNumero(v[6])) pt.auto = { x: v[4], y: v[5], ...(v[6] >= 0 ? { conf: v[6] } : {}) };
      pontos[nome] = pt;
    }
    return { i, t: q.t, pontos };
  });
  return { fps: o.fps, largura: o.largura, altura: o.altura, quadros };
}
