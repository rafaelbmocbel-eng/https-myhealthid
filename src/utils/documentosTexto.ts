// Texto (corpo) dos documentos — módulo LEVE, sem jsPDF.
// É usado tanto pelo gerador de PDF (pdfDocumentos.ts) quanto pelo modal, que
// mostra esse mesmo texto num campo editável ("editar realmente o documento").
// Ter uma única fonte do texto evita a prévia divergir do PDF final.

import { format } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import type { TipoDocumento, PacienteInfo, TerapeutaInfo } from './pdfDocumentos';

// Datas "YYYY-MM-DD" (vindas de <input type="date">) são interpretadas como
// UTC pelo new Date(), o que no Brasil (UTC-3) volta 1 dia — o famoso bug de
// "escolhi dia 05 e saiu dia 04". Fixamos ao meio-dia LOCAL para nunca virar o dia.
export function parseDataLocal(iso: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
}

export function fmtDate(iso: string): string {
  try {
    return format(parseDataLocal(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

export function fmtCurrency(v: number): string {
  return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function valorPorExtenso(v: number): string {
  // Simplificado — retorna o valor formatado entre parênteses.
  return `(${fmtCurrency(v)})`;
}

export function pacienteLine(p: PacienteInfo): string {
  const nome = `${p.nome}${p.sobrenome ? ' ' + p.sobrenome : ''}`;
  const docs: string[] = [];
  if (p.cpf) docs.push(`CPF ${p.cpf}`);
  if (p.rg) docs.push(`RG ${p.rg}`);
  return docs.length ? `${nome} (${docs.join(', ')})` : nome;
}

interface Ctx {
  paciente: PacienteInfo;
  terapeuta: TerapeutaInfo;
}

/**
 * Monta o texto padrão do corpo do documento a partir dos campos.
 * Retorna null para o Laudo Cinético-Funcional (que é estruturado em seções,
 * não um texto corrido editável).
 */
export function corpoPadraoDocumento(tipo: TipoDocumento, ctx: Ctx, dados: any): string | null {
  const p = ctx.paciente;
  const esp = ctx.terapeuta.especialidade;

  switch (tipo) {
    case 'comparecimento':
      return `Atesto, para os devidos fins, que ${pacienteLine(p)} compareceu a esta unidade de atendimento no dia ${fmtDate(dados.data)}, no horário das ${dados.horaEntrada} às ${dados.horaSaida}, para realização de sessão de ${esp || 'fisioterapia'}.${dados.acompanhante ? `\n\nAcompanhado(a) por: ${dados.acompanhante}.` : ''}\n\nO presente atestado é emitido a pedido do interessado para comprovação de comparecimento, não justificando, por si só, ausência ou afastamento de atividades laborais ou escolares.`;

    case 'atestado_fisio': {
      const dias = dados.diasAfastamento;
      return `Atesto, para os devidos fins, que ${pacienteLine(p)} encontra-se sob tratamento fisioterapêutico, necessitando de afastamento de suas atividades habituais (laborais e/ou escolares) por um período de ${dias} (${dias === 1 ? 'um' : dias} dia${dias > 1 ? 's' : ''}), a contar de ${fmtDate(dados.dataInicio)}.${dados.cid ? `\n\nCID: ${dados.cid}` : ''}${dados.motivo ? `\n\nMotivo clínico: ${dados.motivo}` : ''}${dados.cif ? `\n\nCIF (Classificação Internacional de Funcionalidade): ${dados.cif}${dados.cifDescricao ? ` — ${dados.cifDescricao}` : ''}` : ''}\n\nEmitido em conformidade com a Resolução COFFITO nº 414/2012 e nº 464/2016.`;
    }

    case 'declaracao_tratamento':
      return `Declaro, para os devidos fins, que ${pacienteLine(p)} encontra-se em acompanhamento ${esp ? `de ${esp.toLowerCase()}` : 'fisioterapêutico'} nesta unidade desde ${fmtDate(dados.desde)}, realizando sessões de forma regular conforme plano terapêutico estabelecido.${dados.finalidade ? `\n\nFinalidade desta declaração: ${dados.finalidade}.` : ''}${dados.observacoes ? `\n\nObservações: ${dados.observacoes}` : ''}\n\nA presente declaração é emitida a pedido do interessado, sem detalhamento de informações clínicas, em respeito ao sigilo profissional.`;

    case 'recibo':
      return `Recebi de ${pacienteLine(p)} a importância de ${fmtCurrency(dados.valor)} ${valorPorExtenso(dados.valor)}, referente a ${dados.referente}${dados.numeroSessoes ? ` (${dados.numeroSessoes} sessões)` : ''}${dados.formaPagamento ? `, paga por ${dados.formaPagamento}` : ''}.\n\nPara maior clareza, firmo o presente recibo, dando plena, geral e irrevogável quitação do valor recebido.`;

    case 'laudo_cinetico':
      return null;

    default:
      return null;
  }
}
