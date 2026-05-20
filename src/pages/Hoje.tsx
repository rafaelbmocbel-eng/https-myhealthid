import { Navigate, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, startOfDay, endOfDay, isAfter, formatDistanceToNow, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Sun, Clock, AlertTriangle, ClipboardList, CalendarDays, Users,
  ArrowRight, MessageCircle, Plus, CheckCircle2, Activity, Sparkles,
} from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Hoje() {
  const { user, profile, loading, authReady } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const greeting = (() => {
    const h = today.getHours();
    if (h < 12) return 'Bom dia';
    if (h < 18) return 'Boa tarde';
    return 'Boa noite';
  })();

  const { data: agendaHoje = [], isLoading: loadingAgenda } = useQuery({
    queryKey: ['hoje-agenda', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('id, data_inicio, data_fim, status, tipo_atendimento, observacoes, pacientes(id, nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .gte('data_inicio', startOfDay(today).toISOString())
        .lte('data_inicio', endOfDay(today).toISOString())
        .order('data_inicio');
      return data || [];
    },
    enabled: authReady && !!user,
    staleTime: 60_000,
  });

  const { data: alertas = [], isLoading: loadingAlertas } = useQuery({
    queryKey: ['hoje-alertas', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('id, paciente_id, created_at, classificacao, red_flags, pacientes(id, nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .not('red_flags', 'is', null)
        .order('created_at', { ascending: false })
        .limit(5);
      return (data || []).filter((a: any) => a.red_flags);
    },
    enabled: authReady && !!user,
    staleTime: 60_000,
  });

  const { data: pendencias, isLoading: loadingPend } = useQuery({
    queryKey: ['hoje-pendencias', user?.id],
    queryFn: async () => {
      const [myidPend, semMyid, msgsNaoLidas] = await Promise.all([
        supabase.from('myid_avaliacoes').select('id, token_acesso, created_at', { count: 'exact' })
          .eq('terapeuta_id', user!.id).eq('status', 'pendente')
          .gte('created_at', subDays(today, 14).toISOString()),
        supabase.from('pacientes').select('id, nome, sobrenome, created_at').eq('terapeuta_id', user!.id)
          .eq('ativo', true).order('created_at', { ascending: false }).limit(50),
        supabase.from('whatsapp_mensagens').select('id', { count: 'exact', head: true })
          .eq('terapeuta_id', user!.id).eq('direcao', 'inbound').eq('lida', false),
      ]);
      return {
        myidPendentes: myidPend.count || 0,
        novosPacientes: (semMyid.data || []).filter((p: any) =>
          new Date(p.created_at) > subDays(today, 3)).length,
        msgsNaoLidas: msgsNaoLidas.count || 0,
      };
    },
    enabled: authReady && !!user,
    staleTime: 60_000,
  });

  if (!loading && !user) return <Navigate to="/auth" replace />;

  const proximos = agendaHoje.filter((a: any) => {
    const t = parseISO(a.data_inicio);
    return isAfter(t, today) && a.status !== 'cancelado';
  }).slice(0, 4);

  const proximo = proximos[0];
  const restantes = agendaHoje.filter((a: any) => a.status !== 'cancelado' && a.status !== 'concluido').length;
  const concluidos = agendaHoje.filter((a: any) => a.status === 'concluido').length;

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header / greeting */}
        <header className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Sun className="h-3.5 w-3.5" />
              {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold mt-1">
              {greeting}, {profile?.nome?.split(' ')[0] || 'doutor(a)'}.
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Você tem <strong className="text-foreground">{restantes}</strong> atendimento{restantes !== 1 ? 's' : ''} pendente{restantes !== 1 ? 's' : ''} hoje
              {concluidos > 0 && <> · {concluidos} concluído{concluidos !== 1 ? 's' : ''}</>}.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/agenda')} className="shrink-0">
            <CalendarDays className="h-4 w-4 mr-2" />
            Agenda
          </Button>
        </header>

        {/* Próximo atendimento — destaque */}
        {loadingAgenda ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : proximo ? (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs uppercase tracking-wider text-primary font-semibold">Próximo atendimento</div>
                <div className="font-bold text-lg truncate">
                  {(proximo as any).pacientes?.nome} {(proximo as any).pacientes?.sobrenome}
                </div>
                <div className="text-sm text-muted-foreground">
                  {format(parseISO(proximo.data_inicio), "HH:mm", { locale: ptBR })}
                  {' · '}
                  {(proximo as any).tipo_atendimento || 'Consulta'}
                  {' · '}
                  em {formatDistanceToNow(parseISO(proximo.data_inicio), { locale: ptBR })}
                </div>
              </div>
              {(proximo as any).pacientes?.id && (
                <Button size="sm" onClick={() => navigate(`/pacientes/${(proximo as any).pacientes.id}`)}>
                  Abrir
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              Nenhum atendimento restante para hoje. Aproveite.
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Lista de hoje */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-muted-foreground" /> Agenda de hoje</span>
                <Link to="/agenda" className="text-xs font-normal text-primary hover:underline">Ver tudo</Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-1.5">
              {loadingAgenda ? (
                <>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </>
              ) : agendaHoje.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">Dia livre.</p>
              ) : (
                agendaHoje.slice(0, 6).map((a: any) => {
                  const done = a.status === 'concluido';
                  const cancel = a.status === 'cancelado';
                  return (
                    <button
                      key={a.id}
                      onClick={() => a.pacientes?.id && navigate(`/pacientes/${a.pacientes.id}`)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted/60 transition text-left',
                        cancel && 'opacity-50',
                      )}
                    >
                      <div className="text-xs font-mono font-semibold w-12 text-muted-foreground">
                        {format(parseISO(a.data_inicio), 'HH:mm')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={cn('text-sm font-medium truncate', done && 'line-through')}>
                          {a.pacientes?.nome} {a.pacientes?.sobrenome}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {a.tipo_atendimento || 'Consulta'}
                        </div>
                      </div>
                      {done && <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Alertas críticos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Alertas críticos
                {alertas.length > 0 && (
                  <span className="ml-auto text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                    {alertas.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 space-y-1.5">
              {loadingAlertas ? (
                <Skeleton className="h-12 w-full" />
              ) : alertas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3 text-center">Nenhum red flag ativo. ✅</p>
              ) : (
                alertas.map((a: any) => (
                  <button
                    key={a.id}
                    onClick={() => a.paciente_id && navigate(`/pacientes/${a.paciente_id}`)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-amber-500/10 transition text-left border border-amber-500/20"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {a.pacientes?.nome} {a.pacientes?.sobrenome}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        Red flag · {a.classificacao || 'MyID'} · {formatDistanceToNow(parseISO(a.created_at), { locale: ptBR, addSuffix: true })}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pendências */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-muted-foreground" /> Pendências do dia
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {loadingPend ? (
              <>
                <Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" />
              </>
            ) : (
              <>
                <PendenciaItem
                  icon={ClipboardList}
                  label="MyID aguardando resposta"
                  count={pendencias?.myidPendentes || 0}
                  cta="Pacientes"
                  onClick={() => navigate('/pacientes')}
                />
                <PendenciaItem
                  icon={MessageCircle}
                  label="Mensagens não lidas"
                  count={pendencias?.msgsNaoLidas || 0}
                  cta="WhatsApp"
                  onClick={() => navigate('/crm/inbox')}
                  tone="emerald"
                />
                <PendenciaItem
                  icon={Users}
                  label="Novos pacientes (3 dias)"
                  count={pendencias?.novosPacientes || 0}
                  cta="Ver"
                  onClick={() => navigate('/pacientes')}
                  tone="primary"
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Ações rápidas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" /> Ações rápidas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <QuickBtn icon={Plus} label="Novo agendamento" onClick={() => navigate('/agenda')} />
            <QuickBtn icon={Users} label="Novo paciente" onClick={() => navigate('/pacientes')} />
            <QuickBtn icon={MessageCircle} label="WhatsApp" onClick={() => navigate('/crm/inbox')} />
            <QuickBtn icon={Activity} label="Dashboard" onClick={() => navigate('/inicio-app')} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function PendenciaItem({
  icon: Icon, label, count, cta, onClick, tone = 'amber',
}: {
  icon: any; label: string; count: number; cta: string; onClick: () => void;
  tone?: 'amber' | 'emerald' | 'primary';
}) {
  const empty = count === 0;
  const toneClass = empty
    ? 'border-border/40 text-muted-foreground'
    : tone === 'emerald' ? 'border-emerald-500/30 bg-emerald-500/5'
    : tone === 'primary' ? 'border-primary/30 bg-primary/5'
    : 'border-amber-500/30 bg-amber-500/5';
  return (
    <button
      onClick={onClick}
      className={cn('flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition hover:shadow-sm', toneClass)}
    >
      <Icon className="h-4 w-4" />
      <div className="text-2xl font-bold leading-none">{count}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
      <div className="text-[11px] font-medium mt-1 flex items-center gap-1">
        {cta} <ArrowRight className="h-3 w-3" />
      </div>
    </button>
  );
}

function QuickBtn({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border border-border/40 hover:bg-muted/60 hover:border-border transition text-center"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium">{label}</span>
    </button>
  );
}
