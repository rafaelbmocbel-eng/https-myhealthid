// Pesquisa automática de profissionais (aba Administração da fila de chancela).
//
// Tudo aqui é PURO (sem rede, sem React): leitura defensiva do que a edge `pesquisar-profissional`
// e as RPCs devolvem, rótulos, conselho esperado por profissão e o atalho de conferência manual.
//
// A pesquisa é só INDÍCIO: nunca verifica ninguém. A decisão de verificar continua sendo um clique
// do administrador. O servidor já valida e descarta achados sem trecho ou sem fonte aterrada e
// recalcula o nível; a leitura abaixo repete as checagens baratas (categoria, trecho, https) como
// segunda barreira, para que um dado estranho nunca vire link ou selo na tela.
import { rotuloPerfil } from '@/lib/chancela';

export const NIVEIS_INDICIO = ['compativel', 'inconclusivo', 'divergente', 'nao_encontrado', 'nao_consultavel'] as const;
export type NivelIndicio = (typeof NIVEIS_INDICIO)[number];

export const CATEGORIAS_ACHADO = [
  'registro_conselho', 'situacao_registro', 'formacao', 'atuacao_profissional', 'perfil_publico',
] as const;
export type CategoriaAchado = (typeof CATEGORIAS_ACHADO)[number];

export const ROTULO_CATEGORIA: Record<CategoriaAchado, string> = {
  registro_conselho: 'Registro no conselho',
  situacao_registro: 'Situação do registro',
  formacao: 'Formação',
  atuacao_profissional: 'Atuação profissional',
  perfil_publico: 'Perfil profissional público',
};

export const AVISO_INDICIO = 'Isto é um indício encontrado na internet. Pode estar incompleto ou errado. A verificação é decisão sua.';

export const ESCOPO_PESQUISA =
  'A pesquisa busca só informação profissional pública (registro no conselho, formação e atuação). Ela não verifica ninguém: verificar continua sendo um clique seu.';

export const MENSAGEM_NAO_CONSULTOU = 'Não consegui consultar automaticamente';

export type VarianteNivel = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export interface InfoNivel {
  rotulo: string;
  descricao: string;
  variante: VarianteNivel;
}

export const INFO_NIVEL: Record<NivelIndicio, InfoNivel> = {
  compativel: {
    rotulo: 'Compatível',
    descricao: 'Uma página pública mostra o número de registro informado com um nome compatível. Qualquer pessoa pode publicar uma página assim: confira se o endereço é o do site oficial do conselho antes de decidir.',
    variante: 'success',
  },
  inconclusivo: {
    rotulo: 'Inconclusivo',
    descricao: 'Encontrei alguma informação, mas não o bastante para dizer se o registro confere.',
    variante: 'warning',
  },
  divergente: {
    rotulo: 'Divergente',
    descricao: 'Uma fonte pública mostra esse número de registro com outro nome ou outra profissão. Confira com atenção antes de decidir.',
    variante: 'danger',
  },
  nao_encontrado: {
    rotulo: 'Não encontrado',
    descricao: 'Não encontrei fonte pública sobre este registro. Isso não quer dizer que a pessoa não seja habilitada: nem todo conselho publica a consulta na internet.',
    variante: 'neutral',
  },
  nao_consultavel: {
    rotulo: 'Não consegui consultar',
    descricao: 'A busca falhou ou foi bloqueada, então nada foi confirmado nem descartado.',
    variante: 'info',
  },
};

// ── Leitura defensiva ──────────────────────────────────────────────────────

type Obj = Record<string, unknown>;

function obj(v: unknown): Obj | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null;
}

function texto(v: unknown, max = 400): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  if (t === '') return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function nivelValido(v: unknown): v is NivelIndicio {
  return typeof v === 'string' && (NIVEIS_INDICIO as readonly string[]).includes(v);
}

function categoriaValida(v: unknown): v is CategoriaAchado {
  return typeof v === 'string' && (CATEGORIAS_ACHADO as readonly string[]).includes(v);
}

const URL_MAX_CARACTERES = 2048;

/** Devolve a URL normalizada só quando é https, sem usuário/senha e com host; qualquer outra coisa vira null. */
export function urlHttpsSegura(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const bruta = v.trim();
  if (bruta === '' || bruta.length > URL_MAX_CARACTERES) return null;
  try {
    const u = new URL(bruta);
    if (u.protocol !== 'https:' || u.hostname === '' || u.username !== '' || u.password !== '') return null;
    return u.href;
  } catch {
    // URL malformada: sem link é melhor do que um link quebrado ou perigoso.
    return null;
  }
}

export function hostDaUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    // Só chamamos com URL já validada; se falhar, mostra a URL crua em vez de esconder a fonte.
    return url;
  }
}

export interface AchadoPesquisa {
  categoria: CategoriaAchado;
  texto: string;
  trecho: string;
  fonteUrl: string;
  fonteTitulo: string;
}

/** Achado sem trecho, sem fonte https ou de categoria fora da lista é descartado (o servidor faz o mesmo). */
export function lerAchado(bruto: unknown): AchadoPesquisa | null {
  const o = obj(bruto);
  if (!o || !categoriaValida(o.categoria)) return null;
  const trecho = texto(o.trecho, 600);
  const fonteUrl = urlHttpsSegura(o.fonte_url);
  if (!trecho || !fonteUrl) return null;
  return {
    categoria: o.categoria,
    texto: texto(o.texto, 500) ?? '',
    trecho,
    fonteUrl,
    fonteTitulo: texto(o.fonte_titulo, 120) ?? hostDaUrl(fonteUrl),
  };
}

export function lerAchados(bruto: unknown): AchadoPesquisa[] {
  if (!Array.isArray(bruto)) return [];
  const out: AchadoPesquisa[] = [];
  for (const item of bruto) {
    const a = lerAchado(item);
    if (a) out.push(a);
  }
  return out;
}

/** O que foi usado na busca. Só estes campos são lidos: e-mail e telefone nunca aparecem na tela. */
export interface ConsultaUsada {
  nome: string | null;
  registro: string | null;
  profissao: string | null;
  conselho: string | null;
  /** Cidade/UF da clínica, quando a consulta usou para separar homônimos. */
  local: string | null;
}

export function lerConsultaUsada(bruto: unknown): ConsultaUsada | null {
  const o = obj(bruto);
  if (!o) return null;
  const cidade = texto(o.cidade, 60);
  const uf = texto(o.uf, 2);
  const consulta: ConsultaUsada = {
    nome: texto(o.nome ?? o.nome_completo, 120),
    registro: texto(o.registro ?? o.registro_profissional, 60),
    profissao: texto(o.profissao ?? o.perfil_profissional ?? o.perfil, 60),
    conselho: texto(o.conselho_esperado ?? o.conselho, 60),
    local: cidade && uf ? `${cidade}/${uf}` : null,
  };
  return Object.values(consulta).some((v) => v !== null) ? consulta : null;
}

export function descreverConsulta(c: ConsultaUsada | null): string {
  if (!c) return '';
  return [c.nome, c.profissao, c.registro, c.local].filter(Boolean).join(' · ');
}

export interface PesquisaProfissional {
  id: string | null;
  pesquisadoEm: string | null;
  nivel: NivelIndicio;
  /** O servidor disse "compatível", mas nenhum achado de registro passou na conferência da tela. */
  rebaixado: boolean;
  resumo: string | null;
  achados: AchadoPesquisa[];
  consulta: ConsultaUsada | null;
  modelo: string | null;
  erro: string | null;
}

/**
 * Interpreta a pesquisa (formato de `pesquisa_profissional_ultima` e de `pesquisa` na resposta da edge).
 * Nível desconhecido invalida a pesquisa inteira. "Compatível" sem nenhum achado de registro
 * exibível cai para "inconclusivo": a tela nunca afirma mais do que mostra.
 */
export function lerPesquisaProfissional(bruto: unknown): PesquisaProfissional | null {
  const o = obj(bruto);
  if (!o || !nivelValido(o.nivel_indicio)) return null;
  const achados = lerAchados(o.achados);
  const semRegistro = o.nivel_indicio === 'compativel' && !achados.some((a) => a.categoria === 'registro_conselho');
  return {
    id: texto(o.id, 80),
    pesquisadoEm: texto(o.pesquisado_em, 40),
    nivel: semRegistro ? 'inconclusivo' : o.nivel_indicio,
    rebaixado: semRegistro,
    resumo: texto(o.resumo, 1200),
    achados,
    consulta: lerConsultaUsada(o.consulta_usada),
    modelo: texto(o.modelo, 80),
    erro: texto(o.erro, 300),
  };
}

export interface ResumoPesquisaProfissional {
  userId: string;
  pesquisadoEm: string | null;
  nivel: NivelIndicio;
}

/** Interpreta `pesquisas_profissionais_resumo`; linhas sem user_id ou com nível desconhecido são descartadas. */
export function lerResumosPesquisas(data: unknown): ResumoPesquisaProfissional[] {
  if (!Array.isArray(data)) return [];
  const out: ResumoPesquisaProfissional[] = [];
  for (const item of data) {
    const o = obj(item);
    const userId = texto(o?.user_id, 80);
    if (!o || !userId || !nivelValido(o.nivel_indicio)) continue;
    out.push({ userId, pesquisadoEm: texto(o.pesquisado_em, 40), nivel: o.nivel_indicio });
  }
  return out;
}

function instante(v: string | null): number {
  if (!v) return 0;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Um resumo por profissional (o mais recente, se o banco repetir). */
export function indexarResumos(lista: ResumoPesquisaProfissional[]): Map<string, ResumoPesquisaProfissional> {
  const mapa = new Map<string, ResumoPesquisaProfissional>();
  for (const r of lista) {
    const atual = mapa.get(r.userId);
    if (!atual || instante(r.pesquisadoEm) >= instante(atual.pesquisadoEm)) mapa.set(r.userId, r);
  }
  return mapa;
}

const ERROS_CONHECIDOS: Record<string, string> = {
  em_andamento: 'a pesquisa não terminou (pode ainda estar em andamento ou a conexão caiu)',
};

/** Texto do motivo registrado; códigos que o servidor grava ganham uma frase, o resto aparece como veio. */
export function descreverErro(erro: string): string {
  return ERROS_CONHECIDOS[erro] ?? erro;
}

const PREFIXO_NAO_CONSULTOU = /^Não consegui consultar automaticamente\.?\s*/i;

/**
 * Explicação da falha de consulta. O resumo gravado pelo servidor já começa com "Não consegui consultar
 * automaticamente."; a tela mostra essa frase só no título e aqui fica o resto (ou o texto padrão).
 */
export function textoDaFalha(resumo: string | null): string {
  const resto = (resumo ?? '').replace(PREFIXO_NAO_CONSULTOU, '').trim();
  return resto || 'O site do conselho pode exigir captcha ou estar fora do ar. Use o atalho abaixo para consultar a fonte oficial.';
}

// ── Resposta da edge e erros ───────────────────────────────────────────────

export type RespostaPesquisa =
  | { ok: true; pesquisa: PesquisaProfissional }
  | { ok: false; codigo: string | null; mensagem: string | null; pesquisa: PesquisaProfissional | null };

/**
 * `null` = formato irreconhecível. Aceita `motivo`/`error` como apelidos de `codigo`/`mensagem` (padrão das outras edges).
 * Na falha da busca a edge grava a tentativa e a devolve junto em `pesquisa` (nível "não consegui consultar").
 */
export function lerRespostaPesquisa(data: unknown): RespostaPesquisa | null {
  const o = obj(data);
  if (!o) return null;
  if (o.ok === true) {
    const pesquisa = lerPesquisaProfissional(o.pesquisa);
    return pesquisa ? { ok: true, pesquisa } : null;
  }
  const codigo = texto(o.codigo ?? o.motivo, 60);
  const mensagem = texto(o.mensagem ?? o.error, 300);
  if (o.ok === false || codigo || mensagem) return { ok: false, codigo, mensagem, pesquisa: lerPesquisaProfissional(o.pesquisa) };
  return null;
}

const MENSAGEM_GENERICA = 'Não consegui concluir a pesquisa agora. Tente de novo em instantes.';

const MENSAGEM_POR_CODIGO: Record<string, string> = {
  limite_profissional: 'Este profissional já foi pesquisado há pouco. Aguarde alguns minutos para pesquisar de novo.',
  limite_diario: 'O limite diário de pesquisas foi atingido. Tente de novo amanhã ou use o atalho de conferência.',
  sem_registro: 'O cadastro não tem os dados necessários para pesquisar.',
  falha_busca: `${MENSAGEM_NAO_CONSULTOU}. Use o atalho para consultar o conselho.`,
  tempo_esgotado: 'A pesquisa demorou demais para responder. Tente de novo ou use o atalho de conferência.',
  sem_conexao: 'Não consegui falar com o servidor agora. Verifique a conexão e tente de novo.',
  nao_autorizado: 'Apenas o administrador MyHealthID pode pesquisar profissionais.',
  pedido_invalido: 'Não consegui identificar o profissional a pesquisar. Recarregue a página.',
  indisponivel: 'Não foi possível concluir agora. Tente de novo em instantes.',
};

const TITULO_POR_CODIGO: Record<string, string> = {
  limite_profissional: 'Pesquisa não feita agora',
  limite_diario: 'Pesquisa não feita agora',
  sem_registro: 'Faltam dados para pesquisar',
  falha_busca: MENSAGEM_NAO_CONSULTOU,
  tempo_esgotado: MENSAGEM_NAO_CONSULTOU,
};

/** A falha foi da consulta em si (e não de limite ou permissão): o atalho manual ganha destaque. */
export function falhaDeConsulta(codigo: string | null): boolean {
  return codigo === 'falha_busca' || codigo === 'tempo_esgotado';
}

export function tituloErroPesquisa(codigo: string | null): string {
  return (codigo && TITULO_POR_CODIGO[codigo]) || 'Não consegui pesquisar';
}

/** Mensagem para a tela: permissão tem texto fixo; o resto usa a do servidor, com padrão por código. */
export function mensagemErroPesquisa(codigo: string | null, mensagemServidor: string | null): string {
  if (codigo === 'nao_autorizado' || codigo === 'sem_permissao') return MENSAGEM_POR_CODIGO.nao_autorizado;
  if (mensagemServidor) return mensagemServidor;
  return (codigo && MENSAGEM_POR_CODIGO[codigo]) || MENSAGEM_GENERICA;
}

// ── Conselho esperado e atalho de conferência manual ───────────────────────

export interface ConselhoEsperado {
  sigla: string;
  nome: string;
  /** Como a profissão entra na busca do Google. */
  termoBusca: string;
}

const CREFITO: Omit<ConselhoEsperado, 'termoBusca'> = { sigla: 'CREFITO', nome: 'Conselho Regional de Fisioterapia e Terapia Ocupacional' };

const CONSELHO_POR_PERFIL: Record<string, ConselhoEsperado> = {
  fisioterapeuta: { ...CREFITO, termoBusca: 'fisioterapeuta' },
  terapeuta_ocupacional: { ...CREFITO, termoBusca: 'terapeuta ocupacional' },
  educador_fisico: { sigla: 'CREF', nome: 'Conselho Regional de Educação Física', termoBusca: 'educador físico' },
  nutricionista: { sigla: 'CRN', nome: 'Conselho Regional de Nutricionistas', termoBusca: 'nutricionista' },
  medico: { sigla: 'CRM', nome: 'Conselho Regional de Medicina', termoBusca: 'médico' },
  psicologo: { sigla: 'CRP', nome: 'Conselho Regional de Psicologia', termoBusca: 'psicólogo' },
  dentista: { sigla: 'CRO', nome: 'Conselho Regional de Odontologia', termoBusca: 'dentista' },
};

export function conselhoEsperado(perfil: string | null | undefined): ConselhoEsperado | null {
  return perfil ? CONSELHO_POR_PERFIL[perfil] ?? null : null;
}

const SIGLAS_CONSELHO = ['CREFITO', 'CREF', 'CRN', 'CRM', 'CRP', 'CRO'] as const;
const RE_SIGLA_NO_REGISTRO = new RegExp(`(?:^|[^A-Za-z])(${SIGLAS_CONSELHO.join('|')})(?![A-Za-z])`, 'i');

/** Sigla do conselho escrita no registro informado ("CRN-3 12345" → "CRN"), ou null se não houver. */
export function conselhoNoRegistro(registro: string | null | undefined): string | null {
  const m = registro ? RE_SIGLA_NO_REGISTRO.exec(registro) : null;
  return m ? m[1].toUpperCase() : null;
}

/** Avisa quando o registro cita um conselho que não é o da profissão (ex.: nutricionista com "CREF 123"). */
export function avisoConselhoDiferente(perfil: string | null | undefined, registro: string | null | undefined): string | null {
  const esperado = conselhoEsperado(perfil);
  const citado = conselhoNoRegistro(registro);
  if (!esperado || !citado || citado === esperado.sigla) return null;
  return `O registro informado cita o ${citado}, mas para ${rotuloPerfil(perfil)} o conselho esperado é o ${esperado.sigla}.`;
}

/** Nome para a busca: sem nome de verdade (cai no e-mail ou em "Sem nome"), não usa nada, e nunca o e-mail. */
export function nomeParaBusca(nome: string | null | undefined, email: string | null | undefined): string {
  const n = (nome ?? '').trim();
  if (n === '' || n === 'Sem nome' || n.includes('@')) return '';
  if (email && n.toLowerCase() === email.trim().toLowerCase()) return '';
  return n;
}

export interface EntradaBusca {
  nome: string;
  perfil: string | null;
  registro: string | null;
}

/**
 * Atalho de conferência: busca no Google com nome + profissão + registro + "conselho". Não é URL de
 * consulta de conselho (essas mudam e têm captcha); é só um ponto de partida montado com o que o
 * profissional informou. Sem nome nem registro devolve null.
 */
export function linkBuscaConferencia(e: EntradaBusca): string | null {
  const nome = e.nome.trim();
  const registro = (e.registro ?? '').trim();
  if (nome === '' && registro === '') return null;
  const profissao = conselhoEsperado(e.perfil)?.termoBusca ?? '';
  const consulta = [nome, profissao, registro, 'conselho'].filter((p) => p !== '').join(' ').slice(0, 300);
  return `https://www.google.com/search?q=${encodeURIComponent(consulta).replace(/%20/g, '+')}`;
}

// ── Datas (fuso de Brasília) ───────────────────────────────────────────────

const FORMATO_DATA_HORA_BR = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 'dd/mm/aaaa às HH:mm' no fuso de Brasília, ou '' se a data for ausente/inválida. */
export function formatarDataHoraBR(v: string | Date | null | undefined): string {
  if (v === null || v === undefined || v === '') return '';
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const partes: Record<string, string> = {};
  for (const p of FORMATO_DATA_HORA_BR.formatToParts(d)) partes[p.type] = p.value;
  return `${partes.day}/${partes.month}/${partes.year} às ${partes.hour}:${partes.minute}`;
}
