import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, XCircle, TrendingUp, TrendingDown, Stethoscope } from 'lucide-react';
import { useEventosAnatomicos, useSaveEventoAnatomico, type EventoAnatomico } from '@/hooks/useEventosAnatomicos';
import { useEvolucaoPaciente } from '@/hooks/useEvolucaoPaciente';
import { detectarEstagnacao, MCID_MYID } from '@/components/paciente/EvolucaoDashboard';

interface PainelDecisaoClinicaProps {
  pacienteId: string;
}

interface MyidRow {
  myid_score: number | null;
  red_flags: unknown;
  classificacao: string | null;
  created_at: string;
}

export default function PainelDecisaoClinica({ pacienteId }: PainelDecisaoClinicaProps) {
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
    () => eventos.filter((e) =>
      (e.tipo_diagnostico === 'relato_paciente' && e.status !== 'resolvido')
      || (e.tipo_diagnostico === 'historico_relatado' && (e.metadata as any)?.revisado_profissional !== true)
    ),
    [eventos],
  );

  const redFlags = useMemo(() => {
    const doMyid: string[] = Array.isArray(myid[0]?.red_flags) ? (myid[0]!.red_flags as string[]) : [];
    const doVoz: string[] = Array.isArray(ultimaVoz?.resultado?.red_flags) ? ultimaVoz!.resultado.red_flags : [];
    return Array.from(new Set([...doMyid, ...doVoz]));
  }, [myid, ultimaVoz]);

  const myidAtual = myid[0];
  const myidAnterior = myid[1];
  const delta =
    myidAtual?.myid_score != null && myidAnterior?.myid_score != null
      ? Number(myidAtual.myid_score) - Number(myidAnterior.myid_score)
      : null;

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });
  };

  const confirmar = (ev: EventoAnatomico) => {
    const isHistorico = ev.tipo_diagnostico === 'historico_relatado';
    saveEvento.mutate(
      {
        id: ev.id, paciente_id: pacienteId, regiao_id: ev.regiao_id, tipo_achado: ev.tipo_achado,
        tipo_diagnostico: 'achado_clinico',
        ...(isHistorico ? { status: 'ativo' as const, metadata: { ...(ev.metadata as any), revisado_profissional: true } } : {}),
      },
      { onSuccess: invalidar },
    );
  };

  const descartar = (ev: EventoAnatomico) => {
    const isHistorico = ev.tipo_diagnostico === 'historico_relatado';
    if (isHistorico) {
      saveEvento.mutate(
        {
          id: ev.id, paciente_id: pacienteId, regiao_id: ev.regiao_id, tipo_achado: ev.tipo_achado,
          metadata: { ...(ev.metadata as any), revisado_profissional: true },
        },
        { onSuccess: invalidar },
      );
      return;
    }
    const nota = `Descartado pelo profissional em ${new Date().toLocaleDateString('pt-BR')} (relato do paciente não confirmado clinicamente).`;
    saveEvento.mutate(
      {
        id: ev.id,
        paciente_id: pacienteId,
        regiao_id: ev.regiao_id,
        tipo_achado: ev.tipo_achado,
        status: 'resolvido',
        notas_clinicas: ev.notas_clinicas ? `${ev.notas_clinicas}\n${nota}` : nota,
      },
      { onSuccess: invalidar },
    );
  };

  const semAlertas = redFlags.length === 0 && pendentes.length === 0 && !estagnado;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="h-4 w-4" /> Painel de Decisão Clínica
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {semAlertas && (
          <div className="flex items-center gap-2 text-sm text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Nenhum alerta pendente para este paciente.
          </div>
        )}

        {estagnado && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Possível platô terapêutico.</span> As últimas avaliações de evolução não mostraram variação clinicamente
              significativa (MCID ±{MCID_MYID} pts). Considere revisar a conduta.
            </div>
          </div>
        )}

        {redFlags.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
              <AlertTriangle className="h-4 w-4" /> Red Flags Ativas ({redFlags.length})
            </div>
            <ul className="space-y-0.5 pl-1 text-sm text-red-700/90">
              {redFlags.map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Badge variant="warning" size="sm">{pendentes.length}</Badge>
              Relatos do paciente aguardando confirmação
            </div>
            <div className="space-y-2">
              {pendentes.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm"
                >
                  <span className="truncate">
                    {ev.tipo_achado} <span className="text-muted-foreground">({ev.regiao_id})</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => confirmar(ev)}>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => descartar(ev)}>
                      <XCircle className="mr-1 h-3.5 w-3.5" /> Descartar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {myidAtual && (
          <div className="grid grid-cols-3 gap-3 border-t border-border/40 pt-3">
            <div>
              <div className="text-xs text-muted-foreground">MyID atual</div>
              <div className="text-lg font-bold">
                {myidAtual.myid_score != null ? `${Math.round(Number(myidAtual.myid_score))}/100` : '—'}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Classificação</div>
              <div className="text-sm font-medium">{myidAtual.classificacao || '—'}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Variação</div>
              {delta !== null ? (
                <div className={`flex items-center gap-1 text-sm font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {delta >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {delta >= 0 ? '+' : ''}{delta.toFixed(1)}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
