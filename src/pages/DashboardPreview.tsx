import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import {
  ArrowRight, Users, CalendarDays, ClipboardList, CheckCircle2, XCircle,
  UserX, Shield, AlignCenter, UserPlus, Stethoscope, FlaskConical,
} from 'lucide-react';
import { format, subMinutes, subHours, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Preview público do Dashboard (/index) com dados mockados.
 * Rota: /preview/dashboard  — sem autenticação, apenas para captura visual
 * e prototipação de design. Não consulta o banco.
 */
export default function DashboardPreview() {
  const now = new Date();

  const agendamentosHoje = [
    { id: '1', hora: subHours(now, -1), nome: 'Mariana Castro', tipo: 'Retorno', status: 'confirmado' },
    { id: '2', hora: subHours(now, -2), nome: 'João Pedro Lima', tipo: 'Avaliação MyID', status: 'confirmado' },
    { id: '3', hora: subHours(now, -3), nome: 'Renata Silveira', tipo: 'Sessão', status: 'pendente' },
    { id: '4', hora: subHours(now, -4), nome: 'Carlos Andrade', tipo: 'Retorno', status: 'confirmado' },
    { id: '5', hora: subHours(now, -5), nome: 'Beatriz Souza', tipo: 'Avaliação inicial', status: 'pendente' },
  ];

  const alertas = [
    { id: 'a1', nome: 'Helena Martins', t: subHours(now, 3) },
    { id: 'a2', nome: 'Lucas Pereira', t: subHours(now, 9) },
    { id: 'a3', nome: 'Patrícia Nunes', t: subDays(now, 1) },
  ];

  const atividades = [
    { id: 'x1', nome: 'Mariana Castro', desc: 'Concluiu MyID v2.0 — score 78', icon: 'clipboard', t: subMinutes(now, 18) },
    { id: 'x2', nome: 'João Pedro Lima', desc: 'Sessão concluída — Retorno', icon: 'calendar', t: subHours(now, 2) },
    { id: 'x3', nome: 'Carla Mendes', desc: 'Novo paciente cadastrado', icon: 'user', t: subHours(now, 5) },
    { id: 'x4', nome: 'Diogo Reis', desc: 'Avaliação presencial atualizada', icon: 'align', t: subHours(now, 8) },
  ];

  const stats = {
    avaliacoesMyId: 142,
    avaliacoesPresenciais: 89,
    diretrizesAtivas: 34,
    sessoes30d: 187,
    taxaPresenca: 92,
    concluidos: 156,
    faltas: 11,
    cancelados: 8,
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-3 sm:px-6 py-4 sm:py-6 max-w-7xl">
        {/* Preview banner */}
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
          <strong>Modo preview</strong> — dados fictícios apenas para captura visual. Sem autenticação.
        </div>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {format(now, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </p>
        </div>

        {/* Vertente toggle */}
        <div className="inline-flex p-1 rounded-xl border border-border/40 bg-card mb-5">
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground">
            <Stethoscope className="icon-xs" /> Visão Clínica
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground">
            <FlaskConical className="icon-xs" /> Pesquisa Científica
          </button>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-6 sm:mb-8">
          {[
            { label: 'Pacientes', value: 47, icon: Users },
            { label: 'Hoje', value: agendamentosHoje.length, icon: CalendarDays },
            { label: 'Pendentes', value: 6, icon: ClipboardList },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="block rounded-xl border border-border/40 bg-card p-3 sm:p-4">
                <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 mb-1.5 truncate">
                  {stat.label}
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="text-2xl font-semibold text-foreground tracking-tight tabular-nums leading-none">
                    {stat.value}
                  </div>
                  <Icon className="icon-xs text-muted-foreground/50 mb-0.5 shrink-0" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Today's schedule */}
        <section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="h-section">Agenda de hoje</h2>
            <Button asChild variant="ghost" size="sm" className="text-primary h-8">
              <Link to="#">Ver tudo <ArrowRight className="icon-xs ml-1" /></Link>
            </Button>
          </div>
          <div className="space-y-1">
            {agendamentosHoje.map(ag => (
              <div key={ag.id} className="flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/50">
                <div className="text-sm font-mono font-semibold text-foreground w-12 shrink-0 tabular-nums">
                  {format(ag.hora, 'HH:mm')}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{ag.nome}</div>
                  <div className="text-caption">{ag.tipo}</div>
                </div>
                <div className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  ag.status === 'confirmado' ? 'bg-emerald-50 text-emerald-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  {ag.status}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Alertas clínicos */}
        <section className="rounded-xl border border-destructive/20 bg-destructive/[0.02] p-4 sm:p-5 mb-6">
          <div className="flex items-center gap-2.5 mb-4">
            <Shield className="icon-sm text-destructive" />
            <div className="min-w-0">
              <h2 className="h-section text-destructive">Alertas clínicos ativos</h2>
              <p className="text-caption">Pacientes com Red Flags recentes</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-2.5">
            {alertas.map(a => (
              <div key={a.id} className="text-left p-3 rounded-lg border border-destructive/15 bg-card">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground truncate">{a.nome}</span>
                </div>
                <div className="text-caption">Perímetro de alerta MyID acionado</div>
                <div className="text-[10px] text-muted-foreground mt-1.5">
                  há {Math.round((now.getTime() - a.t.getTime()) / 3600000)}h
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Últimas atividades */}
        <section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="h-section">Últimas atividades</h2>
          </div>
          <div className="space-y-0.5">
            {atividades.map(item => {
              const Icon = item.icon === 'calendar' ? CalendarDays : item.icon === 'clipboard' ? ClipboardList : item.icon === 'align' ? AlignCenter : UserPlus;
              return (
                <div key={item.id} className="w-full flex items-center gap-3 px-2 py-2.5 rounded-lg hover:bg-muted/50">
                  <div className="h-8 w-8 rounded-lg bg-muted/70 flex items-center justify-center shrink-0">
                    <Icon className="icon-sm text-foreground/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{item.nome}</div>
                    <div className="text-caption truncate">{item.desc}</div>
                  </div>
                  <div className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    há {Math.round((now.getTime() - item.t.getTime()) / 60000)} min
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Estatísticas gerais */}
        <section className="rounded-xl border border-border/40 bg-card p-4 sm:p-5 mb-6">
          <div className="mb-5">
            <h2 className="h-section">Estatísticas gerais</h2>
            <p className="text-caption mt-0.5">Visão consolidada dos últimos 30 dias</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mb-5">
            {[
              { label: 'Avaliações MyID', value: stats.avaliacoesMyId },
              { label: 'Avaliações presenciais', value: stats.avaliacoesPresenciais },
              { label: 'Diretrizes ativas', value: stats.diretrizesAtivas },
              { label: 'Sessões (30d)', value: stats.sessoes30d },
              { label: 'Taxa de presença', value: `${stats.taxaPresenca}%` },
            ].map(s => (
              <div key={s.label} className="rounded-lg border border-border/40 bg-background p-3">
                <div className="text-micro mb-1.5">{s.label}</div>
                <div className="text-xl font-semibold text-foreground tracking-tight">{s.value}</div>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { count: stats.concluidos, label: 'Concluídos', icon: CheckCircle2, color: 'text-emerald-600' },
              { count: stats.faltas, label: 'Faltas', icon: UserX, color: 'text-destructive' },
              { count: stats.cancelados, label: 'Cancelados', icon: XCircle, color: 'text-muted-foreground' },
            ].map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-muted/40">
                  <Icon className={`icon-sm ${s.color}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground">{s.count}</div>
                    <div className="text-[10px] text-muted-foreground">{s.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
