import { useState } from 'react';
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

type ViewMode = 'dia' | 'semana';

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

  const [viewMode, setViewMode] = useState<ViewMode>('semana');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [showNewPaciente, setShowNewPaciente] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPacNome, setNewPacNome] = useState('');
  const [newPacEmail, setNewPacEmail] = useState('');
  const [newPacTel, setNewPacTel] = useState('');

  const [form, setForm] = useState<FormData>({
    paciente_id: '', titulo: '',
    data_inicio: '', data_fim: '',
    status: 'confirmado', tipo_atendimento: 'retorno', observacoes: '',
  });

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const startHour = parseInt(config.horario_inicio.split(':')[0]);
  const endHour = parseInt(config.horario_fim.split(':')[0]);
  const slots = generateSlots(startHour, endHour);

  // Days in view
  const getDays = (): Date[] => {
    if (viewMode === 'dia') return [currentDate];
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };
  const days = getDays();

  const navPrev = () => viewMode === 'dia' ? setCurrentDate(d => subDays(d, 1)) : setCurrentDate(d => subWeeks(d, 1));
  const navNext = () => viewMode === 'dia' ? setCurrentDate(d => addDays(d, 1)) : setCurrentDate(d => addWeeks(d, 1));

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
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return `${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM yyyy', { locale: ptBR })}`;
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
              {(['dia', 'semana'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={cn('px-3 py-1.5 font-medium transition-all capitalize', viewMode === v ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/30')}>
                  {v === 'dia' ? 'Dia' : 'Semana'}
                </button>
              ))}
            </div>
            <Button size="sm" className="bg-gradient-primary text-white gap-1 h-8" onClick={() => openNew()}>
              <Plus className="h-3.5 w-3.5" /> Agendar
            </Button>
          </div>
        </div>

        {/* Main layout: mini-cal + grid */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: mini calendar + stats */}
          <div className="hidden lg:flex flex-col w-64 shrink-0 border-r bg-background overflow-y-auto p-3 gap-3">
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
          <div className="flex-1 overflow-auto">
            <div className={cn('min-w-[400px]')} style={{ display: 'grid', gridTemplateColumns: `48px repeat(${days.length}, 1fr)` }}>
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

              {/* Slot rows */}
              {slots.map((slot, si) => (
                <>
                  {/* Time label */}
                  <div
                    key={`label-${si}`}
                    className="border-b border-r text-right pr-2 text-[10px] text-muted-foreground bg-background sticky left-0"
                    style={{ height: SLOT_HEIGHT, paddingTop: 6 }}
                  >
                    {slot.label}
                  </div>

                  {/* Day cells */}
                  {days.map((day, di) => {
                    // Find agendamentos that start in this slot
                    const slotStart = setMinutes(setHours(new Date(day), slot.hour), slot.minute);
                    const slotEnd = new Date(slotStart.getTime() + SLOT_MINUTES * 60000);

                    const dayAgs = getAgForDay(day).filter(ag => {
                      const s = parseISO(ag.data_inicio);
                      return getHours(s) === slot.hour && getMinutes(s) === slot.minute;
                    });

                    return (
                      <div
                        key={`cell-${si}-${di}`}
                        className="border-b border-r relative cursor-pointer hover:bg-accent/10 transition-colors group"
                        style={{ height: SLOT_HEIGHT }}
                        onClick={() => openNew(slotStart)}
                      >
                        {/* Click hint */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-3 w-3 text-muted-foreground/50" />
                        </div>

                        {/* Agendamentos starting in this slot */}
                        {dayAgs.map(ag => {
                          const sc = STATUS_CONFIG[ag.status] || STATUS_CONFIG.confirmado;
                          const dur = differenceInMinutes(parseISO(ag.data_fim), parseISO(ag.data_inicio));
                          const h = Math.max((dur / SLOT_MINUTES) * SLOT_HEIGHT - 4, 24);
                          const pac = ag.pacientes;
                          return (
                            <div
                              key={ag.id}
                              onClick={e => { e.stopPropagation(); openEdit(ag); }}
                              className={cn(
                                'absolute left-0.5 right-0.5 top-0.5 rounded-md border-l-4 px-1.5 py-1 overflow-hidden cursor-pointer',
                                'hover:brightness-95 transition-all z-10',
                                sc.bg, sc.border, sc.text
                              )}
                              style={{ height: h }}
                            >
                              <div className="flex items-center gap-1 text-[10px] font-semibold truncate">
                                {sc.icon}
                                <span className="truncate">
                                  {format(parseISO(ag.data_inicio), 'HH:mm')} {ag.titulo || pac?.nome || ''}
                                </span>
                              </div>
                              {h > 36 && (
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
                </>
              ))}
            </div>
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
