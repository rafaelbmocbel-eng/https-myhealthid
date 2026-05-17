import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, TrendingDown, CalendarX, CalendarCheck, Cake, Activity, Users, Loader2,
  DollarSign, Repeat, Filter,
} from 'lucide-react';
import { differenceInDays, parseISO, format, addDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import DashboardFilters, { DEFAULT_FILTERS, DashboardFilterState, periodToDate, inPeriod } from './DashboardFilters';

type Pac = {
  id: string; nome: string; sobrenome: string;
  data_nascimento: string | null; ativo: boolean; created_at: string;
};

const HORAS = Array.from({ length: 14 }, (_, i) => i + 7); // 7..20
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

export default function ClinicalInsights() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<DashboardFilterState>(DEFAULT_FILTERS);

  const { data, isLoading } = useQuery({
    queryKey: ['clinical-insights', user?.id],
    queryFn: async () => {
      const yearAgo = new Date(); yearAgo.setDate(yearAgo.getDate() - 365);
      const sinceISO = yearAgo.toISOString();
      const [pac, ava, voz, ag, ses, evo, leads, pag] = await Promise.all([
        supabase.from('pacientes').select('id, nome, sobrenome, data_nascimento, ativo, created_at').eq('terapeuta_id', user!.id).eq('ativo', true),
        supabase.from('avaliacoes_identidade').select('paciente_id, myid_score, red_flags, classificacao, created_at').eq('terapeuta_id', user!.id),
        supabase.from('avaliacoes_voz').select('paciente_id, classificacao_severidade, created_at').eq('terapeuta_id', user!.id),
        supabase.from('agendamentos').select('paciente_id, data_inicio, status').eq('terapeuta_id', user!.id).gte('data_inicio', sinceISO),
        supabase.from('controle_sessoes').select('paciente_id, status, valor_cobrado, data_sessao, numero_sessao').eq('terapeuta_id', user!.id).gte('data_sessao', sinceISO),
        supabase.from('evolucao_paciente').select('paciente_id, myid_score, delta_id_final, data_registro').eq('terapeuta_id', user!.id),
        supabase.from('funil_leads').select('id, status, created_at, agendamento_id').eq('terapeuta_id', user!.id).gte('created_at', sinceISO),
        (supabase as any).from('pagamentos_paciente').select('paciente_id, valor, status, created_at').eq('terapeuta_id', user!.id).gte('created_at', sinceISO),
      ]);
      return {
        pacientes: (pac.data || []) as Pac[],
        myid: ava.data || [],
        voz: voz.data || [],
        agendamentos: ag.data || [],
        sessoes: ses.data || [],
        evolucao: evo.data || [],
        leads: leads.data || [],
        pagamentos: pag.data || [],
      };
    },
    enabled: !!user,
  });

  const insights = useMemo(() => {
    if (!data) return null;
    const cut = periodToDate(filters.period);
    const filterDate = (iso?: string | null) => !cut || (iso ? new Date(iso) >= cut : false);

    const pacientes = data.pacientes;
    const myid = data.myid.filter(m => filterDate(m.created_at));
    const agendamentos = data.agendamentos.filter(a => filterDate(a.data_inicio));
    const sessoes = data.sessoes.filter(s => filterDate(s.data_sessao));
    const leads = data.leads.filter(l => filterDate(l.created_at));
    const pagamentos = data.pagamentos.filter(p => filterDate(p.created_at));
    const evolucao = data.evolucao;
    const now = new Date();

    // Última MyID
    const lastMyID = new Map<string, any>();
    data.myid.forEach(m => { const cur = lastMyID.get(m.paciente_id); if (!cur || m.created_at > cur.created_at) lastMyID.set(m.paciente_id, m); });

    const nextAppt = new Map<string, string>();
    data.agendamentos.forEach(a => {
      if (a.data_inicio < now.toISOString() || a.status === 'cancelado') return;
      const cur = nextAppt.get(a.paciente_id!);
      if (!cur || a.data_inicio < cur) nextAppt.set(a.paciente_id!, a.data_inicio);
    });

    const redFlagsPendentes = pacientes.filter(p => {
      const m = lastMyID.get(p.id);
      const rf = Array.isArray(m?.red_flags) ? m.red_flags : [];
      return rf.length > 0 && !nextAppt.has(p.id);
    });

    const emRisco = pacientes.filter(p => {
      if (nextAppt.has(p.id)) return false;
      const m = lastMyID.get(p.id);
      if (!m) return differenceInDays(now, parseISO(p.created_at)) > 30;
      const dias = differenceInDays(now, parseISO(m.created_at));
      const evos = evolucao.filter(e => e.paciente_id === p.id).sort((a,b) => a.data_registro.localeCompare(b.data_registro));
      const ultimo = evos[evos.length - 1];
      const piorou = ultimo && Number(ultimo.delta_id_final) < -5;
      return dias > 60 || piorou;
    }).slice(0, 8);

    // KPIs operacionais
    const total = agendamentos.length;
    const faltas = agendamentos.filter(a => a.status === 'falta' || a.status === 'no_show').length;
    const cancelados = agendamentos.filter(a => a.status === 'cancelado').length;
    const realizadas = sessoes.filter(s => s.status === 'realizada');
    const noShowRate = total ? +((faltas / total) * 100).toFixed(1) : 0;
    const cancelRate = total ? +((cancelados / total) * 100).toFixed(1) : 0;
    const adesao = total ? +((realizadas.length / total) * 100).toFixed(1) : 0;
    const receita = realizadas.reduce((s, x) => s + Number(x.valor_cobrado || 0), 0);
    const inadimplencia = pagamentos.filter(p => p.status === 'pendente' || p.status === 'atrasado').reduce((s, x) => s + Number(x.valor || 0), 0);

    // LTV / ciclo médio
    const sessoesPorPac = new Map<string, number>();
    realizadas.forEach(s => sessoesPorPac.set(s.paciente_id, (sessoesPorPac.get(s.paciente_id) || 0) + 1));
    const sessoesArr = Array.from(sessoesPorPac.values());
    const cicloMedio = sessoesArr.length ? +(sessoesArr.reduce((a,b)=>a+b,0) / sessoesArr.length).toFixed(1) : 0;
    const valorPorPac = new Map<string, number>();
    realizadas.forEach(s => valorPorPac.set(s.paciente_id, (valorPorPac.get(s.paciente_id) || 0) + Number(s.valor_cobrado || 0)));
    const ltvArr = Array.from(valorPorPac.values());
    const ltv = ltvArr.length ? +(ltvArr.reduce((a,b)=>a+b,0) / ltvArr.length).toFixed(0) : 0;

    // Funil de conversão
    const totalLeads = leads.length;
    const leadsAgendados = leads.filter(l => l.agendamento_id).length;
    const leadsRealizados = leads.filter(l => l.status === 'concluido' || l.status === 'agendado').length;
    const conversaoLead = totalLeads ? +((leadsAgendados / totalLeads) * 100).toFixed(1) : 0;

    // Heatmap dia × hora (sessões realizadas)
    const heat: Record<string, number> = {};
    realizadas.forEach(s => {
      const d = new Date(s.data_sessao);
      heat[`${d.getDay()}-${d.getHours()}`] = (heat[`${d.getDay()}-${d.getHours()}`] || 0) + 1;
    });
    const heatMax = Math.max(1, ...Object.values(heat));

    // Aniversariantes
    const aniversariantes = pacientes.filter(p => {
      if (!p.data_nascimento) return false;
      const d = parseISO(p.data_nascimento);
      const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
      return isWithinInterval(thisYear, { start: now, end: addDays(now, 7) });
    });

    return {
      redFlagsPendentes, emRisco, aniversariantes,
      adesao, noShowRate, cancelRate, total, realizadasN: realizadas.length,
      receita, inadimplencia, ltv, cicloMedio,
      totalLeads, leadsAgendados, leadsRealizados, conversaoLead,
      heat, heatMax,
    };
  }, [data, filters]);

  if (isLoading || !insights) {
    return <div className="flex justify-center py-6"><Loader2 className="icon-md animate-spin text-primary" /></div>;
  }

  const kpis = [
    { label: 'Adesão', value: `${insights.adesao}%`, sub: `${insights.realizadasN}/${insights.total} ag.`, icon: CalendarCheck, tone: insights.adesao >= 80 ? 'text-emerald-600' : insights.adesao >= 60 ? 'text-amber-600' : 'text-destructive' },
    { label: 'Faltas', value: `${insights.noShowRate}%`, sub: 'no-show', icon: CalendarX, tone: insights.noShowRate <= 10 ? 'text-emerald-600' : 'text-destructive' },
    { label: 'Receita', value: `R$ ${insights.receita.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, sub: 'realizadas', icon: DollarSign, tone: 'text-foreground' },
    { label: 'A receber', value: `R$ ${insights.inadimplencia.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, sub: 'pendente', icon: AlertTriangle, tone: insights.inadimplencia > 0 ? 'text-amber-600' : 'text-emerald-600' },
    { label: 'LTV médio', value: `R$ ${insights.ltv.toLocaleString('pt-BR')}`, sub: 'por paciente', icon: Users, tone: 'text-foreground' },
    { label: 'Ciclo', value: `${insights.cicloMedio}`, sub: 'sessões/paciente', icon: Repeat, tone: 'text-foreground' },
    { label: 'Conversão', value: `${insights.conversaoLead}%`, sub: `${insights.leadsAgendados}/${insights.totalLeads} leads`, icon: Activity, tone: 'text-foreground' },
    { label: 'Cancel.', value: `${insights.cancelRate}%`, sub: 'agendamentos', icon: Filter, tone: insights.cancelRate <= 15 ? 'text-emerald-600' : 'text-amber-600' },
  ];

  return (
    <div className="space-y-3 mb-6">
      <DashboardFilters value={filters} onChange={setFilters} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border/40 bg-card p-3 transition-shadow hover:shadow-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="metric-label">{k.label}</span>
                <Icon className="icon-xs text-muted-foreground/70" />
              </div>
              <div className={`metric-value text-2xl sm:text-3xl ${k.tone}`}>{k.value}</div>
              <div className="text-[10px] text-muted-foreground mt-1">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Funil de conversão visual */}
      {insights.totalLeads > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold mb-3">Funil de conversão (período)</h3>
          <div className="space-y-1.5">
            {[
              { label: 'Leads no funil', n: insights.totalLeads, pct: 100 },
              { label: 'Leads que agendaram', n: insights.leadsAgendados, pct: insights.totalLeads ? (insights.leadsAgendados/insights.totalLeads)*100 : 0 },
              { label: 'Sessões realizadas', n: insights.realizadasN, pct: insights.totalLeads ? (insights.realizadasN/insights.totalLeads)*100 : 0 },
            ].map((f, i) => (
              <div key={f.label}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-muted-foreground">{f.label}</span>
                  <span className="font-medium">{f.n} <span className="text-muted-foreground">({f.pct.toFixed(0)}%)</span></span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, f.pct)}%`, background: `hsl(var(--primary) / ${1 - i*0.2})` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Heatmap dia × hora */}
      {insights.realizadasN > 0 && (
        <Card className="p-4">
          <h3 className="text-xs font-semibold mb-2">Mapa de produção (dia × hora)</h3>
          <p className="text-[10px] text-muted-foreground mb-2">Verde = horários produtivos. Cinza = ociosos.</p>
          <div className="overflow-x-auto">
            <table className="text-[9px] border-collapse">
              <thead>
                <tr>
                  <th className="p-1"></th>
                  {HORAS.map(h => <th key={h} className="p-0.5 text-muted-foreground w-6">{h}h</th>)}
                </tr>
              </thead>
              <tbody>
                {DIAS.map((dia, di) => (
                  <tr key={dia}>
                    <td className="p-0.5 text-muted-foreground pr-1">{dia}</td>
                    {HORAS.map(h => {
                      const v = insights.heat[`${di}-${h}`] || 0;
                      const intensity = v / insights.heatMax;
                      return (
                        <td key={h} className="p-0">
                          <div
                            className="w-6 h-6 rounded-sm flex items-center justify-center text-[8px] font-mono"
                            style={{ background: v ? `hsl(142 71% 45% / ${0.15 + intensity*0.85})` : 'hsl(var(--muted))', color: intensity > 0.5 ? '#fff' : 'inherit' }}
                            title={`${dia} ${h}h: ${v} sessões`}
                          >
                            {v || ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Alertas */}
      {(insights.redFlagsPendentes.length > 0 || insights.emRisco.length > 0 || insights.aniversariantes.length > 0) && (
        <div className="grid md:grid-cols-3 gap-2.5">
          {insights.redFlagsPendentes.length > 0 && (
            <Card className="p-3 border-destructive/30 bg-destructive/5">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="icon-sm text-destructive" />
                <h3 className="text-xs font-semibold">Red flags sem retorno</h3>
                <Badge variant="destructive" className="ml-auto text-[10px]">{insights.redFlagsPendentes.length}</Badge>
              </div>
              <div className="space-y-1">
                {insights.redFlagsPendentes.slice(0, 4).map(p => (
                  <Link key={p.id} to={`/pacientes/${p.id}`} className="block text-xs hover:underline truncate">• {p.nome} {p.sobrenome}</Link>
                ))}
              </div>
            </Card>
          )}
          {insights.emRisco.length > 0 && (
            <Card className="p-3 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingDown className="icon-sm text-amber-600" />
                <h3 className="text-xs font-semibold">Pacientes em risco</h3>
                <Badge className="ml-auto text-[10px] bg-amber-500">{insights.emRisco.length}</Badge>
              </div>
              <div className="space-y-1">
                {insights.emRisco.slice(0, 4).map(p => (
                  <Link key={p.id} to={`/pacientes/${p.id}`} className="block text-xs hover:underline truncate">• {p.nome} {p.sobrenome}</Link>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Sem agenda + MyID piorou ou ausente &gt;60d</p>
            </Card>
          )}
          {insights.aniversariantes.length > 0 && (
            <Card className="p-3 border-primary/30 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <Cake className="icon-sm text-primary" />
                <h3 className="text-xs font-semibold">Aniversariantes (7 dias)</h3>
                <Badge className="ml-auto text-[10px]">{insights.aniversariantes.length}</Badge>
              </div>
              <div className="space-y-1">
                {insights.aniversariantes.slice(0, 4).map(p => (
                  <div key={p.id} className="text-xs truncate">• {p.nome} — {format(parseISO(p.data_nascimento!), "dd/MM", { locale: ptBR })}</div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
