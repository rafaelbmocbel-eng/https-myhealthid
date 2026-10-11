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

/** Chave do react-query da lista de profissionais da administração. */
export const CHAVE_PROFISSIONAIS_ADMIN = ['profissionais-admin'] as const;

/** Mensagem curta que o cliente vê quando o plano é recusado (ou chancelado com recado). */
export const NOTA_PUBLICA_MIN_CARACTERES = 10;
export const NOTA_PUBLICA_MAX_CARACTERES = 280;
export const NOTA_INTERNA_MAX_CARACTERES = 1000;

/** De quanto em quanto tempo o contador de pendentes é atualizado. */
export const INTERVALO_PENDENTES_MS = 60_000;

export type TipoChancela = TipoPlanoGov;
export type StatusFila = 'aguardando' | 'chancelado' | 'recusado' | 'cancelado' | 'substituido';

export const ABAS_FILA: readonly { id: StatusFila; rotulo: string }[] = [
  { id: 'aguardando', rotulo: 'Aguardando' },
  { id: 'chancelado', rotulo: 'Chancelados' },
  { id: 'recusado', rotulo: 'Recusados' },
  { id: 'cancelado', rotulo: 'Cancelados' },
  { id: 'substituido', rotulo: 'Substituídos' },
];

export const ROTULO_STATUS_FILA: Record<StatusFila, string> = {
  aguardando: 'Aguardando chancela',
  chancelado: 'Chancelado',
  recusado: 'Recusado',
  cancelado: 'Cancelado pelo cliente',
  substituido: 'Substituído',
};

export const AVISO_STATUS_FILA: Partial<Record<StatusFila, string>> = {
  cancelado: 'O cliente cancelou este pedido antes de a equipe decidir.',
  substituido: 'Este plano deixou de valer: foi trocado por um plano mais novo do mesmo cliente.',
};

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
  /** A IA leu só o início do plano (plano longo): a revisão é parcial. */
  planoTruncado: boolean;
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
  /** Dias úteis (seg-sex, sem feriados) desde que o plano entrou na fila; null se o banco não informou. */
  diasUteisNaFila: number | null;
  /** O plano passou do prazo de chancela (decidido pelo banco). */
  atrasado: boolean;
  /** O banco diz se o usuário atual tem área, perfil e verificação para este item; null = não informou. */
  podeChancelar: boolean | null;
  motivoNaoPode: string | null;
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
    revisao: rev && risco ? { risco_geral: risco, n_flags_altas: numero(rev.n_flags_altas) ?? 0, planoTruncado: rev.plano_truncado === true } : null,
    hashAtual: texto(o.hash_atual),
    diasUteisNaFila: numero(o.dias_uteis_na_fila),
    atrasado: o.atrasado === true,
    podeChancelar: typeof o.pode_chancelar === 'boolean' ? o.pode_chancelar : null,
    motivoNaoPode: texto(o.motivo_nao_pode),
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
  /** Revisão desta versão, mas parcial (plano longo demais para a IA ler inteiro): não vale como completa. */
  parcial?: boolean;
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
  const parcial = gravada?.plano_truncado === true || item.revisao?.planoTruncado === true;
  return { estado: valida ? 'valida' : 'desatualizada', risco, nFlagsAltas, ...(valida && parcial ? { parcial: true } : {}) };
}

/**
 * Quando a chancela exige justificativa escrita: risco alto na revisão desta versão, ou SEM revisão
 * válida desta versão (IA fora do ar: o motivo vira `motivo_sem_revisao` no carimbo), ou quando a revisão
 * foi PARCIAL (plano longo: a IA leu só o início), ou quando o banco já pediu. Só uma revisão válida e
 * completa de risco baixo/médio chancela sem justificativa.
 */
export function exigeJustificativa(revisao: SituacaoRevisao, exigidaPeloBanco = false): boolean {
  return exigidaPeloBanco || revisao.estado !== 'valida' || revisao.risco === 'alto' || revisao.parcial === true;
}

export interface EntradaChancela {
  /** O revisor tem área, perfil e verificação para este item (banco; o hook de perfil é o plano B). */
  pode: boolean;
  /**
   * Revisão de segurança DESTA versão. A janela de chancela a executa ao abrir; só conta como
   * `valida` se foi gravada no plano (o banco confere o hash). Falha da IA = `ausente`.
   */
  revisao: SituacaoRevisao;
  /** A revisão automática ainda está rodando. */
  revisando?: boolean;
  justificativa: string;
  exigidaPeloBanco?: boolean;
  notaPublica: string;
}

export type MotivoInvalido = 'sem_perfil' | 'revisando' | 'justificativa' | 'sem_revisao' | 'revisao_parcial' | 'nota_publica';
// `ok` true: sem motivo/erro. O projeto não usa strictNullChecks, então uma união
// discriminada não estreitaria `ok`; por isso os campos são opcionais.
export interface ResultadoValidacao { ok: boolean; motivo?: MotivoInvalido; erro?: string }

export function validarChancela(e: EntradaChancela): ResultadoValidacao {
  if (!e.pode) return { ok: false, motivo: 'sem_perfil', erro: 'Você não tem o perfil exigido para chancelar este plano.' };
  if (e.revisando) return { ok: false, motivo: 'revisando', erro: 'Aguarde a revisão de segurança terminar.' };
  if (exigeJustificativa(e.revisao, e.exigidaPeloBanco) && !justificativaValida(e.justificativa)) {
    if (e.revisao.estado !== 'valida') {
      return {
        ok: false,
        motivo: 'sem_revisao',
        erro: `Sem a revisão de segurança desta versão, só dá para chancelar com o motivo escrito (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres).`,
      };
    }
    if (e.revisao.parcial) {
      return {
        ok: false,
        motivo: 'revisao_parcial',
        erro: `A revisão de segurança foi parcial (o plano é longo e a IA avaliou só o início): confira o restante e registre a justificativa (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres).`,
      };
    }
    return {
      ok: false,
      motivo: 'justificativa',
      erro: e.revisao.risco === 'alto'
        ? `A revisão apontou risco alto: registre a justificativa (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres).`
        : `Registre a justificativa (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres).`,
    };
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

/** Códigos (HINT) que as RPCs de chancela levantam; a tela traduz cada um em uma orientação. */
export type CodigoErroChancela =
  | 'revisao_obrigatoria' | 'justificativa_obrigatoria' | 'sem_permissao_area'
  | 'nao_verificado' | 'nutricao_desligada' | 'conflito_interesse';

const CODIGOS_ERRO_CHANCELA: readonly CodigoErroChancela[] = [
  'revisao_obrigatoria', 'justificativa_obrigatoria', 'sem_permissao_area',
  'nao_verificado', 'nutricao_desligada', 'conflito_interesse',
];

const MENSAGEM_ERRO_CHANCELA: Record<CodigoErroChancela, string> = {
  revisao_obrigatoria:
    `Este plano precisa da revisão de segurança desta versão. Rode a revisão de novo; se a IA estiver fora do ar, registre o motivo (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres) para chancelar sem ela.`,
  justificativa_obrigatoria:
    `A justificativa é obrigatória para chancelar este plano (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres).`,
  sem_permissao_area:
    'Você não tem permissão para chancelar planos desta área. O administrador define as áreas de cada membro da equipe (treino e/ou nutrição), e o seu perfil profissional precisa ser o da área.',
  nao_verificado:
    'O seu perfil profissional ainda não foi verificado pela equipe MyHealthID. Informe o seu registro em Configurações e aguarde a verificação.',
  nutricao_desligada:
    'O plano nutricional Premium está desligado no momento, então nenhuma chancela de nutrição chega ao cliente. O administrador liga na aba Administração.',
  conflito_interesse:
    'Você não pode chancelar nem recusar o plano gerado para a sua própria conta: outro membro verificado da equipe científica precisa revisá-lo.',
};

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function textoDoErro(erro: unknown): string {
  if (typeof erro === 'string') return erro;
  const msg = (erro as { message?: unknown } | null | undefined)?.message;
  return typeof msg === 'string' ? msg : '';
}

/** O HINT da exceção do banco (PostgREST devolve em `hint`); aceita o código também dentro da mensagem. */
export function codigoErroChancela(erro: unknown): CodigoErroChancela | null {
  const hint = (erro as { hint?: unknown } | null | undefined)?.hint;
  const candidatos = [typeof hint === 'string' ? hint : '', textoDoErro(erro)].map((t) => t.toLowerCase());
  for (const texto of candidatos) {
    const achado = CODIGOS_ERRO_CHANCELA.find((c) => texto.includes(c));
    if (achado) return achado;
  }
  return null;
}

export interface ErroChancelaLido {
  mensagem: string;
  /** O banco exigiu a justificativa: a tela passa a pedi-la. */
  exigeJustificativa: boolean;
  /** O banco não achou revisão de segurança válida para esta versão: a tela refaz a revisão. */
  exigeRevisao: boolean;
  codigo: CodigoErroChancela | null;
}

const MENSAGEM_REVISAO_PARCIAL =
  `A revisão de segurança foi parcial: o plano é longo e a IA avaliou só o início. Confira o restante e registre a justificativa (mínimo de ${JUSTIFICATIVA_MIN_CARACTERES} caracteres).`;

function funcaoAusente(norm: string): boolean {
  return norm.includes('could not find the function') || norm.includes('pgrst202') || norm.includes('schema cache');
}

export function mensagemErroChancela(erro: unknown): ErroChancelaLido {
  const bruta = textoDoErro(erro);
  const norm = semAcento(bruta);
  const codigo = codigoErroChancela(erro);
  const base = { exigeJustificativa: false, exigeRevisao: false, codigo };
  if (codigo === 'revisao_obrigatoria' && norm.includes('parcial')) {
    return { ...base, mensagem: MENSAGEM_REVISAO_PARCIAL, exigeJustificativa: true };
  }
  if (codigo) {
    return {
      ...base,
      mensagem: MENSAGEM_ERRO_CHANCELA[codigo],
      exigeJustificativa: codigo === 'justificativa_obrigatoria',
      exigeRevisao: codigo === 'revisao_obrigatoria',
    };
  }
  if (norm.includes('justificativa obrigatoria')) {
    return { ...base, mensagem: MENSAGEM_ERRO_CHANCELA.justificativa_obrigatoria, exigeJustificativa: true, codigo: 'justificativa_obrigatoria' };
  }
  if (funcaoAusente(norm)) {
    return { ...base, mensagem: 'Fila de chancela indisponível: a atualização do banco de dados ainda está pendente. Tente de novo em alguns minutos.' };
  }
  if (norm.includes('chancela_negada')) {
    return { ...base, mensagem: bruta.replace(/^.*chancela_negada:\s*/i, '').trim() || 'Chancela negada para o seu perfil.' };
  }
  if (norm.includes('row-level security') || norm.includes('permission denied') || norm.includes('not authorized')) {
    return { ...base, mensagem: 'Você não tem permissão para esta ação na fila de chancela.' };
  }
  return { ...base, mensagem: bruta || 'Não foi possível concluir agora. Tente de novo.' };
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
  const carimbo = obj(obj(obj(item.conteudo)?._governanca)?.aprovacao);
  if (carimbo?.autochancela === true) partes.push('autochancela');
  if (apr?.sem_revisao) partes.push('sem revisão de segurança');
  if (carimbo?.revisao_parcial === true) partes.push('revisão de segurança parcial');
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

/**
 * Pendentes: os ATRASADOS primeiro e, dentro de cada grupo, o mais antigo (quem espera há mais tempo).
 * Histórico: o mais recente primeiro.
 */
export function ordenarFila(itens: ItemFilaChancela[], status: StatusFila): ItemFilaChancela[] {
  const instante = (i: ItemFilaChancela) => {
    const t = Date.parse((status === 'aguardando' ? i.geradoEm : i.revisadoEm ?? i.geradoEm) ?? '');
    return Number.isNaN(t) ? 0 : t;
  };
  const sinal = status === 'aguardando' ? 1 : -1;
  return [...itens].sort((a, b) => {
    if (status === 'aguardando' && a.atrasado !== b.atrasado) return a.atrasado ? -1 : 1;
    return sinal * (instante(a) - instante(b));
  });
}

/** 'chegou hoje', '1 dia útil na fila', '3 dias úteis na fila'; null quando o banco não informou. */
export function rotuloDiasUteisNaFila(dias: number | null | undefined): string | null {
  if (dias === null || dias === undefined || !Number.isFinite(dias) || dias < 0) return null;
  if (dias === 0) return 'chegou hoje';
  return dias === 1 ? '1 dia útil na fila' : `${dias} dias úteis na fila`;
}

/** O banco é quem sabe área, perfil e verificação do revisor; o hook de perfil só cobre fila antiga. */
export function podeChancelarItem(item: Pick<ItemFilaChancela, 'podeChancelar'>, podePeloPerfil: boolean): boolean {
  return item.podeChancelar ?? podePeloPerfil;
}

/** Aviso completo (tela do plano) de por que o usuário não chancela este item. */
export function avisoNaoPodeChancelar(item: Pick<ItemFilaChancela, 'tipo' | 'motivoNaoPode'>, labelExigido: string): string {
  return item.motivoNaoPode ? `Você não pode chancelar este plano: ${item.motivoNaoPode}` : avisoSemPerfil(item.tipo, labelExigido);
}

/** O motivo em poucas palavras (linha da fila): o do banco, ou o perfil. */
export function motivoCurtoNaoPode(item: Pick<ItemFilaChancela, 'tipo' | 'motivoNaoPode'>): string {
  return item.motivoNaoPode ?? `o seu perfil não habilita ${ROTULO_TIPO_MINUSCULO[item.tipo]}`;
}

// ── Administração (só o super-admin) ───────────────────────────────────────

export type AreaEquipe = 'treino' | 'nutricao';

export const AREAS_EQUIPE: readonly { id: AreaEquipe; rotulo: string; exige: string }[] = [
  { id: 'treino', rotulo: 'Treino', exige: 'Educador Físico ou Fisioterapeuta' },
  { id: 'nutricao', rotulo: 'Nutrição', exige: 'Nutricionista' },
];

const PERFIS_DA_AREA: Record<AreaEquipe, readonly string[]> = {
  treino: ['educador_fisico', 'fisioterapeuta'],
  nutricao: ['nutricionista'],
};

/** O perfil profissional habilita a área (mesma regra do banco: `plano_cliente_perfil_ok`). */
export function perfilHabilitaArea(area: AreaEquipe, perfil: string | null | undefined): boolean {
  return !!perfil && PERFIS_DA_AREA[area].includes(perfil);
}

/** Áreas que o perfil já habilita: ponto de partida ao incluir alguém na equipe. */
export function areasDoPerfil(perfil: string | null | undefined): AreaEquipe[] {
  return AREAS_EQUIPE.filter((a) => perfilHabilitaArea(a.id, perfil)).map((a) => a.id);
}

export interface ProfissionalAdmin {
  userId: string;
  nome: string;
  email: string | null;
  perfil: string | null;
  registro: string | null;
  verificado: boolean;
  verificadoEm: string | null;
  equipeCientifica: boolean;
  equipeAreas: AreaEquipe[];
  criadoEm: string | null;
}

function areasLidas(v: unknown): AreaEquipe[] {
  if (!Array.isArray(v)) return [];
  return AREAS_EQUIPE.map((a) => a.id).filter((id) => v.includes(id));
}

export function lerProfissionalAdmin(bruto: unknown): ProfissionalAdmin | null {
  const o = obj(bruto);
  const userId = texto(o?.user_id);
  if (!o || !userId) return null;
  const email = texto(o.email);
  const nome = [texto(o.nome), texto(o.sobrenome)].filter(Boolean).join(' ');
  return {
    userId,
    nome: nome || email || 'Sem nome',
    email,
    perfil: texto(o.perfil_profissional),
    registro: texto(o.registro_profissional),
    verificado: o.verificado === true,
    verificadoEm: texto(o.verificado_em),
    equipeCientifica: o.equipe_cientifica === true,
    equipeAreas: areasLidas(o.equipe_areas),
    criadoEm: texto(o.created_at),
  };
}

/** Interpreta `profissionais_admin`; linhas sem user_id são descartadas. */
export function lerProfissionaisAdmin(data: unknown): ProfissionalAdmin[] {
  if (!Array.isArray(data)) return [];
  const out: ProfissionalAdmin[] = [];
  for (const bruto of data) {
    const p = lerProfissionalAdmin(bruto);
    if (p) out.push(p);
  }
  return out;
}

/** Quem espera uma decisão do administrador (registro informado, ainda sem verificação) vem primeiro. */
export function ordenarProfissionaisAdmin(lista: ProfissionalAdmin[]): ProfissionalAdmin[] {
  const grupo = (p: ProfissionalAdmin) => {
    if (!p.verificado && p.registro) return 0;
    if (p.verificado) return 1;
    return 2;
  };
  return [...lista].sort((a, b) => grupo(a) - grupo(b) || a.nome.localeCompare(b.nome, 'pt-BR'));
}

export type FiltroProfissionais = 'todos' | 'pendentes' | 'verificados' | 'equipe';

export const FILTROS_PROFISSIONAIS: readonly { id: FiltroProfissionais; rotulo: string }[] = [
  { id: 'pendentes', rotulo: 'Aguardando verificação' },
  { id: 'verificados', rotulo: 'Verificados' },
  { id: 'equipe', rotulo: 'Equipe científica' },
  { id: 'todos', rotulo: 'Todos' },
];

function passaFiltro(p: ProfissionalAdmin, filtro: FiltroProfissionais): boolean {
  if (filtro === 'pendentes') return !p.verificado && !!p.registro;
  if (filtro === 'verificados') return p.verificado;
  if (filtro === 'equipe') return p.equipeCientifica;
  return true;
}

export function filtrarProfissionaisAdmin(lista: ProfissionalAdmin[], filtro: FiltroProfissionais, busca = ''): ProfissionalAdmin[] {
  const termo = semAcento(busca.trim());
  return ordenarProfissionaisAdmin(lista).filter((p) => {
    if (!passaFiltro(p, filtro)) return false;
    if (!termo) return true;
    return semAcento([p.nome, p.email ?? '', p.registro ?? '', p.perfil ? rotuloPerfil(p.perfil) : ''].join(' ')).includes(termo);
  });
}

export function contarProfissionaisAdmin(lista: ProfissionalAdmin[]): Record<FiltroProfissionais, number> {
  return {
    todos: lista.length,
    pendentes: lista.filter((p) => passaFiltro(p, 'pendentes')).length,
    verificados: lista.filter((p) => p.verificado).length,
    equipe: lista.filter((p) => p.equipeCientifica).length,
  };
}

/** Há alguém que chancele nutrição de verdade (equipe + verificado + área + perfil de nutricionista)? */
export function existeNutricionistaNaEquipe(lista: ProfissionalAdmin[]): boolean {
  return lista.some((p) => p.equipeCientifica && p.verificado && p.equipeAreas.includes('nutricao') && perfilHabilitaArea('nutricao', p.perfil));
}

// ── Registro no conselho e verificação do próprio profissional ─────────────

export const REGISTRO_MIN_CARACTERES = 3;
export const REGISTRO_MAX_CARACTERES = 40;

export function validarRegistroProfissional(entrada: string): { ok: boolean; valor?: string; erro?: string } {
  const valor = entrada.trim().replace(/\s+/g, ' ');
  if (valor.length < REGISTRO_MIN_CARACTERES) {
    return { ok: false, erro: `Informe o seu registro com pelo menos ${REGISTRO_MIN_CARACTERES} caracteres.` };
  }
  if (valor.length > REGISTRO_MAX_CARACTERES) {
    return { ok: false, erro: `O registro pode ter no máximo ${REGISTRO_MAX_CARACTERES} caracteres.` };
  }
  return { ok: true, valor };
}

export interface MinhaVerificacao {
  registro: string | null;
  verificado: boolean;
  verificadoEm: string | null;
  /** O CREFITO/registro que o profissional já tem no perfil (usado em prontuário e documentos): só sugestão. */
  registroDoPerfil: string | null;
}

export function lerMinhaVerificacao(bruto: unknown): MinhaVerificacao {
  const o = obj(bruto);
  return {
    registro: texto(o?.registro_profissional),
    verificado: o?.verificado === true,
    verificadoEm: texto(o?.verificado_em),
    registroDoPerfil: texto(o?.crefito),
  };
}

export type SituacaoVerificacao = 'verificado' | 'aguardando' | 'sem_registro';

export function situacaoVerificacao(v: MinhaVerificacao): SituacaoVerificacao {
  if (v.verificado) return 'verificado';
  return v.registro ? 'aguardando' : 'sem_registro';
}

export const ROTULO_SITUACAO_VERIFICACAO: Record<SituacaoVerificacao, string> = {
  verificado: 'Verificado pela equipe MyHealthID',
  aguardando: 'Aguardando verificação',
  sem_registro: 'Registro não informado',
};

// ── Configuração do plano do cliente (nutrição Premium e prazo da chancela) ─

export interface ConfigPlanoCliente {
  nutricao_premium_ativa: boolean;
  prazo_chancela_dias_uteis: number;
}

export const PRAZO_CHANCELA_MIN_DIAS = 1;
export const PRAZO_CHANCELA_MAX_DIAS = 10;

/** Padrão seguro quando a leitura falha: nutrição desligada e prazo de 2 dias úteis. */
export const CONFIG_PLANO_CLIENTE_PADRAO: ConfigPlanoCliente = {
  nutricao_premium_ativa: false,
  prazo_chancela_dias_uteis: 2,
};

function prazoValido(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= PRAZO_CHANCELA_MIN_DIAS && v <= PRAZO_CHANCELA_MAX_DIAS;
}

/** Só `true` liga a nutrição; qualquer valor estranho cai no padrão seguro. */
export function lerConfigPlanoCliente(data: unknown): ConfigPlanoCliente {
  const o = obj(data);
  const prazo = numero(o?.prazo_chancela_dias_uteis);
  return {
    nutricao_premium_ativa: o?.nutricao_premium_ativa === true,
    prazo_chancela_dias_uteis: prazoValido(prazo) ? prazo : CONFIG_PLANO_CLIENTE_PADRAO.prazo_chancela_dias_uteis,
  };
}

export function validarPrazoChancela(entrada: string | number): { ok: boolean; valor?: number; erro?: string } {
  const n = typeof entrada === 'number' ? entrada : entrada.trim() === '' ? Number.NaN : Number(entrada.replace(',', '.'));
  if (!prazoValido(n)) {
    return { ok: false, erro: `Informe um número inteiro de ${PRAZO_CHANCELA_MIN_DIAS} a ${PRAZO_CHANCELA_MAX_DIAS} dias úteis.` };
  }
  return { ok: true, valor: n };
}

export function rotuloDiasUteis(n: number): string {
  return n === 1 ? '1 dia útil' : `${n} dias úteis`;
}

/** O banco recusou a verificação porque o registro gravado não é o que o administrador conferiu. */
export function erroRegistroAlterado(erro: unknown): boolean {
  const hint = (erro as { hint?: unknown } | null | undefined)?.hint;
  return (typeof hint === 'string' && hint.includes('registro_alterado')) || semAcento(textoDoErro(erro)).includes('registro profissional mudou');
}

/** Erros das RPCs de administração (verificar, equipe, configuração, solicitar verificação). */
export function mensagemErroAdmin(erro: unknown): string {
  const bruta = textoDoErro(erro);
  const norm = semAcento(bruta);
  if (erroRegistroAlterado(erro)) {
    return 'O registro do profissional mudou desde que você abriu o cartão. A lista foi atualizada: confira o registro novo antes de verificar.';
  }
  if (norm.includes('apenas o administrador')) return 'Apenas o administrador MyHealthID pode fazer esta alteração.';
  if (funcaoAusente(norm)) return 'Recurso indisponível: a atualização do banco de dados ainda está pendente. Tente de novo em alguns minutos.';
  if (norm.includes('row-level security') || norm.includes('permission denied') || norm.includes('not authorized')) {
    return 'Você não tem permissão para esta ação.';
  }
  return bruta || 'Não foi possível concluir agora. Tente de novo.';
}
