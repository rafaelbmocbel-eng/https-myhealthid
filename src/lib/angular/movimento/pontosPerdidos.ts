import { pontosDasDefinicoes, rotuloDoPonto } from '../analiseVideo/marcacoes';
import type { TrilhaPose } from '../video/tipos';
import { pontoUsavel } from '../video/trilha';
import { finito, type Num } from './estatistica';
import { instanteDaLeitura, motivoDoPontoPerdido } from './frasesPontosPerdidos';
import { FRACAO_MINIMA_VALIDOS, type FalhaDePontos } from './medidasPorRepeticao';
import { faseDo, medidaDo } from './protocolos';
import type {
  ChaveLado, EntradaPontoPerdido, PontoFaltante, PontosPerdidos, Protocolo, Repeticao, ResumoPontoPerdido,
} from './tipos';

/*
 * Pontos perdidos (agente P): transforma as medidas que ficaram sem valor por falta de pontos (`FalhaDePontos`, registradas por
 * medidasPorRepeticao.ts) no que o profissional precisa para corrigir à mão: quais pontos do corpo, em que quadros e em que instante.
 * Não muda nenhum número medido nem a regra de 70%: o rigor é o mesmo, só deixa de ser silencioso.
 */

export const pontosPerdidosVazios = (): PontosPerdidos => ({ entradas: [], porPonto: [] });

const sfx = (chave: string): string => chave.slice(-1);

/** Pontos reais da trilha de que a série de uma medida depende, quando a série não é um ângulo do protocolo. */
function pontosDoDeslocamento(chave: string): string[] {
  if (chave === 'avanco_d' || chave === 'avanco_e') return [`joelho_${sfx(chave)}`, `pe_${sfx(chave)}`];
  switch (chave) {
    case 'profundidade': return ['quadril_d', 'joelho_d', 'quadril_e', 'joelho_e'];
    case 'desvio_pelve':
    case 'quadril_tornozelo': return ['quadril_d', 'quadril_e', 'tornozelo_d', 'tornozelo_e'];
    case 'altura_pelve': return ['quadril_d', 'quadril_e'];
    default: return [];
  }
}

/** Pontos do corpo (nomes da trilha, sem os virtuais `_medio`) de que depende a série de uma medida. */
export function pontosDaSerie(protocolo: Protocolo, chave: string): string[] {
  const def = protocolo.articulacoes.find((d) => d.id === chave);
  return def ? pontosDasDefinicoes([def]) : pontosDoDeslocamento(chave);
}

/** Índices em ordem crescente → faixas contínuas [de, até] inclusive. */
export function emFaixas(indices: readonly number[]): [number, number][] {
  const faixas: [number, number][] = [];
  for (const i of [...indices].sort((a, b) => a - b)) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && i <= ultima[1] + 1) ultima[1] = Math.max(ultima[1], i);
    else faixas.push([i, i]);
  }
  return faixas;
}

/** Estende cada faixa para os dois lados enquanto o ponto continua sem detecção confiável: o buraco inteiro da trilha, não só a parte dentro da janela. */
function estenderFaixas(faixas: readonly (readonly [number, number])[], semPonto: (i: number) => boolean, n: number): [number, number][] {
  const estendidas = faixas.map(([de, ate]): [number, number] => {
    let a = de, b = ate;
    while (a > 0 && semPonto(a - 1)) a--;
    while (b < n - 1 && semPonto(b + 1)) b++;
    return [a, b];
  });
  return emFaixas(estendidas.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, k) => a + k)));
}

const quadrosDasFaixas = (faixas: readonly (readonly [number, number])[]): number[] => {
  const q: number[] = [];
  for (const [de, ate] of faixas) for (let i = de; i <= ate; i++) q.push(i);
  return q;
};

/** Menor número de quadros que cumpre a regra de 70% numa janela de `total` quadros (a mesma comparação do motor). */
function quadrosMinimos(total: number): number {
  let k = 0;
  while (k < FRACAO_MINIMA_VALIDOS * total) k++;
  return k;
}

const ordemDoLado: Record<ChaveLado, number> = { D: 0, E: 1, unico: 2 };

export interface EntradaDoDiagnostico {
  protocolo: Protocolo;
  trilha: TrilhaPose;
  repeticoes: readonly Repeticao[];
  falhas: readonly FalhaDePontos[];
  /** Séries brutas (sem interpolação) por chave de série: ângulos e deslocamentos. */
  brutos: Readonly<Record<string, readonly Num[]>>;
  /** Instante de cada quadro da trilha, em segundos. */
  tempos: readonly number[];
}

function entradaDaFalha(f: FalhaDePontos, e: EntradaDoDiagnostico): EntradaPontoPerdido | null {
  const { protocolo, trilha, tempos } = e;
  const n = trilha.quadros.length;
  const bruto = e.brutos[f.serie];
  const def = medidaDo(protocolo, f.medida);
  const rep = e.repeticoes[f.repeticao];
  if (!bruto || !def || !rep || n === 0) return null;
  const de = Math.max(0, f.janela[0]), ate = Math.min(n - 1, f.janela[1]);
  if (de > ate) return null;

  const semMedida: number[] = [];
  for (let j = de; j <= ate; j++) if (!finito(bruto[j])) semMedida.push(j);
  if (!semMedida.length) return null;

  const total = ate - de + 1;
  const pontos: PontoFaltante[] = [];
  for (const nome of pontosDaSerie(protocolo, f.serie)) {
    const semPonto = (j: number): boolean => !pontoUsavel(trilha.quadros[j]?.pontos[nome]);
    const quadros = semMedida.filter(semPonto);
    if (quadros.length) pontos.push({ ponto: nome, rotulo: rotuloDoPonto(nome), quadrosSemPonto: quadros.length, quadrosNaJanela: total, faixas: estenderFaixas(emFaixas(quadros), semPonto, n) });
  }
  // Série sem nenhum ponto faltando (por exemplo, tornozelos alinhados): não há o que arrastar, e o aviso geral da análise já explica.
  if (!pontos.length) return null;
  pontos.sort((a, b) => b.quadrosSemPonto - a.quadrosSemPonto);

  let extremoI: number;
  if (f.extremoI !== null) {
    extremoI = Math.min(Math.max(f.extremoI, 0), n - 1);
  } else {
    const semAlgumPonto = quadrosDasFaixas(pontos.flatMap((p) => p.faixas)).filter((j) => j >= de && j <= ate);
    const alvo = rep.fundoI >= de && rep.fundoI <= ate ? rep.fundoI : Math.round((de + ate) / 2);
    extremoI = semAlgumPonto.reduce((melhor, j) => (Math.abs(j - alvo) < Math.abs(melhor - alvo) ? j : melhor), semAlgumPonto[0]);
  }

  const fase = faseDo(protocolo, def.fase);
  const tempoDe = (i: number): number => (finito(tempos[i]) ? tempos[i] : 0);
  const janela = { inicioI: de, fimI: ate, extremoI, inicioT: tempoDe(de), fimT: tempoDe(ate), extremoT: tempoDe(extremoI) };
  const minimos = quadrosMinimos(total);
  return {
    id: `${f.medida}:${f.lado}:${f.repeticao}:${f.serie}`,
    medida: f.medida,
    nomeMedida: def.nome,
    lado: f.lado,
    repeticao: f.repeticao,
    numero: rep.numero,
    regra: f.regra,
    pontos,
    janela,
    quadrosComValor: total - semMedida.length,
    quadrosNaJanela: total,
    quadrosMinimos: minimos,
    motivo: motivoDoPontoPerdido({
      regra: f.regra,
      rotulosDosPontos: pontos.map((p) => p.rotulo),
      quadrosSemMedida: semMedida.length,
      quadrosNaJanela: total,
      quadrosMinimos: minimos,
      inicioT: janela.inicioT,
      fimT: janela.fimT,
      extremoT: janela.extremoT,
      instante: instanteDaLeitura(def.extracao, fase?.nome ?? def.fase, f.serie === 'quadril_tornozelo'),
      nomeDaFase: fase?.nome ?? def.fase,
    }),
  };
}

function resumoPorPonto(entradas: readonly EntradaPontoPerdido[]): ResumoPontoPerdido[] {
  const acumulado = new Map<string, { rotulo: string; sem: Set<number>; analisados: Set<number>; entradas: number }>();
  for (const e of entradas) {
    for (const p of e.pontos) {
      const a = acumulado.get(p.ponto) ?? { rotulo: p.rotulo, sem: new Set<number>(), analisados: new Set<number>(), entradas: 0 };
      quadrosDasFaixas(p.faixas).filter((q) => q >= e.janela.inicioI && q <= e.janela.fimI).forEach((q) => a.sem.add(q));
      for (let i = e.janela.inicioI; i <= e.janela.fimI; i++) a.analisados.add(i);
      a.entradas++;
      acumulado.set(p.ponto, a);
    }
  }
  return [...acumulado.entries()]
    .map(([ponto, a]) => ({ ponto, rotulo: a.rotulo, quadrosSemPonto: a.sem.size, quadrosAnalisados: a.analisados.size, entradas: a.entradas }))
    .sort((a, b) => b.quadrosSemPonto - a.quadrosSemPonto || a.ponto.localeCompare(b.ponto));
}

/**
 * Lista, por medida, repetição e lado sem valor, os pontos do corpo que faltaram, a janela de quadros e o motivo; mais o resumo por
 * ponto. Só entra aqui medida em que algum ponto do corpo realmente não tinha detecção confiável nos quadros sem medida.
 */
export function diagnosticarPontosPerdidos(e: EntradaDoDiagnostico): PontosPerdidos {
  const ordemMedida = new Map(e.protocolo.medidas.map((m, i) => [m.id, i]));
  const entradas = e.falhas
    .map((f) => entradaDaFalha(f, e))
    .filter((x): x is EntradaPontoPerdido => x !== null)
    .sort((a, b) => a.repeticao - b.repeticao || (ordemMedida.get(a.medida) ?? 0) - (ordemMedida.get(b.medida) ?? 0) || ordemDoLado[a.lado] - ordemDoLado[b.lado] || a.id.localeCompare(b.id));
  return { entradas, porPonto: resumoPorPonto(entradas) };
}

// ---------- itens a corrigir (o que a tela mostra) ----------

/**
 * O que o profissional corrige de uma vez: um ponto do corpo numa repetição. Todas as medidas da repetição que dependem do ponto e
 * perderam quadros viram um item só, com a lista das medidas que ele impede e os quadros sem ponto (o buraco inteiro, com as faixas que
 * sobram se ele for corrigido aos poucos). Assim o número de itens não muda enquanto o profissional corrige o mesmo ponto quadro a quadro.
 */
export interface ItemACorrigir {
  chave: string;
  repeticao: number;
  numero: number;
  ponto: string;
  rotulo: string;
  /** Quadros sem ponto confiável, em faixas contínuas [de, até] (0-based, inclusive). */
  faixas: [number, number][];
  quadrosSemPonto: number;
  primeiroQuadro: number;
  ultimoQuadro: number;
  /** Quadro (0-based) para onde ir: o do extremo que as medidas leem, dentro dos quadros sem ponto quando há. */
  quadro: number;
  tempoS: number;
  medidas: { id: string; nome: string; lado: ChaveLado }[];
  entradas: EntradaPontoPerdido[];
}

/** Segundos entre dois quadros seguidos, pela janela da entrada (a trilha é amostrada a intervalos iguais). */
const passoDaJanela = (e: EntradaPontoPerdido): number => (e.janela.fimI > e.janela.inicioI ? (e.janela.fimT - e.janela.inicioT) / (e.janela.fimI - e.janela.inicioI) : 0);

/**
 * Escolhe o quadro para onde ir: entre os extremos das medidas do item, o do meio dos que caem sobre quadros sem ponto. Se nenhum cai (o
 * profissional já corrigiu o quadro do extremo), vai ao quadro sem ponto mais perto dele: é ali que ainda falta o ponto.
 */
function quadroDoItem(entradas: readonly EntradaPontoPerdido[], quadrosSemPonto: ReadonlySet<number>): { quadro: number; tempoS: number } {
  const candidatos = entradas.map((e) => ({ quadro: e.janela.extremoI, tempoS: e.janela.extremoT, passo: passoDaJanela(e) })).sort((a, b) => a.quadro - b.quadro);
  const sobre = candidatos.filter((c) => quadrosSemPonto.has(c.quadro));
  if (sobre.length) return sobre[Math.floor((sobre.length - 1) / 2)];
  const base = candidatos[Math.floor((candidatos.length - 1) / 2)];
  let perto: number | null = null;
  for (const q of quadrosSemPonto) if (perto === null || Math.abs(q - base.quadro) < Math.abs(perto - base.quadro)) perto = q;
  const quadro = perto ?? base.quadro;
  return { quadro, tempoS: base.tempoS + (quadro - base.quadro) * base.passo };
}

export function agruparItensACorrigir(p: PontosPerdidos): ItemACorrigir[] {
  const grupos = new Map<string, { repeticao: number; ponto: string; entradas: EntradaPontoPerdido[] }>();
  for (const e of p.entradas) {
    for (const x of e.pontos) {
      const chave = `${e.repeticao}:${x.ponto}`;
      const g = grupos.get(chave) ?? { repeticao: e.repeticao, ponto: x.ponto, entradas: [] };
      g.entradas.push(e);
      grupos.set(chave, g);
    }
  }
  const itens = [...grupos.entries()].map(([chave, g]): ItemACorrigir => {
    const quadros = new Set<number>();
    for (const e of g.entradas) quadrosDasFaixas(e.pontos.find((x) => x.ponto === g.ponto)?.faixas ?? []).forEach((q) => quadros.add(q));
    const faixas = emFaixas([...quadros]);
    const primeiroQuadro = faixas[0][0], ultimoQuadro = faixas[faixas.length - 1][1];
    const { quadro, tempoS } = quadroDoItem(g.entradas, quadros);
    const medidas: ItemACorrigir['medidas'] = [];
    for (const e of g.entradas) if (!medidas.some((m) => m.id === e.medida && m.lado === e.lado)) medidas.push({ id: e.medida, nome: e.nomeMedida, lado: e.lado });
    return {
      chave, repeticao: g.repeticao, numero: g.entradas[0].numero, ponto: g.ponto, rotulo: g.entradas[0].pontos.find((x) => x.ponto === g.ponto)?.rotulo ?? g.ponto,
      faixas, quadrosSemPonto: quadros.size, primeiroQuadro, ultimoQuadro, quadro, tempoS, medidas, entradas: g.entradas,
    };
  });
  return itens.sort((a, b) => a.repeticao - b.repeticao || a.primeiroQuadro - b.primeiroQuadro || a.ponto.localeCompare(b.ponto));
}

/** Quantos itens a corrigir há: é o número do rótulo da aba ("3 pontos a conferir"). */
export const contarItensACorrigir = (p: PontosPerdidos): number => agruparItensACorrigir(p).length;
