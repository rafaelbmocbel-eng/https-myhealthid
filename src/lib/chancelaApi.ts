// Chamadas ao banco da fila de chancela, da administração da equipe e da verificação
// do profissional. As funções SQL e a tabela `plano_cliente_chancela` ainda não estão
// nos tipos gerados do Supabase, por isso o cliente é usado por uma interface mínima.
import { supabase } from '@/integrations/supabase/client';
import { erroDaFuncao } from '@/lib/fnError';
import { normalizarRevisao, type RevisaoNormalizada } from '@/lib/governanca';
import {
  lerConfigPlanoCliente, lerFila, lerMinhaVerificacao, lerProfissionaisAdmin,
  type AreaEquipe, type ConfigPlanoCliente, type ItemFilaChancela, type MinhaVerificacao,
  type ProfissionalAdmin, type StatusFila, type TipoChancela,
} from '@/lib/chancela';

interface ErroDb {
  message: string;
  hint?: string | null;
  code?: string | null;
  details?: string | null;
}

interface RespostaDb<T = unknown> {
  data: T;
  error: ErroDb | null;
  count?: number | null;
}

interface ConsultaDb extends PromiseLike<RespostaDb> {
  select(colunas: string, opcoes?: { count?: 'exact'; head?: boolean }): ConsultaDb;
  update(valores: Record<string, unknown>): ConsultaDb;
  eq(coluna: string, valor: unknown): ConsultaDb;
  maybeSingle(): PromiseLike<RespostaDb>;
}

interface ClienteDb {
  rpc(nome: string, args?: Record<string, unknown>): PromiseLike<RespostaDb>;
  from(tabela: string): ConsultaDb;
}

function db(): ClienteDb {
  return supabase as unknown as ClienteDb;
}

const TABELA = 'plano_cliente_chancela';

/**
 * Erro de uma RPC com o HINT do banco: é ele que diz à tela o que fazer (`revisao_obrigatoria`,
 * `nao_verificado`...). `Error(message)` sozinho perderia o código.
 */
export class ErroRpc extends Error {
  readonly hint: string | null;
  readonly code: string | null;
  readonly details: string | null;

  constructor(erro: ErroDb) {
    super(erro.message);
    this.name = 'ErroRpc';
    this.hint = erro.hint ?? null;
    this.code = erro.code ?? null;
    this.details = erro.details ?? null;
  }
}

function lancar(error: ErroDb | null): void {
  if (error) throw new ErroRpc(error);
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

// ── Revisão de segurança feita ao chancelar ────────────────────────────────

const PRAZO_REVISAO_MS = 90_000;

function comPrazo<T>(promessa: PromiseLike<T> | T, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('A revisão automática demorou demais para responder.')), ms);
    Promise.resolve(promessa).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

/**
 * Roda a revisão de segurança (IA) do plano do cliente que aguarda chancela. A edge grava a
 * revisão no plano presa ao hash do conteúdo; `persistida: false` na resposta significa que o
 * banco NÃO tem essa revisão e vai exigir a justificativa ao chancelar.
 */
export async function revisarSegurancaPlanoCliente(item: { id: string; tipo: TipoChancela }): Promise<RevisaoNormalizada> {
  const { data, error } = await comPrazo(
    supabase.functions.invoke('revisar-plano-seguranca', {
      body: { tabela: 'plano_cliente_chancela', tipo: item.tipo, plano_id: item.id },
    }),
    PRAZO_REVISAO_MS,
  );
  if (error) throw await erroDaFuncao(error);
  const corpo = data as { error?: string } | null;
  if (corpo?.error) throw new Error(corpo.error);
  const revisao = normalizarRevisao(data);
  if (!revisao) throw new Error('A revisão automática não retornou um resultado válido.');
  return revisao;
}

// ── Aviso ao cliente (WhatsApp) ────────────────────────────────────────────

export interface ResultadoAvisoCliente {
  ok: boolean;
  enviado: boolean;
  motivo?: string;
}

/**
 * Pede à edge `notificar-plano-cliente` que avise o cliente (mensagem curta, sem conteúdo clínico)
 * de que o plano foi chancelado ou recusado. Best-effort: NUNCA lança, porque a decisão da equipe
 * já foi gravada e o portal continua mostrando o status mesmo sem o aviso.
 */
export async function notificarClientePlano(planoId: string): Promise<ResultadoAvisoCliente> {
  try {
    const { data, error } = await supabase.functions.invoke('notificar-plano-cliente', { body: { plano_id: planoId } });
    if (error) return { ok: false, enviado: false, motivo: 'falha_na_chamada' };
    const o = data as { ok?: unknown; enviado?: unknown; motivo?: unknown } | null;
    return {
      ok: o?.ok === true,
      enviado: o?.enviado === true,
      ...(typeof o?.motivo === 'string' ? { motivo: o.motivo } : {}),
    };
  } catch {
    // Aviso é cortesia: falha de rede ou edge fora do ar não pode desfazer nem travar a chancela.
    return { ok: false, enviado: false, motivo: 'falha_na_chamada' };
  }
}

// ── Verificação do profissional (o próprio usuário) ────────────────────────

/** Grava o registro no conselho do próprio usuário. NÃO verifica: quem verifica é o administrador. */
export async function solicitarVerificacao(registro: string): Promise<void> {
  const { error } = await db().rpc('solicitar_verificacao', { p_registro: registro });
  lancar(error);
}

export async function buscarMinhaVerificacao(userId: string): Promise<MinhaVerificacao> {
  const { data, error } = await db()
    .from('profiles')
    .select('registro_profissional, verificado, verificado_em, crefito')
    .eq('user_id', userId)
    .maybeSingle();
  lancar(error);
  return lerMinhaVerificacao(data);
}

// ── Administração (só o super-admin; o banco confere de novo dentro de cada RPC) ─

export async function buscarProfissionaisAdmin(): Promise<ProfissionalAdmin[]> {
  const { data, error } = await db().rpc('profissionais_admin');
  lancar(error);
  return lerProfissionaisAdmin(data);
}

export interface ArgsVerificarProfissional {
  userId: string;
  verificado: boolean;
  nota?: string | null;
  /**
   * O registro que o administrador conferiu na tela. O banco só verifica se o registro gravado agora for
   * este (o profissional pode trocá-lo enquanto não está verificado). Sem ele, a conferência não acontece.
   */
  registroVisto?: string | null;
}

export async function verificarProfissional(args: ArgsVerificarProfissional): Promise<void> {
  const { error } = await db().rpc('verificar_profissional', {
    p_user_id: args.userId,
    p_verificado: args.verificado,
    p_nota: args.nota?.trim() || null,
    ...(args.verificado && args.registroVisto ? { p_registro_visto: args.registroVisto } : {}),
  });
  lancar(error);
}

export interface ArgsDefinirEquipe {
  email: string;
  ativo: boolean;
  areas: AreaEquipe[];
}

export async function definirEquipeCientifica(args: ArgsDefinirEquipe): Promise<void> {
  const { error } = await db().rpc('definir_equipe_cientifica', {
    p_email: args.email,
    p_ativo: args.ativo,
    p_areas: args.areas,
  });
  lancar(error);
}

/** Lança quando o banco não responde; quem consome decide o padrão seguro (ver `usePlanoClienteConfig`). */
export async function buscarConfigPlanoCliente(): Promise<ConfigPlanoCliente> {
  const { data, error } = await db().rpc('plano_cliente_config');
  lancar(error);
  return lerConfigPlanoCliente(data);
}

export type ChaveConfigPlanoCliente = keyof ConfigPlanoCliente;

export async function definirConfigPlanoCliente(chave: ChaveConfigPlanoCliente, valor: boolean | number): Promise<void> {
  const { error } = await db().rpc('definir_config_plano_cliente', { p_chave: chave, p_valor: valor });
  lancar(error);
}
