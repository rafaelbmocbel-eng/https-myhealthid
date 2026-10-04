// Avatar (figura humana de frente e de costas) desenhado em SVG próprio. Os
// músculos são pintados de verde, amarelo ou vermelho e as articulações com
// possível dor recebem um círculo tracejado. Usado na tela e nos PDFs.

import { type Analise, type Avaliacao, type Criterios, type Lado, type Slot, type Status, type Unidade, UF, fmt, stZ, stDesvio, simetriaSlot } from './analise';

type Vista = 'frente' | 'costas';
interface Forma { vista: Vista; d: string; c: [number, number] }

// Formas desenhadas no lado ESQUERDO da imagem. Na vista de frente esse é o
// lado DIREITO do paciente; na de costas, o ESQUERDO. O outro lado é espelhado.
// Proporção do corpo: o desenho original tinha a virilha em 56% da altura
// (tronco longo). Y() leva a virilha (y=265) para a metade da figura (y=238),
// como numa figura humana real; pernas alongam na mesma medida.
const TOPO_CORPO = 14, VIRILHA = 265, PE = 462, VIRILHA_NOVA = (TOPO_CORPO + PE) / 2;
const K_SUP = (VIRILHA_NOVA - TOPO_CORPO) / (VIRILHA - TOPO_CORPO), K_INF = (PE - VIRILHA_NOVA) / (PE - VIRILHA);
const Y = (y: number) => +(y <= VIRILHA ? TOPO_CORPO + (y - TOPO_CORPO) * K_SUP : VIRILHA_NOVA + (y - VIRILHA) * K_INF).toFixed(1);
const KY = (y: number) => (y <= VIRILHA ? K_SUP : K_INF);
// Aplica Y() aos pares "x y" de um path com comandos absolutos (M, Q, L, C).
const P = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)([ ,])(-?\d+(?:\.\d+)?)/g, (_m, x, sep, y) => `${x}${sep}${Y(Number(y))}`);
const el = (cx: number, cy0: number, rx: number, ry0: number) => {
  const cy = Y(cy0), ry = +(ry0 * KY(cy0)).toFixed(1);
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0Z`;
};
const FORMAS: Record<string, Forma> = {
  quadriceps: { vista: 'frente', d: P('M78 262Q92 255 104 266Q104 310 98 340Q88 345 82 340Q73 300 78 262Z'), c: [90, Y(300)] },
  adutores: { vista: 'frente', d: P('M99 258Q108 261 107 280Q105 300 100 312Q94 292 96 268Z'), c: [102, Y(271)] },
  tibial: { vista: 'frente', d: el(87, 386, 5.5, 28), c: [87, Y(386)] },
  biceps: { vista: 'frente', d: el(58, 150, 7, 24), c: [58, Y(150)] },
  peitoral: { vista: 'frente', d: el(83, 108, 17, 12), c: [83, Y(108)] },
  quadrilAnterior: { vista: 'frente', d: el(83, 246, 9, 8), c: [83, Y(246)] },
  posteriores: { vista: 'costas', d: P('M78 268Q90 262 104 270Q104 310 98 342Q88 347 82 342Q73 304 78 268Z'), c: [90, Y(305)] },
  gluteoMedio: { vista: 'costas', d: el(81, 238, 12, 10), c: [81, Y(238)] },
  gluteoMaximo: { vista: 'costas', d: el(95, 254, 14, 12), c: [95, Y(254)] },
  panturrilha: { vista: 'costas', d: el(90, 378, 10, 26), c: [90, Y(378)] },
  triceps: { vista: 'costas', d: el(58, 152, 7, 24), c: [58, Y(152)] },
  infraespinal: { vista: 'costas', d: el(86, 118, 14, 11), c: [86, Y(118)] },
};

// Musculatura de fundo (não avaliada), em cinza claro: dá forma de corpo humano
// à figura. Os músculos avaliados são pintados por cima, na cor do status.
const FUNDO: Record<Vista, string[]> = {
  frente: [
    el(67, 104, 10, 13), // deltoide
    el(83, 109, 17, 12), // peitoral
    P('M100 128Q109 126 110 130L110 206Q104 209 100 204Q97 166 100 128Z'), // reto abdominal
    P('M80 136Q92 148 98 166Q97 196 92 214Q82 200 78 176Q76 154 80 136Z'), // oblíquo
    el(58, 150, 7, 24), // bíceps
    P('M54 182Q61 188 60 212Q57 240 52 262Q46 262 45 250Q46 214 54 182Z'), // antebraço
    el(83, 247, 9, 8), // flexores do quadril
    P('M78 262Q92 255 104 266Q104 310 98 340Q88 345 82 340Q73 300 78 262Z'), // quadríceps
    P('M99 258Q108 261 107 280Q105 300 100 312Q94 292 96 268Z'), // adutores
    el(87, 386, 5.5, 28), // tibial anterior
    el(97, 388, 4, 22), // panturrilha (visão medial)
  ],
  costas: [
    P('M102 82Q90 88 76 94Q86 106 100 122L110 124L110 84Z'), // trapézio
    el(67, 106, 10, 13), // deltoide posterior
    el(86, 118, 14, 11), // infraespinal
    P('M78 132Q95 152 108 186L108 206Q92 192 82 172Q75 152 78 132Z'), // grande dorsal
    P('M100 204Q109 202 110 206L110 232Q103 233 99 228Z'), // lombar
    el(58, 152, 7, 24), // tríceps
    P('M54 182Q61 188 60 212Q57 240 52 262Q46 262 45 250Q46 214 54 182Z'), // antebraço
    el(81, 238, 12, 10), // glúteo médio
    el(95, 254, 14, 12), // glúteo máximo
    P('M78 268Q90 262 104 270Q104 310 98 342Q88 347 82 342Q73 304 78 268Z'), // posteriores
    el(90, 378, 10, 26), // panturrilha
  ],
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
  cervical: { c: [110, Y(72)], meio: true }, ombro: { c: [63, Y(102)] }, cotovelo: { c: [53, Y(196)] }, punho: { c: [45, Y(268)] },
  lombar: { c: [110, Y(226)], meio: true }, quadril: { c: [86, Y(252)] }, joelho: { c: [91, Y(350)] }, tornozelo: { c: [93, Y(440)] }, pe: { c: [90, Y(456)] },
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
// razao: anel da relação agonista/antagonista daquele lado (pinta a articulação
// testada); sem isso, é um anel de possível dor/sobrecarga (tracejado).
export interface Anel { art: Articulacao; lado: Lado | null; st: Status; razao?: boolean }

const pior = (a: Status, b: Status): Status => (!a ? b : !b ? a : PESO[b[0]] > PESO[a[0]] ? b : a);

export interface ItemMapa { regiao: string; g: 'ag' | 'an'; numero: number; D: Status; E: Status; rotulo?: Partial<Record<Lado, string>> }

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

// Cor de cada lado no avatar (simetria unilateral):
// • o lado mais forte do par é a referência (100%): verde, a não ser que esteja
//   fraco para idade e sexo (norma) — aí amarelo/vermelho pela norma;
// • o lado mais fraco recebe a cor da simetria (>= 90% verde, 80–90% amarelo,
//   < 80% vermelho), ou a da norma se ela for pior.
// A razão agonista/antagonista tem cor própria no close da articulação.
// O rótulo mostra "D 45,2" / "E 38,1".
export function itensAvatar(itens: ItemAv[], c: Criterios, u: Unidade): ItemMapa[] {
  const base = montar(itens, (A, g, l) => {
    const k = `${g}${l}` as Slot;
    const norma = stZ(A.slots[k]?.z);
    const sim = simetriaSlot(A, k, c);
    if (!sim) return norma ?? ['info', 'Sem referência'];
    if (sim.v >= 99.5) return norma && norma[0] !== 'ok' ? norma : ['ok', 'Lado de referência'];
    return [sim.st, norma].reduce(pior, null) ?? ['info', 'Sem referência'];
  });
  const porRegiao = new Map(itens.map(i => [i.av.regiao, i.A]));
  return base.map(it => {
    const A = porRegiao.get(it.regiao);
    const rot: Partial<Record<Lado, string>> = {};
    for (const l of ['D', 'E'] as Lado[]) {
      const p = A?.slots[`${it.g}${l}` as Slot]?.pico;
      if (p != null) { const v = p / UF[u]; rot[l] = `${l} ${fmt(v, v >= 100 ? 0 : 1)}`; }
    }
    return { ...it, rotulo: rot };
  });
}

// Contorno do corpo: metade esquerda da imagem, do alto da cabeça até o
// períneo; a outra metade é espelhada. Suavizado por Catmull-Rom.
const METADE: [number, number][] = [
  [110, 14], [98, 17], [90, 27], [88, 42], [90, 54], [95, 63], [101, 69], [102, 80],
  [90, 87], [74, 91], [63, 96], [55, 106], [51, 121], [49, 146], [47, 171], [45, 196], [42, 225], [40, 250], [38, 266],
  [34, 278], [32, 292], [35, 303], [42, 308], [49, 304], [52, 292], [51, 279], [52, 268],
  [55, 240], [58, 212], [61, 192], [64, 166], [67, 141], [71, 124],
  [74, 140], [75, 165], [73, 192], [71, 212], [70, 232], [70, 250],
  [72, 270], [76, 302], [79, 330], [80, 352], [80, 372], [82, 402], [85, 428], [86, 442],
  [81, 451], [80, 458], [88, 462], [99, 461], [102, 453], [100, 442],
  [101, 420], [102, 396], [101, 372], [102, 350], [104, 322], [106, 292], [108, 272], [110, 265],
];
function suave(pts: [number, number][]): string {
  const n = pts.length, f = (v: number) => +v.toFixed(1);
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${p2[0]} ${p2[1]}`;
  }
  return `${d}Z`;
}
const METADE_P = METADE.map(([x, y]) => [x, Y(y)] as [number, number]);
const CONTORNO = suave([...METADE_P, ...METADE_P.slice(1, -1).reverse().map(([x, y]) => [220 - x, y] as [number, number])]);
const espelhar = (d: string) => `${d}<g transform="translate(220,0) scale(-1,1)">${d}</g>`;
const DETALHES: Record<Vista, string> = {
  frente: espelhar(`<path d="${P('M101 86Q90 89 78 92')}"/><path d="${P('M73 122Q88 133 106 126')}"/><path d="${P('M84 247Q98 257 108 265')}"/><path d="${P('M86 356Q91 360 97 357')}"/><path d="${P('M48 198Q51 201 55 199')}"/><path d="${P('M41 292L44 300M45 291L47 301')}"/>`)
    + `<ellipse cx="110" cy="${Y(192)}" rx="2.2" ry="1.6"/>`,
  costas: espelhar(`<path d="${P('M93 104Q86 120 94 134')}"/><path d="${P('M85 260Q97 270 110 264')}"/><path d="${P('M86 357Q91 353 97 357')}"/><path d="${P('M48 199Q51 196 55 198')}"/>`)
    + `<path d="${P('M110 98L110 212')}"/><path d="${P('M110 236L110 262')}"/>`,
};

// simples: sem rótulos nem títulos (usado no close da articulação).
function vistaSVG(vista: Vista, ox: number, itens: ItemMapa[], aneis: Anel[], topo: number, simples = false): string {
  const espelho = (d: string) => `<g transform="translate(220,0) scale(-1,1)">${d}</g>`;
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
      const forma = `<path d="${f.d}" fill="${cor}" fill-opacity="0.8" stroke="#ffffff" stroke-width="1.2"/>`;
      const espelhar = lado !== ladoImgEsq;
      musc += espelhar ? espelho(forma) : forma;
      const cx = espelhar ? 220 - f.c[0] : f.c[0];
      const rot = it.rotulo?.[lado];
      if (rot) {
        const w = rot.length * 5.3 + 8;
        marcas += `<rect x="${cx - w / 2}" y="${f.c[1] - 7}" width="${w}" height="14" rx="7" fill="#ffffff" stroke="${cor}" stroke-width="1.6"/><text x="${cx}" y="${f.c[1] + 3.3}" text-anchor="middle" font-size="9.5" font-weight="700" fill="#1F2937">${rot}</text>`;
      } else {
        marcas += `<circle cx="${cx}" cy="${f.c[1]}" r="7.5" fill="#ffffff" stroke="#1F2937" stroke-width="1.2"/><text x="${cx}" y="${f.c[1] + 3.6}" text-anchor="middle" font-size="10" font-weight="700" fill="#1F2937">${it.numero}</text>`;
      }
    }
  }
  const fundo = FUNDO[vista].map((d) => `<path d="${d}"/>`).join('');
  const ladoEsqImg: Lado = vista === 'frente' ? 'D' : 'E';
  const circ = aneis.map(a => {
    if (!a.st) return '';
    const p = ARTIC[a.art], cor = COR_STATUS[a.st[0]];
    const x = p.meio || !a.lado ? 110 : a.lado === ladoEsqImg ? p.c[0] : 220 - p.c[0];
    return a.razao
      ? `<circle cx="${x}" cy="${p.c[1]}" r="12" fill="${cor}" fill-opacity="0.45" stroke="${cor}" stroke-width="2.8"/>`
      : `<circle cx="${x}" cy="${p.c[1]}" r="11" fill="${cor}" fill-opacity="0.18" stroke="${cor}" stroke-width="2.6" stroke-dasharray="4 3"/>`;
  }).join('');
  const esq = vista === 'frente' ? 'Direito' : 'Esquerdo', dir = vista === 'frente' ? 'Esquerdo' : 'Direito';
  return `<g transform="translate(${ox},0)">
    <g transform="translate(0,14)">
      <path d="${CONTORNO}" fill="#F3F5F7" stroke="#9AAAB6" stroke-width="1.8" stroke-linejoin="round"/>
      <g fill="#E3E8EE" stroke="#FFFFFF" stroke-width="1.3">${fundo}${espelho(fundo)}</g>
      <g fill="none" stroke="#A9B6C0" stroke-width="1.4" stroke-linecap="round">${DETALHES[vista]}</g>
      ${musc}${circ}${simples ? '' : marcas}
    </g>
    ${simples ? '' : `    <g font-weight="700" stroke="#ffffff" stroke-width="4" paint-order="stroke" stroke-linejoin="round">
      <text x="110" y="${topo + 16}" text-anchor="middle" font-size="13" fill="#1F2937">${vista === 'frente' ? 'Frente' : 'Costas'}</text>
      <text x="16" y="${topo + 16}" text-anchor="start" font-size="13" fill="#4B5563">${esq === 'Direito' ? 'D' : 'E'}</text>
      <text x="204" y="${topo + 16}" text-anchor="end" font-size="13" fill="#4B5563">${dir === 'Direito' ? 'D' : 'E'}</text>
    </g>`}
  </g>`;
}

// recortar: mostra só a faixa do corpo com os músculos e articulações marcados,
// para o avatar ocupar pouco espaço.
// Articulação testada pintada pela razão agonista/antagonista de cada lado
// (ex.: joelho direito pela razão Posteriores/Quadríceps direita):
// verde dentro da janela, amarelo quase saindo, vermelho muito fora.
export function aneisRazao(itens: ItemAv[], c: Criterios): Anel[] {
  return itens.flatMap(({ av, A }) => {
    const art = ARTIC_DA_REGIAO[av.regiao];
    if (!art) return [];
    return (['D', 'E'] as Lado[]).flatMap((l): Anel[] => {
      const rz = A.razoes[l];
      if (!rz) return [];
      return [{ art, lado: l, st: rz.desvio == null ? ['info', 'Sem referência'] : stDesvio(rz.desvio, c), razao: true }];
    });
  });
}

export function mapaMuscularSVG(itens: ItemMapa[], aneis: Anel[] = [], recortar = false): string {
  const unicos = new Map<string, Anel>();
  for (const a of aneis) {
    const k = `${a.art}:${ARTIC[a.art].meio ? '' : a.lado}`;
    const ant = unicos.get(k);
    // A cor da razão manda na articulação testada; anéis de dor só se somam entre si.
    if (!ant) unicos.set(k, a);
    else if (a.razao && !ant.razao) unicos.set(k, a);
    else if (a.razao === ant.razao) unicos.set(k, { ...a, st: pior(ant.st, a.st) });
  }
  const lista = [...unicos.values()];
  let topo = 0, alt = 480;
  const ys = [
    ...itens.map(it => { const info = MUSCULOS[it.regiao]?.[it.g]; return info ? FORMAS[info.forma]?.c[1] : undefined; }),
    ...lista.filter(a => a.st).map(a => ARTIC[a.art].c[1]),
  ].filter((v): v is number => v != null).map(v => v + 14);
  if (recortar && ys.length) {
    let a = Math.min(...ys) - 70, b = Math.max(...ys) + 45;
    if (b - a < 200) { const m = (a + b) / 2; a = m - 100; b = m + 100; }
    topo = Math.max(0, Math.round(a)); alt = Math.min(480, Math.round(b)) - topo;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${topo} 460 ${alt}" font-family="Helvetica, Arial, sans-serif">
    <rect y="${topo}" width="460" height="${alt}" fill="#ffffff"/>
    ${vistaSVG('frente', 0, itens, lista, topo)}${vistaSVG('costas', 240, itens, lista, topo)}
  </svg>`;
}

export const proporcaoSVG = (svg: string) => { const vb = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number); return vb ? vb[3] / vb[2] : 480 / 460; };

export async function svgParaPNG(svg: string, largura = 920): Promise<string> {
  const img = new Image();
  await new Promise<void>((ok, erro) => {
    img.onload = () => ok();
    img.onerror = () => erro(new Error('Não foi possível desenhar o mapa muscular.'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  const vb = /viewBox="([\d.\s-]+)"/.exec(svg)?.[1].trim().split(/\s+/).map(Number);
  const altura = Math.round((largura * (vb?.[3] || 480)) / (vb?.[2] || 460));
  const cv = document.createElement('canvas');
  cv.width = largura; cv.height = altura;
  const ctx = cv.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível.');
  ctx.drawImage(img, 0, 0, largura, altura);
  return cv.toDataURL('image/png');
}

// Close de frente da articulação avaliada, com o anel de cada lado na cor da
// relação antagonista/agonista e o valor ao lado (ex.: "D 53%").
export function focoArticulacaoSVG(regiao: string, itens: ItemMapa[], razao: Partial<Record<Lado, { txt: string; st: Status }>>): string {
  const art = ARTIC_DA_REGIAO[regiao] ?? 'joelho';
  const p = ARTIC[art];
  const cy = p.c[1] + 14;
  const topo = Math.max(0, cy - 62), alt = 124;
  let extra = '';
  for (const lado of ['D', 'E'] as Lado[]) {
    const r = razao[lado];
    if (!r || !r.st) continue;
    const cor = COR_STATUS[r.st[0]];
    const x = lado === 'D' ? p.c[0] : 220 - p.c[0];
    extra += `<circle cx="${x}" cy="${cy}" r="15" fill="${cor}" fill-opacity="0.16" stroke="${cor}" stroke-width="3"/>`;
    const w = r.txt.length * 7.2 + 14, lx = lado === 'D' ? x - 24 - w : x + 24;
    extra += `<line x1="${lado === 'D' ? x - 15 : x + 15}" y1="${cy}" x2="${lado === 'D' ? lx + w : lx}" y2="${cy}" stroke="${cor}" stroke-width="2"/>`;
    extra += `<rect x="${lx}" y="${cy - 10}" width="${w}" height="20" rx="10" fill="#ffffff" stroke="${cor}" stroke-width="2"/><text x="${lx + w / 2}" y="${cy + 4.6}" text-anchor="middle" font-size="13" font-weight="700" fill="#1F2937">${r.txt}</text>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-80 ${topo} 380 ${alt}" font-family="Helvetica, Arial, sans-serif">
    <rect x="-80" y="${topo}" width="380" height="${alt}" fill="#ffffff"/>
    ${vistaSVG('frente', 0, itens, [], topo, true)}
    ${extra}
    <text x="-74" y="${topo + 16}" font-size="12" font-weight="700" fill="#4B5563">D</text>
    <text x="294" y="${topo + 16}" font-size="12" font-weight="700" fill="#4B5563" text-anchor="end">E</text>
  </svg>`;
}
