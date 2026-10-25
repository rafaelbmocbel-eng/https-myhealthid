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

// O relato do portal ("Histórico clínico") guarda a resposta crua da IA, aninhada em `assessment`; a avaliação do
// profissional e o autorrelato guardam os campos no topo. Quem lê os campos clínicos precisa olhar os dois.
export function baseDoResultado(resultado: unknown): Record<string, unknown> | null {
  if (!resultado || typeof resultado !== "object" || Array.isArray(resultado)) return null;
  const r = resultado as Record<string, unknown>;
  const aninhado = r.assessment;
  return aninhado && typeof aninhado === "object" && !Array.isArray(aninhado) ? (aninhado as Record<string, unknown>) : r;
}

// Mesma regra de src/utils/voiceAssessment/origemAvaliacao.ts (um teste compara as duas nas mesmas frases): só descarta a
// frase que NEGA exatamente o red flag / sinal de alerta e NÃO traz ressalva. Na dúvida, é alerta.
const VERBO = "(?:foram\\s+|foi\\s+|se\\s+)?(?:identific\\w*|observ\\w*|detect\\w*|encontr\\w*|relat\\w*|apresent\\w*|h[áa]|houve|exist\\w*|refere|nega)";
const OBJETO = "(?:red[\\s-]*flags?|sina(?:is|l)\\s+(?:cl[ií]nicos?\\s+)?de\\s+(?:alerta|alarme|red\\s*flags?|gravidade)|alertas?|bandeiras?\\s+vermelhas?)";
const AUSENCIA_DE_ALERTA = new RegExp(
  "^[\\s\"'“•*\\-–\\d.)]*(?:"
  + "(?:(?:o\\s+)?paciente\\s+)?(?:nenhum[a]?|sem|aus[êe]ncia\\s+de|n[ãa]o\\s+" + VERBO + "|nega)"
  + "\\s+(?:(?:nenhum[a]?|qualquer|quaisquer|presen[çc]a\\s+de|ind[ií]cios?\\s+de|evid[êe]ncias?\\s+de)\\s+)?(?:de\\s+)?" + OBJETO
  + "|(?:nenhum[a]?(?:\\s+identificad[oa]s?)?|n\\/a|n[ãa]o\\s+aplic[áa]vel)[\\s.!*\"]*$"
  + "|dados\\s+insuficientes"
  + ")",
  "i",
);
const RESSALVA = /\b(mas|por[eé]m|contudo|entretanto|todavia|exceto|salvo|apenas|al[eé]m|apesar|embora)\b|[;:]|\.\s+\S/i;
// Marcadores de lista, aspas e negrito no começo ("1. ", "- ", "**") não fazem parte da frase.
const PREFIXO_DE_LISTA = /^[\s"'“•*\-–\d.)]*/;
export const ehFraseDeAusenciaDeAlerta = (texto: string): boolean => {
  const frase = texto.replace(PREFIXO_DE_LISTA, "");
  return AUSENCIA_DE_ALERTA.test(frase) && !RESSALVA.test(frase);
};

const textoDoAlerta = (f: unknown): string => {
  if (typeof f === "string") return f;
  if (f && typeof f === "object") {
    const o = f as Record<string, unknown>;
    const s = [o.titulo, o.descricao, o.flag, o.texto].find((v) => typeof v === "string" && v.trim());
    return typeof s === "string" ? s : "";
  }
  return "";
};

const comoLista = (v: unknown): unknown[] => (Array.isArray(v) ? v : v === undefined || v === null || v === "" ? [] : [v]);

/** Os red flags de um resultado de avaliação por voz (no topo ou aninhados em `assessment`), sem as frases de ausência. */
export function redFlagsDoResultado(resultado: unknown): string[] {
  const niveis = [resultado, baseDoResultado(resultado)].filter((n, i, todos) => n && typeof n === "object" && todos.indexOf(n) === i);
  const itens = niveis.flatMap((n) => {
    const r = n as Record<string, unknown>;
    return [r.red_flags, r.redflags, r.red_flags_reforcadas].flatMap(comoLista);
  });
  const textos = itens.map((f) => textoDoAlerta(f).trim()).filter((x) => x.length >= 2 && !ehFraseDeAusenciaDeAlerta(x));
  return Array.from(new Set(textos));
}
