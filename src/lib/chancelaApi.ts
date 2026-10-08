// Chamadas ao banco da fila de chancela. As funções SQL e a tabela
// `plano_cliente_chancela` ainda não estão nos tipos gerados do Supabase, por
// isso o cliente é usado por uma interface mínima.
import { supabase } from '@/integrations/supabase/client';
import { lerFila, type ItemFilaChancela, type StatusFila } from '@/lib/chancela';

interface RespostaDb<T = unknown> {
  data: T;
  error: { message: string } | null;
  count?: number | null;
}

interface ConsultaDb extends PromiseLike<RespostaDb> {
  select(colunas: string, opcoes?: { count?: 'exact'; head?: boolean }): ConsultaDb;
  update(valores: Record<string, unknown>): ConsultaDb;
  eq(coluna: string, valor: unknown): ConsultaDb;
}

interface ClienteDb {
  rpc(nome: string, args?: Record<string, unknown>): PromiseLike<RespostaDb>;
  from(tabela: string): ConsultaDb;
}

function db(): ClienteDb {
  return supabase as unknown as ClienteDb;
}

const TABELA = 'plano_cliente_chancela';

function lancar(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

/** Lança quando o banco não responde: "não consegui saber" não é "não é da equipe". */
export async function eEquipeCientifica(): Promise<boolean> {
  const { data, error } = await db().rpc('eh_equipe_cientifica');
  lancar(error);
  return data === true;
}

export async function buscarFilaChancela(status: StatusFila): Promise<ItemFilaChancela[]> {
  const { data, error } = await db().rpc('fila_chancela', { p_status: status });
  lancar(error);
  return lerFila(data);
}

/** Quantos planos aguardam chancela (contagem leve: não traz o conteúdo dos planos). */
export async function contarPendentesChancela(): Promise<number> {
  const { count, error } = await db().from(TABELA).select('id', { count: 'exact', head: true }).eq('status', 'aguardando');
  if (error) return 0;
  return count ?? 0;
}

export interface ArgsChancelar {
  id: string;
  /** Só quando o revisor editou e ainda não salvou; a tela salva a edição antes. */
  conteudo?: Record<string, unknown> | null;
  justificativa?: string | null;
  notaPublica?: string | null;
}

export async function chancelarPlanoCliente(args: ArgsChancelar): Promise<unknown> {
  const { data, error } = await db().rpc('chancelar_plano_cliente', {
    p_id: args.id,
    p_conteudo: args.conteudo ?? null,
    p_justificativa: args.justificativa?.trim() || null,
    p_nota_publica: args.notaPublica?.trim() || null,
  });
  lancar(error);
  return data;
}

export interface ArgsRecusar {
  id: string;
  notaPublica: string;
  notaInterna?: string | null;
}

export async function recusarPlanoCliente(args: ArgsRecusar): Promise<void> {
  const { error } = await db().rpc('recusar_plano_cliente', {
    p_id: args.id,
    p_nota_publica: args.notaPublica.trim(),
    p_nota_interna: args.notaInterna?.trim() || null,
  });
  lancar(error);
}

/**
 * Salva a edição do revisor no próprio registro (a política da tabela só deixa a
 * equipe científica gravar). O conteúdo editado continua sem carimbo: quem
 * carimba é `chancelar_plano_cliente`. Salvar muda o hash do conteúdo, então a
 * revisão de segurança anterior deixa de valer e precisa ser refeita.
 */
export async function salvarEdicaoChancela(id: string, titulo: string, conteudo: Record<string, unknown>): Promise<void> {
  const { data, error } = await db()
    .from(TABELA)
    .update({ titulo, conteudo, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'aguardando')
    .select('id');
  lancar(error);
  if (Array.isArray(data) && data.length === 0) {
    throw new Error('Não consegui salvar: o plano não está mais aguardando chancela ou você não tem permissão.');
  }
}
