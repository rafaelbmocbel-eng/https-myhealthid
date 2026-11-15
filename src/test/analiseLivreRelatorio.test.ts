import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/pdfLogoHelper', () => ({ addLogoToDoc: vi.fn(async () => {}) }));

interface Escrita { pagina: number; texto: string; x: number; y: number; tam: number; larg: number; alinhamento: string }
interface Caixa { pagina: number; x: number; y: number; w: number; h: number; estilo: string }
interface Figura { pagina: number; x: number; y: number; w: number; h: number; dados: string }
const escritas: Escrita[] = [];
const caixas: Caixa[] = [];
const figuras: Figura[] = [];

interface DocPdf {
  text: (txt: string | string[], x: number, y: number, op?: { align?: string }) => unknown;
  roundedRect: (x: number, y: number, w: number, h: number, rx: number, ry: number, estilo?: string) => unknown;
  addImage: (dados: string, formato: string, x: number, y: number, w: number, h: number, ...resto: unknown[]) => unknown;
  getCurrentPageInfo: () => { pageNumber: number };
  getFontSize: () => number;
  getTextWidth: (txt: string) => number;
}

// Embrulha o jsPDF para anotar texto, caixas e fotos com a página e as coordenadas: o conteúdo do PDF gerado não é texto legível no teste.
vi.mock('jspdf', async (importarOriginal) => {
  const original = await importarOriginal<{ default: new (...args: unknown[]) => DocPdf }>();
  const Real = original.default;
  function Embrulhado(this: unknown, ...args: unknown[]) {
    const doc = new Real(...args);
    const pagina = () => doc.getCurrentPageInfo().pageNumber;
    const text = doc.text.bind(doc);
    doc.text = (txt, x, y, op) => {
      const linha = Array.isArray(txt) ? txt.join(' ') : String(txt);
      escritas.push({ pagina: pagina(), texto: linha, x, y, tam: doc.getFontSize(), larg: doc.getTextWidth(linha), alinhamento: op?.align ?? 'left' });
      return text(txt, x, y, op);
    };
    const roundedRect = doc.roundedRect.bind(doc);
    doc.roundedRect = (x, y, w, h, rx, ry, estilo) => {
      caixas.push({ pagina: pagina(), x, y, w, h, estilo: estilo ?? '' });
      return roundedRect(x, y, w, h, rx, ry, estilo);
    };
    const addImage = doc.addImage.bind(doc);
    doc.addImage = (dados, formato, x, y, w, h, ...resto) => {
      figuras.push({ pagina: pagina(), x, y, w, h, dados });
      return addImage(dados, formato, x, y, w, h, ...resto);
    };
    return doc;
  }
  Object.assign(Embrulhado, Real);
  Embrulhado.prototype = Real.prototype;
  return { ...original, default: Embrulhado };
});

import { gerarRelatorioAngular } from '../lib/angular/relatorio';
import type { MedidaSalva } from '../lib/angular/comparar';

const m = (id: string, graus: number, extra: Partial<MedidaSalva> = {}): MedidaSalva => ({ id, graus, ...extra });
const COBB = m('cobb', 21.4, { texto: 'Ângulo entre as duas retas (tipo Cobb): 21,4°. Medido na foto sobre as retas marcadas; não substitui o Cobb da radiografia.' });
const base = { paciente: 'Maria da Conceição', profissional: 'Dr. Rafael', data: '05/10/2026', metodo: 'marcacao_manual' as const, medidas: [COBB] };
const textoDoPdf = () => escritas.map((e) => e.texto).join(' ');

beforeEach(() => { escritas.length = 0; caixas.length = 0; figuras.length = 0; });
afterEach(() => { vi.restoreAllMocks(); });

describe('PDF de uma análise livre (o relatório de uma posição, com o nome da análise no lugar da vista)', () => {
  it('o subtítulo traz o nome da análise, a data e o profissional, e não diz "Vista"', async () => {
    await gerarRelatorioAngular({ ...base, vistaNome: 'elevação do braço direito', tituloDaAnalise: 'Análise livre: elevação do braço direito' });
    expect(escritas.some((e) => e.texto === 'Análise livre: elevação do braço direito - 05/10/2026 - Dr. Rafael')).toBe(true);
    expect(textoDoPdf()).not.toMatch(/Vista/);
  });

  it('sem nome, o subtítulo é só "Análise livre"', async () => {
    await gerarRelatorioAngular({ ...base, vistaNome: 'livre', tituloDaAnalise: 'Análise livre' });
    expect(escritas.some((e) => e.texto === 'Análise livre - 05/10/2026 - Dr. Rafael')).toBe(true);
    expect(textoDoPdf()).not.toMatch(/Vista/);
  });

  it('mantém as medidas, a leitura e as ressalvas do rodapé, e não fala em lado do perfil nem em direito e esquerdo da postura', async () => {
    await gerarRelatorioAngular({ ...base, vistaNome: 'x', tituloDaAnalise: 'Análise livre: x' });
    const texto = textoDoPdf();
    expect(texto).toContain('Ângulo entre as duas retas (tipo Cobb)');
    expect(texto).toContain('21,4°');
    expect(texto).toContain('Pontos marcados manualmente pelo profissional.');
    expect(texto).toContain('valem para acompanhar a evolução entre fotos feitas do mesmo jeito.');
    expect(texto).toContain('Medida de acompanhamento, não é diagnóstico.');
    expect(texto).not.toMatch(/perfil|lado d|lado e|frente|costas|detecção automática/i);
  });

  it('nome longo (80 caracteres) com profissional e data cabe: quebra em linhas ou encolhe, e o PDF sai', async () => {
    const nome = 'n'.repeat(80);
    const r = await gerarRelatorioAngular({ ...base, vistaNome: nome, tituloDaAnalise: `Análise livre: ${nome}` });
    expect(r.blob.size).toBeGreaterThan(500);
    expect(textoDoPdf()).toContain('n'.repeat(40));
  });

  it('emoji e ideogramas no nome (que a Helvetica do PDF não desenha) são omitidos do subtítulo; o acento fica', async () => {
    await gerarRelatorioAngular({ ...base, vistaNome: 'x', tituloDaAnalise: 'Análise livre: agachamento \u{1F3CB}\ufe0f ação \u65e5\u672c\u8a9e' });
    expect(escritas.some((e) => e.texto === 'Análise livre: agachamento ação - 05/10/2026 - Dr. Rafael')).toBe(true);
    expect(textoDoPdf()).not.toMatch(/[\u{1F300}-\u{1FAFF}\u65e5\u672c\u8a9e]/u);
    expect(textoDoPdf()).not.toContain('\ufe0f');
  });

  it('nome só de emoji: o subtítulo fica "Análise livre", sem dois-pontos solto', async () => {
    await gerarRelatorioAngular({ ...base, vistaNome: 'x', tituloDaAnalise: 'Análise livre: \u{1F3CB}\ufe0f' });
    expect(escritas.some((e) => e.texto === 'Análise livre - 05/10/2026 - Dr. Rafael')).toBe(true);
  });

  it('sem tituloDaAnalise o relatório de uma vista continua dizendo "Vista <nome>"', async () => {
    await gerarRelatorioAngular({ ...base, vistaNome: 'perfil direito' });
    expect(escritas.some((e) => e.texto === 'Vista perfil direito - 05/10/2026 - Dr. Rafael')).toBe(true);
  });
});
