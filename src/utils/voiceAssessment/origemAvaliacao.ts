// A tabela avaliacoes_voz guarda a avaliação presencial do profissional (voz/escrita) e também o que o
// próprio paciente conta no portal. Quem manda é resultado._meta.origem; `mode` não separa as duas
// (o autorrelato do paciente também grava mode 'voice').
export const ORIGENS_PACIENTE = ['portal_paciente_historia', 'autocadastro_paciente'] as const;

// Filtro de .or() do PostgREST (testado contra PostgREST 12.2.3 e 14.1, que é a do projeto): mantém as linhas sem _meta.origem, que são as
// avaliações antigas do profissional. Um `.not('resultado->_meta->>origem', 'in', ...)` sozinho descartaria
// essas linhas, porque NOT (NULL IN (...)) é NULL. A coluna resultado é json, por isso só -> e ->>.
export const FILTRO_SO_PROFISSIONAL =
  `resultado->_meta->>origem.is.null,resultado->_meta->>origem.not.in.(${ORIGENS_PACIENTE.join(',')})`;

// Filtro inverso, para .filter(COLUNA_ORIGEM, 'in', VALOR_SO_PACIENTE): só o que o paciente relatou.
export const COLUNA_ORIGEM = 'resultado->_meta->>origem';
export const VALOR_SO_PACIENTE = `(${ORIGENS_PACIENTE.join(',')})`;

export function origemDaAvaliacao(resultado: unknown): string | undefined {
  if (!resultado || typeof resultado !== 'object') return undefined;
  const meta = (resultado as { _meta?: unknown })._meta;
  if (!meta || typeof meta !== 'object') return undefined;
  const origem = (meta as { origem?: unknown }).origem;
  return typeof origem === 'string' ? origem : undefined;
}

export function ehRelatoDoPaciente(avaliacao: { resultado?: unknown } | null | undefined): boolean {
  const origem = origemDaAvaliacao(avaliacao?.resultado);
  return origem !== undefined && (ORIGENS_PACIENTE as readonly string[]).includes(origem);
}

export function soDoProfissional<T extends { resultado?: unknown }>(avaliacoes: readonly T[]): T[] {
  return avaliacoes.filter(a => !ehRelatoDoPaciente(a));
}

// O relato do portal ("Histórico clínico") guarda a resposta crua da IA, que vem aninhada em `assessment`; a avaliação
// do profissional e o autorrelato guardam os campos no topo. Quem lê os campos clínicos precisa olhar os dois.
export function baseDoResultado(resultado: unknown): Record<string, unknown> | null {
  if (!resultado || typeof resultado !== 'object' || Array.isArray(resultado)) return null;
  const r = resultado as Record<string, unknown>;
  const aninhado = r.assessment;
  return aninhado && typeof aninhado === 'object' && !Array.isArray(aninhado) ? (aninhado as Record<string, unknown>) : r;
}

// A IA às vezes devolve a ausência de alerta como se fosse um alerta ("Nenhum red flag identificado", "Não há sinais
// de alerta", "Nenhuma"). Só vale quando a frase NEGA exatamente o red flag / sinal de alerta e NÃO traz ressalva:
// "Nenhuma melhora noturna" e "Sem sinais de melhora" são alertas reais, e "Nenhum red flag identificado, exceto febre
// persistente" também (a ressalva o mantém). Na dúvida, é alerta.
const VERBO = '(?:foram\\s+|foi\\s+|se\\s+)?(?:identific\\w*|observ\\w*|detect\\w*|encontr\\w*|relat\\w*|apresent\\w*|h[áa]|houve|exist\\w*|refere|nega)';
const OBJETO = '(?:red[\\s-]*flags?|sina(?:is|l)\\s+(?:cl[ií]nicos?\\s+)?de\\s+(?:alerta|alarme|red\\s*flags?|gravidade)|alertas?|bandeiras?\\s+vermelhas?)';
const AUSENCIA_DE_ALERTA = new RegExp(
  '^[\\s"\'“•*\\-–\\d.)]*(?:'
  + '(?:(?:o\\s+)?paciente\\s+)?(?:nenhum[a]?|sem|aus[êe]ncia\\s+de|n[ãa]o\\s+' + VERBO + '|nega)'
  + '\\s+(?:(?:nenhum[a]?|qualquer|quaisquer|presen[çc]a\\s+de|ind[ií]cios?\\s+de|evid[êe]ncias?\\s+de)\\s+)?(?:de\\s+)?' + OBJETO
  + '|(?:nenhum[a]?(?:\\s+identificad[oa]s?)?|n\\/a|n[ãa]o\\s+aplic[áa]vel)[\\s.!*"]*$'
  + '|dados\\s+insuficientes'
  + ')',
  'i',
);
const RESSALVA = /\b(mas|por[eé]m|contudo|entretanto|todavia|exceto|salvo|apenas|al[eé]m|apesar|embora)\b|[;:]|\.\s+\S/i;
// Marcadores de lista, aspas e negrito no começo ("1. ", "- ", "**") não fazem parte da frase.
const PREFIXO_DE_LISTA = /^[\s"'“•*\-–\d.)]*/;
export const ehFraseDeAusenciaDeAlerta = (texto: string): boolean => {
  const frase = texto.replace(PREFIXO_DE_LISTA, '');
  return AUSENCIA_DE_ALERTA.test(frase) && !RESSALVA.test(frase);
};

const textoDoAlerta = (f: unknown): string => {
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') {
    const o = f as Record<string, unknown>;
    const s = [o.titulo, o.descricao, o.flag, o.texto].find((v) => typeof v === 'string' && v.trim());
    return typeof s === 'string' ? s : '';
  }
  return '';
};

// A tela de avaliação aceita red_flags que não é lista (texto ou objeto) e o apelido `redflags`; aqui também.
const comoLista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null || v === '' ? [] : [v]);

/** Os red flags de um resultado de avaliação por voz (no topo ou aninhados em `assessment`), sem as frases de ausência. */
export function redFlagsDoResultado(resultado: unknown): string[] {
  const niveis = [resultado, baseDoResultado(resultado)].filter((n, i, todos) => n && typeof n === 'object' && todos.indexOf(n) === i);
  const itens = niveis.flatMap((n) => {
    const r = n as Record<string, unknown>;
    return [r.red_flags, r.redflags, r.red_flags_reforcadas].flatMap(comoLista);
  });
  const textos = itens.map((f) => textoDoAlerta(f).trim()).filter((t) => t.length >= 2 && !ehFraseDeAusenciaDeAlerta(t));
  return Array.from(new Set(textos));
}

/**
 * Origem e modo que uma avaliação salva carrega. Reprocessar com IA devolve um resultado sem _meta; por isso, na
 * falta do _meta do próprio resultado, vale o do registro aberto, e só depois o da sessão atual. Sem isso, um relato
 * que o paciente fez no portal viraria uma avaliação do profissional ao ser reprocessado.
 */
export function origemEModoDaAvaliacao(
  metaDoResultado: Record<string, any> | null | undefined,
  metaDoRegistro: Record<string, any> | null | undefined,
  origemDaSessao: string,
  modoDaSessao: string,
): { origem: string; mode: string } {
  const meta = metaDoResultado || {};
  const registro = metaDoRegistro || {};
  return {
    origem: meta.origem ?? registro.origem ?? origemDaSessao,
    mode: meta.mode ?? registro.mode ?? modoDaSessao,
  };
}

/**
 * O relato do "Histórico clínico" guarda a resposta da IA aninhada em `assessment`. O editor de avaliação espera os campos
 * no topo (e salva queixa e severidade a partir deles): ao abrir um relato assim, entrega-o nesse formato, mantendo o _meta.
 */
export function resultadoParaEdicao(resultado: unknown): unknown {
  if (!resultado || typeof resultado !== 'object' || Array.isArray(resultado)) return resultado;
  const r = resultado as Record<string, unknown>;
  const aninhado = r.assessment;
  if (!aninhado || typeof aninhado !== 'object' || Array.isArray(aninhado)) return resultado;
  return { ...(aninhado as Record<string, unknown>), _meta: r._meta };
}
