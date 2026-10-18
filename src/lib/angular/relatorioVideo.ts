import jsPDF from 'jspdf';
import '@/lib/pdf/patchJsPdf';
import { molduraEmTodasPaginas } from '@/lib/pdf/moldura';
import { nomeDocumento } from '@/lib/pdf/entrega';
import { addLogoToDoc } from '@/utils/pdfLogoHelper';
import { canvasDoGrafico, type GraficoParaCanvas } from '@/lib/angular/analiseVideo/graficoCanvas';
import { COR_LADO, type CartaoMetricaUi } from '@/lib/angular/analiseVideo/tiposUi';
import { cartaoTemAlerta, naturezaDasReferencias, situacaoDoValor } from '@/lib/angular/analiseVideo/statusReferencia';

const AZUL: [number, number, number] = [30, 58, 95];
const CAB: [number, number, number] = [230, 237, 245];
const BORDA: [number, number, number] = [208, 214, 222];
const DOURADO: [number, number, number] = [234, 170, 20];
const COR_D = COR_LADO.D;
const COR_E = COR_LADO.E;

const seguro = (s: string) => String(s).replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/−/g, '-').replace(/–/g, '-').replace(/—/g, '-').replace(/·/g, '-').replace(/→/g, '>').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");

export interface CapturaRelatorio {
  /** segundos no vídeo */
  t: number;
  quadro: number;
  nome: string;
  valorTexto: string;
  texto: string;
  /** JPEG do quadro com as marcações */
  imagem?: { url: string; w: number; h: number } | null;
}

export interface DadosRelatorioVideo {
  paciente: string;
  profissional?: string;
  logoUrl?: string;
  data: string;
  fps: number;
  capturas: CapturaRelatorio[];
  notaExtra?: string;
}

export async function gerarRelatorioVideo(d: DadosRelatorioVideo): Promise<{ blob: Blob; nome: string }> {
  const paciente = nomeDocumento(d.paciente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, LARG = W - 2 * M;
  const t = (txt: string, x: number, y: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, y, op);
  const novaPagina = () => { doc.addPage(); return 18; };
  const seg = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let y = 18;
  try { await addLogoToDoc(doc, W - M - 16, 10, 16, d.logoUrl); } catch { /* logo é opcional */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...AZUL); t('Análise angular em vídeo', M, y); y += 7;
  doc.setFontSize(11.5); doc.setTextColor(20); t(paciente, M, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  t(`Medidas ponto a ponto · ${d.data}${d.profissional ? ` · ${d.profissional}` : ''}`, M, y); y += 4;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.5); doc.line(M, y, M + 28, y);
  doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M + 28, y, W - M, y); y += 8;
  doc.setTextColor(20);

  const titulo = (txt: string) => {
    doc.setFillColor(...AZUL); doc.roundedRect(M, y - 3.6, 1.4, 5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL); t(txt, M + 4, y); doc.setTextColor(20);
    y += 5;
  };

  // Tabela de medidas
  const altL = 6.4, altC = 7;
  titulo('Medidas');
  const porPagina = Math.max(1, Math.floor((276 - y - altC) / altL));
  for (let ini = 0; ini < d.capturas.length; ini += porPagina) {
    const fatia = d.capturas.slice(ini, ini + porPagina);
    const alt = altC + altL * fatia.length;
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.roundedRect(M, y, LARG, alt, 2.2, 2.2, 'FD');
    doc.setFillColor(...CAB); doc.roundedRect(M, y, LARG, altC, 2.2, 2.2, 'F'); doc.rect(M, y + altC - 2.2, LARG, 2.2, 'F');
    doc.setDrawColor(...BORDA); doc.line(M, y + altC, W - M, y + altC);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AZUL);
    t('Tempo', M + 4, y + 4.7); t('Quadro', M + 28, y + 4.7); t('Medida', M + 50, y + 4.7); t('Valor', M + 140, y + 4.7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(20);
    fatia.forEach((c, i) => {
      const yy = y + altC + altL * i;
      if (i > 0) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M + 2, yy, W - M - 2, yy); }
      t(`${seg(c.t)} s`, M + 4, yy + 4.4); t(String(c.quadro), M + 28, yy + 4.4); t(c.nome, M + 50, yy + 4.4);
      doc.setFont('helvetica', 'bold'); t(c.valorTexto, M + 140, yy + 4.4); doc.setFont('helvetica', 'normal');
    });
    y += alt + 8;
    if (ini + porPagina < d.capturas.length) y = novaPagina();
  }

  // Quadros marcados, dois por linha
  const comImagem = d.capturas.filter((c) => c.imagem);
  if (comImagem.length) {
    if (y + 60 > 282) y = novaPagina();
    titulo('Quadros marcados');
    const wc = (LARG - 5) / 2, hMax = 82;
    for (let i = 0; i < comImagem.length; i += 2) {
      const par = comImagem.slice(i, i + 2);
      const hs = par.map((c) => Math.min(hMax, wc / (c.imagem!.w / c.imagem!.h)));
      const hLinha = Math.max(...hs) + 11;
      if (y + hLinha > 282) y = novaPagina();
      par.forEach((c, k) => {
        const x = M + k * (wc + 5);
        const h = hs[k], w = h * (c.imagem!.w / c.imagem!.h);
        doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.4);
        doc.roundedRect(x, y, w + 3, h + 3, 2.5, 2.5, 'FD');
        doc.addImage(c.imagem!.url, 'JPEG', x + 1.5, y + 1.5, w, h, undefined, 'FAST');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(70);
        const leg = doc.splitTextToSize(seguro(`${seg(c.t)} s · ${c.nome}: ${c.valorTexto}`), wc);
        doc.text(leg, x, y + h + 7); doc.setTextColor(20);
      });
      y += hLinha;
    }
  }

  const rodape = doc.splitTextToSize(seguro(`Pontos marcados pelo profissional em quadros do vídeo, a ${d.fps} quadros por segundo. ${d.notaExtra ?? 'Os ângulos usam a horizontal e a vertical da imagem como referência.'} Medida de acompanhamento, não é diagnóstico.`), LARG);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.4); doc.setTextColor(110);
  doc.text(rodape, M, 287 - rodape.length * 3.3);

  molduraEmTodasPaginas(doc);
  return { blob: doc.output('blob'), nome: `Analise_angular_video_${paciente.replace(/[^\w]+/g, '_')}_${d.data.split('/').reverse().join('-')}.pdf` };
}

// ---------- relatório da análise de gesto (rastreio, gráficos e métricas com referência) ----------

export interface QuadroRelatorio {
  rotulo: string;
  imagem: { url: string; w: number; h: number };
}

export interface GraficoRelatorio {
  titulo: string;
  dados: GraficoParaCanvas;
  /** Sentido do sinal dos ângulos deste gráfico (ex.: "0° = estendido; negativo = extensão"). */
  legendaSinal?: string;
}

export interface DadosRelatorioGesto {
  paciente: string;
  profissional?: string;
  logoUrl?: string;
  data: string;
  modelo: { nome: string; vista: string };
  /** Duração do trecho analisado e taxas de quadros, para a nota de rodapé. */
  duracaoS: number;
  fpsAnalise: number;
  cartoes: CartaoMetricaUi[];
  graficos: GraficoRelatorio[];
  quadros: QuadroRelatorio[];
  /** Medidas ponto a ponto guardadas no vídeo. */
  capturas?: CapturaRelatorio[];
  correcoes: { quadros: number; pontos: number };
  eventosEditados: number;
  /** Aviso fixo sobre os valores de referência (vem do motor). */
  avisoReferencias: string;
  avisos?: string[];
}

const COR_STATUS = { dentro: [4, 120, 87], alerta: [180, 83, 9], neutro: [110, 116, 128] } as const satisfies Record<string, [number, number, number]>;

/** Texto do valor de um cartão para a tabela: um valor ou "D … · E …". */
export const valorDoCartaoTexto = (c: CartaoMetricaUi): string => c.valores.map((v) => (v.lado ? `${v.lado} ${v.texto}` : v.texto)).join('  ·  ');

/** Erro de medida que o vídeo impõe ao valor (ex.: "± 6,2%"), sem repetir quando os dois lados têm o mesmo; vazio se não houver. */
export const incertezaDoCartaoTexto = (c: CartaoMetricaUi): string => [...new Set(c.valores.flatMap((v) => (v.incertezaCurta ? [v.incertezaCurta] : [])))].join(' · ');

const ROTULO_TIPO: Record<string, string> = { faixa_de_medias: 'faixa das médias de grupos, não é intervalo individual', limiar_heuristico: 'limiar prático, não é faixa de normalidade' };

/** Texto da referência de um cartão: a faixa, a fonte curta e o que a faixa é, ou "sem referência". */
export const referenciaDoCartaoTexto = (c: CartaoMetricaUi): string =>
  c.referencias.length
    ? c.referencias.map((r) => `${r.faixa} (${r.rotulo ?? r.citacao}${r.pmid ? `, PMID ${r.pmid}` : ''}${r.tipo ? `; ${ROTULO_TIPO[r.tipo]}` : ''})`).join('; ')
    : 'sem referência';

const situacaoDoCartaoTexto = (c: CartaoMetricaUi): string => {
  const natureza = naturezaDasReferencias(c.referencias);
  const textos = c.valores.map((v) => situacaoDoValor(v.status, natureza).texto);
  if (new Set(textos).size === 1) return textos[0];
  return c.valores.map((v, k) => (v.lado ? `${v.lado} ${textos[k]}` : textos[k])).join(' · ');
};

/** Cor da situação: só o "fora" de uma faixa de normalidade chama atenção; "fora" de média de grupos ou de limiar fica neutro. */
const corDaSituacao = (c: CartaoMetricaUi): [number, number, number] => {
  if (cartaoTemAlerta(c)) return [...COR_STATUS.alerta];
  return c.valores.some((v) => v.status === 'dentro') ? [...COR_STATUS.dentro] : [...COR_STATUS.neutro];
};

/**
 * Ressalvas de cada métrica que o relatório não pode perder: o que ela mede, quantas observações e o desvio-padrão, o erro de um quadro
 * do vídeo, a fórmula do índice e os avisos do cálculo. Uma linha por métrica que tenha algo a dizer.
 */
export function notasDasMetricas(cartoes: CartaoMetricaUi[]): string[] {
  return cartoes.flatMap((c) => {
    const incertezas = [...new Set(c.valores.flatMap((v) => (v.incerteza ? [v.incerteza] : [])))];
    const partes = [c.detalhe, ...incertezas, c.formula ? `Cálculo: ${c.formula}` : undefined, ...c.avisos].filter((x): x is string => !!x);
    return partes.length ? [`${c.titulo}: ${partes.map((p) => (/[.!?]$/.test(p) ? p : `${p}.`)).join(' ')}`] : [];
  });
}

/** Métrica com algum valor calculado; as que ficaram sem valor (falta escala ou evento) não entram na tabela. */
export const cartaoTemValor = (c: CartaoMetricaUi): boolean => c.valores.some((v) => v.texto !== '—');

export async function gerarRelatorioGesto(d: DadosRelatorioGesto): Promise<{ blob: Blob; nome: string }> {
  const paciente = nomeDocumento(d.paciente);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, M = 14, LARG = W - 2 * M, BASE = 282;
  const t = (txt: string, x: number, y: number, op?: Parameters<jsPDF['text']>[3]) => doc.text(seguro(txt), x, y, op);
  const novaPagina = () => { doc.addPage(); return 18; };
  const seg = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let y = 18;
  try { await addLogoToDoc(doc, W - M - 16, 10, 16, d.logoUrl); } catch { /* logo é opcional */ }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...AZUL); t(`Análise de ${d.modelo.nome.toLowerCase()} em vídeo`, M, y); y += 7;
  doc.setFontSize(11.5); doc.setTextColor(20); t(paciente, M, y); y += 5;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90);
  t(`${d.modelo.vista} · ${d.data}${d.profissional ? ` · ${d.profissional}` : ''}`, M, y); y += 4;
  doc.setDrawColor(...DOURADO); doc.setLineWidth(0.5); doc.line(M, y, M + 28, y);
  doc.setDrawColor(...BORDA); doc.setLineWidth(0.25); doc.line(M + 28, y, W - M, y); y += 8;
  doc.setTextColor(20);

  const garantir = (h: number) => { if (y + h > BASE) y = novaPagina(); };
  const titulo = (txt: string) => {
    garantir(14);
    doc.setFillColor(...AZUL); doc.roundedRect(M, y - 3.6, 1.4, 5, 0.7, 0.7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...AZUL); t(txt, M + 4, y); doc.setTextColor(20);
    y += 5;
  };

  // Métricas: uma linha por métrica, com valor, referência (só com fonte) e situação.
  const cartoes = d.cartoes.filter(cartaoTemValor);
  const semValor = d.cartoes.filter((c) => !cartaoTemValor(c)).map((c) => c.titulo);
  if (cartoes.length) {
    titulo('Métricas');
    const cols = { nome: M + 3, valor: M + 54, ref: M + 98, sit: M + 152 };
    const largs = { nome: 48, valor: 42, ref: 52, sit: LARG - 152 - 2 };
    const cabecalho = () => {
      doc.setFillColor(...CAB); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
      doc.roundedRect(M, y, LARG, 7, 2, 2, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...AZUL);
      t('Métrica', cols.nome, y + 4.7); t('Valor', cols.valor, y + 4.7); t('Referência (fonte)', cols.ref, y + 4.7); t('Situação', cols.sit, y + 4.7);
      doc.setTextColor(20); y += 7;
    };
    cabecalho();
    doc.setFontSize(8.3);
    cartoes.forEach((c) => {
      doc.setFont('helvetica', 'normal');
      const nome = doc.splitTextToSize(seguro(c.titulo), largs.nome) as string[];
      const valor = doc.splitTextToSize(seguro(valorDoCartaoTexto(c)), largs.valor) as string[];
      const incerteza = incertezaDoCartaoTexto(c);
      const ref = doc.splitTextToSize(seguro(referenciaDoCartaoTexto(c)), largs.ref) as string[];
      const sit = doc.splitTextToSize(seguro(situacaoDoCartaoTexto(c)), largs.sit) as string[];
      const linhas = Math.max(nome.length, valor.length + (incerteza ? 1 : 0), ref.length, sit.length);
      const alt = linhas * 3.7 + 3;
      if (y + alt > BASE) { y = novaPagina(); cabecalho(); doc.setFontSize(8.3); }
      doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M + 2, y, W - M - 2, y);
      doc.setTextColor(20); doc.text(nome, cols.nome, y + 4);
      doc.setFont('helvetica', 'bold'); doc.text(valor, cols.valor, y + 4); doc.setFont('helvetica', 'normal');
      if (incerteza) {
        doc.setFontSize(7.2); doc.setTextColor(100);
        doc.text(seguro(`${incerteza} (erro de medida do vídeo)`), cols.valor, y + 4 + valor.length * 3.7);
        doc.setFontSize(8.3);
      }
      doc.setTextColor(c.referencias.length ? 40 : 110); doc.text(ref, cols.ref, y + 4);
      doc.setTextColor(...corDaSituacao(c)); doc.text(sit, cols.sit, y + 4);
      doc.setTextColor(20);
      y += alt;
    });
    doc.setDrawColor(...BORDA); doc.line(M + 2, y, W - M - 2, y);
    y += 6;
  }

  // Gráficos ângulo x tempo, dois por linha.
  const imagens = d.graficos.map((g) => ({ g, png: (canvasDoGrafico(g.dados, 360, 190, { escala: 3 }))?.toDataURL('image/png') ?? null })).filter((x) => x.png);
  if (imagens.length) {
    const wg = (LARG - 4) / 2, hg = (wg * 190) / 360;
    titulo('Gráficos: ângulo ao longo do tempo');
    for (let i = 0; i < imagens.length; i += 2) {
      garantir(hg + 9);
      imagens.slice(i, i + 2).forEach(({ g, png }, k) => {
        const x = M + k * (wg + 4);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(60); t(g.titulo, x, y + 1);
        doc.setDrawColor(...BORDA); doc.setLineWidth(0.3); doc.roundedRect(x, y + 3, wg, hg, 2, 2, 'S');
        doc.addImage(png as string, 'PNG', x + 0.4, y + 3.4, wg - 0.8, hg - 0.8, undefined, 'FAST');
      });
      y += hg + 8;
    }
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(60);
    doc.setFillColor(COR_D); doc.circle(M + 1.5, y - 0.8, 1.2, 'F'); t('Direito', M + 4, y);
    doc.setFillColor(COR_E); doc.circle(M + 24, y - 0.8, 1.2, 'F'); t('Esquerdo', M + 26.5, y);
    const haEventos = d.graficos.some((g) => g.dados.marcadores?.length);
    const haBanda = d.graficos.some((g) => g.dados.bandas?.length);
    t(`Marcas no gráfico: ${haEventos ? 'contato inicial (linha cheia) e saída do pé (tracejada)' : 'sem eventos'}${haBanda ? '; faixa verde = referência com fonte' : ''}.`, M + 50, y);
    doc.setTextColor(20);
    y += 5;
    const sinais = [...new Set(d.graficos.filter((g) => g.legendaSinal).map((g) => `${g.titulo}: ${g.legendaSinal}`))];
    if (sinais.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(70);
      for (const txt of sinais) {
        const linhas = doc.splitTextToSize(seguro(`Sinal - ${txt}`), LARG - 4) as string[];
        garantir(linhas.length * 3.4 + 1);
        doc.text(linhas, M + 2, y + 2.5);
        y += linhas.length * 3.4 + 0.8;
      }
      doc.setTextColor(20);
    }
    y += 4;
  }

  // Quadros analisados, dois por linha.
  if (d.quadros.length) {
    titulo('Quadros analisados');
    const wc = (LARG - 5) / 2, hMax = 80;
    for (let i = 0; i < d.quadros.length; i += 2) {
      const par = d.quadros.slice(i, i + 2);
      const hs = par.map((q) => Math.min(hMax, wc / (q.imagem.w / q.imagem.h)));
      garantir(Math.max(...hs) + 11);
      par.forEach((q, k) => {
        const x = M + k * (wc + 5), h = hs[k], w = h * (q.imagem.w / q.imagem.h);
        doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.setLineWidth(0.4);
        doc.roundedRect(x, y, w + 3, h + 3, 2.5, 2.5, 'FD');
        doc.addImage(q.imagem.url, 'JPEG', x + 1.5, y + 1.5, w, h, undefined, 'FAST');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.8); doc.setTextColor(70);
        doc.text(doc.splitTextToSize(seguro(q.rotulo), wc), x, y + h + 7); doc.setTextColor(20);
      });
      y += Math.max(...hs) + 11;
    }
  }

  // Medidas ponto a ponto guardadas.
  if (d.capturas?.length) {
    titulo('Medidas ponto a ponto');
    doc.setFontSize(9);
    d.capturas.forEach((c) => {
      garantir(7);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(20);
      t(`${seg(c.t)} s · quadro ${c.quadro}`, M + 3, y + 4);
      t(c.nome, M + 38, y + 4);
      doc.setFont('helvetica', 'bold'); t(c.valorTexto, M + 140, y + 4);
      doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(M + 2, y + 6, W - M - 2, y + 6);
      y += 6.4;
    });
    y += 5;
  }

  // Fontes das referências usadas.
  const fontes = new Map<string, string>();
  for (const c of cartoes) for (const r of c.referencias) fontes.set(r.pmid ?? r.citacao, `${r.citacao}${r.pmid ? ` PMID ${r.pmid}.` : ''}`);
  if (fontes.size) {
    titulo('Referências consultadas');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50);
    for (const txt of fontes.values()) {
      const linhas = doc.splitTextToSize(seguro(`- ${txt}`), LARG - 4) as string[];
      garantir(linhas.length * 3.5 + 1);
      doc.text(linhas, M + 2, y + 2.5);
      y += linhas.length * 3.5 + 1;
    }
    doc.setTextColor(20);
    y += 4;
  }

  // Ressalvas das métricas: observações, desvio-padrão, erro de um quadro, fórmula e avisos do cálculo.
  const ressalvas = notasDasMetricas(cartoes);
  if (ressalvas.length) {
    titulo('Como ler cada métrica');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(50);
    for (const txt of ressalvas) {
      const linhas = doc.splitTextToSize(seguro(`- ${txt}`), LARG - 4) as string[];
      garantir(linhas.length * 3.5 + 1);
      doc.text(linhas, M + 2, y + 2.5);
      y += linhas.length * 3.5 + 1;
    }
    doc.setTextColor(20);
    y += 4;
  }

  // Observações.
  titulo('Observações');
  const notas = [
    d.avisoReferencias,
    `Pontos do corpo detectados automaticamente em vídeo (${d.fpsAnalise} quadros por segundo, trecho de ${seg(d.duracaoS)} s)${d.correcoes.pontos ? `; ${d.correcoes.pontos} ${d.correcoes.pontos === 1 ? 'ponto corrigido' : 'pontos corrigidos'} à mão em ${d.correcoes.quadros} ${d.correcoes.quadros === 1 ? 'quadro' : 'quadros'}` : '; nenhum ponto corrigido à mão'}${d.eventosEditados ? `; ${d.eventosEditados} ${d.eventosEditados === 1 ? 'evento ajustado' : 'eventos ajustados'} pelo profissional` : ''}.`,
    ...(semValor.length ? [`Não calculado neste vídeo (falta escala em cm, câmera parada ou eventos do ciclo): ${semValor.join(', ')}.`] : []),
    ...(d.avisos ?? []),
    'Medida de acompanhamento, não é diagnóstico. Os eventos (contato e saída do pé) são sugeridos pelo app e conferidos pelo profissional.',
  ];
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.3); doc.setTextColor(40);
  const linhas = doc.splitTextToSize(seguro(notas.map((n) => `- ${n}`).join('\n')), LARG - 8) as string[];
  const altBox = linhas.length * 3.7 + 5;
  garantir(altBox);
  doc.setFillColor(247, 249, 252); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
  doc.roundedRect(M, y, LARG, altBox, 2.2, 2.2, 'FD');
  doc.setFillColor(...AZUL); doc.roundedRect(M, y, 1.4, altBox, 0.7, 0.7, 'F');
  doc.text(linhas, M + 6, y + 5);

  molduraEmTodasPaginas(doc);
  return { blob: doc.output('blob'), nome: `Analise_${d.modelo.nome.toLowerCase().replace(/[^\w]+/g, '_')}_${paciente.replace(/[^\w]+/g, '_')}_${d.data.split('/').reverse().join('-')}.pdf` };
}
