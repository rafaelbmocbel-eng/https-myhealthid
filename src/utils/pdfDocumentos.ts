import jsPDF from 'jspdf';
import { addLogoToDoc } from './pdfLogoHelper';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

export interface DocComparecimentoData {
  data: string;          // ISO date
  horaEntrada: string;   // HH:mm
  horaSaida: string;     // HH:mm
  acompanhante?: string;
}

export interface DocAtestadoFisioData {
  diasAfastamento: number;
  dataInicio: string;    // ISO date
  cid?: string;
  motivo?: string;
}

export interface DocDeclaracaoData {
  desde: string;         // ISO date
  finalidade?: string;   // empresa/escola/seguro
  observacoes?: string;
}

export interface DocReciboData {
  valor: number;
  referente: string;
  formaPagamento?: string;
  numeroSessoes?: number;
}

interface BaseInput {
  clinica?: ClinicaInfo | null;
  terapeuta: TerapeutaInfo;
  paciente: PacienteInfo;
}

const PRIMARY: [number, number, number] = [28, 55, 83];
const TEXT: [number, number, number] = [30, 30, 46];
const MUTED: [number, number, number] = [107, 114, 128];

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function fmtCurrency(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function valorPorExtenso(v: number): string {
  // Simplificado — para produção ideal usar lib. Aqui retorna texto direto.
  return `(${fmtCurrency(v)})`;
}

async function drawHeader(doc: jsPDF, clinica?: ClinicaInfo | null) {
  const margin = 20;
  await addLogoToDoc(doc, margin, 12, 18);

  doc.setTextColor(...PRIMARY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(clinica?.razao_social || 'MY HEALTH ID', margin + 22, 19);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  const lineParts: string[] = [];
  if (clinica?.cnpj) lineParts.push(`CNPJ ${clinica.cnpj}`);
  if (clinica?.endereco) lineParts.push(clinica.endereco);
  if (clinica?.cidade) lineParts.push(`${clinica.cidade}${clinica.uf ? '/' + clinica.uf : ''}`);
  if (lineParts.length) doc.text(lineParts.join(' · '), margin + 22, 24);

  const contato: string[] = [];
  if (clinica?.telefone) contato.push(clinica.telefone);
  if (clinica?.email_clinica) contato.push(clinica.email_clinica);
  if (contato.length) doc.text(contato.join(' · '), margin + 22, 28);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.5);
  doc.line(margin, 33, 210 - margin, 33);
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
  const lines = doc.splitTextToSize(text, 210 - margin * 2);
  doc.text(lines, margin, y, { align: 'justify', maxWidth: 210 - margin * 2 });
  return y + lines.length * 6;
}

async function drawFooter(doc: jsPDF, terapeuta: TerapeutaInfo, clinica?: ClinicaInfo | null) {
  const yBase = 240;
  const margin = 25;
  // Local e data
  const cidade = clinica?.cidade ? `${clinica.cidade}${clinica.uf ? '/' + clinica.uf : ''}, ` : '';
  doc.setTextColor(...TEXT);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.text(`${cidade}${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`, 105, yBase, { align: 'center' });

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

  // Rodapé
  doc.setFontSize(7);
  doc.setTextColor(...MUTED);
  doc.text('Documento emitido pelo sistema MY HEALTH ID', 105, 285, { align: 'center' });
}

function pacienteLine(p: PacienteInfo): string {
  const nome = `${p.nome}${p.sobrenome ? ' ' + p.sobrenome : ''}`;
  const docs: string[] = [];
  if (p.cpf) docs.push(`CPF ${p.cpf}`);
  if (p.rg) docs.push(`RG ${p.rg}`);
  return docs.length ? `${nome} (${docs.join(', ')})` : nome;
}

// ============ GENERATORS ============

export async function gerarComparecimento(input: BaseInput & { dados: DocComparecimentoData }): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Atestado de Comparecimento', 50);

  const text = `Atesto, para os devidos fins, que ${pacienteLine(input.paciente)} compareceu a esta unidade de atendimento no dia ${fmtDate(input.dados.data)}, no horário das ${input.dados.horaEntrada} às ${input.dados.horaSaida}, para realização de sessão de ${input.terapeuta.especialidade || 'fisioterapia'}.${input.dados.acompanhante ? `\n\nAcompanhado(a) por: ${input.dados.acompanhante}.` : ''}\n\nO presente atestado é emitido a pedido do interessado para comprovação de comparecimento, não justificando, por si só, ausência ou afastamento de atividades laborais ou escolares.`;

  y = drawBody(doc, text, y + 4);
  await drawFooter(doc, input.terapeuta, input.clinica);
  return doc;
}

export async function gerarAtestadoFisio(input: BaseInput & { dados: DocAtestadoFisioData }): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Atestado Fisioterapêutico', 50);

  const text = `Atesto, para os devidos fins, que ${pacienteLine(input.paciente)} encontra-se sob tratamento fisioterapêutico, necessitando de afastamento de suas atividades habituais (laborais e/ou escolares) por um período de ${input.dados.diasAfastamento} (${input.dados.diasAfastamento === 1 ? 'um' : input.dados.diasAfastamento} dia${input.dados.diasAfastamento > 1 ? 's' : ''}), a contar de ${fmtDate(input.dados.dataInicio)}.${input.dados.cid ? `\n\nCID: ${input.dados.cid}` : ''}${input.dados.motivo ? `\n\nMotivo clínico: ${input.dados.motivo}` : ''}\n\nEmitido em conformidade com a Resolução COFFITO nº 414/2012 e nº 464/2016.`;

  y = drawBody(doc, text, y + 4);
  await drawFooter(doc, input.terapeuta, input.clinica);
  return doc;
}

export async function gerarDeclaracaoTratamento(input: BaseInput & { dados: DocDeclaracaoData }): Promise<jsPDF> {
  const doc = new jsPDF();
  await drawHeader(doc, input.clinica);
  let y = drawTitle(doc, 'Declaração de Tratamento', 50);

  const text = `Declaro, para os devidos fins, que ${pacienteLine(input.paciente)} encontra-se em acompanhamento ${input.terapeuta.especialidade ? `de ${input.terapeuta.especialidade.toLowerCase()}` : 'fisioterapêutico'} nesta unidade desde ${fmtDate(input.dados.desde)}, realizando sessões de forma regular conforme plano terapêutico estabelecido.${input.dados.finalidade ? `\n\nFinalidade desta declaração: ${input.dados.finalidade}.` : ''}${input.dados.observacoes ? `\n\nObservações: ${input.dados.observacoes}` : ''}\n\nA presente declaração é emitida a pedido do interessado, sem detalhamento de informações clínicas, em respeito ao sigilo profissional.`;

  y = drawBody(doc, text, y + 4);
  await drawFooter(doc, input.terapeuta, input.clinica);
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

  const text = `Recebi de ${pacienteLine(input.paciente)} a importância de ${fmtCurrency(input.dados.valor)} ${valorPorExtenso(input.dados.valor)}, referente a ${input.dados.referente}${input.dados.numeroSessoes ? ` (${input.dados.numeroSessoes} sessões)` : ''}${input.dados.formaPagamento ? `, paga por ${input.dados.formaPagamento}` : ''}.\n\nPara maior clareza, firmo o presente recibo, dando plena, geral e irrevogável quitação do valor recebido.`;

  y = drawBody(doc, text, y);
  await drawFooter(doc, input.terapeuta, input.clinica);
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
  }
}

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumento, string> = {
  comparecimento: 'Atestado de Comparecimento',
  atestado_fisio: 'Atestado Fisioterapêutico',
  declaracao_tratamento: 'Declaração de Tratamento',
  recibo: 'Recibo de Pagamento',
};
