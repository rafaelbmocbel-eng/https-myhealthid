/**
 * PDF de PROPOSTA DE TRATAMENTO — versão comercial premium da diretriz.
 *
 * Objetivo: usar a diretriz já validada na aba "Diretrizes" como chamariz de
 * venda — apresentar plano clínico em 3 fases + pacote sugerido + investimento
 * + CTA, com visual premium (Serene), pronto para enviar via WhatsApp.
 *
 * Importar dinamicamente:
 *   const { gerarPDFPropostaTratamento, downloadPDFBlob } = await import('@/utils/pdfPropostaTratamento');
 */
import jsPDF from 'jspdf';
import { addLogoToDoc } from './pdfLogoHelper';

// Paleta Serene
const NAVY = [28, 55, 83] as const;
const GOLD = [201, 168, 76] as const;
const TEXT = [25, 35, 50] as const;
const MUTED = [110, 120, 135] as const;
const LIGHT = [245, 243, 238] as const;
const SOFT = [232, 228, 221] as const;
const WHITE = [255, 255, 255] as const;
const GREEN = [76, 156, 110] as const;
const AMBER = [228, 168, 64] as const;
const RED = [196, 76, 76] as const;

type C3 = readonly [number, number, number];
const c = (x: C3) => [x[0], x[1], x[2]] as [number, number, number];

export interface FasePlano {
  numero: number;
  titulo: string;
  objetivo?: string;
  semanas?: string; // ex "1-2"
  focos?: string[]; // bullets curtos
}

export interface PDFPropostaData {
  pacienteNome: string;
  profissionalNome?: string;
  profissionalRegistro?: string;
  clinicaNome?: string;
  queixaPrincipal?: string;
  classificacao?: string;
  resumoClinico?: string;
  prognostico?: string;
  fases: FasePlano[];
  pacote: {
    numeroSessoes: number;
    frequencia: string;     // ex "2x por semana"
    duracao: string;        // ex "12 semanas"
    valorSessao: number;    // R$
    desconto?: number;      // % aplicado ao total
    formaPagamento?: string; // ex "PIX, cartão em até 6x"
  };
  ctaTelefone?: string; // para link wa.me
  ctaMensagem?: string; // mensagem personalizada
  validadeDias?: number;
}

function paintBg(doc: jsPDF) {
  doc.setFillColor(...c(LIGHT));
  doc.rect(0, 0, 210, 297, 'F');
}

function ensure(doc: jsPDF, y: number, need: number, margin = 22): number {
  if (y + need > 278) { doc.addPage(); paintBg(doc); return margin; }
  return y;
}

function wrap(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text || '', maxW);
}

function brl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
}

// =============== CAPA ===============
async function drawCapa(doc: jsPDF, data: PDFPropostaData) {
  // Fundo navy
  doc.setFillColor(...c(NAVY));
  doc.rect(0, 0, 210, 297, 'F');

  // Faixa dourada lateral
  doc.setFillColor(...c(GOLD));
  doc.rect(0, 0, 6, 297, 'F');

  // Logo
  try { await addLogoToDoc(doc, 22, 22, 14); }
  catch { /* fallback abaixo */ }

  // Nome da clínica/marca
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...c(GOLD));
  doc.text((data.clinicaNome || 'MY HEALTH ID').toUpperCase(), 22, 50, { charSpace: 1.2 });

  // Etiqueta
  doc.setFontSize(8);
  doc.setTextColor(220, 215, 200);
  doc.text('PROPOSTA DE TRATAMENTO PERSONALIZADA', 22, 58, { charSpace: 1.5 });

  // Título grande
  doc.setFont('times', 'italic');
  doc.setFontSize(40);
  doc.setTextColor(...c(WHITE));
  doc.text('Seu plano de', 22, 105);
  doc.text('recuperação', 22, 125);
  doc.setTextColor(...c(GOLD));
  doc.text('começa aqui.', 22, 145);

  // Linha de separação
  doc.setDrawColor(...c(GOLD));
  doc.setLineWidth(0.4);
  doc.line(22, 158, 80, 158);

  // Para
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(180, 175, 160);
  doc.text('PREPARADO PARA', 22, 172, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...c(WHITE));
  doc.text(data.pacienteNome, 22, 184);

  if (data.queixaPrincipal) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(220, 215, 200);
    const linhas = wrap(doc, data.queixaPrincipal, 160);
    doc.text(linhas, 22, 194);
  }

  // Card resumo embaixo
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...c(GOLD));
  doc.setLineWidth(0.3);
  doc.roundedRect(22, 232, 166, 42, 3, 3, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...c(MUTED));
  doc.text('PLANO EM', 30, 244, { charSpace: 1 });
  doc.text('SESSÕES', 78, 244, { charSpace: 1 });
  doc.text('INVESTIMENTO', 130, 244, { charSpace: 1 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...c(NAVY));
  doc.text(`${data.fases.length} fases`, 30, 256);
  doc.text(String(data.pacote.numeroSessoes), 78, 256);

  const totalBruto = data.pacote.numeroSessoes * data.pacote.valorSessao;
  const desc = data.pacote.desconto || 0;
  const total = totalBruto * (1 - desc / 100);
  doc.setTextColor(...c(GOLD));
  doc.text(brl(total), 130, 256);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...c(MUTED));
  doc.text(data.pacote.duracao, 30, 264);
  doc.text(data.pacote.frequencia, 78, 264);
  if (desc > 0) doc.text(`${desc}% desconto aplicado`, 130, 264);
  else if (data.pacote.formaPagamento) doc.text(data.pacote.formaPagamento, 130, 264);

  // Rodapé capa
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 175, 160);
  doc.text(
    `Elaborada por ${data.profissionalNome || 'seu profissional'}${data.profissionalRegistro ? ' · ' + data.profissionalRegistro : ''}`,
    22, 286
  );
  doc.text(new Date().toLocaleDateString('pt-BR'), 188, 286, { align: 'right' });
}

// =============== HEADER DAS PÁGINAS INTERNAS ===============
function drawHeader(doc: jsPDF, titulo: string) {
  doc.setFillColor(...c(NAVY));
  doc.rect(0, 0, 210, 28, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(0, 27, 210, 1, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...c(GOLD));
  doc.text('PROPOSTA DE TRATAMENTO', 22, 13, { charSpace: 1.2 });

  doc.setFont('times', 'italic');
  doc.setFontSize(15);
  doc.setTextColor(...c(WHITE));
  doc.text(titulo, 22, 22);
}

// =============== SEU DIAGNÓSTICO ===============
function drawDiagnostico(doc: jsPDF, y: number, data: PDFPropostaData): number {
  if (!data.resumoClinico && !data.classificacao && !data.prognostico) return y;

  y = ensure(doc, y, 60);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...c(NAVY));
  doc.text('O QUE ENCONTRAMOS NA SUA AVALIAÇÃO', 22, y);
  y += 6;

  if (data.classificacao) {
    const cor = data.classificacao.toUpperCase().includes('GRAV')
      || data.classificacao.toUpperCase().includes('CRÍT') ? RED
      : data.classificacao.toUpperCase().includes('MOD') ? AMBER : GREEN;
    doc.setFillColor(...c(cor));
    doc.roundedRect(22, y - 3, 52, 7, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...c(WHITE));
    doc.text(data.classificacao.toUpperCase(), 48, y + 1.5, { align: 'center', charSpace: 1 });
    y += 8;
  }

  if (data.resumoClinico) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(...c(TEXT));
    const lines = wrap(doc, data.resumoClinico, 166);
    doc.text(lines, 22, y + 2);
    y += lines.length * 5 + 4;
  }

  if (data.prognostico) {
    y = ensure(doc, y, 22);
    doc.setFillColor(...c(SOFT));
    doc.roundedRect(22, y, 166, 18, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...c(GOLD));
    doc.text('PROGNÓSTICO', 27, y + 6, { charSpace: 1 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...c(TEXT));
    const linesP = wrap(doc, data.prognostico, 156);
    doc.text(linesP.slice(0, 2), 27, y + 12);
    y += 22;
  }
  return y;
}

// =============== PLANO EM FASES ===============
function drawFases(doc: jsPDF, y: number, fases: FasePlano[]): number {
  y = ensure(doc, y + 4, 18);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...c(NAVY));
  doc.text('SEU PLANO EM 3 FASES', 22, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...c(MUTED));
  doc.text('Cada fase tem objetivo claro e critérios para avançar para a próxima.', 22, y);
  y += 6;

  const FASE_COLORS: C3[] = [RED, AMBER, GREEN];

  fases.forEach((f, idx) => {
    const corFase = FASE_COLORS[idx] || NAVY;
    const focos = f.focos || [];
    const altura = 22 + focos.length * 4.5 + (f.objetivo ? 10 : 0);
    y = ensure(doc, y, altura + 6);

    // Card
    doc.setFillColor(...c(WHITE));
    doc.setDrawColor(...c(SOFT));
    doc.setLineWidth(0.2);
    doc.roundedRect(22, y, 166, altura, 2.5, 2.5, 'FD');

    // Faixa lateral colorida
    doc.setFillColor(...c(corFase));
    doc.rect(22, y, 2.5, altura, 'F');

    // Número grande
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(...c(corFase));
    doc.text(String(f.numero), 30, y + 13);

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...c(NAVY));
    doc.text(f.titulo, 45, y + 9);

    if (f.semanas) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...c(MUTED));
      doc.text(`Semanas ${f.semanas}`, 45, y + 14);
    }

    let yi = y + (f.semanas ? 19 : 16);

    if (f.objetivo) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...c(TEXT));
      const ol = wrap(doc, `“${f.objetivo}”`, 140);
      doc.text(ol.slice(0, 2), 45, yi);
      yi += ol.length * 4.5;
    }

    if (focos.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...c(TEXT));
      focos.slice(0, 4).forEach((foco) => {
        doc.setTextColor(...c(corFase));
        doc.text('•', 45, yi);
        doc.setTextColor(...c(TEXT));
        const fl = wrap(doc, foco, 135);
        doc.text(fl[0], 48, yi);
        yi += 4.5;
      });
    }

    y += altura + 4;
  });

  return y;
}

// =============== INVESTIMENTO ===============
function drawInvestimento(doc: jsPDF, y: number, data: PDFPropostaData): number {
  y = ensure(doc, y + 4, 70);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...c(NAVY));
  doc.text('SEU INVESTIMENTO', 22, y);
  y += 6;

  const p = data.pacote;
  const bruto = p.numeroSessoes * p.valorSessao;
  const desc = p.desconto || 0;
  const total = bruto * (1 - desc / 100);
  const valorPorSessao = total / Math.max(1, p.numeroSessoes);

  // Card destaque
  doc.setFillColor(...c(NAVY));
  doc.roundedRect(22, y, 166, 56, 3, 3, 'F');

  doc.setFillColor(...c(GOLD));
  doc.rect(22, y, 2.5, 56, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...c(GOLD));
  doc.text('PACOTE COMPLETO', 30, y + 9, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...c(WHITE));
  doc.text(`${p.numeroSessoes} sessões · ${p.frequencia}`, 30, y + 18);

  // Valor
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 195, 180);
  doc.text('INVESTIMENTO TOTAL', 30, y + 28, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(...c(GOLD));
  doc.text(brl(total), 30, y + 41);

  if (desc > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(200, 195, 180);
    doc.text(`de ${brl(bruto)} · economia de ${brl(bruto - total)}`, 30, y + 48);
  }

  // Coluna direita
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(200, 195, 180);
  doc.text('EQUIVALENTE POR SESSÃO', 120, y + 28, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...c(WHITE));
  doc.text(brl(valorPorSessao), 120, y + 38);

  if (p.formaPagamento) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 195, 180);
    const fp = wrap(doc, p.formaPagamento, 60);
    doc.text(fp.slice(0, 2), 120, y + 46);
  }

  y += 60;

  // Benefícios incluídos
  y = ensure(doc, y, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...c(NAVY));
  doc.text('INCLUSO NO PACOTE', 22, y);
  y += 5;

  const beneficios = [
    'Plano clínico personalizado em 3 fases',
    'Acompanhamento direto pelo profissional',
    'Acesso ao portal do paciente com missões e evolução',
    'Reavaliações periódicas para ajustar o plano',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...c(TEXT));
  beneficios.forEach((b) => {
    doc.setTextColor(...c(GOLD));
    doc.text('✓', 22, y + 4);
    doc.setTextColor(...c(TEXT));
    doc.text(b, 28, y + 4);
    y += 5.5;
  });

  return y;
}

// =============== CTA ===============
function drawCTA(doc: jsPDF, y: number, data: PDFPropostaData) {
  y = ensure(doc, y + 6, 50);

  doc.setFillColor(...c(SOFT));
  doc.roundedRect(22, y, 166, 38, 3, 3, 'F');

  doc.setFont('times', 'italic');
  doc.setFontSize(13);
  doc.setTextColor(...c(NAVY));
  doc.text('Vamos começar?', 30, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...c(TEXT));
  const msg = data.ctaMensagem
    || 'Responda esta proposta para reservarmos sua primeira sessão.';
  const ml = wrap(doc, msg, 150);
  doc.text(ml.slice(0, 2), 30, y + 20);

  if (data.ctaTelefone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...c(GOLD));
    doc.text(`WhatsApp: ${data.ctaTelefone}`, 30, y + 32);
  }

  if (data.validadeDias) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...c(MUTED));
    doc.text(`Proposta válida por ${data.validadeDias} dias.`, 188, y + 32, { align: 'right' });
  }

  return y + 42;
}

// =============== ASSINATURA / RODAPÉ ===============
function drawFooter(doc: jsPDF, page: number, total: number, data: PDFPropostaData) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...c(MUTED));
  doc.text(
    `${data.profissionalNome || ''}${data.profissionalRegistro ? ' · ' + data.profissionalRegistro : ''}`,
    22, 290
  );
  doc.text(`${page} / ${total}`, 188, 290, { align: 'right' });
}

// =============== ENTRADA ===============
export async function gerarPDFPropostaTratamento(data: PDFPropostaData): Promise<Blob> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // Capa
  await drawCapa(doc, data);

  // Página 2+
  doc.addPage();
  paintBg(doc);
  drawHeader(doc, 'Seu plano de tratamento');

  let y = 40;
  y = drawDiagnostico(doc, y, data);
  y = drawFases(doc, y, data.fases);
  y = drawInvestimento(doc, y, data);
  drawCTA(doc, y, data);

  // Footer em todas as páginas internas
  const total = doc.getNumberOfPages();
  for (let i = 2; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i - 1, total - 1, data);
  }

  return doc.output('blob');
}

export function downloadPDFBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
