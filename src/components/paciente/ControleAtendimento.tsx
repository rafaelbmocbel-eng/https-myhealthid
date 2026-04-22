import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Users, Clock, Plus, Search, ClipboardCheck, Phone, CalendarDays,
  CheckCircle2, XCircle, ChevronLeft, ChevronRight, History,
  Star, StickyNote, Trash2,
} from 'lucide-react';
import { format, parseISO, isToday, isSameDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { cn } from '@/lib/utils';

interface ControleAtendimentoProps {
  embedded?: boolean;
}

export default function ControleAtendimento({ embedded = false }: ControleAtendimentoProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [controleTabModo, setControleTabModo] = useState<'diario' | 'historico'>('diario');
  const [historicoPatientId, setHistoricoPatientId] = useState('');
  const [addPacienteModal, setAddPacienteModal] = useState(false);
  const [addingPaciente, setAddingPaciente] = useState(false);
  const [addPacienteForm, setAddPacienteForm] = useState({
    pacienteId: '', horaInicio: '08:00', horaFim: '09:00', status: 'pendente',
  });
  const [vipSearch, setVipSearch] = useState('');
  const [newNote, setNewNote] = useState('');

  const storageKey = user?.id ? `crm-notas-${user.id}` : 'crm-notas';

  const [vipIds, setVipIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${storageKey}-vip`) || '[]'); } catch { return []; }
  });
  const [notes, setNotes] = useState<{ id: string; text: string; createdAt: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem(`${storageKey}-notes`) || '[]'); } catch { return []; }
  });
  const [patientNotes, setPatientNotes] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem(`${storageKey}-pnotes-all`) || '{}'); } catch { return {}; }
  });
  const saveVip = (ids: string[]) => { setVipIds(ids); localStorage.setItem(`${storageKey}-vip`, JSON.stringify(ids)); };
  const saveNotes = (n: typeof notes) => { setNotes(n); localStorage.setItem(`${storageKey}-notes`, JSON.stringify(n)); };
  const savePatientNotes = (pn: Record<string, string>) => { setPatientNotes(pn); localStorage.setItem(`${storageKey}-pnotes-all`, JSON.stringify(pn)); };

  // Queries
  const { data: patients = [] } = useQuery({
    queryKey: ['controle-patients', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('pacientes').select('*').eq('terapeuta_id', user!.id).eq('ativo', true).order('nome');
      return data || [];
    },
    enabled: !!user,
  });

  const { data: agendamentos = [] } = useQuery({
    queryKey: ['controle-agendamentos', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('agendamentos').select('*')
        .eq('terapeuta_id', user!.id)
        .order('data_inicio', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: sessoes = [] } = useQuery({
    queryKey: ['controle-sessoes', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('controle_sessoes').select('*')
        .eq('terapeuta_id', user!.id).order('data_sessao', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Mutations
  const upsertSessao = useMutation({
    mutationFn: async (sessao: any) => {
      const { data: existing, error: selectError } = await supabase
        .from('controle_sessoes')
        .select('id, valor_cobrado, forma_pagamento, observacoes, numero_sessao, duracao_minutos, tipo_atendimento')
        .eq('agendamento_id', sessao.agendamento_id)
        .maybeSingle();
      if (selectError) throw selectError;

      if (existing?.id) {
        const { error } = await supabase.from('controle_sessoes').update({
          ...sessao, terapeuta_id: user!.id,
          valor_cobrado: sessao.valor_cobrado ?? existing.valor_cobrado ?? 0,
          forma_pagamento: sessao.forma_pagamento ?? existing.forma_pagamento ?? null,
          observacoes: sessao.observacoes ?? existing.observacoes ?? null,
          numero_sessao: sessao.numero_sessao ?? existing.numero_sessao ?? 1,
          duracao_minutos: sessao.duracao_minutos ?? existing.duracao_minutos ?? 45,
          tipo_atendimento: sessao.tipo_atendimento ?? existing.tipo_atendimento ?? 'retorno',
        }).eq('id', existing.id);
        if (error) throw error;
        return;
      }

      const { error } = await supabase.from('controle_sessoes').insert({
        ...sessao, terapeuta_id: user!.id,
        valor_cobrado: sessao.valor_cobrado ?? 0,
        numero_sessao: sessao.numero_sessao ?? 1,
        duracao_minutos: sessao.duracao_minutos ?? 45,
        tipo_atendimento: sessao.tipo_atendimento ?? 'retorno',
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['controle-sessoes'] }); },
  });

  const deleteSessao = useMutation({
    mutationFn: async (agendamentoId: string) => {
      const { error } = await supabase.from('controle_sessoes').delete().eq('agendamento_id', agendamentoId);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['controle-sessoes'] }); },
  });

  const attendanceStatusByAgendamento = useMemo(() => {
    const statusMap: Record<string, 'pendente' | 'atendido' | 'faltou'> = {};
    sessoes.forEach((sessao: any) => {
      if (!sessao.agendamento_id) return;
      statusMap[sessao.agendamento_id] = sessao.status === 'realizada'
        ? 'atendido' : sessao.status === 'falta' || sessao.status === 'faltou' ? 'faltou' : 'pendente';
    });
    return statusMap;
  }, [sessoes]);

  const getAttendanceStatus = (agendamentoId: string) => attendanceStatusByAgendamento[agendamentoId] || 'pendente';

  // Daily appointments
  const dailyAgs = useMemo(() =>
    agendamentos
      .filter((ag: any) => isSameDay(parseISO(ag.data_inicio), currentDate) && ag.status !== 'cancelado')
      .sort((a: any, b: any) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime()),
    [agendamentos, currentDate]
  );

  const atendidos = dailyAgs.filter((ag: any) => getAttendanceStatus(ag.id) === 'atendido').length;
  const faltaram = dailyAgs.filter((ag: any) => getAttendanceStatus(ag.id) === 'faltou').length;
  const pendentes = dailyAgs.length - atendidos - faltaram;
  const pctDone = dailyAgs.length > 0 ? Math.round((atendidos / dailyAgs.length) * 100) : 0;

  const cycleStatus = async (ag: any) => {
    const agId = ag.id;
    const current = getAttendanceStatus(agId);
    const next = current === 'pendente' ? 'atendido' : current === 'atendido' ? 'faltou' : 'pendente';

    if (!ag.paciente_id && next !== 'pendente') {
      toast({ title: 'Paciente não vinculado', description: 'Esse atendimento precisa ter um paciente para salvar presença.', variant: 'destructive' });
      return;
    }

    try {
      if (next === 'pendente') {
        await deleteSessao.mutateAsync(agId);
      } else {
        await upsertSessao.mutateAsync({
          paciente_id: ag.paciente_id,
          agendamento_id: agId,
          data_sessao: ag.data_inicio,
          status: next === 'atendido' ? 'realizada' : 'falta',
          valor_cobrado: 0,
          tipo_atendimento: ag.tipo_atendimento,
        });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao salvar status', description: e.message, variant: 'destructive' });
    }
  };

  const statusStyles = {
    pendente: 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10',
    atendido: 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10',
    faltou: 'border-red-300 bg-red-50/50 dark:bg-red-950/10 opacity-60',
  };
  const statusIcons = {
    pendente: <Clock className="h-4 w-4 text-amber-500" />,
    atendido: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
    faltou: <XCircle className="h-4 w-4 text-red-400" />,
  };
  const statusLabels = { pendente: 'Pendente', atendido: 'Atendido', faltou: 'Faltou' };

  return (
    <div className="space-y-5">
      {/* Header Tabs (Diario / Histórico) */}
      <div className="flex bg-muted/50 p-1 rounded-xl w-fit">
        <button
          onClick={() => setControleTabModo('diario')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${controleTabModo === 'diario' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <ClipboardCheck className="h-4 w-4" /> Checklist do Dia
        </button>
        <button
          onClick={() => setControleTabModo('historico')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${controleTabModo === 'historico' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <History className="h-4 w-4" /> Histórico Completo
        </button>
      </div>

      {/* Modal de Adição Diária de Paciente */}
      <Dialog open={addPacienteModal} onOpenChange={setAddPacienteModal}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Paciente ao Dia</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Paciente</Label>
              <PacienteSelect
                pacientes={patients}
                value={addPacienteForm.pacienteId}
                onValueChange={(val) => setAddPacienteForm({ ...addPacienteForm, pacienteId: val })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Hora Início</Label>
                <Input type="time" value={addPacienteForm.horaInicio} onChange={(e) => setAddPacienteForm({ ...addPacienteForm, horaInicio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Hora Fim</Label>
                <Input type="time" value={addPacienteForm.horaFim} onChange={(e) => setAddPacienteForm({ ...addPacienteForm, horaFim: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status Inicial</Label>
              <Select value={addPacienteForm.status} onValueChange={(val) => setAddPacienteForm({ ...addPacienteForm, status: val })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="atendido">Já Atendido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddPacienteModal(false)} disabled={addingPaciente}>Cancelar</Button>
            <Button className="bg-gradient-primary text-white" disabled={addingPaciente} onClick={async () => {
              if (!addPacienteForm.pacienteId) {
                toast({ title: 'Selecione um paciente', variant: 'destructive' });
                return;
              }
              setAddingPaciente(true);
              try {
                const dateStr = format(currentDate, 'yyyy-MM-dd');
                const dataInicio = new Date(`${dateStr}T${addPacienteForm.horaInicio}:00`);
                const dataFim = new Date(`${dateStr}T${addPacienteForm.horaFim}:00`);
                const pac = patients.find((p: any) => p.id === addPacienteForm.pacienteId);

                const { data, error } = await supabase.from('agendamentos').insert({
                  terapeuta_id: user!.id,
                  paciente_id: addPacienteForm.pacienteId,
                  data_inicio: dataInicio.toISOString(),
                  data_fim: dataFim.toISOString(),
                  titulo: `${pac?.nome} ${pac?.sobrenome || ''}`.trim(),
                  status: 'confirmado',
                  tipo_atendimento: 'sessao_regular',
                }).select('id').single();
                if (error) throw error;

                if (data && addPacienteForm.status !== 'pendente') {
                  await upsertSessao.mutateAsync({
                    paciente_id: addPacienteForm.pacienteId,
                    agendamento_id: data.id,
                    data_sessao: dataInicio.toISOString(),
                    status: addPacienteForm.status === 'atendido' ? 'realizada' : 'falta',
                    valor_cobrado: 0,
                    tipo_atendimento: 'sessao_regular',
                  });
                }

                toast({ title: 'Paciente adicionado ao dia!' });
                setAddPacienteModal(false);
                setAddPacienteForm({ pacienteId: '', horaInicio: '08:00', horaFim: '09:00', status: 'pendente' });
                queryClient.invalidateQueries({ queryKey: ['controle-agendamentos'] });
              } catch (e: any) {
                toast({ title: 'Erro ao adicionar', description: e.message, variant: 'destructive' });
              } finally {
                setAddingPaciente(false);
              }
            }}>
              {addingPaciente ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {controleTabModo === 'diario' ? (
        <>
          {/* Daily Progress */}
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-black">Progresso do Dia</h3>
                </div>
                <div className="flex items-center gap-1 bg-background border rounded-lg p-1 shadow-sm">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(addDays(currentDate, -1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <div className="text-xs font-bold w-24 text-center cursor-pointer hover:text-primary transition-colors" onClick={() => setCurrentDate(new Date())} title="Voltar para hoje">
                    {isToday(currentDate) ? 'Hoje' : format(currentDate, "dd MMM yyyy", { locale: ptBR })}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-500" style={{ width: `${pctDone}%` }} />
                </div>
                <span className="text-xs font-black text-primary">{pctDone}%</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                  <div className="text-lg font-black text-amber-600">{pendentes}</div>
                  <div className="text-[9px] font-bold text-amber-600/70 uppercase">Pendentes</div>
                </div>
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20">
                  <div className="text-lg font-black text-emerald-600">{atendidos}</div>
                  <div className="text-[9px] font-bold text-emerald-600/70 uppercase">Atendidos</div>
                </div>
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/20">
                  <div className="text-lg font-black text-red-500">{faltaram}</div>
                  <div className="text-[9px] font-bold text-red-500/70 uppercase">Faltaram</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Daily Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2 px-1 mt-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-bold">Atendimentos</span>
                <span className="text-[10px] text-muted-foreground hidden sm:inline-block ml-2">(Toque no ícone para alterar status)</span>
              </div>
              <Button size="sm" className="h-7 text-xs gap-1 bg-gradient-primary text-white" onClick={() => setAddPacienteModal(true)}>
                <Plus className="h-3 w-3" /> Adicionar Paciente
              </Button>
            </div>

            {dailyAgs.length > 0 ? dailyAgs.map((ag: any) => {
              const status = getAttendanceStatus(ag.id);
              const pac = patients.find((p: any) => p.id === ag.paciente_id);
              const name = ag.titulo || (pac ? `${pac.nome} ${pac.sobrenome || ''}`.trim() : 'Agendamento');
              const hora = format(parseISO(ag.data_inicio), 'HH:mm');
              const horaFim = format(parseISO(ag.data_fim), 'HH:mm');

              return (
                <div key={ag.id} className={`rounded-xl border-2 p-3 transition-all ${(statusStyles as any)[status]}`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => cycleStatus(ag)}
                      disabled={upsertSessao.isPending || deleteSessao.isPending}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-50"
                      title="Alternar status"
                    >
                      {(statusIcons as any)[status]}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black ${status === 'faltou' ? 'line-through text-muted-foreground' : ''}`}>{name}</span>
                        <Badge variant="outline" className="text-[8px] shrink-0">{(statusLabels as any)[status]}</Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="font-bold">{hora} – {horaFim}</span>
                        {ag.tipo_atendimento && <span>• {ag.tipo_atendimento.replace('_', ' ')}</span>}
                      </div>
                    </div>
                    {pac?.telefone && (
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600 shrink-0" onClick={() => { window.open(`https://wa.me/55${pac.telefone.replace(/\D/g, '')}`, '_blank'); }}>
                        <Phone className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="mt-2 pl-[38px]">
                    <Input
                      placeholder="Anotação rápida sobre a sessão..."
                      value={patientNotes[ag.id] || ''}
                      onChange={e => savePatientNotes({ ...patientNotes, [ag.id]: e.target.value })}
                      className="h-7 text-[10px] bg-transparent border-dashed"
                    />
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-8 border rounded-xl border-dashed">
                <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Nenhum atendimento para {isToday(currentDate) ? 'hoje' : 'esta data'}</p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* Per-Patient History */
        <Card className="border">
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> Histórico do Paciente
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 mb-2">Visão geral de todas as sessões e anotações.</p>
            <div className="mt-1">
              <PacienteSelect
                pacientes={patients.map((p: any) => ({ id: p.id, nome: p.nome, sobrenome: p.sobrenome }))}
                value={historicoPatientId}
                onValueChange={setHistoricoPatientId}
                placeholder="Pesquisar paciente..."
              />
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {!historicoPatientId ? (
              <div className="text-center py-8">
                <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Selecione um paciente acima para ver todo o histórico de presenças e anotações.</p>
              </div>
            ) : (() => {
              const patientAgs = agendamentos
                .filter((ag: any) => ag.paciente_id === historicoPatientId && ag.status !== 'cancelado')
                .sort((a: any, b: any) => parseISO(b.data_inicio).getTime() - parseISO(a.data_inicio).getTime());

              const statsAtendidos = patientAgs.filter((ag: any) => getAttendanceStatus(ag.id) === 'atendido').length;
              const statsFaltas = patientAgs.filter((ag: any) => getAttendanceStatus(ag.id) === 'faltou').length;

              return (
                <div className="space-y-4">
                  <div className="flex gap-4 p-3 bg-muted/40 rounded-lg">
                    <div className="flex-1 text-center border-r border-border/50">
                      <div className="text-xl font-black">{patientAgs.length}</div>
                      <div className="text-[9px] uppercase font-bold text-muted-foreground">Sessões</div>
                    </div>
                    <div className="flex-1 text-center border-r border-border/50">
                      <div className="text-xl font-black text-emerald-600">{statsAtendidos}</div>
                      <div className="text-[9px] uppercase font-bold text-emerald-600/70">Presenças</div>
                    </div>
                    <div className="flex-1 text-center">
                      <div className="text-xl font-black text-red-500">{statsFaltas}</div>
                      <div className="text-[9px] uppercase font-bold text-red-500/70">Faltas</div>
                    </div>
                  </div>

                  <div className="relative border-l-2 border-muted ml-3 pl-4 space-y-4 py-2 mt-2">
                    {patientAgs.length > 0 ? patientAgs.map((ag: any) => {
                      const status = getAttendanceStatus(ag.id);
                      return (
                        <div key={ag.id} className="relative">
                          <div className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background ${status === 'atendido' ? 'bg-emerald-500' : status === 'faltou' ? 'bg-red-500' : 'bg-amber-400'}`} />
                          <div className={`p-2 rounded-lg border text-xs ${status === 'atendido' ? 'bg-emerald-50/30 border-emerald-100 dark:border-emerald-900' : status === 'faltou' ? 'bg-red-50/30 border-red-100 dark:border-red-900 opacity-70' : 'bg-card'}`}>
                            <div className="flex justify-between items-start mb-1">
                              <span className="font-bold flex items-center gap-1.5">
                                {format(parseISO(ag.data_inicio), 'dd/MM/yyyy')}
                                <span className="font-normal text-muted-foreground">· {format(parseISO(ag.data_inicio), 'HH:mm')}</span>
                              </span>
                              <button onClick={() => cycleStatus(ag)} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
                                <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 border-current ${status === 'atendido' ? 'text-emerald-600' : status === 'faltou' ? 'text-red-500' : 'text-amber-600'}`}>
                                  {(statusLabels as any)[status]}
                                </Badge>
                              </button>
                            </div>
                            {ag.tipo_atendimento && <p className="text-[10px] text-muted-foreground mb-1">{ag.tipo_atendimento.replace('_', ' ')}</p>}
                            <Input
                              placeholder="Adicionar nota para esta sessão..."
                              value={patientNotes[ag.id] || ''}
                              onChange={e => savePatientNotes({ ...patientNotes, [ag.id]: e.target.value })}
                              className="h-6 text-[10px] bg-background/50 border-dashed px-2 mt-1"
                            />
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-xs text-muted-foreground italic">Nenhum agendamento encontrado.</p>
                    )}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* VIP Patients */}
      <Card className="border mt-8">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Pacientes VIP
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary shrink-0" />
            <Input placeholder="Buscar paciente para marcar VIP..." value={vipSearch} onChange={e => setVipSearch(e.target.value)} className="pl-10 h-10 text-sm bg-card border-2 border-primary/20 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm hover:border-primary/40 transition-colors" />
          </div>
          {vipIds.length > 0 && (
            <div className="space-y-1">
              {vipIds.map(id => {
                const p = patients.find((pat: any) => pat.id === id);
                if (!p) return null;
                return (
                  <div key={id} className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200">
                    <button onClick={() => saveVip(vipIds.filter(v => v !== id))}><Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" /></button>
                    <span className="text-xs font-bold truncate flex-1">{(p as any).nome} {(p as any).sobrenome}</span>
                    {(p as any).telefone && <button onClick={() => { const t = (p as any).telefone.replace(/\D/g, ''); window.open(`https://wa.me/55${t}`, '_blank'); }} className="text-emerald-600"><Phone className="h-3 w-3" /></button>}
                  </div>
                );
              })}
            </div>
          )}
          {vipSearch.trim() && (
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {patients
                .filter((p: any) => !vipIds.includes(p.id))
                .filter((p: any) => `${p.nome} ${p.sobrenome}`.toLowerCase().includes(vipSearch.toLowerCase()))
                .map((p: any) => (
                  <div key={p.id} className="flex items-center gap-2 p-1 rounded hover:bg-muted/40">
                    <button onClick={() => saveVip([...vipIds, p.id])} className="text-muted-foreground/20 hover:text-amber-500"><Star className="h-3 w-3" /></button>
                    <span className="text-[11px] truncate">{p.nome} {p.sobrenome}</span>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* General Notes */}
      <Card className="border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-blue-500" /> Anotações Rápidas Gerais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Textarea placeholder="Lembretes, afazeres da clínica..." value={newNote} onChange={e => setNewNote(e.target.value)} className="text-xs min-h-[50px] resize-none" rows={2} />
            <Button size="sm" className="h-auto px-3 bg-blue-600 hover:bg-blue-700 text-white shrink-0" disabled={!newNote.trim()}
              onClick={() => { saveNotes([{ id: Date.now().toString(), text: newNote.trim(), createdAt: new Date().toISOString() }, ...notes].slice(0, 50)); setNewNote(''); toast({ title: '📝 Salvo!' }); }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {notes.length > 0 && (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {notes.map(note => (
                <div key={note.id} className="p-2 rounded-lg bg-muted/30 border border-border/40 group flex items-start gap-2">
                  <p className="text-[11px] whitespace-pre-wrap flex-1">{note.text}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[9px] text-muted-foreground">{format(new Date(note.createdAt), 'dd/MM HH:mm')}</span>
                    <button onClick={() => { saveNotes(notes.filter(n => n.id !== note.id)); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
