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
// de alerta"). Só vale quando a frase COMEÇA negando exatamente o red flag / sinal de alerta: "Nenhuma melhora noturna",
// "Sem sinais de melhora" e "Não houve melhora" são alertas reais e continuam.
const AUSENCIA_DE_ALERTA = new RegExp(
  '^\\s*(?:'
  + '(?:nenhum|nenhuma|sem|aus[êe]ncia\\s+de|n[ãa]o\\s+(?:foram\\s+|foi\\s+)?(?:identificad[oa]s?|h[áa]|houve|apresenta|relata|refere))'
  + '\\s+(?:de\\s+)?(?:red\\s*flags?|sina(?:is|l)\\s+de\\s+(?:alerta|alarme)|alertas?|bandeiras?\\s+vermelhas?)'
  + '|dados\\s+insuficientes'
  + ')',
  'i',
);

const textoDoAlerta = (f: unknown): string => {
  if (typeof f === 'string') return f;
  if (f && typeof f === 'object') {
    const o = f as Record<string, unknown>;
    return typeof o.titulo === 'string' ? o.titulo : typeof o.descricao === 'string' ? o.descricao : '';
  }
  return '';
};

/** Os red flags de um resultado de avaliação por voz (no topo ou aninhados em `assessment`), sem as frases de ausência. */
export function redFlagsDoResultado(resultado: unknown): string[] {
  const niveis = [resultado, baseDoResultado(resultado)].filter((n, i, todos) => n && typeof n === 'object' && todos.indexOf(n) === i);
  const itens = niveis.flatMap((n) => {
    const r = n as Record<string, unknown>;
    return [r.red_flags, r.red_flags_reforcadas].flatMap((v) => (Array.isArray(v) ? v : []));
  });
  const textos = itens.map((f) => textoDoAlerta(f).trim()).filter((t) => t.length >= 2 && !AUSENCIA_DE_ALERTA.test(t));
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
