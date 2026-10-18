import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/pdfLogoHelper', () => ({ addLogoToDoc: vi.fn(async () => {}) }));

interface Escrita { pagina: number; texto: string; x: number; largura: number; alinhado: boolean }
interface Imagem { pagina: number; formato: string }
const escritas: Escrita[] = [];
const imagens: Imagem[] = [];
const links: string[] = [];
interface DocPdf {
  text: (txt: string | string[], x: number, y: number, op?: { align?: string }) => unknown;
  addImage: (...args: unknown[]) => unknown;
  textWithLink: (txt: string, x: number, y: number, op: { url?: string }) => unknown;
  getCurrentPageInfo: () => { pageNumber: number };
  getNumberOfPages: () => number;
  getTextWidth: (txt: string) => number;
}
const docs: DocPdf[] = [];

// Embrulha o jsPDF para anotar cada texto escrito (página, posição e largura), cada imagem e cada link: o conteúdo do PDF não é texto legível no teste.
vi.mock('jspdf', async (importarOriginal) => {
  const original = await importarOriginal<{ default: new (...args: unknown[]) => DocPdf }>();
  const Real = original.default;
  function Embrulhado(this: unknown, ...args: unknown[]) {
    const doc = new Real(...args);
    const text = doc.text.bind(doc);
    doc.text = (txt, x, y, op) => {
      for (const linha of Array.isArray(txt) ? txt : [txt]) {
        escritas.push({ pagina: doc.getCurrentPageInfo().pageNumber, texto: String(linha), x, largura: doc.getTextWidth(String(linha)), alinhado: !!op?.align });
      }
      return text(txt, x, y, op);
    };
    const addImage = doc.addImage.bind(doc);
    doc.addImage = (...a: unknown[]) => { imagens.push({ pagina: doc.getCurrentPageInfo().pageNumber, formato: String(a[1]) }); return addImage(...a); };
    const textWithLink = doc.textWithLink.bind(doc);
    doc.textWithLink = (txt, x, y, op) => { links.push(String(op.url)); return textWithLink(txt, x, y, op); };
    docs.push(doc);
    return doc;
  }
  Object.assign(Embrulhado, Real);
  Embrulhado.prototype = Real.prototype;
  return { ...original, default: Embrulhado };
});

import { analisarMovimento, BIBLIOTECA, montarLaudo, protocoloDo, termoProibido, type LaudoMovimento } from '../lib/angular/movimento';
import { AVISO_HIPOTESES } from '../lib/angular/movimento/frases';
import { gerarPdfLaudo, textoSeguroParaPdf } from '../lib/angular/movimento/laudoPdf';
import { AVISO_ESTIMATIVA_VIDEO } from '../lib/angular/analiseVideo/tiposUi';
import {
  achado, achadosDeTodosOsCaminhos, analiseDeTodosOsCaminhos, analiseFixa, BIBLIOTECA_FIXA, contexto, criterioAtivo, FONTE_CRITERIO, PDF_SEGURO, textos,
} from './movimentoLaudoFixtures';
import { trilhaMarcha } from './movimentoMotorSintetico';

/*
 * PDF do laudo (agente L): Blob não vazio, rodapé fixo em todas as páginas, quebra de linha dentro da margem mesmo com texto longo,
 * links, acentos corretos (conferidos com pdftotext quando disponível) e nenhuma imagem do paciente.
 */

const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const MARGEM_DIREITA = 210 - 14;
const LATIN1 = new RegExp('^[\\x20-\\x7E\\u00A0-\\u00FF]*$');

const temPdftotext = ((): boolean => {
  try {
    return spawnSync('pdftotext', ['-v']).status === 0;
  } catch {
    // sem o binário no ambiente: os testes que dependem dele são pulados
    return false;
  }
})();

const lerBlob = (blob: Blob): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(Buffer.from(leitor.result as ArrayBuffer));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsArrayBuffer(blob);
  });

let pasta = '';
const getContextOriginal = HTMLCanvasElement.prototype.getContext;
beforeAll(() => {
  pasta = mkdtempSync(join(tmpdir(), 'laudo-pdf-'));
  // O jsdom não implementa canvas e reclama a cada chamada: sem contexto, o gráfico simplesmente fica de fora do PDF.
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof getContextOriginal;
});
afterAll(() => {
  rmSync(pasta, { recursive: true, force: true });
  HTMLCanvasElement.prototype.getContext = getContextOriginal;
});

/** Texto do PDF na ordem de leitura, uma entrada por página. */
async function textoDoPdf(blob: Blob): Promise<string[]> {
  const arquivo = join(pasta, `l-${Math.random().toString(36).slice(2)}.pdf`);
  writeFileSync(arquivo, await lerBlob(blob));
  const r = spawnSync('pdftotext', ['-enc', 'UTF-8', arquivo, '-'], { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
  expect(r.status).toBe(0);
  return r.stdout.split('\f').filter((p, i, a) => i < a.length - 1 || p.trim().length > 0);
}

beforeEach(() => { escritas.length = 0; imagens.length = 0; links.length = 0; docs.length = 0; });

function laudoLongo(): LaudoMovimento {
  const analise = analiseDeTodosOsCaminhos('agachamento_lateral');
  return montarLaudo(analise, contexto({ criterios: [criterioAtivo({ fonte: FONTE_CRITERIO })], paciente: 'Paciente de Teste', profissional: 'Dr. Exemplo' }), BIBLIOTECA_FIXA);
}

describe('PDF do laudo: arquivo e rodapé', () => {
  it('gera um Blob de PDF não vazio', async () => {
    const blob = await gerarPdfLaudo(laudoLongo());
    expect(blob.size).toBeGreaterThan(2000);
    const bytes = await lerBlob(blob);
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('o rodapé fixo "Estimativa por vídeo · não é diagnóstico" está em todas as páginas, uma vez por página', async () => {
    await gerarPdfLaudo(laudoLongo());
    const total = docs[0].getNumberOfPages();
    expect(total).toBeGreaterThanOrEqual(3);
    const paginas = escritas.filter((e) => e.texto === AVISO_ESTIMATIVA_VIDEO).map((e) => e.pagina);
    expect(paginas).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    expect(AVISO_ESTIMATIVA_VIDEO).toBe('Estimativa por vídeo · não é diagnóstico');
    const numeracao = escritas.filter((e) => /^Página \d+ de \d+$/.test(e.texto)).map((e) => e.texto);
    expect(numeracao).toEqual(Array.from({ length: total }, (_, i) => `Página ${i + 1} de ${total}`));
  });

  it.skipIf(!temPdftotext)('pdftotext: o rodapé aparece em todas as páginas do arquivo gerado, com acento e ponto médio corretos', async () => {
    const paginas = await textoDoPdf(await gerarPdfLaudo(laudoLongo()));
    expect(paginas.length).toBeGreaterThanOrEqual(3);
    for (const [i, texto] of paginas.entries()) {
      expect(texto, `página ${i + 1}`).toContain('Estimativa por vídeo · não é diagnóstico');
    }
  });

  it('um laudo mínimo (sem achados, sem referências) também sai com rodapé e uma página', async () => {
    const vazia = analisarMovimento('agachamento_lateral', { fps: 30, largura: 640, altura: 480, quadros: [] });
    const laudo = montarLaudo(vazia, contexto(), BIBLIOTECA);
    const blob = await gerarPdfLaudo(laudo);
    expect(blob.size).toBeGreaterThan(1000);
    expect(docs[0].getNumberOfPages()).toBeGreaterThanOrEqual(1);
    expect(escritas.filter((e) => e.texto === AVISO_ESTIMATIVA_VIDEO)).toHaveLength(docs[0].getNumberOfPages());
  });
});

describe('PDF do laudo: seções, acentos e links', () => {
  it.skipIf(!temPdftotext)('pdftotext: as seções aparecem na ordem do laudo e os textos fixos saem com acentos corretos', async () => {
    const paginas = await textoDoPdf(await gerarPdfLaudo(laudoLongo()));
    const texto = paginas.join('\n').replace(/\s+/g, ' ');
    const ordem = [
      'Laudo de apoio à avaliação do movimento', 'Vídeo:', 'Data da análise:', 'Protocolo:', 'Plano de câmera:', 'Taxa efetiva de quadros:', 'Quadros-chave corrigidos manualmente:',
      'Responsável pela revisão:', 'Estimativa por vídeo · não é diagnóstico.', AVISO_HIPOTESES, 'Resumo', 'Medidas por repetição e por lado', 'Resumo por medida e por lado',
      'Possíveis fatores contribuintes', 'O que conferir na avaliação presencial', 'Achados não avaliados neste vídeo', 'Método', 'Regras que disparam um achado',
      'Critérios do profissional usados', 'Limitações', 'Referências',
    ];
    let ultimo = -1;
    for (const trecho of ordem) {
      const pos = texto.indexOf(trecho, ultimo + 1);
      expect(pos, `"${trecho}" depois de ${ultimo}`).toBeGreaterThan(ultimo);
      ultimo = pos;
    }
    for (const frase of ['Hipóteses para confirmação na avaliação presencial', 'Para avaliar valgo dinâmico', 'Dra. Ana Souza', 'sem referência verificada', 'dentro do critério']) {
      expect(texto, frase).toContain(frase);
    }
    expect(texto).toContain('beta');
  });

  it.skipIf(!temPdftotext)('pdftotext: sem critério usado, o PDF inteiro não traz "dentro do critério", "no limite" nem "fora do critério"', async () => {
    const p = protocoloDo('agachamento_lateral');
    const laudo = montarLaudo(analiseFixa('agachamento_lateral', [achado('inclinacao_tronco', p, { gatilho: 'variacao_entre_repeticoes' })]), contexto(), BIBLIOTECA_FIXA);
    const texto = (await textoDoPdf(await gerarPdfLaudo(laudo))).join('\n').replace(/\s+/g, ' ');
    expect(texto).not.toMatch(/dentro do critério|fora do critério|no limite/i);
    expect(texto).toContain('sem referência');
  });

  it.skipIf(!temPdftotext)('pdftotext: nenhum termo de julgamento em todo o texto do PDF (fora das citações das fontes)', async () => {
    const analise = analisarMovimento('marcha_lateral', trilhaMarcha({ duracao: 16, ruidoPx: 0.5, apoio: { D: 0.66, E: 0.54 } }));
    const laudo = montarLaudo(analise, contexto(), BIBLIOTECA);
    const texto = (await textoDoPdf(await gerarPdfLaudo(laudo))).join('\n');
    const antesDasReferencias = texto.slice(0, texto.lastIndexOf('Referências'));
    expect(termoProibido(antesDasReferencias)).toBeNull();
  });

  it('achado sem hipótese curada imprime "sem referência verificada" no PDF', async () => {
    const p = protocoloDo('agachamento_lateral');
    const laudo = montarLaudo(analiseFixa('agachamento_lateral', [achado('avanco_joelho', p, { gatilho: 'variacao_entre_repeticoes' })]), contexto(), {});
    await gerarPdfLaudo(laudo);
    const frase = escritas.map((e) => e.texto).join(' ');
    expect(frase).toContain('Não há hipóteses curadas para este achado na biblioteca: sem referência verificada.');
  });

  it('critério do profissional aparece no PDF com quem o definiu', async () => {
    await gerarPdfLaudo(laudoLongo());
    const todas = escritas.map((e) => e.texto).join('\n');
    expect(todas).toContain('Dra. Ana Souza');
    expect(todas).toContain('Critérios do profissional usados');
  });

  it('cada fonte vira texto e link: PMID e DOI com o endereço, e a anotação de link dentro do arquivo', async () => {
    const laudo = laudoLongo();
    const blob = await gerarPdfLaudo(laudo);
    const textosDoPdf = escritas.map((e) => e.texto);
    for (const r of laudo.referencias) {
      expect(textosDoPdf).toContain(`PMID ${r.fonte.pmid}:`);
      expect(textosDoPdf).toContain(`https://pubmed.ncbi.nlm.nih.gov/${r.fonte.pmid}/`);
    }
    expect(textosDoPdf).toContain('DOI 10.1000/teste.a:');
    expect(textosDoPdf).toContain('https://doi.org/10.1000/teste.a');
    expect(textosDoPdf).toContain('https://doi.org/10.1000/criterio');
    expect(links).toContain('https://pubmed.ncbi.nlm.nih.gov/11111111/');
    expect(links).toContain('https://doi.org/10.1000/criterio');
    const bruto = (await lerBlob(blob)).toString('latin1');
    expect(bruto).toContain('/URI (https://pubmed.ncbi.nlm.nih.gov/11111111/)');
    expect(bruto).toContain('/URI (https://doi.org/10.1000/teste.a)');
  });

  it('o trecho do resumo vai em inglês, entre aspas, e a população da fonte aparece na lista de referências', async () => {
    await gerarPdfLaudo(laudoLongo());
    const todas = escritas.map((e) => e.texto).join(' ');
    expect(todas).toContain('Trecho do resumo (em inglês): "In this sample, the measured value was associated with the outcome."');
    expect(todas).toContain('População: 20 adultos saudaveis; agachamento bipodal.');
  });

  it('achados do mesmo tipo com hipóteses idênticas são impressos uma vez e os demais remetem ao primeiro', async () => {
    const p = protocoloDo('agachamento_lateral');
    const t = (medida: string, lado: 'D' | 'E') => achado('tendencia_na_serie', p, { gatilho: 'tendencia_primeira_ultima', medida, lado, repeticoes: [0, 3], valor: 4 });
    const biblioteca = { tendencia_na_serie: { chave: 'tendencia_na_serie', titulo: 't', fatores: [{ id: 'x', texto: 'Fadiga pode contribuir para a mudança.', forca: 'a_confirmar' as const, fontes: [], ressalva: 'Sem referência verificada.' }], conferir: [] } };
    const laudo = montarLaudo(analiseFixa('agachamento_lateral', [t('flexao_joelho_max', 'D'), t('flexao_joelho_max', 'E'), t('flexao_quadril_max', 'D')]), contexto(), biblioteca);
    expect(laudo.achados.every((a) => a.hipoteses.length === 1)).toBe(true);
    await gerarPdfLaudo(laudo);
    const todas = escritas.map((e) => e.texto);
    expect(todas.filter((x) => x === 'Fadiga pode contribuir para a mudança.')).toHaveLength(1);
    expect(todas.filter((x) => x.startsWith('Hipóteses, itens a conferir e limitações: os mesmos do achado 1.'))).toHaveLength(2);
  });
});

describe('PDF do laudo: quebra de linha e páginas', () => {
  const longo = 'Texto longo de teste com várias palavras acentuadas, números como 12,5° e símbolos ≥ ≤ − → para conferir a quebra de linha. '.repeat(40);

  function laudoComTextoLongo(): LaudoMovimento {
    const base = laudoLongo();
    return {
      ...base,
      resumo: { ...base.resumo, paragrafos: [...base.resumo.paragrafos, longo, `Palavra${'Muito'.repeat(60)}Longa sem espaço`] },
      achados: base.achados.map((a, i) => (i === 0 ? { ...a, descricao: longo, medida: `${a.medida} ${'x'.repeat(240)}` } : a)),
      metodo: {
        ...base.metodo,
        tabelas: [
          ...base.metodo.tabelas,
          { titulo: 'Tabela com célula muito longa', colunas: ['Curta', 'Longa'], linhas: [['a', longo.repeat(3)], ['b', 'curta']], legenda: longo },
        ],
      },
    };
  }

  it('nenhuma linha de texto passa da margem direita, mesmo com parágrafo, palavra e célula de tabela muito longos', async () => {
    await gerarPdfLaudo(laudoComTextoLongo());
    expect(docs[0].getNumberOfPages()).toBeGreaterThan(4);
    const passou = escritas.filter((e) => !e.alinhado && e.x + e.largura > MARGEM_DIREITA + 0.6);
    expect(passou.map((e) => `${e.pagina}: ${e.texto.slice(0, 60)} (${(e.x + e.largura).toFixed(1)})`)).toEqual([]);
    expect(escritas.some((e) => e.texto.includes('Palavra'))).toBe(true);
  });

  it('nenhuma linha começa à esquerda da margem', async () => {
    await gerarPdfLaudo(laudoComTextoLongo());
    expect(escritas.filter((e) => !e.alinhado && e.x < 14 - 0.01).map((e) => e.texto)).toEqual([]);
  });

  it.skipIf(!temPdftotext)('pdftotext: o texto longo continua inteiro no fim da célula, sem perda entre páginas', async () => {
    const base = laudoLongo();
    const marcador = 'FIMDACELULA';
    const laudo: LaudoMovimento = {
      ...base,
      metodo: {
        ...base.metodo,
        tabelas: [{ titulo: 'Célula mais alta que uma página', colunas: ['Item', 'Texto'], linhas: [['1', `${'palavra comum de enchimento '.repeat(900)}${marcador}`]] }],
      },
    };
    const paginas = await textoDoPdf(await gerarPdfLaudo(laudo));
    const texto = paginas.join('\n');
    expect(texto).toContain(marcador);
    expect(paginas.length).toBeGreaterThan(4);
    for (const [i, p] of paginas.entries()) expect(p, `página ${i + 1}`).toContain('Estimativa por vídeo · não é diagnóstico');
  });
});

describe('PDF do laudo: sem imagem do paciente', () => {
  it('sem gráficos, o PDF não insere nenhuma imagem', async () => {
    await gerarPdfLaudo(laudoLongo());
    expect(imagens).toEqual([]);
  });

  it('com gráficos, as únicas imagens são os gráficos ângulo × tempo (PNG), nunca um quadro do vídeo', async () => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    const toDataURL = HTMLCanvasElement.prototype.toDataURL;
    const caminho = (globalThis as { Path2D?: unknown }).Path2D;
    const ctx = new Proxy({}, { get: () => () => undefined, set: () => true });
    HTMLCanvasElement.prototype.getContext = (() => ctx) as unknown as typeof getContext;
    HTMLCanvasElement.prototype.toDataURL = () => PNG_1X1;
    (globalThis as { Path2D?: unknown }).Path2D = class {};
    try {
      const laudo = laudoLongo();
      expect(laudo.graficos.length).toBeGreaterThan(0);
      await gerarPdfLaudo(laudo);
      expect(imagens).toHaveLength(laudo.graficos.length);
      expect(imagens.every((i) => i.formato === 'PNG')).toBe(true);
      expect(escritas.map((e) => e.texto)).toContain('Gráficos: ângulo ao longo do tempo');
    } finally {
      HTMLCanvasElement.prototype.getContext = getContext;
      HTMLCanvasElement.prototype.toDataURL = toDataURL;
      (globalThis as { Path2D?: unknown }).Path2D = caminho;
    }
  });

  it('o laudo não tem campo de imagem: só texto, tabelas e dados dos gráficos', () => {
    const laudo = laudoLongo();
    const chaves = new Set<string>();
    const varrer = (o: unknown) => {
      if (Array.isArray(o)) o.forEach(varrer);
      else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { chaves.add(k); varrer(v); }
    };
    varrer(laudo);
    for (const k of chaves) expect(k.toLowerCase()).not.toMatch(/imagem|foto|frame|quadro(?!s)|jpeg|dataurl|blob/);
    for (const t of textos(laudo, new Set(['referencias', 'achado']))) expect(t.startsWith('data:image')).toBe(false);
  });
});

describe('PDF do laudo: texto seguro para a fonte do PDF', () => {
  it('troca os símbolos que a Helvetica não imprime e preserva acentos, grau e ponto médio', () => {
    expect(textoSeguroParaPdf('≥ 5° e ≤ 7° → −3,2 · “texto” ‘x’ — –')).toBe('>= 5° e <= 7° -> -3,2 · "texto" \'x\' - -');
    expect(textoSeguroParaPdf('ação, avaliação, Hipóteses, ÂÊÔ ç ± × ÷')).toBe('ação, avaliação, Hipóteses, ÂÊÔ ç ± × ÷');
    expect(textoSeguroParaPdf('linha1\nlinha2\t3')).toBe('linha1 linha2 3');
    expect(textoSeguroParaPdf('Ő ő ✓')).toBe('O o ?');
  });

  it('todo texto do laudo, depois da conversão, cabe no conjunto que o PDF imprime', () => {
    const laudo = laudoLongo();
    for (const t of textos(laudo, new Set(['achado']))) {
      expect(LATIN1.test(textoSeguroParaPdf(t)), t).toBe(true);
    }
    expect(PDF_SEGURO.test(AVISO_ESTIMATIVA_VIDEO)).toBe(true);
  });

  it('a lista de achados de todos os caminhos do laudo gera PDF sem erro em todos os protocolos', async () => {
    for (const id of ['agachamento_lateral', 'agachamento_frontal', 'marcha_lateral'] as const) {
      const analise = analiseFixa(id, achadosDeTodosOsCaminhos(id));
      const blob = await gerarPdfLaudo(montarLaudo(analise, contexto({ criterios: [criterioAtivo()] }), BIBLIOTECA));
      expect(blob.size).toBeGreaterThan(2000);
    }
  });

  it.skipIf(!temPdftotext)('o arquivo gerado é legível: pdftotext extrai o texto e o PDF tem o número de páginas esperado', async () => {
    const blob = await gerarPdfLaudo(laudoLongo());
    const arquivo = join(pasta, 'conferencia.pdf');
    writeFileSync(arquivo, await lerBlob(blob));
    const info = spawnSync('pdfinfo', [arquivo], { encoding: 'utf-8' });
    if (info.status === 0) {
      const paginas = /Pages:\s+(\d+)/.exec(info.stdout);
      expect(Number(paginas?.[1])).toBe(docs[0].getNumberOfPages());
    }
    expect(readFileSync(arquivo).length).toBeGreaterThan(2000);
  });
});
