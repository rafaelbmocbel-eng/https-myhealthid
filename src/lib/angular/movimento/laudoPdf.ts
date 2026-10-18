import type jsPDF from 'jspdf';
import { canvasDoGrafico } from '../analiseVideo/graficoCanvas';
import { COR_LADO } from '../analiseVideo/tiposUi';
import { molduraEmTodasPaginas } from '../../pdf/moldura';
import {
  identificadoresDaFonte, ROTULO_AVISO, TEXTO_SEM_BIBLIOTECA, TEXTO_SEM_ACHADOS, TEXTO_SEM_REFERENCIA_VERIFICADA, textoDaFonte, textoDoTrecho,
  textoPopulacao, textoQualidade, TITULOS,
} from './frases';
import type { AchadoLaudo, LaudoMovimento, SecaoLaudo, TabelaLaudo } from './tipos';

/*
 * PDF do laudo (agente L): só desenha o `LaudoMovimento` já montado, no padrão de ../relatorioVideo.ts (jsPDF, A4, moldura, rodapé
 * fixo em todas as páginas). Nenhuma regra de conteúdo aqui e nenhuma imagem do paciente: só texto, tabelas e gráficos ângulo × tempo.
 * jsPDF e o auxiliar da logo entram por import dinâmico, para não irem ao pacote principal mesmo quando index.ts reexporta este módulo.
 */

type Cor = [number, number, number];

const AZUL: Cor = [30, 58, 95];
const CAB: Cor = [230, 237, 245];
const BORDA: Cor = [208, 214, 222];
const DOURADO: Cor = [234, 170, 20];
const CINZA: Cor = [90, 96, 108];
const TEXTO: Cor = [20, 20, 20];
const LINK: Cor = [29, 78, 216];

const W = 210, M = 14, LARG = W - 2 * M, TOPO = 18, BASE = 281, Y_RODAPE = 288.6;
const PAD = 1.3;

export interface OpcoesPdfLaudo {
  /** Logo do profissional ou da clínica no canto do cabeçalho; sem ela vale a logo padrão do app. */
  logoUrl?: string;
}

/**
 * Troca o que a Helvetica do PDF não imprime (≥ ≤ − → e aspas curvas) por equivalentes. O ponto médio, o grau e o sinal de mais
 * ou menos existem na fonte e ficam como vieram. O que sobrar fora de Latin-1 perde o acento ou vira "?".
 */
export const textoSeguroParaPdf = (s: string): string =>
  String(s)
    .replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/–/g, '-').replace(/—/g, '-').replace(/→/g, '->')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, (c) => {
      const base = c.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return /^[\x20-\x7E\u00A0-\u00FF]$/.test(base) ? base : '?';
    });

export async function gerarPdfLaudo(laudo: LaudoMovimento, opcoes: OpcoesPdfLaudo = {}): Promise<Blob> {
  const [{ default: JsPdf }, { addLogoToDoc }] = await Promise.all([import('jspdf'), import('@/utils/pdfLogoHelper')]);
  const doc: jsPDF = new JsPdf({ unit: 'mm', format: 'a4' });
  let y = TOPO;

  const seguro = textoSeguroParaPdf;
  const t = (txt: string, x: number, yy: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, yy, op);
  const novaPagina = () => { doc.addPage(); y = TOPO; };
  const garantir = (h: number) => { if (y + h > BASE) novaPagina(); };
  const altLinha = (tam: number) => tam * 0.45;

  /** Quebra o texto na largura dada; palavra maior que a largura (endereço, termo longo) é partida por caracteres. */
  const quebrar = (texto: string, largura: number): string[] => {
    const base = doc.splitTextToSize(seguro(texto), largura) as string[];
    const saida: string[] = [];
    for (const linha of base) {
      if (doc.getTextWidth(linha) <= largura + 0.01) { saida.push(linha); continue; }
      let atual = '';
      for (const ch of linha) {
        if (atual && doc.getTextWidth(atual + ch) > largura) { saida.push(atual); atual = ch; } else atual += ch;
      }
      if (atual) saida.push(atual);
    }
    return saida.length ? saida : [''];
  };

  interface OpEscrita { x?: number; largura?: number; tam?: number; estilo?: 'normal' | 'bold' | 'italic'; cor?: Cor; folga?: number; marcador?: string }

  /** Escreve um texto com quebra de linha e de página linha a linha; devolve nada, só avança `y`. */
  const escrever = (txt: string, o: OpEscrita = {}) => {
    const tam = o.tam ?? 9, x = o.x ?? M, recuo = o.marcador ? 3.6 : 0, largura = (o.largura ?? W - M - x) - recuo;
    doc.setFont('helvetica', o.estilo ?? 'normal'); doc.setFontSize(tam); doc.setTextColor(...(o.cor ?? TEXTO));
    const lh = altLinha(tam);
    quebrar(txt, largura).forEach((linha, i) => {
      garantir(lh + 0.4);
      if (i === 0 && o.marcador) t(o.marcador, x, y + lh * 0.78);
      t(linha, x + recuo, y + lh * 0.78);
      y += lh;
    });
    y += o.folga ?? 0.8;
  };

  /** "Rótulo: valor" com recuo pendente: o valor quebra alinhado, à direita do rótulo. Valor vazio deixa uma linha para preencher à mão. */
  const escreverRotulo = (rotulo: string, valor: string, o: { x?: number; colunaRotulo: number; tam?: number; largura?: number }) => {
    const tam = o.tam ?? 9, x = o.x ?? M, lh = altLinha(tam), largura = (o.largura ?? W - M - x) - o.colunaRotulo;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(tam);
    const rot = quebrar(`${rotulo}:`, o.colunaRotulo - 2);
    doc.setFont('helvetica', 'normal');
    const preenchido = valor.trim().length > 0;
    const linhas = preenchido ? quebrar(valor, largura) : [''];
    const total = Math.max(linhas.length, rot.length);
    garantir(total * lh + 0.4);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...AZUL);
    rot.forEach((l, i) => t(l, x, y + lh * 0.78 + i * lh));
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...TEXTO);
    if (preenchido) linhas.forEach((l, i) => t(l, x + o.colunaRotulo, y + lh * 0.78 + i * lh));
    else {
      doc.setDrawColor(...CINZA); doc.setLineWidth(0.2);
      doc.line(x + o.colunaRotulo, y + lh * 0.9, x + o.colunaRotulo + 80, y + lh * 0.9);
    }
    y += total * lh + 0.8;
  };

  const titulo = (txt: string) => {
    garantir(16);
    doc.setFillColor(...AZUL); doc.roundedRect(M, y - 0.2, 1.4, 5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL);
    const linhas = quebrar(txt, LARG - 4);
    linhas.forEach((l, i) => { t(l, M + 4, y + 3.6 + i * 4.6); });
    y += 6.4 + (linhas.length - 1) * 4.6;
    doc.setTextColor(...TEXTO);
  };

  const subtitulo = (txt: string) => {
    garantir(12);
    escrever(txt, { tam: 9, estilo: 'bold', cor: AZUL, folga: 1.2 });
  };

  // ---------- tabelas ----------

  const tabela = (tab: TabelaLaudo) => {
    const tam = 8, lh = altLinha(tam);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(tam);
    const medir = (txt: string, negrito: boolean): number => {
      doc.setFont('helvetica', negrito ? 'bold' : 'normal'); doc.setFontSize(tam);
      return doc.getTextWidth(seguro(txt));
    };
    // Largura mínima = a maior palavra da coluna (nenhuma palavra é partida sem necessidade); ideal = a maior célula em uma linha só.
    const minimos: number[] = [], ideais: number[] = [];
    tab.colunas.forEach((c, j) => {
      let menor = Math.max(...seguro(c).split(' ').map((p) => medir(p, true)));
      let ideal = medir(c, true);
      for (const linha of tab.linhas) {
        const txt = linha[j] ?? '';
        for (const palavra of seguro(txt).split(' ')) menor = Math.max(menor, medir(palavra, false));
        ideal = Math.max(ideal, medir(txt, false));
      }
      minimos.push(menor + 2 * PAD + 0.8);
      ideais.push(Math.max(ideal + 2 * PAD + 0.8, minimos[j]));
    });
    const somaMin = minimos.reduce((a, b) => a + b, 0), somaIdeal = ideais.reduce((a, b) => a + b, 0);
    // Tabela estreita (poucas colunas curtas) não precisa ocupar a página toda: cresce até 1,5 vez o ideal, no mínimo 90 mm.
    const alvo = Math.min(LARG, Math.max(somaIdeal * 1.5, 90));
    let larg: number[];
    if (somaIdeal <= alvo) larg = ideais.map((w) => w + ((alvo - somaIdeal) * w) / somaIdeal);
    else if (somaMin >= LARG) larg = minimos.map((w) => (w * LARG) / somaMin);
    else larg = ideais.map((w, j) => w - ((somaIdeal - LARG) * (w - minimos[j])) / (somaIdeal - somaMin));
    const larguraTabela = larg.reduce((a, b) => a + b, 0);
    const xs = larg.map((_, j) => M + larg.slice(0, j).reduce((s, l) => s + l, 0));
    const celulasDe = (linha: string[]) => larg.map((l, j) => quebrar(linha[j] ?? '', l - 2 * PAD));

    const desenharCabecalho = () => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(tam);
      const cel = celulasDe(tab.colunas);
      const h = Math.max(...cel.map((c) => c.length)) * lh + 2 * PAD;
      garantir(h + lh * 2);
      doc.setFillColor(...CAB); doc.rect(M, y, larguraTabela, h, 'F');
      doc.setTextColor(...AZUL);
      cel.forEach((c, j) => c.forEach((l, i) => t(l, xs[j] + PAD, y + PAD + lh * 0.78 + i * lh)));
      doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M, y + h, M + larguraTabela, y + h);
      y += h;
      doc.setTextColor(...TEXTO);
    };

    // Tabela que cabe numa página inteira não é partida: vai toda para a página seguinte se não couber no que resta.
    doc.setFont('helvetica', 'bold'); doc.setFontSize(tam);
    const alturaCabecalho = Math.max(...celulasDe(tab.colunas).map((c) => c.length)) * lh + 2 * PAD;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(tam);
    const alturaCorpo = tab.linhas.reduce((soma, linha) => soma + Math.max(...celulasDe(linha).map((c) => c.length)) * lh + 2 * PAD, 0);
    const alturaTitulo = tab.titulo ? 7 : 0;
    if (y + alturaTitulo + alturaCabecalho + alturaCorpo > BASE && alturaTitulo + alturaCabecalho + alturaCorpo <= BASE - TOPO - 6) novaPagina();
    if (tab.titulo) subtitulo(tab.titulo);

    desenharCabecalho();
    for (const linha of tab.linhas) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(tam);
      const cel = celulasDe(linha);
      const maxL = Math.max(...cel.map((c) => c.length));
      const alturaTotal = maxL * lh + 2 * PAD;
      // Linha que cabe numa página inteira vai inteira para a página seguinte; só a mais alta que uma página é partida.
      if (y + alturaTotal > BASE && alturaTotal <= BASE - TOPO - 12) { novaPagina(); desenharCabecalho(); doc.setFont('helvetica', 'normal'); doc.setFontSize(tam); }
      let cursor = 0;
      while (cursor < maxL) {
        const capacidade = Math.floor((BASE - y - 2 * PAD) / lh);
        if (capacidade < 1) { novaPagina(); desenharCabecalho(); doc.setFont('helvetica', 'normal'); doc.setFontSize(tam); continue; }
        const k = Math.min(capacidade, maxL - cursor);
        doc.setTextColor(...TEXTO);
        cel.forEach((c, j) => c.slice(cursor, cursor + k).forEach((l, i) => t(l, xs[j] + PAD, y + PAD + lh * 0.78 + i * lh)));
        const h = k * lh + 2 * PAD;
        doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M, y + h, M + larguraTabela, y + h);
        y += h;
        cursor += k;
        if (cursor < maxL) { novaPagina(); desenharCabecalho(); doc.setFont('helvetica', 'normal'); doc.setFontSize(tam); }
      }
    }
    y += 1.5;
    if (tab.legenda) escrever(tab.legenda, { tam: 7.6, cor: CINZA, folga: 2.5 });
    else y += 2.5;
  };

  const secaoDeTexto = (s: SecaoLaudo, tituloExtra?: string) => {
    titulo(tituloExtra ?? s.titulo);
    for (const p of s.paragrafos) escrever(p, { folga: 1.6 });
    for (const item of s.itens) escrever(item, { marcador: '-', folga: 1.2 });
    for (const tab of s.tabelas) tabela(tab);
    y += 2;
  };

  // ---------- cabeçalho ----------

  const avisos = laudo.cabecalho.linhas.filter((l) => l.rotulo === ROTULO_AVISO).map((l) => l.valor);
  const dadosDoCabecalho = laudo.cabecalho.linhas.filter((l) => l.rotulo !== ROTULO_AVISO);

  try {
    // A imagem pode nunca terminar de carregar onde não há navegador de verdade: a logo é opcional e não pode prender o PDF.
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      addLogoToDoc(doc, W - M - 16, 10, 16, opcoes.logoUrl),
      new Promise<void>((resolve) => { temporizador = setTimeout(resolve, 2500); }),
    ]);
    if (temporizador !== undefined) clearTimeout(temporizador);
  } catch {
    // logo é opcional
  }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(...AZUL);
  const larguraTitulo = LARG - 22;
  const linhasTitulo = quebrar(laudo.cabecalho.titulo, larguraTitulo);
  linhasTitulo.forEach((l, i) => t(l, M, y + i * 7));
  const ultimaLinhaTitulo = linhasTitulo[linhasTitulo.length - 1];
  const xEtiqueta = Math.min(M + doc.getTextWidth(seguro(ultimaLinhaTitulo)) + 3, W - M - 28);
  const yEtiqueta = y + (linhasTitulo.length - 1) * 7;
  doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  const larguraEtiqueta = doc.getTextWidth(seguro(laudo.cabecalho.etiqueta)) + 4;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.4); doc.roundedRect(xEtiqueta, yEtiqueta - 4.2, larguraEtiqueta, 5.2, 1.4, 1.4, 'S');
  doc.setTextColor(...DOURADO); t(laudo.cabecalho.etiqueta, xEtiqueta + 2, yEtiqueta - 0.5);
  y += linhasTitulo.length * 7 + 0.5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...CINZA);
  quebrar(laudo.cabecalho.subtitulo, LARG).forEach((l) => { t(l, M, y); y += 4.2; });
  y += 0.5;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.5); doc.line(M, y, M + 28, y);
  doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M + 28, y, W - M, y);
  y += 5;
  for (const l of dadosDoCabecalho) {
    escreverRotulo(l.rotulo, l.valor, { colunaRotulo: 66, tam: 9 });
  }

  // Aviso fixo: caixa à parte, logo abaixo da identificação.
  if (avisos.length) {
    y += 1.5;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
    const linhas = avisos.flatMap((a) => quebrar(a, LARG - 10));
    const alt = linhas.length * altLinha(9) + 5;
    garantir(alt + 2);
    doc.setFillColor(253, 247, 232); doc.setDrawColor(...DOURADO); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, LARG, alt, 2, 2, 'FD');
    doc.setFillColor(...DOURADO); doc.roundedRect(M, y, 1.4, alt, 0.7, 0.7, 'F');
    doc.setTextColor(...TEXTO);
    linhas.forEach((l, i) => t(l, M + 5, y + 4 + i * altLinha(9)));
    y += alt + 5;
  } else {
    y += 3;
  }

  // ---------- resumo e medidas ----------

  secaoDeTexto(laudo.resumo);
  secaoDeTexto(laudo.medidasPorRepeticao);

  // ---------- gráficos ----------

  const imagens = laudo.graficos.map((g) => {
    let png: string | null = null;
    try {
      png = canvasDoGrafico(g.grafico, 360, 190, { escala: 3 })?.toDataURL('image/png') ?? null;
    } catch {
      // sem canvas (ambiente sem navegador): o gráfico fica de fora e o resto do laudo segue
    }
    return { g, png };
  }).filter((x) => x.png);
  if (imagens.length) {
    const wg = (LARG - 4) / 2, hg = (wg * 190) / 360;
    garantir(16 + hg + 10);
    titulo(TITULOS.graficos);
    y += 1.5;
    for (let i = 0; i < imagens.length; i += 2) {
      garantir(hg + 10);
      imagens.slice(i, i + 2).forEach(({ g, png }, k) => {
        const x = M + k * (wg + 4);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(60, 60, 60); t(g.titulo, x, y + 1.5);
        doc.setDrawColor(...BORDA); doc.setLineWidth(0.3); doc.roundedRect(x, y + 3, wg, hg, 2, 2, 'S');
        doc.addImage(png as string, 'PNG', x + 0.4, y + 3.4, wg - 0.8, hg - 0.8, undefined, 'FAST');
      });
      y += hg + 8;
    }
    garantir(8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60, 60, 60);
    doc.setFillColor(COR_LADO.D); doc.circle(M + 1.5, y - 0.8, 1.2, 'F'); t('Direito', M + 4, y);
    doc.setFillColor(COR_LADO.E); doc.circle(M + 24, y - 0.8, 1.2, 'F'); t('Esquerdo', M + 26.5, y);
    const tipos = new Set(laudo.graficos.flatMap((g) => g.grafico.marcadores ?? []).map((m) => m.tipo));
    const marcas = [
      ...(tipos.has('contato') ? ['contato inicial (linha cheia)'] : []),
      ...(tipos.has('saida') ? ['saída do pé (tracejada)'] : []),
      ...(tipos.has('outro') ? ['ponto mais baixo de cada repetição'] : []),
    ];
    t(`Marcas no gráfico: ${marcas.length ? marcas.join(' e ') : 'sem marcas'}.`, M + 50, y);
    y += 5;
    const sinais = [...new Set(laudo.graficos.filter((g) => g.legenda).map((g) => `${g.titulo.replace(/: ângulo ao longo do tempo$/, '')}: ${g.legenda}`))];
    for (const s of sinais) escrever(`Sinal - ${s}`, { tam: 7.6, cor: CINZA, folga: 0.6 });
    y += 4;
  }

  // ---------- achados ----------

  const blocosVistos = new Map<string, number>();

  const desenharAchado = (a: AchadoLaudo, i: number) => {
    garantir(34);
    escrever(`${i + 1}. ${a.titulo}`, { tam: 10, estilo: 'bold', cor: AZUL, folga: 0.6 });
    escrever(`Situação: ${a.situacao}`, { tam: 8.6, estilo: 'bold', cor: CINZA, folga: 0.8 });
    escrever(a.descricao, { folga: 0.8 });
    escrever(a.medida, { tam: 8.4, cor: CINZA, folga: 0.5 });
    escrever(a.incerteza, { tam: 8.4, cor: CINZA, folga: 0.5 });
    escrever(a.repeticoes, { tam: 8.4, cor: CINZA, folga: 1.4 });
    if (a.notaCriterio) escrever(`Nota sobre o critério: ${a.notaCriterio}`, { tam: 8.2, estilo: 'italic', cor: CINZA, folga: 1.4 });

    // Achados do mesmo tipo (por exemplo, a mudança da primeira para a última repetição em várias medidas) repetem hipóteses, itens a
    // conferir e limitações idênticos; o PDF os imprime uma vez e remete ao primeiro, para o laudo não crescer sem necessidade.
    const chaveDoBloco = JSON.stringify([a.hipoteses, a.conferir, a.semBiblioteca, a.limitacoes, a.notaCriterio ?? null]);
    const primeiro = blocosVistos.get(chaveDoBloco);
    if (primeiro !== undefined) {
      escrever(`Hipóteses, itens a conferir e limitações: os mesmos do achado ${primeiro + 1}.`, { tam: 8.6, estilo: 'italic', cor: CINZA, folga: 1.4 });
      y += 1;
      doc.setDrawColor(...BORDA); doc.setLineWidth(0.2); doc.line(M, y, W - M, y);
      y += 4;
      return;
    }
    blocosVistos.set(chaveDoBloco, i);

    if (a.hipoteses.length) {
      escrever(TITULOS.fatores, { tam: 8.8, estilo: 'bold', folga: 0.8 });
      for (const h of a.hipoteses) {
        escrever(h.texto, { marcador: '-', x: M + 2, folga: 0.4 });
        const fontes = h.referencias.length ? `Fontes: ${h.referencias.map((n) => `[${n}]`).join(' ')}` : TEXTO_SEM_REFERENCIA_VERIFICADA;
        escrever(`Tipo de estudo: ${h.forca} · ${fontes}`, { x: M + 5.6, tam: 8.2, estilo: 'bold', cor: CINZA, folga: 0.3 });
        escrever(`Ressalva: ${h.ressalva}`, { x: M + 5.6, tam: 8.2, cor: CINZA, folga: 1.4 });
      }
    } else {
      escrever(TEXTO_SEM_BIBLIOTECA, { tam: 8.8, estilo: 'italic', cor: CINZA, folga: 1.4 });
    }

    if (a.conferir.length) {
      escrever(TITULOS.conferir, { tam: 8.8, estilo: 'bold', folga: 0.8 });
      for (const c of a.conferir) {
        const fonte = c.referencia !== undefined ? ` [${c.referencia}]` : ` (${TEXTO_SEM_REFERENCIA_VERIFICADA})`;
        escrever(`${c.texto}${fonte}`, { marcador: '-', x: M + 2, folga: 0.6 });
      }
      y += 0.8;
    }

    if (a.limitacoes.length) {
      escrever(TITULOS.limitacoesDoAchado, { tam: 8.2, estilo: 'bold', cor: CINZA, folga: 0.6 });
      for (const l of a.limitacoes) escrever(l, { marcador: '-', x: M + 2, tam: 8, cor: CINZA, folga: 0.4 });
    }
    y += 1;
    doc.setDrawColor(...BORDA); doc.setLineWidth(0.2); doc.line(M, y, W - M, y);
    y += 4;
  };

  garantir(16 + 34);
  titulo(TITULOS.achados);
  if (!laudo.achados.length) escrever(TEXTO_SEM_ACHADOS, { folga: 3 });
  laudo.achados.forEach((a, i) => { desenharAchado(a, i); });

  // ---------- indisponíveis, método e limitações ----------

  secaoDeTexto(laudo.indisponiveis);
  secaoDeTexto(laudo.metodo);
  secaoDeTexto(laudo.limitacoes);

  // ---------- referências ----------

  if (laudo.referencias.length) {
    titulo(TITULOS.referencias);
    for (const r of laudo.referencias) {
      garantir(22);
      escrever(`[${r.numero}] ${textoDaFonte(r.fonte)}`, { tam: 8.4, folga: 0.4 });
      for (const id of identificadoresDaFonte(r.fonte)) {
        garantir(4.4);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TEXTO);
        const rotulo = seguro(`${id.rotulo}:`);
        t(rotulo, M + 4, y + 3.2);
        if (id.url) {
          doc.setTextColor(...LINK);
          const x = M + 4 + doc.getTextWidth(rotulo) + 1.6;
          if (x + doc.getTextWidth(id.url) > W - M) { y += 3.9; garantir(4.4); doc.textWithLink(id.url, M + 8, y + 3.2, { url: id.url }); } else doc.textWithLink(id.url, x, y + 3.2, { url: id.url });
        }
        y += 4;
      }
      y += 0.4;
      escrever(textoDoTrecho(r.fonte), { x: M + 4, tam: 8, cor: CINZA, folga: 0.4 });
      const populacao = textoPopulacao(r.fonte);
      if (populacao) escrever(populacao, { x: M + 4, tam: 8, cor: CINZA, folga: 0.4 });
      const qualidade = textoQualidade(r.fonte);
      if (qualidade) escrever(qualidade, { x: M + 4, tam: 8, cor: CINZA, folga: 0.4 });
      y += 1.6;
    }
  }

  // ---------- rodapé e moldura em todas as páginas ----------

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(95, 95, 95);
    // Sem o `seguro`: o ponto médio existe na Helvetica do PDF e a frase fica idêntica à do vídeo e do quadro.
    doc.text(laudo.rodape, 105, Y_RODAPE, { align: 'center' });
    doc.setFontSize(7.4);
    doc.text(`Página ${p} de ${total}`, W - M, Y_RODAPE, { align: 'right' });
  }
  doc.setPage(total);
  molduraEmTodasPaginas(doc);
  return doc.output('blob');
}
