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
  analisar, analisarCurva, curvaSimulada, CRITERIOS_PADRAO, SLOTS, SLOTS_HOMOLOGOS, nomeSlot,
  type Avaliacao, type Slot,
} from '../lib/dinamometria/analise';
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
