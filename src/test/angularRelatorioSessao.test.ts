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
  vista('frente', 'Frente', FRENTE_COM_MEMBROS, { imagem: foto(largura, altura), metodo: 'automatica_conferida', pontosAjustados: 3, notaNivel: 'foto nivelada em 1,8° (correção aplicada).' }),
  vista('perfil_d', 'Perfil direito', PERFIL_D, { imagem: foto(largura, altura), metodo: 'automatica_conferida', pontosAjustados: 0 }),
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

  it('método automático nunca diz que o profissional conferiu os pontos e conta as medidas ajustadas', () => {
    const sem = fraseDoMetodo('automatica_conferida');
    expect(sem).toContain('sugeridos por detecção automática');
    expect(sem).toContain('o modelo marca o centro da articulação, não o ponto ósseo');
    expect(sem).toContain('Confirmar os pontos na foto');
    expect(sem).not.toMatch(/conferid/i);
    expect(sem).not.toContain('ajustada');
    expect(fraseDoMetodo('automatica_conferida', 0)).toContain('nenhuma medida ajustada à mão');
    expect(fraseDoMetodo('automatica_conferida', 1)).toContain('1 medida ajustada à mão');
    expect(fraseDoMetodo('automatica_conferida', 3)).toContain('3 medidas ajustadas à mão');
    expect(fraseDoMetodo('automatica_conferida', 2.6)).toContain('3 medidas ajustadas à mão');
    expect(fraseDoMetodo('automatica_conferida', -4)).toContain('nenhuma medida ajustada à mão');
    expect(fraseDoMetodo('automatica_conferida', Number.NaN)).toBe(sem);
  });

  it('método manual diz que foi marcado à mão e não fala em detecção', () => {
    expect(fraseDoMetodo('marcacao_manual', 5)).toBe('Pontos marcados manualmente pelo profissional.');
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
    expect(frente).toContain('Método: Pontos sugeridos por detecção automática de pose');
    expect(frente).toContain('3 medidas ajustadas à mão');
    expect(frente).toContain('Correção de nível: foto nivelada em 1,8° (correção aplicada).');
    const perfilD = bloco('Perfil direito', 'Perfil esquerdo');
    expect(perfilD).toContain('nenhuma medida ajustada à mão');
    expect(perfilD).toContain(`Correção de nível: ${FRASE_NIVEL_AUSENTE}`);
    expect(perfilD).not.toContain('foto nivelada');
    const perfilE = bloco('Perfil esquerdo', 'Costas');
    expect(perfilE).toContain('Pontos sugeridos por detecção automática');
    expect(perfilE).not.toContain('ajustada');
    const costas = bloco('Costas', 'Membros superiores');
    expect(costas).toContain('Método: Pontos marcados manualmente pelo profissional.');
    expect(costas).not.toContain('detecção automática');
  });

  it('membros superiores: Direito, Esquerdo e a diferença D - E de cada plano, com a ressalva de ângulo projetado', async () => {
    const r = await gerar(quatroPosicoes());
    const i = r.escritas.findIndex((e) => e.tam === 10.5 && e.texto === 'Membros superiores');
    const secao = r.escritas.slice(i).map((e) => e.texto).join(' ');
    for (const esperado of ['Direito', 'Esquerdo', 'Diferença (D - E)', '+3,1°', '+2,2°', '-0,8°', '+1,7°', '+2,4°', 'sentidos diferentes', 'Frente', 'Costas']) expect(secao).toContain(esperado);
    // Valgo (11,5°) e varo (8,0°) são lados opostos: nada de 3,5.
    expect(secao).not.toMatch(/[+-]3,5/);
    expect(secao).toContain('Ângulos projetados no plano da foto; estimativa a confirmar');
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
      vista('frente', 'Frente', [...FRENTE_COM_MEMBROS, ...longa], { imagem: foto(600, 800), metodo: 'automatica_conferida', pontosAjustados: 4, notaNivel: 'foto nivelada em 2,3° (correção aplicada nos pontos e nas retas), conforme o sensor do celular na hora da captura.', anterior: { data: '01/09/2026', medidas: [m('ombros', 3.4, { texto: 'Linha dos ombros: 3,4°, lado esquerdo mais alto.' }), m('braco-d', 8, { sentido: 'cotovelo afastado do tronco' })] } }),
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
describe('relatório de uma vista (gerarRelatorioAngular) depois da refatoração', () => {
  const dados = { paciente: 'Maria da Conceição', data: '05/10/2026', vistaNome: 'frente', medidas: [m('ombros', 2.1, { texto: 'Linha dos ombros: 2,1° com a horizontal, lado direito mais alto.' })] };

  it('método automático diz "sugeridos por detecção automática" e não diz que foram conferidos pelo profissional', async () => {
    escritas.length = 0;
    const r = await gerarRelatorioAngular({ ...dados, metodo: 'automatica_conferida' });
    const texto = escritas.map((e) => e.texto).join(' ');
    expect(texto).toContain('Pontos sugeridos por detecção automática de pose.');
    expect(texto).not.toMatch(/conferid/i);
    expect(await lerPdf(r.blob)).not.toMatch(/conferid/i);
  });

  it('método manual segue dizendo que foi marcado à mão, e o nome e a página única não mudam', async () => {
    escritas.length = 0;
    const r = await gerarRelatorioAngular({ ...dados, metodo: 'marcacao_manual' });
    expect(escritas.map((e) => e.texto).join(' ')).toContain('Pontos marcados manualmente pelo profissional.');
    expect(r.nome).toBe('Analise_angular_MARIA_DA_CONCEICAO_2026-10-05.pdf');
    expect(paginasDoPdf(await lerPdf(r.blob))).toBe(1);
  });
});
