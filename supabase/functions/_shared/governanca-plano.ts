// GOVERNANÇA dos planos gerados por IA: o registro `_governanca` que acompanha
// o plano (fonte, parâmetros usados e seu status de validação, resultado da
// triagem e plano de acompanhamento). Lógica PURA, testável com vitest.
//
// Regra de conteúdo clínico: nenhum número ou fonte é inventado aqui. Todo
// parâmetro que o app usa e que ainda não tem fonte confirmada fica com
// `fonte: null` e `status: "a_confirmar"` — nunca com uma referência fabricada.
import type { MotivoTriagem, NivelTriagem, OverrideAplicado, ResultadoTriagem } from "./triagem-bloqueio.ts";

export const MODELO_IA = "gemini-2.5-flash";
export const PROMPT_VERSAO = "2026-10";

// Limite de dor (0-10) que o app já usa: a escala de dor do treino fica vermelha
// acima deste valor (src/pages/paciente/PacienteExercicios.tsx). Reutilizado aqui
// para o aviso de "procure seu profissional" — não é um limiar clínico novo.
export const LIMIAR_DOR_PADRAO_APP = 6;

export type StatusParametro = "a_confirmar" | "confirmado";

export interface ParametroPlano {
  chave: string;
  /** Nome legível (aditivo ao contrato: a interface pode mostrar). */
  rotulo?: string;
  valor: string;
  fonte: string | null;
  status: StatusParametro;
}

export function parametro(chave: string, rotulo: string, valor: string): ParametroPlano {
  return { chave, rotulo, valor, fonte: null, status: "a_confirmar" };
}

export function valorParametro(lista: readonly ParametroPlano[], chave: string): string {
  const p = lista.find((x) => x.chave === chave);
  if (!p) throw new Error(`Parâmetro desconhecido: ${chave}`);
  return p.valor;
}

// ── Parâmetros do plano de TREINO ─────────────────────────────────────────
// Faixas que o prompt de treino já usava. Estão SEM fonte confirmada.
export const PARAMETROS_TREINO: readonly ParametroPlano[] = [
  parametro("numero_de_fases", "Número de fases do plano", "2 a 4"),
  parametro("deload_a_partir_de", "Duração do plano a partir da qual entra a semana de regeneração", "12 semanas"),
  parametro("deload_duracao", "Duração da semana de regeneração (deload)", "1 semana"),
  parametro("faixa_forca", "Força", "3-6 repetições, descanso de 2-3 min"),
  parametro("faixa_hipertrofia", "Hipertrofia", "6-12 repetições, descanso de 60-90 s"),
  parametro("faixa_resistencia_emagrecimento", "Resistência e emagrecimento", "12-20 repetições ou circuitos, descanso de 30-60 s"),
  parametro("iniciante_condicoes_clinicas", "Iniciante e condições clínicas", "progressão conservadora"),
];

/** Linha do prompt de treino com as faixas por objetivo, montada a partir dos parâmetros. */
export function textoFaixasTreino(lista: readonly ParametroPlano[] = PARAMETROS_TREINO): string {
  const v = (c: string) => valorParametro(lista, c);
  return `- Faixas de referência por objetivo (parâmetros padrão do sistema, ainda em validação): força ${v("faixa_forca")}; hipertrofia ${v("faixa_hipertrofia")}; resistência/emagrecimento ${v("faixa_resistencia_emagrecimento")}; iniciante e condições clínicas = ${v("iniciante_condicoes_clinicas")}.`;
}

// ── Plano de acompanhamento ───────────────────────────────────────────────

export interface IndicadorAcompanhamento {
  id: string;
  nome: string;
  como_medir: string;
  quando_agir: string;
}

export interface Acompanhamento {
  reavaliar_em_semanas: number;
  indicadores: IndicadorAcompanhamento[];
}

export type TipoPlano = "treino" | "nutricao";

// Indicadores obrigatórios. Texto fixo (não vem da IA): `quando_agir` só traz
// critérios gerais/qualitativos, exceto o limite de dor que o app já usa.
export const INDICADORES_PADRAO: Record<TipoPlano, readonly IndicadorAcompanhamento[]> = {
  treino: [
    {
      id: "esforco_percebido",
      nome: "Esforço percebido (0 a 10)",
      como_medir: "Ao fim de cada treino, dê uma nota de 0 (muito leve) a 10 (esforço máximo) para o esforço da sessão.",
      quando_agir: "Se o esforço fica sempre no máximo, ou se o treino parece leve demais por várias sessões seguidas, combine o ajuste do plano com o seu profissional.",
    },
    {
      id: "dor_treino",
      nome: "Dor durante o treino (0 a 10)",
      como_medir: "Ao fim de cada treino, marque de 0 (nenhuma dor) a 10 (pior dor possível) a dor que sentiu durante os exercícios.",
      quando_agir: `Se a dor passar de ${LIMIAR_DOR_PADRAO_APP}/10 (limite de alerta padrão do app) ou continuar depois do treino, pare o exercício e procure o seu profissional antes de seguir. Se sentir dor ou aperto no peito, falta de ar, tontura forte ou desmaio, interrompa o treino na hora e procure atendimento de urgência.`,
    },
    {
      id: "adesao_sessoes",
      nome: "Adesão às sessões",
      como_medir: "Na semana, compare quantas sessões do plano você concluiu com quantas estavam planejadas.",
      quando_agir: "Se várias semanas seguidas ficarem bem abaixo do planejado, converse com o seu profissional para adequar a frequência ou a rotina do plano.",
    },
  ],
  nutricao: [
    {
      id: "adesao_refeicoes",
      nome: "Adesão por refeição",
      como_medir: "Para cada refeição do dia, anote se seguiu o plano: sim, em parte ou não.",
      quando_agir: "Se uma refeição quase nunca é seguida, conte ao seu profissional para ajustar horário, alimentos ou porções.",
    },
    {
      id: "saciedade",
      nome: "Saciedade",
      como_medir: "Depois de cada refeição, anote se ficou com fome, satisfeito ou muito cheio.",
      quando_agir: "Fome intensa frequente, ou refeições que deixam muito desconforto, pedem ajuste do plano com o seu profissional.",
    },
    {
      id: "sintomas_gi",
      nome: "Sintomas gastrointestinais",
      como_medir: "Anote desconfortos como inchaço, gases, azia, náusea ou mudança no intestino e em qual refeição apareceram.",
      quando_agir: "Se os sintomas se repetem, pioram, ou vêm com dor forte, sangue nas fezes ou perda de peso sem explicação, procure um profissional de saúde.",
    },
  ],
};

/** Semanas até a primeira reavaliação quando nem a IA nem o plano indicam um prazo. Sem fonte: a confirmar. */
export const REAVALIAR_PADRAO_SEMANAS = 4;
const REAVALIAR_MIN = 1;
const REAVALIAR_MAX = 52;
const MAX_INDICADORES_EXTRAS = 3;

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

function textoCurto(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export interface OpcoesAcompanhamento {
  /** Duração total do plano de treino (limite superior da reavaliação). */
  duracaoTotalSemanas?: number;
  /** Duração da primeira fase do treino (prazo padrão da reavaliação). */
  primeiraFaseSemanas?: number;
}

export interface AcompanhamentoPreparado {
  acompanhamento: Acompanhamento;
  origemReavaliacao: "ia" | "padrao";
}

/**
 * Saneia o bloco `acompanhamento` devolvido pela IA. Os indicadores obrigatórios
 * entram SEMPRE com o texto fixo do app (a IA não os reescreve); indicadores
 * extras da IA só passam se `quando_agir` não trouxer número algum, para a IA não
 * inventar limiares clínicos.
 */
// Limiar numérico (dígitos, "por cento" ou número por extenso) não pode vir da IA:
// só o limite de dor padrão do app, que está no texto fixo.
function temNumeroClinico(t: string): boolean {
  if (/\d/.test(t)) return true;
  const n = t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return /\b(dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|cinquenta|sessenta|cem|cento|mil|por cento|porcento)\b/.test(n);
}

export function prepararAcompanhamento(
  bruto: unknown,
  tipo: TipoPlano,
  opcoes: OpcoesAcompanhamento = {},
): AcompanhamentoPreparado {
  const raiz = objeto(bruto);
  const limiteSuperior = opcoes.duracaoTotalSemanas && opcoes.duracaoTotalSemanas >= REAVALIAR_MIN
    ? Math.min(REAVALIAR_MAX, Math.round(opcoes.duracaoTotalSemanas))
    : REAVALIAR_MAX;

  let semanas = Math.round(Number(raiz?.reavaliar_em_semanas));
  let origem: "ia" | "padrao" = "ia";
  if (!Number.isFinite(semanas) || semanas < REAVALIAR_MIN || semanas > limiteSuperior) {
    origem = "padrao";
    const primeira = opcoes.primeiraFaseSemanas ? Math.round(opcoes.primeiraFaseSemanas) : NaN;
    semanas = Number.isFinite(primeira) && primeira >= REAVALIAR_MIN && primeira <= limiteSuperior
      ? primeira
      : Math.min(REAVALIAR_PADRAO_SEMANAS, limiteSuperior);
  }

  const padrao = INDICADORES_PADRAO[tipo].map((i) => ({ ...i }));
  const idsPadrao = new Set(padrao.map((i) => i.id));
  const extras: IndicadorAcompanhamento[] = [];
  const lista = Array.isArray(raiz?.indicadores) ? raiz!.indicadores as unknown[] : [];
  for (const item of lista) {
    if (extras.length >= MAX_INDICADORES_EXTRAS) break;
    const o = objeto(item);
    if (!o) continue;
    const nome = textoCurto(o.nome, 80);
    const comoMedir = textoCurto(o.como_medir, 300);
    const quandoAgir = textoCurto(o.quando_agir, 300);
    const id = slug(textoCurto(o.id, 60) || nome);
    if (!id || !nome || !comoMedir || !quandoAgir) continue;
    if (idsPadrao.has(id) || extras.some((x) => x.id === id)) continue;
    if ([nome, comoMedir, quandoAgir].some(temNumeroClinico)) continue;
    extras.push({ id, nome, como_medir: comoMedir, quando_agir: quandoAgir });
  }

  return { acompanhamento: { reavaliar_em_semanas: semanas, indicadores: [...padrao, ...extras] }, origemReavaliacao: origem };
}

// ── Registro _governanca ──────────────────────────────────────────────────

export type FuncaoGeradora = "gerar-plano-treino" | "gerar-plano-alimentar";

export interface Governanca {
  versao: 1;
  fonte: {
    tipo: "ia";
    modelo: string;
    funcao: FuncaoGeradora;
    prompt_versao: string;
    gerado_em: string;
    insumos: string[];
    parametros: ParametroPlano[];
  };
  triagem: {
    nivel: NivelTriagem;
    motivos: MotivoTriagem[];
    override: OverrideAplicado | null;
  };
  acompanhamento: Acompanhamento;
}

export interface EntradaGovernanca {
  funcao: FuncaoGeradora;
  insumos: string[];
  parametros: readonly ParametroPlano[];
  triagem: ResultadoTriagem;
  override: OverrideAplicado | null;
  acompanhamento: AcompanhamentoPreparado;
  agora?: Date;
}

export function montarGovernanca(e: EntradaGovernanca): Governanca {
  const reavaliacao: ParametroPlano = parametro(
    "reavaliar_em_semanas",
    "Prazo para reavaliar o plano",
    `${e.acompanhamento.acompanhamento.reavaliar_em_semanas} semanas (${e.acompanhamento.origemReavaliacao === "ia" ? "sugerido pela IA" : "padrão do sistema"})`,
  );
  return {
    versao: 1,
    fonte: {
      tipo: "ia",
      modelo: MODELO_IA,
      funcao: e.funcao,
      prompt_versao: PROMPT_VERSAO,
      gerado_em: (e.agora ?? new Date()).toISOString(),
      insumos: [...new Set(e.insumos)],
      parametros: [...e.parametros.map((p) => ({ ...p })), reavaliacao],
    },
    triagem: { nivel: e.triagem.nivel, motivos: e.triagem.motivos, override: e.override },
    acompanhamento: e.acompanhamento.acompanhamento,
  };
}

/** Anexa `acompanhamento` e `_governanca` ao plano (mutando o objeto recebido). */
export function aplicarGovernanca<T extends Record<string, unknown>>(plano: T, gov: Governanca): T & { acompanhamento: Acompanhamento; _governanca: Governanca } {
  const alvo = plano as T & { acompanhamento: Acompanhamento; _governanca: Governanca };
  alvo.acompanhamento = gov.acompanhamento;
  alvo._governanca = gov;
  return alvo;
}

/** Instrução do prompt para a IA incluir o bloco de acompanhamento no JSON do plano. */
export function instrucaoAcompanhamentoPrompt(tipo: TipoPlano): string {
  const obrigatorios = INDICADORES_PADRAO[tipo].map((i) => `"${i.id}" (${i.nome})`).join(", ");
  return `Inclua no JSON o bloco "acompanhamento": "reavaliar_em_semanas" (número inteiro de semanas até reavaliar o plano com o profissional) e "indicadores" (lista de {id, nome, como_medir, quando_agir}). Inclua obrigatoriamente os indicadores ${obrigatorios}. Em "quando_agir" use SÓ critérios qualitativos e gerais, SEM números clínicos, e oriente procurar o profissional se houver piora.`;
}

/** Regra comum de honestidade sobre fontes, para os dois prompts. */
export const REGRA_FONTES_PROMPT =
  "Não cite estudos, diretrizes, autores nem fontes específicas que não tenham sido fornecidos neste pedido, e não apresente os parâmetros padrão do sistema como evidência confirmada.";
