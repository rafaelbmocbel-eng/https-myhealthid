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

    for (const av of avaliacoesIdentidade || []) {
      totalChecadas++;
      const { changed, novo, oldScore, newScore } = recomputeResult(av.myid_analysis);
      if (!changed) continue;
      totalAlteradas++;
      amostras.push({ tabela: "avaliacoes_identidade", id: av.id, oldScore, newScore });
      if (!dryRun) {
        await supabase.from("avaliacoes_identidade").update({
          myid_analysis: novo,
          myid_score: newScore,
          classificacao: novo.myid_100?.classificacao || av.classificacao,
        }).eq("id", av.id);
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
