import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/pdfLogoHelper', () => ({ addLogoToDoc: vi.fn(async () => {}) }));

interface Escrita { pagina: number; texto: string; cor: number[] }
const registro: Escrita[] = [];
interface DocPdf {
  setTextColor: (...c: number[]) => unknown;
  text: (txt: string | string[], ...resto: unknown[]) => unknown;
  getCurrentPageInfo: () => { pageNumber: number };
  getNumberOfPages: () => number;
}
const docs: DocPdf[] = [];

// Embrulha o jsPDF para anotar cada texto escrito, a página em que foi e a cor ativa: o conteúdo do PDF gerado não é texto legível no teste.
vi.mock('jspdf', async (importarOriginal) => {
  const original = await importarOriginal<{ default: new (...args: unknown[]) => DocPdf }>();
  const Real = original.default;
  function Embrulhado(this: unknown, ...args: unknown[]) {
    const doc = new Real(...args);
    let cor: number[] = [0];
    const setTextColor = doc.setTextColor.bind(doc);
    doc.setTextColor = (...c: number[]) => { cor = c; return setTextColor(...c); };
    const text = doc.text.bind(doc);
    doc.text = (txt: string | string[], ...resto: unknown[]) => {
      registro.push({ pagina: doc.getCurrentPageInfo().pageNumber, texto: Array.isArray(txt) ? txt.join(' ') : String(txt), cor: [...cor] });
      return text(txt, ...resto);
    };
    docs.push(doc);
    return doc;
  }
  Object.assign(Embrulhado, Real);
  Embrulhado.prototype = Real.prototype;
  return { ...original, default: Embrulhado };
});

import { modeloDoGesto } from '../lib/angular/video/modelos';
import { cartoesDeMetricas } from '../lib/angular/analiseVideo/resultados';
import { AVISO_ESTIMATIVA_VIDEO } from '../lib/angular/analiseVideo/tiposUi';
import { gerarRelatorioGesto, gerarRelatorioVideo } from '../lib/angular/relatorioVideo';
import type { ResultadoMetrica } from '../lib/angular/video/tipos';

const modelo = modeloDoGesto('marcha');
const metrica = (id: string, nome: string, valor: number, unidade: string): ResultadoMetrica => ({ id, metrica: id, nome, valor, unidade, lado: null, avisos: [] });
const cartao = (id: string, nome: string, valor: number, unidade: string) => cartoesDeMetricas([metrica(id, nome, valor, unidade)], modelo)[0];

const VERDE = [4, 120, 87];
const AMBAR = [180, 83, 9];

const dadosGesto = (cartoes: ReturnType<typeof cartao>[]) => ({
  paciente: 'Paciente Teste', data: '17/10/2026', modelo: { nome: modelo.nome, vista: 'Vista lateral' }, duracaoS: 3.9, fpsAnalise: 30,
  cartoes, graficos: [], quadros: [], correcoes: { quadros: 0, pontos: 0 }, eventosEditados: 0, avisoReferencias: 'Aviso das referências.',
});

const linhaDaSituacao = (trecho: RegExp) => registro.find((e) => trecho.test(e.texto));

beforeEach(() => { registro.length = 0; docs.length = 0; });

describe('PDF: aviso "Estimativa por vídeo · não é diagnóstico" em todas as páginas', () => {
  it('relatório do gesto: a frase exata no pé de cada página, mesmo com várias páginas', async () => {
    const muitos = Array.from({ length: 40 }, () => cartao('cadencia', 'Cadência', 109, 'passos/min'));
    await gerarRelatorioGesto(dadosGesto(muitos));
    const total = docs[0].getNumberOfPages();
    expect(total).toBeGreaterThanOrEqual(2);
    const paginas = registro.filter((e) => e.texto === AVISO_ESTIMATIVA_VIDEO).map((e) => e.pagina);
    expect(paginas).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    expect(AVISO_ESTIMATIVA_VIDEO).toBe('Estimativa por vídeo · não é diagnóstico');
  });

  it('relatório ponto a ponto: a frase exata no pé de cada página', async () => {
    const capturas = Array.from({ length: 90 }, (_, i) => ({ t: i * 0.1, quadro: i * 3, nome: 'Joelho direito', valorTexto: `${20 + (i % 30)},0°`, texto: '' }));
    await gerarRelatorioVideo({ paciente: 'Ana Júlia', data: '05/10/2026', fps: 30, capturas });
    const total = docs[0].getNumberOfPages();
    expect(total).toBeGreaterThanOrEqual(2);
    const paginas = registro.filter((e) => e.texto === AVISO_ESTIMATIVA_VIDEO).map((e) => e.pagina);
    expect(paginas).toEqual(Array.from({ length: total }, (_, i) => i + 1));
  });
});

describe('PDF: situação em texto neutro, igual nos dois lados', () => {
  it('faixa de médias: "dentro" e "fora" com a fonte, na mesma cor neutra (sem verde de aprovação nem âmbar de alerta)', async () => {
    await gerarRelatorioGesto(dadosGesto([cartao('velocidade_marcha', 'Velocidade estimada', 100, 'cm/s'), cartao('velocidade_marcha', 'Velocidade estimada', 150, 'cm/s')]));
    const dentro = linhaDaSituacao(/^dentro da faixa das médias do estudo/);
    const fora = linhaDaSituacao(/^fora da faixa das médias do estudo/);
    expect(dentro?.texto).toBe('dentro da faixa das médias do estudo (Bohannon e Andrews, 2011)');
    expect(fora?.texto).toBe('fora da faixa das médias do estudo (Bohannon, 1997; Bohannon e Andrews, 2011)');
    expect(dentro?.cor).toEqual(fora?.cor);
    expect(dentro?.cor).not.toEqual(VERDE);
    expect(dentro?.cor).not.toEqual(AMBAR);
  });

  it('limiar: "acima/abaixo do limiar de 100 passos/min" com a fonte, na mesma cor neutra, e nunca "dentro/fora"', async () => {
    await gerarRelatorioGesto(dadosGesto([cartao('cadencia', 'Cadência', 109, 'passos/min'), cartao('cadencia', 'Cadência', 88, 'passos/min')]));
    const acima = linhaDaSituacao(/^acima do limiar/);
    const abaixo = linhaDaSituacao(/^abaixo do limiar/);
    expect(acima?.texto).toBe('acima do limiar de 100 passos/min (Tudor-Locke et al., 2018)');
    expect(abaixo?.texto).toBe('abaixo do limiar de 100 passos/min (Tudor-Locke et al., 2018)');
    expect(acima?.cor).toEqual(abaixo?.cor);
    expect(acima?.cor).not.toEqual(VERDE);
    expect(acima?.cor).not.toEqual(AMBAR);
    expect(registro.some((e) => /(dentro|fora) do limiar|médias de grupos/.test(e.texto))).toBe(false);
  });
});
