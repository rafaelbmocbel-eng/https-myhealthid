// Avatar (figura humana de frente e de costas) desenhado em SVG próprio. Os
// músculos são pintados de verde, amarelo ou vermelho e as articulações com
// possível dor recebem um círculo tracejado. Usado na tela e nos PDFs.

import { type Analise, type Avaliacao, type Criterios, type Lado, type Slot, type Status, stLSI, stDesvio } from './analise';

type Vista = 'frente' | 'costas';
interface Forma { vista: Vista; d: string; c: [number, number] }

// Formas desenhadas no lado ESQUERDO da imagem. Na vista de frente esse é o
// lado DIREITO do paciente; na de costas, o ESQUERDO. O outro lado é espelhado.
const el = (cx: number, cy: number, rx: number, ry: number) => `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
const FORMAS: Record<string, Forma> = {
  quadriceps: { vista: 'frente', d: 'M78 262Q92 255 104 266Q104 310 98 340Q88 345 82 340Q73 300 78 262Z', c: [90, 300] },
  adutores: { vista: 'frente', d: 'M99 258Q108 261 107 280Q105 300 100 312Q94 292 96 268Z', c: [102, 271] },
  tibial: { vista: 'frente', d: el(87, 386, 5.5, 28), c: [87, 386] },
  biceps: { vista: 'frente', d: el(57, 140, 8.5, 27), c: [57, 140] },
  peitoral: { vista: 'frente', d: el(83, 108, 17, 12), c: [83, 108] },
  quadrilAnterior: { vista: 'frente', d: el(83, 246, 9, 8), c: [83, 246] },
  posteriores: { vista: 'costas', d: 'M78 268Q90 262 104 270Q104 310 98 342Q88 347 82 342Q73 304 78 268Z', c: [90, 305] },
  gluteoMedio: { vista: 'costas', d: el(81, 238, 12, 10), c: [81, 238] },
  gluteoMaximo: { vista: 'costas', d: el(95, 254, 14, 12), c: [95, 254] },
  panturrilha: { vista: 'costas', d: el(90, 378, 10, 26), c: [90, 378] },
  triceps: { vista: 'costas', d: el(57, 142, 8.5, 27), c: [57, 142] },
  infraespinal: { vista: 'costas', d: el(86, 118, 14, 11), c: [86, 118] },
};

export interface InfoMusculo { forma: string; nome: string; local: string; funcao: string }
export const MUSCULOS: Record<string, { ag: InfoMusculo; an: InfoMusculo }> = {
  joelho: {
    ag: { forma: 'quadriceps', nome: 'Quadríceps', local: 'frente da coxa', funcao: 'estende o joelho: levantar da cadeira, subir escadas, saltar e frear a corrida' },
    an: { forma: 'posteriores', nome: 'Posteriores da coxa', local: 'parte de trás da coxa', funcao: 'dobram o joelho e protegem a articulação na corrida e nas mudanças de direção' },
  },
  quadril: {
    ag: { forma: 'gluteoMedio', nome: 'Glúteo médio (abdutores)', local: 'lateral do quadril', funcao: 'mantêm a pelve nivelada ao caminhar e o joelho alinhado' },
    an: { forma: 'adutores', nome: 'Adutores', local: 'parte interna da coxa', funcao: 'estabilizam a pelve e aproximam as pernas; importantes em chutes e mudanças de direção' },
  },
  quadrilRot: {
    ag: { forma: 'quadrilAnterior', nome: 'Rotadores internos do quadril', local: 'frente e lateral do quadril', funcao: 'giram a coxa para dentro e controlam o quadril no apoio' },
    an: { forma: 'gluteoMaximo', nome: 'Rotadores externos do quadril', local: 'parte de trás do quadril', funcao: 'giram a coxa para fora e evitam que o joelho caia para dentro' },
  },
  ombro: {
    ag: { forma: 'peitoral', nome: 'Rotadores internos do ombro', local: 'frente do ombro', funcao: 'giram o braço para dentro: arremessar, empurrar, fechar o braço' },
    an: { forma: 'infraespinal', nome: 'Rotadores externos do ombro (manguito)', local: 'parte de trás do ombro', funcao: 'estabilizam o ombro e freiam o braço; protegem contra dor e lesão' },
  },
  tornozelo: {
    ag: { forma: 'panturrilha', nome: 'Panturrilha (flexores plantares)', local: 'parte de trás da perna', funcao: 'impulsionam o corpo ao andar, correr e subir na ponta dos pés' },
    an: { forma: 'tibial', nome: 'Tibial anterior (dorsiflexores)', local: 'frente da perna', funcao: 'levantam a ponta do pé e evitam tropeços' },
  },
  cotovelo: {
    ag: { forma: 'biceps', nome: 'Bíceps (flexores do cotovelo)', local: 'frente do braço', funcao: 'dobram o cotovelo: carregar e puxar' },
    an: { forma: 'triceps', nome: 'Tríceps (extensores do cotovelo)', local: 'parte de trás do braço', funcao: 'esticam o cotovelo: empurrar e apoiar o corpo' },
  },
};

export const PESO: Record<string, number> = { bad: 3, warn: 2, ok: 1, info: 0 };
export const COR_STATUS: Record<string, string> = { ok: '#22A35A', warn: '#F2A900', bad: '#E04B3F', info: '#8FA3BF' };

export type Articulacao = 'cervical' | 'ombro' | 'cotovelo' | 'punho' | 'lombar' | 'quadril' | 'joelho' | 'tornozelo' | 'pe';
// Centro de cada articulação no lado ESQUERDO da imagem (mesma convenção das FORMAS).
const ARTIC: Record<Articulacao, { c: [number, number]; meio?: boolean }> = {
  cervical: { c: [110, 72], meio: true }, ombro: { c: [66, 94] }, cotovelo: { c: [52, 194] }, punho: { c: [44, 270] },
  lombar: { c: [110, 226], meio: true }, quadril: { c: [86, 252] }, joelho: { c: [91, 350] }, tornozelo: { c: [93, 436] }, pe: { c: [91, 455] },
};
export const NOME_ARTIC: Record<Articulacao, string> = {
  cervical: 'coluna cervical', ombro: 'ombro', cotovelo: 'cotovelo', punho: 'punho', lombar: 'coluna lombar', quadril: 'quadril', joelho: 'joelho', tornozelo: 'tornozelo', pe: 'pé',
};
export const ARTIC_DA_REGIAO: Record<string, Articulacao> = { joelho: 'joelho', quadril: 'quadril', quadrilRot: 'quadril', ombro: 'ombro', tornozelo: 'tornozelo', cotovelo: 'cotovelo' };
// Articulações acima e abaixo, que recebem a sobrecarga quando um lado compensa o outro.
export const VIZINHAS: Record<string, [Articulacao, Articulacao]> = {
  joelho: ['quadril', 'tornozelo'], quadril: ['lombar', 'joelho'], quadrilRot: ['lombar', 'joelho'],
  tornozelo: ['joelho', 'pe'], ombro: ['cervical', 'cotovelo'], cotovelo: ['ombro', 'punho'],
};
export interface Anel { art: Articulacao; lado: Lado | null; st: Status }

const pior = (a: Status, b: Status): Status => (!a ? b : !b ? a : PESO[b[0]] > PESO[a[0]] ? b : a);

export interface ItemMapa { regiao: string; g: 'ag' | 'an'; numero: number; D: Status; E: Status }

type ItemAv = { av: Avaliacao; A: Analise };
function montar(itens: ItemAv[], cor: (A: Analise, g: 'ag' | 'an', lado: Lado) => Status): ItemMapa[] {
  const out: ItemMapa[] = [];
  let n = 1;
  for (const { av, A } of itens) {
    for (const g of ['ag', 'an'] as const) {
      if (!A.slots[`${g}D` as Slot] && !A.slots[`${g}E` as Slot]) continue;
      const st = (l: Lado): Status => (A.slots[`${g}${l}` as Slot] ? cor(A, g, l) : null);
      out.push({ regiao: av.regiao, g, numero: n++, D: st('D'), E: st('E') });
    }
  }
  return out;
}

const SEM_COMPARACAO: Status = ['info', 'Sem comparação'];

// Direito × esquerdo: o lado mais fraco recebe a cor da simetria; o mais forte fica verde.
export const itensSimetria = (itens: ItemAv[], c: Criterios) => montar(itens, (A, g, l) => {
  const L = g === 'ag' ? A.lsiAg : A.lsiAn;
  if (!L) return SEM_COMPARACAO;
  const st = stLSI(L.v, c);
  return L.fraco === l || st?.[0] === 'ok' ? st : ['ok', 'Lado mais forte'];
});

// Agonista × antagonista: em cada lado, o músculo relativamente fraco recebe a
// cor da razão; o outro fica verde.
export const itensRazao = (itens: ItemAv[], c: Criterios) => montar(itens, (A, g, l) => {
  const x = A.razoes[l];
  if (!x || x.desvio == null) return SEM_COMPARACAO;
  const st = stDesvio(x.desvio, c);
  if (st?.[0] === 'ok') return st;
  const fraco = x.ref != null && x.r < x.ref ? 'an' : 'ag';
  return g === fraco ? st : ['ok', 'Relativamente forte'];
});

const CORPO = [
  el(110, 40, 21, 26),
  'M100 60h20v24h-20Z',
  'M70 84Q110 74 150 84L156 100Q160 150 146 205Q150 230 146 255L74 255Q70 230 74 205Q60 150 64 100Z',
  'M152 88Q168 92 172 120L176 190Q170 198 160 196L154 130Z', 'M68 88Q52 92 48 120L44 190Q50 198 60 196L66 130Z',
  'M160 196L176 190Q182 230 182 268L170 272Q164 232 160 196Z', 'M60 196L44 190Q38 230 38 268L50 272Q56 232 60 196Z',
  el(176, 284, 8, 14), el(44, 284, 8, 14),
  'M74 250L108 252L106 300Q104 330 102 352L80 352Q72 300 74 250Z', 'M146 250L112 252L114 300Q116 330 118 352L140 352Q148 300 146 250Z',
  'M80 350L102 350Q104 400 100 440L86 440Q78 400 80 350Z', 'M140 350L118 350Q116 400 120 440L134 440Q142 400 140 350Z',
  el(91, 450, 12, 7), el(129, 450, 12, 7),
];

function vistaSVG(vista: Vista, ox: number, itens: ItemMapa[], aneis: Anel[]): string {
  const espelho = (d: string) => `<g transform="translate(220,0) scale(-1,1)">${d}</g>`;
  const corpo = CORPO.map(d => `<path d="${d}"/>`).join('');
  let musc = '', marcas = '';
  for (const it of itens) {
    const info = MUSCULOS[it.regiao]?.[it.g];
    const f = info ? FORMAS[info.forma] : null;
    if (!f || f.vista !== vista) continue;
    // Frente: lado esquerdo da imagem = direito do paciente. Costas: o contrário.
    const ladoImgEsq: Lado = vista === 'frente' ? 'D' : 'E';
    for (const lado of ['D', 'E'] as Lado[]) {
      const st = it[lado];
      if (!st) continue;
      const cor = COR_STATUS[st[0]];
      const forma = `<path d="${f.d}" fill="${cor}" fill-opacity="0.88" stroke="#ffffff" stroke-width="1.5"/>`;
      const espelhar = lado !== ladoImgEsq;
      musc += espelhar ? espelho(forma) : forma;
      const cx = espelhar ? 220 - f.c[0] : f.c[0];
      marcas += `<circle cx="${cx}" cy="${f.c[1]}" r="7.5" fill="#ffffff" stroke="#1F2937" stroke-width="1.2"/><text x="${cx}" y="${f.c[1] + 3.6}" text-anchor="middle" font-size="10" font-weight="700" fill="#1F2937">${it.numero}</text>`;
    }
  }
  const ladoEsqImg: Lado = vista === 'frente' ? 'D' : 'E';
  const circ = aneis.map(a => {
    if (!a.st) return '';
    const p = ARTIC[a.art], cor = COR_STATUS[a.st[0]];
    const x = p.meio || !a.lado ? 110 : a.lado === ladoEsqImg ? p.c[0] : 220 - p.c[0];
    return `<circle cx="${x}" cy="${p.c[1]}" r="11" fill="${cor}" fill-opacity="0.18" stroke="${cor}" stroke-width="2.6" stroke-dasharray="4 3"/>`;
  }).join('');
  const esq = vista === 'frente' ? 'Direito' : 'Esquerdo', dir = vista === 'frente' ? 'Esquerdo' : 'Direito';
  return `<g transform="translate(${ox},0)">
    <text x="110" y="16" text-anchor="middle" font-size="13" font-weight="700" fill="#1F2937">${vista === 'frente' ? 'Frente' : 'Costas'}</text>
    <text x="22" y="34" text-anchor="start" font-size="10" fill="#6B7280">${esq}</text>
    <text x="198" y="34" text-anchor="end" font-size="10" fill="#6B7280">${dir}</text>
    <g transform="translate(0,14)">
      <g fill="#9AA3AE" stroke="#9AA3AE" stroke-width="3" stroke-linejoin="round">${corpo}</g>
      <g fill="#EEF0F3">${corpo}</g>
      ${musc}${circ}${marcas}
    </g>
  </g>`;
}

export function mapaMuscularSVG(itens: ItemMapa[], aneis: Anel[] = []): string {
  const unicos = new Map<string, Anel>();
  for (const a of aneis) {
    const k = `${a.art}:${ARTIC[a.art].meio ? '' : a.lado}`;
    const ant = unicos.get(k);
    unicos.set(k, ant ? { ...a, st: pior(ant.st, a.st) } : a);
  }
  const lista = [...unicos.values()];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 480" font-family="Helvetica, Arial, sans-serif">
    <rect width="460" height="480" fill="#ffffff"/>
    ${vistaSVG('frente', 0, itens, lista)}${vistaSVG('costas', 240, itens, lista)}
  </svg>`;
}

export async function svgParaPNG(svg: string, largura = 920): Promise<string> {
  const img = new Image();
  await new Promise<void>((ok, erro) => {
    img.onload = () => ok();
    img.onerror = () => erro(new Error('Não foi possível desenhar o mapa muscular.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const altura = Math.round((largura * 480) / 460);
  const cv = document.createElement('canvas');
  cv.width = largura; cv.height = altura;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.drawImage(img, 0, 0, largura, altura);
  return cv.toDataURL('image/png');
}
