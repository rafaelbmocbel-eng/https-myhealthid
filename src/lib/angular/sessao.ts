import type { OpcoesAnalise } from './analise';
import type { RefCompasso, OlharPara, UnidadePrumo } from './medidas';
import {
  POSICOES_DA_NOTA, type MedidaSalva, type PosicaoDaNota, type PosicaoParaComparar, type SessaoParaComparar,
} from './comparar';
import {
  ESQUEMA_ANALISE_FOTO, ROTULO_VISTA_SESSAO, VISTAS_DA_SESSAO, vistaDaSessao,
  type LadoPerfil, type SessaoGravada, type VistaBase, type VistaSessao,
} from './tiposSessao';

/*
 * Sessão de avaliação postural em foto: uma nota do prontuário por posição, ligadas por
 * `dados_extras.sessao.id`. Funções puras (sem React nem Supabase) para montar o `dados_extras`,
 * ler notas de qualquer época, agrupar por sessão e escolher a avaliação anterior.
 * Nota sem `sessao` (esquema 1) é uma sessão de uma posição; perfil sem lado nunca é D nem E.
 */

export type MetodoAnalise = 'automatica_conferida' | 'marcacao_manual';

/** `dados_extras` de uma nota de análise em foto, no esquema 2: só acrescenta campos ao que já existia. */
export interface DadosExtrasFoto {
  vista: VistaBase;
  /** Só no perfil. Perfil sem este campo é "lado não informado" (nota antiga). */
  lado_perfil?: LadoPerfil;
  medidas: MedidaSalva[];
  metodo: MetodoAnalise;
  nivel_graus: number | null;
  escala_cm_por_px: number | null;
  opcoes: OpcoesAnalise;
  esquema: number;
  sessao?: SessaoGravada;
  /** Ids das medidas cujos pontos o profissional moveu ou refez depois da sugestão automática. */
  pontos_ajustados?: string[];
}

export interface EntradaDadosExtras {
  vista: VistaBase;
  lado?: LadoPerfil | null;
  medidas: MedidaSalva[];
  metodo: MetodoAnalise;
  nivelGraus: number | null;
  escalaCmPorPx: number | null;
  opcoes: OpcoesAnalise;
  sessao?: SessaoGravada | null;
  pontosAjustados?: readonly string[] | null;
}

const hex2 = (n: number) => n.toString(16).padStart(2, '0');

/** uuid v4 (vai para `referencia_id`, coluna uuid). Usa crypto.randomUUID e, sem ela, getRandomValues ou Math.random. */
export function novaSessaoId(): string {
  const c = (globalThis as { crypto?: Partial<Crypto> }).crypto;
  if (c && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      // Página sem contexto seguro pode negar randomUUID: segue para a alternativa abaixo.
    }
  }
  const bytes = new Uint8Array(16);
  let sorteado = false;
  if (c && typeof c.getRandomValues === 'function') {
    try {
      c.getRandomValues(bytes);
      sorteado = true;
    } catch {
      // Sem permissão para getRandomValues: cai no Math.random, suficiente para um id de agrupamento.
    }
  }
  if (!sorteado) {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, hex2).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** As quatro posições na ordem sugerida de fotografar (cópia: quem recebe pode alterar). */
export function previstasPadrao(): VistaSessao[] {
  return [...VISTAS_DA_SESSAO];
}

/**
 * Monta o `dados_extras` do esquema 2. `lado_perfil` só vai no perfil, `sessao` só quando há sessão e
 * `pontos_ajustados` só quando o chamador sabe quais foram (lista vazia = nenhum ajustado).
 */
export function montarDadosExtras(e: EntradaDadosExtras): DadosExtrasFoto {
  return {
    vista: e.vista,
    ...(e.vista === 'perfil' && (e.lado === 'D' || e.lado === 'E') ? { lado_perfil: e.lado } : {}),
    medidas: e.medidas,
    metodo: e.metodo,
    nivel_graus: e.nivelGraus,
    escala_cm_por_px: e.escalaCmPorPx,
    opcoes: e.opcoes,
    esquema: ESQUEMA_ANALISE_FOTO,
    ...(e.sessao ? { sessao: { id: e.sessao.id, ordem: e.sessao.ordem, previstas: [...e.sessao.previstas], iniciadaEm: e.sessao.iniciadaEm } } : {}),
    ...(e.pontosAjustados ? { pontos_ajustados: [...e.pontosAjustados] } : {}),
  };
}

// ---------------------------------------------------------------------------
// Leitura tolerante
// ---------------------------------------------------------------------------

export interface DadosLidos {
  /** 1 quando a nota não traz esquema (anterior à sessão). */
  esquema: number;
  vista: VistaBase | null;
  ladoPerfil: LadoPerfil | null;
  /** Posição na avaliação; null se a nota não tem vista (por exemplo, nota de vídeo). */
  posicao: PosicaoDaNota | null;
  /** Só as medidas bem formadas. */
  medidas: MedidaSalva[];
  metodo: MetodoAnalise | null;
  nivelGraus: number | null;
  escalaCmPorPx: number | null;
  opcoes: Partial<OpcoesAnalise>;
  sessao: SessaoGravada | null;
  /** null = a nota não diz quais pontos foram ajustados; [] = nenhum. */
  pontosAjustados: string[] | null;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const numero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ehVistaSessao = (v: unknown): v is VistaSessao => VISTAS_DA_SESSAO.includes(v as VistaSessao);
const instante = (iso: unknown): number | null => {
  if (typeof iso !== 'string') return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
};

const REFS_COMPASSO: readonly RefCompasso[] = ['baixo', 'cima', 'esquerda', 'direita'];
const UNIDADES_PRUMO: readonly UnidadePrumo[] = ['graus', 'cm', 'pct'];
const OLHA_PARA: readonly OlharPara[] = ['esquerda', 'direita'];

function lerMedida(v: unknown): MedidaSalva | null {
  if (!ehObjeto(v)) return null;
  const graus = numero(v.graus);
  if (typeof v.id !== 'string' || !v.id || graus === null) return null;
  const m: MedidaSalva = { id: v.id, graus };
  if (typeof v.texto === 'string') m.texto = v.texto;
  if (v.unidade === 'cm' || v.unidade === '%') m.unidade = v.unidade;
  if (typeof v.sentido === 'string' && v.sentido) m.sentido = v.sentido;
  return m;
}

function lerOpcoes(v: unknown): Partial<OpcoesAnalise> {
  if (!ehObjeto(v)) return {};
  const o: Partial<OpcoesAnalise> = {};
  if (REFS_COMPASSO.includes(v.compassoRef as RefCompasso)) o.compassoRef = v.compassoRef as RefCompasso;
  if (UNIDADES_PRUMO.includes(v.unidadePrumo as UnidadePrumo)) o.unidadePrumo = v.unidadePrumo as UnidadePrumo;
  if (OLHA_PARA.includes(v.olhaPara as OlharPara)) o.olhaPara = v.olhaPara as OlharPara;
  return o;
}

function lerSessao(v: unknown): SessaoGravada | null {
  if (!ehObjeto(v) || typeof v.id !== 'string' || !v.id.trim()) return null;
  const ordem = numero(v.ordem);
  return {
    id: v.id,
    ordem: ordem !== null && ordem >= 1 ? Math.trunc(ordem) : 1,
    previstas: Array.isArray(v.previstas) ? [...new Set(v.previstas.filter(ehVistaSessao))] : [],
    iniciadaEm: typeof v.iniciadaEm === 'string' ? v.iniciadaEm : '',
  };
}

/**
 * Lê o `dados_extras` de uma nota de qualquer época (esquema 1 sem sessão, esquema 2, perfil sem lado,
 * campos desconhecidos). Nunca lança: o que não estiver bem formado vira vazio ou null.
 */
export function lerDadosExtras(bruto: unknown): DadosLidos {
  const o = ehObjeto(bruto) ? bruto : {};
  const vista: VistaBase | null = o.vista === 'frente' || o.vista === 'perfil' || o.vista === 'costas' ? o.vista : null;
  const ladoPerfil: LadoPerfil | null = vista === 'perfil' && (o.lado_perfil === 'D' || o.lado_perfil === 'E') ? o.lado_perfil : null;
  let posicao: PosicaoDaNota | null = null;
  if (vista) posicao = vista === 'perfil' && !ladoPerfil ? 'perfil_sem_lado' : vistaDaSessao(vista, ladoPerfil);
  const esquema = numero(o.esquema);
  const escala = numero(o.escala_cm_por_px);
  return {
    esquema: esquema !== null && esquema >= 1 ? Math.trunc(esquema) : 1,
    vista,
    ladoPerfil,
    posicao,
    medidas: Array.isArray(o.medidas) ? o.medidas.flatMap((m) => lerMedida(m) ?? []) : [],
    metodo: o.metodo === 'automatica_conferida' || o.metodo === 'marcacao_manual' ? o.metodo : null,
    nivelGraus: numero(o.nivel_graus),
    escalaCmPorPx: escala !== null && escala > 0 ? escala : null,
    opcoes: lerOpcoes(o.opcoes),
    sessao: lerSessao(o.sessao),
    pontosAjustados: Array.isArray(o.pontos_ajustados) ? o.pontos_ajustados.filter((p): p is string => typeof p === 'string') : null,
  };
}

// ---------------------------------------------------------------------------
// Texto da nota
// ---------------------------------------------------------------------------

/** "Análise angular — vista perfil direito (2 de 4)". Sem o "(n de total)" quando a sessão tem uma posição só. */
export function tituloDaNota(posicao: VistaSessao, ordem: number, total: number): string {
  const base = `Análise angular — vista ${ROTULO_VISTA_SESSAO[posicao].toLowerCase()}`;
  if (!Number.isFinite(ordem) || !Number.isFinite(total)) return base;
  const o = Math.trunc(ordem);
  const t = Math.max(Math.trunc(total), o);
  return o >= 1 && t >= 2 ? `${base} (${o} de ${t})` : base;
}

export const FRASE_REFERENCIA_PADRAO = 'Os ângulos usam a horizontal e a vertical da imagem como referência.';

export interface EntradaDescricao {
  /** Uma linha por medida, como já aparece na tela. */
  medidasTexto: string;
  metodo: MetodoAnalise;
  /** Frase sobre a correção de nível; sem ela vale a frase padrão de referência da imagem. */
  nivelNota?: string | null;
  /** Ids das medidas ajustadas à mão. Não informar quando a tela não sabe. */
  pontosAjustados?: readonly string[] | null;
}

function fraseDosPontos(metodo: MetodoAnalise, ajustados?: readonly string[] | null): string {
  if (metodo !== 'automatica_conferida') return 'Pontos marcados manualmente.';
  const base = 'Pontos sugeridos por detecção automática';
  if (!ajustados) return `${base}.`;
  const n = ajustados.length;
  if (n === 0) return `${base}; nenhuma medida ajustada à mão.`;
  return `${base}; ${n} ${n === 1 ? 'medida ajustada' : 'medidas ajustadas'} à mão.`;
}

/** Texto do prontuário. Não afirma que o profissional conferiu os pontos: isso o aplicativo não verifica. */
export function descricaoDaNota(e: EntradaDescricao): string {
  const medidas = e.medidasTexto.trim();
  const corpo = `${fraseDosPontos(e.metodo, e.pontosAjustados)} ${e.nivelNota?.trim() || FRASE_REFERENCIA_PADRAO} A foto não é armazenada.`;
  return medidas ? `${medidas}\n${corpo}` : corpo;
}

// ---------------------------------------------------------------------------
// Agrupar notas em sessões e escolher a anterior
// ---------------------------------------------------------------------------

/** Linha de `notas_prontuario` como a consulta do histórico devolve. */
export interface NotaDeAnalise {
  id: string;
  created_at: string;
  dados_extras: unknown;
}

export interface PosicaoNaSessao extends PosicaoParaComparar {
  posicao: PosicaoDaNota;
  notaId: string;
  criadaEm: string;
  nivelGraus: number | null;
  metodo: MetodoAnalise | null;
  pontosAjustados: string[] | null;
  /** Ordem gravada na nota (1, 2, 3...); null em nota sem sessão. */
  ordem: number | null;
}

export interface SessaoAgrupada extends SessaoParaComparar {
  /** `sessao.id` da nota ou, em nota antiga, o id da própria nota. */
  id: string;
  /** Nota sem `dados_extras.sessao`: sessão de uma posição só. */
  legada: boolean;
  esquema: number;
  /** ISO do início da sessão; em nota antiga, o `created_at` da nota. Vazio se nenhuma data for válida. */
  iniciadaEm: string;
  previstas: VistaSessao[];
  posicoes: Partial<Record<PosicaoDaNota, PosicaoNaSessao>>;
}

interface Item {
  nota: NotaDeAnalise;
  dados: DadosLidos;
  posicao: PosicaoDaNota;
  criada: number;
}

function montarSessao(id: string, itens: Item[]): SessaoAgrupada {
  const cronologicos = [...itens].sort((x, y) => x.criada - y.criada);
  const posicoes: Partial<Record<PosicaoDaNota, PosicaoNaSessao>> = {};
  for (const { nota, dados, posicao } of cronologicos) {
    posicoes[posicao] = {
      posicao, notaId: nota.id, criadaEm: nota.created_at, medidas: dados.medidas, nivelGraus: dados.nivelGraus,
      metodo: dados.metodo, pontosAjustados: dados.pontosAjustados, ordem: dados.sessao?.ordem ?? null,
    };
  }
  let inicio: { iso: string; t: number } | null = null;
  for (const { nota, dados } of cronologicos) {
    const bruto = [dados.sessao?.iniciadaEm, nota.created_at].find((c): c is string => instante(c) !== null);
    const t = instante(bruto);
    if (bruto !== undefined && t !== null && (!inicio || t < inicio.t)) inicio = { iso: bruto, t };
  }
  const guia = cronologicos.find((i) => i.dados.sessao?.previstas.length);
  return {
    id,
    legada: itens.every((i) => !i.dados.sessao),
    esquema: Math.min(...itens.map((i) => i.dados.esquema)),
    iniciadaEm: inicio?.iso ?? '',
    previstas: guia?.dados.sessao?.previstas ?? [],
    posicoes,
  };
}

const ultimaNota = (s: SessaoAgrupada) => Math.max(0, ...Object.values(s.posicoes).map((p) => instante(p?.criadaEm) ?? 0));

/** Mais recente primeiro: início da sessão, depois a última nota gravada, depois o id (para a ordem não variar). */
function maisRecentesPrimeiro(sessoes: readonly SessaoAgrupada[]): SessaoAgrupada[] {
  return [...sessoes].sort((x, y) =>
    (instante(y.iniciadaEm) ?? 0) - (instante(x.iniciadaEm) ?? 0)
    || ultimaNota(y) - ultimaNota(x)
    || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/**
 * Agrupa as notas por `sessao.id` (mais recente primeiro). Nota sem sessão é uma sessão de uma posição, com o id da nota.
 * Ficam de fora as notas sem vista (vídeo) e as sem nenhuma medida válida. Se a mesma posição aparecer duas vezes na
 * sessão, vale a nota mais recente.
 */
export function agruparPorSessao(notas: readonly NotaDeAnalise[]): SessaoAgrupada[] {
  const grupos = new Map<string, Item[]>();
  for (const nota of notas) {
    const dados = lerDadosExtras(nota.dados_extras);
    if (!dados.posicao || dados.medidas.length === 0) continue;
    const id = dados.sessao?.id ?? nota.id;
    const itens = grupos.get(id) ?? [];
    itens.push({ nota, dados, posicao: dados.posicao, criada: instante(nota.created_at) ?? 0 });
    grupos.set(id, itens);
  }
  return maisRecentesPrimeiro([...grupos].map(([id, itens]) => montarSessao(id, itens)));
}

/** As posições feitas na sessão, na ordem de POSICOES_DA_NOTA. */
export function posicoesDaSessao(s: Pick<SessaoAgrupada, 'posicoes'>): PosicaoNaSessao[] {
  return POSICOES_DA_NOTA.flatMap((p) => s.posicoes[p] ?? []);
}

/** Sessões que têm a posição, da mais recente para a mais antiga; `excluirSessaoId` tira a que está em andamento. */
export function sessoesComPosicao(sessoes: readonly SessaoAgrupada[], posicao: PosicaoDaNota, excluirSessaoId?: string): SessaoAgrupada[] {
  return maisRecentesPrimeiro(sessoes.filter((s) => !!s.posicoes[posicao] && s.id !== excluirSessaoId));
}

/** A sessão mais recente que tem a posição (a anterior padrão para comparar); null se nenhuma tiver. */
export function escolherAnterior(sessoes: readonly SessaoAgrupada[], posicao: PosicaoDaNota, excluirSessaoId?: string): SessaoAgrupada | null {
  return sessoesComPosicao(sessoes, posicao, excluirSessaoId)[0] ?? null;
}

/** "12/03/2026" no fuso de Brasília; vazio se a data não for válida. */
export function dataDaSessao(iso: string): string {
  const t = instante(iso);
  if (t === null) return '';
  return new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "12/03/2026 · 3 posições": o que distingue duas avaliações na lista de escolha. */
export function rotuloDaSessao(s: Pick<SessaoAgrupada, 'iniciadaEm' | 'posicoes'>): string {
  const n = posicoesDaSessao(s).length;
  return `${dataDaSessao(s.iniciadaEm) || 'Data não informada'} · ${n} ${n === 1 ? 'posição' : 'posições'}`;
}
