import { useEffect, useMemo, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import {
  Kanban, MessageCircle, Phone, Search, User, Zap, TrendingUp,
  AlertTriangle, Clock, Inbox, MoreVertical, ArrowRight, CheckCircle2, XCircle, Users, Flame,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatPhoneNumber } from '@/utils/whatsapp';
import { formatDistanceToNow, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type Stage = 'novo' | 'qualificado' | 'agendado' | 'fechado' | 'perdido';
type QuickFilter = 'todos' | 'minha_vez' | 'sla' | 'parados';

const STAGES: { key: Stage; label: string; color: string; dot: string }[] = [
  { key: 'novo', label: 'Novo', color: 'bg-sky-500/10 text-sky-700 border-sky-500/30', dot: 'bg-sky-500' },
  { key: 'qualificado', label: 'Qualificado', color: 'bg-amber-500/10 text-amber-700 border-amber-500/30', dot: 'bg-amber-500' },
  { key: 'agendado', label: 'Agendado', color: 'bg-violet-500/10 text-violet-700 border-violet-500/30', dot: 'bg-violet-500' },
  { key: 'fechado', label: 'Fechado', color: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30', dot: 'bg-emerald-500' },
  { key: 'perdido', label: 'Perdido', color: 'bg-rose-500/10 text-rose-700 border-rose-500/30', dot: 'bg-rose-500' },
];

interface Lead {
  id: string;
  nome_contato: string | null;
  telefone: string;
  paciente_id: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_em: string | null;
  ultima_direcao: 'entrada' | 'saida' | null;
  intencao_atual: string | null;
  lead_score: number;
  pipeline_stage: Stage;
  pipeline_updated_at: string;
  sla_responder_ate: string | null;
  created_at?: string;
}

function slaStatus(sla: string | null, direcao: Lead['ultima_direcao']) {
  if (!sla || direcao !== 'entrada') return null;
  const diffMs = new Date(sla).getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 0) return { kind: 'vencido' as const, label: `SLA ${Math.abs(diffMin)}min atrasado` };
  if (diffMin <= 30) return { kind: 'expirando' as const, label: `SLA em ${diffMin}min` };
  return null;
}

const MOTIVOS_PERDA = [
  'Sem resposta',
  'Preço',
  'Sem interesse no momento',
  'Escolheu concorrente',
  'Localização',
  'Outro',
];

export default function CrmPipeline({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<QuickFilter>('todos');
  const [dragId, setDragId] = useState<string | null>(null);

  // Perda dialog
  const [perdaDialog, setPerdaDialog] = useState<{ leadId: string; motivo: string; obs: string } | null>(null);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['crm-pipeline', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_conversas')
        .select('id, nome_contato, telefone, paciente_id, ultima_mensagem, ultima_mensagem_em, ultima_direcao, intencao_atual, lead_score, pipeline_stage, pipeline_updated_at, sla_responder_ate, created_at')
        .eq('terapeuta_id', user!.id)
        .eq('arquivada', false)
        .order('pipeline_updated_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Lead[];
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel('crm-pipeline')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversas', filter: `terapeuta_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ['crm-pipeline'] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  // KPIs e contadores
  const kpis = useMemo(() => {
    const now = Date.now();
    let minhaVez = 0, sla = 0, parados = 0, novosHoje = 0, fechadosSemana = 0;
    const semanaAtras = now - 7 * 24 * 3600 * 1000;
    for (const l of leads) {
      if (l.ultima_direcao === 'entrada') minhaVez++;
      if (slaStatus(l.sla_responder_ate, l.ultima_direcao)) sla++;
      if (l.ultima_mensagem_em && (now - new Date(l.ultima_mensagem_em).getTime()) > 24 * 3600 * 1000
          && !['fechado', 'perdido'].includes(l.pipeline_stage)) parados++;
      if (l.created_at && isToday(new Date(l.created_at))) novosHoje++;
      if (l.pipeline_stage === 'fechado'
          && new Date(l.pipeline_updated_at).getTime() >= semanaAtras) fechadosSemana++;
    }
    return { total: leads.length, minhaVez, sla, parados, novosHoje, fechadosSemana };
  }, [leads]);

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    const now = Date.now();
    return leads.filter((l) => {
      if (q && !((l.nome_contato || '').toLowerCase().includes(q) || l.telefone.includes(q))) return false;
      if (filtro === 'minha_vez' && l.ultima_direcao !== 'entrada') return false;
      if (filtro === 'sla' && !slaStatus(l.sla_responder_ate, l.ultima_direcao)) return false;
      if (filtro === 'parados') {
        if (['fechado', 'perdido'].includes(l.pipeline_stage)) return false;
        if (!l.ultima_mensagem_em || (now - new Date(l.ultima_mensagem_em).getTime()) <= 24 * 3600 * 1000) return false;
      }
      return true;
    });
  }, [leads, busca, filtro]);

  const porEtapa = useMemo(() => {
    const map: Record<Stage, Lead[]> = { novo: [], qualificado: [], agendado: [], fechado: [], perdido: [] };
    for (const l of filtrados) map[l.pipeline_stage]?.push(l);
    return map;
  }, [filtrados]);

  const mover = async (leadId: string, novaStage: Stage, motivoPerda?: string | null) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.pipeline_stage === novaStage) return;

    qc.setQueryData<Lead[]>(['crm-pipeline', user?.id], (old) =>
      (old || []).map((l) => l.id === leadId ? { ...l, pipeline_stage: novaStage, pipeline_updated_at: new Date().toISOString() } : l),
    );

    const { error } = await supabase
      .from('whatsapp_conversas')
      .update({
        pipeline_stage: novaStage,
        pipeline_motivo_perda: motivoPerda ?? null,
        pipeline_updated_at: new Date().toISOString(),
      })
      .eq('id', leadId);
    if (error) {
      toast.error('Erro ao mover: ' + error.message);
      qc.invalidateQueries({ queryKey: ['crm-pipeline'] });
    } else {
      toast.success(`Movido para ${STAGES.find((s) => s.key === novaStage)?.label}`);
    }
  };

  const onMoveRequest = (leadId: string, novaStage: Stage) => {
    if (novaStage === 'perdido') {
      setPerdaDialog({ leadId, motivo: MOTIVOS_PERDA[0], obs: '' });
    } else {
      mover(leadId, novaStage);
    }
  };

  const confirmarPerda = () => {
    if (!perdaDialog) return;
    const motivoFinal = perdaDialog.obs.trim()
      ? `${perdaDialog.motivo} — ${perdaDialog.obs.trim()}`
      : perdaDialog.motivo;
    mover(perdaDialog.leadId, 'perdido', motivoFinal);
    setPerdaDialog(null);
  };

  // KPI card mini
  const Kpi = ({ icon: Icon, label, value, tone, onClick }: { icon: any; label: string; value: number; tone?: 'danger' | 'warning' | 'success' | 'info' | 'neutral'; onClick?: () => void }) => {
    const toneCls = tone === 'danger' ? 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900'
      : tone === 'warning' ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900'
      : tone === 'success' ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900'
      : tone === 'info' ? 'text-sky-700 bg-sky-50 border-sky-200 dark:bg-sky-950/30 dark:text-sky-400 dark:border-sky-900'
      : 'text-foreground bg-card border-border/60';
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'rounded-xl border p-3 text-left transition shadow-xs shrink-0 min-w-[120px]',
          toneCls,
          onClick && 'hover:shadow-sm hover:-translate-y-px active:translate-y-0 cursor-pointer',
        )}
      >
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide font-semibold opacity-80">
          <Icon className="icon-xs" />
          {label}
        </div>
        <div className="mt-1 text-2xl font-bold tabular-nums leading-none">{value}</div>
      </button>
    );
  };

  const FilterChip = ({ id, label, count, icon: Icon, tone }: { id: QuickFilter; label: string; count: number; icon: any; tone?: 'danger' | 'warning' | 'success' | 'neutral' }) => {
    const active = filtro === id;
    const toneCls = tone === 'danger' ? 'border-red-500/40 text-red-700 bg-red-50 dark:bg-red-950/30'
      : tone === 'warning' ? 'border-amber-500/40 text-amber-700 bg-amber-50 dark:bg-amber-950/30'
      : tone === 'success' ? 'border-emerald-500/40 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/30'
      : 'border-border bg-card';
    return (
      <button
        onClick={() => setFiltro(id)}
        className={cn(
          'inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-xs font-medium transition shrink-0',
          active ? 'bg-primary text-primary-foreground border-primary shadow-sm' : toneCls + ' hover:border-foreground/30',
        )}
      >
        <Icon className="icon-xs" />
        {label}
        <span className={cn('ml-0.5 text-[10px] tabular-nums px-1.5 py-0.5 rounded-full',
          active ? 'bg-primary-foreground/20' : 'bg-foreground/10')}>{count}</span>
      </button>
    );
  };

  const Wrapper = embedded ? (({ children }: any) => <>{children}</>) : AppLayout;
  return (
    <Wrapper>
      <div className={embedded ? '' : 'p-4 sm:p-6'}>
        {!embedded && (
          <PageHeader
            back
            icon={<Kanban className="icon-lg" />}
            title="Pipeline CRM"
            subtitle="Acompanhe leads do primeiro contato ao fechamento"
            actions={
              <div className="flex gap-2 flex-wrap">
                <Link to="/crm?tab=metricas">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <TrendingUp className="icon-xs" /> Métricas
                  </Button>
                </Link>
                <Link to="/crm?tab=cadencias">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Zap className="icon-xs" /> Cadências
                  </Button>
                </Link>
                <Link to="/crm?tab=inbox">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <MessageCircle className="icon-xs" /> WhatsApp
                  </Button>
                </Link>
              </div>
            }
          />
        )}

        {/* KPI strip */}
        <div className="mt-4 -mx-4 sm:mx-0 px-4 sm:px-0 flex gap-2 overflow-x-auto pb-1">
          <Kpi icon={Users} label="Total ativos" value={kpis.total} tone="neutral" onClick={() => setFiltro('todos')} />
          <Kpi icon={MessageCircle} label="Sua vez" value={kpis.minhaVez} tone="success" onClick={() => setFiltro('minha_vez')} />
          <Kpi icon={AlertTriangle} label="SLA crítico" value={kpis.sla} tone="danger" onClick={() => setFiltro('sla')} />
          <Kpi icon={Clock} label="Parados 24h+" value={kpis.parados} tone="warning" onClick={() => setFiltro('parados')} />
          <Kpi icon={Flame} label="Novos hoje" value={kpis.novosHoje} tone="info" />
          <Kpi icon={CheckCircle2} label="Fechados 7d" value={kpis.fechadosSemana} tone="success" />
        </div>

        {/* Busca + Filtros rápidos */}
        <div className="mt-3 mb-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="max-w-sm relative w-full sm:w-auto">
            <Search className="icon-xs absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-8 h-9" placeholder="Buscar lead..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
            <FilterChip id="todos" label="Todos" count={kpis.total} icon={Inbox} />
            <FilterChip id="minha_vez" label="Sua vez" count={kpis.minhaVez} icon={MessageCircle} tone="success" />
            <FilterChip id="sla" label="SLA" count={kpis.sla} icon={AlertTriangle} tone="danger" />
            <FilterChip id="parados" label="Parados 24h+" count={kpis.parados} icon={Clock} tone="warning" />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando…</div>
        ) : (
          // Mobile: scroll horizontal preservando colunas; sm+: grid
          <div className="-mx-4 sm:mx-0 overflow-x-auto pb-2 snap-x snap-mandatory sm:snap-none">
            <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-5 gap-3 px-4 sm:px-0 min-w-max sm:min-w-0">
              {STAGES.map((stage) => (
                <div
                  key={stage.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragId) onMoveRequest(dragId, stage.key); setDragId(null); }}
                  className={cn(
                    "rounded-xl border border-border/40 bg-card/40 flex flex-col min-h-[300px] snap-start",
                    "w-[78vw] sm:w-auto shrink-0 sm:shrink",
                    dragId && "ring-2 ring-primary/30",
                  )}
                >
                  <div className="p-3 border-b border-border/40 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", stage.dot)} />
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", stage.color)}>
                        {stage.label}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{porEtapa[stage.key].length}</span>
                  </div>
                  <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100dvh-360px)]">
                    {porEtapa[stage.key].length === 0 && (
                      <div className="text-center text-xs text-muted-foreground py-6">Vazio</div>
                    )}
                    {porEtapa[stage.key].map((l) => {
                      const minhaVez = l.ultima_direcao === 'entrada';
                      const sla = slaStatus(l.sla_responder_ate, l.ultima_direcao);
                      const outrasStages = STAGES.filter((s) => s.key !== l.pipeline_stage);
                      return (
                        <div
                          key={l.id}
                          draggable
                          onDragStart={() => setDragId(l.id)}
                          onDragEnd={() => setDragId(null)}
                          className={cn(
                            "rounded-lg border bg-background p-3 shadow-xs hover:shadow-md transition",
                            sla?.kind === 'vencido' ? 'border-red-500/50 ring-1 ring-red-500/20' :
                            sla?.kind === 'expirando' ? 'border-amber-500/50' :
                            minhaVez ? 'border-emerald-500/40' : 'border-border/40',
                          )}
                        >
                          {/* Status row */}
                          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                            {minhaVez ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 border border-emerald-500/30">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Sua vez
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                Aguardando
                              </span>
                            )}
                            {sla && (
                              <span className={cn(
                                "inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border",
                                sla.kind === 'vencido'
                                  ? 'bg-red-500/15 text-red-700 border-red-500/40 animate-pulse'
                                  : 'bg-amber-500/15 text-amber-700 border-amber-500/40',
                              )}>
                                <AlertTriangle className="icon-xs" />
                                {sla.label}
                              </span>
                            )}
                          </div>

                          <div className="flex items-start gap-2">
                            <Avatar className="h-7 w-7 shrink-0"><AvatarFallback className="text-[10px]">
                              {(l.nome_contato || l.telefone).slice(0, 2).toUpperCase()}
                            </AvatarFallback></Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">
                                {l.nome_contato || formatPhoneNumber(l.telefone)}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Phone className="icon-xs" /> {formatPhoneNumber(l.telefone)}
                              </div>
                            </div>
                            {l.lead_score > 0 && (
                              <Badge variant="outline" className="text-[10px] px-1.5 shrink-0">⭐ {l.lead_score}</Badge>
                            )}
                            {/* Menu mover (mobile-friendly) */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0">
                                  <MoreVertical className="icon-xs" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-52 z-50 bg-popover">
                                <DropdownMenuLabel className="text-[10px] uppercase tracking-wide">Mover para</DropdownMenuLabel>
                                {outrasStages.map((s) => (
                                  <DropdownMenuItem key={s.key} onClick={() => onMoveRequest(l.id, s.key)}>
                                    <span className={cn("h-2 w-2 rounded-full mr-2", s.dot)} />
                                    {s.label}
                                    <ArrowRight className="icon-xs ml-auto opacity-50" />
                                  </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem asChild>
                                  <Link to={`/crm/inbox?conversa=${l.id}`}>
                                    <MessageCircle className="icon-xs mr-2" /> Abrir conversa
                                  </Link>
                                </DropdownMenuItem>
                                {l.paciente_id && (
                                  <DropdownMenuItem asChild>
                                    <Link to={`/pacientes/${l.paciente_id}`}>
                                      <User className="icon-xs mr-2" /> Ver paciente
                                    </Link>
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {l.intencao_atual && (
                            <div className="mt-1.5 text-[10px] inline-block px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                              {l.intencao_atual}
                            </div>
                          )}
                          {l.ultima_mensagem && (
                            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                              {minhaVez && <span className="text-emerald-700 font-medium">“</span>}
                              {l.ultima_mensagem}
                              {minhaVez && <span className="text-emerald-700 font-medium">”</span>}
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">
                              {l.ultima_mensagem_em && formatDistanceToNow(new Date(l.ultima_mensagem_em), { addSuffix: true, locale: ptBR })}
                            </span>
                            <div className="flex gap-1">
                              <Link to={`/crm/inbox?conversa=${l.id}`}>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                                  <MessageCircle className="icon-xs" />
                                </Button>
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-micro text-muted-foreground mt-3">
          Arraste no desktop ou toque em <MoreVertical className="icon-xs inline -mt-0.5" /> para mudar a etapa. No celular, deslize as colunas.
        </p>
      </div>

      {/* Dialog motivo de perda */}
      <Dialog open={!!perdaDialog} onOpenChange={(o) => !o && setPerdaDialog(null)}>
        <DialogContent className="max-w-md max-h-[90dvh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="icon-md text-rose-600" />
              Marcar como perdido
            </DialogTitle>
            <DialogDescription>
              Registre o motivo para alimentar suas métricas de conversão.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Motivo principal</label>
              <div className="flex flex-wrap gap-1.5">
                {MOTIVOS_PERDA.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPerdaDialog((p) => p && { ...p, motivo: m })}
                    className={cn(
                      'text-xs px-2.5 py-1 rounded-full border transition',
                      perdaDialog?.motivo === m
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border hover:border-foreground/30',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observação (opcional)</label>
              <Textarea
                rows={3}
                placeholder="Detalhe do que aconteceu..."
                value={perdaDialog?.obs ?? ''}
                onChange={(e) => setPerdaDialog((p) => p && { ...p, obs: e.target.value })}
                style={{ fontSize: 16 }}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPerdaDialog(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarPerda}>Confirmar perda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Wrapper>
  );
}
