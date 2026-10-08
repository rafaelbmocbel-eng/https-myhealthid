// Fila de chancela da equipe científica MyHealthID: planos de treino e de
// nutrição que o cliente PREMIUM gerou (a partir do MyID, dos formulários e do
// histórico clínico dele) e que só chegam ao cliente depois de chancelados.
//
// Tudo aqui é PURO (sem rede, sem React): leitura defensiva do que as RPCs
// devolvem, regras de validação da tela e textos. As chamadas ao banco ficam
// em `chancelaApi.ts`. A decisão que vale é sempre a do banco (RPCs
// `chancelar_plano_cliente` / `recusar_plano_cliente`); o front só guia.
import {
  JUSTIFICATIVA_MIN_CARACTERES, formatarDataBR, justificativaValida, lerGovernanca,
  type GovernancaLida, type NivelRisco, type TipoPlanoGov,
} from '@/lib/governanca';

export const ROTA_CHANCELA = '/chancela';

/** Chave do react-query da fila (`[CHAVE_FILA_CHANCELA, status]`). */
export const CHAVE_FILA_CHANCELA = 'fila-chancela';

/** Mensagem curta que o cliente vê quando o plano é recusado (ou chancelado com recado). */
export const NOTA_PUBLICA_MIN_CARACTERES = 10;
export const NOTA_PUBLICA_MAX_CARACTERES = 280;
export const NOTA_INTERNA_MAX_CARACTERES = 1000;

/** De quanto em quanto tempo o contador de pendentes é atualizado. */
export const INTERVALO_PENDENTES_MS = 60_000;

export type TipoChancela = TipoPlanoGov;
export type StatusFila = 'aguardando' | 'chancelado' | 'recusado';

export const ABAS_FILA: readonly { id: StatusFila; rotulo: string }[] = [
  { id: 'aguardando', rotulo: 'Aguardando' },
  { id: 'chancelado', rotulo: 'Chancelados' },
  { id: 'recusado', rotulo: 'Recusados' },
];

export const ROTULO_TIPO: Record<TipoChancela, string> = {
  treino: 'Treino',
  nutricao: 'Nutrição',
};

const ROTULO_TIPO_MINUSCULO: Record<TipoChancela, string> = {
  treino: 'treino',
  nutricao: 'nutrição',
};

const ROTULO_PERFIL: Record<string, string> = {
  educador_fisico: 'Educador Físico',
  fisioterapeuta: 'Fisioterapeuta',
  nutricionista: 'Nutricionista',
  medico: 'Médico(a)',
  psicologo: 'Psicólogo(a)',
  terapeuta_ocupacional: 'Terapeuta Ocupacional',
  dentista: 'Dentista',
  super_admin: 'Administrador(a)',
};

export function rotuloPerfil(perfil: string | null | undefined): string {
  if (!perfil) return '';
  return ROTULO_PERFIL[perfil] ?? perfil.replace(/_/g, ' ');
}

// ── Leitura defensiva da fila ──────────────────────────────────────────────

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

function nivelRisco(v: unknown): NivelRisco | null {
  return v === 'baixo' || v === 'medio' || v === 'alto' ? v : null;
}

export interface ResumoRevisaoFila {
  risco_geral: NivelRisco;
  n_flags_altas: number;
}

export interface ItemFilaChancela {
  id: string;
  tipo: TipoChancela;
  status: string;
  titulo: string | null;
  geradoEm: string | null;
  pacientePrimeiroNome: string;
  idade: number | null;
  objetivo: string | null;
  conteudo: Obj;
  revisao: ResumoRevisaoFila | null;
  hashAtual: string | null;
  // Opcionais: usados nas abas de histórico quando o banco devolve.
  revisorNome: string | null;
  revisorPerfil: string | null;
  revisadoEm: string | null;
  notaPublica: string | null;
  notaInterna: string | null;
}

export function lerItemFila(bruto: unknown): ItemFilaChancela | null {
  const o = obj(bruto);
  const id = texto(o?.id);
  if (!o || !id) return null;
  if (o.tipo !== 'treino' && o.tipo !== 'nutricao') return null;
  const rev = obj(o.revisao_seguranca);
  const risco = nivelRisco(rev?.risco_geral);
  return {
    id,
    tipo: o.tipo,
    status: texto(o.status) ?? 'aguardando',
    titulo: texto(o.titulo),
    geradoEm: texto(o.gerado_em),
    pacientePrimeiroNome: texto(o.paciente_primeiro_nome) ?? 'Cliente',
    idade: numero(o.idade),
    objetivo: texto(o.objetivo),
    conteudo: obj(o.conteudo) ?? {},
    revisao: rev && risco ? { risco_geral: risco, n_flags_altas: numero(rev.n_flags_altas) ?? 0 } : null,
    hashAtual: texto(o.hash_atual),
    revisorNome: texto(o.revisor_nome),
    revisorPerfil: texto(o.revisor_perfil),
    revisadoEm: texto(o.revisado_em),
    notaPublica: texto(o.nota_publica),
    notaInterna: texto(o.nota_interna),
  };
}

/** Interpreta a resposta de `fila_chancela`; itens malformados são descartados. */
export function lerFila(data: unknown): ItemFilaChancela[] {
  if (!Array.isArray(data)) return [];
  const out: ItemFilaChancela[] = [];
  for (const bruto of data) {
    const item = lerItemFila(bruto);
    if (item) out.push(item);
  }
  return out;
}

// ── Revisão de segurança do conteúdo atual ─────────────────────────────────

export type EstadoRevisao = 'valida' | 'desatualizada' | 'ausente';

export interface SituacaoRevisao {
  estado: EstadoRevisao;
  risco: NivelRisco | null;
  nFlagsAltas: number;
}

/**
 * A revisão só vale para o conteúdo que ela revisou: o hash gravado junto dela
 * precisa ser igual ao hash do conteúdo atual (`hash_atual`). Sem como provar
 * isso a revisão conta como desatualizada — nunca como válida.
 */
export function situacaoRevisao(item: Pick<ItemFilaChancela, 'conteudo' | 'revisao' | 'hashAtual'>): SituacaoRevisao {
  const gravada = lerGovernanca(item.conteudo)?.revisao_seguranca ?? null;
  if (!gravada && !item.revisao) return { estado: 'ausente', risco: null, nFlagsAltas: 0 };
  const risco = gravada?.risco_geral ?? item.revisao?.risco_geral ?? null;
  const nFlagsAltas = gravada?.n_flags_altas ?? item.revisao?.n_flags_altas ?? 0;
  const valida = !!item.hashAtual && !!gravada?.hash && gravada.hash === item.hashAtual;
  return { estado: valida ? 'valida' : 'desatualizada', risco, nFlagsAltas };
}

/**
 * Risco alto exige justificativa, tanto na revisão desta versão quanto numa revisão anterior que
 * o plano editado deixou para trás (editar não apaga o alerta); o banco também pode exigir.
 */
export function exigeJustificativa(revisao: SituacaoRevisao, exigidaPeloBanco = false): boolean {
  return exigidaPeloBanco || (revisao.estado !== 'ausente' && revisao.risco === 'alto');
}

export interface EntradaChancela {
  /** `usePodeChancelar(tipo).pode` */
  pode: boolean;
  revisao: SituacaoRevisao;
  justificativa: string;
  exigidaPeloBanco?: boolean;
  /** O revisor confirmou que chancela sem revisão de segurança válida desta versão. */
  cienteSemRevisao: boolean;
  notaPublica: string;
}

export type MotivoInvalido = 'sem_perfil' | 'justificativa' | 'ciencia' | 'nota_publica';
// `ok` true: sem motivo/erro. O projeto não usa strictNullChecks, então uma união
// discriminada não estreitaria `ok`; por isso os campos são opcionais.
export interface ResultadoValidacao { ok: boolean; motivo?: MotivoInvalido; erro?: string }

export function validarChancela(e: EntradaChancela): ResultadoValidacao {
  if (!e.pode) return { ok: false, motivo: 'sem_perfil', erro: 'Você não tem o perfil exigido para chancelar este plano.' };
  if (exigeJustificativa(e.revisao, e.exigidaPeloBanco) && !justificativaValida(e.justificativa)) {
    const antiga = e.revisao.estado === 'desatualizada' && e.revisao.risco === 'alto';
    return {
      ok: false,
      motivo: 'justificativa',
      erro: antiga
        ? `A última revisão apontou risco alto e o plano foi alterado depois dela: rode a revisão de novo ou registre a justificativa (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres).`
        : `A revisão apontou risco alto: registre a justificativa (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres).`,
    };
  }
  if (e.revisao.estado !== 'valida' && !e.cienteSemRevisao) {
    return { ok: false, motivo: 'ciencia', erro: 'Rode a revisão de segurança desta versão ou confirme que chancela sem ela.' };
  }
  const nota = e.notaPublica.trim();
  if (nota.length > NOTA_PUBLICA_MAX_CARACTERES) {
    return { ok: false, motivo: 'nota_publica', erro: `O recado ao cliente pode ter no máximo ${NOTA_PUBLICA_MAX_CARACTERES} caracteres.` };
  }
  return { ok: true };
}

export function validarRecusa(notaPublica: string, notaInterna = ''): { ok: boolean; erro?: string } {
  const nota = notaPublica.trim();
  if (nota.length < NOTA_PUBLICA_MIN_CARACTERES) {
    return { ok: false, erro: `Explique ao cliente, em pelo menos ${NOTA_PUBLICA_MIN_CARACTERES} caracteres, por que o plano não foi chancelado.` };
  }
  if (nota.length > NOTA_PUBLICA_MAX_CARACTERES) {
    return { ok: false, erro: `A mensagem ao cliente pode ter no máximo ${NOTA_PUBLICA_MAX_CARACTERES} caracteres.` };
  }
  if (notaInterna.trim().length > NOTA_INTERNA_MAX_CARACTERES) {
    return { ok: false, erro: `A nota interna pode ter no máximo ${NOTA_INTERNA_MAX_CARACTERES} caracteres.` };
  }
  return { ok: true };
}

/** Aviso exibido a quem não tem o perfil exigido para o tipo do plano. */
export function avisoSemPerfil(tipo: TipoChancela, labelExigido: string): string {
  return `Você não tem o perfil para chancelar ${ROTULO_TIPO_MINUSCULO[tipo]}. Só ${labelExigido} (ou a conta administradora) chancela este plano; você pode ler e recusar.`;
}

// ── Erros das RPCs ─────────────────────────────────────────────────────────

export function mensagemErroChancela(erro: unknown): { mensagem: string; exigeJustificativa: boolean } {
  const bruta = typeof erro === 'string' ? erro : typeof (erro as { message?: unknown })?.message === 'string' ? (erro as { message: string }).message : '';
  const norm = bruta.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (norm.includes('justificativa obrigatoria')) {
    return { mensagem: 'Este plano tem risco alto: registre a sua justificativa para chancelar.', exigeJustificativa: true };
  }
  if (norm.includes('could not find the function') || norm.includes('pgrst202') || norm.includes('schema cache')) {
    return { mensagem: 'Fila de chancela indisponível: a atualização do banco de dados ainda está pendente. Tente de novo em alguns minutos.', exigeJustificativa: false };
  }
  if (norm.includes('chancela_negada')) {
    return { mensagem: bruta.replace(/^.*chancela_negada:\s*/i, '').trim() || 'Chancela negada para o seu perfil.', exigeJustificativa: false };
  }
  if (norm.includes('row-level security') || norm.includes('permission denied') || norm.includes('not authorized')) {
    return { mensagem: 'Você não tem permissão para esta ação na fila de chancela.', exigeJustificativa: false };
  }
  return { mensagem: bruta || 'Não foi possível concluir agora. Tente de novo.', exigeJustificativa: false };
}

// ── Textos ─────────────────────────────────────────────────────────────────

export function descricaoPaciente(item: Pick<ItemFilaChancela, 'pacientePrimeiroNome' | 'idade'>): string {
  return item.idade !== null ? `${item.pacientePrimeiroNome}, ${item.idade} anos` : item.pacientePrimeiroNome;
}

export function tituloItem(item: Pick<ItemFilaChancela, 'titulo' | 'tipo'>): string {
  return item.titulo ?? (item.tipo === 'treino' ? 'Plano de treino' : 'Plano alimentar');
}

/** 'Chancelado por Ana, Nutricionista · dd/mm/aaaa · v2' (usa o registro do banco, nunca o do cliente). */
export function rotuloChancelado(item: Pick<ItemFilaChancela, 'conteudo' | 'revisorNome' | 'revisorPerfil' | 'revisadoEm'>): string {
  const apr = lerGovernanca(item.conteudo)?.aprovacao ?? null;
  const nome = item.revisorNome ?? apr?.por_nome ?? null;
  const perfil = item.revisorPerfil ?? porPerfilDaAprovacao(item.conteudo);
  const quando = formatarDataBR(item.revisadoEm ?? apr?.em ?? null);
  const quem = [nome, perfil ? rotuloPerfil(perfil) : null].filter(Boolean).join(', ');
  const partes = [quem ? `Chancelado por ${quem}` : 'Chancelado'];
  if (quando) partes.push(quando);
  if (apr?.versao != null) partes.push(`v${apr.versao}`);
  return partes.join(' · ');
}

// `por_perfil` não faz parte do que `lerGovernanca` expõe (formato do profissional).
function porPerfilDaAprovacao(conteudo: unknown): string | null {
  const gov = obj(obj(conteudo)?._governanca);
  return texto(obj(gov?.aprovacao)?.por_perfil);
}

// Os ids vêm de `insumosDosMotores` e das edges de geração (supabase/functions/_shared/motores-plano.ts).
const ROTULO_INSUMO: Record<string, string> = {
  MyID: 'MyID',
  myid: 'MyID',
  anamnese: 'Anamnese nutricional',
  avaliacao_presencial: 'Avaliação presencial',
  questionarios: 'Questionários clínicos',
  questionarios_clinicos: 'Questionários clínicos',
  historico_clinico: 'Histórico clínico',
  anamnese_nutricional: 'Anamnese nutricional',
  queixa_historia_atual: 'Queixa e história atual',
  triagem_autodeclarada: 'Triagem autodeclarada',
  antropometria: 'Antropometria',
  testes_funcionais: 'Testes funcionais',
  restricoes_informadas: 'Restrições informadas',
  biblioteca_exercicios: 'Biblioteca de exercícios',
  bioimpedancia: 'Bioimpedância',
  recordatorio_24h: 'Recordatório de 24 horas',
};

export function rotuloInsumo(id: string): string {
  const conhecido = ROTULO_INSUMO[id];
  if (conhecido) return conhecido;
  const limpo = id.replace(/_/g, ' ').trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : id;
}

export function insumosDoPlano(gov: GovernancaLida | null): string[] {
  return (gov?.fonte?.insumos ?? []).map(rotuloInsumo);
}

/** Pendentes: o mais antigo primeiro (quem espera há mais tempo). Histórico: o mais recente primeiro. */
export function ordenarFila(itens: ItemFilaChancela[], status: StatusFila): ItemFilaChancela[] {
  const instante = (i: ItemFilaChancela) => {
    const t = Date.parse((status === 'aguardando' ? i.geradoEm : i.revisadoEm ?? i.geradoEm) ?? '');
    return Number.isNaN(t) ? 0 : t;
  };
  const sinal = status === 'aguardando' ? 1 : -1;
  return [...itens].sort((a, b) => sinal * (instante(a) - instante(b)));
}
