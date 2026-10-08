// MOTORES CLÍNICOS dos planos premium (treino + nutrição).
//
// Rafael: "nossa IA para criar treinos personal e nutricional deve ter motores:
// os do MyID, os questionários extras e as avaliações presenciais. A IA deve
// levar em consideração os dados da avaliação presencial e sempre as
// observações e a base científica."
//
// Este módulo é a ÚNICA fonte desses motores — as duas edge functions
// (gerar-plano-treino e gerar-plano-alimentar) carregam os mesmos dados aqui e
// cada uma aplica o enquadramento adequado ao seu tipo de plano.

import {
  classificarChamador,
  idadeEmAnos,
  type ChamadorTriagem,
  type EntradaTriagem,
  type FocoTriagem,
} from "./triagem-bloqueio.ts";
import { contaPodeGerarPlano, restringirAInsumosDoCliente } from "./plano-cliente.ts";

// deno-lint-ignore no-explicit-any
type SB = any;

export interface AchadoPresencial {
  regiao_id: string | null;
  sistema: string | null;
  tipo_achado: string | null;
  estrutura: string | null;
  diagnostico_cid: string | null;
  severidade: number | null;
  status: string | null;
  notas_clinicas: string | null; // observações do profissional no atendimento
}

export interface QuestionarioClinico {
  instrumento: string;
  escore: number | null;
  classificacao: string | null;
  // deno-lint-ignore no-explicit-any
  respostas: any;
}

export interface ExamePresencial {
  tipo: string;             // 'bioimpedancia' | 'teste_pisada' | …
  data_exame: string | null;
  resumo: string | null;    // frase pronta gerada no cadastro
  // deno-lint-ignore no-explicit-any
  dados: any;
}

export interface DadosPaciente {
  dataNascimento: string | null;
  /** Idade exata calculada da data de nascimento; null se não cadastrada. */
  idade: number | null;
  genero: string | null;
  sexo: string | null;
}

export interface MotoresClinicos {
  // Motor 1 — MyID (impressão digital sistêmica)
  scores: unknown | null;
  // Motor 3 — avaliação presencial: queixa/história/condições + achados do avatar
  queixa: string | null;
  /** historia_atual (jsonb) já convertida em texto legível. */
  historia: string | null;
  /** pacientes.condicoes_preexistentes (texto livre). */
  condicoes: string | null;
  presencial: AchadoPresencial[];
  // Exames presenciais (bioimpedância, teste de pisada, …)
  exames: ExamePresencial[];
  // Motor 2 — questionários clínicos validados respondidos (o "extra")
  questionarios: QuestionarioClinico[];
  // Avaliação de voz/presencial editável (resultado jsonb, com as seções que o
  // profissional edita à mão em _secoes.editadas). É a "descrição/mais
  // informações" da avaliação — precisa alimentar a conduta.
  avaliacaoVoz: unknown | null;
  // Dados que a triagem de segurança precisa (lidos do banco, nunca do body)
  paciente: DadosPaciente;
  medicamentos: string | null;
  alergias: string | null;
  historicoClinico: unknown | null;
  /** nutricao_anamnese.respostas (inclui a chave `triagem`, tratada à parte). */
  anamnese: Record<string, unknown> | null;
  /** nutricao_anamnese.respostas.triagem — autodeclaração do cliente. */
  triagemAutodeclarada: Record<string, unknown> | null;
  parq: { classificacao: string | null; respostas: unknown } | null;
  myidRedFlags: boolean;
  /** Red flags da avaliação presencial/voz feita pelo profissional. */
  avaliacaoRedFlags?: boolean;
  /** Fontes que falharam ao carregar (erro do banco, não "sem registro"). */
  falhasLeitura: string[];
}

// Colunas de `pacientes` lidas pelos motores. `condicoes_saude` NÃO existe no
// banco: o select inteiro falhava e queixa/história/condições chegavam vazias.
const COLUNAS_PACIENTE =
  "queixa_principal, historia_atual, condicoes_preexistentes, alergias, medicamentos_uso, historico_clinico, data_nascimento, genero, sexo";

function objetoOuNulo(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function textoOuNulo(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function temRedFlags(o: SB): boolean {
  if (!o || typeof o !== "object") return false;
  return [o.red_flags_detected, o.redFlagsDetected, o.red_flags]
    .some((v) => v === true || (Array.isArray(v) && v.length > 0));
}

function avaliacaoTemRedFlags(resultado: SB): boolean {
  if (!resultado || typeof resultado !== "object") return false;
  return [resultado.red_flags, resultado.red_flags_reforcadas].some((v) => Array.isArray(v) && v.length > 0);
}

export interface OpcoesMotores {
  /**
   * Só o que o próprio cliente informa (MyID, questionários, histórico clínico, queixa e
   * história, anamnese): sem achados/notas da avaliação presencial, exames nem avaliação por
   * voz do profissional. Quem monta o prompt do cliente usa isto. A triagem de segurança deve
   * continuar lendo os motores completos (sem a opção): falso negativo é risco de saúde.
   */
  apenasInsumosDoCliente?: boolean;
}

// Carrega os três motores para um paciente. Tolerante a tabelas/colunas
// ausentes — cada peça que falhar volta vazia, sem derrubar a geração. O que a
// triagem de segurança precisa ler e não conseguiu vai em `falhasLeitura`
// (erro do banco é diferente de "sem registro").
export async function carregarMotoresClinicos(
  admin: SB,
  pacienteId: string,
  opcoes: OpcoesMotores = {},
): Promise<MotoresClinicos> {
  const completos = await lerMotoresClinicos(admin, pacienteId);
  return opcoes.apenasInsumosDoCliente ? (restringirAInsumosDoCliente(completos) as MotoresClinicos) : completos;
}

async function lerMotoresClinicos(admin: SB, pacienteId: string): Promise<MotoresClinicos> {
  const vazio: MotoresClinicos = {
    scores: null, queixa: null, historia: null, condicoes: null, presencial: [], exames: [], questionarios: [], avaliacaoVoz: null,
    paciente: { dataNascimento: null, idade: null, genero: null, sexo: null },
    medicamentos: null, alergias: null, historicoClinico: null, anamnese: null, triagemAutodeclarada: null,
    parq: null, myidRedFlags: false, avaliacaoRedFlags: false, falhasLeitura: [],
  };
  if (!pacienteId) return vazio;

  const falhaLeitura = () => ({ data: null, error: { message: "falha ao consultar" } });
  const [myRes, pacRes, evRes, questRes, identRes, exRes, avRes, anamRes] = await Promise.all([
    admin.from("myid_avaliacoes").select("resultado_processado")
      .eq("paciente_id", pacienteId).eq("status", "concluido")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle()
      .then((r: SB) => r).catch(falhaLeitura),
    admin.from("pacientes").select(COLUNAS_PACIENTE)
      .eq("id", pacienteId).maybeSingle()
      .then((r: SB) => r).catch(falhaLeitura),
    admin.from("eventos_clinicos_anatomicos")
      .select("regiao_id, sistema, tipo_achado, estrutura, diagnostico_cid, severidade, status, notas_clinicas")
      .eq("paciente_id", pacienteId).neq("status", "resolvido").limit(30)
      .then((r: SB) => r).catch(() => ({ data: [] })),
    admin.from("questionarios_clinicos")
      .select("instrumento, escore, classificacao, respostas, created_at")
      .eq("paciente_id", pacienteId).order("created_at", { ascending: false }).limit(20)
      .then((r: SB) => r).catch(falhaLeitura),
    // Fallback do MyID importado do app antigo (fica em avaliacoes_identidade).
    admin.from("avaliacoes_identidade").select("myid_analysis")
      .eq("paciente_id", pacienteId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then((r: SB) => r).catch(falhaLeitura),
    // Exames presenciais (bioimpedância, teste de pisada, …) — o mais recente
    // de cada tipo é o que vale para o plano.
    admin.from("exames_presenciais").select("tipo, data_exame, resumo, dados")
      .eq("paciente_id", pacienteId).order("data_exame", { ascending: false }).limit(20)
      .then((r: SB) => r).catch(() => ({ data: [] })),
    // Avaliação de voz/presencial mais recente (inclui as seções editadas à mão
    // pelo profissional em resultado._secoes.editadas). Tolerante: se a tabela/
    // coluna não existir, volta vazio sem derrubar a geração.
    admin.from("avaliacoes_voz").select("resultado, created_at")
      .eq("paciente_id", pacienteId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then((r: SB) => r).catch(falhaLeitura),
    // Anamnese nutricional (+ a triagem autodeclarada, que mora em respostas.triagem).
    admin.from("nutricao_anamnese").select("respostas")
      .eq("paciente_id", pacienteId).maybeSingle()
      .then((r: SB) => r).catch(falhaLeitura),
  ]);

  const falhasLeitura: string[] = [];
  if (pacRes?.error || !pacRes?.data) falhasLeitura.push("pacientes");
  if (myRes?.error) falhasLeitura.push("myid_avaliacoes");
  if (questRes?.error) falhasLeitura.push("questionarios_clinicos");
  if (anamRes?.error) falhasLeitura.push("nutricao_anamnese");
  if (identRes?.error) falhasLeitura.push("avaliacoes_identidade");
  if (avRes?.error) falhasLeitura.push("avaliacoes_voz");

  // MyID: o formato variou entre gerações (component_scores atual, componentScores,
  // scores). Se não estiver em myid_avaliacoes, cai para avaliacoes_identidade.
  const rp = (myRes?.data?.resultado_processado as SB) || null;
  const an = (identRes?.data?.myid_analysis as SB) || null;
  let scores = rp ? (rp.scores || rp.component_scores || rp.componentScores || null) : null;
  if (!scores) {
    scores = an ? (an.component_scores || an.componentScores || an.scores || null) : null;
  }
  // Red flag é sinal de segurança: qualquer uma das fontes acende.
  const myidRedFlags = temRedFlags(rp) || temRedFlags(an);

  const pac = (pacRes?.data as SB) || null;

  // Só o exame mais recente de cada tipo (a lista vem ordenada por data desc).
  const ultExame = new Map<string, ExamePresencial>();
  ((exRes?.data as SB[]) || []).forEach((e: SB) => {
    if (e?.tipo && !ultExame.has(e.tipo)) {
      ultExame.set(e.tipo, { tipo: e.tipo, data_exame: e.data_exame ?? null, resumo: e.resumo ?? null, dados: e.dados ?? null });
    }
  });

  // Só o achado mais recente de cada instrumento (a lista vem ordenada desc).
  const ultQuest = new Map<string, QuestionarioClinico>();
  ((questRes?.data as SB[]) || []).forEach((q: SB) => {
    if (q?.instrumento && !ultQuest.has(q.instrumento)) {
      ultQuest.set(q.instrumento, { instrumento: q.instrumento, escore: q.escore ?? null, classificacao: q.classificacao ?? null, respostas: q.respostas });
    }
  });
  const parqUlt = ultQuest.get("parq");

  const anamnese = objetoOuNulo(anamRes?.data?.respostas);
  const dataNascimento = textoOuNulo(pac?.data_nascimento);

  return {
    scores,
    queixa: textoOuNulo(pac?.queixa_principal),
    historia: textoHistoriaAtual(pac?.historia_atual) || null,
    condicoes: textoOuNulo(pac?.condicoes_preexistentes),
    presencial: ((evRes?.data as SB[]) || []).map((e: SB) => ({
      regiao_id: e.regiao_id ?? null,
      sistema: e.sistema ?? null,
      tipo_achado: e.tipo_achado ?? null,
      estrutura: e.estrutura ?? null,
      diagnostico_cid: e.diagnostico_cid ?? null,
      severidade: e.severidade ?? null,
      status: e.status ?? null,
      notas_clinicas: e.notas_clinicas ?? null,
    })),
    exames: [...ultExame.values()],
    questionarios: [...ultQuest.values()],
    avaliacaoVoz: (avRes?.data?.resultado as SB) ?? null,
    paciente: {
      dataNascimento,
      idade: idadeEmAnos(dataNascimento),
      genero: textoOuNulo(pac?.genero),
      sexo: textoOuNulo(pac?.sexo),
    },
    medicamentos: textoOuNulo(pac?.medicamentos_uso),
    alergias: textoOuNulo(pac?.alergias),
    historicoClinico: pac?.historico_clinico ?? null,
    anamnese,
    triagemAutodeclarada: objetoOuNulo(anamnese?.triagem),
    parq: parqUlt ? { classificacao: parqUlt.classificacao, respostas: parqUlt.respostas } : null,
    myidRedFlags,
    avaliacaoRedFlags: avaliacaoTemRedFlags(avRes?.data?.resultado),
    falhasLeitura,
  };
}

// Rótulos das seções da avaliação de voz (mesmas chaves usadas no app).
const SECAO_AVALIACAO_LABEL: Record<string, string> = {
  resumo_clinico: "Resumo clínico",
  dor: "Análise da dor",
  funcionalidade: "Funcionalidade",
  psicossocial: "Fatores psicossociais",
  red_flags: "Red flags",
  hipoteses: "Hipóteses diagnósticas",
  cif: "Mapeamento CIF",
  diretriz: "Plano de reabilitação (da avaliação)",
  insights: "Insights",
};

// Texto da AVALIAÇÃO DE VOZ/PRESENCIAL, priorizando o que o profissional editou
// à mão (resultado._secoes.editadas) e caindo para o resumo clínico base. É a
// "descrição/mais informações" da avaliação — entra na conduta com prioridade.
function formatAvaliacaoVoz(resultado: SB): string {
  if (!resultado || typeof resultado !== "object") return "";
  const partes: string[] = [];
  const editadas = (resultado?._secoes?.editadas as SB) || {};
  const condutas = resultado?._secoes?.condutas_profissional;
  if (typeof condutas === "string" && condutas.trim()) {
    partes.push(`CONDUTAS DO PROFISSIONAL (eixo obrigatório do plano): ${condutas.trim().slice(0, 3000)}`);
  }
  // O texto editado vai INTEIRO (até 2500 por seção): antes era cortado em 600
  // caracteres e as condutas que o profissional escreve no FIM do quadro
  // ("Tratar iliopsoas… Avaliar escoliose…") nunca chegavam à diretriz.
  for (const [k, v] of Object.entries(editadas)) {
    if (typeof v === "string" && v.trim()) {
      partes.push(`${SECAO_AVALIACAO_LABEL[k] || k} (escrito pelo profissional): ${v.trim().slice(0, 2500)}`);
    }
  }
  const flags = [...(Array.isArray(resultado.red_flags) ? resultado.red_flags : []), ...(Array.isArray(resultado.red_flags_reforcadas) ? resultado.red_flags_reforcadas : [])]
    .map((f: SB) => (typeof f === "string" ? f : typeof f?.titulo === "string" ? f.titulo : typeof f?.descricao === "string" ? f.descricao : ""))
    .filter(Boolean);
  if (flags.length) partes.push(`RED FLAGS registrados na avaliação (seja conservador): ${flags.join("; ").slice(0, 800)}`);
  if (!editadas.resumo_clinico && typeof resultado.resumo_clinico === "string" && resultado.resumo_clinico.trim()) {
    partes.push(`Resumo clínico: ${resultado.resumo_clinico.trim().slice(0, 1200)}`);
  }
  if (!partes.length) return "";
  return partes.join("\n").slice(0, 9000);
}

// Formata os exames presenciais (bioimpedância, teste de pisada, …). Usa o
// `resumo` pronto quando existe; senão, monta a partir do JSON de dados.
function formatExames(exames: ExamePresencial[]): string {
  return exames.map((e) => {
    const data = e.data_exame ? ` (${e.data_exame})` : "";
    const corpo = e.resumo
      ? e.resumo
      : `${e.tipo}${e.dados ? `: ${JSON.stringify(e.dados).slice(0, 300)}` : ""}`;
    return `- ${corpo}${data}`;
  }).join("\n");
}

// Formata os achados anatômicos da avaliação presencial (avatar clínico) +
// as observações (notas_clinicas) do profissional numa linha compacta.
function formatAchados(presencial: AchadoPresencial[]): string {
  return presencial.map((e) => {
    // Condição sistêmica (regiao_id='sistemico') não é uma região do corpo —
    // é um sistema inteiro (ex.: diabetes → endócrino).
    const localizacao = e.regiao_id === "sistemico"
      ? `condição sistêmica${e.sistema ? ` (sistema ${e.sistema})` : ""}`
      : (e.regiao_id ? `região ${e.regiao_id}` : null);
    const det = [
      e.tipo_achado,
      e.estrutura ? `estrutura ${e.estrutura}` : null,
      localizacao,
      e.diagnostico_cid ? `CID ${e.diagnostico_cid}` : null,
      e.severidade != null ? `severidade ${e.severidade}` : null,
    ].filter(Boolean).join(", ");
    const nota = e.notas_clinicas ? ` — obs. do profissional: "${String(e.notas_clinicas).slice(0, 200)}"` : "";
    return `${det}${nota}`;
  }).join("; ");
}

export type FocoPlano = "treino" | "nutricao" | "clinica";

function instrucaoPresencial(foco: FocoPlano): string {
  if (foco === "treino") return "trate como PRIORIDADE clínica: evite sobrecarregar regiões com achados ativos, inclua trabalho específico/terapêutico onde indicado, respeite as observações do profissional e progrida com cautela nessas áreas";
  if (foco === "nutricao") return "considere no plano alimentar: padrão anti-inflamatório onde houver dor/lesão ativa, ajuste para as comorbidades e respeite as observações do profissional";
  return "trate como PRIORIDADE clínica: incorpore os achados e as observações do profissional na conduta, priorize as áreas com achado ativo e defina as fases a partir deles";
}

// Texto compacto da avaliação presencial (queixa/história/condições + achados
// do avatar + observações do profissional). `foco` muda só a instrução de uso.
export function textoPresencial(m: MotoresClinicos, foco: FocoPlano): string {
  const partes: string[] = [];
  if (m.queixa) partes.push(`Queixa principal: ${String(m.queixa).slice(0, 300)}`);
  if (m.historia) partes.push(`História atual: ${String(m.historia).slice(0, 400)}`);
  if (m.condicoes) partes.push(`Condições de saúde: ${String(m.condicoes).slice(0, 300)}`);
  if (m.presencial.length) {
    partes.push(`Achados registrados na avaliação presencial (avatar clínico): ${formatAchados(m.presencial)}`);
  }
  if (m.exames.length) {
    partes.push(`Exames presenciais (bioimpedância, teste de pisada, … — considere estes números objetivos no plano):\n${formatExames(m.exames)}`);
  }
  const av = formatAvaliacaoVoz(m.avaliacaoVoz as SB);
  if (av) {
    partes.push(`Avaliação clínica registrada (texto do profissional — tem PRIORIDADE, incorpore diretamente na conduta):\n${av}\n` +
      "REGRA OBRIGATÓRIA: toda ação de tratamento ou avaliação que o profissional escreveu acima (ex.: \"tratar…\", \"avaliar…\", " +
      "\"mobilização…\", técnicas, estruturas, níveis vertebrais, nervos) DEVE aparecer como conduta explícita na fase adequada, " +
      "com os mesmos termos e estruturas citados. Não omita, não generalize e não substitua nenhuma delas. " +
      "Essas condutas são o EIXO do plano: cada uma EVOLUI pelas fases (ex.: mobilização neural — deslizamento → tensionamento → " +
      "integração no gesto; músculo liberado → alongamento ativo/controle motor → força e gesto; segmento vertebral mobilizado → " +
      "estabilização segmentar → tolerância a carga). Avaliações pedidas (\"avaliar…\") entram no início com o teste a usar. " +
      "Depois, COMPLETE com o que a literatura recomenda para o caso.");
  }
  if (!partes.length) return "";
  return `\nAVALIAÇÃO PRESENCIAL (achados e observações do profissional — ${instrucaoPresencial(foco)}):\n${partes.join("\n")}`;
}

// Texto do que o CLIENTE declarou (queixa, história atual, condições): é o que o plano do
// cliente usa no lugar da avaliação presencial do profissional.
export function textoQueixaDoCliente(m: MotoresClinicos): string {
  const partes: string[] = [];
  if (m.queixa) partes.push(`Queixa principal: ${String(m.queixa).slice(0, 300)}`);
  if (m.historia) partes.push(`História atual: ${String(m.historia).slice(0, 400)}`);
  if (m.condicoes) partes.push(`Condições de saúde: ${String(m.condicoes).slice(0, 300)}`);
  if (!partes.length) return "";
  return `\nQUEIXA E HISTÓRIA INFORMADAS PELO CLIENTE (adapte o plano a elas e seja conservador onde houver dor ou limitação):\n${partes.join("\n")}`;
}

// Resultado completo do MyID (component_scores, MyID_score, perdas_calculadas,
// myid_100…), com fallback para o formato importado do app antigo, que fica em
// avaliacoes_identidade.myid_analysis. Retorna o objeto no formato canônico.
export async function carregarResultadoMyid(admin: SB, pacienteId: string): Promise<SB | null> {
  if (!pacienteId) return null;
  const my = await admin.from("myid_avaliacoes").select("resultado_processado")
    .eq("paciente_id", pacienteId).eq("status", "concluido")
    .order("updated_at", { ascending: false }).limit(1).maybeSingle()
    .then((r: SB) => r).catch(() => ({ data: null }));
  const rp = (my?.data?.resultado_processado as SB) || null;
  if (rp && (rp.scores || rp.component_scores || rp.componentScores)) return rp;
  // Fallback: MyID importado (avaliacoes_identidade). O myid_analysis do app
  // antigo já vem no formato canônico (com component_scores, MyID_score, etc.).
  const ai = await admin.from("avaliacoes_identidade").select("myid_analysis, myid_score")
    .eq("paciente_id", pacienteId).order("created_at", { ascending: false }).limit(1).maybeSingle()
    .then((r: SB) => r).catch(() => ({ data: null }));
  const an = (ai?.data?.myid_analysis as SB) || null;
  if (an && typeof an === "object") {
    return { ...an, MyID_score: an.MyID_score ?? an.myidScore ?? ai?.data?.myid_score };
  }
  return rp || null;
}

// Scores do MyID por dimensão, com o mesmo fallback. Para funções que só
// precisam dos scores (as diretrizes de treino/nutrição, dicas).
export async function carregarScoresMyid(admin: SB, pacienteId: string): Promise<unknown | null> {
  const r = await carregarResultadoMyid(admin, pacienteId) as SB;
  return r ? (r.scores || r.component_scores || r.componentScores || null) : null;
}

// SÓ os achados anatômicos do avatar + observações do profissional — para
// funções que já trazem queixa/história à parte (as diretrizes por lente).
export async function carregarAchadosPresenciais(admin: SB, pacienteId: string): Promise<AchadoPresencial[]> {
  if (!pacienteId) return [];
  const res = await admin.from("eventos_clinicos_anatomicos")
    .select("regiao_id, sistema, tipo_achado, estrutura, diagnostico_cid, severidade, status, notas_clinicas")
    .eq("paciente_id", pacienteId).neq("status", "resolvido").limit(30)
    .then((r: SB) => r).catch(() => ({ data: [] }));
  return ((res?.data as SB[]) || []).map((e: SB) => ({
    regiao_id: e.regiao_id ?? null,
    sistema: e.sistema ?? null,
    tipo_achado: e.tipo_achado ?? null,
    estrutura: e.estrutura ?? null,
    diagnostico_cid: e.diagnostico_cid ?? null,
    severidade: e.severidade ?? null,
    status: e.status ?? null,
    notas_clinicas: e.notas_clinicas ?? null,
  }));
}

export function textoAchadosPresenciais(achados: AchadoPresencial[], foco: FocoPlano): string {
  if (!achados.length) return "";
  return `\nAVALIAÇÃO PRESENCIAL — achados no avatar clínico e observações do profissional (${instrucaoPresencial(foco)}):\n${formatAchados(achados)}`;
}

// Texto compacto dos questionários clínicos validados (PAR-Q+, PSFS, START Back,
// ISI, PHQ-4...). `foco` acrescenta a instrução de uso conforme o plano.
export function textoQuestionarios(m: MotoresClinicos, foco: FocoPlano): string {
  if (!m.questionarios.length) return "";
  const linhas = m.questionarios.map((q) => {
    const metas = Array.isArray(q.respostas?.atividades)
      ? ` — metas do paciente: ${q.respostas.atividades.map((a: SB) => `${a.nome} (${a.nota}/10)`).join(", ")}`
      : "";
    return `${String(q.instrumento).toUpperCase()}: escore ${q.escore}, ${q.classificacao}${metas}`;
  }).join("\n");
  const instrucao = foco === "treino"
    ? "PARQ requer_atencao = plano CONSERVADOR e alerta para avaliação presencial antes de intensificar; SBST alto_risco = abordagem biopsicossocial e progressão cautelosa; PSFS = use as metas do paciente como objetivos do plano; ISI/PHQ4 alterados = considere sono/estresse na periodização"
    : foco === "nutricao"
      ? "ISI alterado (sono ruim) = cuide de cafeína/horário das refeições e ceia leve; PHQ4 alterado (humor/estresse) = evite restrição agressiva, priorize aderência; PARQ requer_atencao = mantenha conduta nutricional conservadora e dentro do escopo"
      : "use os escores validados na conduta e nas metas; PHQ4/PHQ9/GAD7 alterados = atenção a humor/ansiedade e possível encaminhamento; respeite o escopo da sua profissão";
  return `\nQUESTIONÁRIOS CLÍNICOS VALIDADOS (respeite — ${instrucao}):\n${linhas}`;
}

// Texto do MyID (motor 1). `foco` muda a instrução de priorização.
export function textoMyID(m: MotoresClinicos, foco: FocoPlano): string {
  if (!m.scores) return "";
  const instrucao = foco === "treino"
    ? "Priorize exercícios que atendam às dimensões mais críticas do paciente."
    : foco === "nutricao"
      ? "Ajuste macros, alimentos e orientações às dimensões mais críticas (ex.: inflamação, metabólico, sono)."
      : "Priorize a conduta e as fases nas dimensões mais críticas do paciente.";
  return `\nPerfil MyID (scores por dimensão): ${JSON.stringify(m.scores)}. ${instrucao}`;
}

// ── Textos legíveis dos campos jsonb do paciente ──────────────────────────

const ROTULOS_HISTORIA: [string, string][] = [
  ["queixa", "Queixa"],
  ["inicio", "Início"],
  ["fatores", "Fatores que pioram ou aliviam"],
  ["impacto", "Impacto no dia a dia"],
];

// pacientes.historia_atual é jsonb {queixa, inicio, fatores, impacto}: String(obj)
// virava "[object Object]" no prompt.
export function textoHistoriaAtual(h: unknown): string {
  if (h === null || h === undefined) return "";
  if (typeof h === "string") return h.trim();
  const o = objetoOuNulo(h);
  if (!o) return "";
  const partes: string[] = [];
  const usadas = new Set<string>(["atualizado_em"]);
  for (const [chave, rotulo] of ROTULOS_HISTORIA) {
    usadas.add(chave);
    const v = o[chave];
    if (typeof v === "string" && v.trim()) partes.push(`${rotulo}: ${v.trim()}`);
  }
  for (const [chave, v] of Object.entries(o)) {
    if (usadas.has(chave)) continue;
    if (typeof v === "string" && v.trim()) partes.push(`${chave}: ${v.trim()}`);
  }
  return partes.join("; ");
}

function listaTexto(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];
}

// Resumo do histórico clínico declarado pelo paciente (HistoricoClinicoCard).
// O histórico familiar fica de fora de propósito: é sobre parentes.
export function textoHistoricoClinico(h: unknown): string {
  const raiz = objetoOuNulo(h);
  if (!raiz) return "";
  const partes: string[] = [];
  const doencas = objetoOuNulo(raiz.doencas_cronicas);
  if (doencas) {
    const lista = [...listaTexto(doencas.condicoes), ...(typeof doencas.detalhes === "string" && doencas.detalhes.trim() ? [doencas.detalhes.trim()] : [])];
    if (lista.length) partes.push(`doenças crônicas: ${lista.join(", ")}`);
  }
  const cirurgias = objetoOuNulo(raiz.cirurgias);
  if (cirurgias && Array.isArray(cirurgias.items)) {
    const lista = cirurgias.items
      .map((it) => objetoOuNulo(it))
      .filter((it): it is Record<string, unknown> => !!it && typeof it.tipo === "string" && !!String(it.tipo).trim())
      .map((it) => `${String(it.tipo).trim()}${it.ano ? ` (${String(it.ano)})` : ""}`);
    if (lista.length) partes.push(`cirurgias: ${lista.join(", ")}`);
  }
  const meds = objetoOuNulo(raiz.medicamentos);
  if (meds && Array.isArray(meds.items)) {
    const lista = meds.items
      .map((it) => objetoOuNulo(it))
      .filter((it): it is Record<string, unknown> => !!it && typeof it.nome === "string" && !!String(it.nome).trim())
      .map((it) => String(it.nome).trim());
    if (lista.length) partes.push(`medicamentos: ${lista.join(", ")}`);
  }
  const mental = objetoOuNulo(raiz.saude_mental);
  if (mental) {
    const lista = listaTexto(mental.condicoes);
    if (lista.length) partes.push(`saúde mental: ${lista.join(", ")}`);
  }
  const alerg = objetoOuNulo(raiz.alergias);
  if (alerg) {
    const lista = [alerg.medicamentos, alerg.alimentos, alerg.outros].filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim());
    if (lista.length) partes.push(`alergias: ${lista.join("; ")}`);
  }
  return partes.join("; ").slice(0, 900);
}

const ROTULO_RESPOSTA_TRIAGEM: Record<string, string> = { sim: "sim", nao: "não", nao_sei: "não sei", prefiro_nao_dizer: "prefiro não dizer" };
const PERGUNTAS_TRIAGEM_TEXTO: [string, string][] = [
  ["gestante_lactante", "gestação ou amamentação"],
  ["transtorno_alimentar", "histórico de transtorno alimentar"],
  ["doenca_renal", "doença renal"],
  ["diabetes_insulina", "diabetes ou uso de insulina"],
  ["cardio_pressao", "problema de coração ou pressão alta"],
  ["cirurgia_lesao_recente", "cirurgia ou lesão recente"],
];

// Ficha clínica extra para os prompts de plano: o que o paciente declarou e que
// antes não chegava à IA (medicamentos, alergias, histórico clínico, triagem).
export function textoFichaClinica(m: MotoresClinicos): string {
  const partes: string[] = [];
  if (m.medicamentos) partes.push(`Medicamentos em uso: ${m.medicamentos.slice(0, 300)}`);
  if (m.alergias) partes.push(`Alergias cadastradas: ${m.alergias.slice(0, 300)}`);
  const hist = textoHistoricoClinico(m.historicoClinico);
  if (hist) partes.push(`Histórico clínico declarado pelo paciente: ${hist}`);
  const tri = m.triagemAutodeclarada;
  if (tri) {
    const respostas = PERGUNTAS_TRIAGEM_TEXTO
      .map(([k, rotulo]) => {
        const v = typeof tri[k] === "string" ? String(tri[k]) : "";
        return v ? `${rotulo}: ${ROTULO_RESPOSTA_TRIAGEM[v] || v}` : "";
      })
      .filter(Boolean);
    if (respostas.length) partes.push(`Triagem de segurança autodeclarada — ${respostas.join("; ")}`);
  }
  if (!partes.length) return "";
  return `\nFICHA CLÍNICA DECLARADA (respeite estas condições no plano):\n${partes.join("\n")}`;
}

const ORDEM_ANAMNESE = [
  "restricoes_alergias", "aversoes", "preferencias", "objetivo", "nivel_atividade",
  "refeicoes_por_dia", "rotina", "peso_kg", "altura_cm", "idade", "sexo", "imc",
];

// Anamnese nutricional em texto, com restrições/alergias SEMPRE primeiro. Antes
// era JSON.stringify(...).slice(0, 800), que cortava restricoes_alergias — a
// parte mais importante — quando as respostas anteriores eram longas.
export function textoAnamneseNutricional(respostas: Record<string, unknown> | null | undefined, max = 1800): string {
  const o = objetoOuNulo(respostas);
  if (!o) return "";
  const chaves = [...ORDEM_ANAMNESE.filter((k) => k in o), ...Object.keys(o).filter((k) => !ORDEM_ANAMNESE.includes(k) && k !== "triagem")];
  const linhas: string[] = [];
  for (const k of chaves) {
    const v = o[k];
    if (typeof v !== "string" && typeof v !== "number") continue;
    const t = String(v).trim();
    if (!t) continue;
    linhas.push(`${k}: ${t.slice(0, k === "restricoes_alergias" ? 700 : 350)}`);
  }
  return linhas.join("; ").slice(0, max);
}

// ── Entrada da triagem de segurança ───────────────────────────────────────

function idadeDeTexto(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export interface ParametrosEntradaTriagem {
  foco: FocoTriagem;
  chamador: ChamadorTriagem;
  /** null quando não há paciente (profissional gerando sem paciente_id). */
  motores: MotoresClinicos | null;
  /** body.idade do pedido (digitada ou calculada pelo front: nunca é a fonte da verdade). */
  idadeBody?: unknown;
  /** Textos livres do pedido (restrições, preferências, objetivo). */
  textosPedido?: unknown[];
  agora?: Date;
}

export function montarEntradaTriagem(a: ParametrosEntradaTriagem): EntradaTriagem {
  const m = a.motores;
  const textos: string[] = [];
  const empurra = (v: unknown) => { if (typeof v === "string" && v.trim()) textos.push(v); };

  if (m) {
    empurra(m.queixa);
    empurra(m.historia);
    empurra(m.condicoes);
    empurra(m.medicamentos);
    // Aversões e preferências são gosto alimentar ("coração de galinha"), não condição clínica.
    for (const [k, v] of Object.entries(m.anamnese ?? {})) {
      if (k !== "triagem" && k !== "aversoes" && k !== "preferencias") empurra(v);
    }
    for (const e of m.presencial) {
      empurra(e.tipo_achado);
      empurra(e.notas_clinicas);
    }
    empurra(formatAvaliacaoVoz(m.avaliacaoVoz as SB));
  }
  (a.textosPedido ?? []).forEach(empurra);

  const idadeDb = m?.paciente.idade ?? null;
  // A idade digitada só entra quando o cadastro não tem data de nascimento, ou
  // quando quem chama é o cliente (que poderia digitar uma idade maior). Para o
  // profissional com data cadastrada, o cadastro vale: a idade calculada pelo
  // front por 365,25 dias pode errar por um ano perto do aniversário.
  // Com data de nascimento cadastrada, ela decide sozinha: a idade da anamnese
  // fica velha (não acompanha aniversário) e a do body pode vir arredondada.
  const candidatas = [a.idadeBody, m?.anamnese?.idade].map(idadeDeTexto).filter((n): n is number => n !== null);
  const idadeInformada = candidatas.length && idadeDb === null ? Math.min(...candidatas) : null;

  return {
    foco: a.foco,
    idade: idadeDb,
    idadeInformada,
    textos,
    historicoClinico: m?.historicoClinico ?? null,
    triagemAutodeclarada: m?.triagemAutodeclarada ?? null,
    parq: m?.parq ?? null,
    myidRedFlags: !!m?.myidRedFlags,
    avaliacaoRedFlags: !!m?.avaliacaoRedFlags,
    chamador: a.chamador,
    falhasLeitura: m?.falhasLeitura ?? [],
    agora: a.agora,
  };
}

// ── Quem está gerando (entitlement e papel) ───────────────────────────────

export interface PacienteAlvo {
  id: string;
  user_id: string | null;
  terapeuta_id: string | null;
  tipo_conta: string | null;
  created_at: string | null;
}

// Formato "plano" (sem união discriminada) para funcionar também no tsc não-estrito do front.
export interface ContextoGeracao {
  ok: boolean;
  /** Preenchidos quando ok. */
  pacienteId?: string | null;
  chamador?: ChamadorTriagem;
  relacao?: string;
  paciente?: PacienteAlvo | null;
  /** Preenchidos quando !ok. */
  status?: number;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLUNAS_ALVO = "id, user_id, terapeuta_id, tipo_conta, created_at";
const ERRO_VERIFICACAO = "Não consegui verificar o paciente agora. Tente novamente em instantes.";

/**
 * Descobre, a partir do JWT e do banco (nunca do body), quem está gerando o
 * plano: o próprio cliente ou um profissional. Sem paciente_id, o cliente usa o
 * próprio cadastro. Fail-closed: erro de leitura ou falta de vínculo recusa.
 */
export async function resolverContextoGeracao(admin: SB, userId: string, pacienteIdBody: unknown): Promise<ContextoGeracao> {
  const bruto = pacienteIdBody === undefined || pacienteIdBody === null ? "" : String(pacienteIdBody).trim();
  const informado = bruto !== "";
  if (informado && !UUID.test(bruto)) return { ok: false, status: 400, error: "paciente_id inválido." };

  let alvo: PacienteAlvo | null = null;
  try {
    const q = admin.from("pacientes").select(COLUNAS_ALVO);
    const r = informado
      ? await q.eq("id", bruto).maybeSingle()
      : await q.eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (r.error) return { ok: false, status: 503, error: ERRO_VERIFICACAO };
    alvo = (r.data as PacienteAlvo | null) ?? null;
  } catch (_e) {
    return { ok: false, status: 503, error: ERRO_VERIFICACAO };
  }

  // Perfil profissional = habilitação confirmada OU perfil profissional escolhido no
  // cadastro (hoje nenhum profissional da base tem a confirmação marcada; exigir só
  // ela travaria todos). Ser terapeuta_id de um cadastro qualquer, sozinho, não basta.
  // Endurecer para só "confirmado" quando os profissionais confirmarem o perfil.
  let temPerfilProfissional = false;
  const ehProprioPaciente = !!alvo && alvo.user_id === userId;
  if (!ehProprioPaciente) {
    try {
      const p = await admin.from("profiles").select("user_id, perfil_profissional_confirmado, perfil_profissional").eq("user_id", userId).limit(1).maybeSingle();
      if (p.error) return { ok: false, status: 503, error: ERRO_VERIFICACAO };
      temPerfilProfissional = p.data?.perfil_profissional_confirmado === true || (typeof p.data?.perfil_profissional === "string" && p.data.perfil_profissional.trim() !== "");
    } catch (_e) {
      return { ok: false, status: 503, error: ERRO_VERIFICACAO };
    }
  }

  const c = classificarChamador({ userId, pacienteIdInformado: informado, pacienteAlvo: alvo, temPerfilProfissional });
  if (!c.ok || !c.chamador) return { ok: false, status: c.status ?? 403, error: c.erro ?? "Sem permissão." };
  return { ok: true, pacienteId: alvo?.id ?? null, chamador: c.chamador, relacao: c.relacao ?? "", paciente: alvo };
}

/**
 * Entitlement do CLIENTE gerando o próprio plano: só quem paga (hoje wellness_premium; ver
 * POLITICA_PLANO_CLIENTE em plano-cliente.ts). O teste grátis de 7 dias não vale mais.
 */
export function clientePodeGerar(pac: { tipo_conta?: string | null } | null): boolean {
  return contaPodeGerarPlano(pac?.tipo_conta);
}

/**
 * Insumos realmente presentes, para o registro de governança. A anamnese
 * nutricional só conta como insumo do plano alimentar: o treino não a usa.
 */
export function insumosDosMotores(m: MotoresClinicos | null, foco: FocoTriagem): string[] {
  if (!m) return [];
  const ins: string[] = [];
  if (m.scores) ins.push("MyID");
  if (m.questionarios.length) ins.push("questionarios");
  if (m.presencial.length || m.exames.length || formatAvaliacaoVoz(m.avaliacaoVoz as SB)) ins.push("avaliacao_presencial");
  if (foco === "nutricao" && textoAnamneseNutricional(m.anamnese)) ins.push("anamnese");
  if (textoFichaClinica(m)) ins.push("historico_clinico");
  if (m.queixa || m.historia || m.condicoes) ins.push("queixa_historia_atual");
  return ins;
}
