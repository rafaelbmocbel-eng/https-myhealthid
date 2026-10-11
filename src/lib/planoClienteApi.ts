// Chamadas do portal do cliente às RPCs do plano gerado por ele (chancela da equipe científica).
// As funções SQL ainda não estão nos tipos gerados do Supabase, por isso o cliente é usado por
// uma interface mínima. Nada aqui devolve o conteúdo do plano: só a situação do pedido.
import { supabase } from '@/integrations/supabase/client';
import { lerSituacaoPlanoCliente, type SituacaoPlanoCliente } from '@/lib/geracaoPlano';
import type { TipoPlanoGov } from '@/lib/governanca';

interface ErroDb {
  message: string;
  hint?: string | null;
  code?: string | null;
}

interface ClienteDb {
  rpc(nome: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: ErroDb | null }>;
}

function db(): ClienteDb {
  return supabase as unknown as ClienteDb;
}

/** Erro de uma RPC com o HINT do banco, que diz à tela o que aconteceu (`pedido_ja_decidido`...). */
export class ErroPlanoCliente extends Error {
  readonly hint: string | null;
  readonly code: string | null;

  constructor(erro: ErroDb) {
    super(erro.message);
    this.name = 'ErroPlanoCliente';
    this.hint = erro.hint ?? null;
    this.code = erro.code ?? null;
  }
}

/** Situação do último pedido deste tipo (RPC `meu_status_plano_cliente`). Lança se o banco não responder. */
export async function buscarSituacaoPlanoCliente(tipo: TipoPlanoGov): Promise<SituacaoPlanoCliente> {
  const { data, error } = await db().rpc('meu_status_plano_cliente', { p_tipo: tipo });
  if (error) throw new ErroPlanoCliente(error);
  return lerSituacaoPlanoCliente(data);
}

/**
 * Cancela o pedido do próprio cliente que ainda aguarda a equipe (RPC `cancelar_pedido_plano_cliente`)
 * e devolve a situação nova. Um plano já chancelado ou recusado não é cancelado.
 */
export async function cancelarPedidoPlanoCliente(tipo: TipoPlanoGov): Promise<SituacaoPlanoCliente> {
  const { data, error } = await db().rpc('cancelar_pedido_plano_cliente', { p_tipo: tipo });
  if (error) throw new ErroPlanoCliente(error);
  return lerSituacaoPlanoCliente(data);
}

export const MENSAGEM_PEDIDO_CANCELADO = 'Pedido cancelado. Quando quiser, é só pedir de novo.';
export const MENSAGEM_CANCELAR_FALHOU = 'Não consegui cancelar o pedido agora. Tente de novo em instantes.';

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Erro do cancelamento em linguagem para o cliente. */
export function mensagemErroCancelarPedido(erro: unknown): string {
  const hint = erro instanceof ErroPlanoCliente ? erro.hint : null;
  if (hint === 'pedido_ja_decidido') return 'A equipe acabou de decidir este pedido, então ele não pode mais ser cancelado. Veja a situação atualizada abaixo.';
  if (hint === 'sem_pedido_aguardando') return 'Este pedido já não está aguardando a equipe. Veja a situação atualizada abaixo.';
  const mensagem = (erro as { message?: unknown } | null)?.message;
  const norm = typeof mensagem === 'string' ? semAcento(mensagem) : '';
  const funcaoAusente = norm.includes('could not find the function') || norm.includes('pgrst202') || norm.includes('schema cache');
  if (funcaoAusente || (erro instanceof ErroPlanoCliente && erro.code === 'PGRST202')) {
    return 'O cancelamento ainda não está disponível. Tente de novo em alguns minutos.';
  }
  if (norm.includes('sessao expirada')) return 'Sua sessão expirou. Entre novamente para cancelar o pedido.';
  return MENSAGEM_CANCELAR_FALHOU;
}
