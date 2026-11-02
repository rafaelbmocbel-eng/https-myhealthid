// Check-in semanal pelo WhatsApp (Z-API): decisões puras do webhook e do envio de domingo à noite.
// Sem Deno, DOM nem rede: o webhook e a Edge Function de envio só executam o que estas funções decidem,
// e os casos estão em src/test/checkinWhatsapp.test.ts. Textos e leitura da resposta: ./checkin-semanal.ts.
import {
  interpretarRespostaCheckin,
  pareceTentativaDeCheckin,
  reconheceParar,
  reconheceVoltar,
  type MotivoRecusa,
  type ResultadoLeitura,
  type ValoresCheckin,
} from './checkin-semanal.ts';

const HORA_MS = 3600000;
const DIA_MS = 24 * HORA_MS;
const OFFSET_BR_MS = 3 * HORA_MS;

/** PARAR só vale para quem recebeu um pedido de check-in neste prazo. */
export const DIAS_PEDIDO_RECENTE = 30;
/** O pedido de domingo vale até a manhã de terça: a resposta de segunda conta para a semana que acabou. */
export const VALIDADE_PEDIDO_HORAS = 48;
/** Treinou nas últimas 3 semanas: ganha a pergunta opcional de recuperação do treino. */
export const DIAS_JANELA_TREINO = 21;
/** Proteção contra bloqueio do número (Z-API não oficial): poucos envios por rodada, com pausa entre eles. */
export const LIMITE_LOTE_POR_PROFISSIONAL = 5;
export const PAUSA_ENTRE_ENVIOS_MS = { min: 4000, max: 9000 } as const;
/** Depois disso na mesma semana, o cliente sai das próximas rodadas (número inválido não pode travar o lote). */
export const MAX_ERROS_POR_SEMANA = 3;
/** Três falhas seguidas no mesmo lote indicam WhatsApp desconectado: para e tenta na próxima rodada. */
export const FALHAS_SEGUIDAS_PARA_PARAR = 3;
export const JANELA_ENVIO_BR = { diaSemana: 0, horaInicio: 18, horaFim: 21 } as const;

export const URL_BASE_APP = 'https://www.myhealthid.com.br';

// ───────────── Decisão sobre a mensagem que chegou ─────────────

export type AcaoCheckin =
  | { acao: 'ignorar' }
  | { acao: 'parar' }
  | { acao: 'voltar' }
  | { acao: 'gravar'; semana: string; valores: ValoresCheckin }
  | { acao: 'ajuda'; motivo: MotivoRecusa; detalhe: string };

export interface EntradaDecisao {
  texto: string | null | undefined;
  /** Tipo gravado na inbox: 'texto', 'imagem', 'audio'... */
  tipo: string;
  fromMe: boolean;
  temPaciente: boolean;
  /** Pedido que ainda vale (não expirou) e a semana a que a resposta pertence. */
  pedidoAberto: { semana: string } | null;
  recebeuPedidoRecente: boolean;
  whatsappDesligado: boolean;
}

const IGNORAR: AcaoCheckin = { acao: 'ignorar' };

/** Barato e sem consulta: evita ir ao banco a cada conversa normal. */
export function podeSerDoCheckin(texto: string | null | undefined): boolean {
  if (typeof texto !== 'string' || !texto.trim()) return false;
  return reconheceParar(texto) || reconheceVoltar(texto) || pareceTentativaDeCheckin(texto);
}

/**
 * Tudo o que não for resposta ao check-in volta como 'ignorar', e o bot de IA responde normalmente:
 * conversa comum, nota de NPS de um número só, número solto, mídia, mensagem do próprio número da clínica.
 */
export function decidirAcaoDaMensagem(e: EntradaDecisao): AcaoCheckin {
  if (e.fromMe || !e.temPaciente || e.tipo !== 'texto') return IGNORAR;
  const texto = typeof e.texto === 'string' ? e.texto : '';
  if (!texto.trim()) return IGNORAR;

  if (reconheceParar(texto)) return e.recebeuPedidoRecente ? { acao: 'parar' } : IGNORAR;
  if (reconheceVoltar(texto)) return e.whatsappDesligado ? { acao: 'voltar' } : IGNORAR;

  if (!e.pedidoAberto || !pareceTentativaDeCheckin(texto)) return IGNORAR;

  const leitura = interpretarRespostaCheckin(texto);
  if (leitura.ok) {
    const certa = leitura as Extract<ResultadoLeitura, { ok: true }>;
    return { acao: 'gravar', semana: e.pedidoAberto.semana, valores: certa.valores };
  }
  const recusa = leitura as Extract<ResultadoLeitura, { ok: false }>;
  return { acao: 'ajuda', motivo: recusa.motivo, detalhe: recusa.detalhe };
}

export function montarFalhaGravacao(): string {
  return 'Não consegui registrar agora, tente de novo em instantes.';
}

// ───────────── Envio de domingo à noite ─────────────

export interface CandidatoCheckin {
  ativo: boolean | null | undefined;
  telefone: string | null | undefined;
  /** checkin_preferencias.whatsapp_ativo; sem linha (null) conta como ligado. */
  whatsappAtivo?: boolean | null;
  /** Já tem pedido (ou envio registrado) nesta semana. */
  pedidoNaSemana: boolean;
  respondeuNaSemana: boolean;
  errosNaSemana?: number;
}

export function apenasDigitos(valor: string | null | undefined): string {
  return String(valor || '').replace(/\D/g, '');
}

/** DDD + número, com ou sem o 55. */
export function telefoneValidoParaEnvio(telefone: string | null | undefined): boolean {
  const n = apenasDigitos(telefone).length;
  return n >= 10 && n <= 14;
}

/** O cadastro guarda "(91) 98765-4321"; a Z-API quer o código do país. */
export function telefoneParaEnvio(telefone: string | null | undefined): string {
  const d = apenasDigitos(telefone);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

export function elegivelParaPedido(c: CandidatoCheckin): boolean {
  if (c.ativo !== true) return false;
  if (!telefoneValidoParaEnvio(c.telefone)) return false;
  if (c.whatsappAtivo === false) return false;
  if (c.pedidoNaSemana || c.respondeuNaSemana) return false;
  if ((c.errosNaSemana ?? 0) >= MAX_ERROS_POR_SEMANA) return false;
  return true;
}

export function filtrarElegiveis<T extends CandidatoCheckin>(candidatos: readonly T[]): T[] {
  return candidatos.filter(elegivelParaPedido);
}

/** Quem nunca falhou vem primeiro; o corte do lote é por profissional e por rodada. */
export function cortarLote<T extends CandidatoCheckin>(elegiveis: readonly T[], max: number = LIMITE_LOTE_POR_PROFISSIONAL): T[] {
  return [...elegiveis].sort((a, b) => (a.errosNaSemana ?? 0) - (b.errosNaSemana ?? 0)).slice(0, Math.max(0, max));
}

export function selecionarLote<T extends CandidatoCheckin>(candidatos: readonly T[], max: number = LIMITE_LOTE_POR_PROFISSIONAL): T[] {
  return cortarLote(filtrarElegiveis(candidatos), max);
}

/** Domingo, das 18h às 20h59 em Brasília (UTC−3 fixo). `forcar` serve para teste manual. */
export function dentroDaJanelaDeEnvio(agora: Date = new Date(), opcoes: { forcar?: boolean } = {}): boolean {
  if (opcoes.forcar === true) return true;
  const br = new Date(agora.getTime() - OFFSET_BR_MS);
  const hora = br.getUTCHours();
  return br.getUTCDay() === JANELA_ENVIO_BR.diaSemana && hora >= JANELA_ENVIO_BR.horaInicio && hora < JANELA_ENVIO_BR.horaFim;
}

export function deveInterromperLote(falhasSeguidas: number): boolean {
  return falhasSeguidas >= FALHAS_SEGUIDAS_PARA_PARAR;
}

export function pausaEntreEnvios(aleatorio: () => number = Math.random): number {
  const { min, max } = PAUSA_ENTRE_ENVIOS_MS;
  const r = Math.min(Math.max(aleatorio(), 0), 1);
  return Math.round(min + r * (max - min));
}

export function expiraEmDoPedido(agora: Date = new Date()): string {
  return new Date(agora.getTime() + VALIDADE_PEDIDO_HORAS * HORA_MS).toISOString();
}

export function inicioDaJanelaDeTreino(agora: Date = new Date()): string {
  return new Date(agora.getTime() - DIAS_JANELA_TREINO * DIA_MS).toISOString();
}

export function limiteDoPedidoRecente(agora: Date = new Date()): string {
  return new Date(agora.getTime() - DIAS_PEDIDO_RECENTE * DIA_MS).toISOString();
}

/** Segunda-feira 00:00 de Brasília da semana (AAAA-MM-DD) como instante UTC, para filtrar created_at. */
export function instanteDoInicioDaSemana(semana: string): string {
  return new Date(`${semana}T00:00:00-03:00`).toISOString();
}

/** Listas grandes de ids estouram o tamanho da URL do PostgREST: consulta em blocos. */
export function emBlocos<T>(itens: readonly T[], tamanho: number): T[][] {
  const t = Math.max(1, Math.floor(tamanho));
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += t) blocos.push(itens.slice(i, i + t));
  return blocos;
}

// ───────────── Link do MyID ─────────────

/**
 * O MyID continua sendo o primeiro passo: quem ainda não concluiu recebe o link na mensagem.
 * É o link pessoal do portal (o mesmo que a clínica envia pelo WhatsApp), que leva o cliente ao MyID;
 * sem token, cai no site, para o pedido do MyID nunca sumir da mensagem.
 */
export function linkMyIDDoCliente(portalToken: string | null | undefined): string {
  const token = (portalToken || '').trim();
  if (!token) return URL_BASE_APP;
  return `${URL_BASE_APP}/portaldocliente/${encodeURIComponent(token)}`;
}

export function linkMyIDSeFaltar(concluiuMyID: boolean, portalToken: string | null | undefined): string | null {
  if (concluiuMyID) return null;
  return linkMyIDDoCliente(portalToken);
}
