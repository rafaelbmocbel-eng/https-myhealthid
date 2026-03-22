import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths, subDays,
  isSameDay, isToday, parseISO, getHours, getMinutes, setHours, setMinutes,
  differenceInMinutes, eachDayOfInterval, isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Users, X, Loader2, Trash2, Save,
  Lock, Clock, CheckCircle2, AlertCircle, Calendar, MessageCircle,
  Smartphone, CreditCard, Info, DollarSign
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAgenda, Agendamento, Paciente } from '@/hooks/useAgenda';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAgendamentoNotifications } from '@/hooks/useAgendamentoNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getPatientColor } from '@/utils/agendaUtils';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import LembreteEncerramento from '@/components/agenda/LembreteEncerramento';

type ViewMode = 'dia' | 'semana' | 'mes';

// Slot duration in minutes
const SLOT_MINUTES = 60;
const SLOT_HEIGHT = 80; // px per 60min slot

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; icon: React.ReactNode; label: string }> = {
  confirmado: { bg: 'bg-emerald-50', border: 'border-emerald-400', text: 'text-emerald-800', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Confirmado' },
  pendente: { bg: 'bg-amber-50', border: 'border-amber-400', text: 'text-amber-800', icon: <AlertCircle className="h-3 w-3" />, label: 'Pendente' },
  bloqueado: { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-600', icon: <Lock className="h-3 w-3" />, label: 'Bloqueado' },
  concluido: { bg: 'bg-blue-50', border: 'border-blue-400', text: 'text-blue-800', icon: <CheckCircle2 className="h-3 w-3" />, label: 'Concluído' },
  cancelado: { bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-700', icon: <X className="h-3 w-3" />, label: 'Cancelado' },
  faltou: { bg: 'bg-orange-50', border: 'border-orange-400', text: 'text-orange-800', icon: <Clock className="h-3 w-3" />, label: 'Faltou' },
};

const TIPO_LABELS: Record<string, string> = {
  primeira_consulta: 'Primeira Consulta',
  retorno: 'Retorno',
  reavaliacao: 'Reavaliação',
  bloqueio: 'Bloqueio',
  outro: 'Outro',
};

// Generate 60-minute slots from start to end hour
function generateSlots(startHour: number, endHour: number) {
  const slots: { hour: number; minute: number; label: string }[] = [];
  let h = startHour, m = 0;
  while (h < endHour || (h === endHour && m === 0)) {
    slots.push({ hour: h, minute: m, label: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` });
    m += SLOT_MINUTES;
    if (m >= 60) { h += Math.floor(m / 60); m = m % 60; }
    if (h > endHour) break;
  }
  return slots;
}

interface ModalState { open: boolean; agendamento?: Agendamento; dataInicio?: Date; }
interface FormData {
  paciente_id: string; titulo: string;
  data_inicio: string; data_fim: string;
  status: string; tipo_atendimento: string; observacoes: string;
  recorrencia: 'none' | 'semanal' | 'quinzenal' | 'mensal';
  recorrencia_semanas: number;
}

// Mini calendar component
function MiniCalendar({
  current, selected, onChange, agendamentos,
}: {
  current: Date; selected: Date; onChange: (d: Date) => void; agendamentos: Agendamento[];
}) {
  const [nav, setNav] = useState(new Date(current));
  const start = startOfMonth(nav);
  const end = endOfMonth(nav);
  const gridStart = startOfWeek(start, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(end, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const hasAg = (d: Date) => agendamentos.some(ag => isSameDay(parseISO(ag.data_inicio), d));

  return (
    <div className="clinical-card p-4 w-full select-none">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setNav(d => subMonths(d, 1))} className="p-1 rounded hover:bg-accent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-xs font-semibold capitalize">
          {format(nav, 'MMMM yyyy', { locale: ptBR })}
        </span>
        <button onClick={() => setNav(d => addMonths(d, 1))} className="p-1 rounded hover:bg-accent">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((d, i) => (
          <div key={i} className="text-[10px] font-medium text-muted-foreground text-center py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const inMonth = isSameMonth(day, nav);
          const active = isSameDay(day, selected);
          const today = isToday(day);
          const dot = hasAg(day);
          return (
            <button
              key={i}
              onClick={() => onChange(day)}
              className={cn(
                'relative h-7 w-7 mx-auto flex flex-col items-center justify-center rounded-full text-[11px] font-medium transition-all',
                !inMonth && 'opacity-30',
                active && 'bg-primary text-primary-foreground',
                !active && today && 'ring-1 ring-primary text-primary',
                !active && !today && 'hover:bg-accent text-foreground',
              )}
            >
              {format(day, 'd')}
              {dot && !active && (
                <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t">
        <button
          onClick={() => { onChange(new Date()); setNav(new Date()); }}
          className="text-[11px] text-primary hover:underline w-full text-center"
        >
          Ir para hoje
        </button>
      </div>
    </div>
  );
}

export default function Agenda() {
  const { user, loading: authLoading } = useAuth();
  const { agendamentos, pacientes, config, loading, createAgendamento, updateAgendamento, deleteAgendamento, createPaciente, refresh } = useAgenda();
  const { pendingCount, clearCount, refetch: refetchNotifications } = useAgendamentoNotifications();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>(window.innerWidth < 768 ? 'dia' : 'semana');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [showNewPaciente, setShowNewPaciente] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPacNome, setNewPacNome] = useState('');
  const [newPacEmail, setNewPacEmail] = useState('');
  const [newPacTel, setNewPacTel] = useState('');
  const [nowMinutes, setNowMinutes] = useState(() => getHours(new Date()) * 60 + getMinutes(new Date()));
  const [paymentModal, setPaymentModal] = useState<{ open: boolean; patientId: string; agendamentoId?: string; valor: string; data: string; sessaoId?: string }>({
    open: false, patientId: '', valor: '0', data: format(new Date(), 'yyyy-MM-dd')
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(52);
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set());

  // Drag-and-drop state
  const [dragging, setDragging] = useState<{
    ag: Agendamento;
    startY: number;
    startX: number;
    origStartMin: number;
    durationMin: number;
    dayIndex: number;
    offsetY: number;
  } | null>(null);
  const [dragDelta, setDragDelta] = useState({ dy: 0, dx: 0 });

  // Drag confirmation state
  const [pendingDrag, setPendingDrag] = useState<{
    agId: string;
    newStart: string;
    newEnd: string;
    label: string;
  } | null>(null);

  // ── Auto-conclude past confirmed/pendente appointments ──
  useEffect(() => {
    if (!user || loading || agendamentos.length === 0) return;
    const now = new Date();
    const pastConfirmed = agendamentos.filter(ag =>
      (ag.status === 'confirmado' || ag.status === 'pendente') &&
      ag.paciente_id &&
      parseISO(ag.data_fim) < now
    );
    if (pastConfirmed.length === 0) return;

    let didUpdate = false;
    (async () => {
      for (const ag of pastConfirmed) {
        try {
          // Create controle_sessoes record if missing
          const { data: existing } = await supabase
            .from('controle_sessoes')
            .select('id')
            .eq('agendamento_id', ag.id)
            .maybeSingle();

          if (!existing) {
            await supabase.from('controle_sessoes').insert({
              paciente_id: ag.paciente_id!,
              agendamento_id: ag.id,
              terapeuta_id: user.id,
              data_sessao: ag.data_inicio,
              status: 'realizada',
              valor_cobrado: 0,
            });
          }

          // Update agendamento status
          await supabase.from('agendamentos').update({ status: 'concluido' }).eq('id', ag.id);
          didUpdate = true;
        } catch (err) {
          console.error('[AutoConclude] error for', ag.id, err);
        }
      }
      if (didUpdate) refresh();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, agendamentos.length]);

  // Current time indicator update
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setNowMinutes(getHours(now) * 60 + getMinutes(now));
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Find next upcoming confirmed appointment
  const proximaSessao = useMemo(() => {
    const now = new Date();
    return agendamentos
      .filter(ag => ag.status === 'confirmado' && parseISO(ag.data_inicio) > now)
      .sort((a, b) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime())[0];
  }, [agendamentos]);

  const tempoAteProxima = useMemo(() => {
    if (!proximaSessao) return null;
    const diff = differenceInMinutes(parseISO(proximaSessao.data_inicio), new Date());
    if (diff < 0) return 'Agora';
    if (diff < 60) return `${diff} min`;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}h ${m}m`;
  }, [proximaSessao, nowMinutes]);

  // Measure header height for precise overlay alignment
  useEffect(() => {
    if (headerRef.current) {
      const h = headerRef.current.getBoundingClientRect().height;
      if (h > 0) setHeaderHeight(h);
    }
  });

  // Auto-scroll to current time on day/week view
  useEffect(() => {
    if (viewMode !== 'mes' && gridRef.current) {
      const top = ((nowMinutes - startHour * 60) / SLOT_MINUTES) * SLOT_HEIGHT - 100;
      gridRef.current.scrollTop = Math.max(0, top);
    }
  }, [viewMode]);

  // Extended range 5h-22h for early/late appointments
  const startHour = 5;
  const endHour = 22;
  const slots = generateSlots(startHour, endHour);

  // Days in view
  const getDays = (): Date[] => {
    if (viewMode === 'dia') return [currentDate];
    if (viewMode === 'mes') {
      const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };
  const days = getDays();

  // Drag-and-drop handlers — using refs to avoid stale closures
  const draggingRef = useRef(dragging);
  draggingRef.current = dragging;
  const dragDeltaRef = useRef(dragDelta);
  dragDeltaRef.current = dragDelta;
  const daysRef = useRef(days);
  daysRef.current = days;

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, ag: Agendamento, dayIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const start = parseISO(ag.data_inicio);
    const end = parseISO(ag.data_fim);
    const origStartMin = getHours(start) * 60 + getMinutes(start);
    const durationMin = differenceInMinutes(end, start);
    setDragging({ ag, startY: clientY, startX: clientX, origStartMin, durationMin, dayIndex: dayIdx, offsetY: 0 });
    setDragDelta({ dy: 0, dx: 0 });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    let autoScrollId: number | null = null;
    const EDGE_ZONE = 60; // px from top/bottom edge to trigger auto-scroll
    const SCROLL_SPEED = 8; // px per frame

    const startAutoScroll = (clientY: number) => {
      if (autoScrollId) cancelAnimationFrame(autoScrollId);
      const container = gridRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const distFromTop = clientY - rect.top;
      const distFromBottom = rect.bottom - clientY;

      let scrollDir = 0;
      if (distFromTop < EDGE_ZONE) scrollDir = -1; // scroll up
      else if (distFromBottom < EDGE_ZONE) scrollDir = 1; // scroll down
      
      if (scrollDir !== 0) {
        const speed = scrollDir * SCROLL_SPEED * (1 + (EDGE_ZONE - Math.min(distFromTop, distFromBottom)) / EDGE_ZONE);
        const tick = () => {
          if (!gridRef.current || !draggingRef.current) return;
          gridRef.current.scrollTop += speed;
          // Update drag delta to account for scroll movement
          const d = draggingRef.current;
          d.startY -= speed;
          autoScrollId = requestAnimationFrame(tick);
        };
        autoScrollId = requestAnimationFrame(tick);
      }
    };

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault();
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const dy = clientY - draggingRef.current!.startY;
      const dx = clientX - draggingRef.current!.startX;
      setDragDelta({ dy, dx });
      startAutoScroll(clientY);
    };
    const handleUp = () => {
      if (autoScrollId) cancelAnimationFrame(autoScrollId);
      autoScrollId = null;
      const d = draggingRef.current;
      const delta = dragDeltaRef.current;
      if (!d) return;
      // Snap to 15-min increments
      const pxPerMin = SLOT_HEIGHT / SLOT_MINUTES;
      const minutesDelta = Math.round(delta.dy / pxPerMin / 15) * 15;
      const newStartMin = Math.max(startHour * 60, Math.min(endHour * 60 - d.durationMin, d.origStartMin + minutesDelta));

      let newDayIndex = d.dayIndex;
      if (viewMode === 'semana' && gridRef.current) {
        const colWidth = (gridRef.current.clientWidth - 48) / daysRef.current.length;
        const dayShift = Math.round(delta.dx / colWidth);
        newDayIndex = Math.max(0, Math.min(daysRef.current.length - 1, d.dayIndex + dayShift));
      }

      const origStart = parseISO(d.ag.data_inicio);
      const newDay = viewMode === 'semana' ? daysRef.current[newDayIndex] : origStart;
      const newH = Math.floor(newStartMin / 60);
      const newM = newStartMin % 60;
      const newStart = setMinutes(setHours(new Date(newDay), newH), newM);
      const newEnd = new Date(newStart.getTime() + d.durationMin * 60000);

      setDragging(null);
      setDragDelta({ dy: 0, dx: 0 });

      if (newStart.getTime() === origStart.getTime()) return;

      const overlapping = countOverlapping(newStart.toISOString(), newEnd.toISOString(), d.ag.id);
      if (overlapping >= config.vagas_por_horario) {
        toast({
          title: '⚠️ Horário lotado!',
          description: `Máximo de ${config.vagas_por_horario} pacientes neste horário. Arrastar bloqueado.`,
          variant: 'destructive'
        });
        return;
      }

      const label = `${format(newStart, "dd/MM 'às' HH:mm")} – ${format(newEnd, 'HH:mm')}`;
      setPendingDrag({
        agId: d.ag.id,
        newStart: newStart.toISOString(),
        newEnd: newEnd.toISOString(),
        label,
      });
    };
    window.addEventListener('mousemove', handleMove, { passive: false });
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      if (autoScrollId) cancelAnimationFrame(autoScrollId);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, viewMode, updateAgendamento]);

  const [form, setForm] = useState<FormData>({
    paciente_id: '', titulo: '',
    data_inicio: '', data_fim: '',
    status: 'confirmado', tipo_atendimento: 'retorno', observacoes: '',
    recorrencia: 'none', recorrencia_semanas: 4,
  });

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const navPrev = () => {
    if (viewMode === 'dia') setCurrentDate(d => subDays(d, 1));
    else if (viewMode === 'mes') setCurrentDate(d => subMonths(d, 1));
    else setCurrentDate(d => subWeeks(d, 1));
  };
  const navNext = () => {
    if (viewMode === 'dia') setCurrentDate(d => addDays(d, 1));
    else if (viewMode === 'mes') setCurrentDate(d => addMonths(d, 1));
    else setCurrentDate(d => addWeeks(d, 1));
  };

  const getAgForDay = (day: Date) => agendamentos.filter(ag => isSameDay(parseISO(ag.data_inicio), day));

  // Position an agendamento on the slot grid
  const getAgPos = (ag: Agendamento) => {
    const start = parseISO(ag.data_inicio);
    const end = parseISO(ag.data_fim);
    const startMinFromRef = (getHours(start) - startHour) * 60 + getMinutes(start);
    const durMin = differenceInMinutes(end, start);
    const top = (startMinFromRef / SLOT_MINUTES) * SLOT_HEIGHT;
    const height = Math.max((durMin / SLOT_MINUTES) * SLOT_HEIGHT, 28);
    return { top, height };
  };

  // Calculate side-by-side columns for overlapping appointments
  const getOverlapLayout = (dayAgs: Agendamento[]) => {
    const activeAgs = dayAgs.filter(ag => ag.status !== 'cancelado');
    if (activeAgs.length === 0) return {};

    const sorted = [...activeAgs].sort((a, b) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime());
    const layout: Record<string, { col: number; totalCols: number }> = {};

    // 1. Group into Clusters (Connected Components)
    const clusters: Agendamento[][] = [];
    sorted.forEach(ag => {
      const agStart = parseISO(ag.data_inicio).getTime();
      const agEnd = parseISO(ag.data_fim).getTime();

      const overlappingClusterIndices = clusters.reduce((acc, cluster, idx) => {
        if (cluster.some(c => {
          const cS = parseISO(c.data_inicio).getTime();
          const cE = parseISO(c.data_fim).getTime();
          return agStart < cE && agEnd > cS;
        })) acc.push(idx);
        return acc;
      }, [] as number[]);

      if (overlappingClusterIndices.length === 0) {
        clusters.push([ag]);
      } else {
        const firstIdx = overlappingClusterIndices[0];
        clusters[firstIdx].push(ag);
        // Merge multiple clusters if ag connects them
        for (let i = overlappingClusterIndices.length - 1; i > 0; i--) {
          const otherIdx = overlappingClusterIndices[i];
          clusters[firstIdx].push(...clusters[otherIdx]);
          clusters.splice(otherIdx, 1);
        }
      }
    });

    // 2. Assign columns within each cluster (Greedy Column Packing)
    clusters.forEach(cluster => {
      const columns: string[][] = [];
      cluster.forEach(ag => {
        const agStart = parseISO(ag.data_inicio).getTime();
        const agEnd = parseISO(ag.data_fim).getTime();

        let colIdx = -1;
        for (let i = 0; i < columns.length; i++) {
          const overlapsInCol = columns[i].some(id => {
            const other = cluster.find(c => c.id === id)!;
            return agStart < parseISO(other.data_fim).getTime() && agEnd > parseISO(other.data_inicio).getTime();
          });
          if (!overlapsInCol) { colIdx = i; break; }
        }

        if (colIdx >= 0) columns[colIdx].push(ag.id);
        else columns.push([ag.id]);
      });

      cluster.forEach(ag => {
        const colIndex = columns.findIndex(col => col.includes(ag.id));
        layout[ag.id] = { col: colIndex, totalCols: columns.length };
      });
    });

    return layout;
  };

  // Count how many active appointments overlap with a given time range
  const countOverlapping = (startISO: string, endISO: string, excludeId?: string) => {
    const s = new Date(startISO).getTime();
    const e = new Date(endISO).getTime();
    return agendamentos.filter(ag => {
      if (ag.id === excludeId) return false;
      if (ag.status === 'cancelado') return false;
      const as = parseISO(ag.data_inicio).getTime();
      const ae = parseISO(ag.data_fim).getTime();
      return s < ae && e > as;
    }).length;
  };

  const openNew = (date?: Date) => {
    const base = date || new Date();
    const end = new Date(base.getTime() + config.duracao_padrao * 60000);
    setForm({
      paciente_id: '', titulo: '',
      data_inicio: format(base, "yyyy-MM-dd'T'HH:mm"),
      data_fim: format(end, "yyyy-MM-dd'T'HH:mm"),
      status: 'confirmado', tipo_atendimento: 'retorno', observacoes: '',
      recorrencia: 'none', recorrencia_semanas: 4,
    });
    setModal({ open: true });
  };

  const openEdit = (ag: Agendamento) => {
    setForm({
      paciente_id: ag.paciente_id || '',
      titulo: ag.titulo || '',
      data_inicio: format(parseISO(ag.data_inicio), "yyyy-MM-dd'T'HH:mm"),
      data_fim: format(parseISO(ag.data_fim), "yyyy-MM-dd'T'HH:mm"),
      status: ag.status,
      tipo_atendimento: ag.tipo_atendimento || 'retorno',
      observacoes: ag.observacoes || '',
      recorrencia: 'none',
      recorrencia_semanas: 4,
    });
    setModal({ open: true, agendamento: ag });
  };

  const handleSave = async () => {
    setSubmitting(true);
    const pacienteIdFinal = form.paciente_id === 'bloqueio' ? undefined : (form.paciente_id || undefined);
    const pac = pacientes.find(p => p.id === pacienteIdFinal);
    const payload = {
      paciente_id: pacienteIdFinal,
      titulo: form.titulo || (pac ? `${pac.nome} ${pac.sobrenome}` : form.tipo_atendimento === 'bloqueio' ? 'Bloqueado' : 'Agendamento'),
      data_inicio: new Date(form.data_inicio).toISOString(),
      data_fim: new Date(form.data_fim).toISOString(),
      status: form.status as Agendamento['status'],
      tipo_atendimento: form.tipo_atendimento,
      observacoes: form.observacoes,
    };

    if (modal.agendamento) {
      // Editar existente: Validar limite checando overlaps excluindo o ID atual
      const overlapping = countOverlapping(payload.data_inicio, payload.data_fim, modal.agendamento.id);
      if (overlapping >= config.vagas_por_horario) {
        toast({ title: '⚠️ Horário lotado!', description: `Limites de ${config.vagas_por_horario} excedidos para nova hora.`, variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      await updateAgendamento(modal.agendamento.id, payload);
    } else {
      // Check capacity before creating
      const overlapping = countOverlapping(payload.data_inicio, payload.data_fim);
      if (overlapping >= config.vagas_por_horario) {
        toast({ title: '⚠️ Horário lotado!', description: `Máximo de ${config.vagas_por_horario} pacientes neste horário. Já há ${overlapping} agendados.`, variant: 'destructive' });
        setSubmitting(false);
        return;
      }
      // Create initial appointment
      await createAgendamento(payload as Omit<Agendamento, 'id'>);

      // Create recurring appointments if configured
      if (form.recorrencia !== 'none') {
        const intervalDays = form.recorrencia === 'semanal' ? 7 : form.recorrencia === 'quinzenal' ? 14 : 30;
        const totalWeeks = form.recorrencia_semanas;
        const totalSlots = Math.floor((totalWeeks * 7) / intervalDays);

        for (let i = 1; i <= totalSlots; i++) {
          const newStart = new Date(form.data_inicio);
          newStart.setDate(newStart.getDate() + (intervalDays * i));
          const newEnd = new Date(form.data_fim);
          newEnd.setDate(newEnd.getDate() + (intervalDays * i));

          await createAgendamento({
            ...payload,
            data_inicio: newStart.toISOString(),
            data_fim: newEnd.toISOString(),
          } as Omit<Agendamento, 'id'>);
        }

        toast({ title: `✅ ${totalSlots + 1} sessões agendadas!`, description: `Recorrência ${form.recorrencia} por ${totalWeeks} semanas.` });
      }
    }

    setModal({ open: false });
    setSubmitting(false);
  };

  const handleDelete = async () => {
    if (!modal.agendamento) return;
    setSubmitting(true);
    await deleteAgendamento(modal.agendamento.id);
    setModal({ open: false });
    setSubmitting(false);
  };

  const handleCreatePaciente = async () => {
    if (!newPacNome.trim()) return;
    const [nome, ...rest] = newPacNome.trim().split(' ');
    const novo = await createPaciente({ nome, sobrenome: rest.join(' '), email: newPacEmail, telefone: newPacTel });
    if (novo) { setForm(f => ({ ...f, paciente_id: novo.id })); setShowNewPaciente(false); setNewPacNome(''); setNewPacEmail(''); setNewPacTel(''); }
  };

  const headerLabel = () => {
    if (viewMode === 'dia') return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
    if (viewMode === 'mes') return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return `${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM yyyy', { locale: ptBR })}`;
  };

  const pendentes = agendamentos.filter(ag => ag.status === 'pendente');

  const handleConfirmar = async (id: string) => {
    const ag = agendamentos.find(a => a.id === id);
    await updateAgendamento(id, { status: 'confirmado' });

    // Auto-create controle_sessoes record to guarantee billing
    if (ag?.paciente_id) {
      const { data: existing } = await supabase
        .from('controle_sessoes')
        .select('id')
        .eq('agendamento_id', id)
        .maybeSingle();

      if (!existing) {
        const duracaoMin = differenceInMinutes(parseISO(ag.data_fim), parseISO(ag.data_inicio));
        await supabase.from('controle_sessoes').insert({
          paciente_id: ag.paciente_id,
          agendamento_id: id,
          terapeuta_id: user!.id,
          data_sessao: ag.data_inicio,
          tipo_atendimento: ag.tipo_atendimento || 'retorno',
          duracao_minutos: duracaoMin || 45,
          status: 'realizada',
          valor_cobrado: 0,
        });
      }
    }

    // Notify patient about confirmation
    if (ag?.paciente_id) {
      const dataFormatada = format(parseISO(ag.data_inicio), "d MMM 'às' HH:mm", { locale: ptBR });
      await supabase.from('notificacoes').insert({
        terapeuta_id: user!.id,
        tipo: 'consulta',
        titulo: '✅ Consulta confirmada!',
        descricao: `Sua sessão de ${dataFormatada} foi confirmada. Até lá!`,
        rota: '/agenda',
        metadata: { paciente_id: ag.paciente_id, agendamento_id: id, para_paciente: true },
      });

      // Automação: Adicionar conduta automática
      const { data: prot } = await supabase
        .from('protocolos')
        .select('objetivo_geral')
        .eq('paciente_id', ag.paciente_id)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (prot?.objetivo_geral) {
        await supabase.from('studio_notas').insert({
          paciente_id: ag.paciente_id,
          terapeuta_id: user?.id,
          conteudo: `Presença Confirmada - Conduta: ${prot.objetivo_geral}`,
          tipo: 'observacao',
          data_nota: new Date().toISOString()
        });
      }
    }

    refetchNotifications();
    toast({ title: '✅ Agendamento confirmado!' });
  };

  const handleRecusar = async (id: string) => {
    const ag = agendamentos.find(a => a.id === id);
    await updateAgendamento(id, { status: 'cancelado' });

    // Notify patient about rejection
    if (ag?.paciente_id) {
      const dataFormatada = format(parseISO(ag.data_inicio), "d MMM 'às' HH:mm", { locale: ptBR });
      await supabase.from('notificacoes').insert({
        terapeuta_id: user!.id,
        tipo: 'consulta',
        titulo: '❌ Horário não disponível',
        descricao: `Sua solicitação para ${dataFormatada} não pôde ser atendida. Tente outro horário.`,
        rota: '/agenda',
        metadata: { paciente_id: ag.paciente_id, agendamento_id: id, para_paciente: true },
      });
    }

    refetchNotifications();
    toast({ title: '❌ Agendamento recusado.' });
  };

  const handleSessaoStatus = async (ag: Agendamento, status: 'atendido' | 'faltou' | 'pendente') => {
    if (!user) return;
    try {
      if (status === 'pendente') {
        const { error } = await supabase.from('controle_sessoes').delete().eq('agendamento_id', ag.id);
        if (error) throw error;
        await updateAgendamento(ag.id, { status: 'confirmado' });
      } else {
        if (!ag.paciente_id) {
          toast({ title: 'Erro', description: 'Agendamento sem paciente vinculado.', variant: 'destructive' });
          return;
        }
        // Check if a session record already exists for this appointment
        const { data: existing } = await supabase
          .from('controle_sessoes')
          .select('id')
          .eq('agendamento_id', ag.id)
          .maybeSingle();

        if (existing) {
          // Update existing record
          const { error } = await supabase.from('controle_sessoes')
            .update({
              status: status === 'atendido' ? 'realizada' : 'falta',
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          // Insert new record
          const { error } = await supabase.from('controle_sessoes').insert({
            paciente_id: ag.paciente_id,
            agendamento_id: ag.id,
            terapeuta_id: user.id,
            data_sessao: ag.data_inicio,
            status: status === 'atendido' ? 'realizada' : 'falta',
            valor_cobrado: 0,
          });
          if (error) throw error;
        }
        await updateAgendamento(ag.id, { status: status === 'atendido' ? 'concluido' : 'faltou' });

        // ── Auto-generate prontuário note on session status change ──
        if (ag.paciente_id) {
          try {
            const pac = pacientes.find(p => p.id === ag.paciente_id);
            const pacNome = pac ? `${pac.nome} ${pac.sobrenome}`.trim() : 'Paciente';
            const dataFormatted = format(parseISO(ag.data_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
            const tipo = ag.tipo_atendimento || 'Retorno';
            const duracao = differenceInMinutes(parseISO(ag.data_fim), parseISO(ag.data_inicio));

            if (status === 'atendido') {
              await supabase.from('notas_prontuario').insert({
                paciente_id: ag.paciente_id,
                terapeuta_id: user.id,
                tipo: 'sessao_confirmada',
                titulo: `Sessão ${tipo} — ${dataFormatted}`,
                descricao: `✅ ATENDIMENTO CONFIRMADO\n\n📅 Data: ${dataFormatted}\n⏱️ Duração: ${duracao} minutos\n🏷️ Tipo: ${tipo}\n👤 Paciente: ${pacNome}\n${ag.observacoes ? `\n📝 Observações:\n${ag.observacoes}` : ''}`,
                dados_extras: { agendamento_id: ag.id, duracao, tipo },
                referencia_id: ag.id,
              });
            } else if (status === 'faltou') {
              await supabase.from('notas_prontuario').insert({
                paciente_id: ag.paciente_id,
                terapeuta_id: user.id,
                tipo: 'sessao_falta',
                titulo: `Falta — Sessão ${tipo} ${dataFormatted}`,
                descricao: `❌ PACIENTE NÃO COMPARECEU\n\n📅 Data prevista: ${dataFormatted}\n🏷️ Tipo: ${tipo}\n👤 Paciente: ${pacNome}\n\nRegistro automático de ausência para controle de adesão ao tratamento.`,
                dados_extras: { agendamento_id: ag.id, tipo },
                referencia_id: ag.id,
              });
            }
          } catch (noteErr) {
            console.warn('Nota de prontuário não registrada:', noteErr);
          }
        }
      }
      toast({ title: `Status atualizado: ${status === 'atendido' ? 'Atendido ✅' : status === 'faltou' ? 'Faltou ❌' : 'Pendente ⏳'}` });
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar status', description: error.message, variant: 'destructive' });
    }
  };

  const statsToday = agendamentos.filter(ag => isToday(parseISO(ag.data_inicio)));

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="flex flex-col h-screen overflow-hidden">
        {/* Top toolbar */}
        <div className="border-b bg-card px-4 py-3 flex flex-wrap items-center gap-3 justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
            <span className="font-semibold text-sm ml-1 capitalize hidden sm:block">{headerLabel()}</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex rounded-xl border overflow-hidden text-[10px] sm:text-xs shadow-sm">
              {(['dia', 'semana', 'mes'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={cn('px-2 sm:px-3 py-2 font-bold transition-all capitalize', viewMode === v ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/30 bg-card')}>
                  {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <Button size="sm" className="bg-gradient-primary text-white gap-1 h-9 px-3 rounded-xl shadow-md text-xs sm:text-sm" onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> <span className="hidden xs:inline">Agendar</span>
            </Button>
          </div>
        </div>

        {/* Painel de agendamentos pendentes */}
        {pendentes.length > 0 && (
          <div className="border-b bg-amber-50 dark:bg-amber-950/30 px-4 py-3 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-800 dark:text-amber-200">
                {pendentes.length} agendamento{pendentes.length > 1 ? 's' : ''} pendente{pendentes.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pendentes.map(ag => {
                const pac = pacientes.find(p => p.id === ag.paciente_id);
                const dataInicio = parseISO(ag.data_inicio);
                return (
                  <div key={ag.id} className="flex items-center justify-between gap-3 bg-white dark:bg-card rounded-lg border border-amber-200 dark:border-amber-800 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {pac ? `${pac.nome} ${pac.sobrenome}` : ag.titulo || 'Auto-agendamento'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(dataInicio, "EEEE, d 'de' MMM 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => handleRecusar(ag.id)}>
                        <X className="h-3 w-3 mr-1" /> Recusar
                      </Button>
                      <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleConfirmar(ag.id)}>
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lembrete de encerramento do expediente */}
        <LembreteEncerramento
          agendamentos={agendamentos}
          pacientes={pacientes}
          config={config}
          onMarcarConcluido={(id) => {
            const ag = agendamentos.find(a => a.id === id);
            if (ag) handleSessaoStatus(ag, 'atendido');
          }}
          onMarcarFaltou={(id) => {
            const ag = agendamentos.find(a => a.id === id);
            if (ag) handleSessaoStatus(ag, 'faltou');
          }}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Left: mini calendar + stats */}
          <div className="hidden lg:flex flex-col w-56 shrink-0 border-r bg-background overflow-y-auto p-3 gap-3">
            <MiniCalendar
              current={currentDate}
              selected={currentDate}
              onChange={(d) => { setCurrentDate(d); setViewMode('dia'); }}
              agendamentos={agendamentos}
            />

            {/* Proxima Sessão Widget */}
            {proximaSessao && (
              <div className="clinical-card !p-0 border-l-4 border-l-primary bg-gradient-to-br from-card to-primary/5 shadow-md animate-pulse-subtle">
                <div className="p-3">
                  <div className="flex justify-between items-center mb-2">
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-wider bg-primary/10 text-primary border-none">Próxima Sessão</Badge>
                    <span className="text-[10px] font-black text-primary">{tempoAteProxima}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white font-bold text-xs ring-2 ring-background">
                      {proximaSessao.pacientes?.nome[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate leading-tight">{proximaSessao.pacientes ? `${proximaSessao.pacientes.nome} ${proximaSessao.pacientes.sobrenome}` : proximaSessao.titulo}</div>
                      <div className="text-[10px] text-muted-foreground">{format(parseISO(proximaSessao.data_inicio), 'HH:mm')} • {proximaSessao.tipo_atendimento ? TIPO_LABELS[proximaSessao.tipo_atendimento] : 'Sessão'}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2 border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                      onClick={() => {
                        if (proximaSessao.pacientes?.telefone) {
                          const tel = proximaSessao.pacientes.telefone.replace(/\D/g, '');
                          const msg = encodeURIComponent(`Olá ${proximaSessao.pacientes.nome}, tudo bem? Estou aguardando você para nossa sessão hoje às ${format(parseISO(proximaSessao.data_inicio), 'HH:mm')}. Até já!`);
                          window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
                        }
                      }}>
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </Button>
                    <Button size="sm" className="h-7 text-[10px] gap-1 px-2 bg-primary text-white"
                      onClick={() => {
                        if (proximaSessao.paciente_id) {
                          window.location.href = `/pacientes/${proximaSessao.paciente_id}?service=metodo_identidade`;
                        }
                      }}>
                      <Users className="h-3 w-3" /> Perfil
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Today stats */}
            <div className="clinical-card p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hoje</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <div className="text-xl font-black text-primary">{statsToday.length}</div>
                  <div className="text-[10px] text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-emerald-600">{statsToday.filter(a => a.status === 'confirmado').length}</div>
                  <div className="text-[10px] text-muted-foreground">Confirmados</div>
                </div>
              </div>
            </div>

            {/* Legend */}
            <div className="clinical-card p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Legenda</div>
              <div className="space-y-1.5">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <div key={k} className="flex items-center gap-2 text-xs">
                    <div className={cn('h-3 w-3 rounded border', v.bg, v.border)} />
                    <span className="text-muted-foreground">{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: calendar grid */}
          <div className="flex-1 overflow-auto" ref={gridRef}>

            {/* ===== MONTH VIEW ===== */}
            {viewMode === 'mes' && (() => {
              const monthDays = days;
              const weekRows: Date[][] = [];
              for (let i = 0; i < monthDays.length; i += 7) weekRows.push(monthDays.slice(i, i + 7));
              return (
                <div className="min-w-[400px]">
                  {/* Day-of-week header */}
                  <div className="grid grid-cols-7 border-b sticky top-0 bg-card/95 backdrop-blur z-10">
                    {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                      <div key={d} className="text-[11px] font-semibold text-muted-foreground text-center py-2 border-r last:border-r-0">{d}</div>
                    ))}
                  </div>
                  {weekRows.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 border-b" style={{ minHeight: 110 }}>
                      {week.map((day, di) => {
                        const dayAgs = getAgForDay(day);
                        const inMonth = isSameMonth(day, currentDate);
                        const active = isToday(day);
                        return (
                          <div
                            key={di}
                            className={cn(
                              'border-r last:border-r-0 p-1.5 cursor-pointer hover:bg-accent/10 transition-colors',
                              !inMonth && 'opacity-40',
                              active && 'bg-primary/5',
                            )}
                            onClick={() => { setCurrentDate(day); setViewMode('dia'); }}
                          >
                            <div className={cn(
                              'text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full mb-1',
                              active ? 'bg-primary text-primary-foreground' : 'text-foreground',
                            )}>
                              {format(day, 'd')}
                            </div>
                            <div className="space-y-0.5">
                              {dayAgs.slice(0, 3).map(ag => {
                                const sc = STATUS_CONFIG[ag.status] || STATUS_CONFIG.confirmado;
                                const pac = ag.pacientes;
                                const label = ag.titulo
                                  || (pac ? `${pac.nome} ${pac.sobrenome}` : null)
                                  || 'Agendamento';
                                return (
                                  <div
                                    key={ag.id}
                                    onClick={e => { e.stopPropagation(); openEdit(ag); }}
                                    className={cn('text-[9px] font-semibold px-1 py-0.5 rounded truncate border-l-2', sc.bg, sc.border, sc.text)}
                                  >
                                    {format(parseISO(ag.data_inicio), 'HH:mm')} {label}
                                  </div>
                                );
                              })}
                              {dayAgs.length > 3 && (
                                <div className="text-[9px] text-muted-foreground pl-1">+{dayAgs.length - 3} mais</div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ===== DAY / WEEK VIEW ===== */}
            {viewMode !== 'mes' && (
              <div className="min-w-[400px] relative" style={{ display: 'grid', gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
                {/* Day headers */}
                <div ref={headerRef} className="border-b border-r bg-card/80 sticky top-0 z-10" />
                {days.map(day => (
                  <div
                    key={day.toISOString()}
                    onClick={() => { if (viewMode === 'semana') { setCurrentDate(day); setViewMode('dia'); } }}
                    className={cn(
                      'border-b border-r text-center py-2 sticky top-0 z-10 bg-card/95 backdrop-blur',
                      viewMode === 'semana' && 'cursor-pointer hover:bg-accent/20 transition-colors',
                      isToday(day) ? 'bg-primary/5' : ''
                    )}
                  >
                    <div className={cn('text-[10px] font-semibold uppercase text-muted-foreground', isToday(day) && 'text-primary')}>
                      {format(day, 'EEE', { locale: ptBR })}
                    </div>
                    <div className={cn(
                      'text-base font-black mx-auto mt-0.5 w-8 h-8 flex items-center justify-center rounded-full',
                      isToday(day) ? 'bg-primary text-primary-foreground' : 'text-foreground'
                    )}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}

                {/* Slot rows - grid background */}
                {slots.map((slot, si) => (
                  <React.Fragment key={`slot-${si}`}>
                    {/* Time label */}
                    <div
                      className="border-b border-r text-right pr-2 text-[10px] text-muted-foreground bg-background sticky left-0"
                      style={{ height: SLOT_HEIGHT, paddingTop: 6 }}
                    >
                      {slot.label}
                    </div>

                    {/* Day cells - background only */}
                    {days.map((day, di) => {
                      const slotStart = setMinutes(setHours(new Date(day), slot.hour), slot.minute);

                      // Current time indicator
                      const slotMinStart = slot.hour * 60 + slot.minute;
                      const slotMinEnd = slotMinStart + SLOT_MINUTES;
                      const showNowLine = isToday(day) && nowMinutes >= slotMinStart && nowMinutes < slotMinEnd;
                      const nowLineTop = ((nowMinutes - slotMinStart) / SLOT_MINUTES) * SLOT_HEIGHT;

                      return (
                        <div
                          key={`cell-${si}-${di}`}
                          className="border-b border-r relative cursor-pointer hover:bg-accent/10 transition-colors group"
                          style={{ height: SLOT_HEIGHT }}
                          onClick={() => openNew(slotStart)}
                        >
                          {showNowLine && (
                            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowLineTop }}>
                              <div className="flex items-center">
                                <div className="h-2.5 w-2.5 rounded-full bg-destructive shrink-0 -ml-1.5" />
                                <div className="flex-1 h-px bg-destructive" />
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Plus className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}

                {/* Appointments overlay - positioned absolutely per day column */}
                {/* We use a second grid layer on top for absolute positioning */}
                <div
                  className="pointer-events-none"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `48px repeat(${days.length}, 1fr)`,
                    position: 'absolute',
                    top: 0, left: 0, right: 0,
                    // offset by header height
                    marginTop: `${headerHeight}px`,
                  }}
                >
                  {/* Empty time-label column */}
                  <div />
                  {days.map((day, di) => {
                    const dayAgs = getAgForDay(day);
                    const totalHeight = slots.length * SLOT_HEIGHT;
                    const overlapLayout = getOverlapLayout(dayAgs);
                    // Group appointments by cluster for stacked rendering
                    const STACK_THRESHOLD = 4; // Switch to stacked mode when 4+ overlap
                    const activeAgs = dayAgs.filter(ag => ag.status !== 'cancelado');

                    // Identify which appointments are in "dense" clusters (4+)
                    const denseClusters: Set<string> = new Set();
                    activeAgs.forEach(ag => {
                      const layout = overlapLayout[ag.id];
                      if (layout && layout.totalCols >= STACK_THRESHOLD) {
                        denseClusters.add(ag.id);
                      }
                    });

                    // For dense clusters, group by overlapping time ranges
                    const denseGroups: Map<string, Agendamento[]> = new Map();
                    const normalAgs: Agendamento[] = [];

                    activeAgs.forEach(ag => {
                      if (denseClusters.has(ag.id)) {
                        // Find which group this belongs to (by checking overlap with existing groups)
                        let foundGroup = false;
                        for (const [key, group] of denseGroups) {
                          const agS = parseISO(ag.data_inicio).getTime();
                          const agE = parseISO(ag.data_fim).getTime();
                          if (group.some(g => {
                            const gS = parseISO(g.data_inicio).getTime();
                            const gE = parseISO(g.data_fim).getTime();
                            return agS < gE && agE > gS;
                          })) {
                            group.push(ag);
                            foundGroup = true;
                            break;
                          }
                        }
                        if (!foundGroup) {
                          denseGroups.set(ag.id, [ag]);
                        }
                      } else {
                        normalAgs.push(ag);
                      }
                    });

                    return (
                      <div key={`overlay-${di}`} className="relative pointer-events-none" style={{ height: totalHeight, overflow: 'hidden' }}>
                        {/* Normal appointments (1-3 overlap) — side-by-side columns */}
                        {normalAgs.map(ag => {
                          const pos = getAgPos(ag);
                          const patientColor = ag.paciente_id ? getPatientColor(ag.paciente_id) : null;
                          const layout = overlapLayout[ag.id] || { col: 0, totalCols: 1 };
                          const colWidth = 100 / layout.totalCols;
                          const leftPct = layout.col * colWidth;
                          const isDraggingThis = dragging?.ag.id === ag.id;
                          const sc = STATUS_CONFIG[ag.status] || STATUS_CONFIG.confirmado;

                          return (
                            <div
                              key={ag.id}
                              onClick={e => { if (!dragging) { e.stopPropagation(); openEdit(ag); } }}
                              onMouseDown={e => { e.stopPropagation(); handleDragStart(e, ag, di); }}
                              onTouchStart={e => { e.stopPropagation(); handleDragStart(e, ag, di); }}
                              className={cn(
                                'absolute rounded-lg border-l-[6px] px-2 py-1.5 overflow-hidden cursor-grab select-none pointer-events-auto shadow-sm',
                                'hover:brightness-95 hover:shadow-md transition-all z-10',
                                isDraggingThis && 'opacity-50 shadow-lg ring-2 ring-primary/40 cursor-grabbing',
                                !patientColor && (sc.bg + ' ' + sc.border + ' ' + sc.text)
                              )}
                              style={{
                                top: pos.top,
                                height: pos.height,
                                left: `${leftPct}%`,
                                width: `${colWidth - 1}%`,
                                ...(patientColor ? {
                                  backgroundColor: patientColor.backgroundColor,
                                  borderColor: patientColor.borderColor,
                                  color: patientColor.color,
                                  borderLeftColor: patientColor.borderLeftColor,
                                } : {}),
                                ...(isDraggingThis ? { transform: `translate(${dragDelta.dx}px, ${dragDelta.dy}px)`, zIndex: 50, transition: 'none' } : {}),
                              }}
                            >
                              <div className="flex items-center gap-0.5 text-[9px] font-semibold truncate pr-5">
                                {sc.icon}
                                <span className="truncate">
                                  {format(parseISO(ag.data_inicio), 'HH:mm')}{' '}
                                  {layout.totalCols > 2
                                    ? (ag.pacientes?.nome || ag.titulo || 'Ag.')
                                    : (ag.titulo
                                      || (ag.pacientes ? `${ag.pacientes.nome} ${ag.pacientes.sobrenome}` : null)
                                      || (ag.paciente_id ? (() => { const p = pacientes.find(x => x.id === ag.paciente_id); return p ? `${p.nome} ${p.sobrenome}` : null; })() : null)
                                      || 'Agendamento')
                                  }
                                </span>
                              </div>
                              {layout.totalCols > 1 && (
                                <div className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-black shadow-sm" style={{
                                  backgroundColor: patientColor?.borderLeftColor || sc.border.replace('border-', ''),
                                  color: '#fff',
                                }}>
                                  {layout.col + 1}
                                </div>
                              )}
                              {pos.height > 40 && layout.totalCols <= 3 && (
                                <div className="text-[8px] opacity-70 truncate mt-0.5">
                                  {ag.tipo_atendimento ? TIPO_LABELS[ag.tipo_atendimento] : ''}
                                </div>
                              )}
                              {pos.height > 55 && ag.status === 'confirmado' && parseISO(ag.data_fim) < new Date() && (
                                <div className="flex gap-0.5 mt-0.5">
                                  <button title="Atendido" className="text-[8px] h-5 w-5 flex items-center justify-center rounded bg-emerald-500 text-white hover:bg-emerald-600 transition-colors font-bold shadow-sm" onClick={(e) => { e.stopPropagation(); handleSessaoStatus(ag, 'atendido'); }}><CheckCircle2 className="h-3 w-3" /></button>
                                  <button title="Faltou" className="text-[8px] h-5 w-5 flex items-center justify-center rounded bg-orange-500 text-white hover:bg-orange-600 transition-colors font-bold shadow-sm" onClick={(e) => { e.stopPropagation(); handleSessaoStatus(ag, 'faltou'); }}><X className="h-3 w-3" /></button>
                                  <button title="Pagar" className="text-[8px] h-5 w-5 flex items-center justify-center rounded bg-amber-500 text-white hover:bg-amber-600 transition-colors font-bold shadow-sm" onClick={(e) => { e.stopPropagation(); setPaymentModal({ open: true, patientId: ag.paciente_id || '', agendamentoId: ag.id, valor: '0', data: format(new Date(), 'yyyy-MM-dd') }); }}><DollarSign className="h-3 w-3" /></button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Dense clusters (4+ overlap) — stacked view */}
                        {Array.from(denseGroups.values()).map((group, gi) => {
                          const sorted = [...group].sort((a, b) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime());
                          // Use earliest start and latest end for positioning
                          const earliest = sorted[0];
                          const pos = getAgPos(earliest);
                          const VISIBLE_COUNT = 2;
                          const visible = sorted.slice(0, VISIBLE_COUNT);
                          const hiddenCount = sorted.length - VISIBLE_COUNT;
                          const isExpanded = expandedSlots.has(`${di}-${gi}`);
                          const displayList = isExpanded ? sorted : visible;

                          return (
                            <div
                              key={`dense-${di}-${gi}`}
                              className="absolute pointer-events-auto"
                              style={{ top: pos.top, left: 0, right: 0, zIndex: isExpanded ? 40 : 15 }}
                            >
                              <div className={cn(
                                'rounded-lg border shadow-md overflow-hidden',
                                isExpanded ? 'bg-card ring-2 ring-primary/20 shadow-xl' : 'bg-card/95'
                              )}>
                                {/* Header badge */}
                                <div
                                  className="flex items-center justify-between px-2 py-1 bg-primary/10 border-b cursor-pointer hover:bg-primary/15 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedSlots(prev => {
                                      const next = new Set(prev);
                                      const key = `${di}-${gi}`;
                                      if (next.has(key)) next.delete(key); else next.add(key);
                                      return next;
                                    });
                                  }}
                                >
                                  <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {sorted.length} pacientes • {format(parseISO(earliest.data_inicio), 'HH:mm')}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground">
                                    {isExpanded ? '▲ fechar' : '▼ expandir'}
                                  </span>
                                </div>

                                {/* Stacked appointment rows */}
                                <div className={cn('divide-y', isExpanded && 'max-h-60 overflow-y-auto')}>
                                  {displayList.map(ag => {
                                    const patientColor = ag.paciente_id ? getPatientColor(ag.paciente_id) : null;
                                    const sc = STATUS_CONFIG[ag.status] || STATUS_CONFIG.confirmado;
                                    const nome = ag.pacientes
                                      ? `${ag.pacientes.nome} ${ag.pacientes.sobrenome}`
                                      : ag.titulo || 'Agendamento';

                                    return (
                                      <div
                                        key={ag.id}
                                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent/30 cursor-pointer transition-colors border-l-4"
                                        style={{
                                          borderLeftColor: patientColor?.borderLeftColor || undefined,
                                          ...(patientColor ? { backgroundColor: patientColor.backgroundColor + '80' } : {}),
                                        }}
                                        onClick={(e) => { e.stopPropagation(); openEdit(ag); }}
                                      >
                                        <div className={cn('flex items-center gap-0.5', sc.text)}>
                                          {sc.icon}
                                        </div>
                                        <span className="text-[10px] font-semibold truncate flex-1" style={patientColor ? { color: patientColor.color } : {}}>
                                          {format(parseISO(ag.data_inicio), 'HH:mm')} {nome}
                                        </span>
                                        <Badge variant="outline" className="text-[8px] h-4 px-1 shrink-0">
                                          {ag.tipo_atendimento ? TIPO_LABELS[ag.tipo_atendimento] || ag.tipo_atendimento : ''}
                                        </Badge>
                                      </div>
                                    );
                                  })}
                                </div>

                                {/* "+N mais" footer when collapsed */}
                                {!isExpanded && hiddenCount > 0 && (
                                  <div
                                    className="text-center py-1 bg-muted/50 text-[9px] font-bold text-primary cursor-pointer hover:bg-primary/10 transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedSlots(prev => {
                                        const next = new Set(prev);
                                        next.add(`${di}-${gi}`);
                                        return next;
                                      });
                                    }}
                                  >
                                    +{hiddenCount} mais
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Agendamento */}
      <Dialog open={modal.open} onOpenChange={open => !open && setModal({ open: false })}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {modal.agendamento ? 'Editar Agendamento' : 'Novo Agendamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">

            {/* ===== AÇÕES RÁPIDAS DE STATUS (só para edição de sessões passadas confirmadas) ===== */}
            {modal.agendamento && modal.agendamento.paciente_id && ['confirmado'].includes(modal.agendamento.status) && parseISO(modal.agendamento.data_fim) < new Date() && (
              <div className="bg-muted/40 rounded-xl p-3 border border-border space-y-2 animate-in fade-in slide-in-from-top-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Ação Rápida</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    size="sm"
                    className="h-10 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs font-bold"
                    onClick={async () => { await handleSessaoStatus(modal.agendamento!, 'atendido'); setModal({ open: false }); }}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Atendido
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 border-orange-300 text-orange-700 hover:bg-orange-50 gap-1.5 text-xs font-bold"
                    onClick={async () => { await handleSessaoStatus(modal.agendamento!, 'faltou'); setModal({ open: false }); }}
                  >
                    <X className="h-4 w-4" /> Faltou
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-10 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5 text-xs font-bold"
                    onClick={() => {
                      setPaymentModal({
                        open: true,
                        patientId: modal.agendamento!.paciente_id || '',
                        agendamentoId: modal.agendamento!.id,
                        valor: '0',
                        data: format(new Date(), 'yyyy-MM-dd')
                      });
                    }}
                  >
                    <DollarSign className="h-4 w-4" /> Pagar
                  </Button>
                </div>
              </div>
            )}

            {/* Ações rápidas para Concluído/Faltou (reverter) */}
            {modal.agendamento && ['concluido', 'faltou'].includes(modal.agendamento.status) && (
              <div className="bg-muted/40 rounded-xl p-3 border border-border animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {STATUS_CONFIG[modal.agendamento.status]?.icon}
                    <span className="text-xs font-bold">{STATUS_CONFIG[modal.agendamento.status]?.label}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    onClick={async () => { await handleSessaoStatus(modal.agendamento!, 'pendente'); setModal({ open: false }); }}
                  >
                    ↩ Reverter para Confirmado
                  </Button>
                </div>
              </div>
            )}

            {/* Clinical Snapshot (Quick insight if patient selected) */}
            {form.paciente_id && form.paciente_id !== 'bloqueio' && (() => {
              const pac = pacientes.find(p => p.id === form.paciente_id);
              return (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{pac?.nome} {pac?.sobrenome}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Paciente Ativo
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-[10px] text-primary" asChild>
                    <a href={`/pacientes/${form.paciente_id}?service=metodo_identidade`} target="_blank" rel="noreferrer">
                      Ver Prontuário →
                    </a>
                  </Button>
                </div>
              );
            })()}

            {/* Paciente */}
            <div>
              <Label>Paciente</Label>
              <div className="flex gap-2 mt-1.5">
                <PacienteSelect
                  pacientes={pacientes}
                  value={form.paciente_id}
                  onValueChange={v => {
                    setForm(f => ({ ...f, paciente_id: v }));
                  }}
                  allowBlock
                />
                <Button type="button" variant="outline" size="icon" onClick={() => setShowNewPaciente(!showNewPaciente)}>
                  <Users className="h-4 w-4" />
                </Button>
              </div>
              {showNewPaciente && (
                <div className="mt-2 p-3 border rounded-lg space-y-2 bg-accent/20">
                  <p className="text-xs font-semibold text-muted-foreground">Cadastrar novo paciente</p>
                  <Input placeholder="Nome completo *" value={newPacNome} onChange={e => setNewPacNome(e.target.value)} />
                  <Input placeholder="E-mail" value={newPacEmail} onChange={e => setNewPacEmail(e.target.value)} />
                  <Input placeholder="Telefone" value={newPacTel} onChange={e => setNewPacTel(e.target.value)} />
                  <Button size="sm" className="w-full" onClick={handleCreatePaciente}>Cadastrar</Button>
                </div>
              )}
            </div>

            {/* Tipo */}
            <div>
              <Label>Tipo de atendimento</Label>
              <Select value={form.tipo_atendimento} onValueChange={v => setForm(f => ({ ...f, tipo_atendimento: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Horário + Duração rápida */}
            <div className="space-y-3">
              <div>
                <Label>Início</Label>
                <Input type="datetime-local" className="mt-1.5" value={form.data_inicio} onChange={e => {
                  const start = new Date(e.target.value);
                  const end = new Date(start.getTime() + config.duracao_padrao * 60000);
                  setForm(f => ({ ...f, data_inicio: e.target.value, data_fim: format(end, "yyyy-MM-dd'T'HH:mm") }));
                }} />
              </div>
              <div>
                <Label className="mb-1.5 block">Duração</Label>
                <div className="flex gap-1.5 flex-wrap">
                  {[30, 45, 50, 60, 90].map(mins => {
                    const currentDuration = form.data_inicio && form.data_fim
                      ? differenceInMinutes(new Date(form.data_fim), new Date(form.data_inicio))
                      : config.duracao_padrao;
                    const isActive = currentDuration === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          if (!form.data_inicio) return;
                          const start = new Date(form.data_inicio);
                          const end = new Date(start.getTime() + mins * 60000);
                          setForm(f => ({ ...f, data_fim: format(end, "yyyy-MM-dd'T'HH:mm") }));
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-bold border transition-all',
                          isActive
                            ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                            : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground',
                        )}
                      >
                        {mins}min
                      </button>
                    );
                  })}
                </div>
                <div className="mt-2">
                  <Label className="text-[10px] text-muted-foreground">Término</Label>
                  <Input type="datetime-local" className="mt-1 h-8 text-xs" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <div className="flex gap-1.5 flex-wrap mt-1.5">
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: k }))}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                      form.status === k
                        ? cn(v.bg, v.border, v.text, 'ring-1 ring-offset-1', `ring-current`)
                        : 'bg-card border-border text-muted-foreground hover:bg-accent/30',
                    )}
                  >
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Recorrência (só para novos) */}
            {!modal.agendamento && (
              <div className="space-y-3 p-3 bg-muted/30 rounded-lg border">
                <div>
                  <Label className="text-xs font-bold">Recorrência</Label>
                  <Select value={form.recorrencia} onValueChange={v => setForm(f => ({ ...f, recorrencia: v as any }))}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sessão única</SelectItem>
                      <SelectItem value="semanal">Semanal (mesmo dia/horário)</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.recorrencia !== 'none' && (
                  <div>
                    <Label className="text-xs font-bold">Por quantas semanas?</Label>
                    <Input type="number" min={2} max={52} className="mt-1.5" value={form.recorrencia_semanas} onChange={e => setForm(f => ({ ...f, recorrencia_semanas: parseInt(e.target.value) || 4 }))} />
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Serão criadas {Math.floor((form.recorrencia_semanas * 7) / (form.recorrencia === 'semanal' ? 7 : form.recorrencia === 'quinzenal' ? 14 : 30)) + 1} sessões no total
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Observações */}
            <div>
              <Label>Observações</Label>
              <Textarea className="mt-1.5" placeholder="Notas sobre o atendimento..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button className="flex-1 bg-gradient-primary text-white gap-2" onClick={handleSave} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {modal.agendamento ? 'Salvar' : 'Agendar'}
              </Button>
              {modal.agendamento && (
                <Button variant="destructive" size="icon" onClick={handleDelete} disabled={submitting}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => setModal({ open: false })}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >
      {/* Modal de Pagamento Direto na Agenda */}
      <Dialog open={paymentModal.open} onOpenChange={(o) => setPaymentModal(prev => ({ ...prev, open: o }))}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" />
              Baixar Pagamento
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Valor do Pagamento</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                <Input
                  type="number"
                  className="pl-9"
                  value={paymentModal.valor}
                  onChange={e => setPaymentModal(prev => ({ ...prev, valor: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Data do Recebimento</Label>
              <Input
                type="date"
                value={paymentModal.data}
                onChange={e => setPaymentModal(prev => ({ ...prev, data: e.target.value }))}
              />
            </div>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11"
              onClick={async () => {
                try {
                  // Check if session already exists for this appointment
                  let sessaoId = paymentModal.sessaoId;
                  if (!sessaoId && paymentModal.agendamentoId) {
                    const { data: existing } = await supabase
                      .from('controle_sessoes')
                      .select('id')
                      .eq('agendamento_id', paymentModal.agendamentoId)
                      .maybeSingle();
                    sessaoId = existing?.id;
                  }

                  if (sessaoId) {
                    const { error } = await supabase.from('controle_sessoes')
                      .update({
                        status: 'realizada',
                        valor_cobrado: Number(paymentModal.valor),
                        data_sessao: new Date(paymentModal.data).toISOString(),
                      })
                      .eq('id', sessaoId);
                    if (error) throw error;
                  } else {
                    const { error } = await supabase.from('controle_sessoes').insert({
                      paciente_id: paymentModal.patientId,
                      agendamento_id: paymentModal.agendamentoId,
                      terapeuta_id: user?.id,
                      data_sessao: new Date(paymentModal.data).toISOString(),
                      status: 'realizada',
                      valor_cobrado: Number(paymentModal.valor),
                    });
                    if (error) throw error;
                  }

                  if (paymentModal.agendamentoId) {
                    await updateAgendamento(paymentModal.agendamentoId, { status: 'concluido' });
                  }

                  toast({ title: 'Pagamento registrado! 💵', description: `R$ ${paymentModal.valor} recebido com sucesso.` });
                  setPaymentModal(prev => ({ ...prev, open: false }));
                } catch (err: any) {
                  toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
                }
              }}
            >
              Confirmar Recebimento
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Drag confirmation dialog */}
      <AlertDialog open={!!pendingDrag} onOpenChange={(open) => { if (!open) setPendingDrag(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar alteração de horário?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja mover este agendamento para <strong>{pendingDrag?.label}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!pendingDrag) return;
              await updateAgendamento(pendingDrag.agId, {
                data_inicio: pendingDrag.newStart,
                data_fim: pendingDrag.newEnd,
              });
              setPendingDrag(null);
              toast({ title: '✅ Horário atualizado!' });
            }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
