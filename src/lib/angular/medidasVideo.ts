import { anguloEm, MEDIDAS, type Medida, type Ponto } from './medidas';
import type { Landmark } from './pose';

const f1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const LADOS = [{ s: 'd', nome: 'direito' }, { s: 'e', nome: 'esquerdo' }] as const;

// Medidas feitas em um quadro do vídeo (vista lateral). Joelho e quadril saem como flexão
// (0° = estendido); o tornozelo sai como o ângulo entre a perna e o pé (90° = neutro).
const articulares: Medida[] = LADOS.flatMap(({ s, nome }): Medida[] => [
  {
    id: `joelho-${s}`, nome: `Joelho ${nome}`, vistas: ['perfil'], grupo: 'postura',
    pontos: [`Quadril ${nome} (trocânter maior)`, `Joelho ${nome} (interlinha)`, `Tornozelo ${nome} (maléolo lateral)`],
    calcular: ([q, j, t]) => {
      const ang = anguloEm(q, j, t);
      return ang === null ? null : { valor: 180 - ang, texto: `Joelho ${nome}: flexão de ${f1(180 - ang)}° (ângulo interno ${f1(ang)}°).` };
    },
  },
  {
    id: `quadril-${s}`, nome: `Quadril ${nome}`, vistas: ['perfil'], grupo: 'postura',
    pontos: [`Ombro ${nome} (acrômio)`, `Quadril ${nome} (trocânter maior)`, `Joelho ${nome} (interlinha)`],
    calcular: ([o, q, j]) => {
      const ang = anguloEm(o, q, j);
      return ang === null ? null : { valor: 180 - ang, texto: `Quadril ${nome}: ângulo tronco-coxa com flexão de ${f1(180 - ang)}° (interno ${f1(ang)}°).` };
    },
  },
  {
    id: `tornozelo-${s}`, nome: `Tornozelo ${nome}`, vistas: ['perfil'], grupo: 'postura',
    pontos: [`Joelho ${nome} (interlinha)`, `Tornozelo ${nome} (maléolo lateral)`, `Ponta do pé ${nome === 'direito' ? 'direito' : 'esquerdo'} (cabeça do 5º metatarso)`],
    calcular: ([j, t, p]) => {
      const ang = anguloEm(j, t, p);
      return ang === null ? null : { valor: ang, texto: `Tornozelo ${nome}: ângulo perna-pé de ${f1(ang)}° (90° = neutro; menor = dorsiflexão, maior = flexão plantar).` };
    },
  },
]);

const reaproveitadas = ['tronco-perfil', 'cva', 'reta', 'livre', 'cobb', 'regua', 'nivel', 'escala']
  .map((id) => MEDIDAS.find((m) => m.id === id)!)
  .map((m) => ({ ...m, vistas: ['perfil' as const] }));

export const MEDIDAS_VIDEO: Medida[] = [...articulares, ...reaproveitadas];

// Índices do modelo de 33 pontos (esquerdo/direito do paciente).
const IDX = {
  e: { ombro: 11, quadril: 23, joelho: 25, tornozelo: 27, pe: 31 },
  d: { ombro: 12, quadril: 24, joelho: 26, tornozelo: 28, pe: 32 },
} as const;

/** Sugere os pontos da medida no quadro atual a partir da pose detectada; null se algum ponto não for confiável. */
export function sugerirNoQuadro(id: string, lm: Landmark[], w: number, h: number): Ponto[] | null {
  const pega = (i: number): Ponto | null => {
    const l = lm[i];
    return l && (l.visibility ?? 1) >= 0.5 ? { x: l.x * w, y: l.y * h } : null;
  };
  const vis = (i: number) => lm[i]?.visibility ?? 0;
  const lado = id.endsWith('-d') ? 'd' : id.endsWith('-e') ? 'e' : null;
  const quais: Record<string, ('ombro' | 'quadril' | 'joelho' | 'tornozelo' | 'pe')[]> = {
    joelho: ['quadril', 'joelho', 'tornozelo'], quadril: ['ombro', 'quadril', 'joelho'], tornozelo: ['joelho', 'tornozelo', 'pe'], 'tronco-perfil': ['ombro', 'quadril'],
  };
  const base = id.replace(/-(d|e)$/, '');
  const partes = quais[base];
  if (!partes) return null;
  const L = lado ?? (partes.reduce((s, p) => s + vis(IDX.e[p]), 0) >= partes.reduce((s, p) => s + vis(IDX.d[p]), 0) ? 'e' : 'd');
  const pts = partes.map((p) => pega(IDX[L][p]));
  return pts.every((p): p is Ponto => p !== null) ? pts : null;
}
