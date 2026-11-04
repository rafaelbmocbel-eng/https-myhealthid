// Aba "Pedir guias" do Controle CASSI. A lista do pedido é do profissional: entra quem ele procura e
// adiciona (marcador durável cassi_pedir_guia no cadastro). O que o sistema acha que está na hora de
// pedir aparece à parte, como sugestão, e não entra sozinho no pedido.
import { precisaNovaGuia, statusPaciente, venceuPrazoProximaGuia, type GuiaCassi } from '@/lib/cassiGuias';
import { CODIGOS_JUSTIFICAVEIS, INFO_CODIGO, type CodigoJustificavel } from '@/lib/cassiJustificativa';

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
  cassi_musculos?: string | null;
  cassi_achados?: string | null;
  cassi_pedir_guia?: boolean | null;
}

export interface LinhaPedido<P extends PacientePedido = PacientePedido> {
  paciente: P;
  guia: GuiaCassi | null;
}

// Máximo de códigos por pedido de guia (decisão do Rafael: 5).
export const MAXIMO_CODIGOS_PEDIDO = 5;

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
  musculos: string;
  achados: string;
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
    musculos: l.paciente.cassi_musculos || '',
    achados: l.paciente.cassi_achados || '',
    codigos: (l.paciente.codigos_cassi?.length ? l.paciente.codigos_cassi : (l.guia?.codigos?.map((c) => c.codigo) || [])).slice(0, MAXIMO_CODIGOS_PEDIDO),
  };
}

// Músculos e achados da justificativa. Diferente do diagnóstico, o profissional pode APAGAR de propósito (achado do exame
// vale por consulta): o que ele esvaziou vai como null; o que ele não tocou não é mexido no cadastro.
// `musculosSugeridos` é a lista que a IA propôs e preencheu no campo: enquanto o campo for igual a ela, o profissional ainda não a
// confirmou nem editou, então não vai para o cadastro como se fosse dele (no próximo pedido a IA sugere de novo).
export function camposDaJustificativaParaGravar(
  item: Pick<ItemPedido, 'musculos' | 'achados'>,
  tocados: Partial<Pick<ItemPedido, 'musculos' | 'achados'>> | undefined,
  musculosSugeridos = '',
): { cassi_musculos?: string | null; cassi_achados?: string | null } {
  const saida: { cassi_musculos?: string | null; cassi_achados?: string | null } = {};
  const sugestaoIntacta = musculosSugeridos !== '' && item.musculos.trim() === musculosSugeridos;
  if (tocados && 'musculos' in tocados && !sugestaoIntacta) saida.cassi_musculos = item.musculos.trim() || null;
  if (tocados && 'achados' in tocados) saida.cassi_achados = item.achados.trim() || null;
  return saida;
}

// A mensagem do pedido (copiar / WhatsApp).
// Acima deste tamanho o link wa.me pode abrir o WhatsApp com a mensagem cortada ou em branco (cada letra acentuada vira 6 caracteres
// no link); o Copiar não tem esse limite. Prática, não documentada pelo WhatsApp: a tela só avisa, o botão continua funcionando.
export const LIMITE_LINK_WHATSAPP = 8000;

export const linkWhatsApp = (texto: string): string => `https://wa.me/?text=${encodeURIComponent(texto)}`;

export const linkWhatsAppLongo = (texto: string): boolean => linkWhatsApp(texto).length > LIMITE_LINK_WHATSAPP;

// `justificativas` (opcional) são os textos já gerados dos códigos 301/131 deste cliente (ver justificativasParaMensagem): entram
// em linhas "Justificativa 301 (...)" logo depois do diagnóstico, sempre na ordem 301, 131.
export function montarTextoPedido(
  itens: Array<Pick<ItemPedido, 'nome' | 'carteirinha' | 'codigos' | 'diagnostico'> & { justificativas?: Partial<Record<CodigoJustificavel, string>> }>,
): string {
  return [
    `*Solicitação de novas guias CASSI* (${itens.length} cliente${itens.length === 1 ? '' : 's'})`,
    '',
    ...itens.map((i, idx) => {
      const linhas = [
        `${idx + 1}. *${i.nome}*`,
        `Carteirinha: ${i.carteirinha || '—'}`,
        `Códigos: ${i.codigos.join(', ') || '—'}`,
        `Diagnóstico: ${i.diagnostico || '—'}`,
      ];
      for (const codigo of CODIGOS_JUSTIFICAVEIS) {
        const texto = i.justificativas?.[codigo];
        if (texto) linhas.push(`Justificativa ${codigo} (${INFO_CODIGO[codigo].nome}): ${texto}`);
      }
      return linhas.join('\n');
    }),
  ].join('\n');
}
