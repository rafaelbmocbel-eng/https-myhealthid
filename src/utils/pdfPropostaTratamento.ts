/**
 * PDF de PROPOSTA DE TRATAMENTO — versão comercial premium da diretriz.
 * Layout em 2 páginas com aproveitamento total do espaço.
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

// IMPORTANTE: jsPDF mantém charSpace entre chamadas — resetar sempre.
const resetCS = (doc: jsPDF) => doc.setCharSpace(0);

// As fontes padrão do jsPDF (helvetica/times/courier) só suportam WinAnsiEncoding.
// Símbolos clínicos comuns no texto gerado pela IA (≤, ≥, ✓ etc.) caem fora desse
// conjunto e são renderizados como glifos corrompidos no PDF final — substituímos
// por equivalentes ASCII antes de desenhar qualquer texto.
const PDF_UNSAFE_CHARS: Record<string, string> = {
  '≤': '<=', // ≤
  '≥': '>=', // ≥
  '±': '+/-', // ±
  '→': '->', // →
  '←': '<-', // ←
  '✓': 'OK', // ✓
  '✔': 'OK', // ✔
  '✗': 'X', // ✗
  '✘': 'X', // ✘
  '×': 'x', // ×
};
const PDF_UNSAFE_REGEX = new RegExp(`[${Object.keys(PDF_UNSAFE_CHARS).join('')}]`, 'g');

function sanitizeForPDF(text: string): string {
  return text.replace(PDF_UNSAFE_REGEX, (ch) => PDF_UNSAFE_CHARS[ch] ?? ch);
}

function sanitizeDataForPDF<T>(value: T): T {
  if (typeof value === 'string') return sanitizeForPDF(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDataForPDF(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeDataForPDF(v);
    return out as T;
  }
  return value;
}

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
  semanas?: string;
  focos?: string[];
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
    frequencia: string;
    duracao: string;
    valorSessao: number;
    desconto?: number;
    formaPagamento?: string;
  };
  ctaTelefone?: string;
  ctaMensagem?: string;
  validadeDias?: number;
}

function paintBg(doc: jsPDF) {
  doc.setFillColor(...c(LIGHT));
  doc.rect(0, 0, 210, 297, 'F');
}

function wrap(doc: jsPDF, text: string, maxW: number): string[] {
  return doc.splitTextToSize(text || '', maxW);
}

function brl(n: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
}

// Label com tracking de letras — isola charSpace.
function label(doc: jsPDF, text: string, x: number, y: number, opts?: { align?: 'left' | 'right' | 'center' }) {
  doc.setCharSpace(1.2);
  doc.text(text, x, y, opts ? { align: opts.align } : undefined);
  doc.setCharSpace(0);
}

// =============== HERO (topo página 1) — 62mm ===============
async function drawHero(doc: jsPDF, data: PDFPropostaData): Promise<number> {
  const HERO_H = 62;
  paintBg(doc);

  doc.setFillColor(...c(NAVY));
  doc.rect(0, 0, 210, HERO_H, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(0, HERO_H, 210, 0.8, 'F');
  doc.rect(0, 0, 3, HERO_H, 'F');

  await drawFingerprintWatermark(doc, 130, -10, 90, 0.07);
  await drawFingerprintMark(doc, 180, 11, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...c(GOLD));
  label(doc, (data.clinicaNome || 'MY HEALTH ID').toUpperCase(), 22, 12);

  doc.setFontSize(6.5);
  doc.setTextColor(200, 195, 180);
  label(doc, 'PROPOSTA DE TRATAMENTO PERSONALIZADA', 22, 17);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(...c(WHITE));
  resetCS(doc);
  doc.text('Seu plano de recuperação', 22, 28);
  doc.setTextColor(...c(GOLD));
  doc.text('começa aqui.', 22, 37);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(180, 175, 160);
  label(doc, 'PREPARADO PARA', 22, 45);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...c(WHITE));
  resetCS(doc);
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
  label(doc, 'PLANO', stripX, stripY);
  label(doc, 'SESSÕES', stripX + 22, stripY);
  label(doc, 'INVESTIMENTO', stripX + 44, stripY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(WHITE));
  resetCS(doc);
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

  doc.setFontSize(6.5);
  doc.setTextColor(180, 175, 160);
  doc.text(
    `Por ${data.profissionalNome || 'seu profissional'}${data.profissionalRegistro ? ' · ' + data.profissionalRegistro : ''}`,
    22, 59
  );
  doc.text(new Date().toLocaleDateString('pt-BR'), 188, 59, { align: 'right' });

  return HERO_H + 6;
}

// =============== DIAGNÓSTICO ===============
function drawDiagnostico(doc: jsPDF, y: number, data: PDFPropostaData): number {
  if (!data.resumoClinico && !data.classificacao && !data.prognostico) return y;

  resetCS(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(NAVY));
  label(doc, 'O QUE ENCONTRAMOS NA SUA AVALIAÇÃO', 22, y);

  if (data.classificacao) {
    const up = data.classificacao.toUpperCase();
    const cor = up.includes('GRAV') || up.includes('CRÍT') || up.includes('SEVER') ? RED
      : up.includes('MOD') ? AMBER : GREEN;
    resetCS(doc);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    // Pílula em linha própria (abaixo do título) com largura dinâmica — classificações
    // mais longas (ex.: "Risco de Cronificação") nunca vazam a cor de fundo nem colidem
    // com o título acima. Sem tracking de letras aqui: com align:'center' o jsPDF mede a
    // largura ANTES de aplicar charSpace e desenha DEPOIS, descentralizando o texto e
    // furando a pílula — por isso este texto fica sem tracking, só assim o cálculo de
    // largura via getTextWidth é exato.
    const pillW = Math.max(30, doc.getTextWidth(up) + 10);
    const pillX = 188 - pillW;
    const pillY = y + 6;
    doc.setFillColor(...c(cor));
    doc.roundedRect(pillX, pillY - 4, pillW, 6, 1.5, 1.5, 'F');
    doc.setTextColor(...c(WHITE));
    doc.text(up, pillX + pillW / 2, pillY, { align: 'center' });
    y += 6;
  }
  y += 5;

  if (data.resumoClinico) {
    resetCS(doc);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...c(TEXT));
    const lines = wrap(doc, data.resumoClinico, 166).slice(0, 4);
    doc.text(lines, 22, y);
    y += lines.length * 4.2 + 2;
  }

  if (data.prognostico) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...c(GOLD));
    label(doc, 'PROGNÓSTICO', 22, y);
    y += 4.5;
    resetCS(doc);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...c(TEXT));
    const linesP = wrap(doc, data.prognostico, 166).slice(0, 2);
    doc.text(linesP, 22, y);
    y += linesP.length * 4.2 + 2;
  }
  return y + 3;
}

// =============== PLANO EM FASES ===============
function drawFases(doc: jsPDF, y: number, fases: FasePlano[], maxBottom: number): number {
  resetCS(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(NAVY));
  label(doc, 'SEU PLANO EM 3 FASES', 22, y);
  y += 5;

  const FASE_COLORS: C3[] = [RED, AMBER, GREEN];
  const n = Math.min(3, fases.length);
  // Distribuir altura uniforme no espaço disponível
  const espaco = maxBottom - y;
  const gap = 3;
  const alturaCard = Math.min(48, (espaco - gap * (n - 1)) / n);

  fases.slice(0, n).forEach((f, idx) => {
    const corFase = FASE_COLORS[idx] || NAVY;
    const focos = (f.focos || []).slice(0, 4);
    const tecnicas = (f.tecnicas || []).slice(0, 5);

    doc.setFillColor(...c(WHITE));
    doc.setDrawColor(...c(SOFT));
    doc.setLineWidth(0.2);
    doc.roundedRect(22, y, 166, alturaCard, 2, 2, 'FD');
    doc.setFillColor(...c(corFase));
    doc.rect(22, y, 2, alturaCard, 'F');

    resetCS(doc);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...c(corFase));
    doc.text(String(f.numero), 28, y + 8);

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
    if (f.objetivo) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(...c(TEXT));
      const ol = wrap(doc, `"${f.objetivo}"`, 156).slice(0, 1);
      doc.text(ol, 28, yi);
      yi += 4.5;
    }

    const colY = yi;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...c(GOLD));
    if (focos.length) label(doc, 'FOCOS', 28, colY - 1);
    if (tecnicas.length) label(doc, 'TÉCNICAS', 110, colY - 1);

    resetCS(doc);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    focos.forEach((foco, i) => {
      const yLine = colY + 3 + i * 4;
      if (yLine > y + alturaCard - 2) return;
      doc.setTextColor(...c(corFase));
      doc.text('•', 28, yLine);
      doc.setTextColor(...c(TEXT));
      const fl = wrap(doc, foco, 75).slice(0, 1);
      doc.text(fl, 31, yLine);
    });

    tecnicas.forEach((t, i) => {
      const yLine = colY + 3 + i * 4;
      if (yLine > y + alturaCard - 2) return;
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

    y += alturaCard + gap;
  });

  return y;
}

// =============== MANUTENÇÃO ===============
function drawManutencao(doc: jsPDF, y: number, m?: PlanoManutencao): number {
  if (!m) return y;
  const hasContent =
    m.mensagemPaciente ||
    (m.rotinaMinima && m.rotinaMinima.length) ||
    m.frequenciaReavaliacao ||
    (m.sinaisParaRetornar && m.sinaisParaRetornar.length) ||
    (m.habitosChave && m.habitosChave.length);
  if (!hasContent) return y;

  resetCS(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(NAVY));
  label(doc, 'PLANO DE MANUTENÇÃO (PÓS-ALTA)', 22, y);
  y += 5;

  const rotina = (m.rotinaMinima || []).slice(0, 4);
  const habitos = (m.habitosChave || []).slice(0, 4);
  const sinais = (m.sinaisParaRetornar || []).slice(0, 4);
  const linhasCol = Math.max(rotina.length, habitos.length, sinais.length, 1);

  const msgLines = m.mensagemPaciente
    ? wrap(doc, `"${m.mensagemPaciente}"`, 158).slice(0, 2)
    : [];
  const altura = 5 + msgLines.length * 4 + (m.frequenciaReavaliacao ? 5 : 0) + 6 + linhasCol * 4 + 4;

  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(...c(GREEN));
  doc.setLineWidth(0.3);
  doc.roundedRect(22, y, 166, altura, 2, 2, 'FD');
  doc.setFillColor(...c(GREEN));
  doc.rect(22, y, 2, altura, 'F');

  let yi = y + 5;
  if (msgLines.length) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...c(TEXT));
    doc.text(msgLines, 28, yi);
    yi += msgLines.length * 4 + 1;
  }
  if (m.frequenciaReavaliacao) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...c(NAVY));
    const reavaliacaoLabel = 'Reavaliação:';
    doc.text(reavaliacaoLabel, 28, yi);
    const reavaliacaoLabelW = doc.getTextWidth(reavaliacaoLabel);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...c(TEXT));
    doc.text(m.frequenciaReavaliacao, 28 + reavaliacaoLabelW + 2, yi);
    yi += 5;
  }

  const cols = [
    { titulo: 'ROTINA MÍNIMA', itens: rotina, x: 28 },
    { titulo: 'HÁBITOS-CHAVE', itens: habitos, x: 82 },
    { titulo: 'VOLTAR SE', itens: sinais, x: 138 },
  ];
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...c(GOLD));
  cols.forEach((col) => col.itens.length && label(doc, col.titulo, col.x, yi));
  yi += 4;
  resetCS(doc);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  cols.forEach((col) => {
    col.itens.forEach((it, i) => {
      const yLine = yi + i * 4;
      doc.setTextColor(...c(GREEN));
      doc.text('•', col.x, yLine);
      doc.setTextColor(...c(TEXT));
      const fl = wrap(doc, it, 48).slice(0, 1);
      doc.text(fl, col.x + 2.5, yLine);
    });
  });

  return y + altura + 5;
}

// =============== PÁGINA 2: HEADER NAVY ===============
async function drawPage2Header(doc: jsPDF, data: PDFPropostaData): Promise<number> {
  const H = 36;
  paintBg(doc);

  doc.setFillColor(...c(NAVY));
  doc.rect(0, 0, 210, H, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(0, H, 210, 0.8, 'F');
  doc.rect(0, 0, 3, H, 'F');

  await drawFingerprintWatermark(doc, 140, -8, 70, 0.06);
  await drawFingerprintMark(doc, 188, 18, 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...c(GOLD));
  label(doc, 'INVESTIMENTO & PRÓXIMOS PASSOS', 22, 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(...c(WHITE));
  resetCS(doc);
  doc.text('O plano completo,', 22, 24);
  doc.setTextColor(...c(GOLD));
  doc.text('por um valor justo.', 22, 32);

  return H + 8;
}

// =============== INVESTIMENTO (grande, página 2) ===============
function drawInvestimento(doc: jsPDF, y: number, data: PDFPropostaData): number {
  const p = data.pacote;
  const bruto = p.numeroSessoes * p.valorSessao;
  const desc = p.desconto || 0;
  const total = bruto * (1 - desc / 100);
  const valorPorSessao = total / Math.max(1, p.numeroSessoes);

  const H = 72;
  doc.setFillColor(...c(NAVY));
  doc.roundedRect(22, y, 166, H, 3, 3, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(22, y, 2.5, H, 'F');

  resetCS(doc);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...c(GOLD));
  label(doc, 'PACOTE COMPLETO', 28, y + 9);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...c(WHITE));
  resetCS(doc);
  doc.text(`${p.numeroSessoes} sessões`, 28, y + 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(220, 215, 200);
  doc.text(`${p.frequencia}  ·  ${p.duracao}`, 28, y + 25);

  // Divisor
  doc.setDrawColor(...c(GOLD));
  doc.setLineWidth(0.3);
  doc.line(28, y + 30, 180, y + 30);

  // Total à esquerda
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 195, 180);
  label(doc, 'INVESTIMENTO TOTAL', 28, y + 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...c(GOLD));
  resetCS(doc);
  doc.text(brl(total), 28, y + 52);

  if (desc > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(200, 195, 180);
    doc.text(`de ${brl(bruto)}  ·  você economiza ${brl(bruto - total)} (${desc}%)`, 28, y + 58);
  }

  if (p.formaPagamento) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(220, 215, 200);
    const fp = wrap(doc, p.formaPagamento, 90).slice(0, 2);
    doc.text(fp, 28, y + 65);
  }

  // Por sessão à direita
  doc.setFillColor(255, 255, 255, 0.06 as any);
  // separador vertical
  doc.setDrawColor(...c(GOLD));
  doc.setLineWidth(0.2);
  doc.line(125, y + 36, 125, y + H - 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 195, 180);
  label(doc, 'POR SESSÃO', 132, y + 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...c(WHITE));
  resetCS(doc);
  doc.text(brl(valorPorSessao), 132, y + 50);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(200, 195, 180);
  doc.text('valor unitário equivalente', 132, y + 56);

  if (desc > 0) {
    doc.setFontSize(7);
    doc.setTextColor(...c(GOLD));
    doc.text(`com ${desc}% de desconto aplicado`, 132, y + 61);
  }

  return y + H + 8;
}

// Desenha um "check" vetorial centrado em (cx, cy) — evita depender do glifo ✓,
// que não existe no conjunto WinAnsi das fontes padrão do jsPDF.
function drawCheckmark(doc: jsPDF, cx: number, cy: number) {
  doc.setDrawColor(...c(WHITE));
  doc.setLineWidth(0.45);
  doc.line(cx - 0.7, cy + 0.05, cx - 0.15, cy + 0.55);
  doc.line(cx - 0.15, cy + 0.55, cx + 0.75, cy - 0.55);
}

// =============== BENEFÍCIOS (página 2) ===============
function drawBeneficios(doc: jsPDF, y: number): number {
  resetCS(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...c(NAVY));
  label(doc, 'O QUE ESTÁ INCLUSO', 22, y);
  y += 6;

  const beneficios: { titulo: string; desc: string }[] = [
    { titulo: 'Plano clínico em 3 fases', desc: 'Estruturado com base na sua avaliação MyID.' },
    { titulo: 'Acompanhamento direto', desc: 'Com o seu profissional ao longo de todo o tratamento.' },
    { titulo: 'Portal do paciente', desc: 'Missões, evolução, exercícios e métricas em tempo real.' },
    { titulo: 'Reavaliações periódicas', desc: 'Ajustes de plano conforme sua evolução.' },
    { titulo: 'Plano de manutenção pós-alta', desc: 'Para você manter os ganhos e prevenir recidivas.' },
    { titulo: 'Suporte via WhatsApp', desc: 'Tire dúvidas e mantenha a continuidade do cuidado.' },
  ];

  const colW = 83;
  const rowH = 13;
  beneficios.forEach((b, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const xb = 22 + col * colW;
    const yb = y + row * rowH;

    doc.setFillColor(...c(GOLD));
    doc.circle(xb + 2, yb + 2, 1.5, 'F');
    drawCheckmark(doc, xb + 2, yb + 2);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...c(NAVY));
    doc.text(b.titulo, xb + 7, yb + 2.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...c(MUTED));
    const dl = wrap(doc, b.desc, colW - 10).slice(0, 2);
    doc.text(dl, xb + 7, yb + 7);
  });

  return y + Math.ceil(beneficios.length / 2) * rowH + 4;
}

// =============== GARANTIAS (página 2) ===============
function drawGarantias(doc: jsPDF, y: number): number {
  const H = 26;
  doc.setFillColor(...c(WHITE));
  doc.setDrawColor(...c(SOFT));
  doc.setLineWidth(0.3);
  doc.roundedRect(22, y, 166, H, 2, 2, 'FD');
  doc.setFillColor(...c(GOLD));
  doc.rect(22, y, 2, H, 'F');

  resetCS(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...c(GOLD));
  label(doc, 'COMPROMISSO DE CUIDADO', 28, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...c(TEXT));
  resetCS(doc);
  const txt =
    'Este plano é construído sob medida para você, com base em evidências clínicas atuais e ' +
    'na sua avaliação MyID. Caso seu quadro evolua mais rápido ou exija mais tempo, o plano ' +
    'é reajustado sem custo adicional dentro do pacote contratado.';
  const lines = wrap(doc, txt, 156).slice(0, 3);
  doc.text(lines, 28, y + 13);

  return y + H + 8;
}

// =============== CTA (página 2, grande) ===============
function drawCTA(doc: jsPDF, y: number, data: PDFPropostaData): number {
  const H = 38;
  doc.setFillColor(...c(NAVY));
  doc.roundedRect(22, y, 166, H, 3, 3, 'F');
  doc.setFillColor(...c(GOLD));
  doc.rect(22, y, 2.5, H, 'F');

  resetCS(doc);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...c(WHITE));
  doc.text('Vamos começar?', 28, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(220, 215, 200);
  const msg = data.ctaMensagem
    || 'Responda esta proposta para reservarmos sua primeira sessão e iniciarmos o tratamento ainda esta semana.';
  const ml = wrap(doc, msg, 105).slice(0, 3);
  doc.text(ml, 28, y + 18);

  if (data.ctaTelefone) {
    // Botão WhatsApp
    doc.setFillColor(...c(GOLD));
    doc.roundedRect(138, y + 8, 46, 13, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...c(NAVY));
    label(doc, 'WHATSAPP', 161, y + 13, { align: 'center' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    resetCS(doc);
    doc.text(data.ctaTelefone, 161, y + 18.5, { align: 'center' });
  }

  if (data.validadeDias) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(200, 195, 180);
    doc.text(`Esta proposta é válida por ${data.validadeDias} dias.`, 184, y + 33, { align: 'right' });
  }

  return y + H;
}

// =============== RODAPÉ ===============
function drawFooter(doc: jsPDF, page: number, total: number, data: PDFPropostaData) {
  resetCS(doc);
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
export async function gerarPDFPropostaTratamento(rawData: PDFPropostaData): Promise<Blob> {
  const data = sanitizeDataForPDF(rawData);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // PÁGINA 1 — hero + diagnóstico + 3 fases + manutenção
  let y = await drawHero(doc, data);
  y = drawDiagnostico(doc, y, data);
  // Reserva espaço para Manutenção (~55mm) no fim da página 1
  const manutencaoTop = 230;
  y = drawFases(doc, y, data.fases, manutencaoTop - 6);
  drawManutencao(doc, manutencaoTop, data.manutencao);

  // PÁGINA 2 — header + investimento + benefícios + garantias + CTA
  doc.addPage();
  let y2 = await drawPage2Header(doc, data);
  y2 = drawInvestimento(doc, y2, data);
  y2 = drawBeneficios(doc, y2);
  y2 = drawGarantias(doc, y2);
  drawCTA(doc, y2, data);

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
