import { useState, lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, parse, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Fingerprint, Mic, FileText, ChevronDown, Loader2, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { getMyIDSeverityColor } from '@/utils/myidCalculations';

const MyIDResult = lazy(() => import('@/components/myid/MyIDResult').then(m => ({ default: m.MyIDResult })));

interface Props {
  pacienteId: string;
}

export default function HistoricoAvaliacoesTab({ pacienteId }: Props) {
  const { user } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  // ── MyID via link (paciente respondeu online)
  const { data: myidOnline = [], isLoading: loadingOnline } = useQuery({
    queryKey: ['hist-myid-online', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('id, created_at, updated_at, myid_score_parcial, resultado_processado, respostas_brutas, token_acesso')
        .eq('paciente_id', pacienteId)
        .eq('status', 'concluido')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!pacienteId,
  });

  // ── MyID/presencial clínico (avaliacoes_identidade)
  const { data: avalPresenciais = [], isLoading: loadingPresenciais } = useQuery({
    queryKey: ['hist-aval-presenciais', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_identidade')
        .select('id, created_at, data_avaliacao, myid_score, classificacao_severidade, queixa_principal, myid_analysis, resultado_processado')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!pacienteId,
  });

  // ── Avaliações de voz/escrita (presencial)
  const { data: avalVoz = [], isLoading: loadingVoz } = useQuery({
    queryKey: ['hist-aval-voz', pacienteId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('id, created_at, classificacao_severidade, queixa_principal, transcricao, resultado')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user && !!pacienteId,
  });

  // ── Gráfico: juntar MyID online + presencial, ordenar por data
  const chartData = (() => {
    const pts: { date: string; score: number; ts: number; origem: string }[] = [];
    myidOnline.forEach(m => {
      const s = Number(m.myid_score_parcial);
      if (!s) return;
      const ts = new Date(m.updated_at || m.created_at).getTime();
      pts.push({ date: format(new Date(ts), 'dd/MM/yy'), score: Math.round(s), ts, origem: 'Online' });
    });
    avalPresenciais.forEach(a => {
      const s = Number(a.myid_score);
      if (!s) return;
      let ts = new Date(a.created_at).getTime();
      if (a.data_avaliacao) {
        try { ts = parse(a.data_avaliacao, 'dd/MM/yyyy', new Date()).getTime(); } catch { /* keep created_at */ }
      }
      pts.push({ date: format(new Date(ts), 'dd/MM/yy'), score: Math.round(s > 10 ? s : s * 10), ts, origem: 'Presencial' });
    });
    return pts.sort((a, b) => a.ts - b.ts);
  })();

  const isLoading = loadingOnline || loadingPresenciais || loadingVoz;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalMyID = myidOnline.length + avalPresenciais.length;
  const empty = totalMyID === 0 && avalVoz.length === 0;

  if (empty) {
    return (
      <div className="text-center py-16 border-2 border-dashed border-border/50 rounded-xl">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="font-semibold text-foreground">Nenhuma avaliação registrada</p>
        <p className="text-sm text-muted-foreground mt-1">
          As avaliações MyID e presenciais aparecerão aqui conforme forem realizadas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Gráfico de evolução do MyID ── */}
      {chartData.length >= 2 && (
        <div className="rounded-xl border border-border/40 bg-card p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Evolução MyID-100</h3>
            <Badge variant="outline" className="text-[10px]">{chartData.length} pontos</Badge>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{
                    fontSize: 12, borderRadius: 10, border: 'none',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                    background: 'hsl(var(--card))',
                  }}
                  formatter={(v: any, _, p) => [`${v}/100 (${p.payload.origem})`, 'MyID']}
                />
                <ReferenceLine y={60} stroke="hsl(var(--destructive) / 0.3)" strokeDasharray="4 4" />
                <ReferenceLine y={80} stroke="hsl(var(--success) / 0.3)" strokeDasharray="4 4" />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Linha vermelha = 60 (atenção) · Linha verde = 80 (bom)
          </p>
        </div>
      )}

      {/* ── MyID (Online + Presencial) ── */}
      {totalMyID > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">MyID</h3>
            <Badge variant="outline" className="text-[10px]">{totalMyID}</Badge>
          </div>

          <div className="space-y-1.5">
            {/* Online */}
            {myidOnline.map(m => {
              const id = `online-${m.id}`;
              const isOpen = expandedId === id;
              const r = m.resultado_processado as any;
              const score = m.myid_score_parcial ? Math.round(Number(m.myid_score_parcial)) : (r?.myidScore ? Math.round(r.myidScore) : null);
              const classificacao = r?.classificacao || r?.classification || r?.myidStatus || '—';
              const severityClass = getMyIDSeverityColor(classificacao);
              const date = format(parseISO(m.updated_at || m.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

              return (
                <div key={id} className="rounded-xl border border-border/40 bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                      isOpen && 'bg-muted/30',
                    )}
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Fingerprint className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-foreground">{date}</span>
                        <Badge variant="outline" className="text-[10px] h-4 bg-muted/40">Online</Badge>
                      </div>
                      {classificacao !== '—' && (
                        <span className={cn('text-[11px] font-medium', severityClass.split(' ')[0])}>{classificacao}</span>
                      )}
                    </div>
                    {score !== null && (
                      <span className="text-lg font-bold text-primary tabular-nums shrink-0">{score}<span className="text-[10px] font-normal text-muted-foreground">/100</span></span>
                    )}
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && r && (
                    <div className="border-t border-border/40 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                      <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
                        <MyIDResult
                          result={r}
                          rawData={m.respostas_brutas}
                          pacienteId={pacienteId}
                          avaliacaoId={m.id}
                        />
                      </Suspense>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Presencial/Legacy */}
            {avalPresenciais.map(a => {
              const id = `presencial-${a.id}`;
              const isOpen = expandedId === id;
              const score = a.myid_score ? Math.round(Number(a.myid_score) > 10 ? Number(a.myid_score) : Number(a.myid_score) * 10) : null;
              const classificacao = a.classificacao_severidade || '—';
              const severityClass = getMyIDSeverityColor(classificacao);
              const rawDate = a.data_avaliacao || format(parseISO(a.created_at), 'dd/MM/yyyy');
              const analysis = a.myid_analysis as any;
              const queixa = a.queixa_principal || analysis?.queixaPrincipal || '';

              return (
                <div key={id} className="rounded-xl border border-border/40 bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                      isOpen && 'bg-muted/30',
                    )}
                  >
                    <div className="h-8 w-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                      <Fingerprint className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-foreground">{rawDate}</span>
                        <Badge variant="outline" className="text-[10px] h-4">Presencial</Badge>
                      </div>
                      {queixa && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{queixa}</p>}
                    </div>
                    {score !== null && (
                      <span className="text-lg font-bold text-foreground tabular-nums shrink-0">{score}<span className="text-[10px] font-normal text-muted-foreground">/100</span></span>
                    )}
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 px-4 py-3 space-y-2 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                      {queixa && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Queixa principal</span>
                          <p className="mt-0.5 text-foreground leading-relaxed">{queixa}</p>
                        </div>
                      )}
                      {analysis && (
                        <AnalysisSummary analysis={analysis} />
                      )}
                      {!queixa && !analysis && (
                        <p className="text-muted-foreground italic text-xs">Dados detalhados não disponíveis para esta avaliação.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Avaliações Presenciais (Voz / Escrita) ── */}
      {avalVoz.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Mic className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Avaliações Presenciais</h3>
            <Badge variant="outline" className="text-[10px]">{avalVoz.length}</Badge>
          </div>

          <div className="space-y-1.5">
            {avalVoz.map(a => {
              const id = `voz-${a.id}`;
              const isOpen = expandedId === id;
              const origem = a.resultado?._meta?.origem || a.resultado?._meta?.mode || '';
              const isVoz = !origem || origem.includes('voice') || origem === 'voz';
              const queixa = a.queixa_principal || a.resultado?.queixa_principal || '';
              const date = format(parseISO(a.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
              const resumo = a.resultado?.resumoClinico || a.resultado?.clinical_summary || '';
              const hipoteses = a.resultado?.hipotesesDiagnosticas || a.resultado?.diagnostic_hypotheses;

              return (
                <div key={id} className="rounded-xl border border-border/40 bg-card overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggle(id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                      isOpen && 'bg-muted/30',
                    )}
                  >
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      {isVoz ? <Mic className="h-4 w-4 text-accent" /> : <FileText className="h-4 w-4 text-accent" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-foreground">{date}</span>
                        <Badge variant="outline" className="text-[10px] h-4">{isVoz ? 'Voz' : 'Escrita'}</Badge>
                        {a.classificacao_severidade && (
                          <Badge variant="outline" className={cn('text-[10px] h-4', getMyIDSeverityColor(a.classificacao_severidade).split(' ')[0])}>
                            {a.classificacao_severidade}
                          </Badge>
                        )}
                      </div>
                      {queixa && <p className="text-[11px] text-muted-foreground truncate mt-0.5">{queixa}</p>}
                    </div>
                    <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <div className="border-t border-border/40 px-4 py-3 space-y-3 text-sm animate-in fade-in slide-in-from-top-2 duration-200">
                      {queixa && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Queixa principal</span>
                          <p className="mt-0.5 text-foreground leading-relaxed">{queixa}</p>
                        </div>
                      )}
                      {resumo && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Resumo clínico</span>
                          <p className="mt-0.5 text-foreground leading-relaxed text-[13px]">{resumo}</p>
                        </div>
                      )}
                      {hipoteses && (
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hipóteses diagnósticas</span>
                          <p className="mt-0.5 text-foreground text-[13px] leading-relaxed">
                            {Array.isArray(hipoteses) ? hipoteses.join(' · ') : hipoteses}
                          </p>
                        </div>
                      )}
                      {a.transcricao && (
                        <details className="group">
                          <summary className="cursor-pointer text-[11px] font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 list-none [&::-webkit-details-marker]:hidden">
                            <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                            Ver transcrição
                          </summary>
                          <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed bg-muted/30 rounded-lg p-3">
                            {a.transcricao}
                          </p>
                        </details>
                      )}
                      {!queixa && !resumo && !a.transcricao && (
                        <p className="text-muted-foreground italic text-xs">Dados detalhados não disponíveis.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

// Exibe os campos-chave da análise de uma avaliação presencial/legacy
function AnalysisSummary({ analysis }: { analysis: any }) {
  const scores = analysis?.componentScores || analysis?.component_scores || {};
  const redFlags = analysis?.redFlagsDetected || analysis?.red_flags_detected || false;
  const recommendation = typeof analysis?.recommendation === 'string' ? analysis.recommendation : '';
  const hasScores = Object.keys(scores).length > 0;

  if (!hasScores && !recommendation) return null;

  return (
    <div className="space-y-2">
      {redFlags && (
        <p className="text-[12px] font-semibold text-destructive rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
          ⚠️ Red flags detectados nesta avaliação
        </p>
      )}
      {hasScores && (
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Scores por dimensão</span>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {Object.entries(scores).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1 rounded-md bg-muted/60 px-2 py-0.5 text-[11px] font-medium">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-bold">{Number(v).toFixed(1)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {recommendation && (
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Recomendação</span>
          <p className="mt-0.5 text-[12px] text-foreground leading-relaxed">{recommendation}</p>
        </div>
      )}
    </div>
  );
}
