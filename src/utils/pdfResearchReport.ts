import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { addLogoToDoc } from './pdfLogoHelper';

interface DimRow {
  dimensao: string; n: number; media_pre: number; media_post: number;
  delta: number; ci: string; cohen_d: number; magnitude: string;
  t: number; p_label: string;
}
interface DiretrizRow {
  titulo: string; n: number; media_pre: number; media_post: number;
  delta: number; ci: string; cohen_d: number; p_label: string; dias_medio: number;
}
interface SubgrupoRow { grupo: string; n: number; media: number; dp: number; }

export interface ResearchReportData {
  filtros: { period: string; sexo: string; faixa: string };
  datasetHash: string;
  n_pacientes_total: number;
  n_amostra: number;
  n_avaliacoes: number;
  n_presencial: number;
  n_protocolos: number;
  n_prepost: number;
  n_red_flags: number;
  pct_red_flags: number;
  idade_media: number;
  idade_dp: number;
  idade_min: number;
  idade_max: number;
  sexo: Record<string, number>;
  dimStats: { dimensao: string; n: number; media: number; dp: number; pct_criticos: number }[];
  dimCohen: DimRow[];
  porDiretriz: DiretrizRow[];
  subgruposSexo: SubgrupoRow[];
  subgruposFaixa: SubgrupoRow[];
}

export async function gerarPdfResearchReport(d: ResearchReportData): Promise<void> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const M = 14;
  let y = M;

  await addLogoToDoc(doc, M, y, 14);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(28, 55, 83);
  doc.text('Relatório Científico — MyID', M + 18, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100);
  doc.text(`Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')} · dataset#${d.datasetHash}`, M + 18, y + 11);
  y += 20;

  const ensureSpace = (h: number) => {
    if (y + h > pageH - 14) { doc.addPage(); y = M; }
  };

  const sectionTitle = (t: string) => {
    ensureSpace(10);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(28, 55, 83);
    doc.text(t, M, y); y += 5;
    doc.setDrawColor(220); doc.line(M, y, pageW - M, y); y += 4;
    doc.setTextColor(40);
  };

  const kvRow = (k: string, v: string) => {
    ensureSpace(5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(100); doc.text(k, M, y);
    doc.setTextColor(20); doc.text(v, M + 80, y);
    y += 4.5;
  };

  // Filtros
  sectionTitle('Filtros aplicados');
  const periodLabel: Record<string, string> = { '30d':'30 dias','90d':'90 dias','180d':'6 meses','365d':'12 meses','all':'Todo o período' };
  kvRow('Período', periodLabel[d.filtros.period] || d.filtros.period);
  kvRow('Sexo', d.filtros.sexo === 'all' ? 'Todos' : d.filtros.sexo);
  kvRow('Faixa etária', d.filtros.faixa === 'all' ? 'Todas' : d.filtros.faixa);
  y += 2;

  // Amostra
  sectionTitle('Amostra (Tabela 1)');
  kvRow('N (amostra com MyID)', String(d.n_amostra));
  kvRow('Pacientes totais (filtrados)', String(d.n_pacientes_total));
  kvRow('Idade — média (DP)', `${d.idade_media} (${d.idade_dp}) anos`);
  kvRow('Idade — intervalo', `${d.idade_min}–${d.idade_max} anos`);
  Object.entries(d.sexo).forEach(([k, v]) => {
    const pct = d.n_amostra ? ((v / d.n_amostra) * 100).toFixed(1) : '0';
    kvRow(`Sexo: ${k}`, `${v} (${pct}%)`);
  });
  kvRow('Avaliações MyID', String(d.n_avaliacoes));
  kvRow('Avaliações presenciais', String(d.n_presencial));
  kvRow('Diretrizes (protocolos)', String(d.n_protocolos));
  kvRow('Red Flags', `${d.n_red_flags} (${d.pct_red_flags}%)`);
  y += 2;

  // Tabela helper
  const tableHeader = (cols: { label: string; w: number; align?: 'left'|'right' }[]) => {
    ensureSpace(7);
    doc.setFillColor(245, 247, 250);
    doc.rect(M, y - 3.5, pageW - 2*M, 5, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(60);
    let x = M + 1;
    cols.forEach(c => {
      doc.text(c.label, c.align === 'right' ? x + c.w - 1 : x, y, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    });
    y += 4;
  };
  const tableRow = (cols: { label: string; w: number; align?: 'left'|'right' }[], values: string[]) => {
    ensureSpace(5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(40);
    let x = M + 1;
    cols.forEach((c, i) => {
      const v = values[i] ?? '';
      doc.text(v, c.align === 'right' ? x + c.w - 1 : x, y, { align: c.align === 'right' ? 'right' : 'left' });
      x += c.w;
    });
    y += 4;
    doc.setDrawColor(235); doc.line(M, y - 1, pageW - M, y - 1);
  };

  // Dimensões — médias
  sectionTitle('Prevalência por dimensão MyID');
  const colsDim = [
    { label: 'Dimensão', w: 60 },
    { label: 'n', w: 14, align: 'right' as const },
    { label: 'Média (DP)', w: 40, align: 'right' as const },
    { label: '% críticos', w: 30, align: 'right' as const },
  ];
  tableHeader(colsDim);
  d.dimStats.forEach(r => tableRow(colsDim, [r.dimensao, String(r.n), `${r.media} (${r.dp})`, `${r.pct_criticos}%`]));
  y += 3;

  // Pré/pós + d + p
  sectionTitle(`Análise pré/pós (n = ${d.n_prepost} pacientes)`);
  if (d.n_prepost < 2) {
    doc.setFontSize(8); doc.setTextColor(100);
    doc.text('Aguardando pacientes com ≥2 avaliações para cálculo.', M, y); y += 5;
  } else {
    const colsPP = [
      { label: 'Dimensão', w: 50 },
      { label: 'n', w: 10, align: 'right' as const },
      { label: 'Pré', w: 14, align: 'right' as const },
      { label: 'Pós', w: 14, align: 'right' as const },
      { label: 'Δ (IC95%)', w: 38, align: 'right' as const },
      { label: 'd', w: 14, align: 'right' as const },
      { label: 't', w: 12, align: 'right' as const },
      { label: 'p', w: 14, align: 'right' as const },
    ];
    tableHeader(colsPP);
    d.dimCohen.forEach(r => tableRow(colsPP, [
      r.dimensao, String(r.n), String(r.media_pre), String(r.media_post),
      `${r.delta > 0 ? '+' : ''}${r.delta} ${r.ci}`,
      `${r.cohen_d} (${r.magnitude})`, String(r.t), r.p_label,
    ]));
  }
  y += 3;

  // Subgrupos
  if (d.subgruposSexo.length || d.subgruposFaixa.length) {
    sectionTitle('Subgrupos — score MyID global');
    const colsSub = [
      { label: 'Grupo', w: 60 },
      { label: 'n', w: 20, align: 'right' as const },
      { label: 'Média', w: 30, align: 'right' as const },
      { label: 'DP', w: 30, align: 'right' as const },
    ];
    if (d.subgruposSexo.length) {
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(80);
      ensureSpace(5); doc.text('Por sexo', M, y); y += 4;
      tableHeader(colsSub);
      d.subgruposSexo.forEach(r => tableRow(colsSub, [r.grupo, String(r.n), String(r.media), String(r.dp)]));
      y += 2;
    }
    if (d.subgruposFaixa.length) {
      doc.setFontSize(9); doc.setFont('helvetica','bold'); doc.setTextColor(80);
      ensureSpace(5); doc.text('Por faixa etária', M, y); y += 4;
      tableHeader(colsSub);
      d.subgruposFaixa.forEach(r => tableRow(colsSub, [r.grupo, String(r.n), String(r.media), String(r.dp)]));
      y += 2;
    }
  }

  // Diretrizes
  if (d.porDiretriz.length) {
    sectionTitle('Outcomes por diretriz de tratamento');
    const colsDir = [
      { label: 'Diretriz', w: 60 },
      { label: 'n', w: 10, align: 'right' as const },
      { label: 'Pré', w: 14, align: 'right' as const },
      { label: 'Pós', w: 14, align: 'right' as const },
      { label: 'Δ (IC95%)', w: 36, align: 'right' as const },
      { label: 'd', w: 14, align: 'right' as const },
      { label: 'p', w: 14, align: 'right' as const },
      { label: 'Dias', w: 14, align: 'right' as const },
    ];
    tableHeader(colsDir);
    d.porDiretriz.forEach(r => tableRow(colsDir, [
      r.titulo.length > 32 ? r.titulo.slice(0, 30) + '…' : r.titulo,
      String(r.n), String(r.media_pre), String(r.media_post),
      `${r.delta > 0 ? '+' : ''}${r.delta} ${r.ci}`,
      String(r.cohen_d), r.p_label, String(r.dias_medio),
    ]));
  }

  // Métodos (STROBE)
  doc.addPage(); y = M;
  sectionTitle('Métodos (resumo STROBE)');
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(40);
  const metodos = [
    `Desenho: estudo observacional de coorte retrospectiva.`,
    `Amostra: conveniência (n = ${d.n_amostra}); idade ${d.idade_media} ± ${d.idade_dp} anos.`,
    `Variável primária: MyID v2.0 (escala 0–100, 9 dimensões: I, N, R, D, F, E, EFI, C, P).`,
    `Análise pré/pós: pacientes com ≥2 avaliações (n = ${d.n_prepost}). Comparações por teste t pareado, IC 95%, e tamanho de efeito por Cohen's d.`,
    `Outcomes por diretriz: pareamento da última avaliação anterior ao início do protocolo com a mais recente posterior.`,
    `Correlações intra-dimensionais por coeficiente de Pearson.`,
    `Anonimização: hash de ID (8 caracteres). Reprodutibilidade: dataset#${d.datasetHash}.`,
  ];
  metodos.forEach(t => {
    const lines = doc.splitTextToSize(t, pageW - 2*M);
    ensureSpace(lines.length * 4 + 2);
    doc.text(lines, M, y); y += lines.length * 4 + 1;
  });

  // Rodapé
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7); doc.setTextColor(150);
    doc.text(`MY HEALTH ID · Relatório científico · página ${i}/${pages}`, pageW / 2, pageH - 6, { align: 'center' });
  }

  doc.save(`pesquisa_relatorio_${format(new Date(), 'yyyyMMdd_HHmm')}.pdf`);
}
