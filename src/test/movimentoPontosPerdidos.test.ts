import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/pdfLogoHelper', () => ({ addLogoToDoc: vi.fn(async () => {}) }));

const escritas: string[] = [];
interface DocPdf { text: (txt: string | string[], x: number, y: number, op?: unknown) => unknown }

// Anota cada texto escrito no PDF: o conteúdo do PDF não é texto legível no teste.
vi.mock('jspdf', async (importarOriginal) => {
  const original = await importarOriginal<{ default: new (...args: unknown[]) => DocPdf }>();
  const Real = original.default;
  function Embrulhado(this: unknown, ...args: unknown[]) {
    const doc = new Real(...args);
    const text = doc.text.bind(doc);
    doc.text = (txt, x, y, op) => {
      for (const linha of Array.isArray(txt) ? txt : [txt]) escritas.push(String(linha));
      return text(txt, x, y, op);
    };
    return doc;
  }
  Object.assign(Embrulhado, Real);
  Embrulhado.prototype = Real.prototype;
  return { ...original, default: Embrulhado };
});

import { analisarMovimento, BIBLIOTECA, montarLaudo, termoProibido, type AnaliseMovimento, type LaudoMovimento } from '../lib/angular/movimento';
import { TEXTO_METODO_PONTOS_PERDIDOS, TITULO_PONTOS_PERDIDOS } from '../lib/angular/movimento/frasesPontosPerdidos';
import { gerarPdfLaudo } from '../lib/angular/movimento/laudoPdf';
import { agruparItensACorrigir, contarItensACorrigir, emFaixas, pontosDaSerie } from '../lib/angular/movimento/pontosPerdidos';
import { protocoloDo } from '../lib/angular/movimento/protocolos';
import { corrigirPonto } from '../lib/angular/video/correcao';
import type { TrilhaPose } from '../lib/angular/video/tipos';
import { resumoDoLaudoEmTexto } from '../components/angular/video/laudo/resumoTexto';
import { contexto, PDF_SEGURO, textos } from './movimentoLaudoFixtures';
import { trilhaAgachamentoFrontal, trilhaAgachamentoLateral, trilhaMarcha } from './movimentoMotorSintetico';

/*
 * Pontos perdidos (agente P): a regra de 70% de pontos brutos em torno do extremo continua igual (a repetição daquele lado fica sem valor, sem
 * interpolar em silêncio), mas agora a análise diz quais pontos faltaram, em que quadros e onde corrigir; ao corrigir à mão, o item some e o valor aparece.
 */

const FPS = 30;

// O jsdom não implementa canvas e reclama a cada chamada: sem contexto, o gráfico simplesmente fica de fora do PDF.
const getContextOriginal = HTMLCanvasElement.prototype.getContext;
beforeAll(() => { HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof getContextOriginal; });
afterAll(() => { HTMLCanvasElement.prototype.getContext = getContextOriginal; });

// Em agachamentos de 3 s por repetição e 1 s em pé, a repetição 2 (posição 1) tem o ponto mais baixo em 5,5 s.
const noFundoDaRepeticao2 = (nome: string) => (_i: number, t: number) => (t > 5.3 && t < 5.75 ? [nome] : false);
const naRepeticao2Inteira = (nome: string) => (_i: number, t: number) => (t > 4.2 && t < 7.2 ? [nome] : false);

const lateral = (perdidos?: (i: number, t: number) => string[] | boolean) => trilhaAgachamentoLateral(perdidos ? { perdidos } : {});
const medida = (a: AnaliseMovimento, id: string) => {
  const m = a.medidas.find((x) => x.def.id === id);
  if (!m) throw new Error(`medida ${id} não encontrada`);
  return m;
};

/** Corrige o ponto nos dois extremos do buraco e no meio, com a posição que ele tinha na figura sem perda (como o profissional faria arrastando). */
function corrigirOBuraco(perdida: TrilhaPose, inteira: TrilhaPose, nome: string, de: number, ate: number, maxEntre = 1.2): TrilhaPose {
  const quadros = new Set<number>([de, ate]);
  const passo = Math.max(1, Math.floor(maxEntre * FPS));
  for (let i = de + passo; i < ate; i += passo) quadros.add(i);
  let t = perdida;
  for (const i of [...quadros].sort((a, b) => a - b)) {
    const p = inteira.quadros[i].pontos[nome];
    t = corrigirPonto(t, i, nome, { x: p.x, y: p.y });
  }
  return t;
}

describe('pontos perdidos no agachamento de lado', () => {
  const inteira = lateral();
  const perdida = lateral(noFundoDaRepeticao2('joelho_e'));
  const sem = analisarMovimento('agachamento_lateral', inteira);
  const com = analisarMovimento('agachamento_lateral', perdida);

  it('sem perda de pontos a lista é vazia, o resumo por ponto também, e não há nada a conferir', () => {
    expect(sem.pontosPerdidos).toEqual({ entradas: [], porPonto: [] });
    expect(contarItensACorrigir(sem.pontosPerdidos)).toBe(0);
    for (const [protocolo, trilha] of [['agachamento_frontal', trilhaAgachamentoFrontal({})], ['marcha_lateral', trilhaMarcha({})]] as const) {
      expect(analisarMovimento(protocolo, trilha).pontosPerdidos.entradas, protocolo).toEqual([]);
    }
  });

  it('cada medida, repetição e lado que ficou sem valor vem com os pontos, a janela de quadros, o tempo e o motivo', () => {
    const { entradas } = com.pontosPerdidos;
    expect(entradas.map((e) => e.medida).sort()).toEqual(['avanco_joelho_fundo', 'dorsiflexao_max', 'flexao_joelho_max', 'flexao_quadril_max']);
    const fundoI = com.repeticoes[1].fundoI;
    for (const e of entradas) {
      expect(e.lado, e.id).toBe('E');
      expect(e.repeticao, e.id).toBe(1);
      expect(e.numero, e.id).toBe(2);
      expect(e.regra, e.id).toBe('extremo');
      expect(e.pontos.map((p) => p.ponto), e.id).toEqual(['joelho_e']);
      expect(e.pontos[0].rotulo).toBe('Joelho esquerdo');
      expect(e.janela.inicioI <= e.janela.extremoI && e.janela.extremoI <= e.janela.fimI, e.id).toBe(true);
      expect(Math.abs(e.janela.extremoI - fundoI), e.id).toBeLessThanOrEqual(8);
      expect(e.janela.extremoT).toBeCloseTo(perdida.quadros[e.janela.extremoI].t, 9);
      expect(e.janela.fimT - e.janela.inicioT).toBeCloseTo((e.janela.fimI - e.janela.inicioI) / FPS, 9);
      expect(e.quadrosComValor, e.id).toBeLessThan(e.quadrosMinimos);
      expect(e.quadrosNaJanela).toBe(e.janela.fimI - e.janela.inicioI + 1);
      expect(e.pontos[0].faixas, e.id).toEqual([[160, 172]]);
      expect(e.motivo, e.id).toMatch(/faltou ponto confiável de joelho esquerdo/);
      expect(e.motivo, e.id).toMatch(/70%/);
      expect(e.motivo, e.id).toMatch(/nada foi preenchido/);
      expect(termoProibido(e.motivo), e.motivo).toBeNull();
      expect(e.motivo, e.id).toMatch(PDF_SEGURO);
    }
  });

  it('o resumo por ponto conta os quadros sem ponto confiável nas janelas analisadas, sem contar duas vezes', () => {
    const { porPonto, entradas } = com.pontosPerdidos;
    expect(porPonto).toHaveLength(1);
    expect(porPonto[0]).toMatchObject({ ponto: 'joelho_e', rotulo: 'Joelho esquerdo', entradas: entradas.length });
    // As janelas se sobrepõem (todas em torno do ponto mais baixo): os quadros distintos são menos que a soma deles.
    const soma = entradas.reduce((s, e) => s + e.pontos[0].quadrosSemPonto, 0);
    expect(porPonto[0].quadrosSemPonto).toBeGreaterThan(0);
    expect(porPonto[0].quadrosSemPonto).toBeLessThan(soma);
    expect(porPonto[0].quadrosAnalisados).toBeGreaterThanOrEqual(porPonto[0].quadrosSemPonto);
  });

  it('as medidas afetadas ficam sem valor e a repetição é sinalizada; o resto continua igual ao vídeo sem perda', () => {
    const afetadas = new Set(com.pontosPerdidos.entradas.map((e) => `${e.medida}:${e.lado}:${e.repeticao}`));
    expect(afetadas.size).toBe(4);
    expect(com.repeticoes[1].sinalizadores).toContain('pontos_ausentes');
    for (const m of com.medidas) {
      for (const lado of Object.keys(m.valores) as ('D' | 'E' | 'unico')[]) {
        (m.valores[lado] ?? []).forEach((v, r) => {
          const esperado = medida(sem, m.def.id).valores[lado]?.[r] ?? null;
          if (afetadas.has(`${m.def.id}:${lado}:${r}`)) expect(v, `${m.def.id} ${lado} ${r}`).toBeNull();
          else if (esperado === null) expect(v).toBeNull();
          else expect(v as number, `${m.def.id} ${lado} ${r}`).toBeCloseTo(esperado, 0);
        });
      }
    }
  });

  it('o rigor não muda: uma correção só no ponto mais baixo não esconde a perda (o item continua)', () => {
    const p = inteira.quadros[165].pontos.joelho_e;
    const uma = analisarMovimento('agachamento_lateral', corrigirPonto(perdida, 165, 'joelho_e', { x: p.x, y: p.y }));
    expect(uma.pontosPerdidos.entradas.length).toBeGreaterThan(0);
    expect(medida(uma, 'avanco_joelho_fundo').valores.E?.[1]).toBeNull();
    // Corrigir o mesmo ponto aos poucos não multiplica os itens: continua um item, agora com o buraco partido em duas faixas e um quadro a menos.
    const itens = agruparItensACorrigir(uma.pontosPerdidos);
    expect(itens).toHaveLength(1);
    expect(itens[0].faixas).toEqual([[160, 164], [166, 172]]);
    expect(itens[0].quadrosSemPonto).toBe(12);
    expect(itens[0].primeiroQuadro).toBe(160);
    expect(itens[0].ultimoQuadro).toBe(172);
    // "Ir ao quadro" não leva de volta ao quadro que o profissional acabou de corrigir: vai ao quadro sem ponto mais perto do extremo.
    expect(itens[0].quadro).not.toBe(165);
    expect(itens[0].faixas.some(([de, ate]) => itens[0].quadro >= de && itens[0].quadro <= ate)).toBe(true);
    expect(Math.abs(itens[0].quadro - 165)).toBeLessThanOrEqual(1);
    expect(itens[0].tempoS).toBeCloseTo(perdida.quadros[itens[0].quadro].t, 6);
  });

  it('corrigir o buraco à mão faz as entradas sumirem e os valores aparecerem', () => {
    const corrigida = corrigirOBuraco(perdida, inteira, 'joelho_e', 160, 172);
    const depois = analisarMovimento('agachamento_lateral', corrigida);
    expect(depois.pontosPerdidos).toEqual({ entradas: [], porPonto: [] });
    expect(depois.repeticoes[1].sinalizadores).not.toContain('pontos_ausentes');
    for (const id of ['flexao_joelho_max', 'flexao_quadril_max', 'dorsiflexao_max', 'avanco_joelho_fundo']) {
      const v = medida(depois, id).valores.E?.[1];
      expect(v, id).not.toBeNull();
      expect(v as number, id).toBeCloseTo(medida(sem, id).valores.E?.[1] as number, -1);
    }
    // O valor vem de uma reta entre quadros-chave, não da curva verdadeira: fica perto, e a diferença é do profissional que posicionou os pontos.
    expect(Math.abs((medida(depois, 'flexao_joelho_max').valores.E?.[1] as number) - 105)).toBeLessThan(2);
    expect(depois.avisos.join(' ')).not.toMatch(/pontos do corpo ausentes/);
  });

  it('o item a corrigir junta as medidas do mesmo buraco: um ponto, uma repetição, o quadro do extremo dentro do buraco', () => {
    const itens = agruparItensACorrigir(com.pontosPerdidos);
    expect(itens).toHaveLength(1);
    const [item] = itens;
    expect(contarItensACorrigir(com.pontosPerdidos)).toBe(1);
    expect(item).toMatchObject({ repeticao: 1, numero: 2, ponto: 'joelho_e', rotulo: 'Joelho esquerdo', primeiroQuadro: 160, ultimoQuadro: 172, quadrosSemPonto: 13 });
    expect(item.quadro).toBeGreaterThanOrEqual(item.primeiroQuadro);
    expect(item.quadro).toBeLessThanOrEqual(item.ultimoQuadro);
    expect(item.tempoS).toBeCloseTo(perdida.quadros[item.quadro].t, 9);
    expect(item.medidas.map((m) => m.id).sort()).toEqual(['avanco_joelho_fundo', 'dorsiflexao_max', 'flexao_joelho_max', 'flexao_quadril_max']);
  });

  it('perda na repetição inteira: regra da fase, o quadro vai para o ponto mais baixo e o buraco vem inteiro', () => {
    const a = analisarMovimento('agachamento_lateral', lateral(naRepeticao2Inteira('joelho_e')));
    const fase = a.pontosPerdidos.entradas.filter((e) => e.regra === 'fase');
    expect(fase.map((e) => e.medida).sort()).toEqual(['dorsiflexao_max', 'flexao_joelho_max', 'flexao_quadril_max']);
    for (const e of fase) {
      expect(e.janela.inicioI).toBe(a.repeticoes[1].inicioI);
      expect(e.janela.fimI).toBe(a.repeticoes[1].fimI);
      expect(Math.abs(e.janela.extremoI - a.repeticoes[1].fundoI)).toBeLessThanOrEqual(2);
      expect(e.motivo).toMatch(/Na fase "Repetição inteira"/);
      expect(e.pontos[0].faixas).toEqual([[127, 215]]);
    }
    expect(agruparItensACorrigir(a.pontosPerdidos)).toHaveLength(1);
  });

  it('dois pontos que faltam no mesmo lugar viram dois itens, cada um com o seu ponto', () => {
    const a = analisarMovimento('agachamento_lateral', lateral((_i, t) => (t > 5.3 && t < 5.75 ? ['joelho_e', 'tornozelo_e'] : false)));
    const itens = agruparItensACorrigir(a.pontosPerdidos);
    expect(itens.map((i) => i.ponto).sort()).toEqual(['joelho_e', 'tornozelo_e']);
  });

  it('o vocabulário de todos os textos é neutro e cabe no PDF', () => {
    for (const e of com.pontosPerdidos.entradas) {
      expect(termoProibido(e.motivo)).toBeNull();
      expect(e.motivo).toMatch(PDF_SEGURO);
    }
  });
});

describe('pontos perdidos nos outros protocolos', () => {
  it('agachamento de frente: um tornozelo que some no fundo impede o desvio da pelve e o valgo daquele lado', () => {
    const a = analisarMovimento('agachamento_frontal', trilhaAgachamentoFrontal({ perdidos: noFundoDaRepeticao2('tornozelo_d') }));
    const ids = a.pontosPerdidos.entradas.map((e) => `${e.medida}:${e.lado}`).sort();
    expect(ids).toEqual(['desvio_lateral_pelve_fundo:unico', 'valgo_joelho_max:D']);
    expect(a.pontosPerdidos.entradas.every((e) => e.pontos[0].ponto === 'tornozelo_d' && e.numero === 2)).toBe(true);
    expect(agruparItensACorrigir(a.pontosPerdidos)).toHaveLength(1);
  });

  it('marcha: a perda cai na passada do pé certo e não toca as passadas do outro pé', () => {
    const a = analisarMovimento('marcha_lateral', trilhaMarcha({ perdidos: (_i, t) => (t > 4 && t < 5 ? ['joelho_e'] : false) }));
    expect(a.pontosPerdidos.entradas.length).toBeGreaterThan(0);
    for (const e of a.pontosPerdidos.entradas) {
      expect(e.lado, e.id).toBe('E');
      expect(a.repeticoes[e.repeticao].lado, e.id).toBe('E');
      expect(e.pontos.map((p) => p.ponto)).toContain('joelho_e');
    }
    expect(a.pontosPerdidos.entradas.map((e) => e.medida)).toContain('flexao_joelho_pico_balanco');
  });

  it('a série de cada medida declara os pontos de que depende', () => {
    const p = protocoloDo('agachamento_lateral');
    expect(pontosDaSerie(p, 'joelho_e')).toEqual(['quadril_e', 'joelho_e', 'tornozelo_e']);
    expect(pontosDaSerie(p, 'tronco').sort()).toEqual(['ombro_d', 'ombro_e', 'quadril_d', 'quadril_e']);
    expect(pontosDaSerie(p, 'avanco_d')).toEqual(['joelho_d', 'pe_d']);
    expect(pontosDaSerie(p, 'inexistente')).toEqual([]);
    expect(emFaixas([5, 3, 4, 9, 10, 12])).toEqual([[3, 5], [9, 10], [12, 12]]);
  });
});

describe('laudo e PDF com e sem pontos perdidos', () => {
  const inteira = lateral();
  const perdida = lateral(noFundoDaRepeticao2('joelho_e'));
  const laudoDe = (a: AnaliseMovimento): LaudoMovimento => montarLaudo(a, contexto(), BIBLIOTECA);

  beforeEach(() => { escritas.length = 0; });

  it('com perda, o laudo traz a seção "Medidas não calculadas por pontos perdidos" com o que ficou de fora', () => {
    const a = analisarMovimento('agachamento_lateral', perdida);
    const laudo = laudoDe(a);
    expect(laudo.pontosPerdidos).not.toBeNull();
    const secao = laudo.pontosPerdidos!;
    expect(secao.titulo).toBe(TITULO_PONTOS_PERDIDOS);
    expect(secao.titulo).toBe('Medidas não calculadas por pontos perdidos');
    expect(secao.id).toBe('pontos-perdidos');
    expect(secao.itens).toHaveLength(a.pontosPerdidos.entradas.length);
    expect(secao.paragrafos.join(' ')).toMatch(/nada foi preenchido ou estimado/);
    expect(secao.paragrafos.join(' ')).toMatch(/70%/);
    expect(secao.itens.join(' ')).toMatch(/Repetição 2 · Flexão máxima do joelho \(lado esquerdo\): sem ponto confiável de joelho esquerdo/);
    expect(secao.itens.join(' ')).toMatch(/sem ponto nos quadros 161 a 173/);
    for (const frase of textos(secao)) {
      expect(termoProibido(frase), frase).toBeNull();
      expect(frase, frase).toMatch(PDF_SEGURO);
    }
  });

  it('o resumo avisa que medidas ficaram de fora, e o método traz a regra de 70% e o que fazer', () => {
    const laudo = laudoDe(analisarMovimento('agachamento_lateral', perdida));
    expect(laudo.resumo.paragrafos.join(' ')).toMatch(/4 medidas não foram calculadas por pontos perdidos/);
    expect(laudo.metodo.paragrafos).toContain(TEXTO_METODO_PONTOS_PERDIDOS);
    expect(TEXTO_METODO_PONTOS_PERDIDOS).toMatch(/70% dos quadros de ±0,15 s em torno do instante do extremo/);
    expect(TEXTO_METODO_PONTOS_PERDIDOS).toMatch(/nada é preenchido ou estimado/);
    expect(TEXTO_METODO_PONTOS_PERDIDOS).toMatch(/corrigir os pontos à mão/);
  });

  it('sem perda a seção não existe, o resumo não fala de pontos perdidos e o método continua com a regra', () => {
    const laudo = laudoDe(analisarMovimento('agachamento_lateral', inteira));
    expect(laudo.pontosPerdidos).toBeNull();
    expect(laudo.resumo.paragrafos.join(' ')).not.toMatch(/pontos perdidos/);
    expect(laudo.metodo.paragrafos).toContain(TEXTO_METODO_PONTOS_PERDIDOS);
  });

  it('depois da correção feita à mão a seção some do laudo', () => {
    const corrigida = corrigirOBuraco(perdida, inteira, 'joelho_e', 160, 172);
    const laudo = laudoDe(analisarMovimento('agachamento_lateral', corrigida));
    expect(laudo.pontosPerdidos).toBeNull();
    expect(laudo.resumo.paragrafos.join(' ')).not.toMatch(/pontos perdidos/);
  });

  it('o resumo copiado leva a seção quando há perda e não leva quando não há', () => {
    const com = resumoDoLaudoEmTexto(laudoDe(analisarMovimento('agachamento_lateral', perdida)));
    expect(com).toContain('Medidas não calculadas por pontos perdidos:');
    expect(com).toMatch(/- Repetição 2 · Dorsiflexão máxima do tornozelo \(lado esquerdo\)/);
    expect(resumoDoLaudoEmTexto(laudoDe(analisarMovimento('agachamento_lateral', inteira)))).not.toContain('pontos perdidos:');
  });

  it('o PDF imprime a seção e os itens quando há perda e não imprime quando não há', async () => {
    const blobCom = await gerarPdfLaudo(laudoDe(analisarMovimento('agachamento_lateral', perdida)));
    expect(blobCom.size).toBeGreaterThan(1000);
    const textoCom = escritas.join(' ');
    expect(textoCom).toContain('Enquanto os pontos não forem corrigidos à mão pelo profissional');
    expect(textoCom).toMatch(/Repetição 2 · Flexão máxima do joelho \(lado esquerdo\): sem ponto confiável de joelho esquerdo/);
    escritas.length = 0;
    await gerarPdfLaudo(laudoDe(analisarMovimento('agachamento_lateral', inteira)));
    const textoSem = escritas.join(' ');
    expect(textoSem).not.toContain('Enquanto os pontos não forem corrigidos à mão pelo profissional');
    expect(textoSem).not.toMatch(/sem ponto confiável de joelho esquerdo/);
  });
});
