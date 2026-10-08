// PLANO GERADO PELO CLIENTE PREMIUM — política, insumos e destino do plano.
//
// Decisão do Rafael (08/10/2026): o cliente só gera treino e plano nutricional se pagar
// (Premium), SÓ a partir do que é dele (MyID, formulários que nascem das respostas do MyID,
// histórico clínico e anamnese nutricional), e o plano só chega a ele depois de CHANCELADO
// pela equipe científica MyHealthID (tabela plano_cliente_chancela). O caminho do profissional
// não muda: recebe o plano e decide, como antes.
//
// Lógica PURA (sem Deno nem banco, salvo o `admin` injetado), testada em
// src/test/planoClienteChancela.test.ts. Os valores que o Rafael pode querer mudar ficam em
// POLITICA_PLANO_CLIENTE.
import type { ChamadorTriagem, FocoTriagem } from "./triagem-bloqueio.ts";

/** Só o que este módulo usa do cliente Supabase (service_role). */
interface AdminRpc {
  rpc(nome: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string; hint?: string } | null }>;
}

/** Leitura de tabela (cadeia select/eq/limit/maybeSingle) do cliente Supabase service_role. */
interface AdminLeitura {
  // deno-lint-ignore no-explicit-any
  from(tabela: string): any;
}

export const POLITICA_PLANO_CLIENTE = {
  /**
   * pacientes.tipo_conta que dá direito a GERAR o próprio plano. Hoje só o Premium: o teste
   * grátis de 7 dias de uma conta wellness_free deixou de valer. Para voltar a liberar,
   * acrescente 'wellness_free' aqui (e rode src/test/planoClienteChancela.test.ts).
   */
  tiposContaQueGeram: ["wellness_premium"] as readonly string[],
  /**
   * Insumos que podem constar do plano gerado pelo CLIENTE (nomes usados em
   * _governanca.fonte.insumos). Avaliação presencial, achados, exames e avaliação por voz do
   * profissional não entram. A biblioteca de exercícios é o banco de GIFs, não dado do paciente.
   */
  insumosDoCliente: [
    "MyID", "questionarios", "historico_clinico", "anamnese", "queixa_historia_atual",
    "restricoes_informadas", "biblioteca_exercicios",
  ] as readonly string[],
  /**
   * Tetos do pedido feito pelo CLIENTE. O portal manda valores fixos, mas quem chama a edge
   * direto não deve inflar o prompt (custo de IA, plano sem sentido na fila da equipe). O
   * profissional segue sem tetos: usa os campos da própria tela. Valores operacionais, não clínicos.
   */
  limitesPedido: {
    frequenciaSemanal: { min: 1, max: 7, padrao: 3 },
    duracaoSemanas: { min: 4, max: 16, padrao: 8 },
    refeicoesPorDia: { min: 3, max: 6, padrao: 5 },
    idadeMaxima: 120,
    niveisTreino: ["iniciante", "intermediario", "avancado"] as readonly string[],
    nivelTreinoPadrao: "iniciante",
    textoMax: { objetivo: 300, restricoes: 1500, preferencias: 600, sexo: 30, nivelAtividade: 60 },
  },
} as const;

export const STATUS_HTTP_SEM_PREMIUM = 402;
export const MENSAGEM_CLIENTE_SEM_PREMIUM =
  "Gerar o seu treino e o seu plano nutricional é um benefício do plano Premium. No Premium o plano é montado a partir do seu MyID e do seu histórico clínico e revisado pela equipe científica do MyHealthID antes de chegar a você. Se preferir, procure um profissional que use o MyHealthID.";
export const MENSAGEM_ERRO_ENVIO_REVISAO =
  "Não consegui enviar o seu plano para a revisão da equipe científica agora. Tente novamente em instantes.";
export const STATUS_HTTP_PLANO_EM_REVISAO = 409;
export const STATUS_HTTP_VERIFICACAO = 503;
export const MENSAGEM_ERRO_VERIFICACAO = "Não consegui verificar o seu plano agora. Tente novamente em instantes.";
const MARCA_PLANO_EM_REVISAO = "plano_em_revisao";

export function mensagemPlanoEmRevisao(tipo: FocoTriagem): string {
  const oQue = tipo === "treino" ? "um treino" : "um plano alimentar";
  return `Você já tem ${oQue} aguardando a revisão da equipe científica MyHealthID. Assim que for chancelado ele aparece aqui no portal; depois disso você pode gerar um novo.`;
}

/** Quem tem direito a gerar o próprio plano (sempre confira no servidor, nunca só no front). */
export function contaPodeGerarPlano(tipoConta: string | null | undefined): boolean {
  return typeof tipoConta === "string" && POLITICA_PLANO_CLIENTE.tiposContaQueGeram.includes(tipoConta);
}

// ── Pedido do cliente ──────────────────────────────────────────────────────

type Bruto = Record<string, unknown> | null | undefined;

function textoLimitado(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function inteiroEntre(v: unknown, min: number, max: number, padrao: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return padrao;
  return Math.min(max, Math.max(min, n));
}

export interface PedidoTreinoCliente {
  objetivo: string;
  nivel: string;
  frequencia_semanal: number;
  duracao_semanas: number;
  restricoes: string;
  idade: number | null;
  sexo: string;
}

export interface PedidoAlimentarCliente {
  objetivo: string;
  refeicoes_por_dia: number;
  restricoes: string;
  preferencias: string;
  idade: number | null;
  sexo: string;
  nivel_atividade: string;
}

function idadeLimitada(v: unknown): number | null {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n > 0 && n <= POLITICA_PLANO_CLIENTE.limitesPedido.idadeMaxima ? n : null;
}

/** Pedido de treino do CLIENTE com os tetos de POLITICA_PLANO_CLIENTE.limitesPedido. Nunca lança. */
export function limitarPedidoTreinoCliente(b: Bruto): PedidoTreinoCliente {
  const l = POLITICA_PLANO_CLIENTE.limitesPedido;
  const nivel = textoLimitado(b?.nivel, 30).toLowerCase();
  return {
    objetivo: textoLimitado(b?.objetivo, l.textoMax.objetivo),
    nivel: l.niveisTreino.includes(nivel) ? nivel : l.nivelTreinoPadrao,
    frequencia_semanal: inteiroEntre(b?.frequencia_semanal, l.frequenciaSemanal.min, l.frequenciaSemanal.max, l.frequenciaSemanal.padrao),
    duracao_semanas: inteiroEntre(b?.duracao_semanas, l.duracaoSemanas.min, l.duracaoSemanas.max, l.duracaoSemanas.padrao),
    restricoes: textoLimitado(b?.restricoes, l.textoMax.restricoes),
    idade: idadeLimitada(b?.idade),
    sexo: textoLimitado(b?.sexo, l.textoMax.sexo),
  };
}

/** Pedido de plano alimentar do CLIENTE com os tetos de POLITICA_PLANO_CLIENTE.limitesPedido. Nunca lança. */
export function limitarPedidoAlimentarCliente(b: Bruto): PedidoAlimentarCliente {
  const l = POLITICA_PLANO_CLIENTE.limitesPedido;
  return {
    objetivo: textoLimitado(b?.objetivo, l.textoMax.objetivo),
    refeicoes_por_dia: inteiroEntre(b?.refeicoes_por_dia, l.refeicoesPorDia.min, l.refeicoesPorDia.max, l.refeicoesPorDia.padrao),
    restricoes: textoLimitado(b?.restricoes, l.textoMax.restricoes),
    preferencias: textoLimitado(b?.preferencias, l.textoMax.preferencias),
    idade: idadeLimitada(b?.idade),
    sexo: textoLimitado(b?.sexo, l.textoMax.sexo),
    nivel_atividade: textoLimitado(b?.nivel_atividade, l.textoMax.nivelAtividade),
  };
}

// ── Insumos ────────────────────────────────────────────────────────────────

/** O que da avaliação do profissional o motor clínico pode carregar (formato estrutural). */
export interface MotoresRestringiveis {
  presencial: unknown[];
  exames: unknown[];
  avaliacaoVoz: unknown | null;
  avaliacaoRedFlags?: boolean;
}

/**
 * Visão do cliente sobre os motores: sem achados/notas da avaliação presencial, sem exames do
 * profissional e sem a avaliação por voz. Fica o que o próprio cliente informa (MyID,
 * questionários, histórico clínico, queixa e história, anamnese). Não muta o original, que a
 * triagem de segurança continua lendo inteiro (falso negativo é risco de saúde).
 */
export function restringirAInsumosDoCliente<T extends MotoresRestringiveis>(m: T | null): T | null {
  if (!m) return null;
  return { ...m, presencial: [], exames: [], avaliacaoVoz: null, avaliacaoRedFlags: false } as T;
}

/** Só o profissional pode usar fontes que são dele (bioimpedância, testes, recordatório...). */
export function podeUsarFontesDoProfissional(chamador: ChamadorTriagem): boolean {
  return chamador === "profissional";
}

export interface DadosDoPedido {
  antropometria?: unknown;
  testes?: unknown;
  recordatorio?: unknown;
}

/**
 * Dados clínicos que vieram no corpo do pedido. Do cliente não se aceita antropometria, testes
 * funcionais nem recordatório (o servidor não tem como saber de onde vieram); o que vale para
 * ele é a anamnese gravada no banco.
 */
export function dadosDoPedido(chamador: ChamadorTriagem, d: DadosDoPedido): DadosDoPedido {
  if (podeUsarFontesDoProfissional(chamador)) return d;
  return { antropometria: null, testes: null, recordatorio: null };
}

/** Lista final de insumos para _governanca.fonte.insumos: o cliente nunca registra fonte de profissional. */
export function insumosDoPlano(chamador: ChamadorTriagem, insumos: readonly string[]): string[] {
  const unicos = [...new Set(insumos)];
  if (chamador !== "cliente") return unicos;
  return unicos.filter((i) => POLITICA_PLANO_CLIENTE.insumosDoCliente.includes(i));
}

// ── Destino do plano gerado ────────────────────────────────────────────────

export interface RegistroParaChancela {
  p_paciente_id: string;
  p_tipo: FocoTriagem;
  p_titulo: string | null;
  p_objetivo: string | null;
  p_conteudo: Record<string, unknown>;
}

export interface EntregaPlano {
  /** 'devolver' = profissional recebe o plano; 'fila_chancela' = cliente, vai para a equipe científica. */
  destino: "devolver" | "fila_chancela";
  registro: RegistroParaChancela | null;
  erro: string | null;
}

function textoOuNulo(v: unknown, max = 300): string | null {
  return typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
}

export function planejarEntregaPlano(a: {
  chamador: ChamadorTriagem;
  tipo: FocoTriagem;
  pacienteId: string | null;
  plano: unknown;
  objetivo?: unknown;
}): EntregaPlano {
  if (a.chamador !== "cliente") return { destino: "devolver", registro: null, erro: null };
  const plano = a.plano && typeof a.plano === "object" && !Array.isArray(a.plano) ? (a.plano as Record<string, unknown>) : null;
  if (!a.pacienteId || !plano) {
    return { destino: "fila_chancela", registro: null, erro: "plano_ou_paciente_ausente" };
  }
  return {
    destino: "fila_chancela",
    registro: {
      p_paciente_id: a.pacienteId,
      p_tipo: a.tipo,
      p_titulo: textoOuNulo(plano.titulo, 200),
      p_objetivo: textoOuNulo(a.objetivo),
      p_conteudo: plano,
    },
    erro: null,
  };
}

/** Resposta do cliente: confirma o envio para revisão e NUNCA traz o conteúdo do plano. */
export function respostaPlanoEmRevisao(planoId: string) {
  return { ok: true, em_revisao: true, plano_id: planoId };
}

export interface ResultadoGravacao {
  ok: boolean;
  planoId: string | null;
  erro: string | null;
  /** Só presente (true) quando já havia plano deste tipo aguardando a equipe (corrida entre gerações). */
  jaEmRevisao?: true;
}

export async function gravarParaChancela(
  admin: AdminRpc,
  registro: RegistroParaChancela,
): Promise<ResultadoGravacao> {
  try {
    const { data, error } = await admin.rpc("registrar_plano_cliente_chancela", { ...registro });
    if (error) {
      const erro = String(error.message ?? "falha ao gravar");
      if (erro.includes(MARCA_PLANO_EM_REVISAO) || error.hint === MARCA_PLANO_EM_REVISAO) {
        return { ok: false, planoId: null, erro, jaEmRevisao: true };
      }
      return { ok: false, planoId: null, erro };
    }
    if (typeof data !== "string" || !data) return { ok: false, planoId: null, erro: "resposta_sem_id" };
    return { ok: true, planoId: data, erro: null };
  } catch (e) {
    return { ok: false, planoId: null, erro: String((e as Error)?.message ?? e) };
  }
}

export interface ResultadoEntrega {
  status: number;
  corpo: Record<string, unknown>;
}

/**
 * Último passo das edges de geração. Profissional: devolve o plano (mais os campos extras da
 * função). Cliente: grava na fila de chancela e responde só que está em revisão; se a gravação
 * falhar responde erro, nunca finge sucesso e nunca entrega o plano sem chancela.
 */
export async function entregarPlano(
  admin: AdminRpc,
  a: {
    chamador: ChamadorTriagem;
    tipo: FocoTriagem;
    pacienteId: string | null;
    plano: unknown;
    objetivo?: unknown;
    extrasProfissional?: Record<string, unknown>;
  },
): Promise<ResultadoEntrega> {
  const entrega = planejarEntregaPlano(a);
  if (entrega.destino === "devolver") {
    return { status: 200, corpo: { ok: true, plano: a.plano, ...(a.extrasProfissional ?? {}) } };
  }
  if (!entrega.registro) return { status: 500, corpo: { error: MENSAGEM_ERRO_ENVIO_REVISAO } };
  const g = await gravarParaChancela(admin, entrega.registro);
  if (g.jaEmRevisao) {
    return {
      status: STATUS_HTTP_PLANO_EM_REVISAO,
      corpo: { error: mensagemPlanoEmRevisao(a.tipo), codigo: MARCA_PLANO_EM_REVISAO },
    };
  }
  if (!g.ok || !g.planoId) {
    console.error(JSON.stringify({ fn: "entregarPlano", tipo: a.tipo, erro: g.erro }));
    return { status: 500, corpo: { error: MENSAGEM_ERRO_ENVIO_REVISAO } };
  }
  return { status: 200, corpo: respostaPlanoEmRevisao(g.planoId) };
}

/** Já existe plano deste tipo aguardando a equipe? 'erro' = não deu para saber (quem chama recusa). */
export async function planoJaEmRevisao(
  admin: AdminLeitura,
  pacienteId: string,
  tipo: FocoTriagem,
): Promise<"sim" | "nao" | "erro"> {
  try {
    const { data, error } = await admin.from("plano_cliente_chancela").select("id")
      .eq("paciente_id", pacienteId).eq("tipo", tipo).eq("status", "aguardando").limit(1).maybeSingle();
    if (error) return "erro";
    return data ? "sim" : "nao";
  } catch (_e) {
    return "erro";
  }
}

/**
 * Barreira do CLIENTE antes de gastar IA: só Premium gera (402) e só um plano por tipo fica
 * aguardando a equipe (409; a equipe pode estar lendo ou editando o plano da fila). Se não der
 * para verificar, recusa (503): nunca "sem dados = liberado". Devolve null quando pode seguir
 * (e sempre para o profissional, que segue o fluxo dele).
 */
export async function barreiraDoCliente(
  admin: AdminLeitura,
  a: {
    chamador: ChamadorTriagem;
    tipo: FocoTriagem;
    pacienteId: string | null;
    paciente: { tipo_conta?: string | null } | null;
  },
): Promise<ResultadoEntrega | null> {
  if (a.chamador !== "cliente") return null;
  if (!contaPodeGerarPlano(a.paciente?.tipo_conta)) {
    return { status: STATUS_HTTP_SEM_PREMIUM, corpo: { error: MENSAGEM_CLIENTE_SEM_PREMIUM, codigo: "premium_necessario" } };
  }
  if (!a.pacienteId) return { status: 403, corpo: { error: "Sem permissão para gerar plano." } };
  const emRevisao = await planoJaEmRevisao(admin, a.pacienteId, a.tipo);
  if (emRevisao === "sim") {
    return {
      status: STATUS_HTTP_PLANO_EM_REVISAO,
      corpo: { error: mensagemPlanoEmRevisao(a.tipo), codigo: MARCA_PLANO_EM_REVISAO },
    };
  }
  if (emRevisao === "erro") return { status: STATUS_HTTP_VERIFICACAO, corpo: { error: MENSAGEM_ERRO_VERIFICACAO } };
  return null;
}
