// TRIAGEM DE SEGURANÇA antes de gerar plano de treino ou alimentar por IA.
//
// Lógica PURA (sem Deno, sem rede, sem banco): recebe os dados que a edge function
// já carregou e devolve se o plano pode ser gerado, precisa de confirmação do
// profissional ou está bloqueado. Fica separada para ser testada com vitest.
//
// As regras abaixo são PROVISÓRIAS: foram escritas como ponto de partida e devem
// ser validadas pelos profissionais (educação física, nutrição, medicina) e pelo
// Rafael antes de serem tratadas como definitivas. Para mudar uma regra, edite
// TRIAGEM_REGRAS — veja docs/triagem-planos.md.
//
// Princípio: falso negativo é risco de saúde. Em dúvida, o resultado é
// 'confirmar' (a pessoa que decide é um profissional), nunca 'liberado'.

export type NivelTriagem = "liberado" | "confirmar" | "bloqueia";
export type FocoTriagem = "treino" | "nutricao";
export type ChamadorTriagem = "profissional" | "cliente";

export interface MotivoTriagem {
  codigo: string;
  rotulo: string;
  detalhe: string;
  origem: string;
  nivel: "confirmar" | "bloqueia";
}

export interface EntradaTriagem {
  foco: FocoTriagem;
  /** Idade em anos calculada da data de nascimento cadastrada (fonte confiável). */
  idade: number | null;
  /** Textos livres do cadastro/prontuário/anamnese/pedido, varridos por palavra-chave. */
  textos: string[];
  /** pacientes.historico_clinico (jsonb do HistoricoClinicoCard). */
  historicoClinico: unknown;
  /** nutricao_anamnese.respostas.triagem (autodeclaração do cliente). */
  triagemAutodeclarada: Record<string, unknown> | null;
  parq: { classificacao: string | null; respostas: unknown } | null;
  myidRedFlags: boolean;
  /** Red flags registrados pelo profissional na avaliação presencial/voz. */
  avaliacaoRedFlags?: boolean;
  chamador: ChamadorTriagem;
  /** Idade digitada pelo usuário (sem data de nascimento). Só pode BLOQUEAR, nunca
   *  libera: um menor poderia digitar 30 e passar. */
  idadeInformada?: number | null;
  /** Fontes de dados que falharam ao carregar (fail-closed: contam como dado ausente). */
  falhasLeitura?: string[];
  /** Relógio injetável para testes. */
  agora?: Date;
}

export interface ResultadoTriagem {
  nivel: NivelTriagem;
  motivos: MotivoTriagem[];
  dadosAusentes: string[];
}

export type CodigoCondicao =
  | "menor_de_idade"
  | "idoso"
  | "gestante_lactante"
  | "transtorno_alimentar"
  | "doenca_renal"
  | "diabetes"
  | "diabetes_insulina"
  | "cardio_pressao"
  | "cirurgia_lesao_recente"
  | "cirurgia_bariatrica"
  | "parq_atencao"
  | "myid_red_flags"
  | "avaliacao_red_flags";

type NivelRegra = "confirmar" | "bloqueia";

// REGRAS PROVISÓRIAS — a validar por profissionais. Um código que não aparece na
// lista do foco simplesmente não é aplicado àquele foco.
export const TRIAGEM_REGRAS = {
  /** Abaixo desta idade (anos) a pessoa é tratada como criança/adolescente. */
  idadeMenorDe: 18,
  /** A partir desta idade (anos) a pessoa é tratada como idosa. */
  idadeIdosoMinima: 65,
  /** Cirurgia registrada no histórico clínico com ano >= (ano atual - janela) conta como recente. */
  cirurgiaRecenteJanelaAnos: 1,
  /** Tamanho mínimo da justificativa do profissional para sobrepor um bloqueio. */
  justificativaMinCaracteres: 15,
  niveis: {
    treino: {
      menor_de_idade: "bloqueia",
      gestante_lactante: "bloqueia",
      transtorno_alimentar: "confirmar",
      idoso: "confirmar",
      parq_atencao: "confirmar",
      doenca_renal: "confirmar",
      diabetes_insulina: "confirmar",
      cardio_pressao: "confirmar",
      cirurgia_lesao_recente: "confirmar",
      myid_red_flags: "confirmar",
      avaliacao_red_flags: "confirmar",
    },
    nutricao: {
      menor_de_idade: "bloqueia",
      gestante_lactante: "bloqueia",
      transtorno_alimentar: "bloqueia",
      doenca_renal: "bloqueia",
      diabetes: "confirmar",
      idoso: "confirmar",
      cardio_pressao: "confirmar",
      cirurgia_bariatrica: "confirmar",
      myid_red_flags: "confirmar",
      avaliacao_red_flags: "confirmar",
    },
  } as Record<FocoTriagem, Partial<Record<CodigoCondicao, NivelRegra>>>,
};

const ORDEM_CODIGOS: CodigoCondicao[] = [
  "menor_de_idade", "gestante_lactante", "transtorno_alimentar", "doenca_renal",
  "diabetes_insulina", "diabetes", "cardio_pressao", "cirurgia_lesao_recente",
  "cirurgia_bariatrica", "parq_atencao", "myid_red_flags", "avaliacao_red_flags", "idoso",
];

function rotuloCondicao(codigo: CodigoCondicao): string {
  switch (codigo) {
    case "menor_de_idade": return `Menor de ${TRIAGEM_REGRAS.idadeMenorDe} anos`;
    case "idoso": return `Pessoa idosa (${TRIAGEM_REGRAS.idadeIdosoMinima} anos ou mais)`;
    case "gestante_lactante": return "Gestação ou amamentação";
    case "transtorno_alimentar": return "Histórico de transtorno alimentar";
    case "doenca_renal": return "Doença renal";
    case "diabetes": return "Diabetes";
    case "diabetes_insulina": return "Diabetes com insulina ou medicamento hipoglicemiante";
    case "cardio_pressao": return "Problema de coração ou pressão alta";
    case "cirurgia_lesao_recente": return "Cirurgia ou lesão recente";
    case "cirurgia_bariatrica": return "Cirurgia bariátrica";
    case "parq_atencao": return "PAR-Q+ com sinal de atenção";
    case "myid_red_flags": return "Sinais de alerta no MyID";
    case "avaliacao_red_flags": return "Sinais de alerta na avaliação presencial";
  }
}

export const DADO_AUSENTE = {
  idade: "idade",
  triagem: "triagem_autodeclarada",
  leitura: "leitura_dados",
} as const;

/** Respostas aceitas em cada pergunta da triagem autodeclarada. */
export const RESPOSTAS_TRIAGEM = {
  gestante_lactante: ["sim", "nao", "nao_sei"],
  transtorno_alimentar: ["sim", "nao", "prefiro_nao_dizer"],
  doenca_renal: ["sim", "nao", "nao_sei"],
  diabetes_insulina: ["sim", "nao", "nao_sei"],
  cardio_pressao: ["sim", "nao", "nao_sei"],
  cirurgia_lesao_recente: ["sim", "nao"],
} as const;
export type ChavePerguntaTriagem = keyof typeof RESPOSTAS_TRIAGEM;
const CHAVES_PERGUNTAS = Object.keys(RESPOSTAS_TRIAGEM) as ChavePerguntaTriagem[];

// ── Utilitários ────────────────────────────────────────────────────────────

/** Minúsculas, sem acento, só letras/dígitos separados por espaço simples. */
export function normalizarTexto(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Idade exata em anos. Usa a data de hoje em Brasília (UTC-3, o fuso mais
 * atrasado do Brasil continental) para nunca contar um aniversário antes da hora
 * — o erro para menos é o lado seguro nos limiares de menor de idade.
 * Devolve null para data ausente, inválida ou futura.
 */
export function idadeEmAnos(nascimento: string | null | undefined, hoje: Date = new Date()): number | null {
  if (!nascimento) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(nascimento));
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const br = new Date(hoje.getTime() - 3 * 3600 * 1000);
  const mesHoje = br.getUTCMonth() + 1;
  let idade = br.getUTCFullYear() - ano;
  if (mesHoje < mes || (mesHoje === mes && br.getUTCDate() < dia)) idade--;
  return idade >= 0 ? idade : null;
}

// ── Detecção por palavra-chave (texto já normalizado, sem acento) ─────────

interface PadraoTexto {
  codigo: CodigoCondicao;
  regex: RegExp;
  /** Quando casa, também indica diabetes (ex.: uso de insulina implica diabetes). */
  implicaDiabetes?: boolean;
}

const PADROES_TEXTO: PadraoTexto[] = [
  {
    codigo: "gestante_lactante",
    regex: /\b(gestante|gestantes|gravida|gravidas|gravidez|gestacao|gestacional|gestando|esperando (?:um )?bebe|dando (?:mama|peito)|lactante|lactantes|lactacao|amamentando|amamentacao|amamento|puerpera|puerperio|pos parto|posparto)\b/g,
  },
  {
    codigo: "transtorno_alimentar",
    regex: /\b(anorexia|bulimia|compulsao alimentar|transtorno alimentar|transtornos alimentares|tca|ortorexia|binge|purgacao|vomito induzido|induz(?:ir|o|ido)? (?:o )?vomito|vomit(?:a|o) (?:depois|apos))\b/g,
  },
  {
    codigo: "doenca_renal",
    regex: /\b(renal|renais|irc|drc|hemodialise|dialise|dialitico|nefropatia|nefrite|problemas? (?:nos|no|de) rins?|doenca (?:nos|do|dos) rins?|insuficiencia (?:nos|dos) rins|rins? (?:policistico|so))\b/g,
  },
  {
    codigo: "diabetes_insulina",
    regex: /\b(insulina|insulinodependente|hipoglicemiante|hipoglicemiantes|antidiabetico|antidiabeticos|metformina|glibenclamida|gliclazida|glimepirida)\b/g,
    implicaDiabetes: true,
  },
  {
    codigo: "diabetes",
    regex: /\b(diabetes|diabetico|diabetica|dm ?1|dm ?2|prediabetes)\b/g,
  },
  {
    codigo: "cardio_pressao",
    regex: /\b(hipertensao|hipertenso|hipertensa|pressao alta|pressao arterial alta|cardiopatia|cardiopata|cardiaco|cardiaca|cardiovascular|(?:problema|problemas|doenca|doencas|sopro|falha) (?:no|do|de) coracao|infarto|angina|arritmia|marca ?passo|stent|avc)\b/g,
  },
  {
    codigo: "cirurgia_lesao_recente",
    regex: /\b(cirurgia recente|pos operatorio|pos cirurgico|pos cirurgia|recem operad[oa]|operad[oa] recentemente|fratura recente|lesao recente|lesao aguda|entorse recente|luxacao recente|ruptura recente)\b/g,
  },
  {
    codigo: "cirurgia_bariatrica",
    regex: /\b(bariatrica|bariatrico|gastroplastia|bypass gastrico|by pass gastrico|sleeve|gastrectomia|banda gastrica|derivacao gastrica|reducao de estomago)\b/g,
  },
];

// Negação curta e explícita imediatamente antes do termo ("nega gestação",
// "não estou grávida", "sem uso de insulina"). "Não sei se estou grávida" NÃO é
// negação: continua contando como menção.
const NEGACAO_ANTES =
  /(?:^|\s)(?:nao|nem|nega|negou|nego|sem|nunca|ausencia de|descarta|descartou)\s+(?:(?:tenho|tem|tive|teve|estou|esta|estava|ha|possui|possuo|apresenta|faco|uso|usa|usei|de|da|do|a|o|as|os|uma|um|nenhum|nenhuma|historico|historia|diagnostico|sinal|sinais|quadro|ter|estar|ser|sou|fui|em|com)\s+){0,3}$/;

function primeiraMencaoAfirmativa(textoNormalizado: string, regex: RegExp): string | null {
  for (const m of textoNormalizado.matchAll(regex)) {
    const idx = m.index ?? 0;
    const antes = textoNormalizado.slice(Math.max(0, idx - 40), idx);
    if (!NEGACAO_ANTES.test(antes)) return m[0];
  }
  return null;
}

function prepararParaBusca(textoNormalizado: string): string {
  // "resistência à insulina" não é uso de insulina.
  return textoNormalizado
    .replace(/resistencia (?:a )?insulina/g, "resistencia metabolica")
    .replace(/resistencia insulinica/g, "resistencia metabolica");
}

// ── Leitura defensiva das fontes estruturadas ─────────────────────────────

function objeto(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function listaDeTextos(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

interface HistoricoLido {
  condicoes: string[];
  textos: string[];
  cirurgias: { ano: number | null }[];
}

function lerHistoricoClinico(h: unknown): HistoricoLido {
  const out: HistoricoLido = { condicoes: [], textos: [], cirurgias: [] };
  const raiz = objeto(h);
  if (!raiz) return out;

  const doencas = objeto(raiz.doencas_cronicas);
  if (doencas) {
    out.condicoes = listaDeTextos(doencas.condicoes);
    out.textos.push(...out.condicoes);
    if (typeof doencas.detalhes === "string") out.textos.push(doencas.detalhes);
  }
  const cirurgias = objeto(raiz.cirurgias);
  if (cirurgias && Array.isArray(cirurgias.items)) {
    for (const it of cirurgias.items) {
      const c = objeto(it);
      if (!c) continue;
      if (typeof c.tipo === "string") out.textos.push(c.tipo);
      if (typeof c.complicacoes === "string") out.textos.push(c.complicacoes);
      const ano = Number(c.ano);
      out.cirurgias.push({ ano: Number.isFinite(ano) && ano > 1900 ? ano : null });
    }
  }
  const meds = objeto(raiz.medicamentos);
  if (meds && Array.isArray(meds.items)) {
    for (const it of meds.items) {
      const m = objeto(it);
      if (m && typeof m.nome === "string") out.textos.push(m.nome);
    }
  }
  const mental = objeto(raiz.saude_mental);
  if (mental) {
    out.textos.push(...listaDeTextos(mental.condicoes));
    if (typeof mental.detalhes === "string") out.textos.push(mental.detalhes);
  }
  // historico_familiar fica de fora de propósito: é sobre parentes.
  return out;
}

function respostaNormalizada(v: unknown): string | null {
  if (v === true) return "sim";
  if (v === false) return "nao";
  if (typeof v !== "string") return null;
  const n = normalizarTexto(v).replace(/ /g, "_");
  return n || null;
}

interface AutodeclaracaoLida {
  presente: boolean;
  completa: boolean;
  respostas: Partial<Record<ChavePerguntaTriagem, string>>;
}

function lerAutodeclaracao(raw: unknown): AutodeclaracaoLida {
  const o = objeto(raw);
  if (!o) return { presente: false, completa: false, respostas: {} };
  const respostas: Partial<Record<ChavePerguntaTriagem, string>> = {};
  for (const k of CHAVES_PERGUNTAS) {
    const r = respostaNormalizada(o[k]);
    if (r && (RESPOSTAS_TRIAGEM[k] as readonly string[]).includes(r)) respostas[k] = r;
  }
  return { presente: true, completa: CHAVES_PERGUNTAS.every((k) => respostas[k] !== undefined), respostas };
}

function lerParq(parq: EntradaTriagem["parq"]): { atencao: boolean; coracaoOuPressao: boolean; dorNoPeito: boolean } {
  const vazio = { atencao: false, coracaoOuPressao: false, dorNoPeito: false };
  if (!parq) return vazio;
  const classif = normalizarTexto(parq.classificacao ?? "");
  const resp = objeto(parq.respostas);
  const valores = objeto(resp?.valores);
  const sim = (k: string) => Number(valores?.[k]) === 1;
  const algumSim = valores ? Object.values(valores).some((v) => Number(v) > 0) : false;
  return {
    atencao: classif.includes("atencao") || algumSim,
    coracaoOuPressao: sim("q1"),
    dorNoPeito: sim("q2"),
  };
}

// ── Avaliação ──────────────────────────────────────────────────────────────

interface Evidencia {
  codigo: CodigoCondicao;
  certeza: "certa" | "duvida";
  origem: string;
  detalhe: string;
  /** O detalhe cita texto livre: não é mostrado ao cliente. */
  detalheSensivel: boolean;
}

function idadeValida(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 0;
}

export function avaliarTriagem(e: EntradaTriagem): ResultadoTriagem {
  const agora = e.agora ?? new Date();
  const regras = TRIAGEM_REGRAS.niveis[e.foco] ?? {};
  const evid: Evidencia[] = [];
  const add = (
    codigo: CodigoCondicao, certeza: Evidencia["certeza"], origem: string, detalhe: string, detalheSensivel = false,
  ) => evid.push({ codigo, certeza, origem, detalhe, detalheSensivel });

  // 1) Idade (cadastro e a informada pelo usuário: qualquer uma pode acionar a regra)
  const idades: { valor: number; origem: string }[] = [];
  if (idadeValida(e.idade)) idades.push({ valor: e.idade, origem: "cadastro" });
  if (idadeValida(e.idadeInformada)) idades.push({ valor: e.idadeInformada, origem: "idade_informada" });
  for (const i of idades) {
    if (i.valor < TRIAGEM_REGRAS.idadeMenorDe) add("menor_de_idade", "certa", i.origem, `Idade considerada: ${i.valor} anos.`);
    if (i.valor >= TRIAGEM_REGRAS.idadeIdosoMinima) add("idoso", "certa", i.origem, `Idade considerada: ${i.valor} anos.`);
  }

  // 2) Dados estruturados: histórico clínico
  const hist = lerHistoricoClinico(e.historicoClinico);
  for (const rotulo of hist.condicoes) {
    const n = normalizarTexto(rotulo);
    if (n.includes("diabetes")) {
      add("diabetes", "certa", "historico_clinico", `Condição registrada no histórico clínico: ${rotulo}.`);
      if (/\btipo 1\b/.test(n)) add("diabetes_insulina", "certa", "historico_clinico", `Condição registrada no histórico clínico: ${rotulo}.`);
    }
    if (n.includes("renal")) add("doenca_renal", "certa", "historico_clinico", `Condição registrada no histórico clínico: ${rotulo}.`);
    if (n.includes("hipertensao") || n.includes("cardi")) add("cardio_pressao", "certa", "historico_clinico", `Condição registrada no histórico clínico: ${rotulo}.`);
  }
  const anoAtual = new Date(agora.getTime() - 3 * 3600 * 1000).getUTCFullYear();
  for (const c of hist.cirurgias) {
    if (c.ano !== null && c.ano >= anoAtual - TRIAGEM_REGRAS.cirurgiaRecenteJanelaAnos) {
      add("cirurgia_lesao_recente", "certa", "historico_clinico", `Cirurgia registrada no histórico clínico em ${c.ano}.`);
    }
  }

  // 3) Autodeclaração do cliente
  const auto = lerAutodeclaracao(e.triagemAutodeclarada);
  const r = auto.respostas;
  const porResposta = (resp: string | undefined, codigo: CodigoCondicao, pergunta: string) => {
    if (resp === "sim") add(codigo, "certa", "triagem_autodeclarada", `Respondeu "sim" na triagem: ${pergunta}`);
    else if (resp === "nao_sei" || resp === "prefiro_nao_dizer") {
      const dito = resp === "nao_sei" ? "não sei" : "prefiro não dizer";
      add(codigo, "duvida", "triagem_autodeclarada", `Respondeu "${dito}" na triagem: ${pergunta}`);
    }
  };
  porResposta(r.gestante_lactante, "gestante_lactante", "gestação ou amamentação.");
  porResposta(r.transtorno_alimentar, "transtorno_alimentar", "histórico de transtorno alimentar.");
  porResposta(r.doenca_renal, "doenca_renal", "doença renal.");
  porResposta(r.diabetes_insulina, "diabetes", "diabetes ou uso de insulina.");
  porResposta(r.diabetes_insulina, "diabetes_insulina", "diabetes ou uso de insulina.");
  porResposta(r.cardio_pressao, "cardio_pressao", "problema de coração ou pressão alta.");
  porResposta(r.cirurgia_lesao_recente, "cirurgia_lesao_recente", "cirurgia ou lesão recente.");

  // 4) PAR-Q+ e MyID
  const parq = lerParq(e.parq);
  if (parq.atencao) add("parq_atencao", "certa", "parq", "PAR-Q+ respondido com sinal de atenção.");
  if (parq.coracaoOuPressao) add("cardio_pressao", "certa", "parq", "PAR-Q+: informou problema de coração ou pressão alta.");
  if (parq.dorNoPeito) add("cardio_pressao", "duvida", "parq", "PAR-Q+: informou dor no peito.");
  if (e.myidRedFlags) add("myid_red_flags", "certa", "myid", "O MyID registrou sinais de alerta (red flags).");
  if (e.avaliacaoRedFlags) add("avaliacao_red_flags", "certa", "avaliacao_presencial", "A avaliação presencial registrou sinais de alerta (red flags).");

  // 5) Varredura por palavra-chave nos textos livres e nos textos do histórico
  const fontes: { texto: string; origem: string }[] = [
    ...(Array.isArray(e.textos) ? e.textos : []).filter((t) => typeof t === "string" && t.trim()).map((texto) => ({ texto, origem: "texto_livre" })),
    ...hist.textos.map((texto) => ({ texto, origem: "historico_clinico" })),
  ];
  for (const f of fontes) {
    // A negação só vale dentro da mesma oração: "Fuma: não. Gestante: sim".
    for (const oracao of f.texto.split(/[.;:,!?()\n\r\/|]+/)) {
      const norm = prepararParaBusca(normalizarTexto(oracao));
      if (!norm) continue;
      for (const p of PADROES_TEXTO) {
        const termo = primeiraMencaoAfirmativa(norm, p.regex);
        if (!termo) continue;
        const detalhe = `Menção a "${termo}" nos registros do paciente.`;
        add(p.codigo, "certa", f.origem, detalhe, true);
        if (p.implicaDiabetes) add("diabetes", "certa", f.origem, detalhe, true);
      }
    }
  }

  // 6) Dúvida sobre insulina: diabetes conhecido sem negação explícita de insulina
  const temDiabetes = evid.some((x) => x.codigo === "diabetes" && x.certeza === "certa");
  const temInsulina = evid.some((x) => x.codigo === "diabetes_insulina");
  if (temDiabetes && !temInsulina) {
    const divergente = r.diabetes_insulina === "nao"
      ? "Diabetes registrado no histórico, mas a triagem diz que não há diabetes/insulina: informações divergentes, confirme se usa insulina ou hipoglicemiante."
      : "Diabetes registrado sem confirmação de que não usa insulina ou hipoglicemiante.";
    add("diabetes_insulina", "duvida", "historico_clinico", divergente);
  }

  // 7) Aplica a regra do foco
  const porCodigo = new Map<CodigoCondicao, { nivel: NivelRegra; origens: Set<string>; detalhes: string[]; sensivel: boolean }>();
  for (const ev of evid) {
    const regra = regras[ev.codigo];
    if (!regra) continue;
    const nivel: NivelRegra = ev.certeza === "duvida" ? "confirmar" : regra;
    const atual = porCodigo.get(ev.codigo);
    if (!atual) {
      porCodigo.set(ev.codigo, { nivel, origens: new Set([ev.origem]), detalhes: [ev.detalhe], sensivel: ev.detalheSensivel });
      continue;
    }
    if (nivel === "bloqueia") atual.nivel = "bloqueia";
    atual.origens.add(ev.origem);
    if (!atual.detalhes.includes(ev.detalhe)) atual.detalhes.push(ev.detalhe);
    atual.sensivel = atual.sensivel || ev.detalheSensivel;
  }

  const motivos: MotivoTriagem[] = [];
  for (const codigo of ORDEM_CODIGOS) {
    const x = porCodigo.get(codigo);
    if (!x) continue;
    const detalhe = e.chamador === "cliente" && x.sensivel
      ? "Há uma informação no seu cadastro ou histórico que precisa da avaliação do seu profissional."
      : x.detalhes.slice(0, 3).join(" ");
    const oculto = e.chamador === "cliente" && x.sensivel;
    motivos.push({
      codigo: oculto ? "ponto_de_atencao" : codigo,
      rotulo: oculto ? "Há um ponto de atenção que precisa do seu profissional" : rotuloCondicao(codigo),
      detalhe,
      origem: oculto ? "profissional" : [...x.origens].join(", "),
      nivel: x.nivel,
    });
  }

  // 8) Dados ausentes (fail-closed)
  const dadosAusentes: string[] = [];
  const nivelAusente: NivelRegra = e.chamador === "cliente" ? "bloqueia" : "confirmar";
  if (!idadeValida(e.idade)) {
    dadosAusentes.push(DADO_AUSENTE.idade);
    motivos.push({
      codigo: "dado_ausente_idade",
      rotulo: "Data de nascimento não cadastrada",
      detalhe: e.chamador === "cliente"
        ? "Complete seu cadastro com a data de nascimento para poder gerar o plano."
        : "Sem a data de nascimento não é possível confirmar a idade do paciente. Confira a idade antes de prosseguir.",
      origem: "dados_ausentes",
      nivel: nivelAusente,
    });
  }
  if (!auto.completa) {
    dadosAusentes.push(DADO_AUSENTE.triagem);
    motivos.push({
      codigo: "dado_ausente_triagem",
      rotulo: "Triagem de segurança não respondida",
      detalhe: e.chamador === "cliente"
        ? "Responda a triagem de segurança para poder gerar o plano. Se preferir, fale com o seu profissional."
        : "O paciente ainda não respondeu (ou não concluiu) a triagem de segurança. Confira as condições de saúde antes de prosseguir.",
      origem: "dados_ausentes",
      nivel: nivelAusente,
    });
  }
  if (Array.isArray(e.falhasLeitura) && e.falhasLeitura.length > 0) {
    dadosAusentes.push(DADO_AUSENTE.leitura);
    motivos.push({
      codigo: "dado_ausente_leitura",
      rotulo: "Não foi possível consultar todos os dados do paciente",
      detalhe: e.chamador === "cliente"
        ? "Não conseguimos conferir seus dados agora. Tente de novo em instantes ou fale com o seu profissional."
        : "Parte dos dados do paciente não pôde ser carregada. Confira o prontuário antes de prosseguir.",
      origem: "dados_ausentes",
      nivel: nivelAusente,
    });
  }

  motivos.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "bloqueia" ? -1 : 1));

  let nivel: NivelTriagem;
  if (motivos.length === 0) nivel = "liberado";
  else if (e.chamador === "cliente") nivel = "bloqueia";
  else nivel = motivos.some((m) => m.nivel === "bloqueia") ? "bloqueia" : "confirmar";

  return { nivel, motivos, dadosAusentes };
}

// ── Decisão (override do profissional) ────────────────────────────────────

export interface OverrideAplicado {
  justificativa: string;
  ciente: boolean;
  em: string;
}

export interface BloqueioResposta {
  nivel: "confirmar" | "bloqueia";
  motivos: MotivoTriagem[];
  dadosAusentes: string[];
  pode_prosseguir_profissional: boolean;
  /** Presente só quando um override foi enviado mas não bastou. */
  override_recusado?: "justificativa_curta" | "ciente_ausente";
}

// Formato "plano" (sem união discriminada) para funcionar também no tsc não-estrito do front.
export interface DecisaoTriagem {
  liberado: boolean;
  /** Preenchido quando o profissional sobrepôs a triagem. */
  override: OverrideAplicado | null;
  /** Preenchido quando `liberado` é false. */
  bloqueio: BloqueioResposta | null;
}

const JUSTIFICATIVA_MAX = 1000;

/**
 * Aplica o override do profissional ao resultado da triagem. Cliente NUNCA
 * sobrepõe. 'bloqueia' exige justificativa; 'confirmar' exige ciente === true.
 */
export function decidirLiberacao(
  resultado: ResultadoTriagem,
  chamador: ChamadorTriagem,
  overrideBruto: unknown,
  agora: Date = new Date(),
): DecisaoTriagem {
  if (resultado.nivel === "liberado") return { liberado: true, override: null, bloqueio: null };

  const nivel = resultado.nivel;
  const base: BloqueioResposta = {
    nivel,
    motivos: resultado.motivos,
    dadosAusentes: resultado.dadosAusentes,
    pode_prosseguir_profissional: chamador === "profissional",
  };
  if (chamador !== "profissional") return { liberado: false, override: null, bloqueio: base };

  const ov = objeto(overrideBruto);
  if (!ov) return { liberado: false, override: null, bloqueio: base };

  const justificativa = typeof ov.justificativa === "string" ? ov.justificativa.trim().slice(0, JUSTIFICATIVA_MAX) : "";
  const ciente = ov.ciente === true;

  if (nivel === "bloqueia" && justificativa.length < TRIAGEM_REGRAS.justificativaMinCaracteres) {
    return { liberado: false, override: null, bloqueio: { ...base, override_recusado: "justificativa_curta" } };
  }
  if (!ciente) {
    return { liberado: false, override: null, bloqueio: { ...base, override_recusado: "ciente_ausente" } };
  }
  return { liberado: true, override: { justificativa, ciente, em: agora.toISOString() }, bloqueio: null };
}

// ── Quem está chamando ────────────────────────────────────────────────────

export interface ParametrosChamador {
  userId: string;
  pacienteIdInformado: boolean;
  /** Paciente alvo: o do paciente_id informado, ou o próprio paciente do usuário. */
  pacienteAlvo: { user_id: string | null; terapeuta_id: string | null } | null;
  /** Perfil profissional confirmado ou escolhido no cadastro (profiles). */
  temPerfilProfissional: boolean;
}

export interface ClassificacaoChamador {
  ok: boolean;
  /** Preenchidos quando ok. */
  chamador?: ChamadorTriagem;
  relacao?: "proprio_paciente" | "terapeuta_dono" | "profissional_sem_paciente";
  /** Preenchidos quando !ok. */
  status?: 403 | 404;
  erro?: string;
}

/**
 * Decide se quem chama é o próprio cliente ou um profissional, sem confiar no
 * body. Quem não é o paciente, nem o terapeuta dele, nem tem perfil profissional
 * é recusado (fail-closed).
 */
export function classificarChamador(p: ParametrosChamador): ClassificacaoChamador {
  const alvo = p.pacienteAlvo;
  if (p.pacienteIdInformado && !alvo) return { ok: false, status: 404, erro: "Paciente não encontrado." };
  if (alvo) {
    if (alvo.user_id && alvo.user_id === p.userId) return { ok: true, chamador: "cliente", relacao: "proprio_paciente" };
    // Só o terapeuta dono COM perfil profissional sobrepõe bloqueio: o vínculo,
    // sozinho, é criável por qualquer usuário via RLS.
    if (alvo.terapeuta_id && alvo.terapeuta_id === p.userId && p.temPerfilProfissional) {
      return { ok: true, chamador: "profissional", relacao: "terapeuta_dono" };
    }
    return { ok: false, status: 403, erro: "Sem permissão para gerar plano para este paciente." };
  }
  if (p.temPerfilProfissional) return { ok: true, chamador: "profissional", relacao: "profissional_sem_paciente" };
  return { ok: false, status: 403, erro: "Sem permissão para gerar plano." };
}

// ── Texto para o prompt ───────────────────────────────────────────────────

/** Bloco de prompt que obriga o plano a ser conservador nos pontos sinalizados. */
export function textoTriagemParaPrompt(res: ResultadoTriagem, foco: FocoTriagem): string {
  const rotulos = res.motivos.filter((m) => m.origem !== "dados_ausentes").map((m) => m.rotulo);
  if (rotulos.length === 0) return "";
  const conduta = foco === "treino"
    ? "progressão conservadora, sem técnicas de alta intensidade, e deixe explícito no plano que ele não substitui o acompanhamento de um profissional"
    : "sem restrição calórica agressiva e sem suplementação, e deixe explícito no plano que ele não substitui o acompanhamento de um nutricionista ou médico";
  return `\nTRIAGEM DE SEGURANÇA (fatores sinalizados: ${rotulos.join("; ")}). Seja CONSERVADOR nestes pontos: ${conduta}.`;
}
