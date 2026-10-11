import { supabase } from '@/integrations/supabase/client';
import { erroDaFuncao, ErroFuncao } from '@/lib/fnError';
import {
  extrairBloqueio, formatarDataBR, type BloqueioTriagem, type OverrideTriagem, type TipoPlanoGov,
} from '@/lib/governanca';

// Chamada das edges gerar-plano-treino / gerar-plano-alimentar. A triagem de
// segurança responde HTTP 200 com { ok:false, bloqueio } em vez de erro, então
// quem chama precisa tratar os dois desfechos: o plano ou o bloqueio.
//
// Há dois caminhos, conforme quem chama (o servidor decide pelo JWT):
//  - PROFISSIONAL: `gerarPlanoComTriagem` → recebe { ok:true, plano } e libera pelo fluxo atual.
//  - CLIENTE Premium: `gerarPlanoDoCliente` → recebe { ok:true, em_revisao:true, plano_id }, SEM o
//    conteúdo: o plano vai para a fila da equipe científica MyHealthID e só chega ao cliente
//    depois de chancelado (RPC `meu_plano_liberado`).

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

async function invocarGeracao(
  funcao: FuncaoGeracaoPlano,
  corpo: Record<string, unknown>,
  override?: OverrideTriagem | null,
): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke(funcao, {
    body: override ? { ...corpo, override } : corpo,
  });
  if (error) throw await erroDaFuncao(error);
  return data;
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
  return interpretarRespostaGeracao(await invocarGeracao(funcao, corpo, override));
}

// ── Cliente Premium: o plano vai para a chancela da equipe científica ───────

export type ResultadoGeracaoCliente =
  | { tipo: 'em_revisao'; planoId: string }
  | { tipo: 'bloqueio'; bloqueio: BloqueioTriagem };

export const MENSAGEM_ENVIO_REVISAO_FALHOU =
  'Não consegui enviar o seu plano para a revisão da equipe agora. Tente de novo em instantes.';

/**
 * Interpreta a resposta da edge para quem chamou como CLIENTE. Só vale o recibo de envio para a
 * fila ({ ok:true, em_revisao:true, plano_id }); um plano com conteúdo nunca é aceito aqui (não
 * passou pela chancela). Qualquer outra coisa lança Error (fail-closed).
 */
export function interpretarRespostaGeracaoCliente(data: unknown): ResultadoGeracaoCliente {
  const d = (data && typeof data === 'object' ? data : {}) as {
    ok?: unknown; error?: unknown; em_revisao?: unknown; plano_id?: unknown;
  };
  if (d.ok !== true) {
    const bloqueio = extrairBloqueio(data);
    if (bloqueio) return { tipo: 'bloqueio', bloqueio };
  }
  if (typeof d.error === 'string' && d.error) throw new Error(d.error);
  if (d.ok === true && d.em_revisao === true && typeof d.plano_id === 'string' && d.plano_id) {
    return { tipo: 'em_revisao', planoId: d.plano_id };
  }
  throw new Error(MENSAGEM_ENVIO_REVISAO_FALHOU);
}

/** Invoca a edge de geração como cliente: nunca envia `override` (o servidor também o recusa). */
export async function gerarPlanoDoCliente(
  funcao: FuncaoGeracaoPlano,
  corpo: Record<string, unknown>,
): Promise<ResultadoGeracaoCliente> {
  return interpretarRespostaGeracaoCliente(await invocarGeracao(funcao, corpo));
}

// ── Pedido do cliente ────────────────────────────────────────────────────────

export const OBJETIVO_PADRAO_CLIENTE = 'Saúde geral, alívio de dor e mais energia no dia a dia';

export interface DadosPedidoCliente {
  pacienteId: string;
  /** `nutricao_anamnese.respostas` do próprio cliente. */
  anamnese?: Record<string, unknown> | null;
  nascimento?: string | null;
  sexo?: string | null;
}

function textoDe(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Idade/sexo do cadastro; a idade EXATA a edge recalcula pela data de nascimento no banco. */
function perfilDoPedido(d: DadosPedidoCliente): { idade?: number; sexo?: string } {
  const idade = idadeEmAnos(d.nascimento) ?? undefined;
  const sexo = textoDe(d.sexo) || undefined;
  return { ...(idade !== undefined ? { idade } : {}), ...(sexo ? { sexo } : {}) };
}

/** Objetivo declarado na anamnese do cliente, ou o objetivo geral padrão. */
export function objetivoDoCliente(anamnese: Record<string, unknown> | null | undefined): string {
  return textoDe(anamnese?.objetivo) || OBJETIVO_PADRAO_CLIENTE;
}

/**
 * Corpo do pedido de treino do cliente. Só leva o que é dele (objetivo da anamnese, idade/sexo do
 * cadastro e, no "Senti incômodo", o relato); o servidor ignora avaliação presencial, exames e
 * antropometria vindos do body de um cliente.
 */
export function montarPedidoTreinoCliente(d: DadosPedidoCliente, incomodo?: string): Record<string, unknown> {
  const relato = textoDe(incomodo);
  return {
    paciente_id: d.pacienteId,
    objetivo: objetivoDoCliente(d.anamnese),
    nivel: 'iniciante',
    frequencia_semanal: 3,
    duracao_semanas: 8,
    ...perfilDoPedido(d),
    ...(relato
      ? { restricoes: `IMPORTANTE — incômodo relatado pelo paciente, adapte com cuidado (reduza carga/ADM ou substitua exercícios que sobrecarreguem a região; progrida devagar): ${relato}` }
      : {}),
  };
}

/** Corpo do pedido de plano alimentar do cliente (anamnese nutricional dele). */
export function montarPedidoNutricaoCliente(d: DadosPedidoCliente): Record<string, unknown> {
  const r = d.anamnese ?? {};
  const perfil = perfilDoPedido(d);
  const idadeAnamnese = Number(r.idade);
  return {
    paciente_id: d.pacienteId,
    objetivo: objetivoDoCliente(r),
    refeicoes_por_dia: Number(r.refeicoes_por_dia) || 5,
    restricoes: textoDe(r.restricoes_alergias),
    preferencias: textoDe(r.preferencias),
    idade: Number.isFinite(idadeAnamnese) && idadeAnamnese > 0 ? idadeAnamnese : perfil.idade,
    sexo: textoDe(r.sexo) || perfil.sexo,
    nivel_atividade: textoDe(r.nivel_atividade) || undefined,
  };
}

// ── Erros das edges de geração, em linguagem para quem pediu o plano ─────────

export const CODIGO_NUTRICAO_EM_BREVE = 'nutricao_em_breve';
export const CODIGO_PROFISSIONAL_NAO_VERIFICADO = 'profissional_nao_verificado';

export const MENSAGEM_NUTRICAO_EM_BREVE = 'O plano nutricional Premium estará disponível em breve.';
export const ROTULO_NUTRICAO_EM_BREVE = 'Plano nutricional Premium: em breve';
export const MENSAGEM_PROFISSIONAL_NAO_VERIFICADO =
  'Seu perfil profissional ainda não foi verificado pela equipe MyHealthID. Informe o seu registro no conselho em Configurações; assim que a equipe verificar, você poderá gerar planos por aqui.';

function codigoDoErro(erro: unknown): string | null {
  return erro instanceof ErroFuncao ? erro.codigo : null;
}

/** O servidor recusou a nutrição porque o plano nutricional Premium ainda está desligado. */
export function ehNutricaoEmBreve(erro: unknown): boolean {
  return codigoDoErro(erro) === CODIGO_NUTRICAO_EM_BREVE;
}

/**
 * Texto do toast quando a geração falha. Os 403 conhecidos ganham mensagem própria (o texto do
 * servidor pode mudar, o código não); o resto usa o texto do servidor ou o aviso de `padrao`.
 */
export function mensagemErroGeracao(erro: unknown, padrao: string = MENSAGEM_GERACAO_FALHOU): string {
  const codigo = codigoDoErro(erro);
  if (codigo === CODIGO_NUTRICAO_EM_BREVE) return MENSAGEM_NUTRICAO_EM_BREVE;
  if (codigo === CODIGO_PROFISSIONAL_NAO_VERIFICADO) return MENSAGEM_PROFISSIONAL_NAO_VERIFICADO;
  const mensagem = (erro as { message?: unknown } | null)?.message;
  return typeof mensagem === 'string' && mensagem.trim() ? mensagem : padrao;
}

// ── Situação do plano do cliente (RPC meu_status_plano_cliente) ──────────────

export type StatusPlanoCliente = 'aguardando' | 'chancelado' | 'recusado' | 'cancelado';

export interface SituacaoPlanoCliente {
  /** null = o cliente ainda não gerou plano deste tipo (ou o status não pôde ser lido). */
  status: StatusPlanoCliente | null;
  geradoEm: string | null;
  /** Recado curto da equipe ao cliente (motivo da recusa). */
  notaPublica: string | null;
  /** Fim do prazo da equipe para este pedido (só enquanto aguarda). */
  prazoPrevisto: string | null;
  /** O pedido aguardando estourou o prazo da equipe. */
  atrasado: boolean;
  /** O cliente pode pedir outro plano deste tipo (nada aguardando dentro do prazo). */
  podeRegenerar: boolean;
}

export const SITUACAO_VAZIA: SituacaoPlanoCliente = {
  status: null, geradoEm: null, notaPublica: null, prazoPrevisto: null, atrasado: false, podeRegenerar: true,
};

const STATUS_CONHECIDOS: readonly string[] = ['aguardando', 'chancelado', 'recusado', 'cancelado'];

/**
 * Leitura defensiva de `meu_status_plano_cliente`; qualquer formato inesperado vira "sem status".
 * Sem o campo `pode_regenerar` (servidor antigo) vale a regra segura: só gera de novo quem não está aguardando.
 */
export function lerSituacaoPlanoCliente(data: unknown): SituacaoPlanoCliente {
  const d = (data && typeof data === 'object' && !Array.isArray(data) ? data : {}) as Record<string, unknown>;
  const status = typeof d.status === 'string' && STATUS_CONHECIDOS.includes(d.status) ? (d.status as StatusPlanoCliente) : null;
  if (!status) return SITUACAO_VAZIA;
  return {
    status,
    geradoEm: textoDe(d.gerado_em) || null,
    notaPublica: textoDe(d.nota_publica) || null,
    prazoPrevisto: status === 'aguardando' ? textoDe(d.prazo_previsto) || null : null,
    atrasado: status === 'aguardando' && d.atrasado === true,
    podeRegenerar: typeof d.pode_regenerar === 'boolean' ? d.pode_regenerar : status !== 'aguardando',
  };
}

export const TEXTO_EM_REVISAO = 'Em revisão pela equipe científica MyHealthID — você recebe aqui quando for chancelado';

/** 'Previsão: até dd/mm/aaaa' (fuso de Brasília); '' quando o servidor não informou o prazo. */
export function textoPrevisao(prazoPrevisto: string | null | undefined): string {
  const data = formatarDataBR(prazoPrevisto);
  return data ? `Previsão: até ${data}` : '';
}

/** Recado acolhedor quando o pedido passou do prazo da equipe. */
export function textoAtrasado(prazoPrevisto: string | null | undefined): string {
  const data = formatarDataBR(prazoPrevisto);
  const previsto = data ? ` (a previsão era até ${data})` : '';
  return `Sentimos muito: a revisão do seu pedido está levando mais tempo do que o previsto${previsto}. A equipe científica MyHealthID continua com ele. Se preferir não esperar, você pode pedir de novo (o novo pedido substitui este) ou cancelar.`;
}

/** Primeira linha do aviso de recusa: o recado da equipe ao cliente, sem pontuação sobrando no fim. */
export function textoRecusado(notaPublica: string | null | undefined): string {
  const nota = textoDe(notaPublica).replace(/[\s.,;:!?]+$/, '');
  return nota ? `Recusado: ${nota}` : 'Recusado pela equipe científica MyHealthID';
}

export const TEXTO_APOS_RECUSA = 'Você pode gerar de novo ou procurar um profissional.';

/** Aviso (toast) depois de enviar planos para a revisão da equipe científica. */
export function mensagemEnviadoParaRevisao(enviados: readonly TipoPlanoGov[], incomodo = false): string {
  if (incomodo) {
    return 'Recebemos o seu relato. O treino adaptado foi enviado para a revisão da equipe científica MyHealthID e o treino atual segue valendo até lá. Se o incômodo for forte ou não passar, procure um profissional.';
  }
  const treino = enviados.includes('treino');
  const nutricao = enviados.includes('nutricao');
  const quem = treino && nutricao ? 'Seu treino e seu plano alimentar foram enviados' : treino ? 'Seu treino foi enviado' : 'Seu plano alimentar foi enviado';
  return `${quem} para a revisão da equipe científica MyHealthID. Você recebe aqui quando for chancelado.`;
}

export interface BotaoGerar {
  rotulo: string;
  desabilitado: boolean;
}

const ROTULOS_GERAR: Record<TipoPlanoGov, { novo: string; outro: string; denovo: string; revisao: string }> = {
  treino: { novo: 'Gerar treino', outro: 'Gerar novo treino', denovo: 'Gerar treino de novo', revisao: 'Treino em revisão' },
  nutricao: { novo: 'Gerar nutrição', outro: 'Gerar nova nutrição', denovo: 'Gerar nutrição de novo', revisao: 'Nutrição em revisão' },
};

/**
 * Rótulo e estado do botão de gerar. Quem decide se pode pedir outro plano é o servidor
 * (`pode_regenerar`): enquanto há um pedido aguardando dentro do prazo, o botão fica desligado (o
 * servidor também recusa, HTTP 409). Pedido atrasado, recusado, cancelado ou sem pedido: habilitado.
 * `temChancelado`: o cliente já tem um plano chancelado visível, que continua valendo até o novo
 * ser chancelado.
 */
export function botaoGerar(
  tipo: TipoPlanoGov,
  status: StatusPlanoCliente | null,
  temChancelado: boolean,
  podeRegenerar: boolean = status !== 'aguardando',
): BotaoGerar {
  const r = ROTULOS_GERAR[tipo];
  if (!podeRegenerar) return { rotulo: status === 'aguardando' ? r.revisao : temChancelado ? r.outro : r.novo, desabilitado: true };
  if (status === 'aguardando' || status === 'recusado') return { rotulo: r.denovo, desabilitado: false };
  return { rotulo: temChancelado ? r.outro : r.novo, desabilitado: false };
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
