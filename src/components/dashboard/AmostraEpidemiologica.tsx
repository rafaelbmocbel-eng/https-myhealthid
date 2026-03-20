import { useMemo } from 'react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Activity, Brain, Heart, Bone, Shield, Zap, TrendingUp,
  BarChart3, GitBranch, Layers, AlertTriangle, ArrowUpDown,
} from 'lucide-react';

interface AvaliacaoRaw {
  score_e: number | null;
  score_p: number | null;
  score_c: number | null;
  score_f: number | null;
  score_d: number | null;
  score_r: number | null;
  score_efi: number | null;
  score_i: number | null;
  score_n: number | null;
  id_final: number | null;
  myid_score: number | null;
  classificacao: string | null;
  dados_avaliacao: any;
  paciente_id?: string;
  created_at?: string;
}

interface Props {
  avaliacoes: AvaliacaoRaw[];
}

// Pearson correlation
function pearson(x: number[], y: number[]): number {
  const n = x.length;
  if (n < 3) return 0;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xi = x[i] - mx;
    const yi = y[i] - my;
    num += xi * yi;
    dx += xi * xi;
    dy += yi * yi;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

function interpretR(r: number): { label: string; color: string } {
  const abs = Math.abs(r);
  if (abs >= 0.7) return { label: 'Forte', color: r > 0 ? 'text-red-600' : 'text-blue-600' };
  if (abs >= 0.4) return { label: 'Moderada', color: r > 0 ? 'text-amber-600' : 'text-teal-600' };
  if (abs >= 0.2) return { label: 'Fraca', color: 'text-muted-foreground' };
  return { label: 'Negligível', color: 'text-muted-foreground/60' };
}

const SCORE_KEYS = ['score_d', 'score_efi', 'score_r', 'score_c', 'score_p', 'score_i', 'score_n', 'id_final'] as const;
const SCORE_LABELS: Record<string, string> = {
  score_d: 'D (Dor)', score_efi: 'EFI (Função)', score_r: 'R (Regulação)',
  score_c: 'C (Contexto)', score_p: 'P (Comportamento)', score_i: 'I (Inércia)',
  score_n: 'N (Ruído)', id_final: 'MyID-100',
};

// TSK-11 items
const TSK_ITEMS_SHORT = [
  'Medo de piorar com atividade',
  'Medo de machucar na fisio',
  'Corpo diz para evitar movimentos',
  'Não deveria fazer atividades com dor',
  'Dor = corpo sendo prejudicado',
  'Melhor ser inativo com dor',
  'Dor = algo errado no corpo',
  'Problema pode levar a lesão grave',
  'Medo de não controlar problema',
  'Não é seguro mover com dor',
  'Gosta de mostrar que está em dor',
];

export default function AmostraEpidemiologica({ avaliacoes }: Props) {
  const analysis = useMemo(() => {
    if (avaliacoes.length < 2) return null;
    const n = avaliacoes.length;

    // ── Split into 1ª avaliação vs reavaliações per paciente ────────────
    const byPaciente: Record<string, AvaliacaoRaw[]> = {};
    avaliacoes.forEach(a => {
      const pid = a.paciente_id || 'unknown';
      if (!byPaciente[pid]) byPaciente[pid] = [];
      byPaciente[pid].push(a);
    });
    // Sort each patient's evaluations by created_at
    Object.values(byPaciente).forEach(arr => {
      arr.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    });
    const primeiras: AvaliacaoRaw[] = [];
    const reavaliacoes: AvaliacaoRaw[] = [];
    Object.values(byPaciente).forEach(arr => {
      if (arr.length > 0) primeiras.push(arr[0]);
      if (arr.length > 1) reavaliacoes.push(...arr.slice(1));
    });
    const totalPacientes = Object.keys(byPaciente).length;
    const pacientesComReav = Object.values(byPaciente).filter(arr => arr.length > 1).length;

    // Helper: compute avg scores for a subset
    const avgScores = (subset: AvaliacaoRaw[]) => {
      if (subset.length === 0) return { D: 0, EFI: 0, R: 0, C: 0, P: 0, I: 0, N: 0, ID: 0 };
      const avg = (key: string) => {
        const vals = subset.map(a => Number((a as any)[key] || 0));
        return vals.reduce((s, v) => s + v, 0) / vals.length;
      };
      return { D: avg('score_d'), EFI: avg('score_efi'), R: avg('score_r'), C: avg('score_c'), P: avg('score_p'), I: avg('score_i'), N: avg('score_n'), ID: avg('id_final') };
    };
    const scoresPrimeira = avgScores(primeiras);
    const scoresReav = avgScores(reavaliacoes);

    // Classification distribution for each group
    const classDistrib = (subset: AvaliacaoRaw[]) => {
      const dist: Record<string, number> = {};
      subset.forEach(a => { if (a.classificacao) dist[a.classificacao] = (dist[a.classificacao] || 0) + 1; });
      return dist;
    };
    const classPrimeira = classDistrib(primeiras);
    const classReav = classDistrib(reavaliacoes);

    // Per-patient deltas (last - first)
    const deltas: { D: number; EFI: number; R: number; C: number; P: number; I: number; N: number; ID: number }[] = [];
    Object.values(byPaciente).forEach(arr => {
      if (arr.length < 2) return;
      const first = arr[0];
      const last = arr[arr.length - 1];
      deltas.push({
        D: Number(last.score_d || 0) - Number(first.score_d || 0),
        EFI: Number(last.score_efi || 0) - Number(first.score_efi || 0),
        R: Number(last.score_r || 0) - Number(first.score_r || 0),
        C: Number(last.score_c || 0) - Number(first.score_c || 0),
        P: Number(last.score_p || 0) - Number(first.score_p || 0),
        I: Number(last.score_i || 0) - Number(first.score_i || 0),
        N: Number(last.score_n || 0) - Number(first.score_n || 0),
        ID: Number(last.id_final || 0) - Number(first.id_final || 0),
      });
    });
    const avgDelta = (key: 'D' | 'EFI' | 'R' | 'C' | 'P' | 'I' | 'N' | 'ID') => {
      if (deltas.length === 0) return 0;
      return deltas.reduce((s, d) => s + d[key], 0) / deltas.length;
    };
    const deltaMeans = { D: avgDelta('D'), EFI: avgDelta('EFI'), R: avgDelta('R'), C: avgDelta('C'), P: avgDelta('P'), I: avgDelta('I'), N: avgDelta('N'), ID: avgDelta('ID') };

    // Improvement rate (% of patients who improved ID) — MyID-100: higher = better, so positive delta = improvement
    const improved = deltas.filter(d => d.ID > 0).length;
    const worsened = deltas.filter(d => d.ID < 0).length;
    const stable = deltas.filter(d => d.ID === 0).length;

    // ── Original analyses (use ALL avaliacoes) ──────────────────────────

    // 1. Extract score arrays
    const scoreArrays: Record<string, number[]> = {};
    SCORE_KEYS.forEach(k => {
      scoreArrays[k] = avaliacoes.map(a => Number((a as any)[k] || 0));
    });

    // 2. Correlation matrix (upper triangle)
    const correlations: { x: string; y: string; r: number }[] = [];
    for (let i = 0; i < SCORE_KEYS.length; i++) {
      for (let j = i + 1; j < SCORE_KEYS.length; j++) {
        const kx = SCORE_KEYS[i], ky = SCORE_KEYS[j];
        const r = pearson(scoreArrays[kx], scoreArrays[ky]);
        correlations.push({ x: kx, y: ky, r });
      }
    }
    correlations.sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    // 3. Pain region × classification cross-tab
    const regionClassCross: Record<string, Record<string, number>> = {};
    avaliacoes.forEach(a => {
      const cls = a.classificacao || 'N/A';
      try {
        const d = a.dados_avaliacao as any;
        if (d?.bloco2?.regioes) {
          (d.bloco2.regioes as any[]).forEach(r => {
            const nome = r.nome || r.id;
            if (!nome) return;
            if (!regionClassCross[nome]) regionClassCross[nome] = {};
            regionClassCross[nome][cls] = (regionClassCross[nome][cls] || 0) + 1;
          });
        }
      } catch {}
    });
    const topRegionsCross = Object.entries(regionClassCross)
      .sort((a, b) => {
        const sa = Object.values(a[1]).reduce((x, y) => x + y, 0);
        const sb = Object.values(b[1]).reduce((x, y) => x + y, 0);
        return sb - sa;
      })
      .slice(0, 8);
    const allClasses = [...new Set(avaliacoes.map(a => a.classificacao || 'N/A'))].sort();

    // 4. Comorbidity × mean scores
    const comorbScores: Record<string, { count: number; sumD: number; sumP: number; sumR: number; sumC: number; sumID: number }> = {};
    avaliacoes.forEach(a => {
      try {
        const d = a.dados_avaliacao as any;
        if (d?.bloco1?.historicoMedico) {
          (d.bloco1.historicoMedico as string[]).forEach(c => {
            if (!c) return;
            if (!comorbScores[c]) comorbScores[c] = { count: 0, sumD: 0, sumP: 0, sumR: 0, sumC: 0, sumID: 0 };
            comorbScores[c].count++;
            comorbScores[c].sumD += Number(a.score_d || 0);
            comorbScores[c].sumP += Number(a.score_p || 0);
            comorbScores[c].sumR += Number(a.score_r || 0);
            comorbScores[c].sumC += Number(a.score_c || 0);
            comorbScores[c].sumID += Number(a.id_final || 0);
          });
        }
      } catch {}
    });
    const topComorbCross = Object.entries(comorbScores)
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([nome, v]) => ({
        nome, count: v.count,
        avgD: v.sumD / v.count, avgP: v.sumP / v.count,
        avgR: v.sumR / v.count, avgC: v.sumC / v.count,
        avgID: v.sumID / v.count,
      }));

    // 5. TSK response aggregation (Bloco 4)
    const tskTotals = new Array(11).fill(0).map(() => [0, 0, 0, 0]);
    let tskCount = 0;
    avaliacoes.forEach(a => {
      try {
        const d = a.dados_avaliacao as any;
        if (d?.bloco4?.respostas && Array.isArray(d.bloco4.respostas)) {
          tskCount++;
          d.bloco4.respostas.forEach((resp: number, idx: number) => {
            if (idx < 11 && resp >= 1 && resp <= 4) {
              tskTotals[idx][resp - 1]++;
            }
          });
        }
      } catch {}
    });
    const tskAnalysis = tskTotals.map((counts, idx) => {
      const total = counts.reduce((a: number, b: number) => a + b, 0);
      const concordam = total > 0 ? ((counts[2] + counts[3]) / total) * 100 : 0;
      return { item: TSK_ITEMS_SHORT[idx], counts, total, concordam };
    });

    // 6. Pain type × intensity cross
    const painTypeCross: Record<string, { count: number; intensidadeTotal: number }> = {};
    avaliacoes.forEach(a => {
      try {
        const d = a.dados_avaliacao as any;
        if (d?.bloco2?.regioes) {
          (d.bloco2.regioes as any[]).forEach(r => {
            (r.tipos || []).forEach((t: string) => {
              if (!painTypeCross[t]) painTypeCross[t] = { count: 0, intensidadeTotal: 0 };
              painTypeCross[t].count++;
              painTypeCross[t].intensidadeTotal += Number(r.intensidade || 0);
            });
          });
        }
      } catch {}
    });
    const topPainTypes = Object.entries(painTypeCross)
      .sort((a, b) => b[1].count - a[1].count)
      .map(([nome, v]) => ({ nome, count: v.count, mediaIntensidade: v.count > 0 ? v.intensidadeTotal / v.count : 0 }));

    // 7. Risk factor prevalence (aligned with MyID-100 v2.0 trigger thresholds)
    // In v2, scores are loss-based (higher = worse for dimensions). Triggers: R≥7.0, AF≥7.0, ERG≥8.0
    const riskFactors = {
      regulacaoCritica: avaliacoes.filter(a => {
        try { const d = a.dados_avaliacao as any; return Number(d?.bloco5?.scoreR || a.score_r || 0) >= 7.0; } catch { return false; }
      }).length,
      afCritica: avaliacoes.filter(a => {
        try { const d = a.dados_avaliacao as any; return Number(d?.resultado?.componentScores?.AF || 0) >= 7.0; } catch { return false; }
      }).length,
      ergCritica: avaliacoes.filter(a => {
        try { const d = a.dados_avaliacao as any; return Number(d?.resultado?.componentScores?.ERG || 0) >= 8.0; } catch { return false; }
      }).length,
      dorIntensa: avaliacoes.filter(a => Number(a.score_d || 0) >= 7.0).length,
      criticoOuPior: avaliacoes.filter(a => ['Crítico'].includes(a.classificacao || '')).length,
      redFlagsDetected: avaliacoes.filter(a => {
        try { const d = a.dados_avaliacao as any; return d?.resultado?.redFlagsDetected || a.dados_avaliacao?.red_flags; } catch { return false; }
      }).length,
    };

    // 8. Functionality breakdown by classification
    const funcByClass: Record<string, { count: number; sumTrab: number; sumExerc: number; sumDom: number; sumSoc: number; sumInd: number }> = {};
    avaliacoes.forEach(a => {
      const cls = a.classificacao || 'N/A';
      try {
        const d = a.dados_avaliacao as any;
        if (d?.bloco3) {
          if (!funcByClass[cls]) funcByClass[cls] = { count: 0, sumTrab: 0, sumExerc: 0, sumDom: 0, sumSoc: 0, sumInd: 0 };
          funcByClass[cls].count++;
          funcByClass[cls].sumTrab += Number(d.bloco3.trabalho || 0);
          funcByClass[cls].sumExerc += Number(d.bloco3.exercicio || 0);
          funcByClass[cls].sumDom += Number(d.bloco3.domesticas || 0);
          funcByClass[cls].sumSoc += Number(d.bloco3.vidaSocial || 0);
          funcByClass[cls].sumInd += Number(d.bloco3.independencia || 0);
        }
      } catch {}
    });

    return {
      n, correlations, topRegionsCross, allClasses,
      topComorbCross, tskAnalysis, tskCount,
      topPainTypes, riskFactors, funcByClass,
      // New: 1ª vs reavaliação
      totalPacientes, pacientesComReav,
      primeiras, reavaliacoes,
      scoresPrimeira, scoresReav,
      classPrimeira, classReav,
      deltaMeans, deltas,
      improved, worsened, stable,
    };
  }, [avaliacoes]);

  if (!analysis) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        São necessárias pelo menos 2 avaliações para gerar relações epidemiológicas.
      </div>
    );
  }

  const classOrder = ['Excelente', 'Bom', 'Moderado', 'Crítico'];
  const classColors: Record<string, string> = {
    Excelente: 'bg-emerald-200 text-emerald-800',
    Bom: 'bg-yellow-200 text-yellow-800',
    Moderado: 'bg-orange-200 text-orange-800',
    'Crítico': 'bg-red-200 text-red-800',
    'N/A': 'bg-slate-200 text-slate-600',
  };

  return (
    <Tabs defaultValue="longitudinal" className="w-full">
      <TabsList className="grid grid-cols-6 mb-4">
        <TabsTrigger value="longitudinal" className="text-[10px] sm:text-xs">1ª vs Reav.</TabsTrigger>
        <TabsTrigger value="correlacoes" className="text-[10px] sm:text-xs">Correlações</TabsTrigger>
        <TabsTrigger value="crosstab" className="text-[10px] sm:text-xs">Dor × Class.</TabsTrigger>
        <TabsTrigger value="comorbidades" className="text-[10px] sm:text-xs">Comorb. × Scores</TabsTrigger>
        <TabsTrigger value="tsk" className="text-[10px] sm:text-xs">Padrões TSK</TabsTrigger>
        <TabsTrigger value="risco" className="text-[10px] sm:text-xs">Fatores Risco</TabsTrigger>
      </TabsList>

      {/* LONGITUDINAL: 1ª AVALIAÇÃO vs REAVALIAÇÕES */}
      <TabsContent value="longitudinal">
        <div className="mb-4 p-3 rounded-lg border bg-accent/5">
          <div className="flex items-start gap-2">
            <Layers className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              <strong>Desenho longitudinal:</strong> Compara os resultados da 1ª avaliação de cada paciente com suas reavaliações subsequentes.
              {' '}n total = {analysis.n} avaliações · {analysis.totalPacientes} pacientes · {analysis.pacientesComReav} com reavaliação
              {' '}· {analysis.primeiras.length} primeiras avaliações · {analysis.reavaliacoes.length} reavaliações
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border bg-card p-3 text-center">
            <div className="text-[10px] font-medium text-muted-foreground mb-1">Pacientes</div>
            <div className="text-xl font-black text-foreground">{analysis.totalPacientes}</div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center">
            <div className="text-[10px] font-medium text-muted-foreground mb-1">Com Reavaliação</div>
            <div className="text-xl font-black text-primary">{analysis.pacientesComReav}</div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center">
            <div className="text-[10px] font-medium text-muted-foreground mb-1">Melhoraram (MyID↑)</div>
            <div className="text-xl font-black text-emerald-600">{analysis.improved} <span className="text-xs font-normal text-muted-foreground">({analysis.deltas.length > 0 ? ((analysis.improved / analysis.deltas.length) * 100).toFixed(0) : 0}%)</span></div>
          </div>
          <div className="rounded-xl border bg-card p-3 text-center">
            <div className="text-[10px] font-medium text-muted-foreground mb-1">Pioraram (MyID↓)</div>
            <div className="text-xl font-black text-red-600">{analysis.worsened} <span className="text-xs font-normal text-muted-foreground">({analysis.deltas.length > 0 ? ((analysis.worsened / analysis.deltas.length) * 100).toFixed(0) : 0}%)</span></div>
          </div>
        </div>

        {/* Comparative scores table */}
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5" /> Scores Médios: 1ª Avaliação vs Reavaliações
        </h4>
        <div className="overflow-x-auto mb-5">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-1 text-muted-foreground">Score</th>
                <th className="text-center py-2 px-1 text-muted-foreground">μ 1ª Aval. (n={analysis.primeiras.length})</th>
                <th className="text-center py-2 px-1 text-muted-foreground">μ Reavaliações (n={analysis.reavaliacoes.length})</th>
                <th className="text-center py-2 px-1 text-muted-foreground">Δ Média</th>
                <th className="text-center py-2 px-1 text-muted-foreground">Direção</th>
              </tr>
            </thead>
            <tbody>
              {(['D', 'EFI', 'R', 'C', 'P', 'I', 'N', 'ID'] as const).map(key => {
                const first = analysis.scoresPrimeira[key];
                const reav = analysis.reavaliacoes.length > 0 ? analysis.scoresReav[key] : null;
                const delta = reav != null ? reav - first : null;
                const labels: Record<string, string> = {
                  D: 'Dor', EFI: 'Função', R: 'Regulação', C: 'Contexto',
                  P: 'Comportamento', I: 'Inércia', N: 'Ruído', ID: 'MyID-100',
                };
                // For MyID-100 (ID): higher = better, so positive delta = improvement
                // For dimension scores (loss-based): lower = better, so negative delta = improvement
                const isMyID = key === 'ID';
                const isImproved = isMyID ? (delta != null && delta > 0.3) : (delta != null && delta < -0.3);
                const isWorsened = isMyID ? (delta != null && delta < -0.3) : (delta != null && delta > 0.3);
                return (
                  <tr key={key} className="border-b border-border/30 hover:bg-accent/10">
                    <td className="py-2 px-1 font-medium text-foreground">{labels[key]} ({key})</td>
                    <td className="text-center py-2 px-1 font-bold">{first.toFixed(1)}</td>
                    <td className="text-center py-2 px-1 font-bold">{reav != null ? reav.toFixed(1) : '—'}</td>
                    <td className={`text-center py-2 px-1 font-bold ${isImproved ? 'text-emerald-600' : isWorsened ? 'text-red-600' : ''}`}>
                      {delta != null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}` : '—'}
                    </td>
                    <td className="text-center py-2 px-1">
                      {isImproved ? <TrendingUp className="h-3.5 w-3.5 text-emerald-600 mx-auto" /> :
                       isWorsened ? <TrendingUp className="h-3.5 w-3.5 text-red-500 mx-auto rotate-180" /> :
                       <span className="text-muted-foreground text-[10px]">≈</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Delta per patient (mean variation) */}
        {analysis.deltas.length > 0 && (
          <>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <GitBranch className="h-3.5 w-3.5" /> Variação Média por Paciente (Última − 1ª)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 mb-5">
              {(['D', 'EFI', 'R', 'C', 'P', 'I', 'N', 'ID'] as const).map(key => {
                const d = analysis.deltaMeans[key];
                const isMyID = key === 'ID';
                const isImproved = isMyID ? d > 0.3 : d < -0.3;
                const isWorsened = isMyID ? d < -0.3 : d > 0.3;
                return (
                  <div key={key} className="rounded-xl border bg-card p-3 text-center">
                    <div className="text-[10px] font-semibold text-muted-foreground mb-1">{key}</div>
                    <div className={`text-lg font-black ${isImproved ? 'text-emerald-600' : isWorsened ? 'text-red-600' : 'text-foreground'}`}>
                      {d > 0 ? '+' : ''}{d.toFixed(1)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">
                      {isImproved ? (isMyID ? '↑ melhora' : '↓ melhora') : isWorsened ? (isMyID ? '↓ piora' : '↑ piora') : '≈ estável'}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Classification shift */}
        {analysis.reavaliacoes.length > 0 && (
          <>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5" /> Distribuição de Classificações: 1ª vs Reavaliações
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 text-muted-foreground">Classificação</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">1ª Avaliação</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">%</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">Reavaliações</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">%</th>
                  </tr>
                </thead>
                <tbody>
                  {classOrder.map(cls => {
                    const cp = analysis.classPrimeira[cls] || 0;
                    const cr = analysis.classReav[cls] || 0;
                    const pctP = analysis.primeiras.length > 0 ? ((cp / analysis.primeiras.length) * 100).toFixed(0) : '0';
                    const pctR = analysis.reavaliacoes.length > 0 ? ((cr / analysis.reavaliacoes.length) * 100).toFixed(0) : '0';
                    if (cp === 0 && cr === 0) return null;
                    return (
                      <tr key={cls} className="border-b border-border/30">
                        <td className="py-1.5 px-1"><Badge className={`text-[9px] ${classColors[cls]}`}>{cls}</Badge></td>
                        <td className="text-center py-1.5 px-1 font-bold">{cp}</td>
                        <td className="text-center py-1.5 px-1 text-muted-foreground">{pctP}%</td>
                        <td className="text-center py-1.5 px-1 font-bold">{cr}</td>
                        <td className="text-center py-1.5 px-1 text-muted-foreground">{pctR}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-4 p-3 rounded-lg border bg-accent/5">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              <strong>Para estudos científicos (MyID-100):</strong> Δ positivo no MyID-100 = melhora clínica (escala 0-100, maior=melhor). 
              Δ negativo nas dimensões (D, R, P, etc.) = melhora (escala de perdas, menor=melhor). 
              Use estes dados para análise pareada (teste t pareado / Wilcoxon). 
              Taxa de melhora na amostra (n={analysis.deltas.length} pacientes com reavaliação).
            </p>
          </div>
        </div>
      </TabsContent>

      {/* CORRELAÇÕES */}
      <TabsContent value="correlacoes">
        <div className="mb-3">
          <p className="text-xs text-muted-foreground">
            Correlação de Pearson (r) entre scores biopsicossociais · n={analysis.n} · Ordenado por magnitude
          </p>
        </div>
        <div className="space-y-1.5">
          {analysis.correlations.slice(0, 15).map(c => {
            const interp = interpretR(c.r);
            const barW = Math.abs(c.r) * 100;
            return (
              <div key={`${c.x}-${c.y}`} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-accent/10">
                <div className="flex items-center gap-1 w-44 sm:w-56 shrink-0">
                  <span className="text-[10px] font-medium text-foreground truncate">{SCORE_LABELS[c.x]}</span>
                  <ArrowUpDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] font-medium text-foreground truncate">{SCORE_LABELS[c.y]}</span>
                </div>
                <div className="flex-1 flex items-center gap-1.5">
                  <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all ${c.r > 0 ? 'bg-red-400' : 'bg-blue-400'}`}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                  <span className={`text-xs font-mono font-bold w-12 text-right ${interp.color}`}>
                    {c.r > 0 ? '+' : ''}{c.r.toFixed(2)}
                  </span>
                  <Badge variant="outline" className={`text-[9px] px-1 py-0 ${interp.color}`}>
                    {interp.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 p-3 rounded-lg border bg-accent/5">
          <div className="flex items-start gap-2">
            <BarChart3 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <p><span className="text-red-500 font-bold">r positivo</span> = quando um sobe, o outro também sobe</p>
              <p><span className="text-blue-500 font-bold">r negativo</span> = relação inversa (quando um sobe, o outro desce)</p>
              <p>|r| ≥ 0.7 = Forte · |r| ≥ 0.4 = Moderada · |r| ≥ 0.2 = Fraca · |r| &lt; 0.2 = Negligível</p>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* CROSS-TAB: DOR × CLASSIFICAÇÃO */}
      <TabsContent value="crosstab">
        <p className="text-xs text-muted-foreground mb-3">
          Regiões de dor mais frequentes × Classificação de severidade · n={analysis.n}
        </p>
        {analysis.topRegionsCross.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-1 font-semibold text-muted-foreground w-32">Região</th>
                  {classOrder.filter(c => analysis.allClasses.includes(c)).map(cls => (
                    <th key={cls} className="text-center py-2 px-1">
                      <Badge className={`text-[9px] ${classColors[cls]}`}>{cls}</Badge>
                    </th>
                  ))}
                  <th className="text-center py-2 px-1 font-semibold text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {analysis.topRegionsCross.map(([nome, counts]) => {
                  const total = Object.values(counts).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={nome} className="border-b border-border/30 hover:bg-accent/10">
                      <td className="py-1.5 px-1 font-medium text-foreground truncate max-w-[150px]">{nome}</td>
                      {classOrder.filter(c => analysis.allClasses.includes(c)).map(cls => (
                        <td key={cls} className="text-center py-1.5 px-1">
                          {counts[cls] ? (
                            <span className="font-bold">{counts[cls]}</span>
                          ) : (
                            <span className="text-muted-foreground/30">–</span>
                          )}
                        </td>
                      ))}
                      <td className="text-center py-1.5 px-1 font-bold text-primary">{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem dados suficientes.</p>
        )}

        {/* Pain types */}
        {analysis.topPainTypes.length > 0 && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> Tipos de Dor × Intensidade Média
            </h4>
            <div className="space-y-2">
              {analysis.topPainTypes.map(t => (
                <div key={t.nome} className="flex items-center gap-3">
                  <span className="text-xs font-medium text-foreground w-28 truncate">{t.nome}</span>
                  <div className="flex-1">
                    <Progress value={t.mediaIntensidade * 10} className="h-2" />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">
                    μ={t.mediaIntensidade.toFixed(1)} · {t.count}x
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Funcionalidade por classificação */}
        {Object.keys(analysis.funcByClass).length > 0 && (
          <div className="mt-5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" /> Funcionalidade Média por Classificação
            </h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-1 text-muted-foreground">Classificação</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">n</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">Trabalho</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">Exercício</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">Domésticas</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">Social</th>
                    <th className="text-center py-2 px-1 text-muted-foreground">Independ.</th>
                  </tr>
                </thead>
                <tbody>
                  {classOrder.filter(c => analysis.funcByClass[c]).map(cls => {
                    const fc = analysis.funcByClass[cls];
                    return (
                      <tr key={cls} className="border-b border-border/30">
                        <td className="py-1.5 px-1"><Badge className={`text-[9px] ${classColors[cls]}`}>{cls}</Badge></td>
                        <td className="text-center py-1.5 px-1 font-bold">{fc.count}</td>
                        <td className="text-center py-1.5 px-1">{(fc.sumTrab / fc.count).toFixed(1)}</td>
                        <td className="text-center py-1.5 px-1">{(fc.sumExerc / fc.count).toFixed(1)}</td>
                        <td className="text-center py-1.5 px-1">{(fc.sumDom / fc.count).toFixed(1)}</td>
                        <td className="text-center py-1.5 px-1">{(fc.sumSoc / fc.count).toFixed(1)}</td>
                        <td className="text-center py-1.5 px-1">{(fc.sumInd / fc.count).toFixed(1)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </TabsContent>

      {/* COMORBIDADES × SCORES */}
      <TabsContent value="comorbidades">
        <p className="text-xs text-muted-foreground mb-3">
          Scores médios por comorbidade (n≥2) · Identifica perfis de risco associados a condições pré-existentes
        </p>
        {analysis.topComorbCross.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-1 text-muted-foreground w-36">Comorbidade</th>
                  <th className="text-center py-2 px-1 text-muted-foreground">n</th>
                  <th className="text-center py-2 px-1 text-muted-foreground">μ D</th>
                  <th className="text-center py-2 px-1 text-muted-foreground">μ P</th>
                  <th className="text-center py-2 px-1 text-muted-foreground">μ R</th>
                  <th className="text-center py-2 px-1 text-muted-foreground">μ C</th>
                  <th className="text-center py-2 px-1 text-muted-foreground font-bold">μ MyID</th>
                </tr>
              </thead>
              <tbody>
                {analysis.topComorbCross.map(c => (
                  <tr key={c.nome} className="border-b border-border/30 hover:bg-accent/10">
                    <td className="py-1.5 px-1 font-medium text-foreground truncate max-w-[150px]">{c.nome}</td>
                    <td className="text-center py-1.5 px-1 font-bold">{c.count}</td>
                    <td className="text-center py-1.5 px-1">{c.avgD.toFixed(1)}</td>
                    <td className="text-center py-1.5 px-1">{c.avgP.toFixed(1)}</td>
                    <td className="text-center py-1.5 px-1">{c.avgR.toFixed(1)}</td>
                    <td className="text-center py-1.5 px-1">{c.avgC.toFixed(1)}</td>
                    <td className="text-center py-1.5 px-1 font-bold text-primary">{c.avgID.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">São necessárias pelo menos 2 avaliações com a mesma comorbidade.</p>
        )}

        <div className="mt-4 p-3 rounded-lg border bg-accent/5">
          <div className="flex items-start gap-2">
            <GitBranch className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              <strong>Leitura (MyID-100):</strong> Compare os scores médios (μ) entre comorbidades. 
              Comorbidades com MyID-100 mais baixo indicam populações com maior comprometimento global.
              R alto sugere desregulação neurovegetativa associada; P alto indica comportamento evitativo.
            </p>
          </div>
        </div>
      </TabsContent>

      {/* PADRÕES TSK (Cinesiofobia) */}
      <TabsContent value="tsk">
        <p className="text-xs text-muted-foreground mb-3">
          Padrão de respostas TSK-11 · {analysis.tskCount} questionários · Itens com maior concordância = crenças mais prevalentes
        </p>
        {analysis.tskCount > 0 ? (
          <div className="space-y-2">
            {analysis.tskAnalysis
              .sort((a, b) => b.concordam - a.concordam)
              .map((t, idx) => (
                <div key={idx} className={`rounded-lg border p-3 ${t.concordam > 60 ? 'border-red-200 bg-red-50/50 dark:bg-red-950/20' : t.concordam > 40 ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/20' : 'bg-card'}`}>
                  <div className="flex items-start gap-2 mb-2">
                    {t.concordam > 60 && <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />}
                    <p className="text-xs font-medium text-foreground flex-1">{t.item}</p>
                    <span className={`text-xs font-bold ${t.concordam > 60 ? 'text-red-600' : t.concordam > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      {t.concordam.toFixed(0)}% concordam
                    </span>
                  </div>
                  <div className="flex gap-1 h-5">
                    {['Disc. Fort.', 'Discordo', 'Concordo', 'Conc. Fort.'].map((label, i) => {
                      const pct = t.total > 0 ? (t.counts[i] / t.total) * 100 : 0;
                      const colors = ['bg-emerald-400', 'bg-green-300', 'bg-amber-400', 'bg-red-400'];
                      return pct > 0 ? (
                        <div
                          key={i}
                          className={`${colors[i]} rounded-sm flex items-center justify-center transition-all`}
                          style={{ width: `${pct}%` }}
                          title={`${label}: ${t.counts[i]} (${pct.toFixed(0)}%)`}
                        >
                          {pct > 12 && <span className="text-[8px] font-bold text-white">{pct.toFixed(0)}%</span>}
                        </div>
                      ) : null;
                    })}
                  </div>
                  <div className="flex gap-3 mt-1">
                    {['Disc. Fort.', 'Discordo', 'Concordo', 'Conc. Fort.'].map((label, i) => (
                      <span key={i} className="text-[8px] text-muted-foreground">{label}: {t.counts[i]}</span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Nenhum dado TSK-11 disponível.</p>
        )}
      </TabsContent>

      {/* FATORES DE RISCO */}
      <TabsContent value="risco">
        <p className="text-xs text-muted-foreground mb-3">
          Prevalência de fatores de risco na amostra · n={analysis.n}
        </p>
        <div className="space-y-3">
          {[
            { label: 'Alta Cinesiofobia (P > 7.5)', count: analysis.riskFactors.altaCinesiofobia, desc: '+2 ao ID final · Recomendado: educação em dor e graded exposure', icon: Brain, danger: true },
            { label: 'Carga Contextual Excessiva (C > 8)', count: analysis.riskFactors.cargaExcessiva, desc: '+2 ao ID final · Fatores psicossociais dominantes', icon: Shield, danger: true },
            { label: 'Regulação Crítica (R < 2)', count: analysis.riskFactors.regulacaoCritica, desc: '+3 ao ID final · Desregulação neurovegetativa severa', icon: Activity, danger: true },
            { label: 'Dor Intensa (D > 8)', count: analysis.riskFactors.dorIntensa, desc: '+1 ao ID final · Componente nociceptivo significativo', icon: Heart, danger: false },
            { label: 'Classificação ≥ SEVERO', count: analysis.riskFactors.severoOuPior, desc: 'Pacientes que demandam protocolo intensivo', icon: AlertTriangle, danger: true },
          ].map(rf => {
            const Icon = rf.icon;
            const pct = analysis.n > 0 ? (rf.count / analysis.n) * 100 : 0;
            return (
              <div key={rf.label} className={`rounded-xl border p-4 ${rf.count > 0 && rf.danger ? 'border-red-200 bg-red-50/30 dark:bg-red-950/10' : 'bg-card'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${rf.count > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted'}`}>
                    <Icon className={`h-4 w-4 ${rf.count > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-foreground">{rf.label}</div>
                    <div className="text-[10px] text-muted-foreground">{rf.desc}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-foreground">{rf.count}</div>
                    <div className="text-[10px] text-muted-foreground">{pct.toFixed(0)}% da amostra</div>
                  </div>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })}
        </div>

        <div className="mt-4 p-3 rounded-lg border bg-accent/5">
          <div className="flex items-start gap-2">
            <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground">
              <strong>Para estudos científicos:</strong> Estes dados representam a prevalência amostral dos fatores de risco 
              definidos pelo Método Identidade. Use as correlações de Pearson (aba Correlações) para análise de associação bivariada. 
              Para publicações, considere tamanho amostral (n={analysis.n}), intervalos de confiança e testes de significância (p-valor).
            </p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
