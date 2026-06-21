import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════
// Backfill: corrige a inversão da dimensão EFI em avaliações MyID
// já concluídas (calculadas antes da correção do bug).
//
// EFI (Atividades do dia) é bem-estar/funcionalidade — menor valor = pior —
// mas a perda de pontos era calculada como se fosse demanda (maior = pior).
// Aqui recomputamos apenas a contribuição de EFI na perda total e
// re-derivamos driver_primario / classificação / prioridade clínica
// a partir dos demais valores já armazenados (sem precisar das
// respostas brutas, então funciona mesmo se respostas_brutas não existir).
// ═══════════════════════════════════════════════════════════

interface BandaPerda { min: number; max: number; perda: number }
interface DimensionLossConfig { peso_maximo: number; bandas: BandaPerda[]; gatilho_critico?: number }

const TABELA_PERDAS: Record<string, DimensionLossConfig> = {
  D: { peso_maximo: 20, bandas: [{ min: 0, max: 1, perda: 0 }, { min: 1, max: 3, perda: 3 }, { min: 3, max: 5, perda: 8 }, { min: 5, max: 7, perda: 14 }, { min: 7, max: 10.01, perda: 20 }] },
  EFI: { peso_maximo: 15, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 5 }, { min: 4, max: 6, perda: 10 }, { min: 6, max: 8, perda: 13 }, { min: 8, max: 10.01, perda: 15 }] },
  P: { peso_maximo: 10, bandas: [{ min: 0, max: 3, perda: 0 }, { min: 3, max: 5, perda: 3 }, { min: 5, max: 7, perda: 6 }, { min: 7, max: 10.01, perda: 10 }] },
  I: { peso_maximo: 5, bandas: [{ min: 0, max: 0.5, perda: 0 }, { min: 0.5, max: 1.5, perda: 2 }, { min: 1.5, max: 2.5, perda: 4 }, { min: 2.5, max: 10.01, perda: 5 }] },
  R: { peso_maximo: 15, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 5 }, { min: 4, max: 6, perda: 10 }, { min: 6, max: 8, perda: 13 }, { min: 8, max: 10.01, perda: 15 }], gatilho_critico: 6.0 },
  C: { peso_maximo: 10, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 4 }, { min: 4, max: 6, perda: 7 }, { min: 6, max: 10.01, perda: 10 }] },
  AF: { peso_maximo: 8, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 3 }, { min: 4, max: 6, perda: 6 }, { min: 6, max: 10.01, perda: 8 }], gatilho_critico: 7.0 },
  HID: { peso_maximo: 6, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 2 }, { min: 4, max: 6, perda: 4 }, { min: 6, max: 10.01, perda: 6 }] },
  NUT: { peso_maximo: 6, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 2 }, { min: 4, max: 6, perda: 4 }, { min: 6, max: 10.01, perda: 6 }] },
  ERG: { peso_maximo: 5, bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 2 }, { min: 4, max: 6, perda: 4 }, { min: 6, max: 10.01, perda: 5 }], gatilho_critico: 8.0 },
  N: { peso_maximo: 5, bandas: [{ min: 0, max: 1, perda: 0 }, { min: 1, max: 2, perda: 2 }, { min: 2, max: 3, perda: 4 }, { min: 3, max: 10.01, perda: 5 }], gatilho_critico: 6.0 },
};

const DIMENSION_LABELS: Record<string, string> = {
  D: 'Dor', EFI: 'Funcionalidade', P: 'Psicológico', I: 'Inércia', R: 'Regulação',
  C: 'Contexto', AF: 'Atividade Física', HID: 'Hidratação', NUT: 'Nutrição', ERG: 'Ergonomia', N: 'Ruído Sistêmico', MED: 'Medicação',
};

function calcularPerdaDimensao(dimensao: string, scoreBruto: number) {
  const config = TABELA_PERDAS[dimensao];
  if (!config) return { score_bruto: scoreBruto, perda_pontos: 0, percentual_perda: 0, banda: '?', gatilho_critico: false };
  const banda = config.bandas.find(b => scoreBruto >= b.min && scoreBruto < b.max) || config.bandas[config.bandas.length - 1];
  const gatilhoCritico = config.gatilho_critico !== undefined && scoreBruto >= config.gatilho_critico;
  return { score_bruto: scoreBruto, perda_pontos: banda.perda, percentual_perda: (banda.perda / 105) * 100, banda: `${banda.min}-${banda.max}`, gatilho_critico: gatilhoCritico };
}

function classificarMyID100(score: number, temGatilhoCritico: boolean) {
  if (score <= 29) return { nome: 'CRÍTICO SEVERO', cor: '#7F1D1D', emoji: '🆘' };
  if (score <= 49) return { nome: 'CRÍTICO', cor: '#DC2626', emoji: '🔴' };
  if (score <= 69) return { nome: 'MODERADO', cor: '#F59E0B', emoji: '🟠' };
  if (score <= 84) return temGatilhoCritico ? { nome: 'MODERADO', cor: '#F59E0B', emoji: '🟠' } : { nome: 'BOM', cor: '#FBBF24', emoji: '🟡' };
  return { nome: 'EXCELENTE', cor: '#10B981', emoji: '🟢' };
}

function identificarDriver(perdas: Record<string, any>) {
  let maxPerda = 0;
  let driver: any = null;
  for (const [dimensao, dados] of Object.entries(perdas)) {
    if (dimensao === 'MED') continue;
    const pesoAjustado = (dados as any).perda_pontos * ((dados as any).gatilho_critico ? 1.5 : 1);
    if (pesoAjustado > maxPerda) {
      maxPerda = pesoAjustado;
      driver = {
        dimensao,
        score_bruto: (dados as any).score_bruto,
        perda_pontos: (dados as any).perda_pontos,
        percentual_impacto: (dados as any).percentual_perda,
        motivo: (dados as any).gatilho_critico ? 'Maior perda de pontos + gatilho crítico' : 'Maior perda de pontos',
      };
    }
  }
  return driver;
}

function identificarCoDrivers(perdas: Record<string, any>) {
  const ranking: Array<{ dimensao: string; pesoAjustado: number; dados: any }> = [];
  for (const [dimensao, dados] of Object.entries(perdas)) {
    if (dimensao === 'MED' || (dados as any).perda_pontos === 0) continue;
    ranking.push({ dimensao, pesoAjustado: (dados as any).perda_pontos * ((dados as any).gatilho_critico ? 1.5 : 1), dados });
  }
  ranking.sort((a, b) => b.pesoAjustado - a.pesoAjustado);
  return ranking.slice(0, 3).map(item => ({
    dimensao: item.dimensao,
    score_bruto: item.dados.score_bruto,
    perda_pontos: item.dados.perda_pontos,
    percentual_impacto: item.dados.percentual_perda,
    motivo: item.dados.gatilho_critico ? 'Maior perda de pontos + gatilho crítico' : 'Maior perda de pontos',
  }));
}

function determineClinicalPriority(driver: any) {
  if (!driver) return { clinical_priority: 'MANUTENÇÃO', focus_areas: ['Manter hábitos saudáveis'] };
  const demandDims = ['D', 'P', 'I'];
  const capacityDims = ['R', 'C', 'AF', 'HID', 'NUT', 'ERG', 'EFI'];
  if (demandDims.includes(driver.dimensao)) {
    return { clinical_priority: 'REDUZIR DEMANDA', focus_areas: [`Foco em ${DIMENSION_LABELS[driver.dimensao]}`, 'Reduzir sobrecarga sistêmica', 'Tratamento direcionado ao driver primário'] };
  }
  if (capacityDims.includes(driver.dimensao)) {
    return { clinical_priority: 'AUMENTAR CAPACIDADE', focus_areas: [`Melhorar ${DIMENSION_LABELS[driver.dimensao]}`, 'Fortalecer fatores protetores', 'Ajustes de estilo de vida'] };
  }
  return { clinical_priority: 'INVESTIGAR RUÍDO', focus_areas: ['Investigar fatores sistêmicos ocultos', 'Avaliação multidisciplinar'] };
}

// ── Réplica corrigida de buildMyIDEnhancements() (supabase/functions/complete-myid/index.ts) ──
// Usada para recalcular protocolos.scores_avaliacao.myid_enhancements de diretrizes ativas
// que foram enriquecidas antes da correção do bug de EFI.
const TABELA_PERDAS_ENH: Record<string, { bandas: BandaPerda[]; critico?: number }> = {
  D: { bandas: [{ min: 0, max: 1, perda: 0 }, { min: 1, max: 3, perda: 3 }, { min: 3, max: 5, perda: 8 }, { min: 5, max: 7, perda: 14 }, { min: 7, max: 11, perda: 20 }] },
  EFI: { bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 5 }, { min: 4, max: 6, perda: 10 }, { min: 6, max: 8, perda: 13 }, { min: 8, max: 11, perda: 15 }] },
  P: { bandas: [{ min: 0, max: 3, perda: 0 }, { min: 3, max: 5, perda: 2 }, { min: 5, max: 7, perda: 4 }, { min: 7, max: 11, perda: 5 }] },
  I: { bandas: [{ min: 0, max: 0.5, perda: 0 }, { min: 0.5, max: 1.5, perda: 2 }, { min: 1.5, max: 2.5, perda: 4 }, { min: 2.5, max: 11, perda: 5 }] },
  R: { bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 5 }, { min: 4, max: 6, perda: 10 }, { min: 6, max: 8, perda: 13 }, { min: 8, max: 11, perda: 15 }], critico: 7 },
  C: { bandas: [{ min: 0, max: 2, perda: 0 }, { min: 2, max: 4, perda: 4 }, { min: 4, max: 6, perda: 7 }, { min: 6, max: 11, perda: 10 }] },
  N: { bandas: [{ min: 0, max: 1, perda: 0 }, { min: 1, max: 2, perda: 2 }, { min: 2, max: 3, perda: 4 }, { min: 3, max: 11, perda: 5 }] },
};

const DIM_LABELS_ENH: Record<string, string> = {
  D: "Dor", EFI: "Funcionalidade", P: "Psicológico", I: "Inércia", R: "Regulação", C: "Contexto", N: "Ruído Sistêmico",
};

const DRIVER_INTERVENCOES_ENH: Record<string, { intervencoes: string[]; encaminhamentos: string[] }> = {
  D: { intervencoes: ["Educação em neurociência da dor", "Modulação (TENS/crioterapia/terapia manual)", "Amplitude sem carga", "Respiração diafragmática 3×/dia"], encaminhamentos: ["Avaliação médica se dor > 8/10 persistente"] },
  EFI: { intervencoes: ["Amplitude sem carga", "Adaptações funcionais", "Retorno gradual às AVDs", "Fisioterapia 2–3×/sem"], encaminhamentos: ["Avaliação ocupacional se limitação severa"] },
  P: { intervencoes: ["Educação em neurociência da dor (crenças)", "Exposição gradual ao movimento temido", "Diário de atividades sem dor", "Reestruturação cognitiva"], encaminhamentos: ["Psicoterapia cognitivo-comportamental"] },
  R: { intervencoes: ["Higiene do sono: rotina fixa", "Desligar telas 1h antes de dormir", "Relaxamento pré-sono", "Cafeína só até 14h"], encaminhamentos: ["Avaliação médica se insônia crônica"] },
  C: { intervencoes: ["Gerenciamento de estresse", "Mindfulness e relaxamento", "Reestruturação da rotina de trabalho", "Lazer e socialização programados"], encaminhamentos: ["Encaminhamento psicológico", "Apoio social estruturado"] },
  I: { intervencoes: ["Estabilizar rotina antes de progredir carga", "Adaptar equipamento gradualmente", "Evitar múltiplas mudanças simultâneas"], encaminhamentos: [] },
  N: { intervencoes: ["Investigar fatores viscerais/hormonais", "Monitorar ciclo menstrual (se aplicável)", "Atenção a sinais autonômicos"], encaminhamentos: ["Avaliação médica para fatores sistêmicos ocultos"] },
};

function perdaDeEnh(dim: string, score: number) {
  const cfg = TABELA_PERDAS_ENH[dim];
  if (!cfg) return { perda: 0, critico: false };
  const banda = cfg.bandas.find(b => score >= b.min && score < b.max) || cfg.bandas[cfg.bandas.length - 1];
  return { perda: banda.perda, critico: cfg.critico !== undefined && score >= cfg.critico };
}

function buildMyIDEnhancements(cs: any, myidScore: number, classificacao: string) {
  const scores: Record<string, number> = {
    D: Number(cs.D ?? cs.D_pain ?? 0),
    EFI: Number(cs.EFI ?? cs.EFI_functionality ?? 0),
    P: Number(cs.P ?? cs.P_psychological ?? 0),
    I: Number(cs.I ?? cs.I_inertia ?? 0),
    R: Number(cs.R ?? cs.R_regulation ?? 0),
    C: Number(cs.C ?? cs.C_context ?? 0),
    N: Number(cs.N ?? cs.N_noise ?? 0),
  };
  const perdas: Record<string, { perda: number; critico: boolean }> = {};
  let driverKey = "D", maxPerda = 0;
  for (const dim of Object.keys(scores)) {
    // EFI é bem-estar/funcionalidade: menor valor = pior, por isso usa o déficit (10 - score), igual às capacidades.
    const p = dim === "EFI" ? perdaDeEnh(dim, 10 - scores[dim]) : perdaDeEnh(dim, scores[dim]);
    perdas[dim] = p;
    const ajustada = p.perda * (p.critico ? 1.5 : 1);
    if (ajustada > maxPerda) { maxPerda = ajustada; driverKey = dim; }
  }
  const di = DRIVER_INTERVENCOES_ENH[driverKey] || DRIVER_INTERVENCOES_ENH.D;
  const driver = {
    key: driverKey,
    label: DIM_LABELS_ENH[driverKey] || driverKey,
    perda: perdas[driverKey].perda,
    score: scores[driverKey],
    intervencoes: di.intervencoes,
    encaminhamentos: di.encaminhamentos,
  };

  const reforcos_por_fase = [
    {
      numero: 1,
      foco: `Reduzir sobrecarga em ${driver.label}`,
      intervencoes: [
        ...di.intervencoes.slice(0, 3),
        ...(perdas.R.perda >= 10 && driverKey !== "R" ? ["Higiene do sono: rotina fixa"] : []),
        ...(perdas.D.perda >= 14 && driverKey !== "D" ? ["Manejo concomitante da dor"] : []),
      ],
    },
    {
      numero: 2,
      foco: "Capacidade física e funcional",
      intervencoes: [
        "Core e estabilização 3×/sem",
        "Caminhada progressiva (10→30 min/dia)",
        "Mobilidade articular sistêmica",
        ...(perdas.EFI.perda >= 10 ? ["Retorno gradual às AVDs"] : []),
        ...(perdas.C.perda >= 7 ? ["Reestruturação gradual do contexto social"] : []),
      ],
    },
    {
      numero: 3,
      foco: "Prevenção e consolidação de hábitos",
      intervencoes: [
        "Programa domiciliar autônomo",
        "Hidratação 2L/dia",
        "Nutrição: 2 porções de vegetais/dia",
        "Ergonomia: ajuste definitivo do workstation",
        "Reavaliação MyID em 30 dias",
      ],
    },
  ];

  const missoes: { titulo: string; descricao: string; categoria: string; xp: number; dimensao: string }[] = [];
  if (perdas.D.perda >= 8) missoes.push({ titulo: "Respiração Terapêutica", descricao: "5 min de respiração diafragmática (4-7-8) ao acordar e antes de dormir.", categoria: perdas.D.perda >= 14 ? "urgente" : "importante", xp: 15, dimensao: "D" });
  if (perdas.R.perda >= 10) missoes.push({ titulo: "Ritual do Sono", descricao: "Desligar telas 1h antes de deitar e dormir 30 min mais cedo.", categoria: perdas.R.critico ? "urgente" : "importante", xp: 20, dimensao: "R" });
  if (perdas.P.perda >= 4) missoes.push({ titulo: "Desafio da Coragem", descricao: "Fazer UMA atividade que evita por medo da dor — com calma.", categoria: "urgente", xp: 25, dimensao: "P" });
  if (perdas.C.perda >= 7) missoes.push({ titulo: "Válvula de Escape", descricao: "Identificar UMA fonte de estresse controlável e definir ação para reduzi-la.", categoria: "importante", xp: 30, dimensao: "C" });
  if (missoes.length < 3) missoes.push({ titulo: "Caminhada Progressiva", descricao: "10 min hoje, +5 min a cada 3 dias. Meta: 30 min/dia.", categoria: "oportunidade", xp: 15, dimensao: "AF" });

  return {
    generated_at: new Date().toISOString(),
    myid_score: myidScore,
    classificacao,
    driver,
    reforcos_por_fase,
    missoes_prioritarias: missoes.slice(0, 4),
    meta_final: `MyID ${Math.min(100, Math.round(myidScore + 20))} em 6 semanas`,
  };
}

/** Recomputa um `resultado_processado` (formato do MyIDCalculator) corrigindo apenas a direção de EFI. */
function recomputeResult(resultado: any): { changed: boolean; novo: any; oldScore: number; newScore: number } {
  const cs = resultado?.component_scores || resultado?.componentScores;
  const oldPerdas = resultado?.perdas_calculadas;
  const oldScore = Number(resultado?.MyID_score ?? resultado?.myid_100?.pontuacao_final ?? 0);

  if (!cs || cs.EFI === undefined || !oldPerdas || !oldPerdas.EFI) {
    return { changed: false, novo: resultado, oldScore, newScore: oldScore };
  }

  const efiRaw = Number(cs.EFI ?? cs.EFI_functionality ?? 0);
  const oldPerdaEFI = Number(oldPerdas.EFI.perda_pontos ?? 0);
  const novaPerdaEFI = calcularPerdaDimensao('EFI', 10 - efiRaw);

  if (novaPerdaEFI.perda_pontos === oldPerdaEFI) {
    return { changed: false, novo: resultado, oldScore, newScore: oldScore };
  }

  const novosPerdas = { ...oldPerdas, EFI: novaPerdaEFI };
  const deltaPerda = novaPerdaEFI.perda_pontos - oldPerdaEFI;
  const oldTotalPerdas = Number(resultado?.myid_100?.total_perdas ?? (100 - oldScore));
  const novoTotalPerdas = oldTotalPerdas + deltaPerda;
  const newScore = Math.max(0, Math.min(100, 100 - novoTotalPerdas));

  const gatilhos = Object.entries(novosPerdas).filter(([, d]: [string, any]) => d.gatilho_critico).map(([k]) => k);
  const classificacao = classificarMyID100(newScore, gatilhos.length > 0);
  const driver = identificarDriver(novosPerdas);
  const coDrivers = identificarCoDrivers(novosPerdas);
  const { clinical_priority, focus_areas } = determineClinicalPriority(driver);

  const novo = {
    ...resultado,
    MyID_score: newScore,
    status: classificacao.nome,
    color: classificacao.cor,
    perdas_calculadas: novosPerdas,
    dimension_alerts: gatilhos,
    clinical_priority,
    focus_areas,
    myid_100: {
      ...(resultado.myid_100 || {}),
      total_perdas: novoTotalPerdas,
      pontuacao_final: newScore,
      classificacao: classificacao.nome,
      cor: classificacao.cor,
      emoji: classificacao.emoji,
      gatilhos_criticos_ativados: gatilhos,
      driver_primario: driver,
      co_drivers: coDrivers,
    },
  };

  return { changed: true, novo, oldScore, newScore };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const terapeutaId = user.id;
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // default: dry run (precisa passar { dryRun: false } pra aplicar)

    const amostras: any[] = [];
    let totalChecadas = 0;
    let totalAlteradas = 0;

    // ── 1. myid_avaliacoes (concluídas via link de avaliação) ──
    const { data: avaliacoesMyid, error: errMyid } = await supabase
      .from("myid_avaliacoes")
      .select("id, resultado_processado, myid_score_parcial")
      .eq("terapeuta_id", terapeutaId)
      .eq("status", "concluido")
      .not("resultado_processado", "is", null);

    if (errMyid) throw errMyid;

    for (const av of avaliacoesMyid || []) {
      totalChecadas++;
      const { changed, novo, oldScore, newScore } = recomputeResult(av.resultado_processado);
      if (!changed) continue;
      totalAlteradas++;
      amostras.push({ tabela: "myid_avaliacoes", id: av.id, oldScore, newScore });
      if (!dryRun) {
        await supabase.from("myid_avaliacoes").update({
          resultado_processado: novo,
          myid_score_parcial: newScore,
        }).eq("id", av.id);
      }
    }

    // ── 2. avaliacoes_identidade (resultado embutido em myid_analysis) ──
    const { data: avaliacoesIdentidade, error: errIdentidade } = await supabase
      .from("avaliacoes_identidade")
      .select("id, myid_analysis, myid_score, classificacao")
      .eq("terapeuta_id", terapeutaId)
      .not("myid_analysis", "is", null);

    if (errIdentidade) throw errIdentidade;

    // Mapa id → score/classificação corrigidos (mesmo para linhas sem alteração), usado no passo 4
    // para recalcular os snapshots de evolução sem precisar reprocessar o resultado completo de novo.
    const scoresCorrigidos = new Map<string, { myid_score: number; classificacao: string }>();

    for (const av of avaliacoesIdentidade || []) {
      totalChecadas++;
      const { changed, novo, oldScore, newScore } = recomputeResult(av.myid_analysis);
      const classificacaoFinal = changed ? (novo.myid_100?.classificacao || av.classificacao) : av.classificacao;
      scoresCorrigidos.set(av.id, { myid_score: newScore, classificacao: classificacaoFinal });
      if (!changed) continue;
      totalAlteradas++;
      amostras.push({ tabela: "avaliacoes_identidade", id: av.id, oldScore, newScore });
      if (!dryRun) {
        await supabase.from("avaliacoes_identidade").update({
          myid_analysis: novo,
          myid_score: newScore,
          classificacao: classificacaoFinal,
        }).eq("id", av.id);
      }
    }

    // ── 3. protocolos ativos enriquecidos com myid_enhancements (driver/missões calculados com o bug) ──
    const { data: protocolosAtivos, error: errProtocolos } = await supabase
      .from("protocolos")
      .select("id, paciente_id, scores_avaliacao")
      .eq("terapeuta_id", terapeutaId)
      .eq("status", "ativo")
      .not("scores_avaliacao", "is", null);

    if (errProtocolos) throw errProtocolos;

    for (const protocolo of protocolosAtivos || []) {
      const enhancementsAntigo = protocolo.scores_avaliacao?.myid_enhancements;
      if (!enhancementsAntigo || !protocolo.paciente_id) continue;
      totalChecadas++;

      const { data: ultimaAvaliacao } = await supabase
        .from("avaliacoes_identidade")
        .select("myid_analysis, myid_score, classificacao")
        .eq("paciente_id", protocolo.paciente_id)
        .eq("terapeuta_id", terapeutaId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const cs = ultimaAvaliacao?.myid_analysis?.component_scores || ultimaAvaliacao?.myid_analysis?.componentScores;
      if (!cs) continue;

      const enhancementsNovo = buildMyIDEnhancements(cs, ultimaAvaliacao!.myid_score, ultimaAvaliacao!.classificacao);
      if (enhancementsNovo.driver.key === enhancementsAntigo.driver?.key && enhancementsNovo.driver.perda === enhancementsAntigo.driver?.perda) {
        continue;
      }

      totalAlteradas++;
      amostras.push({
        tabela: "protocolos",
        id: protocolo.id,
        driverAntigo: enhancementsAntigo.driver?.key,
        driverNovo: enhancementsNovo.driver.key,
      });
      if (!dryRun) {
        await supabase.from("protocolos").update({
          scores_avaliacao: { ...protocolo.scores_avaliacao, myid_enhancements: enhancementsNovo },
        }).eq("id", protocolo.id);
      }
    }

    // ── 4. evolucao_paciente (snapshots de myid_score/delta tirados no momento de cada avaliação) ──
    // score_efi/delta_efi não mudam (são o valor bruto, nunca esteve errado).
    // myid_score e delta_id_final precisam refletir o score já corrigido em avaliacoes_identidade.
    const { data: evolucoes, error: errEvolucao } = await supabase
      .from("evolucao_paciente")
      .select("id, avaliacao_atual_id, avaliacao_anterior_id, myid_score, delta_id_final, classificacao")
      .eq("terapeuta_id", terapeutaId);

    if (errEvolucao) throw errEvolucao;

    for (const ev of evolucoes || []) {
      const atual = scoresCorrigidos.get(ev.avaliacao_atual_id);
      if (!atual) continue;
      totalChecadas++;

      const anterior = ev.avaliacao_anterior_id ? scoresCorrigidos.get(ev.avaliacao_anterior_id) : null;
      const novoDelta = anterior ? atual.myid_score - anterior.myid_score : 0;

      if (atual.myid_score === ev.myid_score && novoDelta === ev.delta_id_final && atual.classificacao === ev.classificacao) {
        continue;
      }

      totalAlteradas++;
      amostras.push({
        tabela: "evolucao_paciente",
        id: ev.id,
        oldScore: ev.myid_score,
        newScore: atual.myid_score,
      });
      if (!dryRun) {
        await supabase.from("evolucao_paciente").update({
          myid_score: atual.myid_score,
          delta_id_final: novoDelta,
          classificacao: atual.classificacao,
        }).eq("id", ev.id);
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      dryRun,
      total_checadas: totalChecadas,
      total_alteradas: totalAlteradas,
      amostras: amostras.slice(0, 30),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error("backfill-myid-efi error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
