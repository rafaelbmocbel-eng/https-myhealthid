import { supabase } from '@/integrations/supabase/client';
import { erroDaFuncao } from '@/lib/fnError';
import { extrairBloqueio, type BloqueioTriagem, type OverrideTriagem } from '@/lib/governanca';

// Chamada das edges gerar-plano-treino / gerar-plano-alimentar. A triagem de
// segurança responde HTTP 200 com { ok:false, bloqueio } em vez de erro, então
// quem chama precisa tratar os dois desfechos: o plano ou o bloqueio.

export type FuncaoGeracaoPlano = 'gerar-plano-treino' | 'gerar-plano-alimentar';

export type ResultadoGeracao =
  | { tipo: 'plano'; plano: Record<string, any> }
  | { tipo: 'bloqueio'; bloqueio: BloqueioTriagem };

export const MENSAGEM_GERACAO_FALHOU = 'Não consegui gerar o plano agora. Tente de novo em instantes.';

/** Interpreta o corpo da resposta da edge. Lança Error em qualquer falha (fail-closed). */
export function interpretarRespostaGeracao(data: unknown): ResultadoGeracao {
  const d = (data && typeof data === 'object' ? data : {}) as { ok?: unknown; error?: unknown; plano?: unknown };
  if (d.ok !== true) {
    const bloqueio = extrairBloqueio(data);
    if (bloqueio) return { tipo: 'bloqueio', bloqueio };
  }
  if (typeof d.error === 'string' && d.error) throw new Error(d.error);
  if (d.ok === true && d.plano && typeof d.plano === 'object' && !Array.isArray(d.plano)) {
    return { tipo: 'plano', plano: d.plano as Record<string, any> };
  }
  throw new Error(MENSAGEM_GERACAO_FALHOU);
}

/**
 * Invoca a edge de geração. `override` só é enviado quando o profissional decidiu
 * prosseguir depois de um bloqueio; o servidor ainda confere quem chama e recusa
 * a sobreposição do cliente.
 */
export async function gerarPlanoComTriagem(
  funcao: FuncaoGeracaoPlano,
  corpo: Record<string, unknown>,
  override?: OverrideTriagem | null,
): Promise<ResultadoGeracao> {
  const { data, error } = await supabase.functions.invoke(funcao, {
    body: override ? { ...corpo, override } : corpo,
  });
  if (error) throw await erroDaFuncao(error);
  return interpretarRespostaGeracao(data);
}

/** Idade completa em anos a partir de 'YYYY-MM-DD'; null se a data faltar ou for inválida. */
export function idadeEmAnos(nascimento?: string | null, hoje: Date = new Date()): number | null {
  if (!nascimento) return null;
  const d = new Date(`${nascimento.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let anos = hoje.getFullYear() - d.getFullYear();
  if (hoje.getMonth() < d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() < d.getDate())) anos--;
  return anos >= 0 ? anos : null;
}

/** Resumo curto dos motivos de um bloqueio, para o aviso que fica no card. */
export function resumoMotivosBloqueio(bloqueio: BloqueioTriagem, max = 3): string {
  const rotulos = bloqueio.motivos.map((m) => m.rotulo).filter(Boolean);
  if (rotulos.length === 0) return 'a triagem de segurança pediu a sua atenção';
  const lista = rotulos.slice(0, max).join(', ');
  return rotulos.length > max ? `${lista} e mais ${rotulos.length - max}` : lista;
}
