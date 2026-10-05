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

export interface Medida {
  id: string;
  nome: string;
  vistas: Vista[];
  /** Rótulo de cada ponto a marcar, na ordem. */
  pontos: string[];
  /** Resultado numérico (graus) e a frase que o descreve. */
  calcular: (p: Ponto[]) => { valor: number; texto: string } | null;
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
    id: 'ombros', nome: 'Desnível dos ombros', vistas: ['frente', 'costas'],
    pontos: ['Acrômio direito do paciente', 'Acrômio esquerdo do paciente'],
    calcular: ([d, e]) => desnivel('Linha dos ombros', d, e),
  },
  {
    id: 'pelve', nome: 'Desnível da pelve', vistas: ['frente', 'costas'],
    pontos: ['Crista ilíaca (ou espinha ilíaca) direita', 'Crista ilíaca (ou espinha ilíaca) esquerda'],
    calcular: ([d, e]) => desnivel('Linha da pelve', d, e),
  },
  {
    id: 'cabeca', nome: 'Inclinação da cabeça', vistas: ['frente', 'costas'],
    pontos: ['Orelha (ou olho) direita do paciente', 'Orelha (ou olho) esquerda do paciente'],
    calcular: ([d, e]) => desnivel('Linha da cabeça', d, e),
  },
  {
    id: 'tronco', nome: 'Alinhamento do tronco', vistas: ['frente', 'costas'],
    pontos: ['Base do pescoço (C7)', 'Ponto médio entre os pés ou da pelve'],
    calcular: ([a, b]) => {
      const dev = desvioDaVertical(a, b);
      if (dev === null) return null;
      const lado = b.x === a.x ? '' : (b.x > a.x ? ', pescoço desviado para a esquerda da imagem' : ', pescoço desviado para a direita da imagem');
      return { valor: dev, texto: `Tronco a ${f1(dev)}° da vertical${lado}.` };
    },
  },
  {
    id: 'cva', nome: 'Ângulo craniovertebral', vistas: ['perfil'],
    pontos: ['C7 (vértebra proeminente)', 'Tragus (orelha)'],
    calcular: ([c7, tragus]) => {
      const ang = anguloComHorizontal(c7, tragus);
      if (ang === null) return null;
      return { valor: ang, texto: `Ângulo craniovertebral: ${f1(ang)}° (reta C7–tragus com a horizontal). Quanto menor, mais a cabeça está à frente.` };
    },
  },
  {
    id: 'tronco-perfil', nome: 'Inclinação do tronco', vistas: ['perfil'],
    pontos: ['Ombro (acrômio)', 'Quadril (trocânter maior)'],
    calcular: ([o, q]) => {
      const dev = desvioDaVertical(o, q);
      if (dev === null) return null;
      return { valor: dev, texto: `Tronco (ombro–quadril) a ${f1(dev)}° da vertical.` };
    },
  },
  {
    id: 'joelho', nome: 'Ângulo do joelho', vistas: ['frente', 'costas', 'perfil'],
    pontos: ['Quadril (trocânter maior)', 'Joelho (interlinha articular)', 'Tornozelo (maléolo lateral)'],
    calcular: ([q, j, t]) => {
      const ang = anguloEm(q, j, t);
      if (ang === null) return null;
      return { valor: ang, texto: `Ângulo quadril–joelho–tornozelo: ${f1(ang)}° (${f1(Math.abs(180 - ang))}° de afastamento da linha reta).` };
    },
  },
  {
    id: 'livre', nome: 'Ângulo livre (3 pontos)', vistas: ['frente', 'costas', 'perfil'],
    pontos: ['Primeiro ponto', 'Vértice (onde o ângulo é medido)', 'Terceiro ponto'],
    calcular: ([a, b, c]) => {
      const ang = anguloEm(a, b, c);
      return ang === null ? null : { valor: ang, texto: `Ângulo medido: ${f1(ang)}°.` };
    },
  },
];

export const medidasDaVista = (v: Vista) => MEDIDAS.filter((m) => m.vistas.includes(v));
