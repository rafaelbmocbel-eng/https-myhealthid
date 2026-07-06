import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown, Minus, ClipboardList, X } from 'lucide-react';
import { useEventosAnatomicos, useSaveEventoAnatomico, type EventoAnatomico } from '@/hooks/useEventosAnatomicos';
import { useEvolucaoPaciente } from '@/hooks/useEvolucaoPaciente';
import { detectarEstagnacao, MCID_MYID } from '@/components/paciente/EvolucaoDashboard';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface PainelDecisaoClinicaProps {
  pacienteId: string;
  temAgendaFutura?: boolean;
}

interface MyidRow {
  myid_score: number | null;
  red_flags: unknown;
  classificacao: string | null;
  created_at: string;
}

// ── Score helpers ──────────────────────────────────────────────────────────────
function scoreColor(v: number | null): string {
  if (v === null) return 'hsl(215 15% 60%)';
  if (v < 30)    return '#dc2626';
  if (v < 50)    return '#ea580c';
  if (v < 70)    return '#d97706';
  if (v < 85)    return '#65a30d';
  return '#16a34a';
}

function scoreBand(v: number | null): 'critical' | 'severe' | 'moderate' | 'mild' | 'good' | 'none' {
  if (v === null) return 'none';
  if (v < 30)    return 'critical';
  if (v < 50)    return 'severe';
  if (v < 70)    return 'moderate';
  if (v < 85)    return 'mild';
  return 'good';
}

// Mini arc gauge — 240° sweep
function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 26;
  const cx = 34;
  const cy = 36;
  const sweep = 240;
  const startDeg = -210;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const pt = (d: number) => ({
    x: cx + r * Math.cos(toRad(d)),
    y: cy + r * Math.sin(toRad(d)),
  });
  const s = pt(startDeg);
  const e = pt(startDeg + sweep);
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const fillDeg = startDeg + pct * sweep;
  const f = pt(fillDeg);
  const bigArc = pct * sweep > 180 ? 1 : 0;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" className="shrink-0">
      <path
        d={`M ${s.x} ${s.y} A ${r} ${r} 0 1 1 ${e.x} ${e.y}`}
        fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round" opacity={0.14}
      />
      {pct > 0.01 && (
        <path
          d={`M ${s.x} ${s.y} A ${r} ${r} 0 ${bigArc} 1 ${f.x} ${f.y}`}
          fill="none" stroke={color} strokeWidth="5.5" strokeLinecap="round"
        />
      )}
      <text x={cx} y={cy + 2} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
        {Math.round(score)}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="6.5" fontWeight="600" fill="currentColor" opacity={0.45}>
        /100
      </text>
    </svg>
  );
}

export default function PainelDecisaoClinica({ pacienteId, temAgendaFutura = true }: PainelDecisaoClinicaProps) {
  const { data: eventos = [] } = useEventosAnatomicos(pacienteId);
  const saveEvento = useSaveEventoAnatomico();
  const qc = useQueryClient();
  const { evolucoes } = useEvolucaoPaciente(pacienteId);
  const estagnado = useMemo(() => detectarEstagnacao(evolucoes), [evolucoes]);

  const { data: myid = [] } = useQuery({
    queryKey: ['painel-decisao-myid', pacienteId],
    enabled: !!pacienteId,
    queryFn: async (): Promise<MyidRow[]> => {
      const { data, error } = await supabase
        .from('avaliacoes_identidade')
        .select('myid_score, red_flags, classificacao, created_at')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(2);
      if (error) throw error;
      return (data || []) as unknown as MyidRow[];
    },
  });

  const { data: ultimaVoz } = useQuery({
    queryKey: ['painel-decisao-voz', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('resultado, created_at')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { resultado: { red_flags?: string[] } | null; created_at: string } | null;
    },
  });

  const pendentes = useMemo(
    () => eventos.filter((e) => e.tipo_diagnostico === 'relato_paciente' && e.status !== 'resolvido'),
    [eventos],
  );

  const redFlags = useMemo(() => {
    const doMyid: string[] = Array.isArray(myid[0]?.red_flags) ? (myid[0]!.red_flags as string[]) : [];
    const doVoz: string[]  = Array.isArray(ultimaVoz?.resultado?.red_flags) ? ultimaVoz!.resultado.red_flags! : [];
    const all = Array.from(new Set([...doMyid, ...doVoz]));
    // Filter out "no red flags" messages that AI sometimes returns as flag entries
    const negPattern = /nenhum|sem red|não ident|escassez|insuficiente|dados insuficientes/i;
    return all.filter(f => f.length > 3 && !negPattern.test(f));
  }, [myid, ultimaVoz]);

  const myidAtual    = myid[0];
  const myidAnterior = myid[1];
  const rawScore = myidAtual?.myid_score != null ? Number(myidAtual.myid_score) : null;
  const delta =
    rawScore != null && myidAnterior?.myid_score != null
      ? rawScore - Number(myidAnterior.myid_score)
      : null;

  const invalidar = () => qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });

  const confirmar = (ev: EventoAnatomico) =>
    saveEvento.mutate(
      { id: ev.id, paciente_id: pacienteId, regiao_id: ev.regiao_id, tipo_achado: ev.tipo_achado, tipo_diagnostico: 'achado_clinico' },
      { onSuccess: invalidar },
    );

  const descartar = (ev: EventoAnatomico) => {
    const nota = `Descartado pelo profissional em ${new Date().toLocaleDateString('pt-BR')} (relato não confirmado clinicamente).`;
    saveEvento.mutate(
      {
        id: ev.id, paciente_id: pacienteId, regiao_id: ev.regiao_id,
        tipo_achado: ev.tipo_achado, status: 'resolvido',
        notas_clinicas: ev.notas_clinicas ? `${ev.notas_clinicas}\n${nota}` : nota,
      },
      { onSuccess: invalidar },
    );
  };

  const semAlertas = redFlags.length === 0 && pendentes.length === 0 && !estagnado;
  const band = scoreBand(rawScore);
  const color = scoreColor(rawScore);
  const totalAlerts = redFlags.length + pendentes.length + (estagnado ? 1 : 0);
  const classificacao = myidAtual?.classificacao || null;

  const { user } = useAuth();
  const [intercorrenciaOpen, setIntercorrenciaOpen] = useState(false);
  const [intercorrenciaTexto, setIntercorrenciaTexto] = useState('');
  const [intercorrenciaUrgencia, setIntercorrenciaUrgencia] = useState<'baixa' | 'media' | 'alta'>('media');
  const [salvandoIntercorrencia, setSalvandoIntercorrencia] = useState(false);

  const salvarIntercorrencia = async () => {
    if (!user || !intercorrenciaTexto.trim()) return;
    setSalvandoIntercorrencia(true);
    try {
      await (supabase as any).from('notas_prontuario').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        tipo: 'intercorrencia',
        titulo: `Intercorrência — Urgência ${intercorrenciaUrgencia === 'alta' ? 'Alta' : intercorrenciaUrgencia === 'media' ? 'Média' : 'Baixa'}`,
        descricao: intercorrenciaTexto.trim(),
        dados_extras: { urgencia: intercorrenciaUrgencia, score_atual: rawScore },
      });
      setIntercorrenciaOpen(false);
      setIntercorrenciaTexto('');
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
    } catch { /* silent — nota opcional */ } finally {
      setSalvandoIntercorrencia(false);
    }
  };

  // Band-based styling tokens
  const wrapperCls = cn(
    'rounded-2xl border overflow-hidden',
    band === 'critical' || band === 'severe'
      ? 'border-red-200/70 bg-red-50/25 dark:border-red-800/30 dark:bg-red-950/10'
      : band === 'moderate' || (estagnado && band === 'none')
        ? 'border-amber-200/70 bg-amber-50/25 dark:border-amber-800/30 dark:bg-amber-950/10'
        : band === 'good' || band === 'mild'
          ? 'border-emerald-200/60 bg-emerald-50/20 dark:border-emerald-800/30 dark:bg-emerald-950/10'
          : 'border-border/50 bg-card',
  );

  return (
    <div className={wrapperCls}>
      {/* ── Score + header row ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-4 p-4 pb-3">
        {rawScore !== null ? (
          <ScoreGauge score={rawScore} color={color} />
        ) : (
          <div className="h-[68px] w-[68px] shrink-0 flex items-center justify-center rounded-full border-[3px] border-dashed border-muted text-muted-foreground">
            <span className="text-[10px] font-bold text-center leading-tight px-1">Sem<br/>MyID</span>
          </div>
        )}

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              Decisão Clínica
            </span>
            {totalAlerts > 0 && (
              <span className={cn(
                'text-[10px] font-bold px-2 py-0.5 rounded-full',
                band === 'critical' || band === 'severe'
                  ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
              )}>
                {totalAlerts} {totalAlerts === 1 ? 'alerta' : 'alertas'}
              </span>
            )}
          </div>

          {classificacao ? (
            <p className="text-[15px] font-bold leading-tight" style={{ color }}>
              {classificacao}
            </p>
          ) : rawScore !== null ? (
            <p className="text-[15px] font-bold leading-tight" style={{ color }}>
              {band === 'critical' ? 'Crítico Severo'
                : band === 'severe' ? 'Crítico'
                : band === 'moderate' ? 'Moderado'
                : band === 'mild' ? 'Leve'
                : 'Ótimo'}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Sem avaliação MyID</p>
          )}

          {/* Delta */}
          {delta !== null && (
            <div className={cn(
              'inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5',
              delta > 0 ? 'text-emerald-600 dark:text-emerald-400'
                : delta < 0 ? 'text-red-600 dark:text-red-400'
                : 'text-muted-foreground',
            )}>
              {delta > 0 ? <TrendingUp className="h-3 w-3" />
                : delta < 0 ? <TrendingDown className="h-3 w-3" />
                : <Minus className="h-3 w-3 opacity-50" />}
              {delta >= 0 ? '+' : ''}{delta.toFixed(1)} pts vs avaliação anterior
            </div>
          )}

          {semAlertas && (
            <div className="flex items-center gap-1 mt-1 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Nenhum alerta pendente
            </div>
          )}
        </div>
      </div>

      {/* ── Red flags + estagnação ────────────────────────────────────────── */}
      {(redFlags.length > 0 || estagnado) && (
        <div className="mx-4 mb-3 rounded-xl border border-red-200/60 bg-white/60 dark:bg-red-950/20 dark:border-red-800/40 px-3 py-2.5 space-y-2">
          {estagnado && (
            <div className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-500" />
              <span>
                <strong>Platô terapêutico:</strong> sem variação ≥±{MCID_MYID} pts nas últimas avaliações.
                Considere revisar a conduta.
              </span>
            </div>
          )}
          {redFlags.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Red Flags ({redFlags.length})
              </p>
              {redFlags.map((f, i) => (
                <p key={i} className="text-xs text-red-800 dark:text-red-300 flex items-start gap-1.5">
                  <span className="shrink-0 text-red-400 mt-0.5">•</span>{f}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* C-03: Sem agenda + score crítico */}
      {(band === 'critical' || band === 'severe') && !temAgendaFutura && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-200/60 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700/40 px-3 py-2.5 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800 dark:text-amber-300 flex-1 leading-snug">
            <strong>Paciente crítico sem consulta agendada.</strong>{' '}
            Agende um retorno para acompanhamento urgente.
          </p>
        </div>
      )}

      {/* ── Relatos pendentes ────────────────────────────────────────────── */}
      {pendentes.length > 0 && (
        <div className="mx-4 mb-4 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Relatos aguardando revisão ({pendentes.length})
          </p>
          {pendentes.map((ev) => (
            <div
              key={ev.id}
              className="flex items-center gap-2 rounded-lg bg-background border border-amber-200/60 px-3 py-2"
            >
              <span className="text-xs flex-1 min-w-0 truncate">
                {ev.tipo_achado}{' '}
                <span className="text-muted-foreground text-[11px]">({ev.regiao_id})</span>
              </span>
              <div className="flex shrink-0 gap-1">
                <Button size="sm" variant="outline" className="h-6 px-2 text-[11px] gap-1" onClick={() => confirmar(ev)}>
                  <CheckCircle2 className="h-3 w-3" /> Confirmar
                </Button>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] gap-1 text-muted-foreground" onClick={() => descartar(ev)}>
                  <XCircle className="h-3 w-3" /> Descartar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* I-04: Intercorrência para casos críticos */}
      {(band === 'critical' || band === 'severe') && (
        <div className="px-4 pb-4">
          {intercorrenciaOpen ? (
            <div className="rounded-xl border border-border bg-background p-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Registrar Intercorrência</p>
                <button onClick={() => setIntercorrenciaOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex gap-1.5">
                {(['baixa', 'media', 'alta'] as const).map(u => (
                  <button
                    key={u}
                    onClick={() => setIntercorrenciaUrgencia(u)}
                    className={cn(
                      'flex-1 text-[10px] font-semibold py-1 rounded-md border transition-colors',
                      intercorrenciaUrgencia === u
                        ? u === 'alta' ? 'bg-red-100 border-red-300 text-red-700' : u === 'media' ? 'bg-amber-100 border-amber-300 text-amber-700' : 'bg-sky-100 border-sky-300 text-sky-700'
                        : 'bg-muted border-transparent text-muted-foreground',
                    )}
                  >
                    {u === 'alta' ? 'Alta' : u === 'media' ? 'Média' : 'Baixa'}
                  </button>
                ))}
              </div>
              <textarea
                className="w-full text-xs rounded-lg border border-border bg-muted/40 px-2.5 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40 placeholder:text-muted-foreground"
                rows={3}
                placeholder="Descreva a intercorrência clínica…"
                value={intercorrenciaTexto}
                onChange={e => setIntercorrenciaTexto(e.target.value)}
              />
              <Button
                size="sm"
                className="w-full gap-1.5 text-xs"
                disabled={!intercorrenciaTexto.trim() || salvandoIntercorrencia}
                onClick={salvarIntercorrencia}
              >
                {salvandoIntercorrencia ? <TrendingUp className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
                Salvar no prontuário
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs gap-1.5 text-muted-foreground border-dashed hover:border-red-300 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
              onClick={() => setIntercorrenciaOpen(true)}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Registrar intercorrência
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
