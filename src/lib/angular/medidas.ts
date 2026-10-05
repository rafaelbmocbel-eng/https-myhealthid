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

export type GrupoMedida = 'postura' | 'ferramenta' | 'referencia';

export interface ContextoMedida { cmPorPx: number | null }

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
  calcular: (p: Ponto[], ctx?: ContextoMedida) => { valor: number; texto: string } | null;
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

export const MEDIDAS: Medida[] = [
  {
    id: 'ombros', nome: 'Desnível dos ombros', vistas: ['frente', 'costas'], grupo: 'postura',
    pontos: ['Acrômio direito do paciente', 'Acrômio esquerdo do paciente'],
    calcular: ([d, e]) => desnivel('Linha dos ombros', d, e),
  },
  {
    id: 'pelve', nome: 'Desnível da pelve', vistas: ['frente', 'costas'], grupo: 'postura',
    pontos: ['Crista ilíaca (ou espinha ilíaca) direita', 'Crista ilíaca (ou espinha ilíaca) esquerda'],
    calcular: ([d, e]) => desnivel('Linha da pelve', d, e),
  },
  {
    id: 'cabeca', nome: 'Inclinação da cabeça', vistas: ['frente', 'costas'], grupo: 'postura',
    pontos: ['Orelha (ou olho) direita do paciente', 'Orelha (ou olho) esquerda do paciente'],
    calcular: ([d, e]) => desnivel('Linha da cabeça', d, e),
  },
  {
    id: 'tronco', nome: 'Alinhamento do tronco', vistas: ['frente', 'costas'], grupo: 'postura',
    pontos: ['Base do pescoço (C7)', 'Ponto médio entre os pés ou da pelve'],
    calcular: ([a, b]) => {
      const dev = desvioDaVertical(a, b);
      if (dev === null) return null;
      const lado = b.x === a.x ? '' : (b.x > a.x ? ', pescoço desviado para a esquerda da imagem' : ', pescoço desviado para a direita da imagem');
      return { valor: dev, texto: `Tronco a ${f1(dev)}° da vertical${lado}.` };
    },
  },
  {
    id: 'cva', nome: 'Ângulo craniovertebral', vistas: ['perfil'], grupo: 'postura',
    pontos: ['C7 (vértebra proeminente)', 'Tragus (orelha)'],
    calcular: ([c7, tragus]) => {
      const ang = anguloComHorizontal(c7, tragus);
      if (ang === null) return null;
      return { valor: ang, texto: `Ângulo craniovertebral: ${f1(ang)}° (reta C7–tragus com a horizontal). Quanto menor, mais a cabeça está à frente.` };
    },
  },
  {
    id: 'tronco-perfil', nome: 'Inclinação do tronco', vistas: ['perfil'], grupo: 'postura',
    pontos: ['Ombro (acrômio)', 'Quadril (trocânter maior)'],
    calcular: ([o, q]) => {
      const dev = desvioDaVertical(o, q);
      if (dev === null) return null;
      return { valor: dev, texto: `Tronco (ombro–quadril) a ${f1(dev)}° da vertical.` };
    },
  },
  ...(['direito', 'esquerdo'] as const).map((lado): Medida => ({
    id: `joelho-${lado === 'direito' ? 'd' : 'e'}`, nome: `Joelho ${lado}`, vistas: ['frente', 'costas'], grupo: 'postura',
    pontos: [`Quadril ${lado} (trocânter maior)`, `Joelho ${lado} (interlinha articular)`, `Tornozelo ${lado} (maléolo lateral)`],
    calcular: ([q, j, t]) => {
      const ang = anguloEm(q, j, t);
      if (ang === null) return null;
      return { valor: ang, texto: `Joelho ${lado}, quadril–joelho–tornozelo: ${f1(ang)}° (${f1(Math.abs(180 - ang))}° de afastamento da linha reta).` };
    },
  })),
  {
    id: 'joelho', nome: 'Ângulo do joelho', vistas: ['perfil'], grupo: 'postura',
    pontos: ['Quadril (trocânter maior)', 'Joelho (interlinha articular)', 'Tornozelo (maléolo lateral)'],
    calcular: ([q, j, t]) => {
      const ang = anguloEm(q, j, t);
      if (ang === null) return null;
      return { valor: ang, texto: `Ângulo quadril–joelho–tornozelo: ${f1(ang)}° (${f1(Math.abs(180 - ang))}° de afastamento da linha reta).` };
    },
  },
  {
    id: 'livre', nome: 'Ângulo livre (3 pontos)', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta',
    pontos: ['Primeiro ponto', 'Vértice (onde o ângulo é medido)', 'Terceiro ponto'],
    calcular: ([a, b, c]) => {
      const ang = anguloEm(a, b, c);
      return ang === null ? null : { valor: ang, texto: `Ângulo medido: ${f1(ang)}°.` };
    },
  },
  {
    id: 'reta', nome: 'Ângulo de uma reta', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta',
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
    id: 'cobb', nome: 'Ângulo entre retas (tipo Cobb)', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta',
    pontos: ['Primeira reta: 1º ponto', 'Primeira reta: 2º ponto', 'Segunda reta: 1º ponto', 'Segunda reta: 2º ponto'],
    segmentos: [[0, 1], [2, 3]],
    calcular: ([a, b, c, d]) => {
      const ang = anguloEntreRetas(a, b, c, d);
      return ang === null ? null : { valor: ang, texto: `Ângulo entre as duas retas (tipo Cobb): ${f1(ang)}°. Medido na foto sobre as retas marcadas; não substitui o Cobb da radiografia.` };
    },
  },
  {
    id: 'regua', nome: 'Régua (distância)', vistas: ['frente', 'costas', 'perfil'], grupo: 'ferramenta', unidade: 'cm',
    pontos: ['Primeiro ponto', 'Segundo ponto'],
    calcular: ([a, b], ctx) => {
      if (!ctx?.cmPorPx) return null;
      const cm = distancia(a, b) * ctx.cmPorPx;
      return { valor: cm, texto: `Distância: ${f1(cm)} cm (no plano da escala marcada; vale para pontos à mesma distância da câmera).` };
    },
  },
  {
    id: 'nivel', nome: 'Nível (corrigir foto torta)', vistas: ['frente', 'costas', 'perfil'], grupo: 'referencia', auxiliar: true,
    pontos: ['Início de uma linha horizontal ou vertical da vida real', 'Fim dessa linha'],
    calcular: () => null,
  },
  {
    id: 'escala', nome: 'Escala (calibrar em cm)', vistas: ['frente', 'costas', 'perfil'], grupo: 'referencia', auxiliar: true,
    pontos: ['Início do objeto de tamanho conhecido', 'Fim do objeto'],
    calcular: () => null,
  },
];

/** Pares de pontos ligados por reta: os declarados ou, sem isso, todos em sequência. */
export const segmentosDaMedida = (m: Medida): [number, number][] =>
  m.segmentos ?? m.pontos.slice(1).map((_, i) => [i, i + 1] as [number, number]);

export const medidasDaVista = (v: Vista) => MEDIDAS.filter((m) => m.vistas.includes(v));
