import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Users, UserCheck, AlertTriangle, Phone, Clock,
  TrendingUp, ChevronRight, CalendarDays, Activity,
  UserX, PhoneCall, Eye, EyeOff, CalendarCheck, CalendarPlus,
  RefreshCw, Target, Repeat, X
} from 'lucide-react';
import { differenceInDays, format, formatDistanceToNow, addDays, addMonths, isFuture, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface MembroEquipe {
  id: string;
  nome: string;
  cor: string;
  ativo: boolean;
}

interface PacienteData {
  id: string;
  nome: string;
  sobrenome: string;
  telefone?: string;
  email?: string;
  created_at: string;
  _servicos?: string[];
}

interface AgendamentoData {
  paciente_id: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  tipo_atendimento?: string;
  membro_equipe_id?: string;
}

interface Props {
  pacientes: PacienteData[];
  ultimosAgendamentos: Record<string, { data: string; status: string }>;
  todosAgendamentos: AgendamentoData[];
  membrosEquipe: MembroEquipe[];
  agendamentosPorMembro?: Record<string, string[]>;
}

const SERVICO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  metodo_identidade: { label: 'Identidade', color: 'text-primary', bg: 'bg-primary/10' },
  cob_zero: { label: 'COB° ZERO', color: 'text-blue-700', bg: 'bg-blue-100' },
  studio_personal_id: { label: 'Studio', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  agenda_premium: { label: 'Agenda', color: 'text-amber-700', bg: 'bg-amber-100' },
};

type CicloTipo = 'mensal' | 'trimestral' | 'semestral' | 'anual';

const CICLO_CONFIG: Record<CicloTipo, { label: string; dias: number; icon: string; color: string }> = {
  mensal: { label: 'Mensal', dias: 30, icon: '📅', color: 'text-blue-600' },
  trimestral: { label: 'Trimestral', dias: 90, icon: '📊', color: 'text-emerald-600' },
  semestral: { label: 'Semestral', dias: 180, icon: '📈', color: 'text-amber-600' },
  anual: { label: 'Anual', dias: 365, icon: '🎯', color: 'text-primary' },
};

type TabView = 'resumo' | 'agenda' | 'ciclos';

export default function PainelAcompanhamento({ pacientes, ultimosAgendamentos, todosAgendamentos, membrosEquipe, agendamentosPorMembro = {} }: Props) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<TabView>('resumo');
  const [expandedKpi, setExpandedKpi] = useState<string | null>(null);

  const now = new Date();

  // ── Derived data ──────────────────────────────────────────────────
  const {
    ativos, inativos, ativosList, inativosList, precisamContato, semConsulta,
    porServico, porProfissional, alertas,
    proximosConfirmados, semFuturo, ciclosPacientes,
  } = useMemo(() => {
    let ativosCount = 0;
    let inativosCount = 0;
    const ativosList: PacienteData[] = [];
    const inativosList: PacienteData[] = [];
    const precisam: PacienteData[] = [];
    const sem: PacienteData[] = [];
    const servCount: Record<string, number> = {};
    const profCount: Record<string, { nome: string; cor: string; count: number }> = {};

    // Build paciente->membro mapping
    const pacienteMembro: Record<string, string> = {};
    Object.entries(agendamentosPorMembro).forEach(([membroId, pIds]) => {
      pIds.forEach(pid => { pacienteMembro[pid] = membroId; });
    });

    // Group all agendamentos by paciente
    const agsPorPaciente: Record<string, AgendamentoData[]> = {};
    todosAgendamentos.forEach(a => {
      if (!a.paciente_id) return;
      if (!agsPorPaciente[a.paciente_id]) agsPorPaciente[a.paciente_id] = [];
      agsPorPaciente[a.paciente_id].push(a);
    });

    // Future confirmed appointments
    const proxConf: { paciente: PacienteData; ag: AgendamentoData }[] = [];
    // Patients with no future confirmed appointment
    const semFut: { paciente: PacienteData; ultimaData?: string; sugestao: string; ciclo: CicloTipo }[] = [];
    // Cycle analysis per patient
    const ciclos: {
      paciente: PacienteData;
      totalSessoes: number;
      mediaIntervaloDias: number;
      cicloDetectado: CicloTipo;
      proximoIdeal: Date;
      vencido: boolean;
      proximoConfirmado?: string;
    }[] = [];

    pacientes.forEach(p => {
      const ultimo = ultimosAgendamentos[p.id];
      const ags = agsPorPaciente[p.id] || [];
      const agsFuturos = ags.filter(a =>
        isFuture(new Date(a.data_inicio)) &&
        (a.status === 'confirmado' || a.status === 'pendente')
      ).sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

      const agsPassados = ags.filter(a =>
        isPast(new Date(a.data_inicio)) &&
        (a.status === 'concluido' || a.status === 'confirmado')
      ).sort((a, b) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime());

      if (!ultimo) {
        sem.push(p);
        inativosCount++;
        inativosList.push(p);
      } else {
        const dias = differenceInDays(now, new Date(ultimo.data));
        if (dias <= 30) {
          ativosCount++;
          ativosList.push(p);
        } else {
          inativosCount++;
          inativosList.push(p);
        }
        if (dias >= 15 && dias <= 90) precisam.push(p);
      }

      // Services count
      (p._servicos || []).forEach(s => { servCount[s] = (servCount[s] || 0) + 1; });

      // Professional count
      const membroId = pacienteMembro[p.id];
      if (membroId) {
        const membro = membrosEquipe.find(m => m.id === membroId);
        if (membro) {
          if (!profCount[membroId]) profCount[membroId] = { nome: membro.nome, cor: membro.cor, count: 0 };
          profCount[membroId].count++;
        }
      }

      // Future appointments
      if (agsFuturos.length > 0) {
        proxConf.push({ paciente: p, ag: agsFuturos[0] });
      }

      // Cycle detection
      if (agsPassados.length >= 2) {
        const intervalos: number[] = [];
        for (let i = 1; i < agsPassados.length; i++) {
          intervalos.push(differenceInDays(
            new Date(agsPassados[i].data_inicio),
            new Date(agsPassados[i - 1].data_inicio)
          ));
        }
        const media = intervalos.reduce((a, b) => a + b, 0) / intervalos.length;
        let ciclo: CicloTipo = 'mensal';
        if (media > 270) ciclo = 'anual';
        else if (media > 120) ciclo = 'semestral';
        else if (media > 50) ciclo = 'trimestral';

        const ultimaConsulta = new Date(agsPassados[agsPassados.length - 1].data_inicio);
        const proximoIdeal = addDays(ultimaConsulta, Math.round(media));
        const vencido = isPast(proximoIdeal);

        ciclos.push({
          paciente: p,
          totalSessoes: agsPassados.length,
          mediaIntervaloDias: Math.round(media),
          cicloDetectado: ciclo,
          proximoIdeal,
          vencido,
          proximoConfirmado: agsFuturos[0]?.data_inicio,
        });

        if (agsFuturos.length === 0 && ultimo) {
          const diasDesde = differenceInDays(now, new Date(ultimo.data));
          const sugestao = format(proximoIdeal, "dd/MM/yyyy", { locale: ptBR });
          semFut.push({ paciente: p, ultimaData: ultimo.data, sugestao, ciclo });
        }
      } else if (agsFuturos.length === 0 && ultimo) {
        const diasDesde = differenceInDays(now, new Date(ultimo.data));
        if (diasDesde >= 15) {
          const sugestao = format(addDays(new Date(ultimo.data), 30), "dd/MM/yyyy", { locale: ptBR });
          semFut.push({ paciente: p, ultimaData: ultimo.data, sugestao, ciclo: 'mensal' });
        }
      }
    });

    // Sort
    precisam.sort((a, b) => {
      const dA = ultimosAgendamentos[a.id] ? differenceInDays(now, new Date(ultimosAgendamentos[a.id].data)) : 999;
      const dB = ultimosAgendamentos[b.id] ? differenceInDays(now, new Date(ultimosAgendamentos[b.id].data)) : 999;
      return dB - dA;
    });
    proxConf.sort((a, b) => new Date(a.ag.data_inicio).getTime() - new Date(b.ag.data_inicio).getTime());
    ciclos.sort((a, b) => (a.vencido === b.vencido ? a.proximoIdeal.getTime() - b.proximoIdeal.getTime() : a.vencido ? -1 : 1));
    semFut.sort((a, b) => {
      const dA = a.ultimaData ? differenceInDays(now, new Date(a.ultimaData)) : 999;
      const dB = b.ultimaData ? differenceInDays(now, new Date(b.ultimaData)) : 999;
      return dB - dA;
    });

    return {
      ativos: ativosCount,
      inativos: inativosCount,
      ativosList,
      inativosList,
      precisamContato: precisam,
      semConsulta: sem,
      porServico: servCount,
      porProfissional: profCount,
      alertas: precisam.length + sem.length,
      proximosConfirmados: proxConf,
      semFuturo: semFut,
      ciclosPacientes: ciclos,
    };
  }, [pacientes, ultimosAgendamentos, todosAgendamentos, membrosEquipe, agendamentosPorMembro]);

  const getUrgencyLevel = (pid: string) => {
    const ultimo = ultimosAgendamentos[pid];
    if (!ultimo) return { color: 'text-muted-foreground', label: 'Sem consultas' };
    const dias = differenceInDays(now, new Date(ultimo.data));
    if (dias >= 60) return { color: 'text-destructive', label: `${dias}d sem contato` };
    if (dias >= 30) return { color: 'text-orange-600', label: `${dias}d sem contato` };
    if (dias >= 15) return { color: 'text-amber-600', label: `${dias}d sem contato` };
    return { color: 'text-emerald-600', label: 'Ativo' };
  };

  const totalServicos = Object.values(porServico).reduce((a, b) => a + b, 0);
  const vencidos = ciclosPacientes.filter(c => c.vencido && !c.proximoConfirmado).length;

  const tabs: { key: TabView; label: string; icon: typeof Activity; badge?: number }[] = [
    { key: 'resumo', label: 'Resumo', icon: Activity, badge: alertas > 0 ? alertas : undefined },
    { key: 'agenda', label: 'Agenda', icon: CalendarCheck, badge: proximosConfirmados.length > 0 ? proximosConfirmados.length : undefined },
    { key: 'ciclos', label: 'Ciclos', icon: Repeat, badge: vencidos > 0 ? vencidos : undefined },
  ];

  return (
    <div className="space-y-3">
      {/* Toggle Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-1 group"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Painel de Acompanhamento</h2>
          {alertas > 0 && (
            <Badge variant="destructive" className="text-[10px] h-5 px-1.5">
              {alertas} alerta{alertas > 1 ? 's' : ''}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          {expanded ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span className="text-[10px]">{expanded ? 'Ocultar' : 'Expandir'}</span>
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="space-y-3">
              {/* KPI Cards Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { key: 'ativos', icon: UserCheck, label: 'Ativos', value: ativos, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30', list: ativosList },
                  { key: 'inativos', icon: UserX, label: 'Inativos', value: inativos, color: 'text-muted-foreground', bg: 'bg-muted/50', list: inativosList },
                  { key: 'agendados', icon: CalendarCheck, label: 'Agendados', value: proximosConfirmados.length, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/30', list: proximosConfirmados.map(c => c.paciente) },
                  { key: 'vencidos', icon: AlertTriangle, label: 'Vencidos', value: vencidos, color: 'text-destructive', bg: 'bg-destructive/5', list: ciclosPacientes.filter(c => c.vencido && !c.proximoConfirmado).map(c => c.paciente) },
                ].map(kpi => {
                  const Icon = kpi.icon;
                  const isOpen = expandedKpi === kpi.key;
                  return (
                    <div key={kpi.key}>
                      <Card
                        className={cn('border-0 shadow-sm cursor-pointer transition-all hover:ring-1 hover:ring-primary/30', kpi.bg, isOpen && 'ring-1 ring-primary/40')}
                        onClick={() => setExpandedKpi(isOpen ? null : kpi.key)}
                      >
                        <CardContent className="p-3 flex items-center gap-2.5">
                          <Icon className={cn('h-4 w-4 shrink-0', kpi.color)} />
                          <div className="flex-1">
                            <div className={cn('text-lg font-black leading-none', kpi.color)}>{kpi.value}</div>
                            <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</div>
                          </div>
                          <ChevronRight className={cn('h-3 w-3 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>

              {/* Expanded KPI Patient List */}
              <AnimatePresence>
                {expandedKpi && (() => {
                  const kpiMap: Record<string, { label: string; list: PacienteData[] }> = {
                    ativos: { label: 'Clientes Ativos', list: ativosList },
                    inativos: { label: 'Clientes Inativos', list: inativosList },
                    agendados: { label: 'Clientes Agendados', list: proximosConfirmados.map(c => c.paciente) },
                    vencidos: { label: 'Ciclos Vencidos', list: ciclosPacientes.filter(c => c.vencido && !c.proximoConfirmado).map(c => c.paciente) },
                  };
                  const current = kpiMap[expandedKpi];
                  if (!current) return null;
                  return (
                    <motion.div
                      key={expandedKpi}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <Card className="border shadow-sm">
                        <CardContent className="p-3">
                          <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                            <span>{current.label} ({current.list.length})</span>
                            <button onClick={() => setExpandedKpi(null)} className="text-muted-foreground hover:text-foreground">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                          {current.list.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic">Nenhum cliente nesta categoria</p>
                          ) : (
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {current.list.map(p => {
                                const urgency = getUrgencyLevel(p.id);
                                return (
                                  <div
                                    key={p.id}
                                    className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                                    onClick={() => navigate(`/paciente-perfil/${p.id}`)}
                                  >
                                    <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                      <span className="text-[10px] font-bold text-primary">
                                        {p.nome[0]}{p.sobrenome?.[0] || ''}
                                      </span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-semibold truncate">{p.nome} {p.sobrenome}</div>
                                      <div className={cn('text-[10px]', urgency.color)}>{urgency.label}</div>
                                    </div>
                                    {p.telefone && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 w-6 p-0"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(`https://wa.me/55${p.telefone?.replace(/\D/g, '')}`, '_blank');
                                        }}
                                      >
                                        <Phone className="h-3 w-3 text-emerald-600" />
                                      </Button>
                                    )}
                                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              {/* Tab Navigation */}
              <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
                {tabs.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-[11px] font-semibold transition-all',
                        activeTab === tab.key
                          ? 'bg-card shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {tab.label}
                      {tab.badge && (
                        <span className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded-full font-bold',
                          activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        )}>
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              {activeTab === 'resumo' && (
                <div className="space-y-3">
                  {/* Distribution Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Card className="border shadow-sm">
                      <CardContent className="p-3">
                        <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <TrendingUp className="h-3 w-3" /> Por Serviço
                        </div>
                        <div className="space-y-1.5">
                          {Object.entries(porServico).map(([key, count]) => {
                            const cfg = SERVICO_LABELS[key];
                            if (!cfg) return null;
                            const pct = totalServicos > 0 ? (count / totalServicos) * 100 : 0;
                            return (
                              <div key={key} className="flex items-center gap-2">
                                <span className={cn('text-[10px] font-semibold w-16 truncate', cfg.color)}>{cfg.label}</span>
                                <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className={cn('h-full rounded-full', cfg.bg)} style={{ width: `${pct}%`, minWidth: count > 0 ? '4px' : '0' }} />
                                </div>
                                <span className="text-[10px] font-bold text-foreground w-5 text-right">{count}</span>
                              </div>
                            );
                          })}
                          {Object.keys(porServico).length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">Nenhum serviço atribuído</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border shadow-sm">
                      <CardContent className="p-3">
                        <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Users className="h-3 w-3" /> Por Profissional
                        </div>
                        {Object.keys(porProfissional).length > 0 ? (
                          <div className="space-y-1.5">
                            {Object.values(porProfissional).map(prof => (
                              <div key={prof.nome} className="flex items-center gap-2">
                                <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: prof.cor }} />
                                <span className="text-[10px] font-semibold flex-1 truncate">{prof.nome}</span>
                                <span className="text-[10px] font-bold text-foreground">{prof.count}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-muted-foreground italic">
                            {membrosEquipe.length === 0
                              ? 'Cadastre membros da equipe nas Configurações'
                              : 'Nenhum paciente vinculado'}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Follow-up Alert List */}
                  {(precisamContato.length > 0 || semConsulta.length > 0) && (
                    <Card className="border shadow-sm">
                      <CardContent className="p-3">
                        <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <PhoneCall className="h-3 w-3" /> Próximos Follow-ups
                          <span className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold ml-auto">
                            {precisamContato.length + semConsulta.length} pendente{(precisamContato.length + semConsulta.length) > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {[...precisamContato.slice(0, 5), ...semConsulta.slice(0, 3)].map(p => {
                            const urgency = getUrgencyLevel(p.id);
                            const ultimo = ultimosAgendamentos[p.id];
                            return (
                              <PacienteRow
                                key={p.id}
                                paciente={p}
                                subtitle={ultimo
                                  ? `Última: ${formatDistanceToNow(new Date(ultimo.data), { addSuffix: true, locale: ptBR })}`
                                  : 'Nunca consultou'}
                                subtitleColor={urgency.color}
                                onNavigate={() => navigate(`/pacientes/${p.id}`)}
                              />
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {activeTab === 'agenda' && (
                <div className="space-y-3">
                  {/* Confirmed upcoming appointments */}
                  <Card className="border shadow-sm">
                    <CardContent className="p-3">
                      <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                        <CalendarCheck className="h-3 w-3 text-blue-600" /> Próximos Atendimentos Confirmados
                        <span className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold ml-auto">
                          {proximosConfirmados.length}
                        </span>
                      </div>
                      {proximosConfirmados.length > 0 ? (
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {proximosConfirmados.slice(0, 10).map(({ paciente, ag }) => (
                            <PacienteRow
                              key={`${paciente.id}-${ag.data_inicio}`}
                              paciente={paciente}
                              subtitle={`${format(new Date(ag.data_inicio), "dd/MM · HH:mm", { locale: ptBR })} – ${format(new Date(ag.data_fim), "HH:mm")}${ag.tipo_atendimento ? ` · ${ag.tipo_atendimento}` : ''}`}
                              subtitleColor="text-blue-600"
                              badge={ag.status === 'pendente' ? 'Pendente' : undefined}
                              badgeColor={ag.status === 'pendente' ? 'bg-amber-100 text-amber-700' : undefined}
                              onNavigate={() => navigate(`/pacientes/${paciente.id}`)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground italic text-center py-3">
                          Nenhum atendimento futuro confirmado
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Patients without future appointments – suggest dates */}
                  {semFuturo.length > 0 && (
                    <Card className="border shadow-sm border-amber-200 dark:border-amber-800">
                      <CardContent className="p-3">
                        <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <CalendarPlus className="h-3 w-3 text-amber-600" /> Sugestões de Agendamento
                          <span className="text-[9px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-bold ml-auto">
                            {semFuturo.length} sem agenda
                          </span>
                        </div>
                        <div className="space-y-1 max-h-56 overflow-y-auto">
                          {semFuturo.slice(0, 8).map(({ paciente, sugestao, ciclo }) => {
                            const cfg = CICLO_CONFIG[ciclo];
                            return (
                              <PacienteRow
                                key={paciente.id}
                                paciente={paciente}
                                subtitle={`Sugestão: ${sugestao} · Ciclo ${cfg.label}`}
                                subtitleColor="text-amber-600"
                                badge={cfg.icon}
                                onNavigate={() => navigate(`/pacientes/${paciente.id}`)}
                                showWhatsApp
                              />
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {activeTab === 'ciclos' && (
                <div className="space-y-3">
                  {/* Cycle summary cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(CICLO_CONFIG) as CicloTipo[]).map(tipo => {
                      const cfg = CICLO_CONFIG[tipo];
                      const count = ciclosPacientes.filter(c => c.cicloDetectado === tipo).length;
                      return (
                        <Card key={tipo} className="border-0 shadow-sm bg-muted/30">
                          <CardContent className="p-2.5 text-center">
                            <div className="text-base mb-0.5">{cfg.icon}</div>
                            <div className={cn('text-lg font-black leading-none', cfg.color)}>{count}</div>
                            <div className="text-[10px] text-muted-foreground">{cfg.label}</div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Detailed cycle list */}
                  <Card className="border shadow-sm">
                    <CardContent className="p-3">
                      <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Repeat className="h-3 w-3" /> Ciclos de Tratamento
                        {vencidos > 0 && (
                          <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full font-bold ml-auto">
                            {vencidos} vencido{vencidos > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      {ciclosPacientes.length > 0 ? (
                        <div className="space-y-1 max-h-64 overflow-y-auto">
                          {ciclosPacientes.slice(0, 12).map(c => {
                            const cfg = CICLO_CONFIG[c.cicloDetectado];
                            const hasProximo = !!c.proximoConfirmado;
                            return (
                              <div
                                key={c.paciente.id}
                                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group/item"
                                onClick={() => navigate(`/pacientes/${c.paciente.id}`)}
                              >
                                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                                  {c.paciente.nome[0]}{c.paciente.sobrenome?.[0] || ''}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-semibold truncate block">
                                    {c.paciente.nome} {c.paciente.sobrenome}
                                  </span>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={cn('text-[10px] font-medium', cfg.color)}>
                                      {cfg.icon} {cfg.label} · {c.totalSessoes} sessões
                                    </span>
                                    {c.vencido && !hasProximo && (
                                      <span className="text-[9px] bg-destructive/10 text-destructive px-1 py-0.5 rounded font-bold">
                                        VENCIDO
                                      </span>
                                    )}
                                    {hasProximo && (
                                      <span className="text-[9px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1 py-0.5 rounded font-bold">
                                        ✓ {format(new Date(c.proximoConfirmado!), "dd/MM")}
                                      </span>
                                    )}
                                    {!hasProximo && !c.vencido && (
                                      <span className="text-[9px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-1 py-0.5 rounded font-bold">
                                        Ideal: {format(c.proximoIdeal, "dd/MM")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  {c.vencido && !hasProximo && c.paciente.telefone && (
                                    <Tooltip delayDuration={0}>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6"
                                          onClick={e => {
                                            e.stopPropagation();
                                            window.open(`https://wa.me/55${c.paciente.telefone?.replace(/\D/g, '')}`, '_blank');
                                          }}
                                        >
                                          <Phone className="h-3 w-3 text-emerald-600" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>WhatsApp</TooltipContent>
                                    </Tooltip>
                                  )}
                                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground italic text-center py-3">
                          Dados insuficientes para análise de ciclos (mínimo 2 sessões por paciente)
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Reusable row component ──────────────────────────────────────────────────
function PacienteRow({
  paciente, subtitle, subtitleColor, badge, badgeColor, onNavigate, showWhatsApp,
}: {
  paciente: PacienteData;
  subtitle: string;
  subtitleColor: string;
  badge?: string;
  badgeColor?: string;
  onNavigate: () => void;
  showWhatsApp?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group/item"
      onClick={onNavigate}
    >
      <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
        {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold truncate">{paciente.nome} {paciente.sobrenome}</span>
          {badge && (
            <span className={cn('text-[9px] px-1 py-0.5 rounded font-bold', badgeColor || 'bg-muted text-muted-foreground')}>
              {badge}
            </span>
          )}
        </div>
        <span className={cn('text-[10px] font-medium', subtitleColor)}>{subtitle}</span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {(showWhatsApp ?? false) && paciente.telefone && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity"
                onClick={e => {
                  e.stopPropagation();
                  window.open(`https://wa.me/55${paciente.telefone?.replace(/\D/g, '')}`, '_blank');
                }}
              >
                <Phone className="h-3 w-3 text-emerald-600" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>WhatsApp</TooltipContent>
          </Tooltip>
        )}
        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover/item:opacity-100" />
      </div>
    </div>
  );
}
