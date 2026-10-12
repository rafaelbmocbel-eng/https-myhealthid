import type { PontoPose, QuadroPose, TrilhaPose } from './tipos';

/**
 * Correção quadro a quadro, no estilo stop-motion.
 *
 * Cada ponto corrigido à mão vira um quadro-chave (`manual`) e fica "preso" onde o profissional o deixou.
 * Os quadros automáticos ao redor são ajustados assim:
 *  - entre dois quadros-chave consecutivos (a distância é até `maxLacunaS`): interpolação linear da posição;
 *  - antes do primeiro ou depois do último quadro-chave, ou entre dois quadros-chave muito distantes: o desvio
 *    corrigido (manual − automático) é aplicado às vizinhas e some linearmente em `janelaAjusteS`; o resto da
 *    detecção automática é mantida, para uma correção pontual não apagar segundos de rastreio.
 * A detecção original fica guardada em `auto`, então remover a correção restaura exatamente o que o detector deu.
 * Nenhuma função altera a trilha recebida: devolvem uma nova, reaproveitando os quadros que não mudaram.
 */
export interface OpcoesCorrecao {
  /** Quanto o desvio de um quadro-chave se espalha para as vizinhas automáticas, em segundos (padrão 0,25). */
  janelaAjusteS?: number;
  /** Maior distância entre dois quadros-chave que ainda é interpolada em linha reta, em segundos (padrão 1,5). */
  maxLacunaS?: number;
}

export const JANELA_AJUSTE_S = 0.25;
export const MAX_LACUNA_S = 1.5;

interface Xyc { x: number; y: number; conf?: number }

/** Detecção automática original do ponto (a que o detector deu), se houve. */
const baseDe = (p: PontoPose | undefined): Xyc | null => {
  if (!p) return null;
  if (p.auto) return p.auto;
  if (p.manual || p.interp) return null;
  return { x: p.x, y: p.y, ...(p.conf !== undefined ? { conf: p.conf } : {}) };
};

const comoAuto = (b: Xyc): PontoPose['auto'] => ({ x: b.x, y: b.y, ...(b.conf !== undefined ? { conf: b.conf } : {}) });

const igual = (a: PontoPose | undefined, b: PontoPose | undefined): boolean => {
  if (!a || !b) return !a && !b;
  const ea = a.auto, eb = b.auto;
  const autoIgual = !ea || !eb ? !ea && !eb : ea.x === eb.x && ea.y === eb.y && ea.conf === eb.conf;
  return a.x === b.x && a.y === b.y && a.conf === b.conf && !!a.manual === !!b.manual && !!a.interp === !!b.interp && autoIgual;
};

function trocarPonto(q: QuadroPose, nome: string, novo: PontoPose | null): QuadroPose {
  const pontos = { ...q.pontos };
  if (novo) pontos[nome] = novo;
  else delete pontos[nome];
  return { ...q, pontos };
}

/** Recalcula as posições automáticas de um ponto a partir dos quadros-chave que ele tem. */
function recalcular(quadros: QuadroPose[], nome: string, fps: number, opc: OpcoesCorrecao): QuadroPose[] {
  const n = quadros.length;
  const chaves: number[] = [];
  for (let f = 0; f < n; f++) if (quadros[f].pontos[nome]?.manual) chaves.push(f);
  const maxLacuna = Math.max(1, Math.round((opc.maxLacunaS ?? MAX_LACUNA_S) * fps));
  const janela = Math.min(Math.max(0, Math.round((opc.janelaAjusteS ?? JANELA_AJUSTE_S) * fps)), Math.floor(maxLacuna / 2));
  const saida = quadros.slice();
  let k = 0;
  for (let f = 0; f < n; f++) {
    const antigo = quadros[f].pontos[nome];
    if (antigo?.manual) continue;
    while (k < chaves.length && chaves[k] < f) k++;
    const b = k < chaves.length ? chaves[k] : -1;
    const a = k > 0 ? chaves[k - 1] : -1;
    const base = baseDe(antigo);
    let novo: PontoPose | null;

    if (a >= 0 && b >= 0 && b - a <= maxLacuna) {
      const pa = quadros[a].pontos[nome], pb = quadros[b].pontos[nome];
      const s = (f - a) / (b - a);
      novo = { x: pa.x + (pb.x - pa.x) * s, y: pa.y + (pb.y - pa.y) * s, interp: true };
      if (base) {
        if (base.conf !== undefined) novo.conf = base.conf;
        novo.auto = comoAuto(base);
      }
    } else if (base) {
      const proxima = a >= 0 && (b < 0 || f - a <= b - f) ? a : b;
      const dist = proxima >= 0 ? Math.abs(f - proxima) : Infinity;
      const baseChave = dist <= janela ? baseDe(quadros[proxima].pontos[nome]) : null;
      if (baseChave) {
        const pk = quadros[proxima].pontos[nome];
        const peso = 1 - dist / (janela + 1);
        novo = { x: base.x + (pk.x - baseChave.x) * peso, y: base.y + (pk.y - baseChave.y) * peso, interp: true, auto: comoAuto(base) };
        if (base.conf !== undefined) novo.conf = base.conf;
      } else {
        novo = { x: base.x, y: base.y, ...(base.conf !== undefined ? { conf: base.conf } : {}) };
      }
    } else {
      novo = null;
    }

    if (!igual(antigo, novo ?? undefined)) saida[f] = trocarPonto(quadros[f], nome, novo);
  }
  return saida;
}

const limitar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * Corrige a posição de um ponto num quadro (vira quadro-chave) e reajusta as vizinhas. Índice inválido, nome vazio
 * ou coordenada não numérica devolvem a própria trilha. A posição é mantida dentro do vídeo.
 */
export function corrigirPonto(trilha: TrilhaPose, indice: number, nome: string, ponto: { x: number; y: number }, opcoes: OpcoesCorrecao = {}): TrilhaPose {
  const q = trilha.quadros[indice];
  if (!q || !nome || !Number.isFinite(ponto?.x) || !Number.isFinite(ponto?.y)) return trilha;
  const x = limitar(ponto.x, 0, trilha.largura), y = limitar(ponto.y, 0, trilha.altura);
  const antigo = q.pontos[nome];
  if (antigo?.manual && antigo.x === x && antigo.y === y) return trilha;
  const base = baseDe(antigo);
  const novo: PontoPose = { x, y, conf: 1, manual: true, ...(base ? { auto: comoAuto(base) } : {}) };
  const quadros = trilha.quadros.slice();
  quadros[indice] = trocarPonto(q, nome, novo);
  return { ...trilha, quadros: recalcular(quadros, nome, trilha.fps, opcoes) };
}

/** Desfaz a correção de um quadro: o ponto volta à detecção automática (ou some, se não havia) e as vizinhas se reajustam. */
export function removerCorrecao(trilha: TrilhaPose, indice: number, nome: string, opcoes: OpcoesCorrecao = {}): TrilhaPose {
  const q = trilha.quadros[indice];
  const p = q?.pontos[nome];
  if (!q || !p?.manual) return trilha;
  const quadros = trilha.quadros.slice();
  quadros[indice] = trocarPonto(q, nome, p.auto ? { x: p.auto.x, y: p.auto.y, ...(p.auto.conf !== undefined ? { conf: p.auto.conf } : {}) } : null);
  return { ...trilha, quadros: recalcular(quadros, nome, trilha.fps, opcoes) };
}

/** Remove todas as correções de um ponto (todos os quadros-chave dele). */
export function removerCorrecoesDoPonto(trilha: TrilhaPose, nome: string, opcoes: OpcoesCorrecao = {}): TrilhaPose {
  if (!trilha.quadros.some((q) => q.pontos[nome]?.manual || q.pontos[nome]?.interp)) return trilha;
  const quadros = trilha.quadros.map((q) => {
    const p = q.pontos[nome];
    if (!p?.manual) return q;
    return trocarPonto(q, nome, p.auto ? { x: p.auto.x, y: p.auto.y, ...(p.auto.conf !== undefined ? { conf: p.auto.conf } : {}) } : null);
  });
  return { ...trilha, quadros: recalcular(quadros, nome, trilha.fps, opcoes) };
}

/** Remove todas as correções da trilha: volta a ser exatamente a saída do detector. */
export function limparCorrecoes(trilha: TrilhaPose, opcoes: OpcoesCorrecao = {}): TrilhaPose {
  let atual = trilha;
  for (const nome of nomesCorrigidos(trilha)) atual = removerCorrecoesDoPonto(atual, nome, opcoes);
  return atual;
}

/** Nomes dos pontos que têm algum quadro-chave. */
export function nomesCorrigidos(trilha: TrilhaPose): string[] {
  const nomes = new Set<string>();
  for (const q of trilha.quadros) for (const [nome, p] of Object.entries(q.pontos)) if (p.manual) nomes.add(nome);
  return [...nomes];
}

/** Índices dos quadros com correção manual (de um ponto ou de qualquer ponto), em ordem: os marcadores do scrubber. */
export function quadrosCorrigidos(trilha: TrilhaPose, nome?: string): number[] {
  const indices: number[] = [];
  trilha.quadros.forEach((q, i) => {
    const corrigido = nome ? !!q.pontos[nome]?.manual : Object.values(q.pontos).some((p) => p.manual);
    if (corrigido) indices.push(i);
  });
  return indices;
}

/** Pontos corrigidos à mão num quadro (para destacá-los na tela). */
export const pontosCorrigidosNoQuadro = (trilha: TrilhaPose, indice: number): string[] =>
  Object.entries(trilha.quadros[indice]?.pontos ?? {}).filter(([, p]) => p.manual).map(([nome]) => nome);

export function resumoCorrecoes(trilha: TrilhaPose): { quadros: number; pontos: number; pontosAjustados: number } {
  let pontos = 0, pontosAjustados = 0;
  const quadros = new Set<number>();
  trilha.quadros.forEach((q, i) => {
    for (const p of Object.values(q.pontos)) {
      if (p.manual) { pontos++; quadros.add(i); }
      else if (p.interp) pontosAjustados++;
    }
  });
  return { quadros: quadros.size, pontos, pontosAjustados };
}
