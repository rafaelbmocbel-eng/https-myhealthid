import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Download, FileText, Users, Activity, AlertTriangle, TrendingUp, FlaskConical, FileDown } from 'lucide-react';
import { exportToCsv } from '@/utils/exportCsv';
import { gerarPdfResearchReport } from '@/utils/pdfResearchReport';
import { toast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from 'recharts';
import { differenceInYears, parseISO, format } from 'date-fns';
import DashboardFilters, { DEFAULT_FILTERS, DashboardFilterState, periodToDate, sexoMatch, ageInFaixa } from './DashboardFilters';

const PALETTE = ['hsl(var(--primary))', 'hsl(var(--accent))', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16'];

const DIMENSOES = [
  { key: 'score_i', label: 'Identidade (I)' },
  { key: 'score_n', label: 'Neurológica (N)' },
  { key: 'score_r', label: 'Respiratória (R)' },
  { key: 'score_d', label: 'Dor (D)' },
  { key: 'score_f', label: 'Funcional (F)' },
  { key: 'score_e', label: 'Emocional (E)' },
  { key: 'score_efi', label: 'Eficiência (EFI)' },
  { key: 'score_c', label: 'Comportamental (C)' },
  { key: 'score_p', label: 'Postural (P)' },
] as const;

type Avaliacao = Record<string, any>;
type Paciente = { id: string; nome: string; sobrenome: string; data_nascimento: string | null; genero: string | null; created_at: string };
type Voz = Record<string, any>;

function age(dn?: string | null): number | null {
  if (!dn) return null;
  try { return differenceInYears(new Date(), parseISO(dn)); } catch { return null; }
}

function mean(arr: number[]): number {
  const v = arr.filter(n => Number.isFinite(n));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}
function sd(arr: number[]): number {
  const v = arr.filter(n => Number.isFinite(n));
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}
function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;
  const mx = mean(x), my = mean(y);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { const a = x[i]-mx, b = y[i]-my; num += a*b; dx += a*a; dy += b*b; }
  const den = Math.sqrt(dx * dy);
  return den ? +(num / den).toFixed(3) : 0;
}
function cohensD(pre: number[], post: number[]): number {
  if (pre.length < 2 || post.length < 2) return 0;
  const m1 = mean(pre), m2 = mean(post);
  const s1 = sd(pre), s2 = sd(post);
  const sp = Math.sqrt(((pre.length-1)*s1*s1 + (post.length-1)*s2*s2) / (pre.length + post.length - 2));
  return sp ? +((m2 - m1) / sp).toFixed(3) : 0;
}
function interpretD(d: number): string {
  const a = Math.abs(d);
  if (a < 0.2) return 'trivial';
  if (a < 0.5) return 'pequeno';
  if (a < 0.8) return 'médio';
  return 'grande';
}
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x*x/2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
function pairedT(pre: number[], post: number[]) {
  const n = Math.min(pre.length, post.length);
  if (n < 2) return { t: 0, p: 1, df: 0, mean_diff: 0, ci_low: 0, ci_high: 0, n: 0 };
  const diffs: number[] = [];
  for (let i = 0; i < n; i++) { const d = post[i] - pre[i]; if (Number.isFinite(d)) diffs.push(d); }
  const m = mean(diffs); const s = sd(diffs);
  const se = s / Math.sqrt(diffs.length);
  const t = se ? m / se : 0;
  const p = 2 * (1 - normalCdf(Math.abs(t)));
  const margin = 1.96 * se;
  return { t: +t.toFixed(3), p: +p.toFixed(4), df: diffs.length-1, mean_diff: +m.toFixed(2), ci_low: +(m-margin).toFixed(2), ci_high: +(m+margin).toFixed(2), n: diffs.length };
}
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ('0000000' + (h >>> 0).toString(16)).slice(-8);
}
function pSig(p: number): string { if (p < 0.001) return '<0.001'; return p.toFixed(3); }

export default function ResearchDashboard() {
  const { user } = useAuth();
  const [tab, setTab] = useState('demografia');
  const [filters, setFilters] = useState<DashboardFilterState>(DEFAULT_FILTERS);

  const { data, isLoading } = useQuery({
    queryKey: ['research-data', user?.id],
    queryFn: async () => {
      const [pac, ava, voz, prot] = await Promise.all([
        supabase.from('pacientes').select('id, nome, sobrenome, data_nascimento, genero, created_at, ativo').eq('terapeuta_id', user!.id),
        supabase.from('avaliacoes_identidade').select('*').eq('terapeuta_id', user!.id),
        supabase.from('avaliacoes_voz').select('*').eq('terapeuta_id', user!.id),
        (supabase as any).from('protocolos').select('id, paciente_id, titulo, status, data_inicio, data_fim_prevista, duracao_total, frequencia, objetivo_geral, scores_avaliacao, created_at').eq('terapeuta_id', user!.id),
      ]);
      return {
        pacientes: (pac.data || []) as Paciente[],
        avaliacoes: (ava.data || []) as Avaliacao[],
        voz: (voz.data || []) as Voz[],
        protocolos: (prot.data || []) as any[],
      };
    },
    enabled: !!user,
  });

  const stats = useMemo(() => {
    if (!data) return null;
    const cut = periodToDate(filters.period);
    const inP = (iso?: string | null) => !cut || (iso ? new Date(iso) >= cut : false);

    // Filtra pacientes por subgrupo
    const allPac = data.pacientes.filter(p => sexoMatch(p.genero, filters.sexo) && ageInFaixa(age(p.data_nascimento), filters.faixa));
    const pacIds = new Set(allPac.map(p => p.id));

    const avaliacoes = data.avaliacoes.filter(a => pacIds.has(a.paciente_id) && inP(a.created_at));
    const voz = data.voz.filter(v => pacIds.has(v.paciente_id) && inP(v.created_at));
    const protocolos = data.protocolos.filter(pr => pacIds.has(pr.paciente_id) && inP(pr.created_at));

    const withMyID = new Set(avaliacoes.map(a => a.paciente_id));
    const sample = allPac.filter(p => withMyID.has(p.id));
    const pacientes = allPac;

    // Demografia
    const idades = sample.map(p => age(p.data_nascimento)).filter((n): n is number => n != null);
    const sexo = sample.reduce<Record<string, number>>((acc, p) => {
      const g = (p.genero || 'não informado').toLowerCase();
      acc[g] = (acc[g] || 0) + 1; return acc;
    }, {});
    const faixas: Record<string, number> = { '<18': 0, '18-29': 0, '30-44': 0, '45-59': 0, '60+': 0 };
    idades.forEach(i => {
      if (i < 18) faixas['<18']++;
      else if (i < 30) faixas['18-29']++;
      else if (i < 45) faixas['30-44']++;
      else if (i < 60) faixas['45-59']++;
      else faixas['60+']++;
    });

    // Prevalências por dimensão (médias e %críticos: score < 50)
    const dimStats = DIMENSOES.map(d => {
      const vals = avaliacoes.map(a => Number(a[d.key])).filter(Number.isFinite);
      const criticos = vals.filter(v => v < 50).length;
      return {
        dimensao: d.label,
        key: d.key,
        n: vals.length,
        media: +mean(vals).toFixed(1),
        dp: +sd(vals).toFixed(1),
        pct_criticos: vals.length ? +((criticos / vals.length) * 100).toFixed(1) : 0,
      };
    });

    // Classificações
    const classif = avaliacoes.reduce<Record<string, number>>((acc, a) => {
      const c = a.classificacao || 'sem classificação';
      acc[c] = (acc[c] || 0) + 1; return acc;
    }, {});

    // Red flags
    const totalAv = avaliacoes.length;
    const comRedFlags = avaliacoes.filter(a => Array.isArray(a.red_flags) && a.red_flags.length > 0).length;

    // Severidade voz (presencial)
    const sev = voz.reduce<Record<string, number>>((acc, v) => {
      const s = v.classificacao_severidade || 'não classificada';
      acc[s] = (acc[s] || 0) + 1; return acc;
    }, {});

    // Queixas mais comuns (tokenização simples)
    const tokens: Record<string, number> = {};
    voz.forEach(v => {
      const q = (v.queixa_principal || '').toLowerCase();
      q.split(/[,;.\s]+/).filter(t => t.length > 4).forEach(t => {
        tokens[t] = (tokens[t] || 0) + 1;
      });
    });
    const topQueixas = Object.entries(tokens).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ termo: k, n: v }));

    // Evolução temporal (avaliações por mês)
    const porMes: Record<string, number> = {};
    avaliacoes.forEach(a => {
      const m = format(parseISO(a.created_at), 'yyyy-MM');
      porMes[m] = (porMes[m] || 0) + 1;
    });
    const temporal = Object.entries(porMes).sort().map(([mes, n]) => ({ mes, n }));

    // Pré/pós: pacientes com >=2 avaliações — Cohen's d por dimensão
    const prePost = sample.map(p => {
      const avs = avaliacoes.filter(a => a.paciente_id === p.id).sort((a,b) => a.created_at.localeCompare(b.created_at));
      if (avs.length < 2) return null;
      return { pre: avs[0], post: avs[avs.length - 1] };
    }).filter(Boolean) as { pre: any; post: any }[];

    const dimCohen = DIMENSOES.map(d => {
      const pairs = prePost.map(x => ({ pre: Number(x.pre[d.key]), post: Number(x.post[d.key]) }))
        .filter(p => Number.isFinite(p.pre) && Number.isFinite(p.post));
      const pre = pairs.map(p => p.pre);
      const post = pairs.map(p => p.post);
      const dval = cohensD(pre, post);
      const tt = pairedT(pre, post);
      return {
        dimensao: d.label, key: d.key, n: pairs.length,
        media_pre: +mean(pre).toFixed(1), media_post: +mean(post).toFixed(1),
        delta: tt.mean_diff, ci: `[${tt.ci_low}; ${tt.ci_high}]`,
        cohen_d: dval, magnitude: interpretD(dval),
        t: tt.t, p: tt.p, p_label: pSig(tt.p),
        sig: tt.p < 0.05,
      };
    });

    // Subgrupos: média MyID por sexo e faixa etária
    const subSexo: Record<string, number[]> = {};
    const subFaixa: Record<string, number[]> = {};
    sample.forEach(p => {
      const avs = avaliacoes.filter(a => a.paciente_id === p.id).sort((a,b) => a.created_at.localeCompare(b.created_at));
      const last = avs[avs.length - 1];
      const score = Number(last?.myid_score);
      if (!Number.isFinite(score)) return;
      const s = (p.genero || 'não informado').toLowerCase();
      (subSexo[s] = subSexo[s] || []).push(score);
      const a = age(p.data_nascimento);
      let f = '60+';
      if (a == null) f = 'não informado';
      else if (a < 18) f = '<18';
      else if (a < 30) f = '18-29';
      else if (a < 45) f = '30-44';
      else if (a < 60) f = '45-59';
      (subFaixa[f] = subFaixa[f] || []).push(score);
    });
    const subgruposSexo = Object.entries(subSexo).map(([k, arr]) => ({ grupo: k, n: arr.length, media: +mean(arr).toFixed(1), dp: +sd(arr).toFixed(1) }));
    const subgruposFaixa = Object.entries(subFaixa).map(([k, arr]) => ({ grupo: k, n: arr.length, media: +mean(arr).toFixed(1), dp: +sd(arr).toFixed(1) }));

    // Análise por DIRETRIZ DE TRATAMENTO (protocolos)
    // Cada protocolo: pareia avaliação ANTES de data_inicio com a MAIS RECENTE depois
    const protocolosAnalise = data.protocolos.map(pr => {
      const pid = pr.paciente_id;
      const inicio = pr.data_inicio || pr.created_at?.slice(0, 10);
      if (!inicio) return null;
      const inicioDate = new Date(inicio);
      const avsAntes = data.avaliacoes.filter(a => a.paciente_id === pid && new Date(a.created_at) < inicioDate).sort((a,b) => a.created_at.localeCompare(b.created_at));
      const avsDepois = data.avaliacoes.filter(a => a.paciente_id === pid && new Date(a.created_at) >= inicioDate).sort((a,b) => a.created_at.localeCompare(b.created_at));
      const pre = avsAntes[avsAntes.length - 1];
      const post = avsDepois[avsDepois.length - 1];
      if (!pre || !post) return null;
      return {
        protocolo_id: pr.id, paciente_id: pid, titulo: pr.titulo, status: pr.status,
        duracao: pr.duracao_total, frequencia: pr.frequencia,
        myid_pre: Number(pre.myid_score), myid_post: Number(post.myid_score),
        delta: Number(post.myid_score) - Number(pre.myid_score),
        dias: Math.max(1, Math.round((new Date(post.created_at).getTime() - new Date(pre.created_at).getTime()) / 86400000)),
      };
    }).filter(Boolean) as any[];

    // Agrupado por título da diretriz
    const porDiretrizMap = new Map<string, any[]>();
    protocolosAnalise.forEach(pa => {
      const key = (pa.titulo || 'Sem título').trim();
      (porDiretrizMap.get(key) || porDiretrizMap.set(key, []).get(key)!).push(pa);
    });
    const porDiretriz = Array.from(porDiretrizMap.entries()).map(([titulo, arr]) => {
      const pre = arr.map(a => a.myid_pre).filter(Number.isFinite);
      const post = arr.map(a => a.myid_post).filter(Number.isFinite);
      const tt = pairedT(pre, post);
      return {
        titulo, n: arr.length,
        media_pre: +mean(pre).toFixed(1), media_post: +mean(post).toFixed(1),
        delta: tt.mean_diff, ci: `[${tt.ci_low}; ${tt.ci_high}]`,
        cohen_d: cohensD(pre, post), p: tt.p, p_label: pSig(tt.p),
        dias_medio: +mean(arr.map(a => a.dias)).toFixed(0),
      };
    }).sort((a, b) => b.n - a.n);

    // Status dos protocolos
    const protStatus = data.protocolos.reduce<Record<string, number>>((acc, pr) => {
      acc[pr.status || 'desconhecido'] = (acc[pr.status || 'desconhecido'] || 0) + 1;
      return acc;
    }, {});

    // Matriz de correlação entre dimensões (na última avaliação de cada paciente)
    const ultimas = sample.map(p => {
      const avs = avaliacoes.filter(a => a.paciente_id === p.id).sort((a,b) => a.created_at.localeCompare(b.created_at));
      return avs[avs.length - 1];
    }).filter(Boolean);
    const corrMatrix = DIMENSOES.map(d1 => ({
      dim: d1.label,
      cells: DIMENSOES.map(d2 => ({
        dim: d2.label,
        r: pearson(
          ultimas.map(a => Number(a[d1.key])).filter(Number.isFinite),
          ultimas.map(a => Number(a[d2.key])).filter(Number.isFinite),
        ),
      })),
    }));

    // Hash determinístico do dataset (reprodutibilidade)
    const datasetSig = sample.map(p => `${p.id.slice(0,8)}:${avaliacoes.filter(a => a.paciente_id === p.id).length}`).sort().join('|');
    const datasetHash = fnv1a(`${filters.period}|${filters.sexo}|${filters.faixa}|${datasetSig}`);

    return {
      n_pacientes_total: pacientes.length,
      n_amostra: sample.length,
      n_avaliacoes: avaliacoes.length,
      n_presencial: voz.length,
      n_protocolos: data.protocolos.length,
      idade_media: +mean(idades).toFixed(1),
      idade_dp: +sd(idades).toFixed(1),
      idade_min: idades.length ? Math.min(...idades) : 0,
      idade_max: idades.length ? Math.max(...idades) : 0,
      sexo,
      faixas: Object.entries(faixas).map(([k, v]) => ({ faixa: k, n: v })),
      dimStats,
      classif: Object.entries(classif).map(([k, v]) => ({ classificacao: k, n: v })),
      pct_red_flags: totalAv ? +((comRedFlags / totalAv) * 100).toFixed(1) : 0,
      n_red_flags: comRedFlags,
      sev: Object.entries(sev).map(([k, v]) => ({ severidade: k, n: v })),
      topQueixas,
      temporal,
      sample,
      avaliacoes,
      voz,
      dimCohen,
      corrMatrix,
      n_prepost: prePost.length,
      subgruposSexo,
      subgruposFaixa,
      porDiretriz,
      protStatus: Object.entries(protStatus).map(([k, v]) => ({ status: k, n: v })),
      protocolosAnalise,
      datasetHash,
      filtros: filters,
    };
  }, [data, filters]);

  if (isLoading || !stats) {
    return <div className="flex justify-center py-20"><Loader2 className="icon-lg animate-spin text-primary" /></div>;
  }

  // Exports
  const exportRawCSV = () => {
    const rows = stats.sample.map(p => {
      const avs = stats.avaliacoes.filter(a => a.paciente_id === p.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
      const last = avs[avs.length - 1];
      return {
        paciente_id: p.id.slice(0, 8),
        idade: age(p.data_nascimento) ?? '',
        sexo: p.genero || '',
        n_avaliacoes: avs.length,
        primeira_avaliacao: avs[0]?.created_at?.slice(0, 10) || '',
        ultima_avaliacao: last?.created_at?.slice(0, 10) || '',
        classificacao: last?.classificacao || '',
        myid_score: last?.myid_score ?? '',
        score_i: last?.score_i ?? '', score_n: last?.score_n ?? '', score_r: last?.score_r ?? '',
        score_d: last?.score_d ?? '', score_f: last?.score_f ?? '', score_e: last?.score_e ?? '',
        score_efi: last?.score_efi ?? '', score_c: last?.score_c ?? '', score_p: last?.score_p ?? '',
        red_flags: Array.isArray(last?.red_flags) ? last.red_flags.length : 0,
      };
    });
    exportToCsv(`pesquisa_dados_brutos_${format(new Date(), 'yyyyMMdd')}.csv`, rows);
  };

  const exportTabela1 = () => {
    const rows = [
      { variavel: 'N (amostra)', valor: stats.n_amostra },
      { variavel: 'Idade — média (DP)', valor: `${stats.idade_media} (${stats.idade_dp})` },
      { variavel: 'Idade — min–max', valor: `${stats.idade_min}–${stats.idade_max}` },
      ...Object.entries(stats.sexo).map(([k, v]) => ({ variavel: `Sexo: ${k}`, valor: `${v} (${((v / stats.n_amostra) * 100).toFixed(1)}%)` })),
      { variavel: 'Total avaliações MyID', valor: stats.n_avaliacoes },
      { variavel: 'Avaliações presenciais (voz)', valor: stats.n_presencial },
      { variavel: 'Red flags (% das avaliações)', valor: `${stats.n_red_flags} (${stats.pct_red_flags}%)` },
      ...stats.dimStats.map(d => ({ variavel: `${d.dimensao} — média (DP)`, valor: `${d.media} (${d.dp}); críticos: ${d.pct_criticos}%` })),
    ];
    exportToCsv(`pesquisa_tabela1_${format(new Date(), 'yyyyMMdd')}.csv`, rows, [
      { key: 'variavel', label: 'Variável' }, { key: 'valor', label: 'Valor' },
    ]);
  };

  const exportCodebook = () => {
    const cb = [
      { variavel: 'paciente_id', tipo: 'string', descricao: 'ID anonimizado (8 chars)', valores: 'hash' },
      { variavel: 'idade', tipo: 'numeric', descricao: 'Idade em anos', valores: '0-120' },
      { variavel: 'sexo', tipo: 'categorical', descricao: 'Sexo informado', valores: 'masculino/feminino/outro/não informado' },
      { variavel: 'n_avaliacoes', tipo: 'numeric', descricao: 'Total de avaliações MyID concluídas', valores: '>=1' },
      { variavel: 'myid_score', tipo: 'numeric', descricao: 'Score global MyID (última avaliação)', valores: '0-100, maior=melhor' },
      ...DIMENSOES.map(d => ({ variavel: d.key, tipo: 'numeric', descricao: `${d.label} — score por dimensão`, valores: '0-100, <50 = crítico' })),
      { variavel: 'red_flags', tipo: 'numeric', descricao: 'Quantidade de red flags identificados', valores: '>=0' },
      { variavel: 'classificacao', tipo: 'categorical', descricao: 'Classificação clínica final do MyID', valores: 'várias' },
    ];
    exportToCsv(`pesquisa_codebook_${format(new Date(), 'yyyyMMdd')}.csv`, cb, [
      { key: 'variavel', label: 'Variável' }, { key: 'tipo', label: 'Tipo' },
      { key: 'descricao', label: 'Descrição' }, { key: 'valores', label: 'Valores' },
    ]);
  };

  const exportPrePost = () => {
    const rows = stats.dimCohen.map(d => ({
      dimensao: d.dimensao, n: d.n,
      media_pre: d.media_pre, media_post: d.media_post, delta: d.delta,
      cohen_d: d.cohen_d, magnitude: d.magnitude,
    }));
    exportToCsv(`pesquisa_prepost_cohen_${format(new Date(), 'yyyyMMdd')}.csv`, rows);
  };

  const exportProtocolos = () => {
    exportToCsv(`pesquisa_protocolos_${format(new Date(), 'yyyyMMdd')}.csv`, stats.porDiretriz);
  };

  const exportPdfReport = async () => {
    try {
      await gerarPdfResearchReport({
        filtros: stats.filtros,
        datasetHash: stats.datasetHash,
        n_pacientes_total: stats.n_pacientes_total,
        n_amostra: stats.n_amostra,
        n_avaliacoes: stats.n_avaliacoes,
        n_presencial: stats.n_presencial,
        n_protocolos: stats.n_protocolos,
        n_prepost: stats.n_prepost,
        n_red_flags: stats.n_red_flags,
        pct_red_flags: stats.pct_red_flags,
        idade_media: stats.idade_media,
        idade_dp: stats.idade_dp,
        idade_min: stats.idade_min,
        idade_max: stats.idade_max,
        sexo: stats.sexo,
        dimStats: stats.dimStats,
        dimCohen: stats.dimCohen,
        porDiretriz: stats.porDiretriz,
        subgruposSexo: stats.subgruposSexo,
        subgruposFaixa: stats.subgruposFaixa,
      });
      toast({ title: 'Relatório PDF gerado', description: 'O download foi iniciado.' });
    } catch (e) {
      toast({ title: 'Erro ao gerar PDF', description: String(e), variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <DashboardFilters value={filters} onChange={setFilters} showSubgroups />

      {/* Header KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {[
          { label: 'Amostra (n)', value: stats.n_amostra, icon: Users, sub: `${stats.n_pacientes_total} totais` },
          { label: 'Avaliações MyID', value: stats.n_avaliacoes, icon: Activity, sub: 'no período' },
          { label: 'Diretrizes', value: stats.n_protocolos, icon: FileText, sub: 'tratamentos' },
          { label: 'Red Flags', value: `${stats.pct_red_flags}%`, icon: AlertTriangle, sub: `${stats.n_red_flags} casos` },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-xl border border-border/40 bg-card p-3 sm:p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-micro">{s.label}</span>
                <Icon className="icon-xs text-muted-foreground/70" />
              </div>
              <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={exportRawCSV} className="gap-1.5">
          <Download className="icon-xs" /> CSV — Dados brutos
        </Button>
        <Button size="sm" variant="outline" onClick={exportTabela1} className="gap-1.5">
          <FileText className="icon-xs" /> Tabela 1
        </Button>
        <Button size="sm" variant="outline" onClick={exportPrePost} className="gap-1.5">
          <FileText className="icon-xs" /> Pré/pós + d + p
        </Button>
        <Button size="sm" variant="outline" onClick={exportProtocolos} className="gap-1.5">
          <FileText className="icon-xs" /> Diretrizes (outcomes)
        </Button>
        <Button size="sm" variant="outline" onClick={exportCodebook} className="gap-1.5">
          <FileText className="icon-xs" /> Codebook
        </Button>
        <Button size="sm" variant="default" onClick={exportPdfReport} className="gap-1.5">
          <FileDown className="icon-xs" /> Relatório PDF
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono" title="Hash determinístico do dataset filtrado — use para reprodutibilidade">
          dataset#{stats.datasetHash}
        </span>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="demografia" className="text-[10px] sm:text-xs">Demografia</TabsTrigger>
          <TabsTrigger value="myid" className="text-[10px] sm:text-xs">MyID</TabsTrigger>
          <TabsTrigger value="presencial" className="text-[10px] sm:text-xs">Presencial</TabsTrigger>
          <TabsTrigger value="estatistica" className="text-[10px] sm:text-xs">Estatística</TabsTrigger>
          <TabsTrigger value="protocolos" className="text-[10px] sm:text-xs">Diretrizes</TabsTrigger>
          <TabsTrigger value="evolucao" className="text-[10px] sm:text-xs">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="demografia" className="space-y-3 mt-3">
          <Card className="p-4">
            <h3 className="h-card mb-3">Faixa etária</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.faixas}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="faixa" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="n" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="text-caption mt-2">Idade média: <strong>{stats.idade_media} ± {stats.idade_dp}</strong> anos (intervalo {stats.idade_min}–{stats.idade_max})</div>
          </Card>
          <Card className="p-4">
            <h3 className="h-card mb-3">Distribuição por sexo</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={Object.entries(stats.sexo).map(([k, v]) => ({ name: k, value: v }))} dataKey="value" nameKey="name" outerRadius={80} label>
                  {Object.keys(stats.sexo).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="myid" className="space-y-3 mt-3">
          <Card className="p-4">
            <h3 className="h-card mb-1">Prevalência por dimensão</h3>
            <p className="text-caption mb-3">Média do score (0–100) e % de casos críticos (score &lt; 50)</p>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.dimStats} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="dimensao" tick={{ fontSize: 10 }} width={110} />
                <Tooltip />
                <Bar dataKey="media" fill="hsl(var(--primary))" name="Score médio" radius={[0, 6, 6, 0]} />
                <Bar dataKey="pct_criticos" fill="hsl(var(--destructive))" name="% críticos" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-4">
            <h3 className="h-card mb-3">Classificações (n)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.classif}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="classificacao" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="n" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </TabsContent>

        <TabsContent value="presencial" className="space-y-3 mt-3">
          <Card className="p-4">
            <h3 className="h-card mb-3">Severidade clínica (avaliação por voz)</h3>
            {stats.sev.length === 0 ? (
              <p className="text-caption">Nenhuma avaliação presencial registrada ainda.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.sev}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="severidade" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="n" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
          <Card className="p-4">
            <h3 className="h-card mb-3">Termos mais frequentes nas queixas</h3>
            {stats.topQueixas.length === 0 ? (
              <p className="text-caption">Sem queixas registradas.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {stats.topQueixas.map(t => (
                  <span key={t.termo} className="px-2 py-1 rounded-full bg-muted text-xs">
                    {t.termo} <span className="text-muted-foreground">({t.n})</span>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="estatistica" className="space-y-3 mt-3">
          <Card className="p-4">
            <h3 className="h-card mb-1">Análise pré/pós — Tamanho de efeito (Cohen's d)</h3>
            <p className="text-caption mb-3">Pacientes com ≥2 avaliações (n = {stats.n_prepost}). |d| &lt; 0.2 trivial · 0.2–0.5 pequeno · 0.5–0.8 médio · &gt; 0.8 grande.</p>
            {stats.n_prepost < 2 ? (
              <p className="text-caption">Aguardando pacientes com pelo menos 2 avaliações para calcular efeito.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="border-b border-border/40">
                      <th className="text-left py-1.5">Dimensão</th>
                      <th className="text-right">n</th>
                      <th className="text-right">Pré</th>
                      <th className="text-right">Pós</th>
                      <th className="text-right">Δ (IC 95%)</th>
                      <th className="text-right">d</th>
                      <th className="text-right">t</th>
                      <th className="text-right">p</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.dimCohen.map(d => (
                      <tr key={d.key} className="border-b border-border/20">
                        <td className="py-1.5">{d.dimensao}</td>
                        <td className="text-right">{d.n}</td>
                        <td className="text-right">{d.media_pre}</td>
                        <td className="text-right">{d.media_post}</td>
                        <td className={`text-right font-medium ${d.delta > 0 ? 'text-emerald-600' : d.delta < 0 ? 'text-destructive' : ''}`}>
                          {d.delta > 0 ? '+' : ''}{d.delta} <span className="text-muted-foreground font-normal">{d.ci}</span>
                        </td>
                        <td className="text-right font-mono">{d.cohen_d} <span className="text-muted-foreground">({d.magnitude})</span></td>
                        <td className="text-right font-mono">{d.t}</td>
                        <td className={`text-right font-mono ${d.sig ? 'text-emerald-600 font-semibold' : 'text-muted-foreground'}`}>{d.p_label}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="h-card mb-1">Matriz de correlação (Pearson) — dimensões MyID</h3>
            <p className="text-caption mb-3">Correlações entre dimensões na última avaliação de cada paciente. |r| &gt; 0.5 = forte.</p>
            <div className="overflow-x-auto">
              <table className="text-[10px] border-collapse">
                <thead>
                  <tr>
                    <th className="p-1"></th>
                    {DIMENSOES.map(d => <th key={d.key} className="p-1 text-muted-foreground" style={{ writingMode: 'vertical-rl', height: 70 }}>{d.label.split(' ')[0]}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {stats.corrMatrix.map(row => (
                    <tr key={row.dim}>
                      <td className="p-1 text-muted-foreground whitespace-nowrap">{row.dim.split(' ')[0]}</td>
                      {row.cells.map((c, i) => {
                        const a = Math.abs(c.r);
                        const bg = c.r > 0
                          ? `rgba(34, 197, 94, ${a})`
                          : `rgba(239, 68, 68, ${a})`;
                        return (
                          <td key={i} className="p-1 text-center font-mono w-9 h-9" style={{ background: bg, color: a > 0.5 ? '#fff' : 'inherit' }}>
                            {c.r.toFixed(2)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-start gap-2">
              <FlaskConical className="icon-sm text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="h-card">Resumo metodológico (STROBE)</h3>
                <p className="text-caption mt-1">
                  Estudo observacional de coorte retrospectiva. Amostra de conveniência (n = {stats.n_amostra}),
                  idade {stats.idade_media} ± {stats.idade_dp} anos. Avaliação primária: MyID v2.0 (escala 0–100, 9 dimensões).
                  Análise pré/pós com pacientes com ≥2 medidas (n = {stats.n_prepost}). Tamanho de efeito por Cohen's d.
                  Correlações intra-dimensionais por coeficiente de Pearson. Dados anonimizados via hash de ID.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="evolucao" className="space-y-3 mt-3">
          <Card className="p-4">
            <h3 className="h-card mb-3">Avaliações MyID por mês</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={stats.temporal}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="n" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card className="p-4">
            <div className="flex items-start gap-2">
              <FlaskConical className="icon-sm text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="h-card">Pronto para artigo</h3>
                <p className="text-caption mt-1">
                  Use os botões de exportação acima. O CSV anonimizado segue formato wide (1 paciente por linha) compatível com SPSS/R/JASP.
                  A Tabela 1 resume as variáveis no formato padrão de Métodos.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
