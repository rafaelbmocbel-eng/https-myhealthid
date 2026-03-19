import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { addLogoToDoc } from './pdfLogoHelper';

// Colors
const NAVY = [28, 55, 83] as const;
const GOLD = [234, 170, 20] as const;
const DARK = [25, 35, 50] as const;
const GRAY = [100, 110, 125] as const;
const LIGHT = [243, 244, 248] as const;
const WHITE = [255, 255, 255] as const;
const RED = [220, 50, 50] as const;
const GREEN = [34, 160, 80] as const;
const AMBER = [240, 160, 20] as const;
const ORANGE = [240, 120, 40] as const;

type C3 = readonly [number, number, number];

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

function drawPageHeader(doc: jsPDF, subtitle: string, pacienteNome: string) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 210, 12, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 12, 210, 1, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('MY HEALTH ID', 14, 8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${subtitle}  ·  ${pacienteNome}`, 196, 8, { align: 'right' });
}

interface RespostaCompletaInput {
  avaliacao: any; // AvaliacaoMyID
  pacienteId: string;
  terapeutaNome: string;
}

export async function gerarPDFRespostaCompleta({ avaliacao, pacienteId, terapeutaNome }: RespostaCompletaInput): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const M = 14;
  const CW = W - M * 2;
  let y = 0;

  const resultado = avaliacao.resultado || {};
  const scores = resultado.componentScores || {};
  const myidScore = resultado.myidScore || 0;
  const classificacao = resultado.classificacao || 'N/A';
  const dataAvaliacao = avaliacao.dataAvaliacao || new Date().toLocaleDateString('pt-BR');

  // ── Fetch structural assessment ──
  const { data: structuralRows } = await (supabase as any)
    .from('avaliacoes_identidade')
    .select('dados_avaliacao')
    .eq('paciente_id', pacienteId)
    .order('created_at', { ascending: false })
    .limit(1);

  const savedAv = structuralRows?.[0]?.dados_avaliacao;
  const structuralData = savedAv?.structuralAssessment || null;

  // ── Fetch active protocol + techniques ──
  const { data: protocolos } = await supabase
    .from('protocolos')
    .select('*, protocolo_fases(*), protocolo_tratamentos(*, tecnicas_tratamento:tecnica_id(*))')
    .eq('paciente_id', pacienteId)
    .eq('status', 'ativo')
    .order('created_at', { ascending: false })
    .limit(1);

  const protocolo = protocolos?.[0] || null;

  // ═══════════════════════════════════════════════════════
  // PAGE 1 — CAPA
  // ═══════════════════════════════════════════════════════
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, W, 55, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 55, W, 2, 'F');

  // Logo area — real app logo
  await addLogoToDoc(doc, M, 10, 16);


  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 225);
  doc.text('Resposta Completa — Avaliação Integrada', M + 20, 26);

  doc.setFontSize(8);
  doc.text(`${dataAvaliacao}  ·  Terapeuta: ${terapeutaNome}`, M + 20, 34);
  doc.text(`Paciente: ${avaliacao.pacienteNome}`, M + 20, 40);

  // MyID Score badge
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.text('MyID SCORE', W - M - 22, 14, { align: 'center' });
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(myidScore.toFixed(1), W - M - 22, 32, { align: 'center' });
  const cc = classColor(classificacao);
  doc.setFillColor(...cc);
  doc.roundedRect(W - M - 36, 35, 28, 8, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(7);
  doc.text(classificacao, W - M - 22, 40.5, { align: 'center' });

  y = 65;

  // Patient card
  doc.setFillColor(...LIGHT);
  doc.roundedRect(M, y, CW, 14, 3, 3, 'F');
  doc.setTextColor(...DARK);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(avaliacao.pacienteNome, M + 5, y + 8);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text('Resposta Completa: MyID + Estrutural + Diretriz de Tratamento', M + 5, y + 12);
  y += 20;

  // ═══════════════════════════════════════════════════════
  // SECTION 1 — RESULTADOS MyID
  // ═══════════════════════════════════════════════════════
  doc.setTextColor(...DARK);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. RESULTADOS MyID — Avaliação Multidimensional', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 60, 0.8, 'F');
  y += 10;

  const scoreItems = [
    { label: 'D – Nível de Dor', value: scores.D || 0, color: [255, 107, 107] as C3 },
    { label: 'EFI – Funcionalidade', value: scores.EFI || 0, color: [255, 165, 0] as C3 },
    { label: 'P – Modulador Psicológico', value: scores.P || 0, color: [255, 184, 77] as C3 },
    { label: 'I – Inércia / Gatilho', value: scores.I || 0, color: [255, 140, 66] as C3 },
    { label: 'R – Regulação', value: scores.R || 0, color: [135, 206, 235] as C3 },
    { label: 'C – Contexto', value: scores.C || 0, color: [80, 200, 120] as C3 },
    { label: 'N – Ruído Sistêmico', value: scores.N || 0, color: [74, 144, 226] as C3 },
  ];

  const barW = CW - 75;
  scoreItems.forEach(item => {
    y = checkPage(doc, y, 10, M);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text(item.label, M, y + 3);

    drawBar(doc, M + 52, y, barW, 4, item.value / 10, item.color);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(item.color as unknown as [number, number, number]));
    doc.text(`${item.value.toFixed(1)}/10`, M + CW - 2, y + 3, { align: 'right' });
    y += 7;
  });

  // Red flags
  if (resultado.redFlagsDetected && resultado.redFlagAlerts?.length > 0) {
    y += 4;
    y = checkPage(doc, y, 20, M);
    doc.setFillColor(255, 240, 240);
    doc.roundedRect(M, y, CW, 6 + resultado.redFlagAlerts.length * 5, 2, 2, 'F');
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 6 + resultado.redFlagAlerts.length * 5, 2, 2, 'S');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...(RED as unknown as [number, number, number]));
    doc.text('⚠ RED FLAGS DETECTADAS', M + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    resultado.redFlagAlerts.forEach((alert: string, i: number) => {
      doc.text(`• ${alert}`, M + 6, y + 10 + i * 5);
    });
    y += 8 + resultado.redFlagAlerts.length * 5;
  }

  y += 8;

  // ═══════════════════════════════════════════════════════
  // SECTION 2 — AVALIAÇÃO ESTRUTURAL
  // ═══════════════════════════════════════════════════════
  y = checkPage(doc, y, 30, M);
  doc.setTextColor(...DARK);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('2. AVALIAÇÃO ESTRUTURAL', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 42, 0.8, 'F');
  y += 10;

  if (structuralData && structuralData.units) {
    // Score geral
    const scoreE = structuralData.scoreStructuralGeneral || 0;
    const classE = structuralData.classification || 'N/A';

    doc.setFillColor(...LIGHT);
    doc.roundedRect(M, y, CW, 14, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Score Estrutural Geral:', M + 4, y + 6);
    const scE = severityColor(scoreE);
    doc.setFontSize(14);
    doc.setTextColor(...(scE as unknown as [number, number, number]));
    doc.text(`${scoreE.toFixed(1)}/10`, M + 55, y + 7);
    doc.setFontSize(8);
    doc.text(classE, M + 75, y + 7);
    y += 18;

    // Unidades funcionais
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Unidades Funcionais:', M, y);
    y += 6;

    const unitEntries = Object.entries(structuralData.units || {}) as [string, any][];
    unitEntries
      .filter(([, u]) => u && u.score > 0)
      .sort((a, b) => (b[1].score || 0) - (a[1].score || 0))
      .forEach(([unitId, unit]) => {
        y = checkPage(doc, y, 8, M);
        const sc = severityColor(unit.score);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text(unitId, M + 2, y + 3);

        drawBar(doc, M + 30, y, CW - 60, 4, unit.score / 10, sc);

        doc.setTextColor(...(sc as unknown as [number, number, number]));
        doc.text(`${unit.score.toFixed(1)}`, M + CW - 18, y + 3);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.text(unit.classification || '', M + CW - 4, y + 3, { align: 'right' });
        y += 7;
      });

    // Prioridades clínicas
    if (structuralData.clinicalPriorities?.length > 0) {
      y += 4;
      y = checkPage(doc, y, 15, M);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text('Prioridades Clínicas:', M, y);
      y += 6;

      structuralData.clinicalPriorities.slice(0, 5).forEach((p: any) => {
        y = checkPage(doc, y, 8, M);
        doc.setFillColor(248, 249, 252);
        doc.roundedRect(M, y, CW, 7, 1.5, 1.5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text(`#${p.priority} ${p.unitId}`, M + 3, y + 4.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.text(`${p.action} · ${p.durationWeeks} sem · ${p.expectedImprovement}`, M + 30, y + 4.5);
        const sc = severityColor(p.score);
        doc.setTextColor(...(sc as unknown as [number, number, number]));
        doc.setFont('helvetica', 'bold');
        doc.text(`${p.score.toFixed(1)}`, M + CW - 4, y + 4.5, { align: 'right' });
        y += 9;
      });
    }

    // Conexões
    if (structuralData.relationships?.direct?.length > 0) {
      y += 4;
      y = checkPage(doc, y, 12, M);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text('Conexões Biomecânicas:', M, y);
      y += 6;
      structuralData.relationships.direct.slice(0, 6).forEach((r: any) => {
        y = checkPage(doc, y, 6, M);
        doc.setFontSize(6.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...DARK);
        doc.text(`${r.source} → ${r.target}: ${r.mechanism}`, M + 4, y + 3);
        y += 5;
      });
    }
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    doc.text('Avaliação estrutural ainda não realizada para este paciente.', M, y);
    y += 8;
  }

  // ═══════════════════════════════════════════════════════
  // SECTION 2.5 — ORIENTAÇÕES RESPIRATÓRIAS & DICAS DE MELHORIA
  // ═══════════════════════════════════════════════════════
  y = checkPage(doc, y + 6, 30, M);
  doc.setTextColor(...DARK);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Orientações Respiratórias & Dicas de Melhoria', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 58, 0.8, 'F');
  y += 10;

  // Fetch respiratory/other techniques from DB
  const { data: tecnicasExtras } = await (await import('@/integrations/supabase/client')).supabase
    .from('tecnicas_tratamento')
    .select('*')
    .in('categoria', ['exercicio_respiratorio', 'outros'])
    .order('nome');

  if (tecnicasExtras && tecnicasExtras.length > 0) {
    const porCat: Record<string, any[]> = {};
    (tecnicasExtras as any[]).forEach((t: any) => {
      const cat = t.categoria === 'exercicio_respiratorio' ? 'Exercícios Respiratórios' : 'Dicas de Melhoria';
      if (!porCat[cat]) porCat[cat] = [];
      porCat[cat].push(t);
    });

    Object.entries(porCat).forEach(([catLabel, tecs]) => {
      y = checkPage(doc, y, 12, M);
      const icon = catLabel.includes('Respirat') ? '🫁' : '💡';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(`${icon} ${catLabel}`, M, y + 3);
      y += 7;

      (tecs as any[]).forEach((tec: any) => {
        y = checkPage(doc, y, 12, M);
        doc.setFillColor(248, 250, 255);
        doc.roundedRect(M + 2, y, CW - 4, 10, 1.5, 1.5, 'F');
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text(tec.nome, M + 5, y + 4);
        if (tec.nivel_evidencia) {
          doc.setFontSize(5.5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...GRAY);
          doc.text(`Evidência: ${tec.nivel_evidencia}`, W - M - 6, y + 4, { align: 'right' });
        }
        if (tec.descricao) {
          doc.setFontSize(6);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...GRAY);
          const dl = doc.splitTextToSize(tec.descricao, CW - 14);
          doc.text(dl.slice(0, 1), M + 5, y + 8);
        }
        y += 12;
      });
      y += 2;
    });
  } else {
    // Generic lifestyle tips when no techniques in DB
    const dicas = [
      { titulo: '🫁 Respiração Diafragmática', desc: 'Inspire pelo nariz expandindo o abdômen (4s), segure (2s), expire lentamente (6s). Repita 10x, 2-3x/dia.' },
      { titulo: '🧘 Relaxamento Progressivo', desc: 'Tensione e relaxe cada grupo muscular por 5s. Do pé à cabeça. Ideal antes de dormir.' },
      { titulo: '💧 Hidratação Adequada', desc: 'Mínimo 35ml/kg/dia. Tecidos hidratados respondem melhor ao tratamento.' },
      { titulo: '🛌 Higiene do Sono', desc: 'Rotina regular, sem telas 1h antes, quarto escuro e fresco. Meta: 7-9h/noite.' },
      { titulo: '🚶 Movimento Ativo', desc: 'Caminhadas de 20-30min/dia reduzem inflamação sistêmica e melhoram o humor.' },
    ];
    dicas.forEach(d => {
      y = checkPage(doc, y, 10, M);
      doc.setFillColor(248, 250, 255);
      doc.roundedRect(M, y, CW, 9, 1.5, 1.5, 'F');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text(d.titulo, M + 3, y + 4);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...GRAY);
      doc.text(d.desc, M + 3, y + 7.5);
      y += 11;
    });
  }

  y += 6;

  // ═══════════════════════════════════════════════════════
  // SECTION 3 — DIRETRIZ DE TRATAMENTO
  // ═══════════════════════════════════════════════════════
  doc.addPage();
  drawPageHeader(doc, 'Diretriz de Tratamento', avaliacao.pacienteNome);
  y = 20;

  doc.setTextColor(...DARK);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3. DIRETRIZ DE TRATAMENTO ATIVA', M, y);
  doc.setFillColor(...GOLD);
  doc.rect(M, y + 2, 50, 0.8, 'F');
  y += 10;

  if (protocolo) {
    // Objetivo
    doc.setFillColor(...LIGHT);
    doc.roundedRect(M, y, CW, 18, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Título:', M + 4, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(protocolo.titulo || '', M + 18, y + 5);

    doc.setFont('helvetica', 'bold');
    doc.text('Objetivo:', M + 4, y + 10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    const objLines = doc.splitTextToSize(protocolo.objetivo_geral || '', CW - 30);
    doc.text(objLines.slice(0, 2), M + 22, y + 10);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK);
    doc.text('Duração:', M + 4, y + 15);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(`${protocolo.duracao_total || ''} · ${protocolo.frequencia || ''}`, M + 22, y + 15);
    y += 22;

    // Perfil dominante
    if (protocolo.perfil_dominante) {
      const perfis = Array.isArray(protocolo.perfil_dominante) ? protocolo.perfil_dominante : [];
      if (perfis.length > 0) {
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text('Perfil Dominante: ', M, y + 3);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.text(perfis.map((p: string) => p.replace(/_/g, ' ')).join(', '), M + 30, y + 3);
        y += 7;
      }
    }

    // Fases
    const FASE_NOMES = ['Controle & Proteção', 'Mobilização & Proliferação', 'Remodelação & Força', 'Funcionalidade & Retorno'];
    const FASE_CORES: C3[] = [[99, 102, 241], [245, 158, 11], [16, 185, 129], [239, 68, 68]];

    const fases = Array.isArray(protocolo.protocolo_fases)
      ? [...protocolo.protocolo_fases].sort((a: any, b: any) => a.numero_fase - b.numero_fase)
      : [];

    const tratamentos = Array.isArray(protocolo.protocolo_tratamentos) ? protocolo.protocolo_tratamentos : [];

    fases.forEach((fase: any) => {
      y = checkPage(doc, y + 2, 16, M);
      const idx = (fase.numero_fase || 1) - 1;
      const cor = FASE_CORES[idx % FASE_CORES.length];

      // Phase header
      doc.setFillColor(...cor);
      doc.roundedRect(M, y, CW, 9, 2, 2, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text(`FASE ${fase.numero_fase} — ${fase.titulo || FASE_NOMES[idx] || ''}`, M + 4, y + 6);
      const semanas = fase.semanas_inicio && fase.semanas_fim ? `Sem ${fase.semanas_inicio}-${fase.semanas_fim}` : '';
      doc.text(`${semanas} · ${fase.sessoes_por_semana || 0}x/sem`, W - M - 4, y + 6, { align: 'right' });
      y += 12;

      // Objectives
      const objetivos = Array.isArray(fase.objetivos) ? fase.objetivos : [];
      if (objetivos.length > 0) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text('Objetivos:', M + 2, y + 3);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        objetivos.forEach((obj: string) => {
          y = checkPage(doc, y, 5, M);
          doc.text(`• ${obj}`, M + 4, y + 3);
          y += 5;
        });
      }

      // Techniques for this phase
      const faseTratamentos = tratamentos.filter((t: any) => t.fase_numero === fase.numero_fase);
      if (faseTratamentos.length > 0) {
        y += 2;
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...DARK);
        doc.text('Técnicas:', M + 2, y + 3);
        y += 5;

        faseTratamentos.forEach((trat: any) => {
          y = checkPage(doc, y, 8, M);
          const tecnica = trat.tecnicas_tratamento || {};
          doc.setFillColor(248, 250, 255);
          doc.roundedRect(M + 2, y, CW - 4, 7, 1.5, 1.5, 'F');
          doc.setFontSize(7);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...DARK);
          doc.text(tecnica.nome || trat.tecnica_id || '', M + 5, y + 4.5);
          if (tecnica.nivel_evidencia) {
            doc.setFontSize(5.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...GRAY);
            doc.text(`Evidência: ${tecnica.nivel_evidencia}`, W - M - 6, y + 4.5, { align: 'right' });
          }
          y += 9;
        });
      }
      y += 4;
    });

    // Prognose from scores
    if (protocolo.scores_avaliacao) {
      y = checkPage(doc, y, 12, M);
      doc.setFillColor(...LIGHT);
      doc.roundedRect(M, y, CW, 10, 2, 2, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...DARK);
      doc.text('Hierarquia Terapêutica:', M + 4, y + 6);
      if (protocolo.hierarquia_terapeutica) {
        const h = Array.isArray(protocolo.hierarquia_terapeutica) ? protocolo.hierarquia_terapeutica : [];
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...GRAY);
        doc.text(h.map((i: string) => i.replace(/_/g, ' ')).join(' → '), M + 50, y + 6);
      }
      y += 14;
    }

  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...GRAY);
    doc.text('Nenhuma diretriz de tratamento ativa para este paciente.', M, y);
    y += 8;
  }

  // ═══════════════════════════════════════════════════════
  // NOTA CLÍNICA FINAL
  // ═══════════════════════════════════════════════════════
  y = checkPage(doc, y + 8, 30, M);

  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, CW, 22, 3, 3, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('Nota Clínica', M + CW / 2, y + 6, { align: 'center' });
  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(180, 200, 225);
  const notaTexts = [
    'Este documento integra os resultados da avaliação MyID, avaliação estrutural e diretriz de tratamento ativa.',
    'Os dados clínicos apresentados devem ser interpretados pelo profissional de saúde no contexto da avaliação presencial.',
    'Não constitui diagnóstico isolado. A consistência no tratamento potencializa resultados em até 70%.',
  ];
  notaTexts.forEach((txt, i) => {
    doc.text(txt, M + CW / 2, y + 11 + i * 4, { align: 'center' });
  });

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
    doc.text('·  Resposta Completa  ·  Documento confidencial', M + 18, 292);
    doc.text(`Página ${i} de ${totalPages}`, W - M, 292, { align: 'right' });
  }

  doc.save(`MyHealthID_RespostaCompleta_${avaliacao.pacienteNome.replace(/\s+/g, '_')}_${dataAvaliacao.replace(/\//g, '-')}.pdf`);
}
