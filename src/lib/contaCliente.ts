import type { QueryClient } from '@tanstack/react-query';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export const PALAVRA_CONFIRMACAO = 'EXCLUIR';

// Canal público já divulgado pelo produto (rodapé da página de profissionais).
export const EMAIL_SUPORTE = 'contato@myhealthid.com.br';

// Tempo máximo esperando a RPC. Passado isso a conta pode ou não ter sido excluída: a interface avisa em vez de prender a pessoa.
export const TEMPO_LIMITE_EXCLUSAO_MS = 20_000;

// Mensagens (message) que a RPC excluir_minha_conta_cliente devolve. 'senha_incorreta' vem como retorno
// {ok:false, erro:'senha_incorreta'} (não como exceção, para o servidor conseguir contar as tentativas).
// 'tempo_esgotado' e 'conta_possivelmente_excluida' nascem aqui, nunca do servidor.
export type CodigoErroExclusao =
  | 'nao_autenticado'
  | 'confirmacao_invalida'
  | 'tente_novamente'
  | 'conta_de_profissional'
  | 'conta_nao_e_de_cliente'
  | 'premium_requer_aceite'
  | 'senha_obrigatoria'
  | 'senha_incorreta'
  | 'muitas_tentativas'
  | 'reautenticar'
  | 'cadastro_precisa_correcao'
  | 'falha_ao_excluir'
  | 'tempo_esgotado'
  | 'conta_possivelmente_excluida'
  | 'desconhecido';

type CodigoDoServidor = Exclude<CodigoErroExclusao, 'desconhecido' | 'tempo_esgotado' | 'conta_possivelmente_excluida'>;

const CODIGOS_CONHECIDOS: readonly CodigoDoServidor[] = [
  'nao_autenticado',
  'confirmacao_invalida',
  'tente_novamente',
  'conta_de_profissional',
  'conta_nao_e_de_cliente',
  'premium_requer_aceite',
  'senha_obrigatoria',
  'senha_incorreta',
  'muitas_tentativas',
  'reautenticar',
  'cadastro_precisa_correcao',
  'falha_ao_excluir',
];

export const MENSAGEM_ERRO_EXCLUSAO: Record<CodigoErroExclusao, string> = {
  nao_autenticado: 'Sua sessão expirou. Entre de novo para confirmar a exclusão.',
  confirmacao_invalida: 'A confirmação não confere. Digite EXCLUIR, em letras maiúsculas.',
  tente_novamente: 'Já há uma exclusão em andamento nesta conta. Aguarde alguns segundos e tente de novo.',
  conta_de_profissional:
    'Esta é uma conta de profissional e não pode ser excluída por aqui. Fale com o suporte.',
  conta_nao_e_de_cliente:
    'Esta conta não é de cliente, por isso não pode ser excluída por aqui. Se acha que é um engano, fale com o suporte.',
  premium_requer_aceite:
    'Seu plano Premium ativo será encerrado junto com a conta. Marque a ciência abaixo para continuar.',
  senha_obrigatoria: 'Digite a sua senha para confirmar a exclusão.',
  senha_incorreta: 'Senha incorreta. Confira e tente de novo.',
  muitas_tentativas: 'Muitas tentativas com senha incorreta. Por segurança, aguarde 15 minutos e tente de novo.',
  reautenticar: 'Por segurança, entre de novo para confirmar a exclusão da conta.',
  cadastro_precisa_correcao:
    'O seu cadastro tem um dado antigo inválido (o CPF) que precisa ser corrigido antes da exclusão. Peça ao profissional que te atende para corrigir o CPF, ou fale com o suporte.',
  falha_ao_excluir:
    'Tivemos um problema no servidor e nada foi alterado na sua conta. Tente de novo em instantes; se continuar, fale com o suporte.',
  tempo_esgotado:
    'A resposta demorou demais. Sua conta pode já ter sido excluída. Tente de novo; se aparecer que a sessão expirou, a exclusão foi concluída.',
  conta_possivelmente_excluida:
    'Não encontramos mais a sua sessão. Como a resposta anterior se perdeu, sua conta pode já ter sido excluída. Tente entrar de novo para conferir.',
  desconhecido:
    'Não foi possível excluir a conta agora. Confira sua conexão e tente de novo; se continuar, fale com o suporte.',
};

// Erros cuja saída é falar com o suporte: a interface mostra o canal junto da mensagem.
const CODIGOS_COM_SUPORTE: readonly CodigoErroExclusao[] = [
  'conta_de_profissional',
  'conta_nao_e_de_cliente',
  'cadastro_precisa_correcao',
  'falha_ao_excluir',
  'desconhecido',
];

export function sugereSuporte(codigo: CodigoErroExclusao): boolean {
  return CODIGOS_COM_SUPORTE.includes(codigo);
}

// A senha errada diz quantas tentativas restam antes do bloqueio de 15 minutos.
export function mensagemDoErroExclusao(codigo: CodigoErroExclusao, tentativasRestantes?: number): string {
  if (codigo === 'senha_incorreta' && typeof tentativasRestantes === 'number') {
    if (tentativasRestantes <= 0) {
      return 'Senha incorreta. Por segurança, novas tentativas ficam bloqueadas por 15 minutos.';
    }
    const resto = tentativasRestantes === 1 ? 'Resta 1 tentativa' : `Restam ${tentativasRestantes} tentativas`;
    return `Senha incorreta. ${resto} antes de um bloqueio de 15 minutos.`;
  }
  return MENSAGEM_ERRO_EXCLUSAO[codigo];
}

// Nesses erros o caminho é sair e entrar de novo (a sessão não vale mais para a ação).
export function exigeNovoLogin(codigo: CodigoErroExclusao): boolean {
  return codigo === 'reautenticar' || codigo === 'nao_autenticado' || codigo === 'conta_possivelmente_excluida';
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

function acharCodigoDoServidor(texto: string): CodigoDoServidor | undefined {
  return CODIGOS_CONHECIDOS.find((c) => texto.includes(c));
}

export function interpretarErroExclusao(erro: unknown): CodigoErroExclusao {
  if (!erro || typeof erro !== 'object') return 'desconhecido';
  const e = erro as { message?: unknown; details?: unknown };
  const texto = [e.message, e.details].filter((v): v is string => typeof v === 'string').join(' ');
  const achado = acharCodigoDoServidor(texto);
  if (achado) return achado;
  // Token vencido chega do PostgREST como "JWT expired", sem passar pela RPC.
  if (/jwt/i.test(texto)) return 'nao_autenticado';
  return 'desconhecido';
}

export type ResultadoExclusao =
  | { ok: true; desvinculados: number }
  | { ok: false; codigo: CodigoErroExclusao; tentativasRestantes?: number };

type RespostaRpc = { data: unknown; error: unknown };
type ChamadaRpc = (nome: string, args: Record<string, unknown>) => PromiseLike<RespostaRpc>;

const ESTOUROU = Symbol('tempo-esgotado');

function esperarComLimite<T>(chamada: PromiseLike<T>, ms: number): Promise<T | typeof ESTOUROU> {
  return new Promise((resolver, rejeitar) => {
    const relogio = setTimeout(() => resolver(ESTOUROU), ms);
    Promise.resolve(chamada).then(
      (resposta) => {
        clearTimeout(relogio);
        resolver(resposta);
      },
      (erro: unknown) => {
        clearTimeout(relogio);
        rejeitar(erro);
      },
    );
  });
}

// A RPC é nova e ainda não está nos tipos gerados do Supabase.
export async function excluirMinhaContaCliente(params: {
  confirmacao: string;
  senha?: string | null;
  /** Só vale quando a pessoa marcou a ciência de que o plano Premium ativo será encerrado. */
  aceitaPerderPremium?: boolean;
}): Promise<ResultadoExclusao> {
  try {
    const resposta = await esperarComLimite(
      (supabase as unknown as { rpc: ChamadaRpc }).rpc('excluir_minha_conta_cliente', {
        p_confirmacao: normalizarConfirmacao(params.confirmacao),
        p_senha: params.senha ? params.senha : null,
        p_aceita_perder_premium: params.aceitaPerderPremium === true,
      }),
      TEMPO_LIMITE_EXCLUSAO_MS,
    );
    if (resposta === ESTOUROU) return { ok: false, codigo: 'tempo_esgotado' };
    const { data, error } = resposta;
    if (error) return { ok: false, codigo: interpretarErroExclusao(error) };
    const retorno = (data ?? {}) as {
      ok?: unknown;
      erro?: unknown;
      tentativas_restantes?: unknown;
      pacientes_desvinculados?: unknown;
    };
    if (retorno.ok === false && typeof retorno.erro === 'string') {
      // Senha errada: o servidor responde normalmente (não levanta erro) para contar as tentativas.
      const codigo = acharCodigoDoServidor(retorno.erro) ?? 'desconhecido';
      const restantes = Number(retorno.tentativas_restantes);
      const tentativasRestantes = Number.isFinite(restantes) ? restantes : undefined;
      return tentativasRestantes === undefined ? { ok: false, codigo } : { ok: false, codigo, tentativasRestantes };
    }
    if (retorno.ok !== true) return { ok: false, codigo: 'desconhecido' };
    const n = Number(retorno.pacientes_desvinculados);
    return { ok: true, desvinculados: Number.isFinite(n) ? n : 0 };
  } catch (err) {
    // Falha de rede: a conta pode não ter sido tocada; o usuário tenta de novo.
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

const BUCKET_FOTO_CLIENTE = 'paciente-avatars';
const TEMPO_LIMITE_FOTO_MS = 5_000;

// O SQL não alcança o Storage: a foto do próprio cliente (bucket público) é apagada aqui, logo depois da exclusão
// confirmada e ainda com a sessão válida (a policy de remoção olha a pasta com o id do usuário). Melhor esforço:
// uma falha aqui nunca desfaz nem trava a exclusão da conta.
export async function removerFotoDoCliente(userId: string): Promise<boolean> {
  try {
    const resposta = await esperarComLimite(
      supabase.storage.from(BUCKET_FOTO_CLIENTE).remove([`${userId}/avatar.jpg`]),
      TEMPO_LIMITE_FOTO_MS,
    );
    if (resposta === ESTOUROU) {
      console.warn('[contaCliente] remoção da foto demorou demais; seguindo sem ela');
      return false;
    }
    if (resposta.error) {
      console.warn('[contaCliente] não foi possível remover a foto:', resposta.error);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[contaCliente] falha ao remover a foto:', err);
    return false;
  }
}

const CHAVE_AVISO_CONTA_EXCLUIDA = 'mh_conta_excluida';
const CHAVE_EMAIL_CONTA_EXCLUIDA = 'mh_conta_excluida_email';

export interface AvisoContaExcluida {
  titulo: string;
  descricao?: string;
}

// Quando o logout falha, a página é recarregada e o aviso de sucesso se perderia. Guardamos para a próxima carga.
// O e-mail vai à parte porque quem o usa é a tela de cadastro (lazy), que monta depois do aviso ser mostrado.
export function guardarAvisoContaExcluida(aviso: AvisoContaExcluida, email?: string | null): void {
  try {
    window.sessionStorage.setItem(CHAVE_AVISO_CONTA_EXCLUIDA, JSON.stringify(aviso));
    if (email) window.sessionStorage.setItem(CHAVE_EMAIL_CONTA_EXCLUIDA, email);
  } catch {
    // Storage bloqueado (modo privado): a conta foi excluída do mesmo jeito, só não há aviso depois do recarregamento.
  }
}

export function lerAvisoContaExcluida(): AvisoContaExcluida | null {
  try {
    const bruto = window.sessionStorage.getItem(CHAVE_AVISO_CONTA_EXCLUIDA);
    if (!bruto) return null;
    const dado = JSON.parse(bruto) as Partial<AvisoContaExcluida> | null;
    if (!dado || typeof dado.titulo !== 'string') return null;
    return { titulo: dado.titulo, descricao: typeof dado.descricao === 'string' ? dado.descricao : undefined };
  } catch {
    // Storage bloqueado ou valor corrompido: sem aviso.
    return null;
  }
}

export function descartarAvisoContaExcluida(): void {
  try {
    window.sessionStorage.removeItem(CHAVE_AVISO_CONTA_EXCLUIDA);
  } catch {
    // Storage bloqueado: nada a limpar.
  }
}

// Lê sem apagar (a leitura acontece na renderização, que o React pode repetir); quem usou chama o descartar.
export function lerEmailContaExcluida(): string {
  try {
    return window.sessionStorage.getItem(CHAVE_EMAIL_CONTA_EXCLUIDA) ?? '';
  } catch {
    // Storage bloqueado: o cadastro abre com o e-mail vazio.
    return '';
  }
}

export function descartarEmailContaExcluida(): void {
  try {
    window.sessionStorage.removeItem(CHAVE_EMAIL_CONTA_EXCLUIDA);
  } catch {
    // Storage bloqueado: nada a limpar.
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
