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

export interface MotoresClinicos {
  // Motor 1 — MyID (impressão digital sistêmica)
  scores: unknown | null;
  // Motor 3 — avaliação presencial: queixa/história/condições + achados do avatar
  queixa: string | null;
  historia: string | null;
  condicoes: unknown | null;
  presencial: AchadoPresencial[];
  // Motor 2 — questionários clínicos validados respondidos (o "extra")
  questionarios: QuestionarioClinico[];
}

// Carrega os três motores para um paciente. Tolerante a tabelas/colunas
// ausentes — cada peça que falhar volta vazia, sem derrubar a geração.
export async function carregarMotoresClinicos(admin: SB, pacienteId: string): Promise<MotoresClinicos> {
  const vazio: MotoresClinicos = { scores: null, queixa: null, historia: null, condicoes: null, presencial: [], questionarios: [] };
  if (!pacienteId) return vazio;

  const [myRes, pacRes, evRes, questRes] = await Promise.all([
    admin.from("myid_avaliacoes").select("resultado_processado")
      .eq("paciente_id", pacienteId).eq("status", "concluido")
      .order("updated_at", { ascending: false }).limit(1).maybeSingle()
      .then((r: SB) => r).catch(() => ({ data: null })),
    admin.from("pacientes").select("queixa_principal, historia_atual, condicoes_saude")
      .eq("id", pacienteId).maybeSingle()
      .then((r: SB) => r).catch(() => ({ data: null })),
    admin.from("eventos_clinicos_anatomicos")
      .select("regiao_id, sistema, tipo_achado, estrutura, diagnostico_cid, severidade, status, notas_clinicas")
      .eq("paciente_id", pacienteId).neq("status", "resolvido").limit(30)
      .then((r: SB) => r).catch(() => ({ data: [] })),
    admin.from("questionarios_clinicos")
      .select("instrumento, escore, classificacao, respostas, created_at")
      .eq("paciente_id", pacienteId).order("created_at", { ascending: false }).limit(20)
      .then((r: SB) => r).catch(() => ({ data: [] })),
  ]);

  // MyID: o formato variou entre gerações (component_scores atual, componentScores, scores).
  const rp = (myRes?.data?.resultado_processado as SB) || null;
  const scores = rp ? (rp.scores || rp.component_scores || rp.componentScores || null) : null;

  const pac = (pacRes?.data as SB) || null;

  // Só o achado mais recente de cada instrumento (a lista vem ordenada desc).
  const ultQuest = new Map<string, QuestionarioClinico>();
  ((questRes?.data as SB[]) || []).forEach((q: SB) => {
    if (q?.instrumento && !ultQuest.has(q.instrumento)) {
      ultQuest.set(q.instrumento, { instrumento: q.instrumento, escore: q.escore ?? null, classificacao: q.classificacao ?? null, respostas: q.respostas });
    }
  });

  return {
    scores,
    queixa: pac?.queixa_principal ?? null,
    historia: pac?.historia_atual ?? null,
    condicoes: pac?.condicoes_saude ?? null,
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
    questionarios: [...ultQuest.values()],
  };
}

// Formata os achados anatômicos da avaliação presencial (avatar clínico) +
// as observações (notas_clinicas) do profissional numa linha compacta.
function formatAchados(presencial: AchadoPresencial[]): string {
  return presencial.map((e) => {
    const det = [
      e.tipo_achado,
      e.estrutura ? `estrutura ${e.estrutura}` : null,
      e.regiao_id ? `região ${e.regiao_id}` : null,
      e.diagnostico_cid ? `CID ${e.diagnostico_cid}` : null,
      e.severidade != null ? `severidade ${e.severidade}` : null,
    ].filter(Boolean).join(", ");
    const nota = e.notas_clinicas ? ` — obs. do profissional: "${String(e.notas_clinicas).slice(0, 200)}"` : "";
    return `${det}${nota}`;
  }).join("; ");
}

function instrucaoPresencial(foco: "treino" | "nutricao"): string {
  return foco === "treino"
    ? "trate como PRIORIDADE clínica: evite sobrecarregar regiões com achados ativos, inclua trabalho específico/terapêutico onde indicado, respeite as observações do profissional e progrida com cautela nessas áreas"
    : "considere no plano alimentar: padrão anti-inflamatório onde houver dor/lesão ativa, ajuste para as comorbidades e respeite as observações do profissional";
}

// Texto compacto da avaliação presencial (queixa/história/condições + achados
// do avatar + observações do profissional). `foco` muda só a instrução de uso.
export function textoPresencial(m: MotoresClinicos, foco: "treino" | "nutricao"): string {
  const partes: string[] = [];
  if (m.queixa) partes.push(`Queixa principal: ${String(m.queixa).slice(0, 300)}`);
  if (m.historia) partes.push(`História atual: ${String(m.historia).slice(0, 400)}`);
  if (m.condicoes) partes.push(`Condições de saúde: ${JSON.stringify(m.condicoes).slice(0, 300)}`);
  if (m.presencial.length) {
    partes.push(`Achados registrados na avaliação presencial (avatar clínico): ${formatAchados(m.presencial)}`);
  }
  if (!partes.length) return "";
  return `\nAVALIAÇÃO PRESENCIAL (achados e observações do profissional — ${instrucaoPresencial(foco)}):\n${partes.join("\n")}`;
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

export function textoAchadosPresenciais(achados: AchadoPresencial[], foco: "treino" | "nutricao"): string {
  if (!achados.length) return "";
  return `\nAVALIAÇÃO PRESENCIAL — achados no avatar clínico e observações do profissional (${instrucaoPresencial(foco)}):\n${formatAchados(achados)}`;
}

// Texto compacto dos questionários clínicos validados (PAR-Q+, PSFS, START Back,
// ISI, PHQ-4...). `foco` acrescenta a instrução de uso conforme o plano.
export function textoQuestionarios(m: MotoresClinicos, foco: "treino" | "nutricao"): string {
  if (!m.questionarios.length) return "";
  const linhas = m.questionarios.map((q) => {
    const metas = Array.isArray(q.respostas?.atividades)
      ? ` — metas do paciente: ${q.respostas.atividades.map((a: SB) => `${a.nome} (${a.nota}/10)`).join(", ")}`
      : "";
    return `${String(q.instrumento).toUpperCase()}: escore ${q.escore}, ${q.classificacao}${metas}`;
  }).join("\n");
  const instrucao = foco === "treino"
    ? "PARQ requer_atencao = plano CONSERVADOR e alerta para avaliação presencial antes de intensificar; SBST alto_risco = abordagem biopsicossocial e progressão cautelosa; PSFS = use as metas do paciente como objetivos do plano; ISI/PHQ4 alterados = considere sono/estresse na periodização"
    : "ISI alterado (sono ruim) = cuide de cafeína/horário das refeições e ceia leve; PHQ4 alterado (humor/estresse) = evite restrição agressiva, priorize aderência; PARQ requer_atencao = mantenha conduta nutricional conservadora e dentro do escopo";
  return `\nQUESTIONÁRIOS CLÍNICOS VALIDADOS (respeite — ${instrucao}):\n${linhas}`;
}

// Texto do MyID (motor 1). `foco` muda a instrução de priorização.
export function textoMyID(m: MotoresClinicos, foco: "treino" | "nutricao"): string {
  if (!m.scores) return "";
  const instrucao = foco === "treino"
    ? "Priorize exercícios que atendam às dimensões mais críticas do paciente."
    : "Ajuste macros, alimentos e orientações às dimensões mais críticas (ex.: inflamação, metabólico, sono).";
  return `\nPerfil MyID (scores por dimensão): ${JSON.stringify(m.scores)}. ${instrucao}`;
}
