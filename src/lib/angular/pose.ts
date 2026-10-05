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

export interface Enquadramento { ok: boolean; mensagem: string }

/** Diz se o corpo está inteiro, centralizado e com bom tamanho no quadro, para guiar a distância da foto. */
export function avaliarEnquadramento(lm: Landmark[] | null): Enquadramento {
  if (!lm) return { ok: false, mensagem: 'Não achei o corpo. Posicione o paciente no centro do quadro.' };
  const vis = (i: number) => (lm[i]?.visibility ?? 0) >= 0.5;
  const nariz = lm[0], tD = lm[28], tE = lm[27];
  const pes = [tD, tE].filter((_, k) => vis(k === 0 ? 28 : 27));
  if (!vis(0) || !pes.length) return { ok: false, mensagem: 'Afaste-se: o corpo precisa aparecer inteiro, da cabeça aos pés.' };
  const topo = nariz.y, base = Math.max(...pes.map((p) => p.y));
  if (topo < 0.02 || base > 0.985) return { ok: false, mensagem: 'Afaste-se: a cabeça ou os pés estão cortados.' };
  const altura = base - topo;
  if (altura < 0.55) return { ok: false, mensagem: 'Aproxime-se um pouco: o corpo está pequeno no quadro.' };
  if (altura > 0.9) return { ok: false, mensagem: 'Afaste-se um pouco: o corpo está grande demais no quadro.' };
  const meio = [11, 12, 23, 24].filter(vis).map((i) => lm[i].x);
  const cx = meio.length ? meio.reduce((s, v) => s + v, 0) / meio.length : nariz.x;
  if (cx < 0.35 || cx > 0.65) return { ok: false, mensagem: 'Centralize o paciente no quadro.' };
  return { ok: true, mensagem: 'Enquadramento bom. Pode fotografar.' };
}
