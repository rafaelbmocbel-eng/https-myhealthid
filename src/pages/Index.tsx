import { Link, Navigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import {
  Activity, AlignCenter, ArrowRight, Users, CalendarDays,
  ClipboardList, Clock, Plus, Loader2,
} from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Index() {
  const { user, profile, loading } = useAuth();

  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes-count', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('pacientes').select('id, nome, sobrenome').eq('terapeuta_id', user!.id).eq('ativo', true);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: agendamentosHoje = [] } = useQuery({
    queryKey: ['agendamentos-hoje', user?.id],
    queryFn: async () => {
      const today = new Date();
      const { data } = await supabase.from('agendamentos')
        .select('*, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .gte('data_inicio', startOfDay(today).toISOString())
        .lte('data_inicio', endOfDay(today).toISOString())
        .order('data_inicio');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: avaliacoesPendentes = [] } = useQuery({
    queryKey: ['avaliacoes-pendentes', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('avaliacoes').select('id').eq('terapeuta_id', user!.id).eq('status', 'pendente');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pacienteServicos = [] } = useQuery({
    queryKey: ['paciente-servicos-count', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('paciente_servicos').select('paciente_id, servico').eq('ativo', true);
      return data || [];
    },
    enabled: !!user,
  });

  if (!loading && !user) return <Navigate to="/auth" replace />;

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  const proximoAtendimento = agendamentosHoje.find(a => {
    const inicio = parseISO(a.data_inicio);
    return inicio > new Date() && a.status !== 'cancelado';
  });

  const metodoIdentidadePacientes = pacienteServicos.filter(s => s.servico === 'metodo_identidade').length;
  const cobZeroPacientes = pacienteServicos.filter(s => s.servico === 'cob_zero').length;

  const hora = new Date().getHours();
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <AppLayout>
      <div className="container py-8 max-w-6xl">
        {/* Welcome header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black text-foreground">
            {saudacao}, {profile?.nome || 'Terapeuta'}! 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Pacientes Totais', value: pacientes.length, icon: Users, color: 'text-primary' },
            { label: 'Atendimentos Hoje', value: agendamentosHoje.length, icon: CalendarDays, color: 'text-emerald-600' },
            { label: 'Avaliações Pendentes', value: avaliacoesPendentes.length, icon: ClipboardList, color: 'text-amber-600' },
            {
              label: 'Próximo Atendimento',
              value: proximoAtendimento ? format(parseISO(proximoAtendimento.data_inicio), 'HH:mm') : '—',
              icon: Clock,
              color: 'text-blue-600',
            },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="clinical-card text-center p-4">
                <Icon className={`h-6 w-6 mx-auto mb-2 ${stat.color}`} />
                <div className="text-2xl font-black text-foreground">{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-tight">{stat.label}</div>
              </div>
            );
          })}
        </div>

        {/* Main modules */}
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {/* Método Identidade */}
          <div className="clinical-card border-2 border-primary/20 hover:border-primary/40 transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-primary flex items-center justify-center shadow-primary shrink-0">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Método Identidade</h2>
                <p className="text-xs text-muted-foreground">Avaliação Multidimensional da Dor</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pacientes</span>
                <span className="font-semibold text-primary">{metodoIdentidadePacientes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">6 Blocos de Avaliação</span>
                <span className="text-muted-foreground">Scores E, P, C, F, D, R</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/pacientes">Ver Pacientes</Link>
              </Button>
              <Button asChild size="sm" className="flex-1 bg-gradient-primary text-white">
                <Link to="/metodo-identidade">
                  Avaliar <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* COB° ZERO */}
          <div className="clinical-card border-2 border-blue-200 hover:border-blue-400 transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shrink-0">
                <AlignCenter className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">COB° ZERO</h2>
                <p className="text-xs text-muted-foreground">Protocolo Integrado de Escoliose</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pacientes</span>
                <span className="font-semibold text-blue-600">{cobZeroPacientes}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">5 Etapas</span>
                <span className="text-muted-foreground">Cobb, Lenke, Risco</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to="/pacientes">Ver Pacientes</Link>
              </Button>
              <Button asChild size="sm" className="flex-1 text-white" style={{ background: 'linear-gradient(135deg, hsl(210 80% 45%), hsl(187 76% 45%))' }}>
                <Link to="/cob-zero">
                  Protocolo <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Agenda Premium */}
          <div className="clinical-card border-2 border-amber-200 hover:border-amber-400 transition-all flex flex-col">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shrink-0">
                <CalendarDays className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Agenda Premium</h2>
                <p className="text-xs text-muted-foreground">Calendário Inteligente · Slots 45min</p>
              </div>
            </div>
            <div className="flex-1 space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Hoje</span>
                <span className="font-semibold text-amber-600">{agendamentosHoje.length} atendimentos</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Horário</span>
                <span className="text-muted-foreground">6h – 20h</span>
              </div>
            </div>
            <Button asChild size="sm" className="w-full text-white" style={{ background: 'linear-gradient(135deg, hsl(40 96% 52%), hsl(25 95% 53%))' }}>
              <Link to="/agenda">
                Abrir Agenda <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {/* Today's schedule */}
        {agendamentosHoje.length > 0 && (
          <div className="clinical-card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-foreground">Agenda de Hoje</h2>
              <Button asChild variant="ghost" size="sm" className="text-primary">
                <Link to="/agenda">Ver tudo <ArrowRight className="h-3.5 w-3.5 ml-1" /></Link>
              </Button>
            </div>
            <div className="space-y-2">
              {agendamentosHoje.slice(0, 5).map((ag: any) => {
                const inicio = parseISO(ag.data_inicio);
                const isPast = inicio < new Date();
                return (
                  <div key={ag.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${isPast ? 'opacity-60' : 'hover:bg-accent/10'}`}>
                    <div className="text-sm font-mono font-bold text-primary w-12 shrink-0">
                      {format(inicio, 'HH:mm')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {ag.pacientes ? `${ag.pacientes.nome} ${ag.pacientes.sobrenome}` : ag.titulo || 'Agendamento'}
                      </div>
                      <div className="text-xs text-muted-foreground">{ag.tipo_atendimento || 'Retorno'}</div>
                    </div>
                    <div className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      ag.status === 'confirmado' ? 'bg-emerald-100 text-emerald-700' :
                      ag.status === 'pendente' ? 'bg-amber-100 text-amber-700' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {ag.status}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild variant="outline" className="gap-2">
            <Link to="/pacientes"><Plus className="h-4 w-4" /> Novo Paciente</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/agenda"><CalendarDays className="h-4 w-4" /> Agendar</Link>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/metodo-identidade"><ClipboardList className="h-4 w-4" /> Nova Avaliação</Link>
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
