import { pontoMedio, type Ponto, type Vista } from './medidas';

/** Ponto normalizado (0–1) devolvido pelo detector de pose. */
export interface Landmark { x: number; y: number; visibility?: number }

// Índices do modelo de 33 pontos do MediaPipe. "Esquerdo" é o lado do paciente.
const L = { orelhaE: 7, orelhaD: 8, ombroE: 11, ombroD: 12, quadrilE: 23, quadrilD: 24, joelhoE: 25, joelhoD: 26, tornozeloE: 27, tornozeloD: 28 } as const;

const VISIBILIDADE_MINIMA = 0.5;

/**
 * Converte os pontos do detector em marcações das medidas. O modelo marca centros
 * articulares, não os pontos ósseos usados na clínica (acrômio, crista ilíaca, C7,
 * trocânter): por isso o resultado é uma sugestão que o profissional confere e ajusta.
 * Medidas sem ponto confiável (ou que dependem de C7/tragus) ficam de fora.
 */
export function pontosAutomaticos(lm: Landmark[], vista: Vista, w: number, h: number): Record<string, Ponto[]> {
  const pega = (i: number): Ponto | null => {
    const l = lm[i];
    if (!l || (l.visibility ?? 1) < VISIBILIDADE_MINIMA) return null;
    return { x: l.x * w, y: l.y * h };
  };
  const vis = (i: number) => lm[i]?.visibility ?? 0;
  const todos = (...pts: (Ponto | null)[]) => pts.every((p) => p !== null);
  const saida: Record<string, Ponto[]> = {};

  if (vista === 'frente' || vista === 'costas') {
    const oD = pega(L.ombroD), oE = pega(L.ombroE), qD = pega(L.quadrilD), qE = pega(L.quadrilE), eD = pega(L.orelhaD), eE = pega(L.orelhaE);
    if (todos(oD, oE)) saida.ombros = [oD!, oE!];
    if (todos(qD, qE)) saida.pelve = [qD!, qE!];
    if (todos(eD, eE)) saida.cabeca = [eD!, eE!];
    if (todos(oD, oE, qD, qE)) saida.tronco = [pontoMedio(oD!, oE!), pontoMedio(qD!, qE!)];
    const jD = pega(L.joelhoD), tD = pega(L.tornozeloD), jE = pega(L.joelhoE), tE = pega(L.tornozeloE);
    if (todos(qD, jD, tD)) saida['joelho-d'] = [qD!, jD!, tD!];
    if (todos(qE, jE, tE)) saida['joelho-e'] = [qE!, jE!, tE!];
    return saida;
  }

  // Perfil: usa o lado do corpo mais visível para a câmera.
  const somaE = vis(L.ombroE) + vis(L.quadrilE) + vis(L.joelhoE) + vis(L.tornozeloE);
  const somaD = vis(L.ombroD) + vis(L.quadrilD) + vis(L.joelhoD) + vis(L.tornozeloD);
  const e = somaE >= somaD;
  const o = pega(e ? L.ombroE : L.ombroD), q = pega(e ? L.quadrilE : L.quadrilD);
  const j = pega(e ? L.joelhoE : L.joelhoD), t = pega(e ? L.tornozeloE : L.tornozeloD);
  if (todos(o, q)) saida['tronco-perfil'] = [o!, q!];
  if (todos(q, j, t)) saida.joelho = [q!, j!, t!];
  return saida;
}
