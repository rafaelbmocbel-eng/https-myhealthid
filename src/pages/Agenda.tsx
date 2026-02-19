import { useState } from 'react';
import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  addDays, addWeeks, addMonths, subWeeks, subMonths, subDays,
  isSameDay, isToday, parseISO, getHours, getMinutes, setHours, setMinutes,
  startOfDay, endOfDay, differenceInMinutes, eachDayOfInterval,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar, List, Clock, Settings, Users, X, Loader2, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import Navigation from '@/components/Navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAgenda, Agendamento, Paciente } from '@/hooks/useAgenda';
import { Navigate } from 'react-router-dom';

type ViewMode = 'dia' | 'semana' | 'mes';

const STATUS_COLORS: Record<string, string> = {
  confirmado: 'bg-emerald-500',
  pendente: 'bg-amber-400',
  bloqueado: 'bg-slate-400',
  concluido: 'bg-blue-500',
  cancelado: 'bg-red-400',
  faltou: 'bg-orange-400',
};

const STATUS_LABELS: Record<string, string> = {
  confirmado: 'Confirmado',
  pendente: 'Pendente',
  bloqueado: 'Bloqueado',
  concluido: 'Concluído',
  cancelado: 'Cancelado',
  faltou: 'Faltou',
};

const TIPO_LABELS: Record<string, string> = {
  primeira_consulta: 'Primeira Consulta',
  retorno: 'Retorno',
  reavaliacao: 'Reavaliação',
  bloqueio: 'Bloqueio',
  outro: 'Outro',
};

function generateHours(start: string, end: string) {
  const [sh] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  const hours: number[] = [];
  for (let h = sh; h <= eh; h++) hours.push(h);
  return hours;
}

interface ModalState {
  open: boolean;
  agendamento?: Agendamento;
  dataInicio?: Date;
}

interface FormData {
  paciente_id: string;
  titulo: string;
  data_inicio: string;
  data_fim: string;
  status: string;
  tipo_atendimento: string;
  observacoes: string;
}

export default function Agenda() {
  const { user, loading: authLoading } = useAuth();
  const { agendamentos, pacientes, config, loading, createAgendamento, updateAgendamento, deleteAgendamento, createPaciente } = useAgenda();

  const [viewMode, setViewMode] = useState<ViewMode>('semana');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [showNewPaciente, setShowNewPaciente] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newPacNome, setNewPacNome] = useState('');
  const [newPacEmail, setNewPacEmail] = useState('');
  const [newPacTel, setNewPacTel] = useState('');

  const [form, setForm] = useState<FormData>({
    paciente_id: '',
    titulo: '',
    data_inicio: '',
    data_fim: '',
    status: 'confirmado',
    tipo_atendimento: 'retorno',
    observacoes: '',
  });

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const hours = generateHours(config.horario_inicio, config.horario_fim);

  // Navigation
  const navPrev = () => {
    if (viewMode === 'dia') setCurrentDate(d => subDays(d, 1));
    else if (viewMode === 'semana') setCurrentDate(d => subWeeks(d, 1));
    else setCurrentDate(d => subMonths(d, 1));
  };
  const navNext = () => {
    if (viewMode === 'dia') setCurrentDate(d => addDays(d, 1));
    else if (viewMode === 'semana') setCurrentDate(d => addWeeks(d, 1));
    else setCurrentDate(d => addMonths(d, 1));
  };

  // Get days for current view
  const getDays = (): Date[] => {
    if (viewMode === 'dia') return [currentDate];
    if (viewMode === 'semana') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const gridStart = startOfWeek(start, { weekStartsOn: 1 });
    const gridEnd = endOfWeek(end, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  };

  const days = getDays();

  const getAgendamentosForDay = (day: Date) =>
    agendamentos.filter(ag => isSameDay(parseISO(ag.data_inicio), day));

  const getAgendamentoPosition = (ag: Agendamento, dayStart: number) => {
    const start = parseISO(ag.data_inicio);
    const end = parseISO(ag.data_fim);
    const startMin = (getHours(start) - dayStart) * 60 + getMinutes(start);
    const durMin = differenceInMinutes(end, start);
    return { top: (startMin / 60) * 64, height: Math.max((durMin / 60) * 64, 28) };
  };

  const openNew = (date?: Date) => {
    const base = date || new Date();
    const h = getHours(base);
    const start = setMinutes(setHours(base, h < Number(config.horario_inicio.split(':')[0]) ? Number(config.horario_inicio.split(':')[0]) : h), 0);
    const end = new Date(start.getTime() + config.duracao_padrao * 60000);
    setForm({
      paciente_id: '', titulo: '',
      data_inicio: format(start, "yyyy-MM-dd'T'HH:mm"),
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
    if (modal.agendamento) {
      await updateAgendamento(modal.agendamento.id, payload);
    } else {
      await createAgendamento(payload as Omit<Agendamento, 'id'>);
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
    if (novo) {
      setForm(f => ({ ...f, paciente_id: novo.id }));
      setShowNewPaciente(false);
      setNewPacNome(''); setNewPacEmail(''); setNewPacTel('');
    }
  };

  const headerLabel = () => {
    if (viewMode === 'dia') return format(currentDate, "EEEE, d 'de' MMMM yyyy", { locale: ptBR });
    if (viewMode === 'semana') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return `${format(start, 'd MMM', { locale: ptBR })} – ${format(end, 'd MMM yyyy', { locale: ptBR })}`;
    }
    return format(currentDate, "MMMM 'de' yyyy", { locale: ptBR });
  };

  const stats = {
    hoje: agendamentos.filter(ag => isToday(parseISO(ag.data_inicio))).length,
    confirmados: agendamentos.filter(ag => isSameDay(parseISO(ag.data_inicio), currentDate) && ag.status === 'confirmado').length,
    pendentes: agendamentos.filter(ag => ag.status === 'pendente').length,
    semana: agendamentos.filter(ag => {
      const d = parseISO(ag.data_inicio);
      return d >= startOfWeek(new Date(), { weekStartsOn: 1 }) && d <= endOfWeek(new Date(), { weekStartsOn: 1 });
    }).length,
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container py-6">
        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Hoje', value: stats.hoje, color: 'text-primary' },
            { label: 'Confirmados (hoje)', value: stats.confirmados, color: 'text-emerald-500' },
            { label: 'Pendentes', value: stats.pendentes, color: 'text-amber-500' },
            { label: 'Esta semana', value: stats.semana, color: 'text-blue-500' },
          ].map(s => (
            <div key={s.label} className="clinical-card py-3">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={navPrev}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" onClick={navNext}><ChevronRight className="h-4 w-4" /></Button>
            <span className="font-semibold text-sm ml-2 capitalize">{headerLabel()}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* View mode */}
            <div className="flex rounded-lg border overflow-hidden text-xs">
              {(['dia', 'semana', 'mes'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`px-3 py-1.5 font-medium transition-all capitalize ${viewMode === v ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/30'}`}>
                  {v === 'dia' ? 'Dia' : v === 'semana' ? 'Semana' : 'Mês'}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => setShowSettings(true)}><Settings className="h-4 w-4" /></Button>
            <Button className="bg-gradient-primary text-white gap-1" size="sm" onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Agendar
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 mb-4">
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className={`h-2.5 w-2.5 rounded-full ${STATUS_COLORS[k]}`} />
              {v}
            </div>
          ))}
        </div>

        {/* CALENDAR */}
        <div className="clinical-card p-0 overflow-hidden">
          {/* Month view */}
          {viewMode === 'mes' && (
            <div>
              <div className="grid grid-cols-7 border-b">
                {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map(d => (
                  <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((day, i) => {
                  const ags = getAgendamentosForDay(day);
                  const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                  return (
                    <div
                      key={i}
                      onClick={() => { setCurrentDate(day); setViewMode('dia'); }}
                      className={`min-h-[80px] border-r border-b p-1 cursor-pointer hover:bg-accent/30 transition-colors ${!isCurrentMonth ? 'opacity-40' : ''} ${isToday(day) ? 'bg-primary/5' : ''}`}
                    >
                      <div className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {ags.slice(0, 3).map(ag => (
                          <div key={ag.id} onClick={e => { e.stopPropagation(); openEdit(ag); }}
                            className={`text-[10px] px-1 rounded truncate text-white cursor-pointer ${STATUS_COLORS[ag.status]}`}>
                            {format(parseISO(ag.data_inicio), 'HH:mm')} {ag.titulo || ag.pacientes?.nome || ''}
                          </div>
                        ))}
                        {ags.length > 3 && <div className="text-[10px] text-muted-foreground pl-1">+{ags.length - 3} mais</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Day/Week view – time grid */}
          {(viewMode === 'dia' || viewMode === 'semana') && (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 320px)' }}>
              <div className={`grid min-w-[500px]`} style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
                {/* Header row */}
                <div className="border-b border-r bg-card/80 py-2" />
                {days.map(day => (
                  <div key={day.toString()} onClick={() => { if (viewMode === 'semana') { setCurrentDate(day); setViewMode('dia'); }}}
                    className={`border-b border-r text-center py-2 text-xs font-semibold cursor-pointer hover:bg-accent/20 transition-colors ${isToday(day) ? 'bg-primary/5 text-primary' : 'text-muted-foreground'}`}>
                    <div className="capitalize">{format(day, 'EEE', { locale: ptBR })}</div>
                    <div className={`text-base font-black mx-auto w-7 h-7 flex items-center justify-center rounded-full ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}

                {/* Hour rows */}
                {hours.map(hour => (
                  <>
                    <div key={`h-${hour}`} className="border-b border-r text-right pr-2 text-[10px] text-muted-foreground" style={{ height: 64, paddingTop: 4 }}>
                      {hour}:00
                    </div>
                    {days.map(day => {
                      const dayAgs = getAgendamentosForDay(day).filter(ag => getHours(parseISO(ag.data_inicio)) === hour);
                      const dayStart = Number(config.horario_inicio.split(':')[0]);
                      return (
                        <div key={`${day}-${hour}`} className="border-b border-r relative cursor-pointer hover:bg-accent/20 transition-colors"
                          style={{ height: 64 }}
                          onClick={() => {
                            const d = setMinutes(setHours(day, hour), 0);
                            openNew(d);
                          }}>
                          {getAgendamentosForDay(day)
                            .filter(ag => {
                              const h = getHours(parseISO(ag.data_inicio));
                              return h === hour;
                            })
                            .map(ag => {
                              const { top, height } = getAgendamentoPosition(ag, dayStart);
                              return (
                                <div
                                  key={ag.id}
                                  className={`absolute left-0.5 right-0.5 rounded text-white text-[10px] px-1 overflow-hidden cursor-pointer hover:brightness-90 transition-all z-10 ${STATUS_COLORS[ag.status]}`}
                                  style={{ top: top % 64, height: Math.min(height, 64 * (hours.length - hour + dayStart)) }}
                                  onClick={e => { e.stopPropagation(); openEdit(ag); }}
                                >
                                  <div className="font-semibold truncate">{format(parseISO(ag.data_inicio), 'HH:mm')} {ag.titulo || ag.pacientes?.nome || ''}</div>
                                  {height > 30 && <div className="truncate opacity-80">{ag.tipo_atendimento ? TIPO_LABELS[ag.tipo_atendimento] : ''}</div>}
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
          )}
        </div>
      </div>

      {/* Modal de Agendamento */}
      <Dialog open={modal.open} onOpenChange={open => !open && setModal({ open: false })}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal.agendamento ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Paciente */}
            <div>
              <Label>Paciente</Label>
              <div className="flex gap-2">
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
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Datas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início</Label>
                <Input type="datetime-local" value={form.data_inicio} onChange={e => {
                  const start = new Date(e.target.value);
                  const end = new Date(start.getTime() + config.duracao_padrao * 60000);
                  setForm(f => ({ ...f, data_inicio: e.target.value, data_fim: format(end, "yyyy-MM-dd'T'HH:mm") }));
                }} />
              </div>
              <div>
                <Label>Término</Label>
                <Input type="datetime-local" value={form.data_fim} onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))} />
              </div>
            </div>

            {/* Status */}
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[k]}`} />
                        {v}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Observações */}
            <div>
              <Label>Observações</Label>
              <Textarea placeholder="Observações sobre o atendimento..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
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

      {/* Settings modal */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader><DialogTitle>⚙️ Configurações da Agenda</DialogTitle></DialogHeader>
          <div className="space-y-4 text-sm text-muted-foreground">
            <p>Em breve: horário de funcionamento, duração padrão, dias da semana e muito mais.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
