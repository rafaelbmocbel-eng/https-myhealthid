// AVISO AO CLIENTE quando a equipe científica chancela ou recusa o plano dele (WhatsApp).
//
// Decisão do Rafael (08/10/2026): mensagem curta e acolhedora, SEM conteúdo clínico (nem o recado da
// recusa, que pode citar a condição do cliente), só para cliente cadastrado e ativo, sob as regras das
// mensagens automáticas (pausa geral, registro na conversa do Zap). Best-effort: o portal continua
// mostrando o status mesmo quando o aviso não sai.
//
// Lógica PURA (sem Deno nem banco), testada em src/test/avisoPlanoCliente.test.ts. O envio, a leitura
// do banco e o registro ficam na edge notificar-plano-cliente.

export type StatusAvisavel = "chancelado" | "recusado";

/**
 * Gatilho gravado em agente_disparos (ref_id = id do plano): é o que impede o aviso duplicado. A edge reserva a
 * linha (status 'reservado') ANTES de enviar; o índice único parcial do banco deixa só uma reservada ou enviada
 * por plano, então chamadas paralelas não mandam a mensagem duas vezes.
 */
export const GATILHO_AVISO: Record<StatusAvisavel, string> = {
  chancelado: "plano_chancelado",
  recusado: "plano_recusado",
};

/** Origem da mensagem na conversa do Zap. */
export const ORIGEM_AVISO = "plano_cliente";

/** Só se avisa uma decisão recente: impede reavisar planos antigos chamando a edge à mão. */
export const JANELA_AVISO_HORAS = 48;

export interface PlanoParaAviso {
  id: string;
  paciente_id: string | null;
  tipo: string | null;
  status: string | null;
  revisado_em: string | null;
  revisor_id?: string | null;
}

export interface PacienteParaAviso {
  nome: string | null;
  telefone: string | null;
  ativo: boolean | null;
  user_id: string | null;
}

export type MotivoSemAviso =
  | "plano_nao_encontrado"
  | "plano_nao_decidido"
  | "fora_da_janela"
  | "cliente_nao_encontrado"
  | "cliente_inativo"
  | "cliente_sem_conta"
  | "sem_telefone"
  | "sem_remetente"
  | "ja_notificado"
  | "verificacao_indisponivel"
  | "whatsapp_nao_enviado";

export type DecisaoAviso =
  | { enviar: true; status: StatusAvisavel; gatilho: string; mensagem: string; telefone: string; remetenteId: string }
  | { enviar: false; motivo: MotivoSemAviso };

/** Primeiro nome aceitável: só letras, apóstrofo e hífen (até 30). Nada de link, número ou símbolo. */
const PRIMEIRO_NOME_VALIDO = /^[\p{L}][\p{L}'-]{0,29}$/u;

/**
 * "JOAO SILVA" -> "Joao". Os nomes dos clientes são gravados em maiúsculas. O cliente edita o próprio
 * cadastro, então o primeiro nome só entra na mensagem se parecer um nome; senão devolve "" e a mensagem
 * sai sem nome ("bit.ly/xyz" nunca chega ao WhatsApp de ninguém).
 */
export function primeiroNome(nome: string | null | undefined): string {
  const primeiro = String(nome ?? "").trim().split(/\s+/)[0] ?? "";
  if (!PRIMEIRO_NOME_VALIDO.test(primeiro)) return "";
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase();
}

function digitos(telefone: string | null | undefined): string {
  return String(telefone ?? "").replace(/\D/g, "");
}

/** Número com DDD (10 a 15 dígitos, com ou sem código do país). */
export function telefoneUtilizavel(telefone: string | null | undefined): boolean {
  const n = digitos(telefone).length;
  return n >= 10 && n <= 15;
}

function rotuloPlano(tipo: string | null | undefined): string {
  return tipo === "nutricao" ? "plano alimentar" : "plano de treino";
}

/**
 * Texto do aviso. Nunca leva conteúdo do plano, a nota pública da recusa, risco, condição de saúde
 * nem o nome de quem revisou: só diz que há novidade no portal.
 */
export function montarMensagemAviso(status: StatusAvisavel, tipo: string | null | undefined, nome: string | null | undefined): string {
  const saudacao = primeiroNome(nome) ? `Oi ${primeiroNome(nome)}!` : "Oi!";
  const plano = rotuloPlano(tipo);
  if (status === "chancelado") {
    return `${saudacao} Seu ${plano} foi revisado pela equipe científica do MyHealthID e já está disponível no seu portal. É só abrir o app para ver.`;
  }
  return `${saudacao} A equipe científica do MyHealthID revisou o seu ${plano} e deixou um recado para você no portal. É só abrir o app para ver.`;
}

/**
 * Quem pode pedir o aviso de um plano decidido: o próprio revisor que o decidiu ou o administrador. Os
 * demais membros da equipe não disparam mensagens ao cliente de um plano que não decidiram.
 */
export function chamadorPodeAvisar(a: { chamadorId: string; revisorId: string | null | undefined; ehSuperAdmin: boolean }): boolean {
  if (a.ehSuperAdmin) return true;
  return !!a.revisorId && a.revisorId === a.chamadorId;
}

/** Decide se o aviso sai e com qual texto. Não envia nada: quem chama envia e registra. */
export function decidirAviso(a: {
  plano: PlanoParaAviso | null;
  paciente: PacienteParaAviso | null;
  remetenteId: string | null;
  jaNotificado: boolean | "indisponivel";
  agora: Date;
}): DecisaoAviso {
  const { plano, paciente } = a;
  if (!plano) return { enviar: false, motivo: "plano_nao_encontrado" };
  if (plano.status !== "chancelado" && plano.status !== "recusado") return { enviar: false, motivo: "plano_nao_decidido" };
  const decididoEm = plano.revisado_em ? Date.parse(plano.revisado_em) : Number.NaN;
  if (Number.isNaN(decididoEm)) return { enviar: false, motivo: "plano_nao_decidido" };
  if (a.agora.getTime() - decididoEm > JANELA_AVISO_HORAS * 3600_000) return { enviar: false, motivo: "fora_da_janela" };

  if (!paciente) return { enviar: false, motivo: "cliente_nao_encontrado" };
  if (paciente.ativo !== true) return { enviar: false, motivo: "cliente_inativo" };
  if (!paciente.user_id) return { enviar: false, motivo: "cliente_sem_conta" };
  if (!telefoneUtilizavel(paciente.telefone)) return { enviar: false, motivo: "sem_telefone" };
  if (!a.remetenteId) return { enviar: false, motivo: "sem_remetente" };
  if (a.jaNotificado === "indisponivel") return { enviar: false, motivo: "verificacao_indisponivel" };
  if (a.jaNotificado) return { enviar: false, motivo: "ja_notificado" };

  return {
    enviar: true,
    status: plano.status,
    gatilho: GATILHO_AVISO[plano.status],
    mensagem: montarMensagemAviso(plano.status, plano.tipo, paciente.nome),
    telefone: digitos(paciente.telefone),
    remetenteId: a.remetenteId,
  };
}
