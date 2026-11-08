import { describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/pdfLogoHelper', () => ({ addLogoToDoc: vi.fn(async () => {}) }));
// O jsdom não desenha SVG em canvas: sem o avatar o relatório segue com as tabelas, que é o que o teste confere.
vi.mock('../lib/dinamometria/anatomia', async (importarOriginal) => ({
  ...(await importarOriginal<Record<string, unknown>>()),
  svgParaPNG: async () => { throw new Error('sem canvas no teste'); },
}));

const textos: string[] = [];
interface DocPdf { text: (txt: string | string[], ...resto: unknown[]) => unknown; addImage: (...args: unknown[]) => unknown }

// Embrulha o jsPDF para anotar a ordem dos textos escritos: o conteúdo do PDF gerado não é texto legível no teste.
vi.mock('jspdf', async (importarOriginal) => {
  const original = await importarOriginal<{ default: new (...args: unknown[]) => DocPdf }>();
  const Real = original.default;
  function Embrulhado(this: unknown, ...args: unknown[]) {
    const doc = new Real(...args);
    // Sem canvas no jsdom o gráfico de barras vira imagem vazia, que o jsPDF não aceita.
    doc.addImage = () => doc;
    const text = doc.text.bind(doc);
    doc.text = (txt: string | string[], ...resto: unknown[]) => {
      textos.push(Array.isArray(txt) ? txt.join(' ') : String(txt));
      return text(txt, ...resto);
    };
    return doc;
  }
  Object.assign(Embrulhado, Real);
  Embrulhado.prototype = Real.prototype;
  return { ...original, default: Embrulhado };
});

import {
  analisar, analisarCurva, curvaSimulada, CRITERIOS_PADRAO, interpretar, lsi, SLOTS, SLOTS_HOMOLOGOS, nomeSlot, stLSI,
  type Avaliacao, type Lado, type Slot, type Sujeito,
} from '../lib/dinamometria/analise';
import { achadosDor } from '../lib/dinamometria/dor';
import { gerarRelatorioDinamometria } from '../lib/dinamometria/relatorio';

const PICOS: Record<Slot, number> = { agD: 51.2, agE: 65.7, anD: 51.3, anE: 39.9 };

function avaliacao(regiao = 'joelho'): Avaliacao {
  const slots: Avaliacao['slots'] = {};
  SLOTS.forEach((k, j) => {
    const c = curvaSimulada(PICOS[k], 8, 999 + j * 31);
    const res = analisarCurva(c.t, c.f, CRITERIOS_PADRAO.platoMin);
    if ('metricas' in res) slots[k] = { arquivo: `exemplo_${k}.xlsx (simulado)`, metricas: res.metricas, curva: res.curva };
  });
  return { versao: 1, regiao, braco: null, sujeito: { idade: 30, sexo: 'M', peso: 80, dominante: 'D', acometido: 'N' }, slots };
}

// O jsdom nunca dispara o carregamento de imagem do gráfico de barras; sem canvas o PDF segue só com as tabelas.
vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
vi.stubGlobal('Image', class { onload: (() => void) | null = null; onerror: (() => void) | null = null; width = 0; height = 0; set src(_v: string) { queueMicrotask(() => this.onload?.()); } });

describe('dinamometria: homólogos em linhas vizinhas', () => {
  it('a ordem das linhas é agonistas D e E, depois antagonistas D e E', () => {
    expect(SLOTS_HOMOLOGOS).toEqual(['agD', 'agE', 'anD', 'anE']);
  });

  it('os nomes seguem a ordem Quadríceps D, Quadríceps E, Posteriores D, Posteriores E', () => {
    expect(SLOTS_HOMOLOGOS.map((k) => nomeSlot('joelho', k))).toEqual(['Quadríceps D', 'Quadríceps E', 'Posteriores D', 'Posteriores E']);
  });

  it('no PDF, a tabela de resultados escreve os músculos nessa ordem e põe a razão de cada lado na linha do antagonista', async () => {
    textos.length = 0;
    const av = avaliacao();
    const A = analisar(av, CRITERIOS_PADRAO);
    await gerarRelatorioDinamometria({ paciente: 'Teste', data: '2026-10-18', c: CRITERIOS_PADRAO, itens: [{ av, A, anterior: null, historico: [] }] }, true);

    const inicio = textos.findIndex((t) => t.startsWith('Resultados do paciente'));
    expect(inicio).toBeGreaterThanOrEqual(0);
    const tabela = textos.slice(inicio);
    const pos = (nome: string) => tabela.findIndex((t) => t === nome);
    const ordem = ['Quadríceps D', 'Quadríceps E', 'Posteriores D', 'Posteriores E'].map(pos);
    expect(ordem.every((p) => p >= 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);

    const razaoD = tabela.findIndex((t) => /^D \d+%$/.test(t));
    const razaoE = tabela.findIndex((t) => /^E \d+%$/.test(t));
    expect(razaoD).toBeGreaterThan(ordem[2]);
    expect(razaoD).toBeLessThan(ordem[3]);
    expect(razaoE).toBeGreaterThan(ordem[3]);
  });

  it('sem o antagonista medido, a tabela segue com os agonistas e não quebra', async () => {
    textos.length = 0;
    const av = avaliacao();
    delete av.slots.anD; delete av.slots.anE;
    const A = analisar(av, CRITERIOS_PADRAO);
    await expect(gerarRelatorioDinamometria({ paciente: 'Teste', data: '2026-10-18', c: CRITERIOS_PADRAO, itens: [{ av, A, anterior: null, historico: [] }] }, true)).resolves.toBeDefined();
    expect(textos).toContain('Quadríceps D');
    expect(textos).toContain('Quadríceps E');
    expect(textos).not.toContain('Posteriores D');
  });
});

// ── Simetria entre os lados: sempre o lado mais fraco em % do mais forte ──────────────────────────────────────────
const suj = (acometido: Sujeito['acometido']): Sujeito => ({ idade: 24, sexo: 'M', peso: 87, dominante: 'E', acometido });
const comAcometido = (lado: Sujeito['acometido']): Avaliacao => ({ ...avaliacao(), sujeito: suj(lado) });

describe('dinamometria: simetria entre os lados (lsi)', () => {
  it('lado acometido mais fraco: o mesmo resultado de sempre (fraco ÷ forte)', () => {
    const r = lsi(suj('D'), 51.2, 65.7)!;
    expect(r.fraco).toBe('D');
    expect(r.forte).toBe('E');
    expect(r.v).toBeCloseTo(77.93, 1);
  });

  it('lado acometido MAIS FORTE (o caso do laudo: esquerdo acometido, esquerdo 65,7 × direito 51,2): não dá mais de 100%, o lado mais fraco é o direito', () => {
    const r = lsi(suj('E'), 51.2, 65.7)!;
    expect(r.v).toBeCloseTo(77.93, 1); // antes: 128% "Adequado"
    expect(r.fraco).toBe('D');
    expect(r.forte).toBe('E');
    expect(stLSI(r.v)?.[1]).toBe('Déficit importante');
  });

  it('o mesmo vale para o direito acometido e mais forte', () => {
    const r = lsi(suj('D'), 65.7, 51.2)!;
    expect(r).toMatchObject({ fraco: 'E', forte: 'D' });
    expect(r.v).toBeCloseTo(77.93, 1);
  });

  it('sem lado acometido: menor ÷ maior, nos dois sentidos', () => {
    expect(lsi(suj('N'), 40, 50)).toEqual({ v: 80, fraco: 'D', forte: 'E' });
    expect(lsi(suj('N'), 50, 40)).toEqual({ v: 80, fraco: 'E', forte: 'D' });
  });

  it('lados iguais dão 100%; o acometido desempata qual é o "fraco"', () => {
    expect(lsi(suj('D'), 50, 50)).toEqual({ v: 100, fraco: 'D', forte: 'E' });
    expect(lsi(suj('E'), 50, 50)).toEqual({ v: 100, fraco: 'E', forte: 'D' });
    expect(lsi(suj('N'), 50, 50)).toEqual({ v: 100, fraco: 'E', forte: 'D' });
  });

  it('sem medida de um dos lados, ou com valor zero ou negativo, não há simetria', () => {
    for (const par of [[null, 50], [50, null], [undefined, 50], [0, 50], [50, 0], [-1, 50]] as const) {
      expect(lsi(suj('D'), par[0], par[1]), String(par)).toBeNull();
    }
  });

  it('nunca passa de 100%, é sempre menor ÷ maior e o lado fraco é o que tem menos força, com qualquer acometido', () => {
    const valores = [12.5, 39.9, 40, 51.2, 51.3, 65.7, 80, 200.4];
    for (const acometido of ['D', 'E', 'N'] as const) {
      for (const d of valores) for (const e of valores) {
        const r = lsi(suj(acometido), d, e)!;
        expect(r.v, `${acometido} ${d} ${e}`).toBeLessThanOrEqual(100);
        expect(r.v).toBeCloseTo((Math.min(d, e) / Math.max(d, e)) * 100, 9);
        if (d !== e) expect(r.fraco).toBe(d < e ? 'D' : 'E');
        expect(r.forte).toBe(r.fraco === 'D' ? 'E' : 'D');
      }
    }
  });
});

describe('dinamometria: o laudo com o lado acometido mais forte (caso real do Rafael)', () => {
  const lados = (a: ReturnType<typeof analisar>) => ({ ag: a.lsiAg, an: a.lsiAn });

  it('as duas simetrias saem em déficit importante, batendo com a tabela (Quadríceps D 78%, Posteriores E 78%)', () => {
    const A = analisar(comAcometido('E'), CRITERIOS_PADRAO);
    const { ag, an } = lados(A);
    expect(ag!.fraco).toBe('D');
    expect(Math.round(ag!.v)).toBe(78); // as curvas simuladas dão picos quase iguais aos do laudo
    expect(an!.fraco).toBe('E');
    expect(Math.round(an!.v)).toBe(78);
    expect(stLSI(ag!.v)?.[0]).toBe('bad');
    expect(stLSI(an!.v)?.[0]).toBe('bad');
    expect(A.valencias.simetria?.status?.[0]).toBe('bad');
  });

  it('a interpretação diz "déficit importante" para o quadríceps, em vez de "dentro do critério"', () => {
    const av = comAcometido('E');
    const A = analisar(av, CRITERIOS_PADRAO);
    const textosInterp = interpretar(av, A, CRITERIOS_PADRAO, null);
    const quad = textosInterp.find((t) => t.startsWith('Quadríceps:'))!;
    expect(quad).toContain('o lado direito produz 78% da força do lado esquerdo');
    expect(quad).toContain('déficit importante');
    expect(quad).not.toContain('dentro do critério');
  });

  it('"Relação com dores" passa a apontar o quadríceps direito 22% mais fraco', () => {
    const av = comAcometido('E');
    const A = analisar(av, CRITERIOS_PADRAO);
    const titulos = achadosDor([{ av, A }], CRITERIOS_PADRAO).map((x) => x.titulo);
    expect(titulos.some((t) => /Quadríceps: lado direito 22% mais fraco/.test(t))).toBe(true);
  });

  it('o resultado não depende de qual lado foi marcado como acometido (só desempata lados iguais)', () => {
    const todos = (['D', 'E', 'N'] as const).map((l) => analisar(comAcometido(l), CRITERIOS_PADRAO));
    for (const A of todos) {
      expect(A.lsiAg?.v).toBeCloseTo(todos[0].lsiAg!.v, 9);
      expect(A.lsiAn?.v).toBeCloseTo(todos[0].lsiAn!.v, 9);
      expect(A.lsiAg?.fraco).toBe('D');
      expect(A.lsiAn?.fraco).toBe('E');
    }
  });
});

describe('dinamometria: PDF — cartões de simetria e equilíbrio', () => {
  const gerar = async (acometido: Lado | 'N') => {
    textos.length = 0;
    const av = comAcometido(acometido);
    const A = analisar(av, CRITERIOS_PADRAO);
    await gerarRelatorioDinamometria({ paciente: 'Teste', data: '2026-10-18', c: CRITERIOS_PADRAO, itens: [{ av, A, anterior: null, historico: [] }] }, true);
    const inicio = textos.findIndex((t) => t === 'Simetria e equilíbrio');
    expect(inicio).toBeGreaterThanOrEqual(0);
    return textos.slice(inicio, inicio + 40);
  };

  it('o cartão do quadríceps mostra 78% em déficit importante (lado direito em % do esquerdo), não "Adequado"', async () => {
    const cartoes = await gerar('E');
    const i = cartoes.findIndex((t) => /^SIMETRIA .+ QUADR/.test(t));
    expect(i).toBeGreaterThanOrEqual(0);
    expect(cartoes[i + 1]).toBe('78%');
    expect(cartoes[i + 2]).toMatch(/D[eé]ficit importante.*lado direito em % do esquerdo/);
    expect(cartoes.some((t) => /Adequado.*lado esquerdo em % do direito/.test(t))).toBe(false);
  });

  it('o cartão dos posteriores continua em 78% (lado esquerdo em % do direito)', async () => {
    const cartoes = await gerar('E');
    const i = cartoes.findIndex((t) => /^SIMETRIA .+ POSTERIORES/.test(t));
    expect(cartoes[i + 1]).toBe('78%');
    expect(cartoes[i + 2]).toMatch(/lado esquerdo em % do direito/);
  });

  it('cada par de cartões leva o seu título com a referência: bilateral (diferença até 10%) e antagonista/agonista (~53%)', async () => {
    const cartoes = await gerar('E');
    const bilateral = cartoes.findIndex((t) => /^Simetria bilateral .* refer.ncia: diferen.a at. 10%$/.test(t));
    const razao = cartoes.findIndex((t) => /^Simetria antagonista\/agonista \(Posteriores\/Quadr.ceps\) .* refer.ncia .*53%$/.test(t));
    const primeiroCartao = cartoes.findIndex((t) => /^SIMETRIA /.test(t));
    expect(bilateral).toBeGreaterThanOrEqual(0);
    expect(razao).toBeGreaterThan(bilateral);
    expect(bilateral).toBeLessThan(primeiroCartao);
    expect(razao).toBeLessThan(primeiroCartao);
  });

  it('o resultado é o mesmo com qualquer lado acometido ou sem ele', async () => {
    const e = (await gerar('E')).filter((t) => /^\d+%$/.test(t));
    expect((await gerar('D')).filter((t) => /^\d+%$/.test(t))).toEqual(e);
    expect((await gerar('N')).filter((t) => /^\d+%$/.test(t))).toEqual(e);
  });

  it('em outras articulações o título segue a referência delas: quadril (abdução/adução) usa o mínimo de 80%', async () => {
    textos.length = 0;
    const av: Avaliacao = { ...avaliacao('quadril'), sujeito: suj('E') };
    const A = analisar(av, CRITERIOS_PADRAO);
    await gerarRelatorioDinamometria({ paciente: 'Teste', data: '2026-10-18', c: CRITERIOS_PADRAO, itens: [{ av, A, anterior: null, historico: [] }] }, true);
    const inicio = textos.findIndex((t) => t === 'Simetria e equilíbrio');
    const cartoes = textos.slice(inicio, inicio + 40);
    expect(cartoes.some((t) => /^Simetria bilateral .* refer.ncia: diferen.a at. 10%$/.test(t))).toBe(true);
    expect(cartoes.some((t) => /^Simetria antagonista\/agonista \(Adutores\/Abdutores\) .* refer.ncia >= 80%$/.test(t))).toBe(true);
  });

  it('sem idade e sexo não há referência da razão: o título da razão fica sem o trecho "referência"', async () => {
    textos.length = 0;
    const av: Avaliacao = { ...avaliacao(), sujeito: { ...suj('E'), idade: null as unknown as number } };
    const A = analisar(av, CRITERIOS_PADRAO);
    expect((A.razoes.D || A.razoes.E)?.refTxt).toBe('');
    await gerarRelatorioDinamometria({ paciente: 'Teste', data: '2026-10-18', c: CRITERIOS_PADRAO, itens: [{ av, A, anterior: null, historico: [] }] }, true);
    const inicio = textos.findIndex((t) => t === 'Simetria e equilíbrio');
    const titulo = textos.slice(inicio, inicio + 40).find((t) => /^Simetria antagonista/.test(t));
    expect(titulo).toBe('Simetria antagonista/agonista (Posteriores/Quadríceps)');
  });

  it('sem o antagonista medido, só o título da simetria bilateral aparece (nada de título órfão da razão)', async () => {
    textos.length = 0;
    const av = comAcometido('E');
    delete av.slots.anD; delete av.slots.anE;
    const A = analisar(av, CRITERIOS_PADRAO);
    await gerarRelatorioDinamometria({ paciente: 'Teste', data: '2026-10-18', c: CRITERIOS_PADRAO, itens: [{ av, A, anterior: null, historico: [] }] }, true);
    expect(textos.some((t) => /^Simetria bilateral/.test(t))).toBe(true);
    expect(textos.some((t) => /^Simetria antagonista/.test(t))).toBe(false);
  });
});
