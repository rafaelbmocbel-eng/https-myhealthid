import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths, subDays,
  isSameDay, isToday, parseISO, getHours, getMinutes, setHours, setMinutes,
  differenceInMinutes, eachDayOfInterval, isSameMonth,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ChevronLeft, ChevronRight, Plus, Users, X, Loader2, Trash2, Save,
  Lock, Clock, CheckCircle2, AlertCircle, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAgenda, Agendamento, Paciente } from '@/hooks/useAgenda';
import { Navigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAgendamentoNotifications } from '@/hooks/useAgendamentoNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type ViewMode = 'dia' | 'semana' | 'mes';

// Slot duration in minutes
const SLOT_MINUTES = 45;
const SLOT_HEIGHT = 68; // px per 45min slot

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

// Generate 45-minute slots from start to end hour
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
  const { agendamentos, pacientes, config, loading, createAgendamento, updateAgendamento, deleteAgendamento, createPaciente } = useAgenda();
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
  const gridRef = useRef<HTMLDivElement>(null);

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

  // Current time indicator update
  useEffect(() => {
    const tick = () => setNowMinutes(getHours(new Date()) * 60 + getMinutes(new Date()));
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  // Auto-scroll to current time on day/week view
  useEffect(() => {
    if (viewMode !== 'mes' && gridRef.current) {
      const top = ((nowMinutes - startHour * 60) / SLOT_MINUTES) * SLOT_HEIGHT - 100;
      gridRef.current.scrollTop = Math.max(0, top);
    }
  }, [viewMode]);

  // Force 6h-20h range as specified
  const startHour = 6;
  const endHour = 20;
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

  // Drag-and-drop handlers
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
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      setDragDelta({ dy: clientY - dragging.startY, dx: clientX - dragging.startX });
    };
    const handleUp = async () => {
      if (!dragging) return;
      const minutesDelta = Math.round((dragDelta.dy / SLOT_HEIGHT) * SLOT_MINUTES / 15) * 15;
      const newStartMin = Math.max(startHour * 60, Math.min(endHour * 60 - dragging.durationMin, dragging.origStartMin + minutesDelta));

      let newDayIndex = dragging.dayIndex;
      if (viewMode === 'semana' && gridRef.current) {
        const colWidth = (gridRef.current.clientWidth - 48) / days.length;
        const dayShift = Math.round(dragDelta.dx / colWidth);
        newDayIndex = Math.max(0, Math.min(days.length - 1, dragging.dayIndex + dayShift));
      }

      const origStart = parseISO(dragging.ag.data_inicio);
      const newDay = viewMode === 'semana' ? days[newDayIndex] : origStart;
      const newH = Math.floor(newStartMin / 60);
      const newM = newStartMin % 60;
      const newStart = setMinutes(setHours(new Date(newDay), newH), newM);
      const newEnd = new Date(newStart.getTime() + dragging.durationMin * 60000);

      if (newStart.getTime() !== origStart.getTime()) {
        await updateAgendamento(dragging.ag.id, {
          data_inicio: newStart.toISOString(),
          data_fim: newEnd.toISOString(),
        });
      }
      setDragging(null);
      setDragDelta({ dy: 0, dx: 0 });
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [dragging, dragDelta, days, viewMode, updateAgendamento]);

  const [form, setForm] = useState<FormData>({
    paciente_id: '', titulo: '',
    data_inicio: '', data_fim: '',
    status: 'confirmado', tipo_atendimento: 'retorno', observacoes: '',
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

  const openNew = (date?: Date) => {
    const base = date || new Date();
    const end = new Date(base.getTime() + config.duracao_padrao * 60000);
    setForm({
      paciente_id: '', titulo: '',
      data_inicio: format(base, "yyyy-MM-dd'T'HH:mm"),
      data_fim: format(end, "yyyy-MM-dd'T'HH:mm"),
      status: 'confirmado', tipo_atendimento: 'retorno', observacoes: '',
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
    });
    setModal({ open: true, agendamento: ag });
  };

  const handleSave = async () => {
    setSubmitting(true);
    const pac = pacientes.find(p => p.id === form.paciente_id);
    const payload = {
      paciente_id: form.paciente_id || undefined,
      titulo: form.titulo || (pac ? `${pac.nome} ${pac.sobrenome}` : form.tipo_atendimento === 'bloqueio' ? 'Bloqueado' : 'Agendamento'),
      data_inicio: new Date(form.data_inicio).toISOString(),
      data_fim: new Date(form.data_fim).toISOString(),
      status: form.status as Agendamento['status'],
      tipo_atendimento: form.tipo_atendimento,
      observacoes: form.observacoes,
    };
    if (modal.agendamento) await updateAgendamento(modal.agendamento.id, payload);
    else await createAgendamento(payload as Omit<Agendamento, 'id'>);
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
    await updateAgendamento(id, { status: 'confirmado' });
    refetchNotifications();
    toast({ title: '✅ Agendamento confirmado!' });
  };

  const handleRecusar = async (id: string) => {
    await updateAgendamento(id, { status: 'cancelado' });
    refetchNotifications();
    toast({ title: '❌ Agendamento recusado.' });
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
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden text-xs">
              {(['dia', 'semana', 'mes'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={cn('px-3 py-1.5 font-medium transition-all capitalize', viewMode === v ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/30')}>
                  {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <Button size="sm" className="bg-gradient-primary text-white gap-1 h-8" onClick={() => openNew()}>
              <Plus className="h-3.5 w-3.5" /> Agendar
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


        <div className="flex flex-1 overflow-hidden">
          {/* Left: mini calendar + stats */}
          <div className="hidden lg:flex flex-col w-56 shrink-0 border-r bg-background overflow-y-auto p-3 gap-3">
            <MiniCalendar
              current={currentDate}
              selected={currentDate}
              onChange={(d) => { setCurrentDate(d); setViewMode('dia'); }}
              agendamentos={agendamentos}
            />

            {/* Today stats */}
            <div className="clinical-card p-3 space-y-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hoje</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="text-center">
                  <div className="text-xl font-black text-primary">{statsToday.length}</div>
                  <div className="text-[10px] text-muted-foreground">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-black text-success">{statsToday.filter(a => a.status === 'confirmado').length}</div>
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
                                return (
                                  <div
                                    key={ag.id}
                                    onClick={e => { e.stopPropagation(); openEdit(ag); }}
                                    className={cn('text-[9px] font-semibold px-1 py-0.5 rounded truncate border-l-2', sc.bg, sc.border, sc.text)}
                                  >
                                    {format(parseISO(ag.data_inicio), 'HH:mm')} {ag.titulo || pac?.nome || ''}
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
                <div className="border-b border-r bg-card/80 sticky top-0 z-10" />
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
                    marginTop: days.length > 0 ? '52px' : '0',
                  }}
                >
                  {/* Empty time-label column */}
                  <div />
                  {days.map((day, di) => {
                    const dayAgs = getAgForDay(day);
                    const totalHeight = slots.length * SLOT_HEIGHT;
                    return (
                      <div key={`overlay-${di}`} className="relative pointer-events-auto" style={{ height: totalHeight }}>
                        {dayAgs.map(ag => {
                          const pos = getAgPos(ag);
                          const sc = STATUS_CONFIG[ag.status] || STATUS_CONFIG.confirmado;
                          const pac = ag.pacientes;
                          const isDraggingThis = dragging?.ag.id === ag.id;
                          return (
                            <div
                              key={ag.id}
                              onClick={e => { if (!dragging) { e.stopPropagation(); openEdit(ag); } }}
                              onMouseDown={e => { e.stopPropagation(); handleDragStart(e, ag, di); }}
                              onTouchStart={e => { e.stopPropagation(); handleDragStart(e, ag, di); }}
                              className={cn(
                                'absolute left-0.5 right-0.5 rounded-md border-l-4 px-1.5 py-1 overflow-hidden cursor-grab select-none',
                                'hover:brightness-95 transition-shadow z-10',
                                isDraggingThis && 'opacity-50 shadow-lg ring-2 ring-primary/40 cursor-grabbing',
                                sc.bg, sc.border, sc.text
                              )}
                              style={{
                                top: pos.top,
                                height: pos.height - 4,
                                ...(isDraggingThis ? { transform: `translate(${dragDelta.dx}px, ${dragDelta.dy}px)`, zIndex: 50, transition: 'none' } : {}),
                              }}
                            >
                              <div className="flex items-center gap-1 text-[10px] font-semibold truncate">
                                {sc.icon}
                                <span className="truncate">
                                  {format(parseISO(ag.data_inicio), 'HH:mm')} {ag.titulo || pac?.nome || ''}
                                </span>
                              </div>
                              {pos.height > 40 && (
                                <div className="text-[9px] opacity-70 truncate mt-0.5">
                                  {ag.tipo_atendimento ? TIPO_LABELS[ag.tipo_atendimento] : ''}
                                </div>
                              )}
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
            {/* Paciente */}
            <div>
              <Label>Paciente</Label>
              <div className="flex gap-2 mt-1.5">
                <Select value={form.paciente_id} onValueChange={v => setForm(f => ({ ...f, paciente_id: v }))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecionar paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bloqueio">— Bloqueio de horário —</SelectItem>
                    {pacientes.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.nome} {p.sobrenome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="datetime-local" className="mt-1.5" value={form.data_inicio} onChange={e => {
                  const start = new Date(e.target.value);
                  const end = new Date(start.getTime() + config.duracao_padrao * 60000);
                  setForm(f => ({ ...f, data_inicio: e.target.value, data_fim: format(end, "yyyy-MM-dd'T'HH:mm") }));
                }} />
              </div>
              <div>
                <Label>Término</Label>
                <Input type="datetime-local" className="mt-1.5" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <div className={cn('h-2 w-2 rounded-full border', v.bg, v.border)} />
                        {v.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
      </Dialog>
    </AppLayout>
  );
}
