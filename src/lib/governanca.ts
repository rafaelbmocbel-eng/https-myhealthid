// Governança dos planos (treino e alimentar): leitura segura do registro
// `_governanca` que acompanha o jsonb do plano, rótulos do selo, data de
// reavaliação e regras puras usadas pelos componentes de liberação/triagem.
//
// Tudo aqui é PURO (sem rede, sem React) para poder ser testado com vitest.
// O registro é ESCRITO só no servidor (edges de geração/revisão e triggers do
// banco); o front apenas lê. Por isso a leitura é defensiva: qualquer campo com
// formato inesperado vira null, nunca quebra a tela.
//
// ATENÇÃO: `_governanca` vindo de planos_ia_cliente é gravável pelo próprio
// paciente e NÃO prova aprovação de ninguém — use `semAprovacao` nesse caso.

export const GOVERNANCA_CHAVE = '_governanca';
/** `fonte.tipo` de um plano do profissional que nasceu do plano montado pelo cliente. */
export const FONTE_CLIENTE_BASE = 'cliente_base';
export const JUSTIFICATIVA_MIN_CARACTERES = 15;

export type NivelTriagem = 'liberado' | 'confirmar' | 'bloqueia';
export type NivelRisco = 'baixo' | 'medio' | 'alto';
export type SeveridadeFlag = 'alta' | 'media' | 'baixa';
export type StatusParametro = 'a_confirmar' | 'confirmado';
export type TipoPlanoGov = 'treino' | 'nutricao';

export interface MotivoTriagem {
  codigo: string;
  rotulo: string;
  detalhe: string;
  origem: string;
  nivel: 'confirmar' | 'bloqueia';
}

export interface ParametroGov {
  chave: string;
  rotulo: string | null;
  valor: string;
  fonte: string | null;
  status: StatusParametro;
}

export interface IndicadorGov {
  id: string;
  nome: string;
  como_medir: string;
  quando_agir: string;
}

export interface AcompanhamentoGov {
  reavaliar_em_semanas: number | null;
  indicadores: IndicadorGov[];
}

export interface FonteGov {
  tipo: string;
  modelo: string | null;
  funcao: string | null;
  prompt_versao: string | null;
  gerado_em: string | null;
  insumos: string[];
  parametros: ParametroGov[];
}

export interface OverrideTriagemGov {
  justificativa: string;
  ciente: boolean;
  em: string | null;
}

export interface TriagemGov {
  nivel: NivelTriagem;
  motivos: MotivoTriagem[];
  override: OverrideTriagemGov | null;
}

export interface FlagRevisaoGov {
  severidade: SeveridadeFlag;
  titulo: string;
  descricao: string;
  sugestao: string;
  onde: string;
}

export interface RevisaoSegurancaGov {
  risco_geral: NivelRisco;
  n_flags_altas: number;
  flags: FlagRevisaoGov[];
  resumo: string | null;
  revisado_em: string | null;
  hash: string | null;
}

export interface AprovacaoGov {
  por_user_id: string | null;
  por_nome: string | null;
  em: string | null;
  versao: number | null;
  justificativa: string | null;
  risco_geral: NivelRisco | null;
  sem_revisao: boolean;
}

export interface GovernancaLida {
  /** Versão do formato do registro (não é a versão do plano). */
  versao: number | null;
  versao_plano: number | null;
  fonte: FonteGov | null;
  triagem: TriagemGov | null;
  revisao_seguranca: RevisaoSegurancaGov | null;
  aprovacao: AprovacaoGov | null;
  acompanhamento: AcompanhamentoGov | null;
}

// ── Leitura defensiva ──────────────────────────────────────────────────────

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function numero(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function listaTextos(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim());
}

function risco(v: unknown): NivelRisco | null {
  return v === 'baixo' || v === 'medio' || v === 'alto' ? v : null;
}

function lerParametros(v: unknown): ParametroGov[] {
  if (!Array.isArray(v)) return [];
  const out: ParametroGov[] = [];
  for (const item of v) {
    const o = obj(item);
    const chave = texto(o?.chave);
    if (!o || !chave) continue;
    out.push({
      chave,
      rotulo: texto(o.rotulo),
      valor: typeof o.valor === 'string' ? o.valor : '',
      fonte: texto(o.fonte),
      // Qualquer valor que não seja exatamente "confirmado" conta como a confirmar.
      status: o.status === 'confirmado' ? 'confirmado' : 'a_confirmar',
    });
  }
  return out;
}

function lerFonte(v: unknown): FonteGov | null {
  const o = obj(v);
  if (!o) return null;
  return {
    tipo: texto(o.tipo) ?? 'ia',
    modelo: texto(o.modelo),
    funcao: texto(o.funcao),
    prompt_versao: texto(o.prompt_versao),
    gerado_em: texto(o.gerado_em),
    insumos: listaTextos(o.insumos),
    parametros: lerParametros(o.parametros),
  };
}

function lerMotivos(v: unknown): MotivoTriagem[] {
  if (!Array.isArray(v)) return [];
  const out: MotivoTriagem[] = [];
  for (const item of v) {
    const o = obj(item);
    const codigo = texto(o?.codigo);
    if (!o || !codigo) continue;
    out.push({
      codigo,
      rotulo: texto(o.rotulo) ?? codigo,
      detalhe: typeof o.detalhe === 'string' ? o.detalhe : '',
      origem: typeof o.origem === 'string' ? o.origem : '',
      nivel: o.nivel === 'bloqueia' ? 'bloqueia' : 'confirmar',
    });
  }
  return out;
}

function lerTriagem(v: unknown): TriagemGov | null {
  const o = obj(v);
  if (!o) return null;
  const nivel: NivelTriagem = o.nivel === 'bloqueia' || o.nivel === 'confirmar' ? o.nivel : 'liberado';
  const ov = obj(o.override);
  return {
    nivel,
    motivos: lerMotivos(o.motivos),
    override: ov
      ? { justificativa: typeof ov.justificativa === 'string' ? ov.justificativa : '', ciente: ov.ciente === true, em: texto(ov.em) }
      : null,
  };
}

function lerFlags(v: unknown): FlagRevisaoGov[] {
  if (!Array.isArray(v)) return [];
  const out: FlagRevisaoGov[] = [];
  for (const item of v) {
    const o = obj(item);
    if (!o) continue;
    const s = o.severidade;
    out.push({
      severidade: s === 'alta' || s === 'baixa' ? s : 'media',
      titulo: texto(o.titulo) ?? 'Ponto de atenção',
      descricao: typeof o.descricao === 'string' ? o.descricao : '',
      sugestao: typeof o.sugestao === 'string' ? o.sugestao : '',
      onde: typeof o.onde === 'string' ? o.onde : '',
    });
  }
  return out;
}

function lerRevisao(v: unknown): RevisaoSegurancaGov | null {
  const o = obj(v);
  const r = risco(o?.risco_geral);
  if (!o || !r) return null;
  const flags = lerFlags(o.flags);
  return {
    risco_geral: r,
    n_flags_altas: numero(o.n_flags_altas) ?? flags.filter((f) => f.severidade === 'alta').length,
    flags,
    resumo: texto(o.resumo),
    revisado_em: texto(o.revisado_em),
    hash: texto(o.hash),
  };
}

function lerAprovacao(v: unknown): AprovacaoGov | null {
  const o = obj(v);
  if (!o) return null;
  return {
    por_user_id: texto(o.por_user_id),
    por_nome: texto(o.por_nome),
    em: texto(o.em),
    versao: numero(o.versao),
    justificativa: texto(o.justificativa),
    risco_geral: risco(o.risco_geral),
    sem_revisao: o.sem_revisao === true,
  };
}

function lerIndicadores(v: unknown): IndicadorGov[] {
  if (!Array.isArray(v)) return [];
  const out: IndicadorGov[] = [];
  for (const item of v) {
    const o = obj(item);
    const nome = texto(o?.nome);
    if (!o || !nome) continue;
    out.push({
      id: texto(o.id) ?? nome,
      nome,
      como_medir: typeof o.como_medir === 'string' ? o.como_medir : '',
      quando_agir: typeof o.quando_agir === 'string' ? o.quando_agir : '',
    });
  }
  return out;
}

function lerAcompanhamentoBruto(v: unknown): AcompanhamentoGov | null {
  const o = obj(v);
  if (!o) return null;
  const semanas = numero(o.reavaliar_em_semanas);
  const indicadores = lerIndicadores(o.indicadores);
  if (semanas === null && indicadores.length === 0) return null;
  return { reavaliar_em_semanas: semanas !== null && semanas > 0 ? semanas : null, indicadores };
}

/** Lê `conteudo._governanca`. Devolve null para plano legado (sem o registro). */
export function lerGovernanca(conteudo: unknown): GovernancaLida | null {
  const g = obj(obj(conteudo)?.[GOVERNANCA_CHAVE]);
  if (!g) return null;
  return {
    versao: numero(g.versao),
    versao_plano: numero(g.versao_plano),
    fonte: lerFonte(g.fonte),
    triagem: lerTriagem(g.triagem),
    revisao_seguranca: lerRevisao(g.revisao_seguranca),
    aprovacao: lerAprovacao(g.aprovacao),
    acompanhamento: lerAcompanhamentoBruto(g.acompanhamento),
  };
}

/**
 * Plano de acompanhamento do plano: prefere `_governanca.acompanhamento` e cai
 * para `acompanhamento` na raiz (a geração grava nos dois lugares).
 */
export function lerAcompanhamento(conteudo: unknown): AcompanhamentoGov | null {
  const gov = lerGovernanca(conteudo);
  return gov?.acompanhamento ?? lerAcompanhamentoBruto(obj(conteudo)?.acompanhamento);
}

/** Conteúdo clínico sem o registro de governança (cópia rasa; não muta o original). */
export function removerGovernanca<T>(conteudo: T): T {
  const o = obj(conteudo);
  if (!o || !(GOVERNANCA_CHAVE in o)) return conteudo;
  const { [GOVERNANCA_CHAVE]: _ignorada, ...resto } = o;
  return resto as T;
}

/**
 * Descarta a aprovação lida de uma fonte que o paciente pode escrever
 * (planos_ia_cliente): ali `aprovacao` pode ter sido forjada.
 */
export function semAprovacao(gov: GovernancaLida | null): GovernancaLida | null {
  return gov ? { ...gov, aprovacao: null } : null;
}

// ── Datas (sempre no fuso de Brasília) ─────────────────────────────────────

const FORMATO_DATA_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function paraData(v: string | Date | null | undefined): Date | null {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 'dd/mm/aaaa' no fuso de Brasília, ou '' se a data for ausente/inválida. */
export function formatarDataBR(v: string | Date | null | undefined): string {
  const d = paraData(v);
  return d ? FORMATO_DATA_BR.format(d) : '';
}

const MS_DIA = 24 * 60 * 60 * 1000;

/**
 * Data em que o plano deve ser reavaliado: liberação + `reavaliar_em_semanas`.
 * Sem data de liberação (ou sem prazo no registro) devolve null — não inventa prazo.
 */
export function calcularDataReavaliacao(
  gov: GovernancaLida | null | undefined,
  aprovacaoEm?: string | Date | null,
  acompanhamento?: AcompanhamentoGov | null,
): Date | null {
  const semanas = (acompanhamento ?? gov?.acompanhamento)?.reavaliar_em_semanas ?? null;
  if (semanas === null || semanas <= 0) return null;
  const base = paraData(aprovacaoEm) ?? paraData(gov?.aprovacao?.em);
  if (!base) return null;
  return new Date(base.getTime() + semanas * 7 * MS_DIA);
}

/** Dias inteiros até a reavaliação (negativo = atrasada). */
export function diasAteReavaliacao(data: Date, agora: Date = new Date()): number {
  return Math.ceil((data.getTime() - agora.getTime()) / MS_DIA);
}

// ── Selo ───────────────────────────────────────────────────────────────────

export type EstadoSelo = 'liberado' | 'legado' | 'rascunho';

export function estadoSelo(gov: GovernancaLida | null | undefined, aprovado?: boolean): EstadoSelo {
  const liberado = aprovado ?? !!gov?.aprovacao;
  if (!liberado) return 'rascunho';
  return gov?.aprovacao ? 'liberado' : 'legado';
}

/**
 * Texto do selo de governança de um plano que veio de planos_treino /
 * planos_alimentares.
 *  - com registro de aprovação: 'Liberado por <nome> em dd/mm/aaaa · v<N> · Fonte: IA (<modelo>) + revisão profissional'
 *  - liberado sem registro de aprovação (legado): 'Liberado antes do registro de aprovação'
 *  - não liberado: 'Rascunho'
 * `aprovado` é a coluna do plano; se omitido, vale só o que o registro prova
 * (sem aprovação registrada = 'Rascunho').
 */
export function rotuloSelo(gov: GovernancaLida | null | undefined, aprovado?: boolean): string {
  const estado = estadoSelo(gov, aprovado);
  if (estado === 'rascunho') return 'Rascunho';
  const apr = gov?.aprovacao;
  if (estado === 'legado' || !apr) return 'Liberado antes do registro de aprovação';

  const data = formatarDataBR(apr.em);
  const partes = [`Liberado${apr.por_nome ? ` por ${apr.por_nome}` : ''}${data ? ` em ${data}` : ''}`];
  const versao = apr.versao ?? gov?.versao_plano ?? null;
  if (versao !== null) partes.push(`v${versao}`);
  const fonte = gov?.fonte;
  if (fonte && fonte.tipo === 'ia') {
    partes.push(`Fonte: IA${fonte.modelo ? ` (${fonte.modelo})` : ''} + revisão profissional`);
  } else if (fonte && fonte.tipo === FONTE_CLIENTE_BASE) {
    partes.push('Fonte: base montada pelo cliente com IA + revisão profissional');
  }
  return partes.join(' · ');
}

// ── Rodapé de documentos (TreinoDocumento e PDF) ──────────────────────────

export const AVISO_PADRAO_PLANO = 'Este plano não substitui o acompanhamento de um profissional de saúde.';

export interface RodapeGovernanca {
  /** Quem liberou, quando, versão e fonte; null quando não há nada a afirmar. */
  selo: string | null;
  reavaliacao: string | null;
  /** Aviso fixo: aparece sempre, haja ou não registro de governança. */
  aviso: string;
}

/**
 * Texto de governança para rodapé de documento. Só o plano do profissional
 * (planos_treino/planos_alimentares) pode afirmar liberação; o plano do cliente
 * (planos_ia_cliente) fica só com o aviso padrão.
 */
export function rodapeGovernanca(
  conteudo: unknown,
  opcoes: { origem: 'profissional' | 'cliente'; aprovado?: boolean },
): RodapeGovernanca {
  if (opcoes.origem !== 'profissional') return { selo: null, reavaliacao: null, aviso: AVISO_PADRAO_PLANO };

  const gov = lerGovernanca(conteudo);
  const estado = estadoSelo(gov, opcoes.aprovado);
  const selo = rotuloSelo(gov, opcoes.aprovado);

  let reavaliacao: string | null = null;
  const acompanhamento = lerAcompanhamento(conteudo);
  const semanas = acompanhamento?.reavaliar_em_semanas ?? null;
  if (estado === 'liberado' && semanas !== null) {
    const data = calcularDataReavaliacao(gov, null, acompanhamento);
    const unidade = semanas === 1 ? 'semana' : 'semanas';
    reavaliacao = data
      ? `Reavaliar em ${semanas} ${unidade} (até ${formatarDataBR(data)})`
      : `Reavaliar em ${semanas} ${unidade} após a liberação`;
  }
  return { selo, reavaliacao, aviso: AVISO_PADRAO_PLANO };
}

// ── Plano do cliente copiado como base do profissional ────────────────────

/**
 * Conteúdo de planos_ia_cliente (gravável pelo paciente) para virar rascunho do
 * profissional: descarta o `_governanca` e o `acompanhamento` que vieram junto —
 * o paciente pode tê-los forjado — e registra a origem como 'cliente_base'. A
 * triagem, a revisão e a aprovação do plano do profissional começam do zero.
 */
export function baseDoCliente(conteudo: unknown, agora: Date = new Date()): Record<string, unknown> {
  const o = obj(conteudo) ?? {};
  const { [GOVERNANCA_CHAVE]: _governanca, acompanhamento: _acompanhamento, ...resto } = o;
  return {
    ...resto,
    [GOVERNANCA_CHAVE]: {
      versao: 1,
      fonte: {
        tipo: FONTE_CLIENTE_BASE,
        origem: 'planos_ia_cliente',
        copiado_em: agora.toISOString(),
        insumos: [],
        parametros: [],
      },
    },
  };
}

// ── Aviso depois de editar um plano ────────────────────────────────────────

export interface AvisoEdicao {
  nivel: 'sucesso' | 'aviso';
  mensagem: string;
}

/**
 * Mensagem ao salvar a edição de um plano. O banco devolve um plano liberado
 * para rascunho quando o conteúdo muda; `aprovadoDepois` é o valor que voltou
 * do UPDATE (null/undefined = não se sabe).
 */
export function avisoAposEdicao(
  rotulo: string,
  eraLiberado: boolean,
  aprovadoDepois: boolean | null | undefined,
): AvisoEdicao {
  if (!eraLiberado) return { nivel: 'sucesso', mensagem: `${rotulo} atualizado` };
  if (aprovadoDepois === false) {
    return {
      nivel: 'aviso',
      mensagem: `${rotulo} editado: voltou para rascunho. Revise e libere de novo para o paciente voltar a vê-lo.`,
    };
  }
  if (aprovadoDepois === true) return { nivel: 'sucesso', mensagem: `${rotulo} atualizado (o conteúdo não mudou e continua liberado)` };
  return {
    nivel: 'aviso',
    mensagem: `${rotulo} salvo. Se o conteúdo mudou, ele voltou para rascunho: confira o selo e libere de novo.`,
  };
}

// ── Parâmetros ainda sem fonte confirmada ─────────────────────────────────

export function resumoParametros(gov: GovernancaLida | null | undefined): { total: number; confirmados: number; aConfirmar: number } {
  const lista = gov?.fonte?.parametros ?? [];
  const confirmados = lista.filter((p) => p.status === 'confirmado').length;
  return { total: lista.length, confirmados, aConfirmar: lista.length - confirmados };
}

/** True quando o plano usou parâmetros e NENHUM deles tem fonte confirmada. */
export function semParametrosConfirmados(gov: GovernancaLida | null | undefined): boolean {
  const r = resumoParametros(gov);
  return r.total > 0 && r.confirmados === 0;
}

// ── Revisão de segurança (resposta da edge revisar-plano-seguranca) ───────

export interface RevisaoNormalizada {
  resumo: string;
  risco_geral: NivelRisco;
  flags: FlagRevisaoGov[];
  persistida: boolean;
  motivoNaoPersistida: string | null;
  planoTruncado: boolean;
}

/** Risco que vale na tela: qualquer flag de severidade alta força 'alto', como no servidor. */
export function riscoEfetivo(r: { risco_geral?: unknown; flags?: { severidade?: unknown }[] | null }): NivelRisco {
  const flags = Array.isArray(r.flags) ? r.flags : [];
  if (flags.some((f) => f?.severidade === 'alta')) return 'alto';
  const informado = risco(r.risco_geral);
  if (informado) return informado;
  return flags.length > 0 ? 'medio' : 'baixo';
}

/** Interpreta a resposta da revisão. Devolve null se não houver nada aproveitável. */
export function normalizarRevisao(data: unknown): RevisaoNormalizada | null {
  const o = obj(data);
  if (!o) return null;
  const temFlags = Array.isArray(o.flags);
  const informado = risco(o.risco_geral);
  if (!temFlags && !informado) return null;
  const flags = lerFlags(o.flags);
  return {
    resumo: texto(o.resumo) ?? (flags.length > 0 ? 'Pontos de atenção encontrados.' : 'Nenhum ponto crítico encontrado.'),
    risco_geral: riscoEfetivo({ risco_geral: informado, flags }),
    flags,
    persistida: o.persistida === true,
    motivoNaoPersistida: texto(o.motivo_nao_persistida),
    planoTruncado: o.plano_truncado === true,
  };
}

export function justificativaValida(justificativa: string | null | undefined): boolean {
  return (justificativa ?? '').trim().length >= JUSTIFICATIVA_MIN_CARACTERES;
}

/** Erro devolvido pelo RPC liberar_plano, em linguagem para o profissional. */
export function mensagemErroLiberacao(erro: unknown): { mensagem: string; exigeJustificativa: boolean } {
  const bruta = typeof erro === 'string' ? erro : typeof (erro as { message?: unknown })?.message === 'string' ? (erro as { message: string }).message : '';
  const norm = bruta.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (norm.includes('justificativa obrigatoria')) {
    return { mensagem: 'Este plano tem risco alto: registre a sua justificativa para liberar.', exigeJustificativa: true };
  }
  if (norm.includes('could not find the function') || norm.includes('pgrst202') || norm.includes('schema cache')) {
    return { mensagem: 'Liberação indisponível: a atualização do banco de dados ainda está pendente. Tente de novo em alguns minutos.', exigeJustificativa: false };
  }
  if (norm.includes('row-level security') || norm.includes('permission denied')) {
    return { mensagem: 'Você não tem permissão para liberar este plano.', exigeJustificativa: false };
  }
  return { mensagem: bruta || 'Não foi possível liberar o plano agora. Tente de novo.', exigeJustificativa: false };
}

// ── Bloqueio de triagem (resposta das edges de geração) ───────────────────

export interface BloqueioTriagem {
  nivel: 'confirmar' | 'bloqueia';
  motivos: MotivoTriagem[];
  dadosAusentes: string[];
  pode_prosseguir_profissional: boolean;
  override_recusado?: 'justificativa_curta' | 'ciente_ausente';
}

export interface OverrideTriagem {
  justificativa: string;
  ciente: true;
}

/** Extrai o bloqueio de uma resposta `{ ok:false, bloqueio }`; null se não for um bloqueio. */
export function extrairBloqueio(data: unknown): BloqueioTriagem | null {
  const b = obj(obj(data)?.bloqueio);
  if (!b) return null;
  const nivel = b.nivel === 'bloqueia' || b.nivel === 'confirmar' ? b.nivel : null;
  if (!nivel) return null;
  const recusado = b.override_recusado === 'justificativa_curta' || b.override_recusado === 'ciente_ausente' ? b.override_recusado : undefined;
  return {
    nivel,
    motivos: lerMotivos(b.motivos),
    dadosAusentes: listaTextos(b.dadosAusentes),
    pode_prosseguir_profissional: b.pode_prosseguir_profissional === true,
    ...(recusado ? { override_recusado: recusado } : {}),
  };
}

export type ChamadorPlano = 'profissional' | 'cliente';

/**
 * Confere o que o profissional informou para sobrepor a triagem: 'bloqueia'
 * exige justificativa; 'confirmar' exige a confirmação de ciência. Cliente nunca sobrepõe.
 */
export function validarOverride(
  nivel: 'confirmar' | 'bloqueia',
  entrada: { justificativa?: string | null; ciente?: boolean },
  chamador: ChamadorPlano = 'profissional',
): { ok: true; override: OverrideTriagem } | { ok: false; erro: string } {
  if (chamador !== 'profissional') return { ok: false, erro: 'Só um profissional pode prosseguir. Fale com o seu profissional.' };
  const justificativa = (entrada.justificativa ?? '').trim();
  if (nivel === 'bloqueia' && !justificativaValida(justificativa)) {
    return { ok: false, erro: `Explique o motivo em pelo menos ${JUSTIFICATIVA_MIN_CARACTERES} caracteres.` };
  }
  if (!entrada.ciente) return { ok: false, erro: 'Confirme que está ciente dos pontos acima.' };
  return { ok: true, override: { justificativa, ciente: true } };
}

const ROTULOS_ORIGEM: Record<string, string> = {
  cadastro: 'Cadastro',
  idade_informada: 'Idade informada',
  historico_clinico: 'Histórico clínico',
  triagem_autodeclarada: 'Triagem respondida pelo cliente',
  parq: 'PAR-Q+',
  myid: 'MyID',
  texto_livre: 'Registros do paciente',
  dados_ausentes: 'Dado ausente',
};

/** Rótulo legível das origens de um motivo ('a, b' vem da edge). */
export function rotuloOrigemTriagem(origem: string): string {
  return origem
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => ROTULOS_ORIGEM[x] ?? x)
    .join(', ');
}

export function rotuloNivelTriagem(nivel: NivelTriagem): string {
  if (nivel === 'bloqueia') return 'Bloqueado';
  if (nivel === 'confirmar') return 'Requer confirmação';
  return 'Liberado';
}

// ── Triagem autodeclarada (nutricao_anamnese.respostas.triagem) ───────────

export type ValorResposta = 'sim' | 'nao' | 'nao_sei' | 'prefiro_nao_dizer';
export type ChaveTriagem =
  | 'gestante_lactante'
  | 'transtorno_alimentar'
  | 'doenca_renal'
  | 'diabetes_insulina'
  | 'cardio_pressao'
  | 'cirurgia_lesao_recente';

// Mesmas opções aceitas pela edge (RESPOSTAS_TRIAGEM em triagem-bloqueio.ts);
// um teste garante que as duas listas não se afastem.
export const OPCOES_TRIAGEM: Record<ChaveTriagem, readonly ValorResposta[]> = {
  gestante_lactante: ['sim', 'nao', 'nao_sei'],
  transtorno_alimentar: ['sim', 'nao', 'prefiro_nao_dizer'],
  doenca_renal: ['sim', 'nao', 'nao_sei'],
  diabetes_insulina: ['sim', 'nao', 'nao_sei'],
  cardio_pressao: ['sim', 'nao', 'nao_sei'],
  cirurgia_lesao_recente: ['sim', 'nao'],
};

export const CHAVES_TRIAGEM = Object.keys(OPCOES_TRIAGEM) as ChaveTriagem[];

export type RespostasTriagem = Partial<Record<ChaveTriagem, ValorResposta>>;

export interface TriagemAutodeclarada extends Record<ChaveTriagem, ValorResposta> {
  versao: 1;
  respondida_em: string;
}

export function triagemCompleta(r: RespostasTriagem): r is Record<ChaveTriagem, ValorResposta> {
  return CHAVES_TRIAGEM.every((k) => {
    const v = r[k];
    return v !== undefined && OPCOES_TRIAGEM[k].includes(v);
  });
}

export function contarRespondidas(r: RespostasTriagem): number {
  return CHAVES_TRIAGEM.filter((k) => {
    const v = r[k];
    return v !== undefined && OPCOES_TRIAGEM[k].includes(v);
  }).length;
}

/** Algo marcado como sim / não sei / prefiro não dizer: o plano pede atenção de um profissional. */
export function triagemPedeAtencao(r: RespostasTriagem): boolean {
  return CHAVES_TRIAGEM.some((k) => {
    const v = r[k];
    return v === 'sim' || v === 'nao_sei' || v === 'prefiro_nao_dizer';
  });
}

/** Lê a triagem já salva em `respostas.triagem`, ignorando valores fora das opções. */
export function lerTriagemSalva(respostas: unknown): { respostas: RespostasTriagem; respondidaEm: string | null } {
  const t = obj(obj(respostas)?.triagem);
  const out: RespostasTriagem = {};
  if (!t) return { respostas: out, respondidaEm: null };
  for (const k of CHAVES_TRIAGEM) {
    const v = t[k];
    if (typeof v === 'string' && (OPCOES_TRIAGEM[k] as readonly string[]).includes(v)) out[k] = v as ValorResposta;
  }
  return { respostas: out, respondidaEm: texto(t.respondida_em) };
}

export function montarTriagem(r: Record<ChaveTriagem, ValorResposta>, agora: Date = new Date()): TriagemAutodeclarada {
  return {
    versao: 1,
    respondida_em: agora.toISOString(),
    gestante_lactante: r.gestante_lactante,
    transtorno_alimentar: r.transtorno_alimentar,
    doenca_renal: r.doenca_renal,
    diabetes_insulina: r.diabetes_insulina,
    cardio_pressao: r.cardio_pressao,
    cirurgia_lesao_recente: r.cirurgia_lesao_recente,
  };
}

/** Grava `triagem` em `respostas` preservando todas as outras respostas da anamnese. */
export function mesclarTriagem(respostasAtuais: unknown, triagem: TriagemAutodeclarada): Record<string, unknown> {
  const base = obj(respostasAtuais) ?? {};
  return { ...base, triagem };
}
