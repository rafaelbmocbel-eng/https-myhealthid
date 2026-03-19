import jsPDF from 'jspdf';
import { addLogoToDoc } from './pdfLogoHelper';

export interface PDFEstiloVidaItem {
  label: string;
  status: 'critico' | 'alerta' | 'ok';
  mensagem: string;
  recomendacao: string;
}

export interface PDFTratamentoTecnica {
  nome: string;
  categoria: string;
  descricao?: string;
  nivelEvidencia?: string;
  complexidade?: string;
  indicacoes?: string;
  contraindicacoes?: string;
  observacoes?: string;
}

export interface PDFAvaliacaoData {
  pacienteNome: string;
  terapeutaNome: string;
  dataAvaliacao: string;
  idFinal: number;
  classificacao: string;
  scores: { E: number; P: number; C: number; F: number; D: number; R: number; EFI: number };
  regulacao: { R1: number; R2: number; R3: number };
  equacaoDor: { total: number; sensorio: number; afetiva: number; cognitiva: number; neurovegetativa: number; estiloVida: number };
  amplificadores: Array<{ desc: string; pontos: number }>;
  unidadesCriticas: Array<{ id: string; nome: string; score: number; topTecido: string; topTecidoScore: number }>;
  diagnostico: string;
  recomendacoes: string[];
  frequencia: string;
  duracao: string;
  probSucesso: string;
  diretrizesTecnicas: Array<{ ucId: string; ucNome: string; score: number; tecidos: Array<{ nome: string; score: number; tecnica: string }> }>;
  estiloVidaAlertas?: PDFEstiloVidaItem[];
  tratamentosPorFase?: Record<number, PDFTratamentoTecnica[]>;
  objetivoGeral?: string;
  perfilDominante?: string[];
  prognose?: string;
}

// Colors
const NAVY = [28, 55, 83] as const;     // hsl(213 55% 22%)
const GOLD = [234, 170, 20] as const;    // hsl(40 95% 52%)
const DARK = [25, 35, 50] as const;
const GRAY = [100, 110, 125] as const;
const LIGHT = [243, 244, 248] as const;
const WHITE = [255, 255, 255] as const;
const RED = [220, 50, 50] as const;
const GREEN = [34, 160, 80] as const;
const AMBER = [240, 160, 20] as const;
const ORANGE = [240, 120, 40] as const;

type C3 = readonly [number, number, number];

// Logo My Health ID — uses the actual app logo image
async function drawLogo(doc: jsPDF, x: number, y: number, size: number) {
  await addLogoToDoc(doc, x, y, size);
}

function checkPage(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > 275) { doc.addPage(); return margin + 5; }
  return y;
}

function severityColor(val: number): C3 {
  if (val <= 3) return GREEN;
  if (val <= 6) return AMBER;
  if (val <= 8) return ORANGE;
  return RED;
}

function classColor(cls: string): C3 {
  switch (cls) {
    case 'LEVE': return GREEN;
    case 'MODERADO': return AMBER;
    case 'SEVERO': return ORANGE;
    case 'CRÍTICO': case 'EXTREMO': return RED;
    default: return GRAY;
  }
}

function drawBar(doc: jsPDF, x: number, y: number, w: number, h: number, pct: number, color: C3) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  if (pct > 0) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, Math.max(h, w * Math.min(1, pct)), h, h / 2, h / 2, 'F');
  }
}

function drawGauge(doc: jsPDF, cx: number, cy: number, value: number, max: number, cls: string) {
  const r = 28;
  const segments = 40;
  const startDeg = 225;
  const totalDeg = 270;
  const pct = Math.min(1, value / max);

  // Background arc
  for (let i = 0; i < segments; i++) {
    const a1 = ((startDeg - (totalDeg * i / segments)) * Math.PI) / 180;
    const a2 = ((startDeg - (totalDeg * (i + 1) / segments)) * Math.PI) / 180;
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(4);
    doc.line(cx + r * Math.cos(a1), cy - r * Math.sin(a1), cx + r * Math.cos(a2), cy - r * Math.sin(a2));
  }

  // Value arc
  const filledSegs = Math.floor(pct * segments);
  const color = classColor(cls);
  for (let i = 0; i < filledSegs; i++) {
    const a1 = ((startDeg - (totalDeg * i / segments)) * Math.PI) / 180;
    const a2 = ((startDeg - (totalDeg * (i + 1) / segments)) * Math.PI) / 180;
    doc.setDrawColor(...color);
    doc.setLineWidth(4);
    doc.line(cx + r * Math.cos(a1), cy - r * Math.sin(a1), cx + r * Math.cos(a2), cy - r * Math.sin(a2));
  }

  // Value text
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(color as unknown as [number, number, number]));
  doc.text(value.toFixed(1), cx, cy + 2, { align: 'center' });

  // Classification
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(cls, cx, cy + 10, { align: 'center' });
}

function drawRadar(doc: jsPDF, cx: number, cy: number, data: Array<{ label: string; value: number }>, r: number) {
  const n = data.length;
  const angles = data.map((_, i) => (2 * Math.PI * i) / n - Math.PI / 2);

  // Grid circles
  [0.25, 0.5, 0.75, 1.0].forEach(frac => {
    const rr = r * frac;
    doc.setDrawColor(220, 222, 230);
    doc.setLineWidth(0.2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      doc.line(
        cx + rr * Math.cos(angles[i]), cy + rr * Math.sin(angles[i]),
        cx + rr * Math.cos(angles[j]), cy + rr * Math.sin(angles[j])
      );
    }
  });

  // Axis lines
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.15);
  angles.forEach(a => {
    doc.line(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a));
  });

  // Data polygon (filled)
  const pts = data.map((d, i) => {
    const pct = Math.min(1, d.value / 10);
    return { x: cx + r * pct * Math.cos(angles[i]), y: cy + r * pct * Math.sin(angles[i]) };
  });

  // Fill with semi-transparent
  doc.setFillColor(28, 55, 83);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);

  // Draw filled polygon manually line by line with fill opacity via setGState workaround — just draw outline
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    doc.line(pts[i].x, pts[i].y, pts[j].x, pts[j].y);
  }

  // Dots on vertices
  pts.forEach(pt => {
    doc.setFillColor(...NAVY);
    doc.circle(pt.x, pt.y, 1.2, 'F');
  });

  // Labels
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  data.forEach((d, i) => {
    const labelR = r + 8;
    const lx = cx + labelR * Math.cos(angles[i]);
    const ly = cy + labelR * Math.sin(angles[i]);
    doc.text(d.label, lx, ly + 1, { align: 'center' });
  });
}

export async function gerarPDFAvaliacao(data: PDFAvaliacaoData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 14;
  const CW = W - M * 2;
  let y = 0;

  // ═══════════════════════════════════════════════════════
  // PAGE 1 — COVER & MAIN SCORES
  // ═══════════════════════════════════════════════════════

  // Header band
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 48, 'F');

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 48, W, 2, 'F');

  // Logo & Title
  await drawLogo(doc, M, 10, 16);
  doc.setTextColor(...WHITE);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('MY HEALTH', M + 20, 18);
  doc.setTextColor(...GOLD);
  doc.text('ID', M + 62, 18);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 225);
  doc.text('Relatório de Avaliação Multidimensional da Dor', M + 20, 24);
  doc.setFontSize(8);
  doc.text(`${data.dataAvaliacao}  ·  Terapeuta: ${data.terapeutaNome}`, M + 20, 30);

  // ID Score on header
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.text('ID SCORE', W - M - 22, 14, { align: 'center' });
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(data.idFinal.toFixed(1), W - M - 22, 30, { align: 'center' });
  const cc = classColor(data.classificacao);
  doc.setFillColor(...cc);
  doc.roundedRect(W - M - 36, 33, 28, 8, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.text(data.classificacao, W - M - 22, 38.5, { align: 'center' });

  y = 58;

  // Patient info card
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, 18, 3, 3, 'F');
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(data.pacienteNome, M + 5, y + 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`Frequência: ${data.frequencia}  ·  Duração: ${data.duracao}  ·  Sucesso: ${data.probSucesso}`, M + 5, y + 14);
  y += 24;

  // Gauge + Radar side by side
  const gaugeX = M + CW * 0.22;
  const radarX = M + CW * 0.68;

  doc.setTextColor(...DARK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Índice de Dor (ID)', gaugeX, y, { align: 'center' });
  doc.text('Perfil Multidimensional', radarX, y, { align: 'center' });
  y += 5;

  drawGauge(doc, gaugeX, y + 32, data.idFinal, 60, data.classificacao);

  const radarItems = [
    { label: 'Estrutural', value: data.scores.E },
    { label: 'Comportam.', value: data.scores.P },
    { label: 'Contextual', value: data.scores.C },
    { label: 'Anamnese', value: data.scores.F },
    { label: 'Dor', value: data.scores.D },
    { label: 'Regulação', value: data.scores.R },
  ];
  drawRadar(doc, radarX, y + 30, radarItems, 24);

  y += 68;

  // ── Score bars ──
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Scores da Avaliação', M, y);
  y += 6;

  const scoreItems = [
    { label: 'E – Estrutural', value: data.scores.E, color: [59, 130, 246] as C3, desc: 'Comprometimento físico das estruturas corporais' },
    { label: 'P – Psico-Comportamental', value: data.scores.P, color: [220, 60, 100] as C3, desc: 'Medo do movimento, catastrofização e evitação' },
    { label: 'C – Carga Contextual', value: data.scores.C, color: [240, 120, 40] as C3, desc: 'Estresse laboral, financeiro e social' },
    { label: 'F – Fatores Biológicos', value: data.scores.F, color: [34, 160, 80] as C3, desc: 'Histórico médico, hábitos e comorbidades' },
    { label: 'D – Intensidade da Dor', value: data.scores.D, color: [160, 80, 220] as C3, desc: 'Nível de dor percebida e seus tipos' },
    { label: 'R – Regulação', value: data.scores.R, color: [70, 130, 180] as C3, desc: 'Qualidade do sono, energia e estado psicológico' },
    { label: 'EFI – Funcionalidade', value: data.scores.EFI, color: [20, 170, 160] as C3, desc: 'Capacidade funcional nas atividades diárias' },
  ];

  scoreItems.forEach(item => {
    y = checkPage(doc, y, 12, M);
    const barW = CW - 85;
    const barX = M + 55;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(item.label, M, y + 2.5);

    drawBar(doc, barX, y, barW, 4, item.value / 10, item.color as unknown as C3);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(item.color as unknown as [number, number, number]));
    doc.text(`${item.value.toFixed(1)}/10`, M + CW - 2, y + 3, { align: 'right' });

    y += 5;
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(item.desc, M + 2, y + 1.5);
    y += 6;
  });

  // ═══════════════════════════════════════════════════════
  // PAGE 2 — EQUAÇÃO DA DOR + REGULAÇÃO + UNIDADES
  // ═══════════════════════════════════════════════════════
  doc.addPage();
  y = M + 5;

  // Page header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 12, W, 1, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('MY HEALTH ID', M, 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Análise Detalhada  ·  ${data.pacienteNome}`, W - M, 8, { align: 'right' });

  y = 20;

  // ── Equação da Dor ──
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Equação da Dor — 5 Dimensões', M, y);
  y += 3;

  // Gold underline
  doc.setFillColor(...GOLD);
  doc.rect(M, y, 40, 0.8, 'F');
  y += 6;

  const dims = [
    { label: 'Sensório-Discriminativa', value: data.equacaoDor.sensorio, desc: 'Localização, tipo e intensidade da dor percebida' },
    { label: 'Afetiva-Motivacional', value: data.equacaoDor.afetiva, desc: 'Impacto emocional: medo, ansiedade, catastrofização' },
    { label: 'Cognitiva-Avaliativa', value: data.equacaoDor.cognitiva, desc: 'Crenças sobre a dor e expectativas de recuperação' },
    { label: 'Neurovegetativa', value: data.equacaoDor.neurovegetativa, desc: 'Sono, energia, sistema nervoso autônomo' },
    { label: 'Estilo de Vida', value: data.equacaoDor.estiloVida, desc: 'Sedentarismo, hábitos, comorbidades e cronificação' },
  ];

  const dimW = (CW - 12) / 5;
  dims.forEach((dim, i) => {
    const dx = M + i * (dimW + 3);
    const sc = severityColor(dim.value);

    doc.setFillColor(245, 246, 250);
    doc.roundedRect(dx, y, dimW, 30, 2, 2, 'F');

    doc.setFontSize(5.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GRAY);
    doc.text(dim.label, dx + dimW / 2, y + 5, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(sc as unknown as [number, number, number]));
    doc.text(dim.value.toFixed(1), dx + dimW / 2, y + 16, { align: 'center' });

    drawBar(doc, dx + 3, y + 20, dimW - 6, 2.5, dim.value / 10, sc as unknown as C3);

    doc.setFontSize(4.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const lines = doc.splitTextToSize(dim.desc, dimW - 4);
    doc.text(lines, dx + dimW / 2, y + 27, { align: 'center' });
  });

  // Total
  const totalColor = severityColor(data.equacaoDor.total);
  doc.setFillColor(...(totalColor as unknown as [number, number, number]));
  doc.roundedRect(M + CW - 30, y - 5, 30, 10, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total: ${data.equacaoDor.total.toFixed(1)}`, M + CW - 15, y + 1, { align: 'center' });

  y += 40;

  // ── Regulação Neurovegetativa ──
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Estado Neurovegetativo', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 35, 0.8, 'F');
  y += 8;

  const regItems = [
    { label: 'Sono (R1)', value: data.regulacao.R1, icon: '🌙', desc: 'Qualidade, duração e fragmentação do sono' },
    { label: 'Energia (R2)', value: data.regulacao.R2, icon: '⚡', desc: 'Fadiga diurna, motivação e resistência física' },
    { label: 'Psicológico (R3)', value: data.regulacao.R3, icon: '🧠', desc: 'Stress, humor, concentração e controle' },
  ];

  const regW = (CW - 8) / 3;
  regItems.forEach((item, i) => {
    const rx = M + i * (regW + 4);
    const sc = severityColor(item.value);

    doc.setFillColor(245, 246, 250);
    doc.roundedRect(rx, y, regW, 28, 2, 2, 'F');

    doc.setFontSize(11);
    doc.text(item.icon, rx + regW / 2, y + 7, { align: 'center' });

    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(sc as unknown as [number, number, number]));
    doc.text(item.value.toFixed(1), rx + regW / 2, y + 17, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(item.label, rx + regW / 2, y + 22, { align: 'center' });

    drawBar(doc, rx + 4, y + 24, regW - 8, 2, item.value / 10, sc as unknown as C3);
  });

  y += 36;

  // Score R global
  doc.setFillColor(245, 246, 250);
  doc.roundedRect(M, y, CW, 10, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Score R (Global)', M + 4, y + 6.5);
  drawBar(doc, M + 45, y + 3, CW - 75, 4, data.scores.R / 10, severityColor(data.scores.R) as unknown as C3);
  doc.setTextColor(...(severityColor(data.scores.R) as unknown as [number, number, number]));
  doc.text(`${data.scores.R.toFixed(1)}/10`, M + CW - 4, y + 6.5, { align: 'right' });
  y += 16;

  // ── Unidades Corporais Críticas ──
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Unidades Corporais Críticas – Top 3', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 45, 0.8, 'F');
  y += 8;

  data.unidadesCriticas.forEach((uc, i) => {
    y = checkPage(doc, y, 18, M);
    const isFirst = i === 0;

    doc.setFillColor(isFirst ? 255 : 248, isFirst ? 240 : 249, isFirst ? 240 : 252);
    doc.roundedRect(M, y, CW, 15, 2, 2, 'F');
    if (isFirst) {
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.5);
      doc.roundedRect(M, y, CW, 15, 2, 2, 'S');
    }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(`#${i + 1}`, M + 5, y + 9);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(`${uc.id} – ${uc.nome}`, M + 16, y + 6);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`Tecido principal: ${uc.topTecido} (${uc.topTecidoScore.toFixed(1)})`, M + 16, y + 11);

    const sc = severityColor(uc.score);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(sc as unknown as [number, number, number]));
    doc.text(`${uc.score.toFixed(1)}`, M + CW - 8, y + 9, { align: 'right' });

    y += 18;
  });

  // ── Diagnóstico ──
  y = checkPage(doc, y + 4, 20, M);
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, 16, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('Diagnóstico Clínico:', M + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  const diagLines = doc.splitTextToSize(data.diagnostico, CW - 10);
  doc.text(diagLines, M + 4, y + 11);
  y += 22;

  // ═══════════════════════════════════════════════════════
  // PAGE 3 — TRATAMENTO + LEGENDA
  // ═══════════════════════════════════════════════════════
  doc.addPage();
  y = M + 5;

  // Page header
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 12, W, 1, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('MY HEALTH ID', M, 8);
  doc.text(`Plano de Tratamento  ·  ${data.pacienteNome}`, W - M, 8, { align: 'right' });

  y = 20;

  // ── Fatores de Risco ──
  if (data.amplificadores.length > 0) {
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Fatores de Risco Amplificadores', M, y);
    doc.setFillColor(...GOLD);
    doc.rect(M, y + 2, 42, 0.8, 'F');
    y += 8;

    data.amplificadores.forEach(a => {
      y = checkPage(doc, y, 7, M);
      doc.setFillColor(255, 248, 235);
      doc.roundedRect(M, y, CW, 6, 1.5, 1.5, 'F');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(180, 100, 20);
      doc.text(`⚠ ${a.desc}`, M + 3, y + 4);
      doc.setFont('helvetica', 'bold');
      doc.text(`+${a.pontos}`, M + CW - 5, y + 4, { align: 'right' });
      y += 8;
    });
    y += 4;
  }

  // ── Recomendações ──
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Recomendações Terapêuticas', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 40, 0.8, 'F');
  y += 8;

  data.recomendacoes.forEach(rec => {
    y = checkPage(doc, y, 6, M);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.text(`•  ${rec}`, M + 3, y + 3);
    y += 6;
  });
  y += 6;

  // ── Diretrizes por UC ──
  if (data.diretrizesTecnicas.length > 0) {
    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Diretrizes por Unidade Corporal', M, y);
    doc.setFillColor(...GOLD);
    doc.rect(M, y + 2, 42, 0.8, 'F');
    y += 8;

    data.diretrizesTecnicas.forEach(uc => {
      y = checkPage(doc, y, 20, M);

      doc.setFillColor(...LIGHT);
      doc.roundedRect(M, y, CW, 5, 1.5, 1.5, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(`${uc.ucId} – ${uc.ucNome}`, M + 3, y + 3.5);
      const sc = severityColor(uc.score);
      doc.setTextColor(...(sc as unknown as [number, number, number]));
      doc.text(`${uc.score.toFixed(1)}/10`, M + CW - 3, y + 3.5, { align: 'right' });
      y += 7;

      uc.tecidos.forEach(t => {
        y = checkPage(doc, y, 6, M);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...GRAY);
        doc.text(`${t.nome} (${t.score.toFixed(0)})`, M + 6, y + 3);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK);
        doc.text(`→ ${t.tecnica}`, M + 35, y + 3);
        y += 5;
      });
      y += 4;
    });
  }

  // ═══════════════════════════════════════════════════════
  // MARCADORES DE ESTILO DE VIDA
  // ═══════════════════════════════════════════════════════
  if (data.estiloVidaAlertas && data.estiloVidaAlertas.length > 0) {
    y = checkPage(doc, y + 4, 40, M);

    doc.setTextColor(...DARK);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Marcadores de Estilo de Vida', M, y);
    doc.setFillColor(...GOLD);
    doc.rect(M, y + 2, 40, 0.8, 'F');
    y += 8;

    const statusColors: Record<string, { bg: [number, number, number]; text: [number, number, number]; label: string }> = {
      critico: { bg: [255, 235, 235], text: [180, 40, 40], label: '⚠ Necessita ação' },
      alerta: { bg: [255, 248, 230], text: [180, 120, 20], label: '⚡ Melhorar' },
      ok: { bg: [235, 255, 240], text: [30, 130, 60], label: '✓ Adequado' },
    };

    data.estiloVidaAlertas.forEach(alerta => {
      y = checkPage(doc, y, 14, M);
      const sc = statusColors[alerta.status] || statusColors.ok;

      doc.setFillColor(...sc.bg);
      doc.roundedRect(M, y, CW, 12, 2, 2, 'F');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...sc.text);
      doc.text(`${alerta.label}  —  ${sc.label}`, M + 4, y + 4.5);

      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.text(alerta.mensagem, M + 4, y + 8.5);
      doc.setTextColor(...GRAY);
      doc.text(`💡 ${alerta.recomendacao}`, M + CW / 2, y + 8.5);

      y += 14;
    });
    y += 2;
  }

  // ═══════════════════════════════════════════════════════
  // DIRETRIZ DE TRATAMENTO SALVA (TÉCNICAS POR FASE)
  // ═══════════════════════════════════════════════════════
  if (data.tratamentosPorFase && Object.keys(data.tratamentosPorFase).length > 0) {
    doc.addPage();
    y = M + 5;

    // Page header
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 12, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 12, W, 1, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('MY HEALTH ID', M, 8);
    doc.text(`Diretriz de Tratamento  ·  ${data.pacienteNome}`, W - M, 8, { align: 'right' });

    y = 20;

    // Perfil e objetivo
    if (data.objetivoGeral) {
      doc.setTextColor(...DARK);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Diretriz de Tratamento Personalizada', M, y);
      doc.setFillColor(...GOLD);
      doc.rect(M, y + 2, 50, 0.8, 'F');
      y += 8;

      doc.setFillColor(...LIGHT);
      doc.roundedRect(M, y, CW, 14, 2, 2, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text('Objetivo:', M + 4, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      const objLines = doc.splitTextToSize(data.objetivoGeral, CW - 30);
      doc.text(objLines, M + 22, y + 5);
      if (data.perfilDominante && data.perfilDominante.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text('Perfil:', M + 4, y + 10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.text(data.perfilDominante.map(p => p.replace(/_/g, ' ')).join(', '), M + 22, y + 10);
      }
      y += 18;
    }

    const FASE_NOMES_PDF = ['Controle & Proteção', 'Mobilização & Proliferação', 'Remodelação & Força', 'Funcionalidade & Retorno'];
    const FASE_CORES_PDF: C3[] = [[99, 102, 241], [245, 158, 11], [16, 185, 129], [239, 68, 68]];

    const CAT_ICONS: Record<string, string> = {
      terapia_manual: '🖐️', eletroterapia: '⚡', exercicio_respiratorio: '🫁',
      tracao: '🔗', outros: '🧊',
    };

    const EVID_LABELS: Record<string, string> = { A: '●A', B: '●B', C: '●C' };

    [1, 2, 3, 4].forEach(faseNum => {
      const tecs = data.tratamentosPorFase![faseNum];
      if (!tecs || tecs.length === 0) return;
      const idx = faseNum - 1;
      const cor = FASE_CORES_PDF[idx];

      y = checkPage(doc, y, 16, M);

      // Phase header
      doc.setFillColor(...cor);
      doc.roundedRect(M, y, CW, 9, 2, 2, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`FASE ${faseNum} — ${FASE_NOMES_PDF[idx]}`, M + 4, y + 6);
      doc.text(`${tecs.length} técnica${tecs.length !== 1 ? 's' : ''}`, W - M - 4, y + 6, { align: 'right' });
      y += 12;

      // Group by category
      const porCat: Record<string, PDFTratamentoTecnica[]> = {};
      tecs.forEach(t => {
        const cat = t.categoria || 'outros';
        if (!porCat[cat]) porCat[cat] = [];
        porCat[cat].push(t);
      });

      Object.entries(porCat).forEach(([cat, items]) => {
        y = checkPage(doc, y, 10, M);
        const icon = CAT_ICONS[cat] || '🔧';
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text(`${icon} ${cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`, M + 2, y + 3);
        y += 6;

        items.forEach(tec => {
          y = checkPage(doc, y, 14, M);

          doc.setFillColor(248, 250, 255);
          doc.roundedRect(M + 2, y, CW - 4, 12, 1.5, 1.5, 'F');

          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...DARK);
          doc.text(tec.nome, M + 5, y + 4);

          // Badges
          const badges: string[] = [];
          if (tec.nivelEvidencia) badges.push(EVID_LABELS[tec.nivelEvidencia] || tec.nivelEvidencia);
          if (tec.complexidade) badges.push(tec.complexidade);
          if (badges.length > 0) {
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...GRAY);
            doc.text(badges.join(' · '), W - M - 6, y + 4, { align: 'right' });
          }

          // Description
          if (tec.descricao) {
            doc.setFontSize(6);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...GRAY);
            const descLines = doc.splitTextToSize(tec.descricao, CW - 14);
            doc.text(descLines.slice(0, 1), M + 5, y + 8);
          }

          if (tec.indicacoes) {
            doc.setFontSize(5.5);
            doc.setTextColor(...(GREEN as unknown as [number, number, number]));
            doc.text(`✓ ${tec.indicacoes}`.slice(0, 90), M + 5, y + 11);
          }

          y += 14;
        });
        y += 2;
      });
      y += 4;
    });

    // Prognose
    if (data.prognose) {
      y = checkPage(doc, y, 12, M);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(M, y, CW, 10, 2, 2, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text('Prognose:', M + 4, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(data.prognose, M + 25, y + 6);
      y += 14;
    }
  }

  // ═══════════════════════════════════════════════════════
  // PLANO DE TRATAMENTO RECOMENDADO
  // ═══════════════════════════════════════════════════════
  y = checkPage(doc, y + 6, 80, M);

  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Plano de Tratamento Recomendado', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 48, 0.8, 'F');
  y += 10;

  // Frases motivacionais profissionais
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, CW, 18, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('A sua saúde é o seu bem mais valioso.', M + CW / 2, y + 5.5, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 225);
  doc.text('Investir no tratamento hoje é garantir qualidade de vida e funcionalidade no futuro.', M + CW / 2, y + 11, { align: 'center' });
  doc.text('O acompanhamento profissional regular é essencial para resultados duradouros.', M + CW / 2, y + 15.5, { align: 'center' });
  y += 24;

  // Opção 3x/semana
  const optionW = (CW - 6) / 2;

  // Option 1: 3x/semana (Recomendado)
  doc.setFillColor(234, 170, 20);
  doc.roundedRect(M, y, optionW, 42, 3, 3, 'F');
  doc.setTextColor(...DARK);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('⭐ RECOMENDADO', M + optionW / 2, y + 5, { align: 'center' });
  doc.setFontSize(14);
  doc.text('3× por semana', M + optionW / 2, y + 14, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 60, 10);
  doc.text('Recuperação acelerada', M + optionW / 2, y + 20, { align: 'center' });
  doc.text('Resultados mais rápidos e consistentes', M + optionW / 2, y + 25, { align: 'center' });
  doc.text('Menor risco de recidivas', M + optionW / 2, y + 30, { align: 'center' });
  doc.text('Monitoramento intensivo contínuo', M + optionW / 2, y + 35, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(`Duração estimada: ${data.duracao || '8-10 semanas'}`, M + optionW / 2, y + 40, { align: 'center' });

  // Option 2: 2x/semana
  const ox2 = M + optionW + 6;
  doc.setFillColor(245, 248, 255);
  doc.roundedRect(ox2, y, optionW, 42, 3, 3, 'F');
  doc.setDrawColor(200, 210, 230);
  doc.setLineWidth(0.5);
  doc.roundedRect(ox2, y, optionW, 42, 3, 3, 'S');
  doc.setTextColor(...DARK);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('ALTERNATIVA', ox2 + optionW / 2, y + 5, { align: 'center' });
  doc.setFontSize(14);
  doc.text('2× por semana', ox2 + optionW / 2, y + 14, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Recuperação progressiva', ox2 + optionW / 2, y + 20, { align: 'center' });
  doc.text('Resultados sustentáveis', ox2 + optionW / 2, y + 25, { align: 'center' });
  doc.text('Flexibilidade para rotina do paciente', ox2 + optionW / 2, y + 30, { align: 'center' });
  doc.text('Acompanhamento regular', ox2 + optionW / 2, y + 35, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.text(`Duração estimada: ${data.duracao ? '10-14 semanas' : '12-16 semanas'}`, ox2 + optionW / 2, y + 40, { align: 'center' });

  y += 48;

  // Frases profissionais sobre valor do tratamento
  y = checkPage(doc, y, 25, M);
  doc.setFillColor(248, 250, 255);
  doc.roundedRect(M, y, CW, 22, 3, 3, 'F');
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, CW, 22, 3, 3, 'S');

  doc.setTextColor(...NAVY);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Por que o tratamento contínuo é essencial?', M + 5, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.setFontSize(6.5);
  const valorTextos = [
    '• A consistência no tratamento potencializa os resultados em até 70% comparado a atendimentos esporádicos.',
    '• A fisioterapia baseada em evidências atua nas causas, não apenas nos sintomas, promovendo saúde a longo prazo.',
    '• Cada sessão é desenhada de forma progressiva para maximizar ganhos funcionais e qualidade de vida.',
  ];
  valorTextos.forEach((txt, i) => {
    doc.text(txt, M + 5, y + 10 + i * 4);
  });
  y += 28;

  // Diretrizes de atendimento
  y = checkPage(doc, y, 35, M);
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Diretrizes de Atendimento', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 38, 0.8, 'F');
  y += 8;

  const diretrizes = [
    { titulo: 'Avaliação Contínua', desc: 'Reavaliações periódicas para ajuste das condutas terapêuticas conforme evolução clínica.' },
    { titulo: 'Educação em Saúde', desc: 'Orientações sobre prevenção, postura, ergonomia e hábitos que favorecem a recuperação.' },
    { titulo: 'Exercícios Domiciliares', desc: 'Prescrição personalizada de exercícios para realização nos dias sem sessão presencial.' },
    { titulo: 'Progressão Individualizada', desc: 'Avanço das fases terapêuticas baseado em critérios clínicos objetivos de cada paciente.' },
  ];

  diretrizes.forEach(d => {
    y = checkPage(doc, y, 10, M);
    doc.setFillColor(248, 249, 252);
    doc.roundedRect(M, y, CW, 9, 2, 2, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(d.titulo, M + 4, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.setFontSize(6);
    doc.text(d.desc, M + 4, y + 7.5);
    y += 11;
  });
  y += 4;

  // ── Escala Educativa — O que cada faixa significa ──
  y = checkPage(doc, y + 2, 65, M);

  doc.setFillColor(245, 248, 255);
  doc.roundedRect(M, y, CW, 62, 3, 3, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  doc.text('O que cada faixa do ID Final significa para você?', M + 5, y + 7);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('A Equação da Dor (ID Final) mede o impacto total da dor na sua vida, de 0 a 50 pontos.', M + 5, y + 13);

  const faixasEducativas = [
    { color: GREEN, faixa: 'LEVE (0–10)', desc: 'Bom estado geral. Queixas pontuais que não afetam atividades. Continue cuidando preventivamente.', active: data.classificacao === 'LEVE' },
    { color: AMBER, faixa: 'MODERADO (10–20)', desc: 'Algumas limitações presentes. Tratamento adequado pode resolver rapidamente. Momento ideal para agir.', active: data.classificacao === 'MODERADO' },
    { color: ORANGE, faixa: 'SEVERO (20–30)', desc: 'A dor impacta várias áreas. Importante iniciar tratamento com disciplina e consistência.', active: data.classificacao === 'SEVERO' },
    { color: RED, faixa: 'CRÍTICO (30–40)', desc: 'Comprometimento elevado. Múltiplas dimensões afetadas. Tratamento prioritário recomendado.', active: data.classificacao === 'CRÍTICO' },
    { color: [148, 51, 234] as C3, faixa: 'EXTREMO (40–50)', desc: 'Atenção imediata necessária. Encaminhamento médico e acompanhamento multidisciplinar.', active: data.classificacao === 'EXTREMO' },
  ];

  faixasEducativas.forEach((item, i) => {
    const ly = y + 19 + i * 9;
    const isActive = item.active;

    if (isActive) {
      doc.setFillColor(...(item.color as unknown as [number, number, number]));
      doc.roundedRect(M + 3, ly - 3.5, CW - 6, 8, 2, 2, 'F');
      doc.setTextColor(...WHITE);
    } else {
      doc.setFillColor(...(item.color as unknown as [number, number, number]));
      doc.circle(M + 8, ly, 1.5, 'F');
      doc.setTextColor(...DARK);
    }

    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(item.faixa + (isActive ? '  ← Você está aqui' : ''), isActive ? M + 6 : M + 13, ly + 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    if (isActive) doc.setTextColor(255, 255, 255);
    else doc.setTextColor(...GRAY);
    doc.text(item.desc, isActive ? M + 6 : M + 13, ly + (isActive ? 4 : 4.5));
  });

  y += 68;

  // ── Footer on all pages ──
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, 287, W, 10, 'F');
    doc.setFontSize(6);
    doc.setTextColor(180, 200, 225);
    doc.setFont('helvetica', 'bold');
    doc.text('MY HEALTH ID', M, 292);
    doc.setFont('helvetica', 'normal');
    doc.text('·  Relatório de Avaliação  ·  Documento confidencial', M + 18, 292);
    doc.text(`Página ${i} de ${totalPages}`, W - M, 292, { align: 'right' });
  }

  doc.save(`MyHealthID_Avaliacao_${data.pacienteNome.replace(/\s+/g, '_')}_${data.dataAvaliacao.replace(/\//g, '-')}.pdf`);
}
