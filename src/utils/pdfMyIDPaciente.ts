/**
 * PDF amigável do MyID para o PACIENTE.
 * Gerador pesado (jsPDF) — importar dinamicamente:
 *   const { gerarPDFMyIDPaciente } = await import('@/utils/pdfMyIDPaciente');
 *
 * Não substitui o relatório clínico (pdfAvaliacaoGenerator). Linguagem leve,
 * voltada ao paciente, com Score global, Fingerprint resumido, Driver
 * Primário, 3 fases do plano e missões priorizadas.
 */
import jsPDF from 'jspdf';
import { addLogoToDoc } from './pdfLogoHelper';
import { drawFingerprintMark } from './pdfFingerprintWatermark';

// Paleta Serene (alinhada com o portal do paciente)
const NAVY = [28, 55, 83] as const;
const GOLD = [201, 168, 76] as const;
const TEXT = [25, 35, 50] as const;
const MUTED = [110, 120, 135] as const;
const LIGHT = [245, 243, 238] as const; // off-white / paper
const SOFT = [232, 228, 221] as const;
const GREEN = [76, 156, 110] as const;
const AMBER = [228, 168, 64] as const;
const RED = [196, 76, 76] as const;
const WHITE = [255, 255, 255] as const;

type C3 = readonly [number, number, number];

const DIM_LABELS: Record<string, string> = {
  D: 'Dor',
  EFI: 'Funcionalidade',
  P: 'Psicológico',
  I: 'Demanda/Inércia',
  R: 'Regulação (Sono)',
  C: 'Contexto',
  AF: 'Atividade Física',
  HID: 'Hidratação',
  NUT: 'Nutrição',
  ERG: 'Ergonomia',
  N: 'Ruído/Estresse',
  MED: 'Medicação',
};

// Componentes onde score ALTO é ruim (perda quando >0)
const HIGHER_IS_WORSE = new Set(['D', 'P', 'I', 'N', 'MED']);

export interface PDFMyIDPacienteData {
  pacienteNome: string;
  profissionalNome?: string;
  dataAvaliacao: string; // ISO ou pt-BR
  myidScore: number;     // 0-100 (positivo)
  classificacao: string; // ÓTIMO/BOM/MODERADO/ALERTA/CRÍTICO
  scores: Partial<Record<keyof typeof DIM_LABELS, number>>; // 0-10
  driverPrimario?: { dimensao?: string; descricao?: string } | null;
  fases?: Array<{ titulo: string; descricao?: string; foco?: string[] }>;
  missoes?: Array<{ titulo: string; descricao?: string; xp?: number; categoria?: string }>;
  observacao?: string;
}

function color(c: C3) { return [c[0], c[1], c[2]] as [number, number, number]; }

function classColor(cls: string): C3 {
  const k = (cls || '').toUpperCase();
  if (k.includes('ÓTIM') || k.includes('OTIM') || k.includes('BOM')) return GREEN;
  if (k.includes('CRÍT') || k.includes('CRIT')) return RED;
  if (k.includes('ALERT')) return RED;
  return AMBER;
}

function dimColor(key: string, val: number): C3 {
  const loss = HIGHER_IS_WORSE.has(key) ? val : 10 - val;
  if (loss <= 2) return GREEN;
  if (loss <= 5) return AMBER;
  return RED;
}

function ensureSpace(doc: jsPDF, y: number, needed: number, margin = 20): number {
  if (y + needed > 280) { doc.addPage(); paintBackground(doc); return margin + 5; }
  return y;
}

function paintBackground(doc: jsPDF) {
  doc.setFillColor(...color(LIGHT));
  doc.rect(0, 0, 210, 297, 'F');
}

async function drawHeader(doc: jsPDF, title: string, subtitle: string) {
  // top band
  doc.setFillColor(...color(NAVY));
  doc.rect(0, 0, 210, 28, 'F');

  // logo (best-effort)
  try { await addLogoToDoc(doc, 14, 7, 14); } catch { /* ignore */ }

  doc.setTextColor(...color(WHITE));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, 32, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...color(SOFT));
  doc.text(subtitle, 32, 20);
}

function drawFooter(doc: jsPDF, page: number, total: number) {
  doc.setDrawColor(...color(SOFT));
  doc.setLineWidth(0.2);
  doc.line(14, 287, 196, 287);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...color(MUTED));
  doc.text('MY HEALTH ID • Seu mapa de saúde, em uma página.', 14, 292);
  doc.text(`Página ${page} de ${total}`, 196, 292, { align: 'right' });
}

function drawScoreGauge(doc: jsPDF, x: number, y: number, score: number, cls: string) {
  // Card
  doc.setFillColor(...color(WHITE));
  doc.setDrawColor(...color(SOFT));
  doc.roundedRect(x, y, 182, 48, 4, 4, 'FD');

  // Big score
  doc.setTextColor(...color(NAVY));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(36);
  const scoreText = `${Math.round(score)}`;
  doc.text(scoreText, x + 14, y + 30);
  const sw = doc.getTextWidth(scoreText);
  doc.setFontSize(11);
  doc.setTextColor(...color(MUTED));
  doc.text('/100', x + 14 + sw + 2, y + 30);

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...color(MUTED));
  doc.text('SEU MyID', x + 14, y + 12);

  // Classification chip
  const c = classColor(cls);
  doc.setFillColor(...color(c));
  const chipW = doc.getTextWidth(cls) + 10;
  doc.roundedRect(x + 14, y + 36, chipW, 8, 2, 2, 'F');
  doc.setTextColor(...color(WHITE));
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(cls, x + 14 + chipW / 2, y + 41.5, { align: 'center' });

  // Mini progress bar (right side)
  const barX = x + 90;
  const barY = y + 22;
  const barW = 80;
  doc.setFillColor(...color(SOFT));
  doc.roundedRect(barX, barY, barW, 6, 2, 2, 'F');
  doc.setFillColor(...color(c));
  doc.roundedRect(barX, barY, Math.max(2, (Math.min(100, Math.max(0, score)) / 100) * barW), 6, 2, 2, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...color(MUTED));
  doc.text('0', barX, barY + 12);
  doc.text('100', barX + barW, barY + 12, { align: 'right' });
}

function drawFingerprint(doc: jsPDF, x: number, y: number, scores: PDFMyIDPacienteData['scores']) {
  // Card
  doc.setFillColor(...color(WHITE));
  doc.setDrawColor(...color(SOFT));
  doc.roundedRect(x, y, 182, 110, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...color(NAVY));
  doc.text('Sua impressão digital de saúde', x + 8, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...color(MUTED));
  doc.text('Verde = bem • Amarelo = atenção • Vermelho = prioridade', x + 8, y + 16);

  // Two columns of horizontal bars
  const keys = Object.keys(DIM_LABELS).filter((k) => scores[k as keyof typeof DIM_LABELS] !== undefined);
  const left = keys.slice(0, 6);
  const right = keys.slice(6);
  const drawCol = (items: string[], colX: number, startY: number) => {
    items.forEach((k, i) => {
      const v = Math.max(0, Math.min(10, Number(scores[k as keyof typeof DIM_LABELS] ?? 0)));
      const rowY = startY + i * 14;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...color(TEXT));
      doc.text(DIM_LABELS[k], colX, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...color(MUTED));
      doc.text(`${v.toFixed(1)}/10`, colX + 78, rowY, { align: 'right' });
      // bar
      doc.setFillColor(...color(SOFT));
      doc.roundedRect(colX, rowY + 2, 78, 4, 1.5, 1.5, 'F');
      const c = dimColor(k, v);
      const filled = HIGHER_IS_WORSE.has(k) ? (10 - v) / 10 : v / 10;
      doc.setFillColor(...color(c));
      doc.roundedRect(colX, rowY + 2, Math.max(1.5, filled * 78), 4, 1.5, 1.5, 'F');
    });
  };
  drawCol(left, x + 8, y + 26);
  drawCol(right, x + 96, y + 26);
}

function drawDriverCard(doc: jsPDF, x: number, y: number, driver: PDFMyIDPacienteData['driverPrimario']) {
  doc.setFillColor(...color(NAVY));
  doc.roundedRect(x, y, 182, 30, 4, 4, 'F');
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...color(SOFT));
  doc.text('SEU PRINCIPAL PONTO DE ATENÇÃO', x + 8, y + 9);

  const dim = driver?.dimensao ? (DIM_LABELS[driver.dimensao] || driver.dimensao) : 'Equilíbrio geral';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...color(WHITE));
  doc.text(dim, x + 8, y + 18);

  if (driver?.descricao) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...color(SOFT));
    const lines = doc.splitTextToSize(driver.descricao, 168);
    doc.text(lines.slice(0, 1), x + 8, y + 26);
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...color(SOFT));
    doc.text('Pequenos ajustes nesta área têm o maior impacto no seu MyID.', x + 8, y + 26);
  }
}

function drawFases(doc: jsPDF, startY: number, fases: NonNullable<PDFMyIDPacienteData['fases']>): number {
  let y = startY;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...color(NAVY));
  doc.text('Seu plano em 3 fases', 14, y);
  y += 6;

  fases.slice(0, 3).forEach((f, i) => {
    y = ensureSpace(doc, y, 30);
    // numbered badge
    doc.setFillColor(...color(GOLD));
    doc.circle(20, y + 6, 4.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...color(WHITE));
    doc.text(`${i + 1}`, 20, y + 7.5, { align: 'center' });

    doc.setTextColor(...color(NAVY));
    doc.setFontSize(11);
    doc.text(f.titulo, 28, y + 5);
    if (f.descricao) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...color(MUTED));
      const lines = doc.splitTextToSize(f.descricao, 168);
      doc.text(lines.slice(0, 3), 28, y + 11);
      y += 11 + Math.min(3, lines.length) * 4;
    } else {
      y += 11;
    }
    if (f.foco && f.foco.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...color(GOLD));
      doc.text(`Foco: ${f.foco.slice(0, 3).join(' • ')}`, 28, y);
      y += 6;
    }
    y += 4;
  });
  return y;
}

function drawMissoes(doc: jsPDF, startY: number, missoes: NonNullable<PDFMyIDPacienteData['missoes']>): number {
  let y = ensureSpace(doc, startY, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...color(NAVY));
  doc.text('Missões prioritárias da semana', 14, y);
  y += 6;

  const top = missoes.slice(0, 6);
  top.forEach((m) => {
    y = ensureSpace(doc, y, 18);
    doc.setFillColor(...color(WHITE));
    doc.setDrawColor(...color(SOFT));
    doc.roundedRect(14, y, 182, 16, 3, 3, 'FD');
    // category dot
    const cat = (m.categoria || '').toLowerCase();
    const dot: C3 = cat.includes('urg') ? RED : cat.includes('opor') ? GREEN : AMBER;
    doc.setFillColor(...color(dot));
    doc.circle(20, y + 8, 1.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...color(TEXT));
    doc.text(m.titulo, 26, y + 6);
    if (m.descricao) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...color(MUTED));
      const lines = doc.splitTextToSize(m.descricao, 140);
      doc.text(lines.slice(0, 1), 26, y + 12);
    }
    if (m.xp) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...color(GOLD));
      doc.text(`+${m.xp} XP`, 192, y + 10, { align: 'right' });
    }
    y += 19;
  });
  return y;
}

function drawAssinatura(doc: jsPDF, data: PDFMyIDPacienteData) {
  const y = 250;
  doc.setDrawColor(...color(SOFT));
  doc.setLineWidth(0.3);
  doc.line(14, y, 196, y);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(9);
  doc.setTextColor(...color(MUTED));
  doc.text(
    'Este relatório é informativo e foi gerado para apoiar o diálogo com seu profissional de saúde.',
    14, y + 6,
  );
  doc.text(
    'Não substitui consulta, diagnóstico ou tratamento.',
    14, y + 11,
  );
  if (data.profissionalNome) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...color(TEXT));
    doc.text(`Acompanhamento: ${data.profissionalNome}`, 14, y + 19);
  }
}

export async function gerarPDFMyIDPaciente(data: PDFMyIDPacienteData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  paintBackground(doc);

  const dataFmt = (() => {
    try {
      const d = new Date(data.dataAvaliacao);
      if (!isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    } catch { /* */ }
    return data.dataAvaliacao;
  })();

  await drawHeader(doc, `Olá, ${data.pacienteNome.split(' ')[0] || data.pacienteNome}`,
    `Seu resultado MyID • ${dataFmt}`);

  let y = 38;
  drawScoreGauge(doc, 14, y, data.myidScore, data.classificacao);
  y += 54;
  drawDriverCard(doc, 14, y, data.driverPrimario);
  y += 36;
  drawFingerprint(doc, 14, y, data.scores);
  y += 116;

  if (data.fases && data.fases.length > 0) {
    y = ensureSpace(doc, y, 20);
    y = drawFases(doc, y, data.fases);
  }
  if (data.missoes && data.missoes.length > 0) {
    y = ensureSpace(doc, y + 4, 30);
    y = drawMissoes(doc, y, data.missoes);
  }

  drawAssinatura(doc, data);

  // Footer on every page
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawFooter(doc, i, total);
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
