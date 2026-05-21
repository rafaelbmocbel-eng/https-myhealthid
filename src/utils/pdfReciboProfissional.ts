import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LinhaRecibo {
  data: string;
  paciente: string;
  tipo: 'particular' | 'plano';
  convenio: string;
  valorBruto: number;
  percentual: number; // 0..100
  repasse: number;
}

interface Params {
  profissional: string;
  periodo: string;
  clinicaNome?: string;
  linhas: LinhaRecibo[];
  totalBruto: number;
  totalRepasse: number;
  totalParticular: number;
  totalPlano: number;
  repasseParticular: number;
  repassePlano: number;
}

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export function gerarReciboProfissional(p: Params): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;
  let y = 14;

  // Header
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageW, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text('Recibo de Repasse', marginX, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`${p.profissional}  ·  ${p.periodo}`, marginX, 19);

  doc.setFontSize(7);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageW - marginX,
    19,
    { align: 'right' },
  );

  y = 32;

  // Cards
  const cardW = (pageW - marginX * 2 - 6) / 4;
  const cards = [
    { label: 'Sessões', valor: String(p.linhas.length), color: [241, 245, 249] },
    { label: 'Bruto', valor: fmtBRL(p.totalBruto), color: [219, 234, 254] },
    { label: 'Particular', valor: fmtBRL(p.totalParticular), color: [219, 234, 254] },
    { label: 'A Receber', valor: fmtBRL(p.totalRepasse), color: [220, 252, 231] },
  ];
  cards.forEach((c, i) => {
    const x = marginX + i * (cardW + 2);
    doc.setFillColor(c.color[0], c.color[1], c.color[2]);
    doc.roundedRect(x, y, cardW, 16, 2, 2, 'F');
    doc.setTextColor(80);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(c.label.toUpperCase(), x + 2, y + 4);
    doc.setTextColor(20);
    doc.setFontSize(11);
    doc.text(c.valor, x + 2, y + 12);
  });
  y += 22;

  // Breakdown Particular vs Plano
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Resumo por origem', marginX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(40);
  doc.text(
    `Particular: ${fmtBRL(p.totalParticular)}  →  Repasse ${fmtBRL(p.repasseParticular)}`,
    marginX,
    y,
  );
  y += 4;
  doc.text(
    `Plano: ${fmtBRL(p.totalPlano)}  →  Repasse ${fmtBRL(p.repassePlano)}`,
    marginX,
    y,
  );
  y += 7;

  // Tabela
  const cols = [
    { key: 'data', label: 'Data', w: 22 },
    { key: 'paciente', label: 'Paciente', w: 50 },
    { key: 'tipo', label: 'Tipo', w: 18 },
    { key: 'convenio', label: 'Convênio', w: 32 },
    { key: 'bruto', label: 'Bruto', w: 22 },
    { key: 'pct', label: '%', w: 12 },
    { key: 'repasse', label: 'Repasse', w: 0 },
  ];
  const totalFixed = cols.slice(0, -1).reduce((a, c) => a + c.w, 0);
  cols[cols.length - 1].w = pageW - marginX * 2 - totalFixed;

  const drawHeader = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(marginX, y, pageW - marginX * 2, 7, 'F');
    doc.setTextColor(60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    let x = marginX + 2;
    cols.forEach((c) => {
      const align = ['bruto', 'pct', 'repasse'].includes(c.key) ? 'right' : 'left';
      const tx = align === 'right' ? x + c.w - 4 : x;
      doc.text(c.label, tx, y + 5, { align });
      x += c.w;
    });
    y += 9;
  };
  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  const trunc = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

  p.linhas.forEach((row, idx) => {
    if (y > pageH - 30) {
      doc.addPage();
      y = 14;
      drawHeader();
    }
    if (idx % 2 === 0) {
      doc.setFillColor(250, 250, 252);
      doc.rect(marginX, y - 4, pageW - marginX * 2, 6.5, 'F');
    }
    doc.setTextColor(30);
    let x = marginX + 2;
    const cells: Array<{ key: string; val: string }> = [
      { key: 'data', val: row.data },
      { key: 'paciente', val: trunc(row.paciente, 30) },
      { key: 'tipo', val: row.tipo === 'plano' ? 'Plano' : 'Particular' },
      { key: 'convenio', val: trunc(row.convenio || '-', 20) },
      { key: 'bruto', val: fmtBRL(row.valorBruto) },
      { key: 'pct', val: `${row.percentual.toFixed(0)}%` },
      { key: 'repasse', val: fmtBRL(row.repasse) },
    ];
    cells.forEach((c, i) => {
      const col = cols[i];
      const align = ['bruto', 'pct', 'repasse'].includes(c.key) ? 'right' : 'left';
      const tx = align === 'right' ? x + col.w - 4 : x;
      if (c.key === 'tipo') {
        if (row.tipo === 'plano') doc.setTextColor(146, 64, 14);
        else doc.setTextColor(30, 64, 175);
        doc.setFont('helvetica', 'bold');
        doc.text(c.val, tx, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30);
      } else if (c.key === 'repasse') {
        doc.setFont('helvetica', 'bold');
        doc.text(c.val, tx, y, { align });
        doc.setFont('helvetica', 'normal');
      } else {
        doc.text(c.val, tx, y, { align });
      }
      x += col.w;
    });
    y += 6.5;
  });

  // Total
  if (y > pageH - 50) {
    doc.addPage();
    y = 14;
  }
  y += 4;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageW - marginX, y);
  y += 6;
  doc.setFillColor(16, 185, 129);
  doc.roundedRect(marginX, y - 4, pageW - marginX * 2, 10, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(`Total a receber — ${p.profissional}`, marginX + 3, y + 2);
  doc.text(fmtBRL(p.totalRepasse), pageW - marginX - 3, y + 2, { align: 'right' });
  y += 16;

  // Assinatura
  doc.setTextColor(60);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    'Declaro ter recebido o valor acima referente aos atendimentos listados.',
    marginX,
    y,
  );
  y += 18;
  doc.line(marginX, y, marginX + 70, y);
  doc.text(p.profissional, marginX, y + 4);
  doc.line(pageW - marginX - 70, y, pageW - marginX, y);
  doc.text('Clínica / Responsável', pageW - marginX - 70, y + 4);

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${i} de ${pages}`, pageW - marginX, pageH - 6, { align: 'right' });
    doc.text(
      `${p.clinicaNome || 'MY HEALTH ID'} — Recibo de Repasse`,
      marginX,
      pageH - 6,
    );
  }

  const safeName = p.profissional.replace(/\s+/g, '_').toLowerCase();
  doc.save(`recibo-${safeName}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`);
}
