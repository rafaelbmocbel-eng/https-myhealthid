// A tabela avaliacoes_voz guarda a avaliação presencial do profissional (voz/escrita) e também o que o
// próprio paciente conta no portal. Quem manda é resultado._meta.origem; `mode` não separa as duas
// (o autorrelato do paciente também grava mode 'voice').
export const ORIGENS_PACIENTE = ['portal_paciente_historia', 'autocadastro_paciente'] as const;

// Filtro de .or() do PostgREST (testado contra PostgREST 12): mantém as linhas sem _meta.origem, que são as
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
