import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Users, UserCheck, AlertTriangle, Phone, Clock,
  TrendingUp, ChevronRight, CalendarDays, Activity,
  UserX, PhoneCall, Eye, EyeOff
} from 'lucide-react';
import { differenceInDays, format, formatDistanceToNow } from 'date-fns';
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

interface Props {
  pacientes: PacienteData[];
  ultimosAgendamentos: Record<string, { data: string; status: string }>;
  membrosEquipe: MembroEquipe[];
  agendamentosPorMembro?: Record<string, string[]>; // membro_id -> paciente_ids
}

const SERVICO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  metodo_identidade: { label: 'Identidade', color: 'text-primary', bg: 'bg-primary/10' },
  cob_zero: { label: 'COB° ZERO', color: 'text-blue-700', bg: 'bg-blue-100' },
  studio_personal_id: { label: 'Studio', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  agenda_premium: { label: 'Agenda', color: 'text-amber-700', bg: 'bg-amber-100' },
};

export default function PainelAcompanhamento({ pacientes, ultimosAgendamentos, membrosEquipe, agendamentosPorMembro = {} }: Props) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);

  // ── KPIs ──────────────────────────────────────────────────────────
  const { ativos, inativos, precisamContato, semConsulta, porServico, porProfissional, alertas } = useMemo(() => {
    const now = new Date();
    let ativosCount = 0;
    let inativosCount = 0;
    const precisam: PacienteData[] = [];
    const sem: PacienteData[] = [];
    const servCount: Record<string, number> = {};
    const profCount: Record<string, { nome: string; cor: string; count: number }> = {};

    // Build paciente->membro mapping
    const pacienteMembro: Record<string, string> = {};
    Object.entries(agendamentosPorMembro).forEach(([membroId, pIds]) => {
      pIds.forEach(pid => { pacienteMembro[pid] = membroId; });
    });

    pacientes.forEach(p => {
      const ultimo = ultimosAgendamentos[p.id];
      
      if (!ultimo) {
        sem.push(p);
        inativosCount++;
      } else {
        const dias = differenceInDays(now, new Date(ultimo.data));
        if (dias <= 30) {
          ativosCount++;
        } else {
          inativosCount++;
        }
        // Pacientes que precisam de follow-up (15-45 dias sem consulta)
        if (dias >= 15 && dias <= 90) {
          precisam.push(p);
        }
      }

      // Services count
      (p._servicos || []).forEach(s => {
        servCount[s] = (servCount[s] || 0) + 1;
      });

      // Professional count
      const membroId = pacienteMembro[p.id];
      if (membroId) {
        const membro = membrosEquipe.find(m => m.id === membroId);
        if (membro) {
          if (!profCount[membroId]) profCount[membroId] = { nome: membro.nome, cor: membro.cor, count: 0 };
          profCount[membroId].count++;
        }
      }
    });

    // Sort by urgency (more days without appointment = more urgent)
    precisam.sort((a, b) => {
      const dA = ultimosAgendamentos[a.id] ? differenceInDays(now, new Date(ultimosAgendamentos[a.id].data)) : 999;
      const dB = ultimosAgendamentos[b.id] ? differenceInDays(now, new Date(ultimosAgendamentos[b.id].data)) : 999;
      return dB - dA;
    });

    return {
      ativos: ativosCount,
      inativos: inativosCount,
      precisamContato: precisam,
      semConsulta: sem,
      porServico: servCount,
      porProfissional: profCount,
      alertas: precisam.length + sem.length,
    };
  }, [pacientes, ultimosAgendamentos, membrosEquipe, agendamentosPorMembro]);

  const getUrgencyLevel = (pid: string): { color: string; label: string; priority: number } => {
    const ultimo = ultimosAgendamentos[pid];
    if (!ultimo) return { color: 'text-muted-foreground', label: 'Sem consultas', priority: 0 };
    const dias = differenceInDays(new Date(), new Date(ultimo.data));
    if (dias >= 60) return { color: 'text-destructive', label: `${dias}d sem contato`, priority: 3 };
    if (dias >= 30) return { color: 'text-orange-600', label: `${dias}d sem contato`, priority: 2 };
    if (dias >= 15) return { color: 'text-amber-600', label: `${dias}d sem contato`, priority: 1 };
    return { color: 'text-emerald-600', label: 'Ativo', priority: 0 };
  };

  const totalServicos = Object.values(porServico).reduce((a, b) => a + b, 0);

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
                  { icon: UserCheck, label: 'Ativos', value: ativos, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
                  { icon: UserX, label: 'Inativos', value: inativos, color: 'text-muted-foreground', bg: 'bg-muted/50' },
                  { icon: PhoneCall, label: 'Follow-up', value: precisamContato.length, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
                  { icon: AlertTriangle, label: 'Sem consulta', value: semConsulta.length, color: 'text-destructive', bg: 'bg-destructive/5' },
                ].map(kpi => {
                  const Icon = kpi.icon;
                  return (
                    <Card key={kpi.label} className={cn('border-0 shadow-sm', kpi.bg)}>
                      <CardContent className="p-3 flex items-center gap-2.5">
                        <Icon className={cn('h-4 w-4 shrink-0', kpi.color)} />
                        <div>
                          <div className={cn('text-lg font-black leading-none', kpi.color)}>{kpi.value}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{kpi.label}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Distribution Row: Services + Professionals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* By Service */}
                <Card className="border shadow-sm">
                  <CardContent className="p-3">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" /> Por Serviço
                    </div>
                    {Object.keys(SERVICO_LABELS).length > 0 ? (
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
                    ) : null}
                  </CardContent>
                </Card>

                {/* By Professional */}
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
                      <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground italic">
                          {membrosEquipe.length === 0
                            ? 'Cadastre membros da equipe nas Configurações'
                            : 'Nenhum paciente vinculado a membros'}
                        </p>
                      </div>
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
                          <div
                            key={p.id}
                            className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/60 transition-colors cursor-pointer group/item"
                            onClick={() => navigate(`/pacientes/${p.id}`)}
                          >
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                              {p.nome[0]}{p.sobrenome?.[0] || ''}
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-semibold truncate block">{p.nome} {p.sobrenome}</span>
                              <span className={cn('text-[10px] font-medium', urgency.color)}>
                                {ultimo
                                  ? `Última: ${formatDistanceToNow(new Date(ultimo.data), { addSuffix: true, locale: ptBR })}`
                                  : 'Nunca consultou'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {p.telefone && (
                                <Tooltip delayDuration={0}>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover/item:opacity-100 transition-opacity"
                                      onClick={e => {
                                        e.stopPropagation();
                                        window.open(`https://wa.me/55${p.telefone?.replace(/\D/g, '')}`, '_blank');
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
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
