import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle, TrendingDown, CalendarX, CalendarCheck, Cake, Activity, Users, Loader2,
} from 'lucide-react';
import { differenceInDays, parseISO, format, addDays, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router-dom';

type Pac = {
  id: string; nome: string; sobrenome: string;
  data_nascimento: string | null; ativo: boolean; created_at: string;
};

/**
 * Painel estratégico da clínica — usa TODOS os dados gerados:
 * pacientes, MyID, presencial (voz), agendamentos, controle_sessoes, evolucao_paciente.
 * Mostra alertas operacionais que ajudam decisão diária.
 */
export default function ClinicalInsights() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['clinical-insights', user?.id],
    queryFn: async () => {
      const since = new Date(); since.setDate(since.getDate() - 30);
      const sinceISO = since.toISOString();
      const [pac, ava, voz, ag, ses, evo] = await Promise.all([
        supabase.from('pacientes').select('id, nome, sobrenome, data_nascimento, ativo, created_at').eq('terapeuta_id', user!.id).eq('ativo', true),
        supabase.from('avaliacoes_identidade').select('paciente_id, myid_score, red_flags, classificacao, created_at').eq('terapeuta_id', user!.id),
        supabase.from('avaliacoes_voz').select('paciente_id, classificacao_severidade, created_at').eq('terapeuta_id', user!.id),
        supabase.from('agendamentos').select('paciente_id, data_inicio, status').eq('terapeuta_id', user!.id).gte('data_inicio', sinceISO),
        supabase.from('controle_sessoes').select('paciente_id, status, valor_cobrado, data_sessao').eq('terapeuta_id', user!.id).gte('data_sessao', sinceISO),
        supabase.from('evolucao_paciente').select('paciente_id, myid_score, delta_id_final, data_registro').eq('terapeuta_id', user!.id),
      ]);
      return {
        pacientes: (pac.data || []) as Pac[],
        myid: ava.data || [],
        voz: voz.data || [],
        agendamentos: ag.data || [],
        sessoes: ses.data || [],
        evolucao: evo.data || [],
      };
    },
    enabled: !!user,
  });

  const insights = useMemo(() => {
    if (!data) return null;
    const { pacientes, myid, agendamentos, sessoes, evolucao } = data;
    const now = new Date();
    const hoje = format(now, 'yyyy-MM-dd');

    // Última MyID por paciente
    const lastMyID = new Map<string, any>();
    myid.forEach(m => {
      const cur = lastMyID.get(m.paciente_id);
      if (!cur || m.created_at > cur.created_at) lastMyID.set(m.paciente_id, m);
    });

    // Próximo agendamento por paciente (futuro)
    const nextAppt = new Map<string, string>();
    agendamentos.forEach(a => {
      if (a.data_inicio < now.toISOString()) return;
      if (a.status === 'cancelado') return;
      const cur = nextAppt.get(a.paciente_id!);
      if (!cur || a.data_inicio < cur) nextAppt.set(a.paciente_id!, a.data_inicio);
    });

    // 1. Red flags ativos sem retorno agendado
    const redFlagsPendentes = pacientes.filter(p => {
      const m = lastMyID.get(p.id);
      const rf = Array.isArray(m?.red_flags) ? m.red_flags : [];
      return rf.length > 0 && !nextAppt.has(p.id);
    });

    // 2. Pacientes em risco: sem agendamento futuro + MyID piorou ou sem MyID > 60 dias
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

    // 3. No-show rate (últimos 30d)
    const total30 = agendamentos.length;
    const faltas = agendamentos.filter(a => a.status === 'falta' || a.status === 'no_show').length;
    const cancelados = agendamentos.filter(a => a.status === 'cancelado').length;
    const noShowRate = total30 ? +((faltas / total30) * 100).toFixed(1) : 0;
    const cancelRate = total30 ? +((cancelados / total30) * 100).toFixed(1) : 0;

    // 4. Adesão (sessões realizadas / agendadas)
    const realizadas = sessoes.filter(s => s.status === 'realizada').length;
    const adesao = total30 ? +((realizadas / total30) * 100).toFixed(1) : 0;

    // 5. Receita 30d
    const receita = sessoes.filter(s => s.status === 'realizada').reduce((s, x) => s + Number(x.valor_cobrado || 0), 0);

    // 6. Aniversariantes próximos 7 dias
    const proximos = pacientes.filter(p => {
      if (!p.data_nascimento) return false;
      const d = parseISO(p.data_nascimento);
      const thisYear = new Date(now.getFullYear(), d.getMonth(), d.getDate());
      return isWithinInterval(thisYear, { start: now, end: addDays(now, 7) });
    });

    // 7. Distribuição de horários produtivos (sessões realizadas por hora)
    const porHora: Record<number, number> = {};
    sessoes.filter(s => s.status === 'realizada').forEach(s => {
      const h = new Date(s.data_sessao).getHours();
      porHora[h] = (porHora[h] || 0) + 1;
    });
    const horarioTop = Object.entries(porHora).sort((a,b) => b[1]-a[1])[0];

    return {
      redFlagsPendentes, emRisco,
      noShowRate, cancelRate, adesao, receita, total30, realizadas,
      aniversariantes: proximos,
      horarioTop: horarioTop ? `${horarioTop[0]}h (${horarioTop[1]} sessões)` : '—',
      n_ativos: pacientes.length,
    };
  }, [data]);

  if (isLoading || !insights) {
    return <div className="flex justify-center py-6"><Loader2 className="icon-md animate-spin text-primary" /></div>;
  }

  const kpis = [
    { label: 'Adesão (30d)', value: `${insights.adesao}%`, sub: `${insights.realizadas}/${insights.total30} sessões`, icon: CalendarCheck, tone: insights.adesao >= 80 ? 'text-emerald-600' : insights.adesao >= 60 ? 'text-amber-600' : 'text-destructive' },
    { label: 'Faltas', value: `${insights.noShowRate}%`, sub: 'no-show rate', icon: CalendarX, tone: insights.noShowRate <= 10 ? 'text-emerald-600' : 'text-destructive' },
    { label: 'Receita (30d)', value: `R$ ${insights.receita.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`, sub: 'sessões realizadas', icon: Activity, tone: 'text-foreground' },
    { label: 'Pico de produção', value: insights.horarioTop, sub: 'horário top', icon: Users, tone: 'text-foreground' },
  ];

  return (
    <div className="space-y-3 mb-6">
      {/* KPIs estratégicos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-xl border border-border/40 bg-card p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-micro">{k.label}</span>
                <Icon className="icon-xs text-muted-foreground/70" />
              </div>
              <div className={`text-lg sm:text-xl font-semibold tracking-tight ${k.tone}`}>{k.value}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{k.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Alertas críticos */}
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
                  <Link key={p.id} to={`/pacientes/${p.id}`} className="block text-xs hover:underline truncate">
                    • {p.nome} {p.sobrenome}
                  </Link>
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
                  <Link key={p.id} to={`/pacientes/${p.id}`} className="block text-xs hover:underline truncate">
                    • {p.nome} {p.sobrenome}
                  </Link>
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
                  <div key={p.id} className="text-xs truncate">
                    • {p.nome} — {format(parseISO(p.data_nascimento!), "dd/MM", { locale: ptBR })}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
