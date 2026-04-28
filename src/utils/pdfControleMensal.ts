import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Linha {
  data: string;
  paciente: string;
  profissional: string;
  tipo: 'particular' | 'plano';
  plano: string;
  valor: number;
}

interface Params {
  periodo: string;
  filtroProfissional: string;
  filtroTipo: string;
  repassePct: number; // 0..1
  repasseLabel: string;
  linhas: Linha[];
  totalParticular: number;
  totalPlano: number;
  total: number;
}

const fmtBRL = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export function gerarPdfControleMensal(p: Params): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;
  let y = 14;

  // Header
  doc.setFillColor(99, 102, 241);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Controle Mensal de Atendimentos', marginX, 12);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(p.periodo, marginX, 18);

  doc.setTextColor(120);
  doc.setFontSize(8);
  doc.text(
    `Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
    pageW - marginX,
    18,
    { align: 'right' }
  );

  y = 30;

  // Filtros
  doc.setTextColor(80);
  doc.setFontSize(8);
  doc.text(
    `Profissional: ${p.filtroProfissional}  ·  Tipo: ${p.filtroTipo}  ·  Repasse: ${p.repasseLabel}`,
    marginX,
    y
  );
  y += 6;

  // Cards de totais
  const repasse = p.total * p.repassePct;
  const cardW = (pageW - marginX * 2 - 6) / 4;
  const cards = [
    { label: 'Sessões', valor: String(p.linhas.length), color: [241, 245, 249] },
    { label: 'Particular', valor: fmtBRL(p.totalParticular), color: [219, 234, 254] },
    { label: 'Plano', valor: fmtBRL(p.totalPlano), color: [254, 243, 199] },
    { label: `A Receber (${p.repasseLabel})`, valor: fmtBRL(repasse), color: [220, 252, 231] },
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

  // Cabeçalho da tabela
  const cols = [
    { key: 'data', label: 'Data', w: 22 },
    { key: 'paciente', label: 'Paciente', w: 48 },
    { key: 'profissional', label: 'Profissional', w: 35 },
    { key: 'tipo', label: 'Tipo', w: 18 },
    { key: 'plano', label: 'Plano', w: 30 },
    { key: 'valor', label: 'Valor (R$)', w: 0 }, // restante
  ];
  const totalFixed = cols.slice(0, 5).reduce((a, c) => a + c.w, 0);
  cols[5].w = pageW - marginX * 2 - totalFixed;

  const drawHeader = () => {
    doc.setFillColor(243, 244, 246);
    doc.rect(marginX, y, pageW - marginX * 2, 7, 'F');
    doc.setTextColor(60);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    let x = marginX + 2;
    cols.forEach((c) => {
      const align = c.key === 'valor' ? 'right' : 'left';
      const tx = align === 'right' ? x + c.w - 4 : x;
      doc.text(c.label, tx, y + 5, { align });
      x += c.w;
    });
    y += 9;
  };
  drawHeader();

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  p.linhas.forEach((row, idx) => {
    if (y > pageH - 25) {
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
    const trunc = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + '…' : s);
    const cells = [
      row.data,
      trunc(row.paciente, 28),
      trunc(row.profissional, 22),
      row.tipo === 'plano' ? 'Plano' : 'Particular',
      trunc(row.plano || '-', 18),
      fmtBRL(row.valor),
    ];
    cells.forEach((val, i) => {
      const c = cols[i];
      const align = c.key === 'valor' ? 'right' : 'left';
      const tx = align === 'right' ? x + c.w - 4 : x;
      if (c.key === 'tipo') {
        if (row.tipo === 'plano') doc.setTextColor(146, 64, 14);
        else doc.setTextColor(30, 64, 175);
        doc.setFont('helvetica', 'bold');
        doc.text(val, tx, y);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(30);
      } else if (c.key === 'valor') {
        doc.setFont('helvetica', 'bold');
        doc.text(val, tx, y, { align });
        doc.setFont('helvetica', 'normal');
      } else {
        doc.text(val, tx, y, { align });
      }
      x += c.w;
    });
    y += 6.5;
  });

  // Totais finais
  if (y > pageH - 40) {
    doc.addPage();
    y = 14;
  }
  y += 4;
  doc.setDrawColor(99, 102, 241);
  doc.setLineWidth(0.5);
  doc.line(marginX, y, pageW - marginX, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30);
  const linhasTotais = [
    [`Total de atendimentos`, String(p.linhas.length)],
    [`Total Particular`, fmtBRL(p.totalParticular)],
    [`Total Plano`, fmtBRL(p.totalPlano)],
    [`Valor Total Bruto`, fmtBRL(p.total)],
    [`Valor a Receber (${p.repasseLabel})`, fmtBRL(repasse)],
  ];
  linhasTotais.forEach(([label, val], i) => {
    const isLast = i === linhasTotais.length - 1;
    if (isLast) {
      doc.setFillColor(99, 102, 241);
      doc.roundedRect(marginX, y - 4, pageW - marginX * 2, 8, 1.5, 1.5, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(60);
    }
    doc.text(label, marginX + 3, y + 1);
    doc.text(val, pageW - marginX - 3, y + 1, { align: 'right' });
    y += isLast ? 9 : 6;
  });

  // Footer
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.setFont('helvetica', 'normal');
    doc.text(`Página ${i} de ${pages}`, pageW - marginX, pageH - 6, { align: 'right' });
    doc.text('MY HEALTH ID — Controle Mensal', marginX, pageH - 6);
  }

  const filename = `controle-mensal-${format(new Date(), 'yyyy-MM-dd-HHmm')}.pdf`;
  doc.save(filename);
}
