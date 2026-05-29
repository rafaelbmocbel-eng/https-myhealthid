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
  const HERO_H = 88;

  // Fundo claro da página inteira primeiro
  doc.setFillColor(...c(LIGHT));
  doc.rect(0, 0, 210, 297, 'F');

  // Banda navy do hero
  doc.setFillColor(...c(NAVY));
  doc.rect(0, 0, 210, HERO_H, 'F');

  // Faixa dourada inferior do hero
  doc.setFillColor(...c(GOLD));
  doc.rect(0, HERO_H, 210, 1, 'F');

  // Faixa dourada lateral
  doc.setFillColor(...c(GOLD));
  doc.rect(0, 0, 4, HERO_H, 'F');

  // Marca d'água sutil dentro do hero
  await drawFingerprintWatermark(doc, 130, 0, 110, 0.07);

  // Marca pequena no topo direito
  await drawFingerprintMark(doc, 178, 14, 16);

  // Marca / clínica
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...c(GOLD));
  doc.text((data.clinicaNome || 'MY HEALTH ID').toUpperCase(), 22, 16, { charSpace: 1.4 });

  doc.setFontSize(7);
  doc.setTextColor(200, 195, 180);
  doc.text('PROPOSTA DE TRATAMENTO PERSONALIZADA', 22, 22, { charSpace: 1.3 });

  // Título compacto
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(...c(WHITE));
  doc.text('Seu plano de recuperação', 22, 38);
  doc.setTextColor(...c(GOLD));
  doc.text('começa aqui.', 22, 50);

  // Para quem
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 175, 160);
  doc.text('PREPARADO PARA', 22, 60, { charSpace: 1.2 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...c(WHITE));
  doc.text(data.pacienteNome, 22, 68);

  if (data.queixaPrincipal) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(220, 215, 200);
    const linhas = wrap(doc, data.queixaPrincipal, 100).slice(0, 2);
    doc.text(linhas, 22, 75);
  }

  // Mini-strip de dados do pacote (direita do hero)
  const totalBruto = data.pacote.numeroSessoes * data.pacote.valorSessao;
  const desc = data.pacote.desconto || 0;
  const total = totalBruto * (1 - desc / 100);

  const stripX = 128;
  const stripY = 58;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(200, 195, 180);
  doc.text('PLANO', stripX, stripY, { charSpace: 1 });
  doc.text('SESSÕES', stripX + 22, stripY, { charSpace: 1 });
  doc.text('INVESTIMENTO', stripX + 44, stripY, { charSpace: 1 });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...c(WHITE));
  doc.text(`${data.fases.length} fases`, stripX, stripY + 6);
  doc.text(String(data.pacote.numeroSessoes), stripX + 22, stripY + 6);
  doc.setTextColor(...c(GOLD));
  doc.text(total > 0 ? brl(total) : 'Consulta', stripX + 44, stripY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 195, 180);
  doc.text(data.pacote.frequencia, stripX, stripY + 11);
  doc.text(data.pacote.duracao, stripX + 22, stripY + 11);
  if (desc > 0) {
    doc.text(`${desc}% off`, stripX + 44, stripY + 11);
  }

  // Profissional + data (rodapé do hero)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(180, 175, 160);
  doc.text(
    `Por ${data.profissionalNome || 'seu profissional'}${data.profissionalRegistro ? ' · ' + data.profissionalRegistro : ''}`,
    22, 83
  );
  doc.text(new Date().toLocaleDateString('pt-BR'), 188, 83, { align: 'right' });
  if (data.validadeDias) {
    doc.text(`Válida por ${data.validadeDias} dias`, 105, 83, { align: 'center' });
  }

  return HERO_H + 8;
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
    const focos = (f.focos || []).slice(0, 6);
    const tecnicas = (f.tecnicas || []).slice(0, 10);

    // ---- pré-medir (mesma fonte/tamanho usados depois) ----
    // Cabeçalho do card (número + título + semanas): ~16mm
    let measuredBody = 0;

    let objLines: string[] = [];
    if (f.objetivo) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      objLines = wrap(doc, `"${f.objetivo}"`, 138).slice(0, 3);
      measuredBody += objLines.length * 4.2 + 2;
    }

    type FocoLines = { lines: string[] };
    const focoMeas: FocoLines[] = [];
    if (focos.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      focos.forEach((foco) => {
        const fl = wrap(doc, foco, 135).slice(0, 2);
        focoMeas.push({ lines: fl });
        measuredBody += fl.length * 4.5;
      });
      measuredBody += 1;
    }

    type TecMeas = { titulo: string; justLines: string[]; badge: string };
    const tecMeas: TecMeas[] = [];
    if (tecnicas.length) {
      measuredBody += 6; // título "Técnicas (n)"
      tecnicas.forEach((t) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        const tit = t.tecnica;
        const badgeParts = [t.lente_clinica, t.nivel_evidencia ? `N${t.nivel_evidencia}` : '']
          .filter(Boolean).join(' · ');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        const justLines = t.justificativa ? wrap(doc, t.justificativa, 138).slice(0, 3) : [];
        tecMeas.push({ titulo: tit, justLines, badge: badgeParts });
        measuredBody += 5 + justLines.length * 3.8 + 2;
      });
    }

    const cabecalho = 16;
    const padBottom = 4;
    const altura = cabecalho + measuredBody + padBottom;

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
    doc.setFontSize(20);
    doc.setTextColor(...c(corFase));
    doc.text(String(f.numero), 30, y + 12);

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

    let yi = y + cabecalho;

    // Objetivo
    if (objLines.length) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(...c(TEXT));
      doc.text(objLines, 30, yi);
      yi += objLines.length * 4.2 + 2;
    }

    // Focos
    if (focoMeas.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      focoMeas.forEach((fm) => {
        doc.setTextColor(...c(corFase));
        doc.text('•', 30, yi);
        doc.setTextColor(...c(TEXT));
        doc.text(fm.lines[0], 33, yi);
        yi += 4.5;
        if (fm.lines[1]) {
          doc.text(fm.lines[1], 33, yi);
          yi += 4.5;
        }
      });
      yi += 1;
    }

    // Técnicas (a parte que faltava)
    if (tecMeas.length) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...c(GOLD));
      doc.text(`TÉCNICAS DA DIRETRIZ (${tecMeas.length})`, 30, yi, { charSpace: 0.8 });
      yi += 5;

      tecMeas.forEach((t) => {
        // título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...c(NAVY));
        doc.text(`› ${t.titulo}`, 30, yi);

        // badge à direita
        if (t.badge) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...c(MUTED));
          doc.text(t.badge, 186, yi, { align: 'right' });
        }
        yi += 4;

        // justificativa
        if (t.justLines.length) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(...c(TEXT));
          doc.text(t.justLines, 33, yi);
          yi += t.justLines.length * 3.8;
        }
        yi += 2;
      });
    }

    y += altura + 4;
  });

  return y;
}


// =============== PLANO DE MANUTENÇÃO ===============
function drawManutencao(doc: jsPDF, y: number, m?: PlanoManutencao): number {
  if (!m) return y;
  const hasContent =
    m.mensagemPaciente ||
    (m.rotinaMinima && m.rotinaMinima.length) ||
    m.frequenciaReavaliacao ||
    (m.sinaisParaRetornar && m.sinaisParaRetornar.length) ||
    (m.habitosChave && m.habitosChave.length);
  if (!hasContent) return y;

  y = ensure(doc, y + 4, 40);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...c(NAVY));
  doc.text('PLANO DE MANUTENÇÃO (PÓS-ALTA)', 22, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...c(MUTED));
  doc.text('Como manter os resultados após o tratamento concluído.', 22, y);
  y += 5;

  // Card verde
  const blocks: Array<{ titulo: string; itens: string[] }> = [];
  if (m.rotinaMinima?.length) blocks.push({ titulo: 'Rotina mínima', itens: m.rotinaMinima.slice(0, 5) });
  if (m.habitosChave?.length) blocks.push({ titulo: 'Hábitos-chave', itens: m.habitosChave.slice(0, 5) });
  if (m.sinaisParaRetornar?.length) blocks.push({ titulo: 'Voltar ao profissional se', itens: m.sinaisParaRetornar.slice(0, 5) });

  const totalItens = blocks.reduce((acc, b) => acc + b.itens.length + 1, 0);
  const extraMsg = m.mensagemPaciente ? 12 : 0;
  const extraFreq = m.frequenciaReavaliacao ? 8 : 0;
  const altura = 10 + extraMsg + extraFreq + totalItens * 4.8 + 4;

  y = ensure(doc, y, altura + 6);

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...c(GREEN));
  doc.setLineWidth(0.3);
  doc.roundedRect(22, y, 166, altura, 2.5, 2.5, 'FD');
  doc.setFillColor(...c(GREEN));
  doc.rect(22, y, 2.5, altura, 'F');

  let yi = y + 6;

  if (m.mensagemPaciente) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(...c(TEXT));
    const ml = wrap(doc, `"${m.mensagemPaciente}"`, 152);
    doc.text(ml.slice(0, 2), 28, yi);
    yi += ml.slice(0, 2).length * 4.5 + 2;
  }

  if (m.frequenciaReavaliacao) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...c(NAVY));
    doc.text('Reavaliação:', 28, yi);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...c(TEXT));
    doc.text(m.frequenciaReavaliacao, 53, yi);
    yi += 6;
  }

  blocks.forEach((b) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...c(NAVY));
    doc.text(b.titulo, 28, yi);
    yi += 4.5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...c(TEXT));
    b.itens.forEach((it) => {
      doc.setTextColor(...c(GREEN));
      doc.text('•', 30, yi);
      doc.setTextColor(...c(TEXT));
      const fl = wrap(doc, it, 150);
      doc.text(fl[0], 33, yi);
      yi += 4.5;
    });
  });

  return y + altura + 4;
}
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
  // Card compacto — cabe junto com investimento
  y = ensure(doc, y + 4, 30);

  doc.setFillColor(...c(NAVY));
  doc.roundedRect(22, y, 166, 26, 3, 3, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(22, y, 2.5, 26, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...c(WHITE));
  doc.text('Vamos começar?', 30, y + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 215, 200);
  const msg = data.ctaMensagem
    || 'Responda esta proposta para reservarmos sua primeira sessão.';
  const ml = wrap(doc, msg, 110).slice(0, 2);
  doc.text(ml, 30, y + 17);

  if (data.ctaTelefone) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...c(GOLD));
    doc.text(data.ctaTelefone, 186, y + 14, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(200, 195, 180);
    doc.text('WHATSAPP', 186, y + 9, { align: 'right', charSpace: 1.2 });
  }

  if (data.validadeDias) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(200, 195, 180);
    doc.text(`Válida por ${data.validadeDias} dias`, 186, y + 21, { align: 'right' });
  }

  return y + 30;
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
  y = drawManutencao(doc, y, data.manutencao);
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
