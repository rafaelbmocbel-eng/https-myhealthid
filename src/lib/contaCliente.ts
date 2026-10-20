import type { QueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const PALAVRA_CONFIRMACAO = 'EXCLUIR';

// Mensagens (message) que a RPC excluir_minha_conta_cliente devolve.
export type CodigoErroExclusao =
  | 'nao_autenticado'
  | 'confirmacao_invalida'
  | 'conta_de_profissional'
  | 'conta_nao_e_de_cliente'
  | 'senha_obrigatoria'
  | 'senha_incorreta'
  | 'reautenticar'
  | 'desconhecido';

const CODIGOS_CONHECIDOS: readonly Exclude<CodigoErroExclusao, 'desconhecido'>[] = [
  'nao_autenticado',
  'confirmacao_invalida',
  'conta_de_profissional',
  'conta_nao_e_de_cliente',
  'senha_obrigatoria',
  'senha_incorreta',
  'reautenticar',
];

export const MENSAGEM_ERRO_EXCLUSAO: Record<CodigoErroExclusao, string> = {
  nao_autenticado: 'Sua sessão expirou. Entre de novo para confirmar a exclusão.',
  confirmacao_invalida: 'A confirmação não confere. Digite EXCLUIR, em letras maiúsculas.',
  conta_de_profissional:
    'Esta é uma conta de profissional e não pode ser excluída por aqui. Fale com o suporte.',
  conta_nao_e_de_cliente:
    'Esta conta não é de cliente, por isso não pode ser excluída por aqui. Se acha que é um engano, fale com o suporte.',
  senha_obrigatoria: 'Digite a sua senha para confirmar a exclusão.',
  senha_incorreta: 'Senha incorreta. Confira e tente de novo.',
  reautenticar: 'Por segurança, entre de novo para confirmar a exclusão da conta.',
  desconhecido:
    'Não foi possível excluir a conta agora. Confira sua conexão e tente de novo; se continuar, fale com o suporte.',
};

// Nesses erros o caminho é sair e entrar de novo (a sessão não vale mais para a ação).
export function exigeNovoLogin(codigo: CodigoErroExclusao): boolean {
  return codigo === 'reautenticar' || codigo === 'nao_autenticado';
}

export function normalizarConfirmacao(texto: string): string {
  return texto.trim().toUpperCase();
}

export function confirmacaoValida(texto: string): boolean {
  return normalizarConfirmacao(texto) === PALAVRA_CONFIRMACAO;
}

type UsuarioParaSenha = Pick<User, 'app_metadata'> & { identities?: { provider: string }[] | null };

// Conta só do Google não tem senha para confirmar. Mesmos critérios do PacienteSenhaCard.
export function contaTemSenha(user: UsuarioParaSenha | null | undefined): boolean {
  if (!user) return false;
  const meta = user.app_metadata ?? {};
  const providers = (meta as { providers?: unknown }).providers;
  if (Array.isArray(providers) && providers.includes('email')) return true;
  if ((meta as { provider?: unknown }).provider === 'email') return true;
  if ((meta as { senha_definida?: unknown }).senha_definida === true) return true;
  return (user.identities ?? []).some((i) => i.provider === 'email');
}

export function interpretarErroExclusao(erro: unknown): CodigoErroExclusao {
  if (!erro || typeof erro !== 'object') return 'desconhecido';
  const e = erro as { message?: unknown; details?: unknown };
  const texto = [e.message, e.details].filter((v): v is string => typeof v === 'string').join(' ');
  const achado = CODIGOS_CONHECIDOS.find((c) => texto.includes(c));
  if (achado) return achado;
  // Token vencido chega do PostgREST como "JWT expired", sem passar pela RPC.
  if (/jwt/i.test(texto)) return 'nao_autenticado';
  return 'desconhecido';
}

export type ResultadoExclusao =
  | { ok: true; desvinculados: number }
  | { ok: false; codigo: CodigoErroExclusao };

type ChamadaRpc = (
  nome: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: unknown }>;

// A RPC é nova e ainda não está nos tipos gerados do Supabase.
export async function excluirMinhaContaCliente(params: {
  confirmacao: string;
  senha?: string | null;
}): Promise<ResultadoExclusao> {
  try {
    const { data, error } = await (supabase as unknown as { rpc: ChamadaRpc }).rpc('excluir_minha_conta_cliente', {
      p_confirmacao: normalizarConfirmacao(params.confirmacao),
      p_senha: params.senha ? params.senha : null,
    });
    if (error) return { ok: false, codigo: interpretarErroExclusao(error) };
    const retorno = (data ?? {}) as { ok?: unknown; pacientes_desvinculados?: unknown };
    if (retorno.ok !== true) return { ok: false, codigo: 'desconhecido' };
    const n = Number(retorno.pacientes_desvinculados);
    return { ok: true, desvinculados: Number.isFinite(n) ? n : 0 };
  } catch (err) {
    // Falha de rede/timeout: a conta pode não ter sido tocada; o usuário tenta de novo.
    return { ok: false, codigo: interpretarErroExclusao(err) };
  }
}

// Objeto (e não função solta) para os testes poderem trocar o recarregamento da página.
export const navegador = {
  recarregar: (destino: string) => window.location.replace(destino),
};

// Plano B quando o logout não chega ao servidor: a conta já foi apagada, mas o token continuaria
// salvo e o app seguiria "logado". Remove a sessão salva; quem chama recarrega a página.
export function apagarSessaoLocal(): void {
  try {
    Object.keys(window.localStorage)
      .filter((chave) => /^sb-.+-auth-token/.test(chave))
      .forEach((chave) => window.localStorage.removeItem(chave));
  } catch {
    // Storage bloqueado (modo privado): o recarregamento que vem depois segue mesmo assim.
  }
}

// Caches em memória por usuário vivem dentro dos guardas (PatientGuard, ProtectedPatientRoute);
// cada um se registra aqui para ser limpo quando a conta some.
const limpezasDeCache = new Set<() => void>();

export function registrarLimpezaDeCacheDoUsuario(limpar: () => void): void {
  limpezasDeCache.add(limpar);
}

export function limparCachesDoUsuario(queryClient?: QueryClient): void {
  queryClient?.clear();
  limpezasDeCache.forEach((limpar) => {
    try {
      limpar();
    } catch (err) {
      // Limpeza é "melhor esforço": uma falha aqui não pode travar a saída da conta.
      console.warn('[contaCliente] falha ao limpar cache:', err);
    }
  });
}
