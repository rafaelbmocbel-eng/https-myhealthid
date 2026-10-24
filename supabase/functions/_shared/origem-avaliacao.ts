// Espelho de src/utils/voiceAssessment/origemAvaliacao.ts (as funções rodam em Deno e não importam de src/;
// src/test/origemAvaliacaoVoz.test.ts garante que os dois lados não se separem).
// avaliacoes_voz guarda a avaliação presencial do profissional e também o que o paciente conta no portal;
// quem separa as duas é resultado._meta.origem.
export const ORIGENS_PACIENTE = ["portal_paciente_historia", "autocadastro_paciente"] as const;

// Filtro de .or() do PostgREST. Mantém as linhas sem _meta.origem (avaliações antigas do profissional): um
// `not.in` sozinho as descartaria, porque NOT (NULL IN (...)) é NULL. A coluna resultado é json: só -> e ->>.
export const FILTRO_SO_PROFISSIONAL =
  `resultado->_meta->>origem.is.null,resultado->_meta->>origem.not.in.(${ORIGENS_PACIENTE.join(",")})`;

// Filtro inverso, para .filter(coluna, "in", valor): só os relatos que o paciente fez.
export const COLUNA_ORIGEM = "resultado->_meta->>origem";
export const VALOR_SO_PACIENTE = `(${ORIGENS_PACIENTE.join(",")})`;
