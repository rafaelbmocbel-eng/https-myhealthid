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
  /** Altura do paciente na foto, em pixels (referência para o desvio em % da altura). */
  alturaPx?: number | null;
}

/** Como a medida é desenhada com o estilo das linhas. */
export type TipoDesenho =
  | 'angulo3' | 'compasso' | 'compasso-ref' | 'horizontal' | 'vertical' | 'retas' | 'angulo-q' | 'regua' | 'prumo' | 'referencia';

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
}

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
  const olha = ctx?.olhaPara ?? 'direita';
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
  const r = /^(prumo-perfil|prumo-frente)-([a-z0-9]+)-(cm|pct|graus)$/.exec(id);
  if (!r) return null;
  const alvo = ALVOS_PRUMO[r[1] as 'prumo-perfil' | 'prumo-frente'].find((a) => a.slug === r[2]);
  return alvo ? `Fio de prumo: ${alvo.nome.toLowerCase()} (${NOME_UNIDADE_PRUMO[r[3] as UnidadePrumo]})` : null;
}

/** Unidade de um resultado pelo id (o fio de prumo leva a unidade no final do id). */
export function unidadeDoResultadoId(id: string): UnidadeResultado {
  if (/-pct$/.test(id) && id.startsWith('prumo-')) return '%';
  if (/-cm$/.test(id) && id.startsWith('prumo-')) return 'cm';
  return MEDIDAS.find((m) => m.id === id)?.unidade === 'cm' ? 'cm' : 'graus';
}

/** Altura do paciente na foto (px) ao longo da vertical, a partir dos dois pontos da referência de altura (já corrigidos pelo nível). */
export function alturaEmPixels(p: Ponto[] | undefined): number | null {
  if (!p || p.length < 2) return null;
  const h = Math.abs(p[1].y - p[0].y);
  return h > 0 ? h : null;
}

const LADOS = [{ s: 'd', nome: 'direito' }, { s: 'e', nome: 'esquerdo' }] as const;

export const MEDIDAS: Medida[] = [
  {
    id: 'ombros', nome: 'Desnível dos ombros', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Acrômio direito do paciente', 'Acrômio esquerdo do paciente'],
    calcular: ([d, e]) => desnivel('Linha dos ombros', d, e),
  },
  {
    id: 'pelve', nome: 'Desnível da pelve', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Crista ilíaca (ou espinha ilíaca) direita', 'Crista ilíaca (ou espinha ilíaca) esquerda'],
    calcular: ([d, e]) => desnivel('Linha da pelve', d, e),
  },
  {
    id: 'cabeca', nome: 'Inclinação da cabeça', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['Orelha (ou olho) direita do paciente', 'Orelha (ou olho) esquerda do paciente'],
    calcular: ([d, e]) => desnivel('Linha da cabeça', d, e),
  },
  {
    id: 'tronco', nome: 'Alinhamento do tronco', vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'vertical',
    pontos: ['Base do pescoço (C7)', 'Ponto médio entre os pés ou da pelve'],
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
    pontos: ['C7 (vértebra proeminente)', 'Tragus (orelha)'],
    calcular: ([c7, tragus]) => {
      const ang = anguloComHorizontal(c7, tragus);
      if (ang === null) return null;
      return { valor: ang, texto: `Ângulo craniovertebral: ${f1(ang)}° (reta C7–tragus com a horizontal). Quanto menor, mais a cabeça está à frente.` };
    },
  },
  {
    id: 'protracao-ombro', nome: 'Protração do ombro (C7–acrômio)', vistas: ['perfil'], grupo: 'postura', desenho: 'horizontal',
    pontos: ['C7 (vértebra proeminente)', 'Acrômio (ponto mais lateral do ombro)'],
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
    calcular: ([o, q]) => {
      const dev = desvioDaVertical(o, q);
      if (dev === null) return null;
      return { valor: dev, texto: `Tronco (ombro–quadril) a ${f1(dev)}° da vertical.` };
    },
  },
  {
    id: 'pelve-perfil', nome: 'Inclinação pélvica (perfil)', vistas: ['perfil'], grupo: 'postura', desenho: 'horizontal', comSinal: true,
    pontos: ['EIPS (espinha ilíaca posterossuperior)', 'EIAS (espinha ilíaca anterossuperior)'],
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
  ...LADOS.map(({ s, nome }): Medida => ({
    id: `joelho-${s}`, nome: `Joelho ${nome}`, vistas: ['frente', 'costas'], grupo: 'postura', desenho: 'angulo3',
    pontos: [`Quadril ${nome} (trocânter maior)`, `Joelho ${nome} (interlinha articular)`, `Tornozelo ${nome} (maléolo lateral)`],
    calcular: ([q, j, t]) => {
      const ang = anguloEm(q, j, t);
      if (ang === null) return null;
      return { valor: ang, texto: `Joelho ${nome}, quadril–joelho–tornozelo: ${f1(ang)}° (${f1(Math.abs(180 - ang))}° de afastamento da linha reta).` };
    },
  })),
  ...LADOS.map(({ s, nome }): Medida => ({
    id: `angulo-q-${s}`, nome: `Ângulo Q ${nome}`, vistas: ['frente'], grupo: 'postura', desenho: 'angulo-q',
    pontos: [`EIAS ${nome} (espinha ilíaca anterossuperior)`, `Centro da patela ${nome}`, `Tuberosidade da tíbia ${nome}`],
    segmentos: [[0, 1], [1, 2]],
    definicao: 'Ângulo entre a reta EIAS–centro da patela, prolongada além da patela, e a reta centro da patela–tuberosidade da tíbia. O app mostra só o valor medido, sem classificar como normal ou alterado.',
    calcular: ([eias, patela, tuberosidade]) => {
      const interno = anguloEm(eias, patela, tuberosidade);
      if (interno === null) return null;
      const q = 180 - interno;
      return { valor: q, texto: `Ângulo Q ${nome}: ${f1(q)}° (reta EIAS–patela prolongada com a reta patela–tuberosidade da tíbia).` };
    },
  })),
  ...LADOS.map(({ s, nome }): Medida => ({
    id: `retrope-${s}`, nome: `Retropé ${nome}`, vistas: ['costas'], grupo: 'postura', desenho: 'retas', comSinal: true,
    pontos: [`Perna ${nome}: ponto de cima (meio da panturrilha)`, `Perna ${nome}: ponto de baixo (tendão do calcâneo, acima do calcanhar)`, `Calcâneo ${nome}: ponto de cima`, `Calcâneo ${nome}: ponto de baixo (base do calcanhar)`],
    segmentos: [[0, 1], [2, 3]],
    definicao: 'Ângulo entre a reta da perna (2 pontos no eixo da perna) e a reta do calcâneo (2 pontos), em foto de costas. Positivo = valgo (parte de baixo do calcanhar deslocada para fora em relação à perna); negativo = varo. O rótulo mostra o valor sem sinal. Sem classificação.',
    calcular: ([a, b, c, d]) => {
      const bruto = anguloOrientado({ x: b.x - a.x, y: b.y - a.y }, { x: d.x - c.x, y: d.y - c.y });
      if (bruto === null) return null;
      const t = normalizar180(bruto);
      const valgo = s === 'd' ? -t : t;
      if (Math.abs(valgo) < 0.05) return { valor: 0, texto: `Retropé ${nome}: 0,0° (reta do calcâneo alinhada com a reta da perna).` };
      return { valor: valgo, sentido: valgo > 0 ? 'valgo' : 'varo', texto: `Retropé ${nome}: ${f1(Math.abs(valgo))}° em ${valgo > 0 ? 'valgo (calcanhar desviado para fora da reta da perna)' : 'varo (calcanhar desviado para dentro da reta da perna)'}.` };
    },
  })),
  {
    id: 'joelho', nome: 'Ângulo do joelho', vistas: ['perfil'], grupo: 'postura', desenho: 'angulo3',
    pontos: ['Quadril (trocânter maior)', 'Joelho (interlinha articular)', 'Tornozelo (maléolo lateral)'],
    calcular: ([q, j, t]) => {
      const ang = anguloEm(q, j, t);
      if (ang === null) return null;
      return { valor: ang, texto: `Ângulo quadril–joelho–tornozelo: ${f1(ang)}° (${f1(Math.abs(180 - ang))}° de afastamento da linha reta).` };
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
