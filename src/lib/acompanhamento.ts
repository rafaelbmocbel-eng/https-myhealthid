// Acompanhamento do treino do plano de IA do cliente (tabela plano_ia_treino_feito).
// Lógica PURA — sem supabase nem React — para poder ser testada com vitest.
// Datas são 'YYYY-MM-DD' (dia civil do Brasil); a aritmética usa UTC de propósito
// para que o fuso do navegador não desloque o dia nem a semana.

// Limites de dor (0-10) que o app já usa na escala de dor do treino: vermelho acima
// de 6 e âmbar acima de 3 (src/pages/paciente/PacienteExercicios.tsx). Mesmo valor
// citado como "padrão do app" no plano gerado (_shared/governanca-plano.ts). Não
// são critérios clínicos novos nem diagnóstico.
export const LIMIAR_DOR_PADRAO_APP = 6;
export const LIMIAR_DOR_ATENCAO_APP = 3;

export const SEMANAS_JANELA_PADRAO = 4;
export const OBSERVACAO_MAX_CARACTERES = 300;

export interface RegistroTreinoFeito {
  sessao_key: string;
  data: string;
  rpe?: number | null;
  dor?: number | null;
  observacao?: string | null;
}

export type FaixaDor = 'baixa' | 'atencao' | 'alta';

export interface ResumoSemana {
  /** Segunda-feira da semana, 'YYYY-MM-DD'. */
  inicio: string;
  /** Domingo da semana, 'YYYY-MM-DD'. */
  fim: string;
  treinos: number;
  /** Treinos em que o cliente informou esforço ou dor. */
  comRegistro: number;
  rpeMedio: number | null;
  dorMedia: number | null;
  dorMaxima: number | null;
  treinosDorAlta: number;
}

export interface AlertaDor {
  data: string;
  sessao_key: string;
  dor: number;
  observacao: string | null;
}

const DIA_MS = 86_400_000;

function paraUTC(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(t)) return null;
  // Date.UTC "rola" datas impossíveis (31/02); o round-trip descarta essas.
  if (new Date(t).toISOString().slice(0, 10) !== `${m[1]}-${m[2]}-${m[3]}`) return null;
  return t;
}

function deUTC(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

/** Segunda-feira da semana de `iso` (mesma convenção do progresso semanal do app). */
export function inicioDaSemana(iso: string): string | null {
  const t = paraUTC(iso);
  if (t === null) return null;
  const diasDesdeSegunda = (new Date(t).getUTCDay() + 6) % 7;
  return deUTC(t - diasDesdeSegunda * DIA_MS);
}

function somarDias(iso: string, dias: number): string | null {
  const t = paraUTC(iso);
  if (t === null) return null;
  return deUTC(t + dias * DIA_MS);
}

/** Primeiro dia da janela: segunda-feira da semana de `hoje` menos (semanas - 1) semanas. */
export function inicioDaJanela(hoje: string, semanas: number = SEMANAS_JANELA_PADRAO): string | null {
  const seg = inicioDaSemana(hoje);
  if (!seg) return null;
  return somarDias(seg, -7 * (Math.max(1, Math.floor(semanas)) - 1));
}

/** Aceita número ou texto numérico; devolve inteiro de 0 a 10, ou null (não informado/inválido). */
export function escala0a10(v: unknown): number | null {
  if (typeof v !== 'number' && typeof v !== 'string') return null;
  if (typeof v === 'string' && v.trim() === '') return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  return r >= 0 && r <= 10 ? r : null;
}

export function faixaDor(dor: number | null | undefined): FaixaDor | null {
  const d = escala0a10(dor);
  if (d === null) return null;
  if (d > LIMIAR_DOR_PADRAO_APP) return 'alta';
  if (d > LIMIAR_DOR_ATENCAO_APP) return 'atencao';
  return 'baixa';
}

export function dorAcimaDoLimite(dor: number | null | undefined): boolean {
  return faixaDor(dor) === 'alta';
}

/** Orientação mostrada ao cliente ao informar a dor; null quando não há o que dizer. */
export function orientacaoDor(dor: number | null | undefined): string | null {
  const d = escala0a10(dor);
  if (d === null || d === 0) return null;
  if (dorAcimaDoLimite(d)) {
    return `Essa dor passou do limite de alerta do app (${LIMIAR_DOR_PADRAO_APP}/10). Procure o seu profissional antes de repetir esse treino.`;
  }
  return 'Se a dor continuar depois do treino, procure o seu profissional.';
}

export interface EntradaComoFoi {
  rpe: number | null;
  dor: number | null;
  observacao?: string | null;
}

export interface RegistroComoFoi {
  rpe?: number;
  dor?: number;
  observacao?: string;
}

/**
 * Monta só os campos que o cliente de fato informou. Campos ausentes NÃO entram
 * no objeto: no upsert (onConflict paciente_id,sessao_key,data) uma chave com null
 * sobrescreveria um valor já gravado. Devolve null quando não há nada a salvar.
 */
export function montarRegistroComoFoi(entrada: EntradaComoFoi): RegistroComoFoi | null {
  const registro: RegistroComoFoi = {};
  const rpe = escala0a10(entrada.rpe);
  const dor = escala0a10(entrada.dor);
  if (rpe !== null) registro.rpe = rpe;
  if (dor !== null) registro.dor = dor;
  const obs = String(entrada.observacao ?? '').trim().slice(0, OBSERVACAO_MAX_CARACTERES);
  if (obs) registro.observacao = obs;
  return Object.keys(registro).length > 0 ? registro : null;
}

export function temRegistroEsforcoOuDor(r: Pick<RegistroTreinoFeito, 'rpe' | 'dor' | 'observacao'> | null | undefined): boolean {
  if (!r) return false;
  return escala0a10(r.rpe) !== null || escala0a10(r.dor) !== null || String(r.observacao ?? '').trim() !== '';
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const soma = valores.reduce((a, v) => a + v, 0);
  return Math.round((soma / valores.length) * 10) / 10;
}

function resumir(inicio: string, fim: string, registros: RegistroTreinoFeito[]): ResumoSemana {
  const rpes: number[] = [];
  const dores: number[] = [];
  let comRegistro = 0;
  let treinosDorAlta = 0;
  for (const r of registros) {
    const rpe = escala0a10(r.rpe);
    const dor = escala0a10(r.dor);
    if (rpe !== null) rpes.push(rpe);
    if (dor !== null) {
      dores.push(dor);
      if (dorAcimaDoLimite(dor)) treinosDorAlta += 1;
    }
    if (rpe !== null || dor !== null) comRegistro += 1;
  }
  return {
    inicio,
    fim,
    treinos: registros.length,
    comRegistro,
    rpeMedio: media(rpes),
    dorMedia: media(dores),
    dorMaxima: dores.length ? Math.max(...dores) : null,
    treinosDorAlta,
  };
}

function dentroDaJanela(registros: RegistroTreinoFeito[], hoje: string, semanas: number): RegistroTreinoFeito[] {
  const ini = inicioDaJanela(hoje, semanas);
  const fim = somarDias(inicioDaSemana(hoje) ?? '', 6);
  if (!ini || !fim) return [];
  return registros.filter((r) => {
    const d = String(r.data ?? '').slice(0, 10);
    return paraUTC(d) !== null && d >= ini && d <= fim;
  });
}

/**
 * Resumo por semana (segunda a domingo) das últimas `semanas` semanas, contando a
 * semana de `hoje`. Da mais recente para a mais antiga; semanas sem treino entram
 * zeradas para a ausência também aparecer.
 */
export function resumoSemanal(
  registros: RegistroTreinoFeito[],
  hoje: string,
  semanas: number = SEMANAS_JANELA_PADRAO,
): ResumoSemana[] {
  const segAtual = inicioDaSemana(hoje);
  if (!segAtual) return [];
  const n = Math.max(1, Math.floor(semanas));
  const naJanela = dentroDaJanela(registros, hoje, n);
  const resultado: ResumoSemana[] = [];
  for (let i = 0; i < n; i += 1) {
    const inicio = somarDias(segAtual, -7 * i);
    if (!inicio) continue;
    const fim = somarDias(inicio, 6) ?? inicio;
    const dessaSemana = naJanela.filter((r) => inicioDaSemana(String(r.data).slice(0, 10)) === inicio);
    resultado.push(resumir(inicio, fim, dessaSemana));
  }
  return resultado;
}

/** Totais de toda a janela (mesmo recorte de `resumoSemanal`). */
export function resumoJanela(
  registros: RegistroTreinoFeito[],
  hoje: string,
  semanas: number = SEMANAS_JANELA_PADRAO,
): ResumoSemana | null {
  const ini = inicioDaJanela(hoje, semanas);
  const segAtual = inicioDaSemana(hoje);
  const fim = segAtual ? somarDias(segAtual, 6) : null;
  if (!ini || !fim) return null;
  return resumir(ini, fim, dentroDaJanela(registros, hoje, semanas));
}

/** Treinos com dor acima do limite do app, do mais recente para o mais antigo. */
export function alertasDor(
  registros: RegistroTreinoFeito[],
  limiar: number = LIMIAR_DOR_PADRAO_APP,
): AlertaDor[] {
  const alertas: AlertaDor[] = [];
  for (const r of registros) {
    const dor = escala0a10(r.dor);
    if (dor === null || dor <= limiar) continue;
    const obs = String(r.observacao ?? '').trim();
    alertas.push({ data: String(r.data).slice(0, 10), sessao_key: r.sessao_key, dor, observacao: obs || null });
  }
  return alertas.sort((a, b) => (a.data === b.data ? b.dor - a.dor : a.data < b.data ? 1 : -1));
}

/** 'YYYY-MM-DD' -> 'dd/mm'. */
export function formatarDiaMes(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(iso ?? ''));
  return m ? `${m[2]}/${m[1]}` : '';
}

export function rotuloSemana(inicio: string): string {
  const fim = somarDias(inicio, 6);
  if (!fim) return '';
  return `${formatarDiaMes(inicio)} a ${formatarDiaMes(fim)}`;
}

/**
 * A sessao_key do app é `f<fase>s<sessão>:<nome em minúsculas, até 30 caracteres>`
 * (PlanoTreinoInterativo). Devolve um rótulo legível para o profissional.
 */
export function rotuloSessao(sessaoKey: string): string {
  const m = /^f(\d+)s(\d+):([\s\S]*)$/.exec(String(sessaoKey ?? ''));
  if (!m) return String(sessaoKey ?? '').trim() || 'Treino';
  const nome = m[3].trim();
  if (nome) return nome.charAt(0).toUpperCase() + nome.slice(1);
  return `Fase ${Number(m[1]) + 1} · Treino ${Number(m[2]) + 1}`;
}

/** 'Esforço 6/10 · Dor 2/10', só com o que foi informado; '' se nada. */
export function textoRegistro(r: Pick<RegistroTreinoFeito, 'rpe' | 'dor'> | null | undefined): string {
  if (!r) return '';
  const partes: string[] = [];
  const rpe = escala0a10(r.rpe);
  const dor = escala0a10(r.dor);
  if (rpe !== null) partes.push(`Esforço ${rpe}/10`);
  if (dor !== null) partes.push(`Dor ${dor}/10`);
  return partes.join(' · ');
}

/** Nota ou média com vírgula decimal ('4,5'); '—' quando não informada. */
export function formatarNota(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return String(n).replace('.', ',');
}
