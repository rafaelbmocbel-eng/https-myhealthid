import {
  INDICE_DA_PARTE, INDICE_DO_NARIZ, ladoMaisVisivel, medidasDaVista, olhaParaDoLado, pontoMedio, visibilidadeDoLado, VISIBILIDADE_MINIMA,
  type ContextoSugestao, type OlharPara, type Ponto, type Vista,
} from './medidas';
import type { LadoPerfil } from './tiposSessao';

/** Ponto normalizado (0–1) devolvido pelo detector de pose. */
export interface Landmark { x: number; y: number; visibility?: number }

/** Diferença de visibilidade (somada em ombro, quadril, joelho e tornozelo) a partir da qual o outro lado "claramente" aparece melhor. */
const DIFERENCA_VISIBILIDADE_CLARA = 1;

/** Distância horizontal mínima (fração da largura) entre dois pontos para a posição deles valer como indício. */
const FOLGA_HORIZONTAL = 0.02;

const nomeDoLado = (l: LadoPerfil) => (l === 'D' ? 'direito' : 'esquerdo');
const outroLado = (l: LadoPerfil): LadoPerfil => (l === 'D' ? 'E' : 'D');

const visivel = (lm: Landmark[], i: number): Landmark | null => {
  const l = lm[i];
  return l && (l.visibility ?? 1) >= VISIBILIDADE_MINIMA ? l : null;
};

// Pares do modelo que trocam de lado quando o profissional manda inverter direito e esquerdo.
const PARES_DIREITA_ESQUERDA: [number, number][] = [[1, 4], [2, 5], [3, 6], [7, 8], [9, 10], [11, 12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];

/** Cópia dos pontos com direito e esquerdo trocados: para quando o modelo rotulou os lados do paciente ao contrário. */
export function trocarDireitaEsquerda(lm: Landmark[]): Landmark[] {
  const saida = lm.slice();
  for (const [a, b] of PARES_DIREITA_ESQUERDA) {
    if (lm[a] === undefined && lm[b] === undefined) continue;
    saida[a] = lm[b];
    saida[b] = lm[a];
  }
  return saida;
}

/**
 * Teste de sanidade de direito e esquerdo: de frente o ombro (ou quadril) direito do paciente fica à ESQUERDA do esquerdo na imagem;
 * de costas, o contrário. Se não bater, devolve o aviso; sem pontos suficientes (ou no perfil), não opina.
 */
export function conferirDireitaEsquerda(lm: Landmark[], vista: Vista): string | null {
  if (vista === 'perfil') return null;
  for (const parte of ['ombro', 'quadril'] as const) {
    const d = visivel(lm, INDICE_DA_PARTE[parte].D), e = visivel(lm, INDICE_DA_PARTE[parte].E);
    if (!d || !e || Math.abs(d.x - e.x) < FOLGA_HORIZONTAL) continue;
    const direitoNaDireitaDaImagem = d.x > e.x;
    if (direitoNaDireitaDaImagem !== (vista === 'costas')) {
      return `O modelo pode ter trocado direito e esquerdo: nesta foto de ${vista} o ${parte} direito apareceu à ${direitoNaDireitaDaImagem ? 'direita' : 'esquerda'} do esquerdo na imagem, o contrário do esperado. Confira os lados antes de usar os resultados.`;
    }
  }
  return null;
}

/** Para onde o nariz aponta em relação à orelha (do lado da foto, ou da outra se essa não aparecer); null sem indício claro. */
function olhaParaPeloNariz(lm: Landmark[], lado: LadoPerfil): OlharPara | null {
  const nariz = visivel(lm, INDICE_DO_NARIZ);
  const orelha = visivel(lm, INDICE_DA_PARTE.orelha[lado]) ?? visivel(lm, INDICE_DA_PARTE.orelha[outroLado(lado)]);
  if (!nariz || !orelha || Math.abs(nariz.x - orelha.x) < FOLGA_HORIZONTAL) return null;
  return nariz.x > orelha.x ? 'direita' : 'esquerda';
}

/**
 * Lado do corpo usado nas sugestões do perfil. O informado vale sempre; sem ele, o mais visível (com aviso).
 * Com o lado informado, avisa "confira o lado" se o outro lado aparece claramente melhor ou se o nariz aponta
 * para o lado contrário ao que esse perfil costuma mostrar.
 */
export function escolherLadoDoPerfil(lm: Landmark[], lado?: LadoPerfil): { lado: LadoPerfil; avisos: string[] } {
  if (!lado) {
    const escolhido = ladoMaisVisivel(lm);
    return { lado: escolhido, avisos: [`Lado do perfil não informado: usei o lado ${nomeDoLado(escolhido)} do paciente, o mais visível para o modelo. Confira.`] };
  }
  const avisos: string[] = [];
  const outro = outroLado(lado);
  if (visibilidadeDoLado(lm, outro) - visibilidadeDoLado(lm, lado) >= DIFERENCA_VISIBILIDADE_CLARA) {
    avisos.push(`Confira o lado: nesta foto de perfil ${nomeDoLado(lado)} o modelo enxergou melhor o lado ${nomeDoLado(outro)} do corpo.`);
  }
  const observado = olhaParaPeloNariz(lm, lado);
  const esperado = olhaParaDoLado(lado);
  if (observado && observado !== esperado) {
    avisos.push(`Confira o lado: o nariz aponta para a ${observado} da imagem, mas no perfil ${nomeDoLado(lado)} o paciente costuma aparecer olhando para a ${esperado}. Se o lado estiver certo, corrija “para onde o paciente olha”.`);
  }
  return { lado, avisos };
}

export interface OpcoesSugestao {
  /** Troca direito e esquerdo antes de sugerir (o modelo rotulou os lados do paciente ao contrário). */
  inverterDE?: boolean;
}

export interface SugestaoDePontos {
  /** Pontos sugeridos por id de medida, na ordem de marcação; podem ser só os primeiros pontos (o resto é à mão). */
  sugeridos: Record<string, Ponto[]>;
  /** Medidas com sugestão automática que ficaram sem ela, com o motivo ("não achei o cotovelo direito"). */
  descartados: { medidaId: string; motivo: string }[];
  /** Avisos para o profissional (lado do perfil, direito e esquerdo trocados). */
  avisos: string[];
  /** De onde veio cada sugestão ("centro do ombro (modelo)"), por id de medida. */
  origens: Record<string, string>;
  /** Lado do perfil usado (o informado ou, sem ele, o mais visível); só no perfil. */
  ladoUsado?: LadoPerfil;
}

/**
 * Converte os pontos do detector em marcações das medidas, percorrendo as medidas da vista que sabem se sugerir.
 * O modelo marca centros articulares, não os pontos ósseos usados na clínica (acrômio, crista ilíaca, C7, trocânter):
 * por isso é só um ponto de partida que o profissional confere e ajusta. Medidas sem ponto confiável vão para `descartados`
 * com o motivo; medidas só à mão (`semAuto`) e o fio de prumo (`pontosDoPrumo`) ficam de fora.
 */
export function sugerirPontos(lm: Landmark[], vista: Vista, w: number, h: number, lado?: LadoPerfil, opcoes: OpcoesSugestao = {}): SugestaoDePontos {
  const pontos = opcoes.inverterDE ? trocarDireitaEsquerda(lm) : lm;
  const sugeridos: Record<string, Ponto[]> = {};
  const descartados: SugestaoDePontos['descartados'] = [];
  const origens: Record<string, string> = {};
  const avisos: string[] = [];
  let ladoUsado: LadoPerfil | undefined;
  if (vista === 'perfil') {
    const escolha = escolherLadoDoPerfil(pontos, lado);
    ladoUsado = escolha.lado;
    avisos.push(...escolha.avisos);
  } else {
    const troca = conferirDireitaEsquerda(pontos, vista);
    if (troca) avisos.push(troca);
  }
  const contexto: ContextoSugestao = { w, h, vista, lado: ladoUsado };
  for (const m of medidasDaVista(vista)) {
    const r = m.sugerir?.(pontos, contexto);
    if (!r) continue;
    if ('motivo' in r) {
      descartados.push({ medidaId: m.id, motivo: r.motivo });
      continue;
    }
    if (!r.pontos.length) continue;
    sugeridos[m.id] = r.pontos;
    const origem = r.origem ?? m.origemSugestao;
    if (origem) origens[m.id] = origem;
  }
  return { sugeridos, descartados, avisos, origens, ...(ladoUsado ? { ladoUsado } : {}) };
}

/**
 * Pontos sugeridos por medida (só o dicionário de `sugerirPontos`). Sem o lado, o perfil usa o lado mais visível.
 * A "pelve" (cristas ilíacas) não é sugerida: a sugestão com os quadris vem em "quadris".
 */
export function pontosAutomaticos(lm: Landmark[], vista: Vista, w: number, h: number, lado?: LadoPerfil): Record<string, Ponto[]> {
  return sugerirPontos(lm, vista, w, h, lado).sugeridos;
}

export interface SugestaoPrumo {
  medidaId: 'prumo-perfil' | 'prumo-frente';
  /** Apoio do fio seguido dos pontos, na ordem de marcação da medida. */
  pontos: Ponto[];
  /** Lado da imagem para onde o paciente olha (só no perfil, se o nariz for visível). */
  olhaPara?: OlharPara;
  /** Avisos para o profissional ("confira o lado", direito e esquerdo trocados); vazio se nada a avisar. */
  avisos: string[];
}

/**
 * Pontos sugeridos para o fio de prumo a partir da pose. O apoio fica no tornozelo (de perfil) ou
 * entre os tornozelos; o profissional confere e arrasta o que estiver fora do lugar. De perfil usa o lado
 * informado (sem ele, o mais visível, com aviso). Devolve null se algum ponto não for confiável.
 */
export function pontosDoPrumo(lm: Landmark[], vista: Vista, w: number, h: number, lado?: LadoPerfil): SugestaoPrumo | null {
  const pega = (i: number): Ponto | null => {
    const l = visivel(lm, i);
    return l ? { x: l.x * w, y: l.y * h } : null;
  };
  if (vista === 'perfil') {
    const escolha = escolherLadoDoPerfil(lm, lado);
    const L = escolha.lado;
    const apoio = pega(INDICE_DA_PARTE.tornozelo[L]);
    const orelha = pega(INDICE_DA_PARTE.orelha[L]), ombro = pega(INDICE_DA_PARTE.ombro[L]);
    const quadril = pega(INDICE_DA_PARTE.quadril[L]), joelho = pega(INDICE_DA_PARTE.joelho[L]);
    if (!apoio || !orelha || !ombro || !quadril || !joelho) return null;
    const nariz = pega(INDICE_DO_NARIZ);
    return {
      medidaId: 'prumo-perfil', pontos: [apoio, orelha, ombro, quadril, joelho], avisos: escolha.avisos,
      ...(nariz ? { olhaPara: nariz.x > orelha.x ? 'direita' as const : 'esquerda' as const } : {}),
    };
  }
  const tD = pega(INDICE_DA_PARTE.tornozelo.D), tE = pega(INDICE_DA_PARTE.tornozelo.E), eD = pega(INDICE_DA_PARTE.orelha.D), eE = pega(INDICE_DA_PARTE.orelha.E);
  const oD = pega(INDICE_DA_PARTE.ombro.D), oE = pega(INDICE_DA_PARTE.ombro.E), qD = pega(INDICE_DA_PARTE.quadril.D), qE = pega(INDICE_DA_PARTE.quadril.E);
  if (!tD || !tE || !eD || !eE || !oD || !oE || !qD || !qE) return null;
  const troca = conferirDireitaEsquerda(lm, vista);
  return { medidaId: 'prumo-frente', pontos: [pontoMedio(tD, tE), pontoMedio(eD, eE), pontoMedio(oD, oE), pontoMedio(qD, qE)], avisos: troca ? [troca] : [] };
}

export interface Enquadramento { ok: boolean; mensagem: string }

/** Os ombros ficam a cerca de 82% da altura do corpo: a cabeça sobe uns 22% da distância dos ombros aos pés acima deles. */
const CABECA_ACIMA_DOS_OMBROS = 0.22;

/**
 * Diz se o corpo está inteiro, centralizado e com bom tamanho no quadro, para guiar a distância da foto. Sem nariz visível
 * (de costas, com cabelo cobrindo as orelhas) o topo da cabeça é estimado pelos ombros; sem eles não dá para opinar.
 */
export function avaliarEnquadramento(lm: Landmark[] | null): Enquadramento {
  if (!lm) return { ok: false, mensagem: 'Não achei o corpo. Posicione o paciente no centro do quadro.' };
  const vis = (i: number) => (lm[i]?.visibility ?? 0) >= 0.5;
  const pes = [28, 27].filter(vis).map((i) => lm[i]);
  if (!pes.length) return { ok: false, mensagem: 'Afaste-se: o corpo precisa aparecer inteiro, da cabeça aos pés.' };
  const base = Math.max(...pes.map((p) => p.y));
  const ombros = [11, 12].filter(vis).map((i) => lm[i].y);
  let topo: number;
  if (vis(0)) {
    topo = lm[0].y;
  } else if (ombros.length) {
    const alturaDosOmbros = ombros.reduce((s, v) => s + v, 0) / ombros.length;
    topo = alturaDosOmbros - CABECA_ACIMA_DOS_OMBROS * (base - alturaDosOmbros);
  } else {
    return { ok: false, mensagem: 'Não achei a cabeça nem os ombros. Posicione o paciente no centro do quadro.' };
  }
  if (topo < 0.02 || base > 0.985) return { ok: false, mensagem: 'Afaste-se: a cabeça ou os pés estão cortados.' };
  const altura = base - topo;
  if (altura < 0.55) return { ok: false, mensagem: 'Aproxime-se um pouco: o corpo está pequeno no quadro.' };
  if (altura > 0.9) return { ok: false, mensagem: 'Afaste-se um pouco: o corpo está grande demais no quadro.' };
  const meio = [11, 12, 23, 24].filter(vis).map((i) => lm[i].x);
  const cx = meio.length ? meio.reduce((s, v) => s + v, 0) / meio.length : lm[0].x;
  if (cx < 0.35 || cx > 0.65) return { ok: false, mensagem: 'Centralize o paciente no quadro.' };
  return { ok: true, mensagem: 'Enquadramento bom. Pode fotografar.' };
}
