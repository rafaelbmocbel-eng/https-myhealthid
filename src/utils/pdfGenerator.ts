import jsPDF from 'jspdf';

export interface PDFTecnica {
  nome: string;
  categoria: string;
  fase_numero: number;
  observacoes?: string;
}

export interface PDFProtocolo {
  pacienteNome: string;
  terapeutaNome: string;
  dataEmissao: string;
  classificacao: string;
  idFinal: number;
  scores: {
    E: number; P: number; C: number; F: number; D: number; R: number; EFI: number;
  };
  perfilDominante: string[];
  objetivoGeral: string;
  duracao: string;
  frequencia: string;
  prognose: string;
  fases: Array<{
    fase: number;
    titulo: string;
    semanas: string;
    objetivos: string[];
    sessoes_por_semana: number;
    exercicios?: Array<{
      nome: string;
      series: number;
      repeticoes: number | string;
      frequencia: string;
      observacoes?: string;
    }>;
  }>;
  tecnicas?: PDFTecnica[];
}

const VERMELHO = [196, 30, 58] as [number, number, number];
const CINZA_ESCURO = [30, 30, 46] as [number, number, number];
const CINZA_MEDIO = [107, 114, 128] as [number, number, number];
const CINZA_CLARO = [243, 244, 246] as [number, number, number];
const BRANCO = [255, 255, 255] as [number, number, number];

function addPageIfNeeded(doc: jsPDF, y: number, margin: number): number {
  if (y > 265) {
    doc.addPage();
    return margin;
  }
  return y;
}

function scoreLabel(score: number): string {
  if (score <= 3) return 'BAIXO';
  if (score <= 6) return 'MODERADO';
  return 'ALTO';
}

export async function gerarPDFProtocolo(data: PDFProtocolo): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const margin = 15;
  const contentW = W - margin * 2;
  let y = 0;

  // ── CAPA ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...VERMELHO);
  doc.rect(0, 0, W, 55, 'F');

  doc.setTextColor(...BRANCO);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('MY HEALTH ID', margin, 20);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Diretriz de Tratamento Personalizada', margin, 28);

  doc.setFontSize(9);
  doc.setTextColor(255, 200, 200);
  doc.text(`Emitido em: ${data.dataEmissao}`, margin, 38);
  doc.text(`Terapeuta: ${data.terapeutaNome}`, margin, 44);

  // ID Score
  doc.setTextColor(...BRANCO);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('ID Score', W - margin - 35, 18, { align: 'center' });
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text(data.idFinal.toFixed(1), W - margin - 35, 34, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(data.classificacao, W - margin - 35, 42, { align: 'center' });

  y = 65;

  // ── DADOS DO PACIENTE ─────────────────────────────────────────────────────
  doc.setFillColor(...CINZA_CLARO);
  doc.rect(margin, y - 4, contentW, 28, 'F');

  doc.setTextColor(...CINZA_ESCURO);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(data.pacienteNome, margin + 4, y + 4);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CINZA_MEDIO);
  doc.text(`Duração: ${data.duracao}  |  Frequência: ${data.frequencia}`, margin + 4, y + 11);
  doc.text(`Objetivo: ${data.objetivoGeral.slice(0, 90)}`, margin + 4, y + 18);

  y += 36;

  // ── SCORES ────────────────────────────────────────────────────────────────
  doc.setTextColor(...CINZA_ESCURO);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('RESULTADOS DA AVALIAÇÃO', margin, y);
  y += 7;

  const scoreItems = [
    { label: 'E – Estrutural', value: data.scores.E, color: [59, 130, 246] as [number, number, number] },
    { label: 'P – Psico-Comportamental', value: data.scores.P, color: [239, 68, 68] as [number, number, number] },
    { label: 'C – Carga Contextual', value: data.scores.C, color: [249, 115, 22] as [number, number, number] },
    { label: 'F – Fatores Biológicos', value: data.scores.F, color: [34, 197, 94] as [number, number, number] },
    { label: 'D – Dor Percebida', value: data.scores.D, color: [168, 85, 247] as [number, number, number] },
    { label: 'R – Regulação Neuroveget.', value: data.scores.R, color: [100, 116, 139] as [number, number, number] },
    { label: 'EFI – Funcionalidade', value: data.scores.EFI, color: [20, 184, 166] as [number, number, number] },
  ];

  const barMaxW = contentW - 80;
  scoreItems.forEach(item => {
    const pct = Math.min(1, item.value / 10);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CINZA_ESCURO);
    doc.text(item.label, margin, y + 3);
    doc.text(`${item.value.toFixed(1)}/10`, margin + contentW - 20, y + 3, { align: 'right' });

    // background bar
    doc.setFillColor(...CINZA_CLARO);
    doc.rect(margin + 58, y - 1, barMaxW, 5, 'F');
    // value bar
    doc.setFillColor(...item.color);
    doc.rect(margin + 58, y - 1, barMaxW * pct, 5, 'F');

    // label
    const lbl = scoreLabel(item.value);
    doc.setFontSize(7);
    doc.setTextColor(...CINZA_MEDIO);
    doc.text(lbl, margin + 58 + barMaxW + 2, y + 3);
    y += 8;
  });

  y += 8;

  // ── HIERARQUIA / PROGNOSE ─────────────────────────────────────────────────
  doc.setTextColor(...CINZA_ESCURO);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('PERFIL CLÍNICO E PROGNOSE', margin, y);
  y += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CINZA_MEDIO);

  const perfilStr = data.perfilDominante.map(p => p.replace(/_/g, ' ')).join(', ') || 'Nenhum perfil crítico identificado';
  const perfilLines = doc.splitTextToSize(`Perfil dominante: ${perfilStr}`, contentW);
  doc.text(perfilLines, margin, y);
  y += perfilLines.length * 5 + 2;

  const prognoseLines = doc.splitTextToSize(`Prognose: ${data.prognose}`, contentW);
  doc.text(prognoseLines, margin, y);
  y += prognoseLines.length * 5 + 8;

  // ── FASES ────────────────────────────────────────────────────────────────
  doc.setTextColor(...CINZA_ESCURO);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('DIRETRIZ DE TRATAMENTO – 4 FASES', margin, y);
  y += 8;

  const faseCores: [number, number, number][] = [
    [99, 102, 241],  // indigo
    [245, 158, 11],  // amber
    [16, 185, 129],  // emerald
    [239, 68, 68],   // red
  ];

  for (const fase of data.fases) {
    y = addPageIfNeeded(doc, y, margin);

    const cor = faseCores[(fase.fase - 1) % faseCores.length];

    // Cabeçalho da fase
    doc.setFillColor(...cor);
    doc.rect(margin, y - 3, contentW, 10, 'F');
    doc.setTextColor(...BRANCO);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`FASE ${fase.fase} – ${fase.titulo.toUpperCase()}`, margin + 3, y + 4);
    doc.text(`Semanas ${fase.semanas} · ${fase.sessoes_por_semana}x/sem`, margin + contentW - 3, y + 4, { align: 'right' });
    y += 13;

    // Objetivos
    doc.setTextColor(...CINZA_ESCURO);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Objetivos:', margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...CINZA_MEDIO);
    fase.objetivos.forEach(obj => {
      y = addPageIfNeeded(doc, y, margin);
      const lines = doc.splitTextToSize(`• ${obj}`, contentW - 4);
      doc.text(lines, margin + 4, y);
      y += lines.length * 4.5;
    });

    // Exercícios
    if (fase.exercicios && fase.exercicios.length > 0) {
      y += 3;
      doc.setTextColor(...CINZA_ESCURO);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Exercícios Prescritos:', margin, y);
      y += 5;

      fase.exercicios.forEach((ex, idx) => {
        y = addPageIfNeeded(doc, y, margin);
        doc.setFillColor(250, 250, 252);
        doc.rect(margin, y - 3, contentW, 12, 'F');
        doc.setDrawColor(220, 220, 230);
        doc.rect(margin, y - 3, contentW, 12, 'S');

        // Número
        doc.setFillColor(...cor);
        doc.rect(margin, y - 3, 8, 12, 'F');
        doc.setTextColor(...BRANCO);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(`${idx + 1}`, margin + 4, y + 4, { align: 'center' });

        doc.setTextColor(...CINZA_ESCURO);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(ex.nome, margin + 11, y + 1);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...CINZA_MEDIO);
        const prescStr = `${ex.series}s × ${ex.repeticoes}rep · ${ex.frequencia}`;
        doc.text(prescStr, margin + 11, y + 6);
        if (ex.observacoes) {
          const obs = doc.splitTextToSize(ex.observacoes, contentW - 50);
          doc.text(obs, margin + 11, y + 10);
        }

        y += 15;
      });
    }

    y += 6;
  }

  // ── TÉCNICAS DE TRATAMENTO ────────────────────────────────────────────────
  if (data.tecnicas && data.tecnicas.length > 0) {
    y = addPageIfNeeded(doc, y + 5, margin);

    doc.setTextColor(...CINZA_ESCURO);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('TÉCNICAS DE TRATAMENTO SELECIONADAS', margin, y);
    y += 8;

    const CATEGORIA_ICONS: Record<string, string> = {
      'Terapia Manual': '🖐️',
      'Eletroterapia': '⚡',
      'Exercício Terapêutico': '🏋️',
      'Terapia Respiratória': '🫁',
      'Regulação Neurovegetativa': '🧠',
      'Neurodinâmica': '🔗',
      'Tração': '↕️',
      'Educação em Dor': '📚',
    };

    // Group by phase
    const tecnicasPorFase: Record<number, typeof data.tecnicas> = {};
    data.tecnicas.forEach(t => {
      if (!tecnicasPorFase[t.fase_numero]) tecnicasPorFase[t.fase_numero] = [];
      tecnicasPorFase[t.fase_numero].push(t);
    });

    const FASE_NOMES = ['Controle & Proteção', 'Mobilização & Proliferação', 'Remodelação & Força', 'Funcionalidade & Retorno'];

    Object.entries(tecnicasPorFase).sort((a, b) => Number(a[0]) - Number(b[0])).forEach(([faseNum, tecnicas]) => {
      y = addPageIfNeeded(doc, y, margin);
      const fIdx = Number(faseNum) - 1;
      const cor = faseCores[fIdx % faseCores.length];

      // Phase sub-header
      doc.setFillColor(cor[0], cor[1], cor[2]);
      doc.rect(margin, y - 2, 3, 7, 'F');
      doc.setTextColor(...CINZA_ESCURO);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Fase ${faseNum} – ${FASE_NOMES[fIdx] || ''}`, margin + 6, y + 3);
      y += 10;

      tecnicas.forEach(tec => {
        y = addPageIfNeeded(doc, y, margin);
        const icon = CATEGORIA_ICONS[tec.categoria] || '•';
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...CINZA_ESCURO);
        doc.text(`${icon} ${tec.nome}`, margin + 4, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(...CINZA_MEDIO);
        doc.text(tec.categoria, margin + contentW - 5, y, { align: 'right' });
        y += 4;
        if (tec.observacoes) {
          const obsLines = doc.splitTextToSize(tec.observacoes, contentW - 10);
          doc.text(obsLines, margin + 6, y);
          y += obsLines.length * 4;
        }
        y += 3;
      });

      y += 4;
    });
  }

  // ── SEGURANÇA ─────────────────────────────────────────────────────────────
  y = addPageIfNeeded(doc, y + 5, margin);

  doc.setFillColor(...CINZA_CLARO);
  doc.rect(margin, y - 4, contentW, 40, 'F');
  doc.setDrawColor(239, 68, 68);
  doc.rect(margin, y - 4, 4, 40, 'F');

  doc.setTextColor(...CINZA_ESCURO);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('⚠ INSTRUÇÕES DE SEGURANÇA', margin + 7, y + 2);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('PARE o exercício se sentir:', margin + 7, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CINZA_MEDIO);
  const alertas = ['• Dor aguda ou súbita', '• Tontura ou falta de ar', '• Formigamento ou dormência nos membros', '• Qualquer sensação anormal ou preocupante'];
  alertas.forEach((a, i) => doc.text(a, margin + 7, y + 15 + i * 5));

  y += 48;
  doc.setTextColor(...CINZA_MEDIO);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Em caso de dúvidas, contacte seu terapeuta: ${data.terapeutaNome}`, margin + 7, y);
  y += 8;

  // ── RODAPÉ ────────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(245, 245, 250);
    doc.rect(0, 286, W, 11, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...CINZA_MEDIO);
    doc.text('My Health ID · Diretriz Personalizada · Documento confidencial', margin, 293);
    doc.text(`Página ${i} de ${totalPages}`, W - margin, 293, { align: 'right' });
  }

  doc.save(`Diretriz_${data.pacienteNome.replace(/\s+/g, '_')}_${data.dataEmissao.replace(/\//g, '-')}.pdf`);
}
