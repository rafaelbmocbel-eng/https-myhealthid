// Aba "Pedir guias" do Controle CASSI. A lista do pedido é do profissional: entra quem ele procura e
// adiciona (marcador durável cassi_pedir_guia no cadastro). O que o sistema acha que está na hora de
// pedir aparece à parte, como sugestão, e não entra sozinho no pedido.
import { precisaNovaGuia, statusPaciente, venceuPrazoProximaGuia, type GuiaCassi } from '@/lib/cassiGuias';

export interface PacientePedido {
  id: string;
  nome: string;
  sobrenome: string | null;
  carteirinha: string | null;
  codigos_cassi: string[];
  guias_por_mes?: number | null;
  guia_solicitada_em?: string | null;
  cassi_encerrado_em?: string | null;
  cassi_diagnostico?: string | null;
  cassi_pedir_guia?: boolean | null;
}

export interface LinhaPedido<P extends PacientePedido = PacientePedido> {
  paciente: P;
  guia: GuiaCassi | null;
}

// Máximo de códigos por pedido que a CASSI aceita.
export const MAXIMO_CODIGOS_PEDIDO = 3;

// "Pedido aberto" = já demos baixa (solicitamos) e a guia nova ainda não chegou
// (nenhuma guia com data_pedido >= a data da solicitação).
export function pedidoEmAberto(
  p: Pick<PacientePedido, 'guia_solicitada_em'>,
  guiaMaisRecente: Pick<GuiaCassi, 'data_pedido'> | null,
): boolean {
  const sol = p.guia_solicitada_em ? p.guia_solicitada_em.slice(0, 10) : null;
  if (!sol) return false;
  const ultimo = guiaMaisRecente?.data_pedido || null;
  return !ultimo || ultimo < sol;
}

const porNome = (a: { paciente: PacientePedido }, b: { paciente: PacientePedido }) =>
  `${a.paciente.nome} ${a.paciente.sobrenome || ''}`.localeCompare(`${b.paciente.nome} ${b.paciente.sobrenome || ''}`, 'pt-BR');

// A lista do pedido: quem o profissional adicionou, ainda ativo no CASSI e sem pedido já feito.
export function listaDoPedido<P extends PacientePedido>(linhas: Array<LinhaPedido<P>>): Array<LinhaPedido<P>> {
  return linhas
    .filter((l) => l.paciente.cassi_pedir_guia === true && !l.paciente.cassi_encerrado_em && !pedidoEmAberto(l.paciente, l.guia))
    .sort(porNome);
}

export interface SugestaoPedido { id: string; nome: string; motivo: string }

// O que o sistema acha que está na hora de pedir (faltam poucas sessões, guia usada, sem guia ou, no
// 2/mês, venceu o prazo) e que ainda não está na lista nem foi pedido.
export function sugestoesDoPedido<P extends PacientePedido>(linhas: Array<LinhaPedido<P>>): SugestaoPedido[] {
  return linhas
    .filter((l) => !l.paciente.cassi_encerrado_em
      && l.paciente.cassi_pedir_guia !== true
      && !pedidoEmAberto(l.paciente, l.guia)
      && (precisaNovaGuia(l.guia) || venceuPrazoProximaGuia(l.guia, l.paciente.guias_por_mes)))
    .sort(porNome)
    .map((l) => ({
      id: l.paciente.id,
      nome: `${l.paciente.nome} ${l.paciente.sobrenome || ''}`.trim(),
      motivo: (l.paciente.guias_por_mes || 1) >= 2 ? 'cliente 2/mês' : statusPaciente(l.guia).label,
    }));
}

// Clientes que dá para colocar no pedido pela busca: todos os CASSI (inclusive encerrados, que voltam a
// ser ativos ao entrar), menos quem já tem pedido em aberto.
export function candidatosDoPedido<P extends PacientePedido>(
  pacientes: P[],
  guiaMaisRecente: (id: string) => GuiaCassi | null,
): Array<LinhaPedido<P>> {
  return pacientes
    .filter((p) => !pedidoEmAberto(p, guiaMaisRecente(p.id)))
    .map((p) => ({ paciente: p, guia: guiaMaisRecente(p.id) }));
}

export interface ItemPedido {
  id: string;
  nome: string;
  sel: boolean;
  carteirinha: string;
  diagnostico: string;
  codigos: string[];
}

// Dados do cliente que vão no pedido, pré-preenchidos do cadastro e da guia mais recente.
export function itemDoPedido(l: LinhaPedido): ItemPedido {
  return {
    id: l.paciente.id,
    nome: `${l.paciente.nome} ${l.paciente.sobrenome || ''}`.trim(),
    sel: true,
    carteirinha: l.paciente.carteirinha || l.guia?.matricula || '',
    diagnostico: l.paciente.cassi_diagnostico || l.guia?.diagnostico || '',
    codigos: (l.paciente.codigos_cassi?.length ? l.paciente.codigos_cassi : (l.guia?.codigos?.map((c) => c.codigo) || [])).slice(0, MAXIMO_CODIGOS_PEDIDO),
  };
}

// A mensagem do pedido (copiar / WhatsApp).
export function montarTextoPedido(itens: Array<Pick<ItemPedido, 'nome' | 'carteirinha' | 'codigos' | 'diagnostico'>>): string {
  return [
    `*Solicitação de novas guias CASSI* (${itens.length} cliente${itens.length === 1 ? '' : 's'})`,
    '',
    ...itens.map((i, idx) =>
      `${idx + 1}. *${i.nome}*\nCarteirinha: ${i.carteirinha || '—'}\nCódigos: ${i.codigos.join(', ') || '—'}\nDiagnóstico: ${i.diagnostico || '—'}`
    ),
  ].join('\n');
}
