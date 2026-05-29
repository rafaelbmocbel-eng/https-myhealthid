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
import { drawFingerprintWatermark, drawFingerprintMark } from './pdfFingerprintWatermark';

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

export interface TecnicaPlano {
  tecnica: string;
  justificativa?: string;
  lente_clinica?: string;
  nivel_evidencia?: string | number;
}

export interface FasePlano {
  numero: number;
  titulo: string;
  objetivo?: string;
  semanas?: string; // ex "1-2"
  focos?: string[]; // bullets curtos
  tecnicas?: TecnicaPlano[];
}


export interface PlanoManutencao {
  mensagemPaciente?: string;
  rotinaMinima?: string[];
  frequenciaReavaliacao?: string;
  sinaisParaRetornar?: string[];
  habitosChave?: string[];
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
  manutencao?: PlanoManutencao;
  myidEnhancements?: {
    myid_score?: number;
    classificacao?: string;
    driver?: { label?: string; intervencoes?: string[] };
    reforcos_por_fase?: { numero: number; foco: string; intervencoes: string[] }[];
    meta_final?: string;
  };
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

// =============== HERO (topo da página 1) ===============
// Banda navy compacta (~88mm) que ocupa só o topo da primeira página,
// liberando o restante da página para já começar o plano de tratamento.
async function drawHero(doc: jsPDF, data: PDFPropostaData): Promise<number> {
  const HERO_H = 62;

  doc.setFillColor(...c(LIGHT));
  doc.rect(0, 0, 210, 297, 'F');

  doc.setFillColor(...c(NAVY));
  doc.rect(0, 0, 210, HERO_H, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(0, HERO_H, 210, 0.8, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(0, 0, 3, HERO_H, 'F');

  await drawFingerprintWatermark(doc, 130, -10, 90, 0.07);
  await drawFingerprintMark(doc, 180, 11, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...c(GOLD));
  doc.text((data.clinicaNome || 'MY HEALTH ID').toUpperCase(), 22, 12, { charSpace: 1.3 });

  doc.setFontSize(6.5);
  doc.setTextColor(200, 195, 180);
  doc.text('PROPOSTA DE TRATAMENTO PERSONALIZADA', 22, 17, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...c(WHITE));
  doc.text('Seu plano de recuperação', 22, 28);
  doc.setTextColor(...c(GOLD));
  doc.text('começa aqui.', 22, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 175, 160);
  doc.text('PREPARADO PARA', 22, 45, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...c(WHITE));
  doc.text(data.pacienteNome, 22, 51);

  if (data.queixaPrincipal) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 215, 200);
    const linhas = wrap(doc, data.queixaPrincipal, 95).slice(0, 1);
    doc.text(linhas, 22, 56);
  }

  // Mini-strip à direita
  const totalBruto = data.pacote.numeroSessoes * data.pacote.valorSessao;
  const desc = data.pacote.desconto || 0;
  const total = totalBruto * (1 - desc / 100);

  const stripX = 125;
  const stripY = 43;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(200, 195, 180);
  doc.text('PLANO', stripX, stripY, { charSpace: 1 });
  doc.text('SESSÕES', stripX + 22, stripY, { charSpace: 1 });
  doc.text('INVESTIMENTO', stripX + 44, stripY, { charSpace: 1 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(WHITE));
  doc.text(`${data.fases.length} fases`, stripX, stripY + 5);
  doc.text(String(data.pacote.numeroSessoes), stripX + 22, stripY + 5);
  doc.setTextColor(...c(GOLD));
  doc.text(total > 0 ? brl(total) : 'Consulta', stripX + 44, stripY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(200, 195, 180);
  doc.text(data.pacote.frequencia, stripX, stripY + 9);
  doc.text(data.pacote.duracao, stripX + 22, stripY + 9);
  if (desc > 0) doc.text(`${desc}% off`, stripX + 44, stripY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 175, 160);
  doc.text(
    `Por ${data.profissionalNome || 'seu profissional'}${data.profissionalRegistro ? ' · ' + data.profissionalRegistro : ''}`,
    22, 59
  );
  doc.text(new Date().toLocaleDateString('pt-BR'), 188, 59, { align: 'right' });

  return HERO_H + 5;
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

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...c(WHITE));
  doc.text(titulo, 22, 22);
}


// =============== SEU DIAGNÓSTICO ===============
function drawDiagnostico(doc: jsPDF, y: number, data: PDFPropostaData): number {
  if (!data.resumoClinico && !data.classificacao && !data.prognostico) return y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(NAVY));
  doc.text('O QUE ENCONTRAMOS NA SUA AVALIAÇÃO', 22, y);

  if (data.classificacao) {
    const cor = data.classificacao.toUpperCase().includes('GRAV')
      || data.classificacao.toUpperCase().includes('CRÍT') ? RED
      : data.classificacao.toUpperCase().includes('MOD') ? AMBER : GREEN;
    doc.setFillColor(...c(cor));
    doc.roundedRect(140, y - 4, 48, 6, 1.5, 1.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...c(WHITE));
    doc.text(data.classificacao.toUpperCase(), 164, y, { align: 'center', charSpace: 1 });
  }
  y += 5;

  if (data.resumoClinico) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...c(TEXT));
    const lines = wrap(doc, data.resumoClinico, 166).slice(0, 3);
    doc.text(lines, 22, y);
    y += lines.length * 4.2 + 2;
  }

  if (data.prognostico) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...c(GOLD));
    doc.text('PROGNÓSTICO:', 22, y, { charSpace: 1 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...c(TEXT));
    const linesP = wrap(doc, data.prognostico, 140).slice(0, 2);
    doc.text(linesP, 48, y);
    y += linesP.length * 4.2 + 2;
  }
  return y + 2;
}


// =============== PLANO EM FASES ===============
function drawFases(doc: jsPDF, y: number, fases: FasePlano[]): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(NAVY));
  doc.text('SEU PLANO EM 3 FASES', 22, y);
  y += 5;

  const FASE_COLORS: C3[] = [RED, AMBER, GREEN];

  fases.slice(0, 3).forEach((f, idx) => {
    const corFase = FASE_COLORS[idx] || NAVY;
    const focos = (f.focos || []).slice(0, 3);
    const tecnicas = (f.tecnicas || []).slice(0, 4);

    // medir: header (10) + objetivo (5) + max(focos, tecnicas) * 4 + pad
    const objLines = f.objetivo
      ? wrap(doc, `"${f.objetivo}"`, 156).slice(0, 1)
      : [];
    const linhasConteudo = Math.max(focos.length, tecnicas.length);
    const altura = 11 + (objLines.length ? 5 : 0) + linhasConteudo * 4 + 5;

    // Card
    doc.setFillColor(...c(WHITE));
    doc.setDrawColor(...c(SOFT));
    doc.setLineWidth(0.2);
    doc.roundedRect(22, y, 166, altura, 2, 2, 'FD');
    doc.setFillColor(...c(corFase));
    doc.rect(22, y, 2, altura, 'F');

    // Cabeçalho: número + título + semanas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...c(corFase));
    doc.text(String(f.numero), 28, y + 8);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...c(NAVY));
    doc.text(f.titulo, 35, y + 7);

    if (f.semanas) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(...c(MUTED));
      doc.text(`Semanas ${f.semanas}`, 186, y + 7, { align: 'right' });
    }

    let yi = y + 11;

    // Objetivo (1 linha)
    if (objLines.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...c(TEXT));
      doc.text(objLines, 28, yi);
      yi += 5;
    }

    // 2 colunas: FOCOS | TÉCNICAS
    const colY = yi;
    if (focos.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...c(GOLD));
      doc.text('FOCOS', 28, colY - 1, { charSpace: 1 });
    }
    if (tecnicas.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(...c(GOLD));
      doc.text('TÉCNICAS', 110, colY - 1, { charSpace: 1 });
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    focos.forEach((foco, i) => {
      const yLine = colY + 3 + i * 4;
      doc.setTextColor(...c(corFase));
      doc.text('•', 28, yLine);
      doc.setTextColor(...c(TEXT));
      const fl = wrap(doc, foco, 75).slice(0, 1);
      doc.text(fl, 31, yLine);
    });

    tecnicas.forEach((t, i) => {
      const yLine = colY + 3 + i * 4;
      doc.setTextColor(...c(NAVY));
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('›', 110, yLine);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...c(TEXT));
      const tl = wrap(doc, t.tecnica, 70).slice(0, 1);
      doc.text(tl, 113, yLine);
      if (t.nivel_evidencia) {
        doc.setFontSize(6.5);
        doc.setTextColor(...c(MUTED));
        doc.text(`N${t.nivel_evidencia}`, 186, yLine, { align: 'right' });
      }
    });

    y += altura + 3;
  });

  return y;
}



// =============== PLANO DE MANUTENÇÃO (compacto, 2 colunas) ===============
function drawManutencao(doc: jsPDF, y: number, m?: PlanoManutencao): number {
  if (!m) return y;
  const hasContent =
    m.mensagemPaciente ||
    (m.rotinaMinima && m.rotinaMinima.length) ||
    m.frequenciaReavaliacao ||
    (m.sinaisParaRetornar && m.sinaisParaRetornar.length) ||
    (m.habitosChave && m.habitosChave.length);
  if (!hasContent) return y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(NAVY));
  doc.text('PLANO DE MANUTENÇÃO (PÓS-ALTA)', 22, y);
  y += 5;

  // Card verde compacto
  const rotina = (m.rotinaMinima || []).slice(0, 3);
  const habitos = (m.habitosChave || []).slice(0, 3);
  const sinais = (m.sinaisParaRetornar || []).slice(0, 3);

  const linhasCol = Math.max(rotina.length, habitos.length, sinais.length);
  const altura = 8 + (m.mensagemPaciente ? 6 : 0) + (m.frequenciaReavaliacao ? 5 : 0) + 5 + linhasCol * 4 + 4;

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...c(GREEN));
  doc.setLineWidth(0.3);
  doc.roundedRect(22, y, 166, altura, 2, 2, 'FD');
  doc.setFillColor(...c(GREEN));
  doc.rect(22, y, 2, altura, 'F');

  let yi = y + 5;

  if (m.mensagemPaciente) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...c(TEXT));
    const ml = wrap(doc, `"${m.mensagemPaciente}"`, 158).slice(0, 1);
    doc.text(ml, 28, yi);
    yi += 5;
  }

  if (m.frequenciaReavaliacao) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...c(NAVY));
    doc.text('Reavaliação:', 28, yi);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...c(TEXT));
    doc.text(m.frequenciaReavaliacao, 50, yi);
    yi += 5;
  }

  // 3 colunas
  const colTitles = [
    { titulo: 'ROTINA MÍNIMA', itens: rotina, x: 28 },
    { titulo: 'HÁBITOS-CHAVE', itens: habitos, x: 82 },
    { titulo: 'VOLTAR SE', itens: sinais, x: 138 },
  ];
  colTitles.forEach((col) => {
    if (!col.itens.length) return;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...c(GOLD));
    doc.text(col.titulo, col.x, yi, { charSpace: 1 });
  });
  yi += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  colTitles.forEach((col) => {
    col.itens.forEach((it, i) => {
      const yLine = yi + i * 4;
      doc.setTextColor(...c(GREEN));
      doc.text('•', col.x, yLine);
      doc.setTextColor(...c(TEXT));
      const fl = wrap(doc, it, 48).slice(0, 1);
      doc.text(fl, col.x + 2.5, yLine);
    });
  });

  return y + altura + 4;
}

// =============== INVESTIMENTO (compacto) ===============
function drawInvestimento(doc: jsPDF, y: number, data: PDFPropostaData): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(NAVY));
  doc.text('SEU INVESTIMENTO', 22, y);
  y += 5;

  const p = data.pacote;
  const bruto = p.numeroSessoes * p.valorSessao;
  const desc = p.desconto || 0;
  const total = bruto * (1 - desc / 100);
  const valorPorSessao = total / Math.max(1, p.numeroSessoes);

  // Card navy compacto
  const H = 42;
  doc.setFillColor(...c(NAVY));
  doc.roundedRect(22, y, 166, H, 2.5, 2.5, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(22, y, 2, H, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...c(GOLD));
  doc.text('PACOTE COMPLETO', 28, y + 7, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...c(WHITE));
  doc.text(`${p.numeroSessoes} sessões · ${p.frequencia} · ${p.duracao}`, 28, y + 14);

  // Total
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 195, 180);
  doc.text('INVESTIMENTO TOTAL', 28, y + 22, { charSpace: 1.2 });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...c(GOLD));
  doc.text(brl(total), 28, y + 33);

  if (desc > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(200, 195, 180);
    doc.text(`de ${brl(bruto)} · economia ${brl(bruto - total)}`, 28, y + 38);
  }

  // Coluna direita
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 195, 180);
  doc.text('POR SESSÃO', 120, y + 22, { charSpace: 1.2 });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...c(WHITE));
  doc.text(brl(valorPorSessao), 120, y + 31);

  if (p.formaPagamento) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 195, 180);
    const fp = wrap(doc, p.formaPagamento, 62).slice(0, 1);
    doc.text(fp, 120, y + 37);
  }

  y += H + 4;

  // Benefícios — 2 colunas inline
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...c(NAVY));
  doc.text('INCLUSO NO PACOTE', 22, y, { charSpace: 1 });
  y += 4;

  const beneficios = [
    'Plano clínico em 3 fases',
    'Acompanhamento direto pelo profissional',
    'Portal do paciente com missões e evolução',
    'Reavaliações periódicas',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  beneficios.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xb = 22 + col * 85;
    const yb = y + row * 4.5;
    doc.setTextColor(...c(GOLD));
    doc.text('✓', xb, yb);
    doc.setTextColor(...c(TEXT));
    doc.text(b, xb + 4, yb);
  });
  y += Math.ceil(beneficios.length / 2) * 4.5 + 2;

  return y;
}

// =============== CTA (compacto) ===============
function drawCTA(doc: jsPDF, y: number, data: PDFPropostaData) {
  const H = 22;
  doc.setFillColor(...c(NAVY));
  doc.roundedRect(22, y, 166, H, 2.5, 2.5, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(22, y, 2, H, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...c(WHITE));
  doc.text('Vamos começar?', 28, y + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(220, 215, 200);
  const msg = data.ctaMensagem
    || 'Responda esta proposta para reservarmos sua primeira sessão.';
  const ml = wrap(doc, msg, 105).slice(0, 1);
  doc.text(ml, 28, y + 15);

  if (data.ctaTelefone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...c(GOLD));
    doc.text(data.ctaTelefone, 184, y + 11, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(200, 195, 180);
    doc.text('WHATSAPP', 184, y + 6.5, { align: 'right', charSpace: 1.2 });
  }

  if (data.validadeDias) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(200, 195, 180);
    doc.text(`Válida por ${data.validadeDias} dias`, 184, y + 17, { align: 'right' });
  }

  return y + H;
}

// =============== RODAPÉ ===============
function drawFooter(doc: jsPDF, page: number, total: number, data: PDFPropostaData) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
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

  // PÁGINA 1 — hero + diagnóstico + 3 fases
  let y = await drawHero(doc, data);
  y = drawDiagnostico(doc, y, data);
  drawFases(doc, y, data.fases);

  // PÁGINA 2 — manutenção + investimento + CTA
  doc.addPage();
  paintBg(doc);
  let y2 = 22;
  y2 = drawManutencao(doc, y2, data.manutencao);
  y2 = drawInvestimento(doc, y2, data);
  drawCTA(doc, y2, data);

  // Footer em todas as páginas
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total, data);
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
