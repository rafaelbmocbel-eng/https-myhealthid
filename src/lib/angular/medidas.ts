import type { LadoPerfil } from './tiposSessao';
import type { Landmark } from './pose';

export interface Ponto { x: number; y: number }

export type Vista = 'frente' | 'costas' | 'perfil';

const RAD = 180 / Math.PI;

/** Ângulo interno em `b` formado por a–b–c, em graus (0–180). */
export function anguloEm(a: Ponto, b: Ponto, c: Ponto): number | null {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const n1 = Math.hypot(v1.x, v1.y);
  const n2 = Math.hypot(v2.x, v2.y);
  if (n1 === 0 || n2 === 0) return null;
  const cos = Math.min(1, Math.max(-1, (v1.x * v2.x + v1.y * v2.y) / (n1 * n2)));
  return Math.acos(cos) * RAD;
}

/** Inclinação em graus da reta a→b em relação à horizontal da imagem, com sinal (positivo: b mais baixo que a). */
export function inclinacaoHorizontal(a: Ponto, b: Ponto): number | null {
  if (a.x === b.x && a.y === b.y) return null;
  return Math.atan2(b.y - a.y, b.x - a.x) * RAD;
}

/** Ângulo agudo (0–90) entre a reta a–b e a horizontal. */
export function anguloComHorizontal(a: Ponto, b: Ponto): number | null {
  if (a.x === b.x && a.y === b.y) return null;
  return Math.atan2(Math.abs(b.y - a.y), Math.abs(b.x - a.x)) * RAD;
}

/** Desvio em graus (0–90) da reta a–b em relação à vertical. */
export function desvioDaVertical(a: Ponto, b: Ponto): number | null {
  if (a.x === b.x && a.y === b.y) return null;
  return Math.atan2(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) * RAD;
}

export const pontoMedio = (a: Ponto, b: Ponto): Ponto => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export const distancia = (a: Ponto, b: Ponto) => Math.hypot(a.x - b.x, a.y - b.y);

/** Rotaciona p em torno da origem; graus positivos giram no sentido horário da imagem (y para baixo). */
export function girar(p: Ponto, graus: number): Ponto {
  const r = (graus * Math.PI) / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
}

const normalizar180 = (a: number) => {
  let v = a;
  while (v > 90) v -= 180;
  while (v <= -90) v += 180;
  return v;
};

/**
 * Quanto a foto está girada, a partir de uma reta que na vida real é horizontal
 * (chão, fita, régua) ou vertical (fio de prumo, batente). Para nivelar, gire os pontos por −resultado.
 */
export function rotacaoDoNivel(a: Ponto, b: Ponto, tipo: 'horizontal' | 'vertical'): number | null {
  const ang = inclinacaoHorizontal(a, b);
  if (ang === null) return null;
  return normalizar180(tipo === 'horizontal' ? ang : ang - 90);
}

/** Centímetros por pixel, a partir de dois pontos sobre um objeto de comprimento conhecido. */
export function cmPorPixel(a: Ponto, b: Ponto, cm: number): number | null {
  const d = distancia(a, b);
  return d > 0 && cm > 0 ? cm / d : null;
}

/** Ângulo agudo (0–90) entre as retas a–b e c–d. */
export function anguloEntreRetas(a: Ponto, b: Ponto, c: Ponto, d: Ponto): number | null {
  const u = { x: b.x - a.x, y: b.y - a.y }, v = { x: d.x - c.x, y: d.y - c.y };
  const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
  if (nu === 0 || nv === 0) return null;
  const cos = Math.min(1, Math.abs(u.x * v.x + u.y * v.y) / (nu * nv));
  return Math.acos(cos) * RAD;
}

/** Ângulo (0–180) entre dois vetores; null se algum for nulo. */
export function anguloEntreVetores(u: Ponto, v: Ponto): number | null {
  const nu = Math.hypot(u.x, u.y), nv = Math.hypot(v.x, v.y);
  if (nu === 0 || nv === 0) return null;
  return Math.acos(Math.min(1, Math.max(-1, (u.x * v.x + u.y * v.y) / (nu * nv)))) * RAD;
}

/** Ângulo orientado de u para v, em graus (−180 a 180); positivo = sentido horário na tela (y para baixo). */
export function anguloOrientado(u: Ponto, v: Ponto): number | null {
  if (Math.hypot(u.x, u.y) === 0 || Math.hypot(v.x, v.y) === 0) return null;
  return Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y) * RAD;
}

/**
 * Para onde o paciente olha na imagem em cada perfil. No perfil D a câmera fica do lado direito do paciente e olha para ele; para
 * quem olha dali, a frente do paciente aparece à DIREITA da imagem. No perfil E, à ESQUERDA.
 * É raciocínio geométrico (a validar com uma foto real de cada lado): o profissional pode corrigir em "para onde o paciente olha".
 */
export const olhaParaDoLado = (lado: LadoPerfil): OlharPara => (lado === 'D' ? 'direita' : 'esquerda');

/** Lado da imagem para onde o paciente olha: o informado no contexto ou, sem ele, o que decorre do lado do perfil. */
export const olhaParaDoContexto = (ctx?: ContextoMedida): OlharPara | undefined =>
  ctx?.olhaPara ?? (ctx?.lado ? olhaParaDoLado(ctx.lado) : undefined);

/**
 * Lado da imagem onde fica o lado de FORA (lateral) do membro do lado indicado: de frente o lado direito do paciente
 * aparece à esquerda da imagem; de costas, à direita.
 */
export function ladoLateralNaImagem(lado: LadoPerfil, vista: 'frente' | 'costas'): OlharPara {
  return (lado === 'D') === (vista === 'frente') ? 'esquerda' : 'direita';
}

/**
 * Para que lado da imagem o segmento de baixo `w` desvia do prolongamento do segmento de cima `u`.
 * Vale também com `u` apontando para cima. Devolve null se não houver desvio ou se `u` estiver a 45° ou mais da vertical:
 * com o segmento deitado, "esquerda" e "direita" da imagem deixam de querer dizer "para fora" e "para dentro" do corpo.
 */
export function ladoDoDesvio(u: Ponto, w: Ponto): OlharPara | null {
  const cruz = u.x * w.y - u.y * w.x;
  if (Math.abs(u.y) <= Math.abs(u.x) || Math.abs(cruz) < 1e-9) return null;
  return (cruz > 0) === (u.y > 0) ? 'esquerda' : 'direita';
}

/**
 * Palavras fixas do "sentido" das medidas. O comparador pareia as avaliações por elas (lado trocado = sem subtração),
 * então nunca troque por sinônimos nem reescreva com outra grafia.
 */
export const SENTIDO = {
  valgo: 'valgo', varo: 'varo',
  flexao: 'flexão', hiperextensao: 'hiperextensão',
  afastadoDoTronco: 'afastado do tronco', juntoDoTronco: 'junto do tronco',
  cotoveloAFrente: 'cotovelo à frente', cotoveloAtras: 'cotovelo atrás',
  joelhoAFrente: 'joelho à frente', joelhoAtras: 'joelho atrás',
  maoParaFora: 'mão para fora', maoParaDentro: 'mão para dentro',
} as const;

/** Abaixo disto (graus) a medida é tratada como alinhada: não há lado a dizer. */
const LIMITE_SENTIDO = 0.05;

export type GrupoMedida = 'postura' | 'ferramenta' | 'referencia';

/** Referência do compasso com referência: a direção fixa contra a qual o braço é medido (lados da imagem). */
export type RefCompasso = 'baixo' | 'cima' | 'esquerda' | 'direita';

export const REFS_COMPASSO: { id: RefCompasso; nome: string; frase: string; vetor: Ponto }[] = [
  { id: 'baixo', nome: 'Vertical para baixo', frase: 'vertical para baixo', vetor: { x: 0, y: 1 } },
  { id: 'cima', nome: 'Vertical para cima', frase: 'vertical para cima', vetor: { x: 0, y: -1 } },
  { id: 'esquerda', nome: 'Horizontal para a esquerda', frase: 'horizontal para a esquerda da imagem', vetor: { x: -1, y: 0 } },
  { id: 'direita', nome: 'Horizontal para a direita', frase: 'horizontal para a direita da imagem', vetor: { x: 1, y: 0 } },
];

export type UnidadePrumo = 'graus' | 'cm' | 'pct';
export type OlharPara = 'esquerda' | 'direita';
export type UnidadeResultado = 'graus' | 'cm' | '%';

export interface ContextoMedida {
  cmPorPx: number | null;
  /** Vista da foto: diz de que lado do paciente fica a direita da imagem. */
  vista?: Vista;
  refCompasso?: RefCompasso;
  /** Unidade em que o fio de prumo informa o desvio. */
  unidadePrumo?: UnidadePrumo;
  /** Para onde o paciente olha na foto de perfil (lado da imagem). */
  olhaPara?: OlharPara;
  /** Lado do paciente voltado para a câmera no perfil (D ou E). Sem isso, o perfil é "lado não informado". */
  lado?: LadoPerfil;
  /** Altura do paciente na foto, em pixels (referência para o desvio em % da altura). */
  alturaPx?: number | null;
}

/** Como a medida é desenhada com o estilo das linhas. */
export type TipoDesenho =
  | 'angulo3' | 'compasso' | 'compasso-ref' | 'horizontal' | 'vertical' | 'retas' | 'angulo-q' | 'regua' | 'prumo' | 'referencia' | 'segmento-vertical';

/** Um dos resultados de uma medida que informa vários valores (fio de prumo: um desvio por ponto). */
export interface ResultadoParcial {
  /** Sufixo do id do resultado (o id final é `${medida.id}-${id}`); já inclui a unidade. */
  id: string;
  nome: string;
  valor: number;
  unidade: UnidadeResultado;
  texto: string;
  /** Nome curto que antecede o valor no rótulo desenhado sobre a foto (ex.: "Orelha"). */
  curto: string;
  /** Lado do desvio em poucas palavras (ex.: "à frente do fio"), para quem mostra só o número. */
  sentido?: string;
  /** Índice do ponto da medida onde o rótulo é desenhado. */
  ponto: number;
}

export interface Medida {
  id: string;
  nome: string;
  vistas: Vista[];
  grupo: GrupoMedida;
  /** Rótulo de cada ponto a marcar, na ordem. */
  pontos: string[];
  /** Pares de índices de pontos a ligar por uma reta; sem isso, liga os pontos em sequência. */
  segmentos?: [number, number][];
  /** Medida de apoio (nível e escala): não entra no resultado nem no prontuário. */
  auxiliar?: boolean;
  /** Unidade do valor; sem isso, graus. */
  unidade?: 'cm';
  /** Resultado numérico e a frase que o descreve. */
  calcular: (p: Ponto[], ctx?: ContextoMedida) => { valor: number; texto: string; sentido?: string } | null;
  /** O valor tem sinal (inclinação pélvica, retropé): o rótulo mostra o valor absoluto e o texto diz o lado. */
  comSinal?: boolean;
  /** Como é desenhada (arcos, referências e rótulo). Sem isso, só as retas e os pontos. */
  desenho?: TipoDesenho;
  /** Medidas com vários resultados (fio de prumo); `calcular` devolve o primeiro. */
  calcularVarios?: (p: Ponto[], ctx?: ContextoMedida) => ResultadoParcial[];
  /** Definição dos pontos e do valor, mostrada no card da ferramenta. */
  definicao?: string;
  /** Cor fixa das linhas de uma referência da foto (nível, escala, altura). */
  corReferencia?: string;
  /**
   * Marcação automática: de onde vêm os pontos, a partir dos 33 pontos do modelo. Devolve os primeiros pontos da medida
   * (pode ser só parte deles; o resto é à mão), `{ motivo }` se faltou algum ponto confiável ou null se a medida não se aplica
   * (ex.: o braço do lado de trás da câmera num perfil).
   */
  sugerir?: (lm: Landmark[], c: ContextoSugestao) => ResultadoSugestao;
  /** Texto curto do que o modelo realmente marca, mostrado junto da sugestão (ex.: "centro do ombro (modelo)"). */
  origemSugestao?: string;
  /** A medida só se marca à mão, de propósito (sem sugestão automática). */
  semAuto?: boolean;
  /** Por que não há sugestão automática, em poucas palavras. */
  motivoSemAuto?: string;
  /** Resultados a mais, calculados dos mesmos pontos (ex.: o desnível dos ombros também em cm, quando há escala). */
  extras?: ExtraDaMedida[];
}

/** Resultado a mais de uma medida; o id final é `${medida.id}-${id}` e a unidade já vai no sufixo (ex.: "ombros-cm"). */
export interface ExtraDaMedida {
  id: string;
  nome: string;
  unidade: UnidadeResultado;
  calcular: (p: Ponto[], ctx?: ContextoMedida) => { valor: number; texto: string; sentido?: string } | null;
}

/** Contexto da sugestão automática de pontos. */
export interface ContextoSugestao {
  /** Tamanho da foto em px (os pontos do modelo vêm normalizados de 0 a 1). */
  w: number;
  h: number;
  vista: Vista;
  /** Lado do perfil informado pelo profissional; sem ele, as medidas de perfil usam o lado mais visível. */
  lado?: LadoPerfil;
}

export type ResultadoSugestao = { pontos: Ponto[]; origem?: string } | { motivo: string } | null;

// --- pontos do modelo de pose (33 pontos do MediaPipe; "esquerdo" e "direito" são os do paciente) ---------------------------

export type ParteDoCorpo = 'olho' | 'orelha' | 'ombro' | 'cotovelo' | 'punho' | 'quadril' | 'joelho' | 'tornozelo';

export const INDICE_DA_PARTE: Record<ParteDoCorpo, Record<LadoPerfil, number>> = {
  olho: { D: 5, E: 2 }, orelha: { D: 8, E: 7 }, ombro: { D: 12, E: 11 }, cotovelo: { D: 14, E: 13 }, punho: { D: 16, E: 15 },
  quadril: { D: 24, E: 23 }, joelho: { D: 26, E: 25 }, tornozelo: { D: 28, E: 27 },
};

export const INDICE_DO_NARIZ = 0;

/** Abaixo desta visibilidade o ponto do modelo não é usado. */
export const VISIBILIDADE_MINIMA = 0.5;

const FRASE_DA_PARTE: Record<ParteDoCorpo, { artigo: 'o' | 'a'; nome: string }> = {
  olho: { artigo: 'o', nome: 'olho' }, orelha: { artigo: 'a', nome: 'orelha' }, ombro: { artigo: 'o', nome: 'ombro' },
  cotovelo: { artigo: 'o', nome: 'cotovelo' }, punho: { artigo: 'o', nome: 'punho' }, quadril: { artigo: 'o', nome: 'quadril' },
  joelho: { artigo: 'o', nome: 'joelho' }, tornozelo: { artigo: 'o', nome: 'tornozelo' },
};

/** "o cotovelo direito", "a orelha esquerda". */
export function fraseDaParte(parte: ParteDoCorpo, lado: LadoPerfil): string {
  const { artigo, nome } = FRASE_DA_PARTE[parte];
  const adjetivo = lado === 'D' ? 'direit' : 'esquerd';
  return `${artigo} ${nome} ${adjetivo}${artigo === 'a' ? 'a' : 'o'}`;
}

const juntarComE = (itens: string[]) => (itens.length <= 1 ? itens.join('') : `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`);

/** Soma da visibilidade de ombro, quadril, joelho e tornozelo de um lado: quanto mais alta, mais o modelo enxerga esse lado. */
export function visibilidadeDoLado(lm: Landmark[], lado: LadoPerfil): number {
  return (['ombro', 'quadril', 'joelho', 'tornozelo'] as const).reduce((soma, parte) => soma + (lm[INDICE_DA_PARTE[parte][lado]]?.visibility ?? 0), 0);
}

/** Lado do corpo mais visível para o modelo (empate: esquerdo). */
export const ladoMaisVisivel = (lm: Landmark[]): LadoPerfil => (visibilidadeDoLado(lm, 'E') >= visibilidadeDoLado(lm, 'D') ? 'E' : 'D');

/** Lado do perfil da sugestão: o informado ou, sem ele, o mais visível. */
const ladoDaSugestao = (lm: Landmark[], c: ContextoSugestao): LadoPerfil => c.lado ?? ladoMaisVisivel(lm);

/** Lê as partes pedidas (na ordem) em px da foto; se alguma faltar, diz quais ("não achei o cotovelo direito"). */
function lerPontos(lm: Landmark[], c: ContextoSugestao, partes: [ParteDoCorpo, LadoPerfil][]): { pontos: Ponto[] } | { motivo: string } {
  const pontos: Ponto[] = [];
  const faltam: string[] = [];
  for (const [parte, lado] of partes) {
    const l = lm[INDICE_DA_PARTE[parte][lado]];
    if (!l || (l.visibility ?? 1) < VISIBILIDADE_MINIMA) faltam.push(fraseDaParte(parte, lado));
    else pontos.push({ x: l.x * c.w, y: l.y * c.h });
  }
  return faltam.length ? { motivo: `não achei ${juntarComE(faltam)}` } : { pontos };
}

const sugerirPar = (parte: ParteDoCorpo) => (lm: Landmark[], c: ContextoSugestao): ResultadoSugestao => lerPontos(lm, c, [[parte, 'D'], [parte, 'E']]);

/** Partes de um lado só: no perfil, o lado da foto; de frente e de costas, o lado da própria medida. */
const sugerirDoLado = (partes: ParteDoCorpo[], lado?: LadoPerfil) => (lm: Landmark[], c: ContextoSugestao): ResultadoSugestao => {
  const L = lado ?? ladoDaSugestao(lm, c);
  return lerPontos(lm, c, partes.map((p) => [p, L] as [ParteDoCorpo, LadoPerfil]));
};

/** Só o perfil do lado da própria medida tem esse membro à vista; o do outro lado fica atrás do corpo. */
const sugerirDoLadoNoPerfil = (partes: ParteDoCorpo[], lado: LadoPerfil) => (lm: Landmark[], c: ContextoSugestao): ResultadoSugestao => {
  if (c.vista === 'perfil' && ladoDaSugestao(lm, c) !== lado) return null;
  return lerPontos(lm, c, partes.map((p) => [p, lado] as [ParteDoCorpo, LadoPerfil]));
};

const f1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

// Os pontos de "direito" e "esquerdo" são sempre os do paciente, não os da imagem:
// assim o resultado diz o lado certo tanto na foto de frente quanto na de costas.
function desnivel(nomeLinha: string, direito: Ponto, esquerdo: Ponto) {
  const ang = anguloComHorizontal(direito, esquerdo);
  if (ang === null) return null;
  const dy = direito.y - esquerdo.y;
  if (Math.abs(dy) < 1e-9) return { valor: 0, texto: `${nomeLinha} nivelada (0,0°).` };
  const lado = dy < 0 ? 'direito' : 'esquerdo';
  return { valor: ang, texto: `${nomeLinha}: ${f1(ang)}° com a horizontal, lado ${lado} mais alto.` };
}

/** Diferença de altura entre os dois pontos em cm; o lado mais alto vem escrito no texto, como no desnível em graus. */
function desnivelEmCm(nomeLinha: string, direito: Ponto, esquerdo: Ponto, cmPorPx?: number | null) {
  if (!cmPorPx) return null;
  const dy = direito.y - esquerdo.y;
  if (Math.abs(dy) < 1e-9) return { valor: 0, texto: `${nomeLinha} nivelada (0,0 cm).` };
  const cm = Math.abs(dy) * cmPorPx;
  const lado = dy < 0 ? 'direito' : 'esquerdo';
  return { valor: cm, texto: `${nomeLinha}: diferença de altura de ${f1(cm)} cm, lado ${lado} mais alto (estimativa pela escala marcada; vale para pontos à mesma distância da câmera).` };
}

type AlvoPrumo = { slug: string; nome: string };
const ALVOS_PRUMO: Record<'prumo-perfil' | 'prumo-frente', AlvoPrumo[]> = {
  'prumo-perfil': [{ slug: 'orelha', nome: 'Orelha' }, { slug: 'ombro', nome: 'Ombro' }, { slug: 'quadril', nome: 'Quadril' }, { slug: 'joelho', nome: 'Joelho' }],
  'prumo-frente': [{ slug: 'cabeca', nome: 'Cabeça' }, { slug: 'c7', nome: 'C7' }, { slug: 'pelve', nome: 'Pelve' }],
};
const NOME_UNIDADE_PRUMO: Record<UnidadePrumo, string> = { graus: 'graus', cm: 'cm', pct: '% da altura' };

/**
 * Desvio de cada ponto em relação ao fio de prumo, que desce na vertical pelo apoio (p[0]).
 * Perfil: positivo = à frente do fio (para onde o paciente olha). Frente e costas: positivo = lado
 * direito do paciente. Só informa o valor medido; não classifica como normal ou alterado.
 */
function desviosDoPrumo(medida: 'prumo-perfil' | 'prumo-frente', p: Ponto[], ctx?: ContextoMedida): ResultadoParcial[] {
  const [apoio, ...pts] = p;
  if (!apoio) return [];
  const unidade = ctx?.unidadePrumo ?? 'graus';
  const perfil = medida === 'prumo-perfil';
  const olha = olhaParaDoContexto(ctx) ?? 'direita';
  const sinal = perfil ? (olha === 'direita' ? 1 : -1) : ctx?.vista === 'frente' ? -1 : 1;
  const mais = perfil ? 'à frente do fio' : ctx?.vista ? 'para a direita do paciente' : 'para a direita da imagem';
  const menos = perfil ? 'atrás do fio' : ctx?.vista ? 'para a esquerda do paciente' : 'para a esquerda da imagem';
  const orientacao = perfil ? `olhando para a ${olha} da imagem` : '';
  return ALVOS_PRUMO[medida].flatMap(({ slug, nome }, i): ResultadoParcial[] => {
    const q = pts[i];
    if (!q) return [];
    const dx = (q.x - apoio.x) * sinal;
    let valor: number;
    let un: UnidadeResultado;
    if (unidade === 'cm') {
      if (!ctx?.cmPorPx) return [];
      valor = dx * ctx.cmPorPx; un = 'cm';
    } else if (unidade === 'pct') {
      if (!ctx?.alturaPx || ctx.alturaPx <= 0) return [];
      valor = (dx / ctx.alturaPx) * 100; un = '%';
    } else {
      const dy = apoio.y - q.y;
      if (dy <= 0) return [];
      valor = Math.atan2(dx, dy) * RAD; un = 'graus';
    }
    const abs = Math.abs(valor);
    const num = un === 'cm' ? `${f1(abs)} cm` : un === '%' ? `${f1(abs)}%` : `${f1(abs)}°`;
    const lado = abs < 0.05 ? 'sobre o fio' : valor > 0 ? mais : menos;
    const detalhe = un === 'graus' ? 'reta apoio–ponto com a vertical' : un === '%' ? '% da altura marcada' : '';
    const nota = [detalhe, orientacao].filter(Boolean).join('; ');
    return [{
      id: `${slug}-${unidade}`, nome: `Fio de prumo: ${nome.toLowerCase()} (${NOME_UNIDADE_PRUMO[unidade]})`, valor, unidade: un,
      texto: `Fio de prumo, ${nome === 'C7' ? 'C7' : nome.toLowerCase()}: ${num} ${lado}${nota ? ` (${nota})` : ''}.`,
      curto: nome, sentido: lado, ponto: i + 1,
    }];
  });
}

/** Nome legível de um resultado salvo; reconhece os ids compostos do fio de prumo. */
export function nomeDoResultado(id: string): string | null {
  const m = MEDIDAS.find((x) => x.id === id);
  if (m) return m.nome;
  const extra = extraDoResultado(id);
  if (extra) return extra.nome;
  const r = /^(prumo-perfil|prumo-frente)-([a-z0-9]+)-(cm|pct|graus)$/.exec(id);
  if (!r) return null;
  const alvo = ALVOS_PRUMO[r[1] as 'prumo-perfil' | 'prumo-frente'].find((a) => a.slug === r[2]);
  return alvo ? `Fio de prumo: ${alvo.nome.toLowerCase()} (${NOME_UNIDADE_PRUMO[r[3] as UnidadePrumo]})` : null;
}

/** Resultado a mais de uma medida (ex.: "ombros-cm") pelo id final; null se o id não for de um extra. */
function extraDoResultado(id: string): ExtraDaMedida | null {
  for (const m of MEDIDAS) {
    const extra = m.extras?.find((e) => `${m.id}-${e.id}` === id);
    if (extra) return extra;
  }
  return null;
}

/** Unidade de um resultado pelo id (o fio de prumo leva a unidade no final do id). */
export function unidadeDoResultadoId(id: string): UnidadeResultado {
  if (/-pct$/.test(id) && id.startsWith('prumo-')) return '%';
  if (/-cm$/.test(id) && id.startsWith('prumo-')) return 'cm';
  const extra = extraDoResultado(id);
  if (extra) return extra.unidade;
  return MEDIDAS.find((m) => m.id === id)?.unidade === 'cm' ? 'cm' : 'graus';
}

/** Altura do paciente na foto (px) ao longo da vertical, a partir dos dois pontos da referência de altura (já corrigidos pelo nível). */
export function alturaEmPixels(p: Ponto[] | undefined): number | null {
  if (!p || p.length < 2) return null;
  const h = Math.abs(p[1].y - p[0].y);
  return h > 0 ? h : null;
}

const LADOS = [{ s: 'd', nome: 'direito', fem: 'direita', lado: 'D' }, { s: 'e', nome: 'esquerdo', fem: 'esquerda', lado: 'E' }] as const;

export const MEDIDAS: Medida[] = [
  {
    id: 'ombros', nome: 'Desnível dos ombros', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Acrômio direito do paciente', 'Acrômio esquerdo do paciente'],
    definicao: 'Reta entre os dois ombros, com o ângulo dela com a horizontal e o lado mais alto. Com a escala marcada, mostra também a diferença de altura em cm. O modelo marca o centro do ombro, não o acrômio: confira e ajuste os pontos. O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'centro do ombro (modelo)', sugerir: sugerirPar('ombro'),
    calcular: ([d, e]) => desnivel('Linha dos ombros', d, e),
    extras: [{ id: 'cm', nome: 'Desnível dos ombros (cm)', unidade: 'cm', calcular: ([d, e], ctx) => desnivelEmCm('Linha dos ombros', d, e, ctx?.cmPorPx) }],
  },
  {
    id: 'cotovelos', nome: 'Desnível dos cotovelos', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Cotovelo direito do paciente (epicôndilo lateral)', 'Cotovelo esquerdo do paciente (epicôndilo lateral)'],
    definicao: 'Reta entre os dois cotovelos, com o ângulo dela com a horizontal e o lado mais alto. O modelo marca o centro da articulação, não o epicôndilo. O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'centro do cotovelo (modelo)', sugerir: sugerirPar('cotovelo'),
    calcular: ([d, e]) => desnivel('Linha dos cotovelos', d, e),
  },
  ...LADOS.map(({ s, nome, lado }): Medida => ({
    id: `braco-${s}`, nome: `Alinhamento do braço ${nome}`, vistas: ['frente', 'costas', 'perfil'], grupo: 'postura', desenho: 'segmento-vertical',
    pontos: [`Ombro ${nome} (acrômio)`, `Cotovelo ${nome} (epicôndilo lateral)`],
    definicao: 'Reta do ombro ao cotovelo contra a vertical: 0° é o braço na vertical, para baixo. De frente e de costas, o app diz se o cotovelo está afastado do tronco ou junto dele; de perfil, se está à frente ou atrás do ombro. Vale para a posição parada, com o braço relaxado. O modelo marca o centro da articulação, não o acrômio nem o epicôndilo. Sem classificação.',
    origemSugestao: 'centro do ombro e do cotovelo (modelo)', sugerir: sugerirDoLadoNoPerfil(['ombro', 'cotovelo'], lado),
    calcular: ([o, c], ctx) => {
      const u = { x: c.x - o.x, y: c.y - o.y };
      const ang = anguloEntreVetores(u, { x: 0, y: 1 });
      if (ang === null) return null;
      const base = `Braço ${nome}: ${f1(ang)}° com a vertical (reta ombro–cotovelo)`;
      if (ang < LIMITE_SENTIDO || ang > 180 - LIMITE_SENTIDO) return { valor: ang, texto: `${base}.` };
      if (ctx?.vista === 'frente' || ctx?.vista === 'costas') {
        const afastado = ladoLateralNaImagem(lado, ctx.vista) === (u.x < 0 ? 'esquerda' : 'direita');
        const frase = afastado ? SENTIDO.afastadoDoTronco : SENTIDO.juntoDoTronco;
        return { valor: ang, sentido: frase, texto: `${base}, cotovelo ${frase}.` };
      }
      const olha = ctx?.vista === 'perfil' ? olhaParaDoContexto(ctx) : undefined;
      if (!olha) return { valor: ang, texto: `${base}.` };
      const aFrente = (u.x > 0) === (olha === 'direita');
      return { valor: ang, sentido: aFrente ? SENTIDO.cotoveloAFrente : SENTIDO.cotoveloAtras, texto: `${base}, cotovelo ${aFrente ? 'à frente' : 'atrás'} do ombro.` };
    },
  })),
  {
    id: 'cotovelo-perfil', nome: 'Flexão/extensão do cotovelo', vistas: ['perfil'], grupo: 'postura', desenho: 'angulo-q',
    pontos: ['Ombro (acrômio)', 'Cotovelo (epicôndilo lateral)', 'Punho (meio do punho)'],
    segmentos: [[0, 1], [1, 2]],
    definicao: 'Ângulo entre o prolongamento do braço (ombro–cotovelo) e o antebraço (cotovelo–punho), em foto de perfil: 0° é o braço estendido. O app diz se é flexão ou hiperextensão, a partir de para onde o paciente olha. É uma estimativa no plano da foto, sem classificação.',
    origemSugestao: 'centro do ombro, do cotovelo e do punho (modelo)', sugerir: sugerirDoLado(['ombro', 'cotovelo', 'punho']),
    calcular: ([o, c, p], ctx) => {
      const desvio = anguloOrientado({ x: c.x - o.x, y: c.y - o.y }, { x: p.x - c.x, y: p.y - c.y });
      if (desvio === null) return null;
      const ang = Math.abs(desvio);
      if (ang < LIMITE_SENTIDO) return { valor: 0, texto: 'Cotovelo estendido (0,0° de flexão).' };
      const olha = olhaParaDoContexto(ctx);
      if (!olha) return { valor: ang, texto: `Cotovelo: ${f1(ang)}° entre o prolongamento do braço e o antebraço (0° = braço estendido).` };
      const flexao = olha === 'direita' ? desvio < 0 : desvio > 0;
      return { valor: ang, sentido: flexao ? SENTIDO.flexao : SENTIDO.hiperextensao, texto: `Cotovelo: ${f1(ang)}° de ${flexao ? 'flexão' : 'hiperextensão'} (0° = braço estendido).` };
    },
  },
  ...LADOS.map(({ s, nome, lado }): Medida => ({
    id: `carregamento-${s}`, nome: `Ângulo de carregamento do cotovelo ${nome} (estimativa por foto)`, vistas: ['frente'], grupo: 'postura', desenho: 'angulo-q',
    pontos: [`Ombro ${nome} (acrômio)`, `Cotovelo ${nome} (meio entre os epicôndilos)`, `Punho ${nome} (meio entre as estiloides)`],
    segmentos: [[0, 1], [1, 2]],
    semAuto: true, motivoSemAuto: 'só à mão: o desvio é pequeno e o erro do modelo nesse ponto não foi medido',
    definicao: 'Estimativa por foto, com o cotovelo estendido e a palma para a frente: confirmar com goniômetro. Ângulo entre o prolongamento do braço (ombro–cotovelo) e o antebraço (cotovelo–punho): "valgo" quando o antebraço desvia para fora, "varo" quando desvia para dentro. O app mostra só o valor medido, sem valor de referência.',
    calcular: ([o, c, p], ctx) => {
      const u = { x: c.x - o.x, y: c.y - o.y }, w = { x: p.x - c.x, y: p.y - c.y };
      const desvio = anguloOrientado(u, w);
      if (desvio === null) return null;
      const ang = Math.abs(desvio);
      const base = `Ângulo de carregamento do cotovelo ${nome} (estimativa por foto)`;
      const aviso = 'Confirmar com goniômetro.';
      if (ang < LIMITE_SENTIDO) return { valor: ang, texto: `${base}: ${f1(ang)}° (antebraço alinhado com o braço). ${aviso}` };
      const para = ladoDoDesvio(u, w);
      if (!para) return { valor: ang, texto: `${base}: ${f1(ang)}° entre o prolongamento do braço e o antebraço (sem lado: o braço está deitado na foto). ${aviso}` };
      const valgo = para === ladoLateralNaImagem(lado, ctx?.vista === 'costas' ? 'costas' : 'frente');
      return {
        valor: ang, sentido: valgo ? SENTIDO.valgo : SENTIDO.varo,
        texto: `${base}: ${f1(ang)}° em ${valgo ? 'valgo (antebraço desviado para fora do prolongamento do braço)' : 'varo (antebraço desviado para dentro do prolongamento do braço)'}. ${aviso}`,
      };
    },
  })),
  ...LADOS.map(({ s, nome, fem, lado }): Medida => ({
    id: `punho-${s}`, nome: `Alinhamento antebraço-mão ${nome}`, vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'angulo-q',
    pontos: [`Cotovelo ${nome} (meio entre os epicôndilos)`, `Punho ${nome} (meio entre as estiloides)`, `Eixo da mão ${fem} (cabeça do 3º metacarpo)`],
    segmentos: [[0, 1], [1, 2]],
    semAuto: true, motivoSemAuto: 'só à mão: o modelo não marca o eixo da mão (só mínimo, indicador e polegar)',
    definicao: 'Ângulo entre o prolongamento do antebraço (cotovelo–punho) e o eixo da mão (punho–cabeça do 3º metacarpo). Marque à mão, de preferência com adesivo na pele. O app diz só se a mão desvia para fora ou para dentro do prolongamento do antebraço. Com a palma para a frente isso é desvio radial (fora) ou ulnar (dentro); com a palma voltada para a coxa, a foto de frente mostra flexão ou extensão do punho, e o app não sabe a rotação do antebraço. Sem classificação.',
    calcular: ([c, p, m], ctx) => {
      const u = { x: p.x - c.x, y: p.y - c.y }, w = { x: m.x - p.x, y: m.y - p.y };
      const desvio = anguloOrientado(u, w);
      if (desvio === null) return null;
      const ang = Math.abs(desvio);
      const base = `Antebraço–mão ${nome}: ${f1(ang)}° entre o prolongamento do antebraço e o eixo da mão`;
      const para = ladoDoDesvio(u, w);
      if (ang < LIMITE_SENTIDO || !para || (ctx?.vista !== 'frente' && ctx?.vista !== 'costas')) return { valor: ang, texto: `${base}.` };
      const fora = para === ladoLateralNaImagem(lado, ctx.vista);
      return { valor: ang, sentido: fora ? SENTIDO.maoParaFora : SENTIDO.maoParaDentro, texto: `${base}, mão ${fora ? 'desviada para fora' : 'desviada para dentro'}.` };
    },
  })),
  {
    id: 'escapulas', nome: 'Desnível dos ângulos inferiores das escápulas', vistas: ['costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Ângulo inferior da escápula direita (por palpação ou marcador na pele)', 'Ângulo inferior da escápula esquerda (por palpação ou marcador na pele)'],
    semAuto: true, motivoSemAuto: 'só à mão: o modelo não marca a escápula',
    definicao: 'Reta entre os ângulos inferiores das duas escápulas, em foto de costas. Marque por palpação, de preferência com marcador na pele. A posição parada não mostra como a escápula se comporta no movimento. O app mostra só o ângulo com a horizontal e o lado mais alto, sem classificar.',
    calcular: ([d, e]) => desnivel('Linha dos ângulos inferiores das escápulas', d, e),
  },
  {
    id: 'pelve', nome: 'Desnível da pelve', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Crista ilíaca (ou espinha ilíaca) direita', 'Crista ilíaca (ou espinha ilíaca) esquerda'],
    semAuto: true, motivoSemAuto: 'só à mão: o modelo marca o centro do quadril, não a crista ilíaca (veja "Linha dos quadris")',
    definicao: 'Reta entre as cristas ilíacas (ou as espinhas ilíacas), marcadas à mão. A sugestão do modelo fica em "Linha dos quadris", que é outra medida. O app mostra só o valor medido, sem classificar.',
    calcular: ([d, e]) => desnivel('Linha da pelve', d, e),
  },
  {
    id: 'quadris', nome: 'Linha dos quadris (sugerida pelo modelo)', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Quadril direito do paciente (centro da articulação)', 'Quadril esquerdo do paciente (centro da articulação)'],
    definicao: 'Reta entre os centros das articulações do quadril, como o modelo as marca: não é a crista ilíaca nem o trocânter. Para a pelve pelas cristas, use "Desnível da pelve". O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'centro do quadril (modelo)', sugerir: sugerirPar('quadril'),
    calcular: ([d, e]) => desnivel('Linha dos quadris', d, e),
  },
  {
    id: 'cabeca', nome: 'Inclinação da cabeça', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Orelha (ou olho) direita do paciente', 'Orelha (ou olho) esquerda do paciente'],
    definicao: 'Reta entre as duas orelhas (ou os dois olhos, se a orelha não aparecer), com o ângulo dela com a horizontal e o lado mais alto. O modelo marca a orelha, não o tragus. O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'orelha (modelo); olho, se a orelha não aparecer',
    sugerir: (lm, c) => {
      const orelhas = lerPontos(lm, c, [['orelha', 'D'], ['orelha', 'E']]);
      if ('pontos' in orelhas) return { pontos: orelhas.pontos, origem: 'orelha (modelo)' };
      const olhos = lerPontos(lm, c, [['olho', 'D'], ['olho', 'E']]);
      if ('pontos' in olhos) return { pontos: olhos.pontos, origem: 'olho (modelo), porque as orelhas não apareceram' };
      return { motivo: 'não achei as orelhas nem os olhos' };
    },
    calcular: ([d, e]) => desnivel('Linha da cabeça', d, e),
  },
  {
    id: 'tronco', nome: 'Alinhamento do tronco', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'vertical',
    pontos: ['Base do pescoço (C7)', 'Ponto médio entre os pés ou da pelve'],
    definicao: 'Reta da base do pescoço (C7) ao ponto médio entre os pés ou da pelve, com o desvio dela da vertical e o lado. O modelo não marca o C7: a sugestão usa o ponto médio dos ombros no lugar dele e o ponto médio dos quadris no lugar do ponto de baixo. O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'ponto médio dos ombros no lugar do C7, e ponto médio dos quadris (modelo)',
    sugerir: (lm, c) => {
      const r = lerPontos(lm, c, [['ombro', 'D'], ['ombro', 'E'], ['quadril', 'D'], ['quadril', 'E']]);
      if ('motivo' in r) return r;
      const [oD, oE, qD, qE] = r.pontos;
      return { pontos: [pontoMedio(oD, oE), pontoMedio(qD, qE)] };
    },
    calcular: ([a, b]) => {
      const dev = desvioDaVertical(a, b);
      if (dev === null) return null;
      const lado = b.x === a.x ? '' : (b.x > a.x ? ', pescoço desviado para a esquerda da imagem' : ', pescoço desviado para a direita da imagem');
      return { valor: dev, texto: `Tronco a ${f1(dev)}° da vertical${lado}.` };
    },
  },
  {
    id: 'prumo-frente', nome: 'Fio de prumo (frente e costas)', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'prumo', segmentos: [],
    pontos: ['Apoio do fio (ponto médio entre os pés)', 'Centro da cabeça (entre as orelhas)', 'Base do pescoço (C7)', 'Centro da pelve (entre as cristas ilíacas)'],
    definicao: 'O fio desce na vertical pelo apoio (ponto médio entre os pés). O desvio de cada ponto é a distância horizontal até o fio, para a direita ou a esquerda do paciente. O app mostra só o valor medido, sem classificar.',
    calcular: (p, ctx) => {
      const r = desviosDoPrumo('prumo-frente', p, ctx)[0];
      return r ? { valor: r.valor, texto: r.texto, sentido: r.sentido } : null;
    },
    calcularVarios: (p, ctx) => desviosDoPrumo('prumo-frente', p, ctx),
  },
  {
    id: 'cva', nome: 'Ângulo craniovertebral', vistas: ['perfil'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Tragus (orelha)', 'C7 (vértebra proeminente)'],
    definicao: 'Ângulo da reta C7–tragus com a horizontal. O modelo sugere a orelha no lugar do tragus; o C7 é marcado à mão. O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'orelha (modelo), no lugar do tragus; o C7 é à mão',
    sugerir: (lm, c) => {
      const r = lerPontos(lm, c, [['orelha', ladoDaSugestao(lm, c)]]);
      return 'motivo' in r ? r : { pontos: r.pontos };
    },
    calcular: ([tragus, c7]) => {
      const ang = anguloComHorizontal(c7, tragus);
      if (ang === null) return null;
      return { valor: ang, texto: `Ângulo craniovertebral: ${f1(ang)}° (reta C7–tragus com a horizontal). Quanto menor, mais a cabeça está à frente.` };
    },
  },
  {
    id: 'protracao-ombro', nome: 'Protração do ombro (C7–acrômio)', vistas: ['perfil'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['C7 (vértebra proeminente)', 'Acrômio (ponto mais lateral do ombro)'],
    semAuto: true, motivoSemAuto: 'só à mão: C7 e acrômio são pontos ósseos que o modelo não marca',
    definicao: 'Ângulo entre a reta C7–acrômio e a horizontal. O app mostra só o valor medido; serve para comparar fotos feitas do mesmo jeito.',
    calcular: ([c7, acromio]) => {
      const ang = anguloComHorizontal(c7, acromio);
      if (ang === null) return null;
      return { valor: ang, texto: `Protração do ombro: reta C7–acrômio a ${f1(ang)}° com a horizontal.` };
    },
  },
  {
    id: 'tronco-perfil', nome: 'Inclinação do tronco', vistas: ['perfil'], grupo: 'postura', desenho: 'vertical',
    pontos: ['Ombro (acrômio)', 'Quadril (trocânter maior)'],
    definicao: 'Reta do ombro ao quadril contra a vertical, em foto de perfil. O modelo marca o centro do ombro e do quadril, não o acrômio nem o trocânter. O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'centro do ombro e do quadril (modelo)', sugerir: sugerirDoLado(['ombro', 'quadril']),
    calcular: ([o, q]) => {
      const dev = desvioDaVertical(o, q);
      if (dev === null) return null;
      return { valor: dev, texto: `Tronco (ombro–quadril) a ${f1(dev)}° da vertical.` };
    },
  },
  {
    id: 'cifose', nome: 'Cifose torácica (estimativa de superfície, não é Cobb)', vistas: ['perfil'], grupo: 'postura', desenho: 'retas',
    pontos: ['Reta de cima: 1º ponto (início da curva torácica)', 'Reta de cima: 2º ponto', 'Reta de baixo: 1º ponto', 'Reta de baixo: 2º ponto (fim da curva torácica)'],
    segmentos: [[0, 1], [2, 3]],
    semAuto: true, motivoSemAuto: 'só à mão: o modelo não marca a coluna',
    definicao: 'Estimativa de superfície, não é Cobb: ângulo entre duas retas marcadas sobre a pele, uma em cada ponta da curva torácica (2 pontos para cada reta, de preferência com marcadores na pele). O Cobb de referência vem da radiografia. O app mostra só o valor medido, sem classificar.',
    calcular: ([a, b, c, d]) => {
      const ang = anguloEntreRetas(a, b, c, d);
      return ang === null ? null : { valor: ang, texto: `Cifose torácica (estimativa de superfície): ${f1(ang)}° entre as duas retas marcadas sobre a pele. Não é o ângulo de Cobb da radiografia.` };
    },
  },
  {
    id: 'lordose', nome: 'Lordose lombar (estimativa de superfície, não é Cobb)', vistas: ['perfil'], grupo: 'postura', desenho: 'retas',
    pontos: ['Reta de cima: 1º ponto (início da curva lombar)', 'Reta de cima: 2º ponto', 'Reta de baixo: 1º ponto', 'Reta de baixo: 2º ponto (fim da curva lombar)'],
    segmentos: [[0, 1], [2, 3]],
    semAuto: true, motivoSemAuto: 'só à mão: o modelo não marca a coluna',
    definicao: 'Estimativa de superfície, não é Cobb: ângulo entre duas retas marcadas sobre a pele, uma em cada ponta da curva lombar (2 pontos para cada reta, de preferência com marcadores na pele). O Cobb de referência vem da radiografia. O app mostra só o valor medido, sem classificar.',
    calcular: ([a, b, c, d]) => {
      const ang = anguloEntreRetas(a, b, c, d);
      return ang === null ? null : { valor: ang, texto: `Lordose lombar (estimativa de superfície): ${f1(ang)}° entre as duas retas marcadas sobre a pele. Não é o ângulo de Cobb da radiografia.` };
    },
  },
  {
    id: 'pelve-perfil', nome: 'Inclinação pélvica (perfil)', vistas: ['perfil'], grupo: 'postura', desenho: 'horizontal', comSinal: true,
    pontos: ['EIPS (espinha ilíaca posterossuperior)', 'EIAS (espinha ilíaca anterossuperior)'],
    semAuto: true, motivoSemAuto: 'só à mão: o modelo não marca a EIAS nem a EIPS',
    definicao: 'Ângulo da reta EIPS–EIAS com a horizontal. Positivo = inclinação anterior (EIAS mais baixa que a EIPS); negativo = posterior. O rótulo mostra o valor sem sinal e o texto do resultado diz o lado. Sem classificação.',
    calcular: ([eips, eias]) => {
      const ang = anguloComHorizontal(eips, eias);
      if (ang === null) return null;
      const dy = eias.y - eips.y;
      if (Math.abs(dy) < 1e-9) return { valor: 0, texto: 'Inclinação pélvica (EIPS–EIAS): 0,0° com a horizontal (EIPS e EIAS na mesma altura).' };
      const ant = dy > 0;
      return { valor: ant ? ang : -ang, sentido: ant ? 'anterior' : 'posterior', texto: `Inclinação pélvica (EIPS–EIAS): ${f1(ang)}° com a horizontal, ${ant ? 'anterior (EIAS mais baixa que a EIPS)' : 'posterior (EIAS mais alta que a EIPS)'}.` };
    },
  },
  {
    id: 'prumo-perfil', nome: 'Fio de prumo (perfil)', vistas: ['perfil'], grupo: 'postura', desenho: 'prumo', segmentos: [],
    pontos: ['Apoio do fio (ponto do chão por onde o fio desce)', 'Orelha (tragus)', 'Ombro (acrômio)', 'Quadril (trocânter maior)', 'Joelho (interlinha lateral)'],
    definicao: 'O fio desce na vertical pelo apoio. O desvio de cada ponto é a distância horizontal até o fio, positivo à frente do fio (para onde o paciente olha). O app mostra só o valor medido, sem classificar.',
    calcular: (p, ctx) => {
      const r = desviosDoPrumo('prumo-perfil', p, ctx)[0];
      return r ? { valor: r.valor, texto: r.texto, sentido: r.sentido } : null;
    },
    calcularVarios: (p, ctx) => desviosDoPrumo('prumo-perfil', p, ctx),
  },
  ...LADOS.map(({ s, nome, lado }): Medida => ({
    id: `joelho-${s}`, nome: `Joelho ${nome}`, vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'angulo3',
    pontos: [`Quadril ${nome} (trocânter maior)`, `Joelho ${nome} (interlinha articular)`, `Tornozelo ${nome} (maléolo lateral)`],
    definicao: 'Ângulo quadril–joelho–tornozelo em foto de frente ou de costas (180° é a linha reta). O app diz se o joelho está para dentro da linha quadril–tornozelo (valgo) ou para fora (varo). O modelo marca centros articulares, não a interlinha nem o maléolo. Sem classificação.',
    origemSugestao: 'centro do quadril, do joelho e do tornozelo (modelo)', sugerir: sugerirDoLado(['quadril', 'joelho', 'tornozelo'], lado),
    calcular: ([q, j, t], ctx) => {
      const ang = anguloEm(q, j, t);
      if (ang === null) return null;
      const base = `Joelho ${nome}, quadril–joelho–tornozelo: ${f1(ang)}° (${f1(Math.abs(180 - ang))}° de afastamento da linha reta)`;
      if (ctx?.vista !== 'frente' && ctx?.vista !== 'costas') return { valor: ang, texto: `${base}.` };
      const u = { x: j.x - q.x, y: j.y - q.y };
      const para = ladoDoDesvio(u, { x: t.x - j.x, y: t.y - j.y });
      if (180 - ang < LIMITE_SENTIDO || !para) return { valor: ang, texto: `${base}.` };
      const valgo = para === ladoLateralNaImagem(lado, ctx.vista);
      return { valor: ang, sentido: valgo ? SENTIDO.valgo : SENTIDO.varo, texto: `${base}, em ${valgo ? 'valgo (joelho para dentro da linha quadril–tornozelo)' : 'varo (joelho para fora da linha quadril–tornozelo)'}.` };
    },
  })),
  {
    id: 'linha-joelhos', nome: 'Linha dos joelhos (desnível)', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Joelho direito do paciente (interlinha articular)', 'Joelho esquerdo do paciente (interlinha articular)'],
    definicao: 'Reta entre os dois joelhos, com o ângulo dela com a horizontal e o lado mais alto. O modelo marca o centro da articulação, não a interlinha. O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'centro do joelho (modelo), não a interlinha', sugerir: sugerirPar('joelho'),
    calcular: ([d, e]) => desnivel('Linha dos joelhos', d, e),
  },
  ...LADOS.map(({ s, nome, fem }): Medida => ({
    id: `angulo-q-${s}`, nome: `Ângulo Q ${nome}`, vistas: ['frente'], grupo: 'postura', desenho: 'angulo-q',
    pontos: [`EIAS ${fem} (espinha ilíaca anterossuperior)`, `Centro da patela ${fem}`, `Tuberosidade da tíbia ${fem}`],
    segmentos: [[0, 1], [1, 2]],
    semAuto: true, motivoSemAuto: 'só à mão: o modelo não marca a EIAS, a patela nem a tuberosidade da tíbia',
    definicao: 'Ângulo entre a reta EIAS–centro da patela, prolongada além da patela, e a reta centro da patela–tuberosidade da tíbia. O app mostra só o valor medido, sem classificar como normal ou alterado.',
    calcular: ([eias, patela, tuberosidade]) => {
      const interno = anguloEm(eias, patela, tuberosidade);
      if (interno === null) return null;
      const q = 180 - interno;
      return { valor: q, texto: `Ângulo Q ${nome}: ${f1(q)}° (reta EIAS–patela prolongada com a reta patela–tuberosidade da tíbia).` };
    },
  })),
  {
    id: 'linha-tornozelos', nome: 'Linha dos tornozelos (desnível)', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Tornozelo direito do paciente (maléolo lateral)', 'Tornozelo esquerdo do paciente (maléolo lateral)'],
    definicao: 'Reta entre os dois tornozelos, com o ângulo dela com a horizontal e o lado mais alto. O modelo marca o centro da articulação, não o maléolo. O app mostra só o valor medido, sem classificar.',
    origemSugestao: 'centro do tornozelo (modelo), não o maléolo', sugerir: sugerirPar('tornozelo'),
    calcular: ([d, e]) => desnivel('Linha dos tornozelos', d, e),
  },
  ...LADOS.map(({ s, nome, fem }): Medida => ({
    id: `retrope-${s}`, nome: `Retropé ${nome}`, vistas: ['costas'], grupo: 'postura', desenho: 'retas', comSinal: true,
    pontos: [`Perna ${fem}: ponto de cima (meio da panturrilha)`, `Perna ${fem}: ponto de baixo (tendão do calcâneo, acima do calcanhar)`, `Calcâneo ${nome}: ponto de cima`, `Calcâneo ${nome}: ponto de baixo (base do calcanhar)`],
    segmentos: [[0, 1], [2, 3]],
    semAuto: true, motivoSemAuto: 'só à mão: o modelo não marca o meio da panturrilha nem o eixo do calcâneo',
    definicao: 'Ângulo entre a reta da perna (2 pontos no eixo da perna) e a reta do calcâneo (2 pontos), em foto de costas. Positivo = valgo (parte de baixo do calcanhar deslocada para fora em relação à perna); negativo = varo. O rótulo mostra o valor sem sinal. Sem classificação.',
    calcular: ([a, b, c, d]) => {
      const bruto = anguloOrientado({ x: b.x - a.x, y: b.y - a.y }, { x: d.x - c.x, y: d.y - c.y });
      if (bruto === null) return null;
      const t = normalizar180(bruto);
      const valgo = s === 'd' ? -t : t;
      if (Math.abs(valgo) < 0.05) return { valor: 0, texto: `Retropé ${nome}: 0,0° (reta do calcâneo alinhada com a reta da perna).` };
      return { valor: valgo, sentido: valgo > 0 ? SENTIDO.valgo : SENTIDO.varo, texto: `Retropé ${nome}: ${f1(Math.abs(valgo))}° em ${valgo > 0 ? 'valgo (calcanhar desviado para fora da reta da perna)' : 'varo (calcanhar desviado para dentro da reta da perna)'}.` };
    },
  })),
  {
    id: 'joelho', nome: 'Ângulo do joelho', vistas: ['perfil'], grupo: 'postura', desenho: 'angulo3',
    pontos: ['Quadril (trocânter maior)', 'Joelho (interlinha articular)', 'Tornozelo (maléolo lateral)'],
    definicao: 'Ângulo quadril–joelho–tornozelo em foto de perfil (180° é a linha reta). O app diz se o joelho está à frente (flexão) ou atrás (hiperextensão) da linha quadril–tornozelo, a partir de para onde o paciente olha. O modelo marca centros articulares, não a interlinha nem o maléolo. Sem classificação.',
    origemSugestao: 'centro do quadril, do joelho e do tornozelo (modelo)', sugerir: sugerirDoLado(['quadril', 'joelho', 'tornozelo']),
    calcular: ([q, j, t], ctx) => {
      const ang = anguloEm(q, j, t);
      if (ang === null) return null;
      const base = `Ângulo quadril–joelho–tornozelo: ${f1(ang)}° (${f1(Math.abs(180 - ang))}° de afastamento da linha reta)`;
      const olha = olhaParaDoContexto(ctx);
      const desvio = anguloOrientado({ x: j.x - q.x, y: j.y - q.y }, { x: t.x - j.x, y: t.y - j.y });
      if (!olha || desvio === null || 180 - ang < LIMITE_SENTIDO) return { valor: ang, texto: `${base}.` };
      const flexao = olha === 'direita' ? desvio > 0 : desvio < 0;
      return { valor: ang, sentido: flexao ? SENTIDO.flexao : SENTIDO.hiperextensao, texto: `${base}, em ${flexao ? 'flexão (joelho à frente da linha quadril–tornozelo)' : 'hiperextensão (joelho atrás da linha quadril–tornozelo)'}.` };
    },
  },
  {
    id: 'perna-vertical', nome: 'Perna contra a vertical (joelho–tornozelo)', vistas: ['perfil'], grupo: 'postura', desenho: 'segmento-vertical',
    pontos: ['Joelho (interlinha articular)', 'Tornozelo (maléolo lateral)'],
    definicao: 'Reta do joelho ao tornozelo contra a vertical, em foto de perfil: 0° é a perna na vertical. O app diz se o joelho está à frente ou atrás do tornozelo, a partir de para onde o paciente olha. O modelo marca centros articulares. Sem classificação.',
    origemSugestao: 'centro do joelho e do tornozelo (modelo)', sugerir: sugerirDoLado(['joelho', 'tornozelo']),
    calcular: ([j, t], ctx) => {
      const u = { x: t.x - j.x, y: t.y - j.y };
      const ang = anguloEntreVetores(u, { x: 0, y: 1 });
      if (ang === null) return null;
      const base = `Perna: ${f1(ang)}° com a vertical (reta joelho–tornozelo)`;
      const olha = olhaParaDoContexto(ctx);
      if (!olha || ang < LIMITE_SENTIDO || ang > 180 - LIMITE_SENTIDO) return { valor: ang, texto: `${base}.` };
      const joelhoAFrente = (u.x > 0) === (olha === 'esquerda');
      return { valor: ang, sentido: joelhoAFrente ? SENTIDO.joelhoAFrente : SENTIDO.joelhoAtras, texto: `${base}, joelho ${joelhoAFrente ? 'à frente' : 'atrás'} do tornozelo.` };
    },
  },
  {
    id: 'livre', nome: 'Ângulo livre (3 pontos)', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta', desenho: 'angulo3',
    pontos: ['Primeiro ponto', 'Vértice (onde o ângulo é medido)', 'Terceiro ponto'],
    calcular: ([a, b, c]) => {
      const ang = anguloEm(a, b, c);
      return ang === null ? null : { valor: ang, texto: `Ângulo medido: ${f1(ang)}°.` };
    },
  },
  {
    id: 'compasso', nome: 'Compasso (vértice e dois braços)', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta', desenho: 'compasso',
    pontos: ['Vértice (centro do ângulo)', 'Ponta do braço 1', 'Ponta do braço 2'],
    segmentos: [[0, 1], [0, 2]],
    definicao: 'Marque o vértice e a ponta de cada braço. O app mostra o ângulo entre os braços e a inclinação de cada braço em relação à vertical e à horizontal.',
    calcular: ([v, a, b]) => {
      const ang = anguloEm(a, v, b);
      const v1 = desvioDaVertical(v, a), h1 = anguloComHorizontal(v, a), v2 = desvioDaVertical(v, b), h2 = anguloComHorizontal(v, b);
      if (ang === null || v1 === null || h1 === null || v2 === null || h2 === null) return null;
      return { valor: ang, texto: `Compasso: ${f1(ang)}° entre os braços. Braço 1: ${f1(v1)}° da vertical (${f1(h1)}° da horizontal). Braço 2: ${f1(v2)}° da vertical (${f1(h2)}° da horizontal).` };
    },
  },
  {
    id: 'compasso-ref', nome: 'Compasso com referência', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta', desenho: 'compasso-ref',
    pontos: ['Vértice (centro do ângulo)', 'Ponta do braço medido'],
    segmentos: [[0, 1]],
    definicao: 'Marque o vértice e a ponta do braço. O ângulo é medido entre esse braço e uma direção fixa (vertical para baixo ou para cima, horizontal para a esquerda ou para a direita da imagem), que o app desenha a partir do vértice.',
    calcular: ([v, a], ctx) => {
      const ref = REFS_COMPASSO.find((r) => r.id === (ctx?.refCompasso ?? 'baixo')) ?? REFS_COMPASSO[0];
      const ang = anguloEntreVetores({ x: a.x - v.x, y: a.y - v.y }, ref.vetor);
      return ang === null ? null : { valor: ang, texto: `Compasso com referência: ${f1(ang)}° entre o braço e a ${ref.frase}.` };
    },
  },
  {
    id: 'reta', nome: 'Ângulo de uma reta', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta', desenho: 'horizontal',
    pontos: ['Início da reta', 'Fim da reta'],
    calcular: ([a, b]) => {
      const h = anguloComHorizontal(a, b), v = desvioDaVertical(a, b);
      if (h === null || v === null) return null;
      const sobe = (b.x - a.x) * (b.y - a.y) < 0;
      const sentido = h < 0.05 || v < 0.05 ? '' : sobe ? ', sobe para a direita da imagem' : ', sobe para a esquerda da imagem';
      return { valor: h, texto: `Reta a ${f1(h)}° da horizontal (${f1(v)}° da vertical)${sentido}.` };
    },
  },
  {
    id: 'cobb', nome: 'Ângulo entre retas (tipo Cobb)', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta', desenho: 'retas',
    pontos: ['Primeira reta: 1º ponto', 'Primeira reta: 2º ponto', 'Segunda reta: 1º ponto', 'Segunda reta: 2º ponto'],
    segmentos: [[0, 1], [2, 3]],
    calcular: ([a, b, c, d]) => {
      const ang = anguloEntreRetas(a, b, c, d);
      return ang === null ? null : { valor: ang, texto: `Ângulo entre as duas retas (tipo Cobb): ${f1(ang)}°. Medido na foto sobre as retas marcadas; não substitui o Cobb da radiografia.` };
    },
  },
  {
    id: 'regua', nome: 'Régua (distância)', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta', unidade: 'cm', desenho: 'regua',
    pontos: ['Primeiro ponto', 'Segundo ponto'],
    calcular: ([a, b], ctx) => {
      if (!ctx?.cmPorPx) return null;
      const cm = distancia(a, b) * ctx.cmPorPx;
      return { valor: cm, texto: `Distância: ${f1(cm)} cm (no plano da escala marcada; vale para pontos à mesma distância da câmera).` };
    },
  },
  {
    id: 'nivel', nome: 'Nível (corrigir foto torta)', vistas: ['frente', 'costas', 'perfil'], grupo: 'referencia', auxiliar: true, desenho: 'referencia', corReferencia: '#22d3ee',
    pontos: ['Início de uma linha horizontal ou vertical da vida real', 'Fim dessa linha'],
    calcular: () => null,
  },
  {
    id: 'escala', nome: 'Escala (calibrar em cm)', vistas: ['frente', 'costas', 'perfil'], grupo: 'referencia', auxiliar: true, desenho: 'referencia', corReferencia: '#fb923c',
    pontos: ['Início do objeto de tamanho conhecido', 'Fim do objeto'],
    calcular: () => null,
  },
  {
    id: 'altura', nome: 'Altura do paciente (para % do fio de prumo)', vistas: ['frente', 'costas', 'perfil'], grupo: 'referencia', auxiliar: true, desenho: 'referencia', corReferencia: '#a3e635',
    pontos: ['Topo da cabeça', 'Planta do pé (chão)'],
    definicao: 'Marque o topo da cabeça e a planta do pé. A distância vertical entre os dois é a altura usada para expressar o desvio do fio de prumo em % da altura.',
    calcular: () => null,
  },
];

/** Pares de pontos ligados por reta: os declarados ou, sem isso, todos em sequência. */
export const segmentosDaMedida = (m: Medida): [number, number][] =>
  m.segmentos ?? m.pontos.slice(1).map((_, i) => [i, i + 1] as [number, number]);

export const medidasDaVista = (v: Vista) => MEDIDAS.filter((m) => m.vistas.includes(v));
