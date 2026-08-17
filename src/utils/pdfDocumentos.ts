import jsPDF from 'jspdf';
import { addLogoToDoc } from './pdfLogoHelper';
import { format } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import {
  fmtDate,
  fmtCurrency,
  pacienteLine,
  parseDataLocal,
  corpoPadraoDocumento,
} from './documentosTexto';

export type TipoDocumento =
  | 'comparecimento'
  | 'atestado_fisio'
  | 'declaracao_tratamento'
  | 'recibo'
  | 'laudo_cinetico';

export interface ClinicaInfo {
  razao_social?: string | null;
  cnpj?: string | null;
  responsavel?: string | null;
  telefone?: string | null;
  email_clinica?: string | null;
  endereco?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
  horario_funcionamento?: string | null;
  logo_url?: string | null;
}

export interface TerapeutaInfo {
  nome: string;
  sobrenome?: string;
  registro?: string | null; // CREFITO/CRM
  especialidade?: string | null;
}

export interface PacienteInfo {
  nome: string;
  sobrenome?: string;
  cpf?: string | null;
  rg?: string | null;
}

// Campos comuns a todos os documentos de texto corrido: corpo editável pelo
// usuário (se vier, substitui o texto padrão) e data de emissão editável.
export interface DocTextoComum {
  corpo?: string;        // texto do corpo já editado pelo usuário (opcional)
  dataEmissao?: string;  // ISO date da emissão (opcional; padrão = hoje)
}

export interface DocComparecimentoData extends DocTextoComum {
  data: string;          // ISO date
  horaEntrada: string;   // HH:mm
  horaSaida: string;     // HH:mm
  acompanhante?: string;
}

export interface DocAtestadoFisioData extends DocTextoComum {
  diasAfastamento: number;
  dataInicio: string;    // ISO date
  cid?: string;
  motivo?: string;
  cif?: string;          // Classificação Internacional de Funcionalidade
  cifDescricao?: string;
}

export interface DocDeclaracaoData extends DocTextoComum {
  desde: string;         // ISO date
  finalidade?: string;   // empresa/escola/seguro
  observacoes?: string;
}

export interface DocReciboData extends DocTextoComum {
  valor: number;
  referente: string;
  formaPagamento?: string;
  numeroSessoes?: number;
}

export interface DocLaudoCineticoData {
  dataEmissao?: string;    // ISO date da emissão (opcional; padrão = hoje)
  // Identificação extra
  dataNascimento?: string | null;
  sexo?: string | null;
  profissao?: string | null;
  // Anamnese
  queixaPrincipal: string;
  hma: string;             // História da Moléstia Atual
  hpp?: string;            // História Pregressa
  medicamentos?: string;
  // Exame físico
  exameFisico: string;
  testesEspeciais?: string;
  // Diagnóstico funcional
  diagnosticoFuncional: string;
  cidPrincipal?: string;
  cifCodigos?: string;     // ex: b280.2, d450.1
  // MyID (auto)
  myidScore?: number | null;
  myidClassificacao?: string | null;
  myidDimensoes?: { label: string; valor: number }[];
  // Conduta
  objetivos: string;
  conduta: string;
  frequenciaSugerida?: string;  // ex: "2x/semana por 8 semanas"
  prognostico?: string;
}

interface BaseInput {
  clinica?: ClinicaInfo | null;
  terapeuta: TerapeutaInfo;
  paciente: PacienteInfo;
}

const PRIMARY: [number, number, number] = [28, 55, 83];
const TEXT: [number, number, number] = [30, 30, 46];
const MUTED: [number, number, number] = [107, 114, 128];

async function drawHeader(doc: jsPDF, clinica?: ClinicaInfo | null) {
  const margin = 20;
  // Logo ampliada (~3x): 28mm
  const logoSize = 28;
  await addLogoToDoc(doc, margin, 10, logoSize, clinica?.logo_url || undefined);

  const textX = margin + logoSize + 6;
  const nome = clinica?.razao_social || 'MY HEALTH ID';

  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  // Nome da clínica grande e proeminente
  doc.setFontSize(18);
  const nomeLines = doc.splitTextToSize(nome, 210 - textX - margin);
  doc.text(nomeLines, textX, 19);

  let yMeta = 19 + nomeLines.length * 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);

  const lineParts: string[] = [];
  if (clinica?.cnpj) lineParts.push(`CNPJ ${clinica.cnpj}`);
  const endParts: string[] = [];
  if (clinica?.endereco) endParts.push(clinica.endereco);
  if (clinica?.cidade) endParts.push(`${clinica.cidade}${clinica.uf ? '/' + clinica.uf : ''}`);
  if (clinica?.cep) endParts.push(`CEP ${clinica.cep}`);
  if (endParts.length) lineParts.push(endParts.join(', '));
  if (lineParts.length) {
    doc.text(lineParts.join(' · '), textX, yMeta);
    yMeta += 4;
  }

  const contato: string[] = [];
  if (clinica?.telefone) contato.push(clinica.telefone);
  if (clinica?.email_clinica) contato.push(clinica.email_clinica);
  if (clinica?.horario_funcionamento) contato.push(`Atend.: ${clinica.horario_funcionamento}`);
  if (contato.length) doc.text(contato.join(' · '), textX, yMeta);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, 42, 210 - margin, 42);
}

function drawTitle(doc: jsPDF, title: string, y: number): number {
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title.toUpperCase(), 105, y, { align: 'center' });
  return y + 12;
}

function drawBody(doc: jsPDF, text: string, y: number): number {
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  const margin = 25;
  const maxW = 210 - margin * 2;
  const lineH = 6;
  let cursor = y;

  // Renderiza parágrafo a parágrafo. O 'justify' do jsPDF estica TODAS as linhas
  // até a largura máxima — inclusive a última e curta linha do parágrafo, o que
  // criava aquele "sessão     de     fisioterapia" cheio de buracos. Aqui só as
  // linhas "cheias" são justificadas; a última de cada parágrafo fica à esquerda.
  const paragrafos = String(text).split('\n');
  for (const par of paragrafos) {
    if (par.trim() === '') { cursor += lineH; continue; } // linha em branco = espaçamento
    const linhas: string[] = doc.splitTextToSize(par, maxW);
    linhas.forEach((ln, i) => {
      const ehUltima = i === linhas.length - 1;
      if (ehUltima) {
        doc.text(ln, margin, cursor);
      } else {
        doc.text(ln, margin, cursor, { align: 'justify', maxWidth: maxW });
      }
      cursor += lineH;
    });
  }
  return cursor;
}

async function drawFooter(doc: jsPDF, terapeuta: TerapeutaInfo, clinica?: ClinicaInfo | null, dataEmissao?: string) {
  const yBase = 240;
  const margin = 25;
  // Local e data — data de emissão editável (padrão = hoje).
  const cidade = clinica?.cidade ? `${clinica.cidade}${clinica.uf ? '/' + clinica.uf : ''}, ` : '';
  const dEmissao = dataEmissao ? parseDataLocal(dataEmissao) : new Date();
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${cidade}${format(dEmissao, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, 105, yBase, { align: 'center' });

  // Linha de assinatura
  doc.setDrawColor(...TEXT);
  doc.setLineWidth(0.3);
  doc.line(60, yBase + 25, 150, yBase + 25);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(`${terapeuta.nome}${terapeuta.sobrenome ? ' ' + terapeuta.sobrenome : ''}`, 105, yBase + 31, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const reg: string[] = [];
  if (terapeuta.especialidade) reg.push(terapeuta.especialidade);
  if (terapeuta.registro) reg.push(terapeuta.registro);
  if (reg.length) doc.text(reg.join(' · '), 105, yBase + 36, { align: 'center' });

  // Rodapé — assinatura discreta "feito por My Health ID"
  doc.setFontSize(6.5);
  doc.setTextColor(...MUTED);
  doc.text('feito por My Health ID', 105, 285, { align: 'center' });
}

// ============ GENERATORS ============

export async function gerarComparecimento(input: BaseInput & { dados: DocComparecimentoData }): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Atestado de Comparecimento', 50);

  const text = input.dados.corpo?.trim()
    ? input.dados.corpo
    : corpoPadraoDocumento('comparecimento', input, input.dados)!;

  y = drawBody(doc, text, y + 4);
  await drawFooter(doc, input.terapeuta, input.clinica, input.dados.dataEmissao);
  return doc;
}

export async function gerarAtestadoFisio(input: BaseInput & { dados: DocAtestadoFisioData }): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Atestado Fisioterapêutico', 50);

  const text = input.dados.corpo?.trim()
    ? input.dados.corpo
    : corpoPadraoDocumento('atestado_fisio', input, input.dados)!;

  y = drawBody(doc, text, y + 4);
  await drawFooter(doc, input.terapeuta, input.clinica, input.dados.dataEmissao);
  return doc;
}

export async function gerarDeclaracaoTratamento(input: BaseInput & { dados: DocDeclaracaoData }): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Declaração de Tratamento', 50);

  const text = input.dados.corpo?.trim()
    ? input.dados.corpo
    : corpoPadraoDocumento('declaracao_tratamento', input, input.dados)!;

  y = drawBody(doc, text, y + 4);
  await drawFooter(doc, input.terapeuta, input.clinica, input.dados.dataEmissao);
  return doc;
}

export async function gerarRecibo(input: BaseInput & { dados: DocReciboData }): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Recibo de Pagamento', 50);

  // Caixa do valor
  doc.setFillColor(245, 247, 250);
  doc.setDrawColor(...PRIMARY);
  doc.roundedRect(25, y, 160, 14, 2, 2, 'FD');
  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Valor: ${fmtCurrency(input.dados.valor)}`, 105, y + 9, { align: 'center' });
  y += 22;

  const text = input.dados.corpo?.trim()
    ? input.dados.corpo
    : corpoPadraoDocumento('recibo', input, input.dados)!;

  y = drawBody(doc, text, y);
  await drawFooter(doc, input.terapeuta, input.clinica, input.dados.dataEmissao);
  return doc;
}

// ============ LAUDO CINÉTICO-FUNCIONAL ============

function ageFrom(iso?: string | null): number | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
  } catch { return null; }
}

function drawSection(doc: jsPDF, title: string, y: number): number {
  doc.setFillColor(...PRIMARY);
  doc.rect(20, y, 170, 6, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), 23, y + 4.2);
  return y + 10;
}

function drawField(doc: jsPDF, label: string, value: string, y: number, fullWidth = true): number {
  const margin = 22;
  const width = fullWidth ? 166 : 80;
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(label.toUpperCase(), margin, y);
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const lines = doc.splitTextToSize(value || '—', width);
  doc.text(lines, margin, y + 4);
  return y + 4 + lines.length * 4.5 + 2;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > 270) {
    doc.addPage();
    return 20;
  }
  return y;
}

export async function gerarLaudoCinetico(input: BaseInput & { dados: DocLaudoCineticoData }): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Laudo Cinético-Funcional', 48);
  y += 2;

  // === Identificação ===
  y = drawSection(doc, '1. Identificação do Paciente', y);
  const idade = ageFrom(input.dados.dataNascimento);
  const nomeCompleto = `${input.paciente.nome}${input.paciente.sobrenome ? ' ' + input.paciente.sobrenome : ''}`;
  const idLine = [
    `Nome: ${nomeCompleto}`,
    idade != null ? `Idade: ${idade} anos` : null,
    input.dados.sexo ? `Sexo: ${input.dados.sexo}` : null,
    input.paciente.cpf ? `CPF: ${input.paciente.cpf}` : null,
    input.dados.profissao ? `Profissão: ${input.dados.profissao}` : null,
  ].filter(Boolean).join('  ·  ');
  y = drawField(doc, 'Dados', idLine, y);

  // === Anamnese ===
  y = ensureSpace(doc, y, 30);
  y = drawSection(doc, '2. Anamnese', y);
  y = drawField(doc, 'Queixa Principal', input.dados.queixaPrincipal, y);
  y = ensureSpace(doc, y, 20);
  y = drawField(doc, 'História da Moléstia Atual (HMA)', input.dados.hma, y);
  if (input.dados.hpp) {
    y = ensureSpace(doc, y, 20);
    y = drawField(doc, 'História Pregressa (HPP)', input.dados.hpp, y);
  }
  if (input.dados.medicamentos) {
    y = ensureSpace(doc, y, 15);
    y = drawField(doc, 'Medicamentos em Uso', input.dados.medicamentos, y);
  }

  // === Exame Físico ===
  y = ensureSpace(doc, y, 30);
  y = drawSection(doc, '3. Exame Físico-Funcional', y);
  y = drawField(doc, 'Inspeção, Palpação, ADM e Força', input.dados.exameFisico, y);
  if (input.dados.testesEspeciais) {
    y = ensureSpace(doc, y, 20);
    y = drawField(doc, 'Testes Especiais', input.dados.testesEspeciais, y);
  }

  // === MyID ===
  if (input.dados.myidScore != null || (input.dados.myidDimensoes && input.dados.myidDimensoes.length)) {
    y = ensureSpace(doc, y, 40);
    y = drawSection(doc, '4. Avaliação MyID v2.0', y);
    if (input.dados.myidScore != null) {
      doc.setFillColor(245, 247, 250);
      doc.setDrawColor(...PRIMARY);
      doc.roundedRect(22, y, 166, 14, 2, 2, 'FD');
      doc.setTextColor(...PRIMARY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`Score Global: ${Number(input.dados.myidScore).toFixed(1)} / 100`, 26, y + 6);
      if (input.dados.myidClassificacao) {
        doc.setFontSize(9);
        doc.setTextColor(...TEXT);
        doc.text(`Classificação: ${input.dados.myidClassificacao}`, 26, y + 11);
      }
      y += 18;
    }
    if (input.dados.myidDimensoes?.length) {
      doc.setTextColor(...MUTED);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('PERDAS POR DIMENSÃO (0 = ideal · 10 = pior)', 22, y);
      y += 4;
      const colW = 83;
      const col = 0;
      const yStart = y;
      input.dados.myidDimensoes.forEach((d) => {
        const x = 22 + col * colW;
        const yy = yStart + Math.floor(col === 0 ? 0 : 0); // simple two-col flow
        doc.setTextColor(...TEXT);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`${d.label}:`, x, y + 4);
        // bar
        const barX = x + 38;
        const barW = 35;
        doc.setFillColor(230, 234, 240);
        doc.rect(barX, y + 1, barW, 3.5, 'F');
        const fill = Math.max(0, Math.min(10, d.valor)) / 10;
        const r = Math.round(28 + fill * 200);
        doc.setFillColor(r, 80, 60);
        doc.rect(barX, y + 1, barW * fill, 3.5, 'F');
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text(d.valor.toFixed(1), barX + barW + 2, y + 4);
        y += 6;
      });
      y += 2;
    }
  }

  // === Diagnóstico Funcional ===
  y = ensureSpace(doc, y, 30);
  y = drawSection(doc, '5. Diagnóstico Cinético-Funcional', y);
  y = drawField(doc, 'Diagnóstico', input.dados.diagnosticoFuncional, y);
  if (input.dados.cidPrincipal) {
    y = drawField(doc, 'CID-10', input.dados.cidPrincipal, y);
  }
  if (input.dados.cifCodigos) {
    y = drawField(doc, 'Códigos CIF', input.dados.cifCodigos, y);
  }

  // === Conduta ===
  y = ensureSpace(doc, y, 40);
  y = drawSection(doc, '6. Plano Terapêutico', y);
  y = drawField(doc, 'Objetivos', input.dados.objetivos, y);
  y = ensureSpace(doc, y, 20);
  y = drawField(doc, 'Conduta Fisioterapêutica', input.dados.conduta, y);
  if (input.dados.frequenciaSugerida) {
    y = drawField(doc, 'Frequência Sugerida', input.dados.frequenciaSugerida, y);
  }
  if (input.dados.prognostico) {
    y = ensureSpace(doc, y, 15);
    y = drawField(doc, 'Prognóstico', input.dados.prognostico, y);
  }

  // Assinatura na última página
  y = ensureSpace(doc, y, 50);
  await drawFooter(doc, input.terapeuta, input.clinica, input.dados.dataEmissao);
  return doc;
}

// ============ DISPATCHER ============

export async function gerarDocumento(
  tipo: TipoDocumento,
  input: BaseInput,
  dados: any
): Promise<jsPDF> {
  switch (tipo) {
    case 'comparecimento':
      return gerarComparecimento({ ...input, dados });
    case 'atestado_fisio':
      return gerarAtestadoFisio({ ...input, dados });
    case 'declaracao_tratamento':
      return gerarDeclaracaoTratamento({ ...input, dados });
    case 'recibo':
      return gerarRecibo({ ...input, dados });
    case 'laudo_cinetico':
      return gerarLaudoCinetico({ ...input, dados });
  }
}

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  comparecimento: 'Atestado de Comparecimento',
  atestado_fisio: 'Atestado Fisioterapêutico',
  declaracao_tratamento: 'Declaração de Tratamento',
  recibo: 'Recibo de Pagamento',
  laudo_cinetico: 'Laudo Cinético-Funcional',
};

// ============ RECEITA MÉDICA ============

export interface ReceitaItem {
  nome: string;
  apresentacao?: string;
  posologia: string;
  quantidade?: string;
}

export interface DocReceitaData {
  itens: ReceitaItem[];
  orientacoes?: string;
  tipo?: 'simples' | 'especial';
}

export async function gerarReceita(
  input: BaseInput & { dados: DocReceitaData }
): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  const titulo = input.dados.tipo === 'especial' ? 'Receituário Especial' : 'Receituário Médico';
  let y = drawTitle(doc, titulo, 50);

  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PACIENTE', 25, y);
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(pacienteLine(input.paciente), 25, y + 5);
  y += 14;

  input.dados.itens.forEach((it, idx) => {
    y = ensureSpace(doc, y, 22);
    doc.setTextColor(...PRIMARY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`${idx + 1}.`, 25, y);
    doc.setTextColor(...TEXT);
    const nomeLinha = `${it.nome}${it.apresentacao ? ' — ' + it.apresentacao : ''}${it.quantidade ? '  ·  ' + it.quantidade : ''}`;
    doc.text(nomeLinha, 32, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 70);
    const pos = doc.splitTextToSize(`Posologia: ${it.posologia}`, 160);
    doc.text(pos, 32, y);
    y += pos.length * 5 + 4;
  });

  if (input.dados.orientacoes) {
    y = ensureSpace(doc, y, 24);
    y += 2;
    doc.setTextColor(...MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('ORIENTAÇÕES GERAIS', 25, y);
    doc.setTextColor(...TEXT);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    const orient = doc.splitTextToSize(input.dados.orientacoes, 160);
    doc.text(orient, 25, y + 5);
  }

  await drawFooter(doc, input.terapeuta, input.clinica);
  return doc;
}

// ============ ATESTADO MÉDICO ============

export interface DocAtestadoMedicoData {
  diasAfastamento: number;
  dataInicio: string;
  cid?: string;
  cidDescricao?: string;
  motivo?: string;
}

export async function gerarAtestadoMedico(
  input: BaseInput & { dados: DocAtestadoMedicoData }
): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Atestado Médico', 50);

  const dias = input.dados.diasAfastamento;
  const text = `Atesto, para os devidos fins, que ${pacienteLine(input.paciente)} esteve sob meus cuidados médicos e necessita de afastamento de suas atividades habituais (laborais e/ou escolares) por um período de ${dias} (${dias === 1 ? 'um' : dias}) dia${dias > 1 ? 's' : ''}, a contar de ${fmtDate(input.dados.dataInicio)}.${input.dados.cid ? `\n\nCID-10: ${input.dados.cid}${input.dados.cidDescricao ? ' — ' + input.dados.cidDescricao : ''}` : ''}${input.dados.motivo ? `\n\nObservações: ${input.dados.motivo}` : ''}\n\nEmitido em conformidade com a Resolução CFM nº 1.658/2002 e suas alterações.`;

  y = drawBody(doc, text, y + 4);
  await drawFooter(doc, input.terapeuta, input.clinica);
  return doc;
}
