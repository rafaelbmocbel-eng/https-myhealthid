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

import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import { seguro, gerarRelatorioAngular } from '../lib/angular/relatorio';
import {
  FRASE_NIVEL_AUSENTE, LARGURA_MAX_FOTO_PDF, NOTA_MEMBROS_SUPERIORES,
  fraseDoMetodo, gerarRelatorioSessao, paresMembrosSuperiores,
  type DadosRelatorioSessao, type VistaDoRelatorioSessao,
} from '../lib/angular/relatorioSessao';
import type { MedidaSalva } from '../lib/angular/comparar';

// JPEG 1x1 válido; o teste troca a altura e a largura declaradas no cabeçalho para dar proporção à foto (o jsPDF só lê o cabeçalho).
const JPEG_1X1 = '/9j/4AAQSkZJRgABAQAAAAAAAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAAf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AH//Z';
function foto(largura: number, altura: number): string {
  const bytes = Buffer.from(JPEG_1X1, 'base64');
  const i = bytes.indexOf(Buffer.from([0xff, 0xc0]));
  bytes.writeUInt16BE(altura, i + 5);
  bytes.writeUInt16BE(largura, i + 7);
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}

const lerPdf = (blob: Blob) => new Promise<string>((ok) => {
  const leitor = new FileReader();
  leitor.onload = () => ok(Buffer.from(leitor.result as ArrayBuffer).toString('latin1'));
  leitor.readAsArrayBuffer(blob);
});
const paginasDoPdf = (bruto: string) => (bruto.match(/\/Type \/Page\b/g) ?? []).length;

const m = (id: string, graus: number, extra: Partial<MedidaSalva> = {}): MedidaSalva => ({ id, graus, ...extra });
const pontos = (sugeridas: string[], ajustadas: string[], soMao: string[]) => ({ sugeridas, ajustadas, soMao });
const vista = (posicao: VistaDoRelatorioSessao['posicao'], vistaNome: string, medidas: MedidaSalva[], extra: Partial<VistaDoRelatorioSessao> = {}): VistaDoRelatorioSessao =>
  ({ posicao, vistaNome, medidas, metodo: 'marcacao_manual', ...extra });
const base = { paciente: 'Maria da Conceição', profissional: 'Dr. Rafael', data: '05/10/2026' };

async function gerar(vistas: VistaDoRelatorioSessao[], extra: Partial<DadosRelatorioSessao> = {}) {
  escritas.length = 0; caixas.length = 0; figuras.length = 0;
  const r = await gerarRelatorioSessao({ ...base, vistas, ...extra });
  const bruto = await lerPdf(r.blob);
  const texto = escritas.map((e) => e.texto).join(' ');
  return { ...r, bruto, texto, paginas: paginasDoPdf(bruto), escritas: [...escritas], caixas: [...caixas], figuras: [...figuras] };
}

// Os títulos de seção e de posição são os únicos textos em 10,5 pt.
const titulos = (r: { escritas: Escrita[] }) => r.escritas.filter((e) => e.tam === 10.5).map((e) => e.texto);
const FRENTE_COM_MEMBROS: MedidaSalva[] = [
  m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' }),
  m('braco-d', 6.2, { sentido: 'cotovelo afastado do tronco' }),
  m('braco-e', 3.1, { sentido: 'cotovelo afastado do tronco' }),
  m('carregamento-d', 11.5, { sentido: 'valgo' }),
  m('carregamento-e', 8, { sentido: 'varo' }),
  m('punho-d', 4.4),
  m('punho-e', 2.2),
];
const PERFIL_D = [m('cva', 48.3), m('braco-d', 5, { sentido: 'cotovelo à frente do ombro' }), m('cotovelo-perfil', 12.2)];
const PERFIL_E = [m('cva', 50.1), m('braco-e', 3.3, { sentido: 'cotovelo à frente do ombro' }), m('cotovelo-perfil', 9.8)];
const COSTAS = [m('ombros', 1, { texto: 'Linha dos ombros: 1,0° com a horizontal, lado esquerdo mais alto.' }), m('braco-d', 4.1, { sentido: 'cotovelo junto do tronco' }), m('braco-e', 4.9, { sentido: 'cotovelo junto do tronco' })];

const quatroPosicoes = (largura = 600, altura = 800): VistaDoRelatorioSessao[] => [
  vista('frente', 'Frente', FRENTE_COM_MEMBROS, { imagem: foto(largura, altura), metodo: 'automatica_conferida', pontos: pontos(['ombros', 'braco-d', 'braco-e'], ['ombros', 'braco-d', 'braco-e'], ['carregamento-d', 'carregamento-e', 'punho-d', 'punho-e']), notaNivel: 'foto nivelada em 1,8° (correção aplicada).' }),
  vista('perfil_d', 'Perfil direito', PERFIL_D, { imagem: foto(largura, altura), metodo: 'automatica_conferida', pontos: pontos(['braco-d', 'cotovelo-perfil'], [], ['cva']) }),
  vista('perfil_e', 'Perfil esquerdo', PERFIL_E, { imagem: foto(altura, largura), metodo: 'automatica_conferida' }),
  vista('costas', 'Costas', COSTAS, { imagem: foto(largura, altura) }),
];

beforeEach(() => { escritas.length = 0; caixas.length = 0; figuras.length = 0; });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

// ---------------------------------------------------------------------------
describe('textos puros', () => {
  it('seguro troca o que a Helvetica do PDF não desenha e deixa o resto como está', () => {
    expect(seguro('a → b “x” ‘y’ ≥ 3 ≤ 4 − 5 – 6 — 7 · 8 ≈ 9 ‑ 10 ′ ″')).toBe('a > b "x" \'y\' >= 3 <= 4 - 5 - 6 - 7 - 8 ~ 9 - 10 \' "');
    expect(seguro('Ângulo 12,5° à direita: ação')).toBe('Ângulo 12,5° à direita: ação');
  });

  it('método automático nunca diz que o profissional conferiu os pontos e diz a verdade sobre quantas medidas vieram do modelo, quantas foram ajustadas e quantas foram marcadas à mão', () => {
    const sem = fraseDoMetodo('automatica_conferida');
    expect(sem).toContain('Pontos sugeridos por detecção automática (confirmar na foto)');
    expect(sem).toContain('O modelo marca o centro da articulação, não o ponto ósseo.');
    expect(sem).not.toMatch(/conferid|ajustada|só à mão/i);
    expect(fraseDoMetodo('automatica_conferida', pontos(['ombros', 'quadris', 'braco-d'], ['ombros'], ['punho-d', 'carregamento-d'])))
      .toBe('Pontos sugeridos por detecção automática (confirmar na foto) em 3 medidas, 1 ajustada à mão; 2 medidas marcadas só à mão. O modelo marca o centro da articulação, não o ponto ósseo.');
    expect(fraseDoMetodo('automatica_conferida', pontos(['ombros', 'quadris'], [], [])))
      .toBe('Pontos sugeridos por detecção automática (confirmar na foto) em 2 medidas, nenhuma ajustada à mão. O modelo marca o centro da articulação, não o ponto ósseo.');
    expect(fraseDoMetodo('automatica_conferida', pontos(['ombros'], ['ombros'], ['punho-d'])))
      .toContain('em 1 medida, 1 ajustada à mão; 1 medida marcada só à mão.');
    expect(fraseDoMetodo('automatica_conferida', pontos(['a', 'b', 'c'], ['a', 'b', 'c'], [])))
      .toContain('em 3 medidas, 3 ajustadas à mão.');
  });

  it('método manual diz que foi marcado à mão e não fala em detecção', () => {
    expect(fraseDoMetodo('marcacao_manual', pontos(['ombros'], ['ombros'], []))).toBe('Pontos marcados manualmente pelo profissional.');
  });
});

// ---------------------------------------------------------------------------
describe('membros superiores: pares direito x esquerdo (valores calculados à mão)', () => {
  it('frente: D menos E com uma casa; lados opostos (valgo e varo), lado só de um membro e unidades diferentes não se subtraem', () => {
    const g = paresMembrosSuperiores([
      { posicao: 'frente', medidas: [
        m('braco-d', 6.2, { sentido: 'cotovelo afastado do tronco' }), m('braco-e', 3.1, { sentido: 'cotovelo afastado do tronco' }),
        m('carregamento-d', 11.5, { sentido: 'valgo' }), m('carregamento-e', 8, { sentido: 'varo' }),
        m('punho-d', 4.4),
        m('punho-d', 1, { unidade: 'cm' }),
      ] },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].titulo).toBe('Frente');
    const [braco, carregamento, punho] = g[0].linhas;
    expect(braco.nome).toBe('Alinhamento do braço');
    expect(braco.diferenca).toBe(3.1);
    expect(braco.motivoSemDiferenca).toBeNull();
    expect(carregamento.nome).toBe('Ângulo de carregamento do cotovelo (estimativa por foto)');
    expect(carregamento.diferenca).toBeNull();
    expect(carregamento.motivoSemDiferenca).toBe('sentidos diferentes');
    expect(punho.direito?.graus).toBe(1);
    expect(punho.esquerdo).toBeNull();
    expect(punho.diferenca).toBeNull();
    expect(punho.motivoSemDiferenca).toBe('falta um dos lados');
  });

  it('unidades diferentes entre D e E: sem diferença', () => {
    const g = paresMembrosSuperiores([{ posicao: 'frente', medidas: [m('punho-d', 4, { unidade: 'cm' }), m('punho-e', 4)] }]);
    expect(g[0].linhas[0].diferenca).toBeNull();
    expect(g[0].linhas[0].motivoSemDiferenca).toBe('unidades diferentes');
  });

  it('diferença arredondada em uma casa sem ruído de ponto flutuante e com sinal de E maior que D', () => {
    const g = paresMembrosSuperiores([{ posicao: 'costas', medidas: [m('braco-d', 0.3), m('braco-e', 0.1), m('punho-d', 4.1), m('punho-e', 4.9)] }]);
    expect(g[0].titulo).toBe('Costas');
    expect(g[0].linhas.map((l) => l.diferenca)).toEqual([0.2, -0.8]);
  });

  it('perfil: o direito vem da foto do perfil direito e o esquerdo da foto do perfil esquerdo, inclusive o cotovelo de perfil (id sem lado)', () => {
    const g = paresMembrosSuperiores([
      { posicao: 'perfil_d', medidas: PERFIL_D },
      { posicao: 'perfil_e', medidas: PERFIL_E },
    ]);
    expect(g).toHaveLength(1);
    expect(g[0].titulo).toBe('Perfil direito (foto do lado direito) e perfil esquerdo (foto do lado esquerdo)');
    const [braco, cotovelo] = g[0].linhas;
    expect([braco.direito?.graus, braco.esquerdo?.graus, braco.diferenca]).toEqual([5, 3.3, 1.7]);
    expect(cotovelo.nome).toBe('Flexão/extensão do cotovelo');
    expect([cotovelo.direito?.graus, cotovelo.esquerdo?.graus, cotovelo.diferenca]).toEqual([12.2, 9.8, 2.4]);
  });

  it('medida do lado oposto dentro da foto de perfil não vira o lado da foto', () => {
    const g = paresMembrosSuperiores([{ posicao: 'perfil_d', medidas: [m('braco-e', 7), m('braco-d', 2)] }]);
    expect(g[0].linhas).toHaveLength(1);
    expect(g[0].linhas[0].direito?.graus).toBe(2);
    expect(g[0].linhas[0].esquerdo).toBeNull();
  });

  it('perfil sem lado informado nunca se pareia com perfil direito ou esquerdo: fica em grupo próprio', () => {
    const g = paresMembrosSuperiores([
      { posicao: 'perfil_d', medidas: [m('braco-d', 5)] },
      { posicao: 'perfil_sem_lado', medidas: [m('braco-e', 2)] },
    ]);
    expect(g.map((x) => x.titulo)).toEqual(['Perfil direito (foto do lado direito) e perfil esquerdo (foto do lado esquerdo)', 'Perfil (lado não informado)']);
    expect(g[0].linhas[0].esquerdo).toBeNull();
    expect(g[0].linhas[0].diferenca).toBeNull();
    expect(g[1].linhas[0].direito).toBeNull();
    expect(g[1].linhas[0].diferenca).toBeNull();
  });

  it('só entram medidas de membro superior; desníveis, joelho e cabeça ficam de fora, e sem membros não há grupo', () => {
    const g = paresMembrosSuperiores([
      { posicao: 'frente', medidas: [m('ombros', 2), m('cotovelos', 1), m('escapulas', 3), m('joelho-d', 5), m('joelho-e', 4), m('cabeca', 2), m('pelve', 1)] },
      { posicao: 'costas', medidas: [] },
    ]);
    expect(g).toEqual([]);
  });

  it('ordem dos grupos: frente, costas, perfil, perfil sem lado; grupo vazio não aparece', () => {
    const g = paresMembrosSuperiores([
      { posicao: 'perfil_sem_lado', medidas: [m('braco-d', 1), m('braco-e', 1)] },
      { posicao: 'costas', medidas: [m('braco-d', 1), m('braco-e', 1)] },
      { posicao: 'perfil_e', medidas: [m('braco-e', 1)] },
      { posicao: 'frente', medidas: [m('braco-d', 1), m('braco-e', 1)] },
    ]);
    expect(g.map((x) => x.titulo.split(' ')[0])).toEqual(['Frente', 'Costas', 'Perfil', 'Perfil']);
    expect(g[3].titulo).toBe('Perfil (lado não informado)');
  });
});

// ---------------------------------------------------------------------------
describe('PDF da sessão: uma posição', () => {
  const frente = [m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' }), m('cotovelos', 1.4, { texto: 'Linha dos cotovelos: 1,4° com a horizontal, lado esquerdo mais alto.' })];

  it('1 página, seções esperadas, nome com "sessao" e nenhuma foto nem tabela de membros superiores', async () => {
    const r = await gerar([vista('frente', 'Frente', frente)]);
    expect(r.nome).toBe('Analise_angular_sessao_MARIA_DA_CONCEICAO_2026-10-05.pdf');
    expect(r.blob.size).toBeGreaterThan(1000);
    expect(r.paginas).toBe(1);
    expect(titulos(r)).toEqual(['Posições feitas e não feitas', 'Frente', 'Leitura', 'Como foi medido']);
    expect(r.texto).toContain('Análise angular da sessão');
    expect(r.texto).toContain('1 posição feita - 05/10/2026 - Dr. Rafael');
    expect(r.texto).toContain('Página 1 de 1');
    expect(r.figuras).toHaveLength(0);
    expect(r.bruto).not.toContain('Membros superiores');
  });

  it('as posições não feitas aparecem como não feitas', async () => {
    const r = await gerar([vista('frente', 'Frente', frente)]);
    const linhas = r.escritas.filter((e) => e.texto === 'Não feita nesta sessão');
    expect(linhas).toHaveLength(3);
    expect(r.escritas.filter((e) => e.texto.startsWith('Feita -')).map((e) => e.texto)).toEqual(['Feita - 2 medidas - marcação manual - sem foto neste relatório']);
    expect(r.texto).toContain('Foto não incluída neste relatório');
  });

  it('sem avaliação anterior não há colunas Antes e Variação; com avaliação anterior elas aparecem com a data', async () => {
    const sem = await gerar([vista('frente', 'Frente', frente)]);
    expect(sem.escritas.some((e) => e.texto === 'Variação' || e.texto.startsWith('Antes'))).toBe(false);
    const com = await gerar([vista('frente', 'Frente', frente, { anterior: { data: '01/09/2026', medidas: [m('ombros', 3.4, { texto: 'lado direito mais alto' })] } })]);
    expect(com.escritas.some((e) => e.texto === 'Antes (01/09/2026)')).toBe(true);
    expect(com.escritas.some((e) => e.texto === 'Variação')).toBe(true);
  });

  it('uma posição com muitas medidas continua em outra página repetindo o cabeçalho da tabela, sem passar do limite do conteúdo', async () => {
    const muitas = Array.from({ length: 45 }, (_, i) => m('livre', 10 + i, { texto: `Ângulo livre ${i}: ${10 + i},0°.` })).map((x, i) => ({ ...x, id: `livre-${i}` }));
    const r = await gerar([vista('frente', 'Frente', muitas)]);
    // 45 linhas de pelo menos 6,4 mm passam de 280 mm: não cabem em uma página de 250 mm de conteúdo.
    const paginasDaTabela = r.escritas.filter((e) => e.texto === 'Medida').map((e) => e.pagina);
    expect(paginasDaTabela.length).toBeGreaterThanOrEqual(2);
    expect(r.escritas.find((e) => e.texto === 'livre-0')?.pagina).toBe(paginasDaTabela[0]);
    expect(r.escritas.find((e) => e.texto === 'livre-44')?.pagina).toBe(paginasDaTabela[paginasDaTabela.length - 1]);
    expect(Math.max(...r.escritas.filter((e) => e.y < 271).map((e) => e.y))).toBeLessThanOrEqual(268);
  });

  it('sessão sem nenhuma posição e posição sem medidas não quebram e dizem isso', async () => {
    const vazia = await gerar([]);
    expect(vazia.paginas).toBe(1);
    expect(vazia.texto).toContain('Nenhuma posição registrada nesta sessão.');
    expect(vazia.texto).toContain('0 posições feitas');
    const semMedidas = await gerar([vista('costas', 'Costas', [])]);
    expect(semMedidas.texto).toContain('Sem medidas registradas');
    expect(semMedidas.texto).toContain('Nenhuma medida registrada nesta posição.');
    expect(semMedidas.texto).toContain('0 posições feitas');
  });

  it('nome vazio da posição usa o rótulo padrão', async () => {
    const r = await gerar([vista('perfil_sem_lado', '  ', frente)]);
    expect(titulos(r)).toContain('Perfil (lado não informado)');
    expect(r.escritas.some((e) => e.texto.startsWith('Feita -') && e.tam === 8.5)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('PDF da sessão: quatro posições', () => {
  it('sem fotos e uma medida cada: 2 páginas (o conteúdo de 4 blocos passa de uma página e nunca de duas)', async () => {
    const r = await gerar([
      vista('frente', 'Frente', [m('ombros', 2)]), vista('perfil_d', 'Perfil direito', [m('cva', 48)]),
      vista('perfil_e', 'Perfil esquerdo', [m('cva', 50)]), vista('costas', 'Costas', [m('ombros', 1)]),
    ]);
    expect(r.paginas).toBe(2);
    expect(r.escritas.filter((e) => /^Página \d de \d$/.test(e.texto)).map((e) => e.texto)).toEqual(['Página 1 de 2', 'Página 2 de 2']);
    expect(r.escritas.filter((e) => e.texto === 'Não feita nesta sessão')).toHaveLength(0);
    expect(r.texto).toContain('4 posições feitas');
  });

  it('com foto de 95 mm e seis medidas por posição: de 4 a 6 páginas, número de páginas igual ao do arquivo e nas legendas', async () => {
    const seis = Array.from({ length: 6 }, (_, i) => m(`livre-${i}`, 10 + i));
    const r = await gerar(['frente', 'perfil_d', 'perfil_e', 'costas'].map((p) => vista(p as 'frente', p, seis, { imagem: foto(600, 800) })));
    expect(r.paginas).toBeGreaterThanOrEqual(4);
    expect(r.paginas).toBeLessThanOrEqual(6);
    expect(r.escritas.filter((e) => /^Página \d+ de \d+$/.test(e.texto)).map((e) => e.texto)).toEqual(Array.from({ length: r.paginas }, (_, i) => `Página ${i + 1} de ${r.paginas}`));
  });

  it('seções: posições, miniaturas, um bloco por posição, membros superiores; e nenhum bloco de comparação sem avaliação anterior', async () => {
    const r = await gerar(quatroPosicoes());
    const t = titulos(r);
    expect(t.slice(0, 2)).toEqual(['Posições feitas e não feitas', 'Fotos da sessão']);
    expect(t.filter((x) => ['Frente', 'Perfil direito', 'Perfil esquerdo', 'Costas'].includes(x))).toEqual(['Frente', 'Perfil direito', 'Perfil esquerdo', 'Costas']);
    expect(t.filter((x) => x === 'Como foi medido')).toHaveLength(4);
    expect(t[t.length - 1]).toBe('Membros superiores');
    expect(r.escritas.some((e) => e.texto === 'Diferença (D - E)')).toBe(true);
    expect(r.escritas.some((e) => e.texto === 'Variação')).toBe(false);
  });

  it('as posições saem na ordem de fotografar, qualquer que seja a ordem dos dados', async () => {
    const r = await gerar([...quatroPosicoes()].reverse());
    expect(titulos(r).filter((x) => ['Frente', 'Perfil direito', 'Perfil esquerdo', 'Costas'].includes(x))).toEqual(['Frente', 'Perfil direito', 'Perfil esquerdo', 'Costas']);
  });

  it('miniaturas: uma por foto, em até 4 colunas na mesma linha, com a legenda da posição; a foto grande reaproveita a mesma imagem no arquivo', async () => {
    const r = await gerar(quatroPosicoes());
    const miniaturas = r.figuras.filter((f) => f.pagina === 1).slice(0, 4);
    expect(miniaturas).toHaveLength(4);
    expect(new Set(miniaturas.map((f) => Math.round(f.y))).size).toBe(1);
    expect(miniaturas.map((f) => f.x)).toEqual([...miniaturas.map((f) => f.x)].sort((a, b) => a - b));
    expect(r.figuras).toHaveLength(8);
    const legendas = r.escritas.filter((e) => e.tam === 8 && e.alinhamento === 'center').map((e) => e.texto);
    expect(legendas).toEqual(['Frente', 'Perfil direito', 'Perfil esquerdo', 'Costas']);
    // Quatro fotos desenhadas duas vezes cada uma entram no arquivo uma vez só.
    expect(r.bruto.match(/\/Subtype \/Image/g)?.length ?? 0).toBeLessThanOrEqual(4);
  });

  it('as fotos não passam de 95 mm de altura e mantêm a proporção', async () => {
    const r = await gerar(quatroPosicoes());
    const grandes = r.figuras.filter((f) => f.h > 60);
    expect(grandes).toHaveLength(4);
    for (const f of grandes) expect(f.h).toBeLessThanOrEqual(95);
    const retrato = grandes[0];
    expect(retrato.w / retrato.h).toBeCloseTo(600 / 800, 3);
    const paisagem = grandes[2];
    expect(paisagem.w / paisagem.h).toBeCloseTo(800 / 600, 3);
  });

  it('método e correção de nível por posição, cada um no bloco da sua posição', async () => {
    const r = await gerar(quatroPosicoes());
    const indices = (nome: string) => r.escritas.findIndex((e) => e.tam === 10.5 && e.texto === nome);
    const bloco = (de: string, ate: string) => r.escritas.slice(indices(de), indices(ate)).map((e) => e.texto).join(' ');
    const frente = bloco('Frente', 'Perfil direito');
    expect(frente).toContain('Método: Pontos sugeridos por detecção automática (confirmar na foto) em 3 medidas, 3 ajustadas à mão; 4 medidas marcadas só à mão.');
    expect(frente).toContain('Correção de nível: foto nivelada em 1,8° (correção aplicada).');
    const perfilD = bloco('Perfil direito', 'Perfil esquerdo');
    expect(perfilD).toContain('em 2 medidas, nenhuma ajustada à mão; 1 medida marcada só à mão.');
    expect(perfilD).toContain(`Correção de nível: ${FRASE_NIVEL_AUSENTE}`);
    expect(perfilD).not.toContain('foto nivelada');
    const perfilE = bloco('Perfil esquerdo', 'Costas');
    expect(perfilE).toContain('Pontos sugeridos por detecção automática');
    expect(perfilE).not.toContain('ajustada');
    const costas = bloco('Costas', 'Membros superiores');
    expect(costas).toContain('Método: Pontos marcados manualmente pelo profissional.');
    expect(costas).not.toContain('detecção automática');
  });

  it('quem lê não entende que tudo veio do modelo: ombros e quadris sugeridos e aceitos, carregamento, punho e escápula só à mão', async () => {
    const r = await gerar([vista('frente', 'Frente', FRENTE_COM_MEMBROS, {
      metodo: 'automatica_conferida', pontos: pontos(['ombros', 'quadris'], [], ['carregamento-d', 'carregamento-e', 'punho-d', 'punho-e', 'escapulas']),
    })]);
    expect(r.texto).toContain('em 2 medidas, nenhuma ajustada à mão; 5 medidas marcadas só à mão.');
    // "nenhuma medida ajustada" sozinho, sem dizer que há medidas só à mão, era o texto que enganava.
    expect(r.texto).not.toContain('nenhuma medida ajustada à mão');
    // O resumo da posição também não diz só "detecção automática".
    expect(r.escritas.some((e) => e.tam === 8.5 && e.texto.startsWith('Feita -') && e.texto.includes('detecção automática e marcação manual'))).toBe(true);
    // A nota da tabela direito x esquerdo não atribui ao modelo os pontos marcados à mão.
    const nota = r.escritas.map((e) => e.texto).join(' ');
    expect(nota).toContain('Pontos sugeridos pela detecção automática');
    expect(nota).toContain('os demais foram marcados à mão');
    expect(nota).not.toContain('e o modelo marca o centro da articulação');
  });

  it('resumo das posições: só detecção automática, só marcação manual ou as duas, conforme os pontos', async () => {
    const r = await gerar([
      vista('frente', 'Frente', [m('ombros', 2)], { metodo: 'automatica_conferida', pontos: pontos(['ombros'], [], []) }),
      vista('perfil_d', 'Perfil direito', [m('cva', 48), m('braco-d', 5)], { metodo: 'automatica_conferida', pontos: pontos(['braco-d'], [], ['cva']) }),
      vista('perfil_e', 'Perfil esquerdo', [m('cva', 50)], { metodo: 'automatica_conferida' }),
      vista('costas', 'Costas', [m('ombros', 1)]),
    ]);
    const linhas = r.escritas.filter((e) => e.tam === 8.5 && e.texto.startsWith('Feita -')).map((e) => e.texto);
    expect(linhas).toEqual([
      'Feita - 1 medida - detecção automática - sem foto neste relatório',
      'Feita - 2 medidas - detecção automática e marcação manual - sem foto neste relatório',
      'Feita - 1 medida - detecção automática - sem foto neste relatório',
      'Feita - 1 medida - marcação manual - sem foto neste relatório',
    ]);
  });

  it('membros superiores: Direito, Esquerdo e a diferença D - E de cada plano, com a ressalva de ângulo projetado', async () => {
    const r = await gerar(quatroPosicoes());
    const i = r.escritas.findIndex((e) => e.tam === 10.5 && e.texto === 'Membros superiores');
    const secao = r.escritas.slice(i).map((e) => e.texto).join(' ');
    for (const esperado of ['Direito', 'Esquerdo', 'Diferença (D - E)', '+3,1°', '+2,2°', '-0,8°', '+1,7°', '+2,4°', 'sentidos diferentes', 'Frente', 'Costas']) expect(secao).toContain(esperado);
    // Valgo (11,5°) e varo (8,0°) são lados opostos: nada de 3,5.
    expect(secao).not.toMatch(/[+-]3,5/);
    expect(secao).toContain('Ângulos projetados no plano da foto');
    expect(secao).toContain('estimativa a confirmar');
    expect(NOTA_MEMBROS_SUPERIORES).toContain('estimativa a confirmar');
    // A tabela cabe numa página e fica inteira em uma só.
    expect(r.escritas.filter((e) => e.texto === 'Diferença (D - E)')).toHaveLength(1);
  });

  it('a primeira posição começa na página da capa com a foto reduzida para caber (de 70 a 95 mm) em vez de deixar a página meio vazia', async () => {
    // Capa: cabeçalho, resumo e faixa de miniaturas ocupam cerca de 150 mm; sobram uns 117 mm, de onde sai a foto de 70 a 95 mm.
    const r = await gerar(quatroPosicoes());
    const tituloFrente = r.escritas.find((e) => e.tam === 10.5 && e.texto === 'Frente');
    expect(tituloFrente?.pagina).toBe(1);
    const primeiraGrande = r.figuras.filter((f) => f.h > 60)[0];
    expect(primeiraGrande.pagina).toBe(1);
    expect(primeiraGrande.h).toBeGreaterThanOrEqual(70);
    expect(primeiraGrande.h).toBeLessThan(95);
    // As demais não encolhem: começam no alto de uma página com tudo que cabe.
    for (const f of r.figuras.filter((x) => x.h > 60).slice(1, 3)) expect(f.h).toBe(95);
  });

  it('com uma foto só (sem miniaturas) a capa leva a foto inteira, de 95 mm', async () => {
    const r = await gerar([vista('frente', 'Frente', [m('ombros', 2)], { imagem: foto(600, 800) })]);
    expect(r.figuras).toHaveLength(1);
    expect(r.figuras[0].h).toBe(95);
    expect(r.figuras[0].pagina).toBe(1);
  });

  it('perfil sem lado ao lado de perfil direito: nada de diferença entre eles', async () => {
    const r = await gerar([
      vista('perfil_d', 'Perfil direito', [m('braco-d', 5, { sentido: 'cotovelo à frente do ombro' })]),
      vista('perfil_sem_lado', 'Perfil (lado não informado)', [m('braco-e', 2, { sentido: 'cotovelo à frente do ombro' })]),
    ]);
    expect(r.texto).toContain('Perfil (lado não informado)');
    expect(r.texto).not.toMatch(/\+3,0°/);
    expect(r.escritas.filter((e) => e.tam === 8.5 && e.texto.startsWith('Feita -'))).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
describe('PDF da sessão: comparação com a avaliação anterior', () => {
  const agora = [
    m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' }),
    m('cotovelos', 1.4, { texto: 'Linha dos cotovelos: 1,4° com a horizontal, lado esquerdo mais alto.' }),
    m('braco-d', 6.2, { sentido: 'cotovelo afastado do tronco' }),
    m('joelho-d', 7),
    m('joelho-e', 5),
  ];
  const antes = [
    m('ombros', 3.4, { texto: 'Linha dos ombros: 3,4°, lado direito mais alto.' }),
    m('cotovelos', 2, { texto: 'Linha dos cotovelos: 2,0°, lado direito mais alto.' }),
    m('braco-d', 2, { unidade: 'cm' }),
    m('joelho-d', 5),
    m('punho-e', 3),
  ];

  it('variação é só agora menos antes; lado trocado e unidade diferente não se subtraem; falta de um lado é explicada', async () => {
    const r = await gerar([vista('frente', 'Frente', agora, { anterior: { data: '01/09/2026', medidas: antes } })]);
    const celulas = r.escritas.map((e) => e.texto);
    expect(celulas).toContain('-1,3°');
    expect(celulas).toContain('+2,0°');
    expect(celulas).toContain('lado mudou');
    expect(celulas).toContain('unidades diferentes');
    expect(celulas).toContain('não marcada antes');
    expect(r.texto).toContain('Marcadas só na avaliação anterior (não marcadas agora): Alinhamento antebraço-mão esquerdo.');
    // 1,4 - 2,0 e 1,4 + 2,0 seriam as contas erradas do cotovelo (lado direito para lado esquerdo).
    expect(r.texto).not.toMatch(/[+-]0,6°/);
    expect(r.texto).not.toMatch(/[+-]3,4°/);
    expect(r.texto).toContain('não indica melhora nem piora');
  });

  const AVISO_NIVEL = 'Frente: na avaliação anterior a foto foi nivelada (correção de 1,8°); nesta não consta correção de nível. Os ângulos podem não ser comparáveis.';

  it('os avisos de comparabilidade da posição saem sob a tabela dela, antes da leitura, no mesmo texto da tela', async () => {
    const r = await gerar([vista('frente', 'Frente', agora, { anterior: { data: '01/09/2026', medidas: antes }, avisos: [AVISO_NIVEL, 'Frente: outro aviso de comparação.'] })]);
    const i = (texto: string) => r.escritas.findIndex((e) => e.texto === texto || e.texto.startsWith(texto));
    expect(r.texto).toContain(AVISO_NIVEL);
    expect(r.texto).toContain('Frente: outro aviso de comparação.');
    const iAviso = i('Frente: na avaliação anterior a foto foi nivelada');
    expect(iAviso).toBeGreaterThan(i('Variação'));
    expect(iAviso).toBeGreaterThan(i('A variação é só a diferença numérica'));
    expect(iAviso).toBeLessThan(r.escritas.findIndex((e) => e.tam === 10.5 && e.texto === 'Leitura'));
    expect(r.escritas.findIndex((e) => e.texto === 'Frente: outro aviso de comparação.')).toBeGreaterThan(iAviso);
  });

  it('sem aviso (posições comparáveis), nada além das notas de sempre: o PDF não inventa aviso', async () => {
    const sem = await gerar([vista('frente', 'Frente', agora, { anterior: { data: '01/09/2026', medidas: antes } })]);
    const vazio = await gerar([vista('frente', 'Frente', agora, { anterior: { data: '01/09/2026', medidas: antes }, avisos: [] })], { avisosGerais: [] });
    expect(sem.texto).not.toMatch(/podem não ser comparáveis|só nesta avaliação|ainda não foi feita nesta|perfil sem lado/i);
    expect(vazio.texto).toBe(sem.texto);
  });

  it('posição que só existe nesta avaliação também ganha o aviso sob a tabela, mesmo sem colunas Antes e Variação', async () => {
    const r = await gerar([vista('frente', 'Frente', agora, { avisos: ['Frente: só nesta avaliação; a anterior não tem essa posição.'] })]);
    expect(r.escritas.some((e) => e.texto === 'Variação')).toBe(false);
    expect(r.texto).toContain('Frente: só nesta avaliação; a anterior não tem essa posição.');
  });

  it('avisos gerais (posição que estava na anterior e não foi feita agora, perfil antigo sem lado, formatos diferentes) saem logo abaixo do quadro das posições', async () => {
    const gerais = ['Costas: estava na avaliação anterior e ainda não foi feita nesta.', 'Perfil sem lado informado (avaliação antiga) não é comparado com perfil direito ou esquerdo: não dá para saber de que lado foi a foto.'];
    const r = await gerar([vista('frente', 'Frente', agora)], { avisosGerais: gerais });
    for (const g of gerais) expect(r.texto).toContain(g.slice(0, 60));
    const iResumo = r.escritas.findIndex((e) => e.tam === 10.5 && e.texto === 'Posições feitas e não feitas');
    const iAviso = r.escritas.findIndex((e) => e.texto.startsWith('Costas: estava na avaliação anterior'));
    const iFrente = r.escritas.findIndex((e) => e.tam === 10.5 && e.texto === 'Frente');
    expect(iAviso).toBeGreaterThan(iResumo);
    expect(iAviso).toBeLessThan(iFrente);
  });

  it('avaliação anterior sem data: o cabeçalho fica só "Antes" (não passa da coluna) e a falta da data vai numa nota abaixo da tabela', async () => {
    const dados = (data: string) => [vista('frente', 'Frente', agora, { anterior: { data, medidas: antes } })];
    const sem = await gerar(dados(''));
    const cabecalho = sem.escritas.find((e) => e.tam === 8.5 && e.texto.startsWith('Antes'))!;
    const variacao = sem.escritas.find((e) => e.tam === 8.5 && e.texto === 'Variação')!;
    expect(cabecalho.texto).toBe('Antes');
    expect(cabecalho.x + cabecalho.larg).toBeLessThan(variacao.x);
    const aviso = sem.escritas.find((e) => e.texto === 'Data da avaliação anterior não informada.')!;
    expect(aviso).toBeDefined();
    expect(aviso.y).toBeGreaterThan(cabecalho.y);
    expect(sem.texto).not.toContain('data não informada)');

    const com = await gerar(dados('01/09/2026'));
    expect(com.escritas.some((e) => e.texto === 'Antes (01/09/2026)')).toBe(true);
    expect(com.texto).not.toContain('Data da avaliação anterior não informada');
  });
});

// ---------------------------------------------------------------------------
describe('PDF da sessão: marca "estimativa: confirme"', () => {
  const MARCA = 'estimativa: confirme';
  const frente = [
    m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' }),
    m('quadris', 1.9, { texto: 'Linha dos quadris: 1,9° com a horizontal, lado direito mais alto.' }),
    m('pelve', 1.2, { texto: 'Linha da pelve: 1,2° com a horizontal, lado esquerdo mais alto.' }),
    m('linha-joelhos', 0.8, { texto: 'Linha dos joelhos: 0,8° com a horizontal, lado esquerdo mais alto.' }),
    m('joelho-d', 6, { texto: 'Joelho direito: 174,0°, valgo.' }),
    m('braco-d', 6.2, { texto: 'Braço direito: 6,2° com a vertical.' }),
  ];
  const perfil = [m('joelho', 4, { texto: 'Joelho: 176,0°, flexão.' }), m('cva', 48, { texto: 'Ângulo craniovertebral: 48,0°.' }), m('pelve-perfil', 8, { texto: 'Inclinação pélvica: 8,0°, anterior.' })];

  it('na tabela da posição, só as medidas que pedem confirmação levam a marca sob o nome', async () => {
    const r = await gerar([vista('frente', 'Frente', frente), vista('perfil_d', 'Perfil direito', perfil)]);
    const iMembros = r.escritas.findIndex((e) => e.tam === 10.5 && e.texto === 'Membros superiores');
    const marcas = r.escritas.slice(0, iMembros).filter((e) => e.texto === MARCA);
    // quadris, pelve, linha dos joelhos e braço (frente) + joelho (perfil); ombros, joelho de frente, CVA e pelve de perfil ficam sem marca.
    expect(marcas).toHaveLength(5);
    const nomeDaMarca = (marca: Escrita) => r.escritas.filter((e) => e.pagina === marca.pagina && e.x === marca.x && e.y < marca.y && e.tam === 9).pop()?.texto;
    expect(marcas.map(nomeDaMarca)).toEqual(['Alinhamento do braço direito', 'Desnível da pelve', 'Linha dos quadris (sugerida pelo modelo)', 'Linha dos joelhos (desnível)', 'Ângulo do joelho']);
  });

  it('na leitura, o texto das medidas que pedem confirmação termina com "(estimativa: confirme)"; as outras não', async () => {
    const r = await gerar([vista('frente', 'Frente', frente), vista('perfil_d', 'Perfil direito', perfil)]);
    expect(r.texto).toContain(`Linha dos quadris: 1,9° com a horizontal, lado direito mais alto. (${MARCA})`);
    expect(r.texto).toContain(`Linha da pelve: 1,2° com a horizontal, lado esquerdo mais alto. (${MARCA})`);
    expect(r.texto).toContain(`Linha dos joelhos: 0,8° com a horizontal, lado esquerdo mais alto. (${MARCA})`);
    expect(r.texto).toContain(`Joelho: 176,0°, flexão. (${MARCA})`);
    expect(r.texto).toContain('Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.');
    expect(r.texto).not.toContain(`lado direito mais alto. (${MARCA})\nLinha dos ombros`);
    expect(r.texto).not.toContain(`Joelho direito: 174,0°, valgo. (${MARCA})`);
    expect(r.texto).not.toContain(`Ângulo craniovertebral: 48,0°. (${MARCA})`);
    expect(r.texto).not.toContain(`Linha dos ombros: 2,1° com a horizontal, lado direito mais alto. (${MARCA})`);
  });

  it('na tabela dos membros superiores, braço, punho e carregamento levam a marca, e cotovelo de perfil também', async () => {
    const r = await gerar(quatroPosicoes());
    const i = r.escritas.findIndex((e) => e.tam === 10.5 && e.texto === 'Membros superiores');
    const marcas = r.escritas.slice(i).filter((e) => e.texto === MARCA);
    // Frente: braço, carregamento, punho; costas: braço; perfil: braço e cotovelo de perfil.
    expect(marcas).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
describe('PDF da sessão: palavras que o relatório não pode ter', () => {
  const PROIBIDAS = /\b(normal|normais|anormal|alterad[oa]s?|bom|boa|ruim|ruins|patol[óo]gic[oa]s?|saud[áa]ve[li]s?|ideal|d[ée]ficit|melhorou|piorou)\b/i;
  const comparativo = (v: VistaDoRelatorioSessao) => ({ ...v, anterior: { data: '01/09/2026', medidas: v.medidas.map((x) => ({ ...x, graus: x.graus + 1 })) } });

  it('1 e 4 posições, com e sem avaliação anterior: sem "conferidos pelo profissional", sem classificação e sem valor de referência', async () => {
    const um = await gerar([vista('frente', 'Frente', FRENTE_COM_MEMBROS, { metodo: 'automatica_conferida' })]);
    const quatro = await gerar(quatroPosicoes());
    const comparados = await gerar(quatroPosicoes().map(comparativo));
    for (const r of [um, quatro, comparados]) {
      expect(r.texto).not.toMatch(/conferid/i);
      expect(r.bruto).not.toMatch(/conferid/i);
      expect(r.texto).not.toMatch(PROIBIDAS);
      expect(r.texto).not.toMatch(/\b(faixa|refer[êe]ncia de normalidade|valor ideal)\b/i);
      expect(r.texto).toContain('sem valor de referência');
      expect(r.texto).toContain('repita nas mesmas condições: mesma distância, altura da câmera e roupa');
      expect(r.texto).toContain('Estimativa por foto');
    }
    expect(quatro.texto).toContain('Pontos sugeridos por detecção automática');
  });

  it('o rodapé com as ressalvas está em todas as páginas', async () => {
    const r = await gerar(quatroPosicoes());
    expect(r.paginas).toBeGreaterThan(1);
    for (let p = 1; p <= r.paginas; p++) {
      const daPagina = r.escritas.filter((e) => e.pagina === p && e.y > 271).map((e) => e.texto).join(' ');
      expect(daPagina).toContain('Estimativa por foto');
      expect(daPagina).toContain(`Página ${p} de ${r.paginas}`);
    }
  });
});

// ---------------------------------------------------------------------------
describe('PDF da sessão: posição sem foto', () => {
  it('foto ausente, nula, ilegível ou de formato que o PDF não lê: o bloco sai sem foto e o resto do relatório não se perde', async () => {
    const r = await gerar([
      vista('frente', 'Frente', FRENTE_COM_MEMBROS, { imagem: foto(600, 800) }),
      vista('perfil_d', 'Perfil direito', PERFIL_D, { imagem: null }),
      vista('perfil_e', 'Perfil esquerdo', PERFIL_E, { imagem: 'data:image/jpeg;base64,AAAA' }),
      vista('costas', 'Costas', COSTAS, { imagem: 'data:image/webp;base64,UklGRg==' }),
    ]);
    expect(r.paginas).toBeGreaterThanOrEqual(2);
    expect(r.figuras.length).toBeGreaterThan(0);
    expect(r.figuras.every((f) => f.dados === r.figuras[0].dados)).toBe(true);
    expect(r.texto).toContain('Foto não incluída neste relatório');
    expect(r.texto.match(/Não foi possível incluir a foto neste relatório\./g)).toHaveLength(2);
    expect(r.escritas.filter((e) => e.tam === 8.5 && e.texto.endsWith('sem foto neste relatório'))).toHaveLength(3);
    expect(titulos(r)).toEqual(expect.arrayContaining(['Frente', 'Perfil direito', 'Perfil esquerdo', 'Costas', 'Membros superiores']));
    // Só uma foto: não há faixa de miniaturas.
    expect(titulos(r)).not.toContain('Fotos da sessão');
  });

  it('todas as posições sem foto: sem miniaturas, sem imagem no arquivo', async () => {
    const r = await gerar(quatroPosicoes().map((v) => ({ ...v, imagem: undefined })));
    expect(r.figuras).toHaveLength(0);
    expect(r.bruto).not.toContain('/Subtype /Image');
    expect(titulos(r)).not.toContain('Fotos da sessão');
  });
});

// ---------------------------------------------------------------------------
describe('PDF da sessão: a foto vai reduzida para o arquivo não ficar pesado', () => {
  interface CanvasFalso { width: number; height: number; getContext: () => unknown; toDataURL: ReturnType<typeof vi.fn> }
  function simularNavegador(naturalWidth: number, naturalHeight: number, reduzida: string, falhaAoCarregar = false) {
    class ImagemFalsa {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      naturalWidth = naturalWidth;
      naturalHeight = naturalHeight;
      set src(_: string) {
        queueMicrotask(() => {
          if (falhaAoCarregar) this.onerror?.();
          else this.onload?.();
        });
      }
    }
    vi.stubGlobal('Image', ImagemFalsa);
    const canvas: CanvasFalso = { width: 0, height: 0, getContext: () => ({ fillStyle: '', fillRect: vi.fn(), drawImage: vi.fn() }), toDataURL: vi.fn(() => reduzida) };
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => (tag === 'canvas' ? canvas : original(tag))) as typeof document.createElement);
    return canvas;
  }

  it('a largura máxima das fotos do PDF é menor que a das fotos que a tela monta (1100 px)', () => {
    expect(LARGURA_MAX_FOTO_PDF).toBeLessThan(1100);
    expect(LARGURA_MAX_FOTO_PDF).toBeGreaterThanOrEqual(600);
  });

  it('foto mais larga que o limite é reduzida em JPEG, na mesma proporção, e é a reduzida que entra no PDF', async () => {
    const reduzida = foto(LARGURA_MAX_FOTO_PDF, Math.round(LARGURA_MAX_FOTO_PDF * 1.5));
    const canvas = simularNavegador(1600, 2400, reduzida);
    const r = await gerar([vista('frente', 'Frente', [m('ombros', 2)], { imagem: foto(1600, 2400) })]);
    expect(canvas.width).toBe(LARGURA_MAX_FOTO_PDF);
    expect(canvas.height).toBe(Math.round(LARGURA_MAX_FOTO_PDF * 1.5));
    expect(canvas.toDataURL.mock.calls[0][0]).toBe('image/jpeg');
    expect(r.figuras).toHaveLength(1);
    expect(r.figuras[0].dados).toBe(reduzida);
  });

  it('foto que já cabe no limite entra como veio, sem passar pelo canvas', async () => {
    const original = foto(LARGURA_MAX_FOTO_PDF, 1000);
    const canvas = simularNavegador(LARGURA_MAX_FOTO_PDF, 1000, foto(10, 10));
    const r = await gerar([vista('frente', 'Frente', [m('ombros', 2)], { imagem: original })]);
    expect(canvas.toDataURL).not.toHaveBeenCalled();
    expect(r.figuras[0].dados).toBe(original);
  });

  it('se o navegador não consegue reduzir, a foto original entra no PDF', async () => {
    const grande = foto(1600, 2400);
    const canvas = simularNavegador(1600, 2400, foto(10, 10), true);
    const r = await gerar([vista('frente', 'Frente', [m('ombros', 2)], { imagem: grande })]);
    expect(canvas.toDataURL).not.toHaveBeenCalled();
    expect(r.figuras[0].dados).toBe(grande);
  });
});

// ---------------------------------------------------------------------------
describe('PDF da sessão: página, margens e sobreposição', () => {
  interface Retangulo { x: number; y: number; w: number; h: number }
  const tocam = (a: Retangulo, b: Retangulo, folga = 0.05) =>
    a.x < b.x + b.w - folga && b.x < a.x + a.w - folga && a.y < b.y + b.h - folga && b.y < a.y + a.h - folga;
  // Caixa aproximada do texto na Helvetica: 70% do corpo acima da linha de base e 20% abaixo.
  const retanguloDoTexto = (e: Escrita): Retangulo => {
    const corpo = e.tam * 0.3528;
    const x = e.alinhamento === 'center' ? e.x - e.larg / 2 : e.alinhamento === 'right' ? e.x - e.larg : e.x;
    return { x, y: e.y - corpo * 0.7, w: e.larg, h: corpo * 0.9 };
  };

  // Medidas compridas, com sentido, para obrigar quebra de linha em várias células.
  const cheio = (): VistaDoRelatorioSessao[] => {
    const longa = Array.from({ length: 14 }, (_, i) => m(`livre-${i}`, 3 + i, { texto: `Ângulo livre número ${i}: ${3 + i},0° entre os três pontos marcados na foto, com o lado do desvio descrito por extenso.` }));
    return [
      vista('frente', 'Frente', [...FRENTE_COM_MEMBROS, ...longa], { imagem: foto(600, 800), metodo: 'automatica_conferida', pontos: pontos(['ombros', 'braco-d'], ['ombros'], ['carregamento-d', 'carregamento-e', 'punho-d', 'punho-e']), notaNivel: 'foto nivelada em 2,3° (correção aplicada nos pontos e nas retas), conforme o sensor do celular na hora da captura.', anterior: { data: '01/09/2026', medidas: [m('ombros', 3.4, { texto: 'Linha dos ombros: 3,4°, lado esquerdo mais alto.' }), m('braco-d', 8, { sentido: 'cotovelo afastado do tronco' })] } }),
      vista('perfil_d', 'Perfil direito', [...PERFIL_D, ...longa.slice(0, 3)], { imagem: foto(600, 800), metodo: 'automatica_conferida' }),
      vista('perfil_e', 'Perfil esquerdo', PERFIL_E, { imagem: foto(800, 450) }),
      vista('costas', 'Costas', [...COSTAS, ...longa.slice(0, 8)], { imagem: foto(600, 800), anterior: { data: '01/09/2026', medidas: COSTAS } }),
    ];
  };

  const cenarios: [string, () => VistaDoRelatorioSessao[]][] = [
    ['4 posições com foto', () => quatroPosicoes()],
    ['4 posições com muitas medidas, notas longas, retrato e paisagem', cheio],
    ['4 posições sem foto', () => quatroPosicoes().map((v) => ({ ...v, imagem: null }))],
    ['1 posição com foto', () => [quatroPosicoes()[0]]],
    ['4 posições com avisos longos em cada uma', () => quatroPosicoes().map((v) => ({
      ...v,
      anterior: { data: '', medidas: v.medidas.map((x) => ({ ...x, graus: x.graus + 1 })) },
      avisos: [`${v.vistaNome}: nesta avaliação a foto foi nivelada (correção de 1,8°); na anterior não consta correção de nível. Os ângulos podem não ser comparáveis.`, `${v.vistaNome}: segundo aviso de comparação, escrito para ocupar mais de uma linha da página e testar a quebra do texto corrido sob a tabela da posição.`],
    }))],
  ];

  it.each(cenarios)('%s: o conteúdo termina antes do rodapé, nada se sobrepõe e as fotos ficam dentro da página', async (_nome, dados) => {
    const r = await gerar(dados());
    const rodape = r.escritas.filter((e) => e.y > 271);
    const conteudo = r.escritas.filter((e) => e.y <= 271);

    // O rodapé só tem a frase de ressalvas e a numeração.
    expect(rodape.length).toBeGreaterThanOrEqual(r.paginas * 2);
    for (const e of conteudo) expect(e.y).toBeLessThanOrEqual(268);
    for (const f of r.figuras) expect(f.y + f.h).toBeLessThanOrEqual(268);
    for (const c of r.caixas.filter((x) => x.estilo === 'FD')) expect(c.y + c.h).toBeLessThanOrEqual(268);

    for (let p = 1; p <= r.paginas; p++) {
      const textos = r.escritas.filter((e) => e.pagina === p).map((e) => ({ e, r: retanguloDoTexto(e) }));
      // Texto contra texto.
      for (let i = 0; i < textos.length; i++) {
        for (let j = i + 1; j < textos.length; j++) {
          if (tocam(textos[i].r, textos[j].r)) throw new Error(`página ${p}: "${textos[i].e.texto}" encosta em "${textos[j].e.texto}"`);
        }
      }
      // Fotos contra fotos e contra texto.
      const fotosDaPagina = r.figuras.filter((f) => f.pagina === p);
      for (let i = 0; i < fotosDaPagina.length; i++) {
        for (let j = i + 1; j < fotosDaPagina.length; j++) expect(tocam(fotosDaPagina[i], fotosDaPagina[j])).toBe(false);
        for (const t of textos) if (tocam(fotosDaPagina[i], t.r)) throw new Error(`página ${p}: foto encosta em "${t.e.texto}"`);
      }
      // Caixas brancas (tabelas, caixas de texto, resumo, molduras de foto) contra caixas.
      const brancas = r.caixas.filter((c) => c.pagina === p && c.estilo === 'FD');
      for (let i = 0; i < brancas.length; i++) {
        for (let j = i + 1; j < brancas.length; j++) if (tocam(brancas[i], brancas[j])) throw new Error(`página ${p}: duas caixas se sobrepõem`);
      }
      // Barra e texto do título de seção ficam fora de qualquer caixa.
      const barras = r.caixas.filter((c) => c.pagina === p && c.w === 1.4 && c.h === 5);
      const titulosDaPagina = textos.filter((t) => t.e.tam === 10.5);
      expect(barras).toHaveLength(titulosDaPagina.length);
      for (const alvo of [...barras, ...titulosDaPagina.map((t) => t.r)]) {
        for (const c of brancas) if (tocam(alvo, c, 0.01)) throw new Error(`página ${p}: título dentro de uma caixa`);
      }
    }
  });

  it('o cabeçalho de continuação só aparece a partir da segunda página e nada além dele fica acima do conteúdo', async () => {
    const r = await gerar(cheio());
    expect(r.paginas).toBeGreaterThan(2);
    const cabecalhos = r.escritas.filter((e) => e.texto.startsWith('Análise angular da sessão - '));
    expect(cabecalhos.map((e) => e.pagina)).toEqual(Array.from({ length: r.paginas - 1 }, (_, i) => i + 2));
    const noAlto = r.escritas.filter((e) => e.pagina > 1 && e.y < 16);
    expect(noAlto).toHaveLength(r.paginas - 1);
  });

  it('as caixas "Leitura" e "Como foi medido" não são partidas entre duas páginas quando cabem numa, qualquer que seja o ponto em que cairiam', async () => {
    // Cada linha extra de tabela empurra a caixa 6,4 mm: de 30 a 46 linhas ela passa por todas as alturas possíveis do fim da segunda página.
    for (let k = 30; k <= 46; k++) {
      const sem = Array.from({ length: k }, (_, i) => m(`livre-${i}`, 5 + i));
      const com = [1, 2, 3, 4].map((i) => m(`reta-${i}`, i, { texto: `Reta ${i}: ${i},0° com a vertical, lado direito mais alto.` }));
      const r = await gerar([vista('frente', 'Frente', [...sem, ...com], { imagem: foto(600, 800) })]);
      const paginasDaLeitura = new Set(r.escritas.filter((e) => e.tam === 8.6).map((e) => e.pagina));
      expect(paginasDaLeitura.size, `${k} linhas de tabela`).toBe(1);
      expect(r.escritas.filter((e) => e.tam === 8.6)).toHaveLength(4);
      // O mesmo vale para a caixa "Como foi medido": título, método e correção de nível na mesma página.
      const tituloMetodo = r.escritas.find((e) => e.tam === 10.5 && e.texto === 'Como foi medido');
      const linhasMetodo = r.escritas.filter((e) => e.tam === 8.2);
      expect(linhasMetodo.length, `${k} linhas de tabela`).toBeGreaterThanOrEqual(2);
      expect(new Set([tituloMetodo?.pagina, ...linhasMetodo.map((e) => e.pagina)]).size, `${k} linhas de tabela`).toBe(1);
    }
  });

  it('cada posição abre com seu título uma vez só, mesmo com várias páginas', async () => {
    const r = await gerar(cheio());
    for (const nome of ['Frente', 'Perfil direito', 'Perfil esquerdo', 'Costas']) expect(titulos(r).filter((t) => t === nome)).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
describe('cabeçalho com nome comprido do paciente e do profissional', () => {
  const NOME_82 = 'MARIA APARECIDA DOS SANTOS OLIVEIRA DE ALMEIDA PEREIRA LIMA ALBUQUERQUE CAVALCANTI';
  const NOME_160 = `${NOME_82} ${NOME_82.replace('MARIA', 'ANA')}`;
  const PROFISSIONAL_LONGO = 'Dr. Rafael Augusto Cavalcanti de Albuquerque Montenegro Pereira da Silva Santos Oliveira · CREFITO 123456-F';
  const BORDA_DIREITA = 210 - 14;
  const unica = [vista('frente', 'Frente', [m('ombros', 2)])];

  interface Retangulo { x: number; y: number; w: number; h: number }
  // Alinhado à direita (numeração das páginas) ou ao centro, o x da escrita não é a borda esquerda do texto.
  const esquerdaDoTexto = (e: Escrita) => (e.alinhamento === 'right' ? e.x - e.larg : e.alinhamento === 'center' ? e.x - e.larg / 2 : e.x);
  const direitaDoTexto = (e: Escrita) => esquerdaDoTexto(e) + e.larg;
  const caixaDoTexto = (e: Escrita): Retangulo => ({ x: esquerdaDoTexto(e), y: e.y - e.tam * 0.3528 * 0.7, w: e.larg, h: e.tam * 0.3528 * 0.9 });
  const tocam = (a: Retangulo, b: Retangulo) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const logo = (): Retangulo => {
    const chamada = vi.mocked(addLogoToDoc).mock.calls.at(-1)!;
    return { x: chamada[1], y: chamada[2], w: chamada[3], h: chamada[3] };
  };

  it('nome de 82 caracteres cabe: a fonte diminui, o texto fica inteiro, não passa da margem direita nem encosta na logo', async () => {
    const r = await gerar(unica, { paciente: NOME_82 });
    const nome = r.escritas.find((e) => e.texto === NOME_82)!;
    expect(nome, 'o nome inteiro numa linha só').toBeDefined();
    expect(nome.tam).toBeLessThan(11.5);
    expect(nome.tam).toBeGreaterThanOrEqual(8.5);
    expect(nome.x + nome.larg).toBeLessThanOrEqual(logo().x - 2);
    for (const e of r.escritas.filter((x) => x.pagina === 1)) {
      expect(direitaDoTexto(e), e.texto).toBeLessThanOrEqual(BORDA_DIREITA + 0.01);
      expect(tocam(caixaDoTexto(e), logo()), `"${e.texto}" encosta na logo`).toBe(false);
    }
  });

  it('nome mais comprido ainda: quebra em duas linhas, na fonte mínima, e o resto do cabeçalho desce sem se sobrepor', async () => {
    const r = await gerar(unica, { paciente: NOME_160 });
    const pedacos = r.escritas.filter((e) => e.pagina === 1 && NOME_160.includes(e.texto.replace(/\.\.\.$/, '')) && e.texto.length > 20);
    expect(pedacos).toHaveLength(2);
    expect(pedacos.map((e) => e.texto).join(' ')).toBe(NOME_160);
    for (const p of pedacos) {
      expect(p.tam).toBe(8.5);
      expect(p.x + p.larg).toBeLessThanOrEqual(logo().x - 2);
    }
    const doPagina = r.escritas.filter((e) => e.pagina === 1 && e.y < 80).map((e) => ({ e, c: caixaDoTexto(e) }));
    for (let i = 0; i < doPagina.length; i++) {
      for (let j = i + 1; j < doPagina.length; j++) {
        if (tocam(doPagina[i].c, doPagina[j].c)) throw new Error(`"${doPagina[i].e.texto}" encosta em "${doPagina[j].e.texto}"`);
      }
    }
  });

  it('nome absurdo (sem espaços e de 300 letras): nunca passa da margem, termina em reticências', async () => {
    const r = await gerar(unica, { paciente: 'A'.repeat(300) });
    for (const e of r.escritas.filter((x) => x.pagina === 1)) expect(direitaDoTexto(e), e.texto).toBeLessThanOrEqual(BORDA_DIREITA + 0.01);
    const linhasDoNome = r.escritas.filter((e) => e.pagina === 1 && /^A+(\.\.\.)?$/.test(e.texto));
    expect(linhasDoNome.length).toBeGreaterThanOrEqual(1);
    expect(linhasDoNome[linhasDoNome.length - 1].texto).toMatch(/\.\.\.$/);
    for (const e of linhasDoNome) expect(e.larg, 'cada linha do nome fica nos 160 mm antes da logo').toBeLessThanOrEqual(160.01);
  });

  it('profissional com nome e CREFITO compridos: a linha de baixo encolhe ou quebra, dentro da página e sem tocar na logo', async () => {
    const r = await gerar(unica, { paciente: NOME_82, profissional: PROFISSIONAL_LONGO });
    const subtitulo = r.escritas.filter((e) => e.pagina === 1 && e.tam <= 9 && e.y > 24 && e.y < 45 && /posição feita|Rafael|CREFITO|Santos/.test(e.texto));
    expect(subtitulo.length).toBeGreaterThanOrEqual(1);
    expect(subtitulo.map((e) => e.texto).join(' ')).toContain('CREFITO 123456-F');
    expect(subtitulo.map((e) => e.texto).join(' ')).toContain('05/10/2026');
    for (const e of subtitulo) expect(direitaDoTexto(e), e.texto).toBeLessThanOrEqual(BORDA_DIREITA + 0.01);
    for (const e of r.escritas.filter((x) => x.pagina === 1)) expect(tocam(caixaDoTexto(e), logo()), `"${e.texto}" encosta na logo`).toBe(false);
  });

  it('cabeçalho de continuação (páginas seguintes) também cabe na página e continua numa linha só', async () => {
    const muitas = Array.from({ length: 45 }, (_, i) => m(`livre-${i}`, 10 + i, { texto: `Ângulo livre ${i}: ${10 + i},0°.` }));
    for (const paciente of [NOME_82, NOME_160, 'A'.repeat(300)]) {
      const r = await gerar([vista('frente', 'Frente', muitas)], { paciente });
      expect(r.paginas).toBeGreaterThanOrEqual(2);
      const continuacao = r.escritas.filter((e) => e.pagina > 1 && e.texto.startsWith('Análise angular da sessão - '));
      expect(continuacao).toHaveLength(r.paginas - 1);
      for (const e of continuacao) expect(direitaDoTexto(e), e.texto.slice(0, 40)).toBeLessThanOrEqual(BORDA_DIREITA + 0.01);
      expect(r.escritas.filter((e) => e.pagina > 1 && e.y < 16)).toHaveLength(r.paginas - 1);
      expect(continuacao.every((e) => e.texto.endsWith(' - 05/10/2026'))).toBe(true);
    }
  });

  it('o relatório de uma vista usa o mesmo cabeçalho: nome de 82 caracteres não passa da margem nem toca na logo', async () => {
    escritas.length = 0;
    await gerarRelatorioAngular({ paciente: NOME_82, profissional: PROFISSIONAL_LONGO, data: '05/10/2026', vistaNome: 'frente', metodo: 'marcacao_manual', medidas: [m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' })] });
    const cabecalho = escritas.filter((e) => e.y < 45);
    expect(cabecalho.length).toBeGreaterThanOrEqual(3);
    for (const e of cabecalho) {
      expect(direitaDoTexto(e), e.texto).toBeLessThanOrEqual(BORDA_DIREITA + 0.01);
      expect(tocam(caixaDoTexto(e), logo()), `"${e.texto}" encosta na logo`).toBe(false);
    }
    expect(escritas.find((e) => e.texto === NOME_82)?.tam).toBeLessThan(11.5);
  });

  it('nomes curtos continuam como eram: nome em 11,5 pt e a linha do profissional inteira numa linha', async () => {
    const r = await gerar(unica);
    const nome = r.escritas.find((e) => e.texto === 'MARIA DA CONCEICAO')!;
    expect(nome.tam).toBe(11.5);
    expect(r.escritas.some((e) => e.texto === '1 posição feita - 05/10/2026 - Dr. Rafael' && e.tam === 9)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe('relatório de uma vista (gerarRelatorioAngular) depois da refatoração', () => {
  const dados = { paciente: 'Maria da Conceição', data: '05/10/2026', vistaNome: 'frente', medidas: [m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' })] };

  it('método automático diz "sugeridos por detecção automática" e não diz que foram conferidos pelo profissional', async () => {
    escritas.length = 0;
    const r = await gerarRelatorioAngular({ ...dados, metodo: 'automatica_conferida' });
    const texto = escritas.map((e) => e.texto).join(' ');
    expect(texto).toContain('Pontos sugeridos por detecção automática (confirmar na foto).');
    expect(texto).not.toMatch(/conferid/i);
    expect(await lerPdf(r.blob)).not.toMatch(/conferid/i);
  });

  it('a leitura marca com "(estimativa: confirme)" as medidas que pedem conferência, como o relatório da sessão', async () => {
    escritas.length = 0;
    await gerarRelatorioAngular({
      ...dados, metodo: 'automatica_conferida',
      medidas: [m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' }), m('quadris', 1.9, { texto: 'Linha dos quadris: 1,9° com a horizontal, lado direito mais alto.' })],
    });
    const texto = escritas.map((e) => e.texto).join(' ');
    expect(texto).toContain('Linha dos quadris: 1,9° com a horizontal, lado direito mais alto. (estimativa: confirme)');
    expect(texto).toContain('Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.');
    expect(texto).not.toContain('lado direito mais alto. (estimativa: confirme) Linha dos ombros');
    expect(texto.match(/\(estimativa: confirme\)/g)).toHaveLength(1);
  });

  it('os avisos de comparabilidade saem sob a tabela, antes da leitura, sem encostar em nada', async () => {
    const AVISO = 'Frente: na avaliação anterior a foto foi nivelada (correção de 1,8°); nesta não consta correção de nível. Os ângulos podem não ser comparáveis.';
    const dadosComAnterior = { ...dados, metodo: 'marcacao_manual' as const, anterior: { data: '', medidas: [m('ombros', 3.4, { texto: 'lado direito mais alto' })] } };
    escritas.length = 0;
    await gerarRelatorioAngular({ ...dadosComAnterior, avisos: [AVISO, 'Frente: segundo aviso curto.'] });
    expect(escritas.map((e) => e.texto).join(' ')).toContain(AVISO);
    const tabela = escritas.find((e) => e.tam === 8.5 && e.texto === 'Variação')!;
    const primeira = escritas.find((e) => e.texto.startsWith('Data da avaliação anterior'))!;
    const aviso = escritas.find((e) => e.texto.startsWith('Frente: na avaliação anterior'))!;
    const segundo = escritas.find((e) => e.texto === 'Frente: segundo aviso curto.')!;
    const leitura = escritas.find((e) => e.tam === 10.5 && e.texto === 'Leitura')!;
    expect(aviso.y).toBeGreaterThan(primeira.y);
    expect(segundo.y).toBeGreaterThan(aviso.y);
    expect(aviso.y).toBeGreaterThan(tabela.y);
    expect(segundo.y).toBeLessThan(leitura.y - 3.6);
    for (const e of escritas.filter((x) => /^(Frente:|Data da avaliação)/.test(x.texto))) expect(e.x + e.larg, e.texto.slice(0, 30)).toBeLessThanOrEqual(196.01);

    escritas.length = 0;
    await gerarRelatorioAngular({ ...dadosComAnterior, anterior: { data: '01/09/2026', medidas: dadosComAnterior.anterior.medidas } });
    expect(escritas.map((e) => e.texto).join(' ')).not.toContain('podem não ser comparáveis');
  });

  it('avaliação anterior sem data: o cabeçalho fica "Antes" e a nota abaixo da tabela diz que a data não foi informada', async () => {
    escritas.length = 0;
    await gerarRelatorioAngular({ ...dados, metodo: 'marcacao_manual', anterior: { data: '', medidas: [m('ombros', 3.4, { texto: 'lado direito mais alto' })] } });
    const cabecalho = escritas.find((e) => e.tam === 8.5 && e.texto.startsWith('Antes'))!;
    const variacao = escritas.find((e) => e.tam === 8.5 && e.texto === 'Variação')!;
    expect(cabecalho.texto).toBe('Antes');
    expect(cabecalho.x + cabecalho.larg).toBeLessThan(variacao.x);
    const aviso = escritas.find((e) => e.texto === 'Data da avaliação anterior não informada.')!;
    expect(aviso.y).toBeGreaterThan(cabecalho.y);
    escritas.length = 0;
    await gerarRelatorioAngular({ ...dados, metodo: 'marcacao_manual', anterior: { data: '01/09/2026', medidas: [m('ombros', 3.4, { texto: 'lado direito mais alto' })] } });
    expect(escritas.some((e) => e.texto === 'Antes (01/09/2026)')).toBe(true);
    expect(escritas.some((e) => e.texto.includes('Data da avaliação anterior'))).toBe(false);
  });

  it('o método diz quantas medidas vieram do modelo, quantas foram ajustadas e quantas foram marcadas só à mão', async () => {
    escritas.length = 0;
    await gerarRelatorioAngular({ ...dados, metodo: 'automatica_conferida', pontos: pontos(['ombros', 'quadris'], ['ombros'], ['punho-d']) });
    const texto = escritas.map((e) => e.texto).join(' ');
    expect(texto).toContain('Pontos sugeridos por detecção automática (confirmar na foto) em 2 medidas, 1 ajustada à mão; 1 medida marcada só à mão.');
    expect(texto).not.toMatch(/conferid/i);
  });

  it('método manual segue dizendo que foi marcado à mão, e o nome e a página única não mudam', async () => {
    escritas.length = 0;
    const r = await gerarRelatorioAngular({ ...dados, metodo: 'marcacao_manual' });
    expect(escritas.map((e) => e.texto).join(' ')).toContain('Pontos marcados manualmente pelo profissional.');
    expect(r.nome).toBe('Analise_angular_MARIA_DA_CONCEICAO_2026-10-05.pdf');
    expect(paginasDoPdf(await lerPdf(r.blob))).toBe(1);
  });
});
