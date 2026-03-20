import jsPDF from 'jspdf';
import type { EvolucaoRecord } from '@/hooks/useEvolucaoPaciente';

// ── Colors ────────────────────────────────────────────────────────
const NAVY = [28, 55, 83] as const;
const GOLD = [234, 170, 20] as const;
const DARK = [25, 35, 50] as const;
const GRAY = [100, 110, 125] as const;
const LIGHT = [243, 244, 248] as const;
const WHITE = [255, 255, 255] as const;
const RED_C = [220, 50, 50] as const;
const GREEN_C = [34, 160, 80] as const;
const AMBER_C = [240, 160, 20] as const;
const ORANGE_C = [240, 120, 40] as const;

type C3 = readonly [number, number, number];

const SCORE_LABELS: Record<string, string> = {
  score_e: 'Estrutural', score_p: 'Cinesiofobia', score_c: 'Contextual',
  score_f: 'Funcional', score_d: 'Dor', score_r: 'Regulação', score_efi: 'Funcionalidade',
};
const SCORE_KEYS = ['score_e', 'score_p', 'score_c', 'score_f', 'score_d', 'score_r', 'score_efi'];
const SCORE_COLORS: Record<string, C3> = {
  score_e: [59, 130, 246], score_p: [245, 158, 11], score_c: [6, 182, 212],
  score_f: [16, 185, 129], score_d: [239, 68, 68], score_r: [139, 92, 246], score_efi: [236, 72, 153],
};

function severityColor(val: number): C3 {
  if (val <= 15) return GREEN_C;
  if (val <= 30) return AMBER_C;
  if (val <= 40) return ORANGE_C;
  return RED_C;
}

function checkPage(doc: jsPDF, y: number, needed: number, margin: number): number {
  if (y + needed > 275) { doc.addPage(); addPageHeader(doc); return 20; }
  return y;
}

function addPageHeader(doc: jsPDF) {
  const W = 210;
  const M = 14;
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 12, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 12, W, 1, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('MY HEALTH ID — Relatório de Evolução', M, 8);
}

function drawBar(doc: jsPDF, x: number, y: number, w: number, h: number, pct: number, color: C3) {
  doc.setFillColor(...LIGHT);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F');
  if (pct > 0) {
    doc.setFillColor(...color);
    doc.roundedRect(x, y, Math.max(h, w * Math.min(1, pct)), h, h / 2, h / 2, 'F');
  }
}

function drawRadarDual(
  doc: jsPDF, cx: number, cy: number,
  data1: Array<{ label: string; value: number }>,
  data2: Array<{ label: string; value: number }>,
  r: number
) {
  const n = data1.length;
  const angles = data1.map((_, i) => (2 * Math.PI * i) / n - Math.PI / 2);

  // Grid
  [0.25, 0.5, 0.75, 1.0].forEach(frac => {
    const rr = r * frac;
    doc.setDrawColor(220, 222, 230);
    doc.setLineWidth(0.2);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      doc.line(cx + rr * Math.cos(angles[i]), cy + rr * Math.sin(angles[i]),
        cx + rr * Math.cos(angles[j]), cy + rr * Math.sin(angles[j]));
    }
  });

  // Axes
  doc.setDrawColor(200, 205, 215);
  doc.setLineWidth(0.15);
  angles.forEach(a => doc.line(cx, cy, cx + r * Math.cos(a), cy + r * Math.sin(a)));

  // Data1 polygon (primeira - dashed gray)
  const pts1 = data1.map((d, i) => {
    const pct = Math.min(1, d.value / 10);
    return { x: cx + r * pct * Math.cos(angles[i]), y: cy + r * pct * Math.sin(angles[i]) };
  });
  doc.setDrawColor(160, 165, 175);
  doc.setLineWidth(0.6);
  for (let i = 0; i < pts1.length; i++) {
    const j = (i + 1) % pts1.length;
    doc.line(pts1[i].x, pts1[i].y, pts1[j].x, pts1[j].y);
  }

  // Data2 polygon (atual - navy)
  const pts2 = data2.map((d, i) => {
    const pct = Math.min(1, d.value / 10);
    return { x: cx + r * pct * Math.cos(angles[i]), y: cy + r * pct * Math.sin(angles[i]) };
  });
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1);
  for (let i = 0; i < pts2.length; i++) {
    const j = (i + 1) % pts2.length;
    doc.line(pts2[i].x, pts2[i].y, pts2[j].x, pts2[j].y);
  }
  pts2.forEach(pt => { doc.setFillColor(...NAVY); doc.circle(pt.x, pt.y, 1.2, 'F'); });

  // Labels
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...DARK);
  data1.forEach((d, i) => {
    const lx = cx + (r + 8) * Math.cos(angles[i]);
    const ly = cy + (r + 8) * Math.sin(angles[i]);
    doc.text(d.label, lx, ly + 1, { align: 'center' });
  });
}

export interface PDFEvolucaoData {
  pacienteNome: string;
  terapeutaNome: string;
  dataEmissao: string;
  evolucoes: EvolucaoRecord[];
}

export async function gerarPDFEvolucao(data: PDFEvolucaoData): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 14;
  const CW = W - M * 2;

  const sorted = [...data.evolucoes].sort((a, b) => a.numero_avaliacao - b.numero_avaliacao);
  const primeira = sorted[0];
  const ultima = sorted[sorted.length - 1];
  const idFinalAtual = Number(ultima?.id_final ?? 0);
  const idFinalInicial = Number(primeira?.id_final ?? 0);
  const deltaID = Number((idFinalAtual - idFinalInicial).toFixed(1));
  const classificacao = ultima?.classificacao || '—';

  // ═════════════════════════════════════════════════════
  // HEADER
  // ═════════════════════════════════════════════════════
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 48, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 48, W, 2, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Evolução', M, 18);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 225);
  doc.text('MY HEALTH ID · Acompanhamento Longitudinal', M, 26);
  doc.setFontSize(8);
  doc.text(`${data.dataEmissao}  ·  Terapeuta: ${data.terapeutaNome}`, M, 33);

  // ID Final badge
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.text('ID ATUAL', W - M - 22, 14, { align: 'center' });
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(idFinalAtual.toFixed(1), W - M - 22, 30, { align: 'center' });
  const cc = severityColor(idFinalAtual);
  doc.setFillColor(...cc);
  doc.roundedRect(W - M - 36, 33, 28, 8, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.text(classificacao, W - M - 22, 38.5, { align: 'center' });

  let y = 58;

  // Patient card
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, 14, 3, 3, 'F');
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(data.pacienteNome, M + 5, y + 7);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(`${sorted.length} avaliações registradas`, M + 5, y + 12);
  y += 20;

  // ═════════════════════════════════════════════════════
  // SUMMARY CARDS
  // ═════════════════════════════════════════════════════
  const cardW = (CW - 9) / 4;
  const cards = [
    { label: 'Avaliações', value: `${sorted.length}` },
    { label: 'ID Final Atual', value: `${idFinalAtual.toFixed(1)}/50` },
    { label: 'Classificação', value: classificacao },
    { label: 'Variação ID', value: `${deltaID > 0 ? '+' : ''}${deltaID.toFixed(1)}` },
  ];

  cards.forEach((card, i) => {
    const cx = M + i * (cardW + 3);
    doc.setFillColor(245, 246, 250);
    doc.roundedRect(cx, y, cardW, 18, 2, 2, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(card.value, cx + cardW / 2, y + 9, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(card.label, cx + cardW / 2, y + 15, { align: 'center' });
  });
  y += 25;

  // ═════════════════════════════════════════════════════
  // RADAR — 1ª vs Última
  // ═════════════════════════════════════════════════════
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Perfil Comparativo: 1ª vs Última Avaliação', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 50, 0.8, 'F');
  y += 8;

  const radarLabels = SCORE_KEYS.slice(0, 6);
  const radar1 = radarLabels.map(k => ({ label: SCORE_LABELS[k], value: Number(((primeira as any)?.[k] || 0).toFixed(1)) }));
  const radar2 = radarLabels.map(k => ({ label: SCORE_LABELS[k], value: Number(((ultima as any)?.[k] || 0).toFixed(1)) }));
  drawRadarDual(doc, M + CW / 2, y + 30, radar1, radar2, 24);

  // Legend
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setDrawColor(160, 165, 175);
  doc.setLineWidth(0.5);
  doc.line(M + 5, y + 58, M + 12, y + 58);
  doc.setTextColor(...GRAY);
  doc.text('1ª Avaliação', M + 14, y + 59);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(1);
  doc.line(M + 45, y + 58, M + 52, y + 58);
  doc.text('Última Avaliação', M + 54, y + 59);
  y += 66;

  // ═════════════════════════════════════════════════════
  // DELTA POR SCORE
  // ═════════════════════════════════════════════════════
  y = checkPage(doc, y, 50, M);
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Variação por Dimensão (1ª → Última)', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 45, 0.8, 'F');
  y += 8;

  const barMaxW = CW - 80;
  SCORE_KEYS.forEach(key => {
    const first = Number(((primeira as any)?.[key] || 0).toFixed(1));
    const last = Number(((ultima as any)?.[key] || 0).toFixed(1));
    const delta = Number((last - first).toFixed(1));
    const color = SCORE_COLORS[key];

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(SCORE_LABELS[key], M, y + 3);

    drawBar(doc, M + 42, y, barMaxW, 4, last / 10, color as unknown as C3);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(color as unknown as [number, number, number]));
    doc.text(`${last}`, M + CW - 28, y + 3, { align: 'right' });

    // Delta
    const deltaColor = delta < 0 ? GREEN_C : delta > 0 ? RED_C : GRAY;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(deltaColor as unknown as [number, number, number]));
    doc.text(`${delta > 0 ? '▲+' : delta < 0 ? '▼' : '='}${Math.abs(delta).toFixed(1)}`, M + CW - 4, y + 3, { align: 'right' });

    y += 8;
  });

  y += 5;

  // ═════════════════════════════════════════════════════
  // EVOLUTION LINE (simplified text table)
  // ═════════════════════════════════════════════════════
  y = checkPage(doc, y, 20, M);
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Histórico de Avaliações', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 35, 0.8, 'F');
  y += 8;

  // Table header
  doc.setFillColor(...NAVY);
  doc.rect(M, y, CW, 7, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'bold');
  const cols = [M + 3, M + 12, M + 40, M + 60, M + 80, M + 100, M + 120, M + 140, M + 158];
  const headers = ['#', 'Data', 'ID Final', 'E', 'P', 'D', 'F', 'R', 'Δ ID'];
  headers.forEach((h, i) => doc.text(h, cols[i], y + 5));
  y += 9;

  sorted.forEach((ev, idx) => {
    y = checkPage(doc, y, 8, M);
    const isEven = idx % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 249, 252);
      doc.rect(M, y - 2, CW, 7, 'F');
    }

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DARK);
    doc.text(`${ev.numero_avaliacao}`, cols[0], y + 3);
    doc.text(new Date(ev.data_registro).toLocaleDateString('pt-BR'), cols[1], y + 3);
    doc.setFont('helvetica', 'bold');
    doc.text(`${(ev.id_final || 0).toFixed(1)}`, cols[2], y + 3);
    doc.setFont('helvetica', 'normal');
    doc.text(`${(ev.score_e || 0).toFixed(1)}`, cols[3], y + 3);
    doc.text(`${(ev.score_p || 0).toFixed(1)}`, cols[4], y + 3);
    doc.text(`${(ev.score_d || 0).toFixed(1)}`, cols[5], y + 3);
    doc.text(`${(ev.score_f || 0).toFixed(1)}`, cols[6], y + 3);
    doc.text(`${(ev.score_r || 0).toFixed(1)}`, cols[7], y + 3);

    // Delta ID
    const dId = ev.delta_id_final;
    if (dId != null && dId !== 0) {
      const dc = dId < 0 ? GREEN_C : RED_C;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(dc as unknown as [number, number, number]));
      doc.text(`${dId > 0 ? '+' : ''}${dId.toFixed(1)}`, cols[8], y + 3);
    } else {
      doc.setTextColor(...GRAY);
      doc.text('—', cols[8], y + 3);
    }

    y += 7;
  });

  y += 5;

  // ═════════════════════════════════════════════════════
  // COMPARISON BAR CHART (1ª vs Última)
  // ═════════════════════════════════════════════════════
  y = checkPage(doc, y, 55, M);
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Comparação Visual: 1ª vs Última', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 40, 0.8, 'F');
  y += 10;

  const barGroupW = (CW - 10) / SCORE_KEYS.length;
  const maxBarH = 35;

  SCORE_KEYS.forEach((key, i) => {
    const firstVal = Number(((primeira as any)?.[key] || 0).toFixed(1));
    const lastVal = Number(((ultima as any)?.[key] || 0).toFixed(1));
    const gx = M + i * (barGroupW + 1.2);
    const bw = (barGroupW - 3) / 2;

    // First bar
    const h1 = (firstVal / 10) * maxBarH;
    doc.setFillColor(180, 185, 195);
    doc.roundedRect(gx, y + maxBarH - h1, bw, h1, 1, 1, 'F');

    // Last bar
    const h2 = (lastVal / 10) * maxBarH;
    const color = SCORE_COLORS[key];
    doc.setFillColor(...(color as unknown as [number, number, number]));
    doc.roundedRect(gx + bw + 1, y + maxBarH - h2, bw, h2, 1, 1, 'F');

    // Label
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(key.replace('score_', '').toUpperCase(), gx + barGroupW / 2 - 1, y + maxBarH + 5, { align: 'center' });
  });

  // Legend
  doc.setFillColor(180, 185, 195);
  doc.rect(M + CW - 50, y + maxBarH + 8, 5, 3, 'F');
  doc.setFontSize(6);
  doc.setTextColor(...GRAY);
  doc.text('1ª Avaliação', M + CW - 43, y + maxBarH + 10.5);
  doc.setFillColor(...NAVY);
  doc.rect(M + CW - 22, y + maxBarH + 8, 5, 3, 'F');
  doc.text('Última', M + CW - 15, y + maxBarH + 10.5);

  // ═════════════════════════════════════════════════════
  // FOOTER
  // ═════════════════════════════════════════════════════
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(245, 245, 250);
    doc.rect(0, 286, W, 11, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text('Core Axis Pro · Relatório de Evolução · Documento confidencial', M, 293);
    doc.text(`Página ${i} de ${totalPages}`, W - M, 293, { align: 'right' });
  }

  doc.save(`Evolucao_${data.pacienteNome.replace(/\s+/g, '_')}_${data.dataEmissao.replace(/\//g, '-')}.pdf`);
}
