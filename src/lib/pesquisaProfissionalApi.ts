// Chamadas da pesquisa automática de profissionais (aba Administração): a edge
// `pesquisar-profissional` e as duas RPCs de leitura. Só o super-admin chega aqui; a edge e o banco
// conferem de novo. As funções SQL ainda não estão nos tipos gerados do Supabase, por isso o
// cliente é usado por uma interface mínima (mesmo padrão de `chancelaApi.ts`).
import { supabase } from '@/integrations/supabase/client';
import { ErroRpc } from '@/lib/chancelaApi';
import {
  lerPesquisaProfissional, lerRespostaPesquisa, lerResumosPesquisas, mensagemErroPesquisa,
  type PesquisaProfissional, type ResumoPesquisaProfissional,
} from '@/lib/pesquisaProfissional';

export type {
  AchadoPesquisa, CategoriaAchado, ConsultaUsada, NivelIndicio, PesquisaProfissional, ResumoPesquisaProfissional,
} from '@/lib/pesquisaProfissional';

/** Chave do react-query do resumo (último indício de cada profissional): uma chamada para a lista toda. */
export const CHAVE_PESQUISAS_RESUMO = ['pesquisas-profissionais-resumo'] as const;

export function chavePesquisaUltima(userId: string) {
  return ['pesquisa-profissional-ultima', userId] as const;
}

/** A busca na internet pode levar quase um minuto; passado isto a tela desiste de esperar. */
export const PRAZO_PESQUISA_MS = 120_000;

/** Erro da pesquisa com o `codigo` que a edge devolveu (`limite_diario`, `falha_busca`...). */
export class ErroPesquisaProfissional extends Error {
  readonly codigo: string | null;

  constructor(mensagem: string, codigo: string | null = null) {
    super(mensagem);
    this.name = 'ErroPesquisaProfissional';
    this.codigo = codigo;
  }
}

interface ErroDb {
  message: string;
  hint?: string | null;
  code?: string | null;
  details?: string | null;
}

interface ClienteRpc {
  rpc(nome: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: ErroDb | null }>;
}

function rpcDb(): ClienteRpc {
  return supabase as unknown as ClienteRpc;
}

function comPrazo<T>(promessa: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new ErroPesquisaProfissional(mensagemErroPesquisa('tempo_esgotado', null), 'tempo_esgotado')), ms);
    Promise.resolve(promessa).then(
      (v) => { clearTimeout(t); resolve(v); },
      (e) => { clearTimeout(t); reject(e); },
    );
  });
}

function codigoPorStatus(status: number | null): string | null {
  return status === 401 || status === 403 ? 'nao_autorizado' : null;
}

/** O invoke esconde o corpo da resposta não-2xx dentro de `context`: lê uma vez e extrai código e mensagem. */
async function erroDaPesquisa(error: unknown): Promise<ErroPesquisaProfissional> {
  const ctx = (error as { context?: { json?: () => Promise<unknown>; status?: unknown } } | null)?.context;
  const status = typeof ctx?.status === 'number' ? ctx.status : null;
  let codigo = codigoPorStatus(status);
  let mensagemServidor: string | null = null;
  if (ctx && typeof ctx.json === 'function') {
    try {
      const resposta = lerRespostaPesquisa(await ctx.json());
      if (resposta && resposta.ok === false) {
        codigo = resposta.codigo ?? codigo;
        mensagemServidor = resposta.mensagem;
      }
    } catch {
      // Corpo ausente ou que não é JSON: segue com o que o status HTTP permite concluir.
    }
  } else {
    codigo = 'sem_conexao';
  }
  return new ErroPesquisaProfissional(mensagemErroPesquisa(codigo, mensagemServidor), codigo);
}

/**
 * Pede à edge que pesquise o profissional na internet e grave o resultado. A pesquisa é só indício:
 * nada aqui verifica ninguém. Lança `ErroPesquisaProfissional` (com `codigo`) em limite, falha ou
 * permissão negada. Quando a busca falha mas a edge gravou a tentativa (`falha_busca` com `pesquisa`),
 * devolve essa tentativa, que vale como resultado "não consegui consultar".
 */
export async function pesquisarProfissional(userId: string): Promise<PesquisaProfissional> {
  const { data, error } = await comPrazo(
    supabase.functions.invoke('pesquisar-profissional', { body: { user_id: userId } }),
    PRAZO_PESQUISA_MS,
  );
  if (error) throw await erroDaPesquisa(error);
  const resposta = lerRespostaPesquisa(data);
  if (!resposta) throw new ErroPesquisaProfissional('A resposta da pesquisa veio em formato inesperado.');
  if (resposta.ok === false) {
    if (resposta.codigo === 'falha_busca' && resposta.pesquisa) return resposta.pesquisa;
    throw new ErroPesquisaProfissional(mensagemErroPesquisa(resposta.codigo, resposta.mensagem), resposta.codigo);
  }
  return resposta.pesquisa;
}

/** A pesquisa mais recente do profissional, ou null se nunca foi pesquisado. */
export async function buscarUltimaPesquisaProfissional(userId: string): Promise<PesquisaProfissional | null> {
  const { data, error } = await rpcDb().rpc('pesquisa_profissional_ultima', { p_user_id: userId });
  if (error) throw new ErroRpc(error);
  return lerPesquisaProfissional(data);
}

/** O último indício de cada profissional pesquisado, numa chamada só (selo da lista). */
export async function buscarResumoPesquisasProfissionais(): Promise<ResumoPesquisaProfissional[]> {
  const { data, error } = await rpcDb().rpc('pesquisas_profissionais_resumo');
  if (error) throw new ErroRpc(error);
  return lerResumosPesquisas(data);
}
