import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
    Users, MessageSquare, DollarSign, Clock, ArrowRight, AlertCircle,
    ClipboardList, TrendingUp, Send, Package, Zap, Heart, Star, Gift,
    Target, ChevronDown, ChevronUp, Copy, Phone, Edit3, BarChart3,
    UserPlus, FileText, Activity, CheckCircle2, XCircle, CalendarDays,
    StickyNote, Trash2, Plus, Search, ClipboardCheck, RotateCcw,
    ChevronLeft, ChevronRight, History,
} from 'lucide-react';
import {
    shareViaWhatsApp, shareBoasVindas, sharePosAvaliacao, sharePosDiretriz,
    shareLembreteRetorno, sharePosAlta, shareAniversario, shareStructuralResults,
    sharePacoteInfo, sharePropostaComercial,
    MESSAGE_TEMPLATES, PACOTES_PREDEFINIDOS, type Pacote,
} from '@/utils/whatsapp';
import { format, differenceInDays, differenceInCalendarDays, isToday, parseISO, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Navigate } from 'react-router-dom';

type TabId = 'pipeline' | 'mensagens' | 'pacotes' | 'metricas' | 'notas';

export default function GestaoVendas() {
    const { user, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState<TabId>('pipeline');
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
    const [customMessages, setCustomMessages] = useState<Record<string, string>>({});
    const [selectedPacote, setSelectedPacote] = useState<string | null>(null);
    const [customValue, setCustomValue] = useState('');
    const [vipSearch, setVipSearch] = useState('');
    const [newNote, setNewNote] = useState('');

    // Attendance specific state
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [controleTabModo, setControleTabModo] = useState<'diario' | 'historico'>('diario');
    const [historicoPatientId, setHistoricoPatientId] = useState<string>('');
    const queryClient = useQueryClient();

    // Modal de Adição Diária
    const [addPacienteModal, setAddPacienteModal] = useState(false);
    const [addingPaciente, setAddingPaciente] = useState(false);
    const [addPacienteForm, setAddPacienteForm] = useState({
        pacienteId: '',
        horaInicio: '08:00',
        horaFim: '09:00',
        status: 'pendente'
    });

    // Persisted VIP list, notes, and attendance checks (localStorage)
    const storageKey = user?.id ? `crm-notas-${user.id}` : 'crm-notas';
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const [vipIds, setVipIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(`${storageKey}-vip`) || '[]'); } catch { return []; }
    });
    const [notes, setNotes] = useState<{ id: string; text: string; createdAt: string }[]>(() => {
        try { return JSON.parse(localStorage.getItem(`${storageKey}-notes`) || '[]'); } catch { return []; }
    });
    // Attendance status: { 'agendamento-id': 'atendido' | 'faltou' | 'pendente' }
    const [checkedIds, setCheckedIds] = useState<Record<string, string>>(() => {
        try { return JSON.parse(localStorage.getItem(`${storageKey}-checks-all`) || '{}'); } catch { return {}; }
    });
    // Per-patient quick notes linked to appointments
    const [patientNotes, setPatientNotes] = useState<Record<string, string>>(() => {
        try { return JSON.parse(localStorage.getItem(`${storageKey}-pnotes-all`) || '{}'); } catch { return {}; }
    });
    const saveVip = (ids: string[]) => { setVipIds(ids); localStorage.setItem(`${storageKey}-vip`, JSON.stringify(ids)); };
    const saveNotes = (n: typeof notes) => { setNotes(n); localStorage.setItem(`${storageKey}-notes`, JSON.stringify(n)); };
    const saveChecks = (c: Record<string, string>) => { setCheckedIds(c); localStorage.setItem(`${storageKey}-checks-all`, JSON.stringify(c)); };
    const savePatientNotes = (pn: Record<string, string>) => { setPatientNotes(pn); localStorage.setItem(`${storageKey}-pnotes-all`, JSON.stringify(pn)); };

    // ── Queries ──────────────────────────────────────────────────────
    const { data: patients = [] } = useQuery({
        queryKey: ['crm-patients', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('pacientes').select('*').eq('terapeuta_id', user!.id).order('nome');
            return data || [];
        },
        enabled: !!user,
    });

    const { data: pendingLinks = [] } = useQuery({
        queryKey: ['crm-pending-links', user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from('links_avaliacao')
                .select('*, pacientes(nome, sobrenome, telefone)')
                .eq('status', 'ativo')
                .eq('terapeuta_id', user!.id)
                .order('created_at', { ascending: false });
            return data || [];
        },
        enabled: !!user,
    });

    const { data: avaliacoes = [] } = useQuery({
        queryKey: ['crm-avaliacoes', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('avaliacoes_identidade').select('*')
                .eq('terapeuta_id', user!.id).order('created_at', { ascending: false }).limit(50);
            return data || [];
        },
        enabled: !!user,
    });

    const { data: agendamentos = [] } = useQuery({
        queryKey: ['crm-agendamentos', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('agendamentos').select('*')
                .eq('terapeuta_id', user!.id)
                .order('data_inicio', { ascending: false });
            return data || [];
        },
        enabled: !!user,
    });

    const { data: myidAvaliacoes = [] } = useQuery({
        queryKey: ['crm-myid', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('myid_avaliacoes').select('*, pacientes(nome, sobrenome, telefone)')
                .eq('terapeuta_id', user!.id).order('created_at', { ascending: false }).limit(50);
            return data || [];
        },
        enabled: !!user,
    });

    // Controle de sessões (receita)
    const { data: sessoes = [] } = useQuery({
        queryKey: ['crm-sessoes', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('controle_sessoes').select('*')
                .eq('terapeuta_id', user!.id).order('data_sessao', { ascending: false });
            return data || [];
        },
        enabled: !!user,
    });

    if (!authLoading && !user) return <Navigate to="/auth" replace />;

    // ── Computed metrics ─────────────────────────────────────────────
    const totalPacientes = patients.length;
    const linksPendentes = pendingLinks.length;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const sessoesMes = agendamentos.filter((a: any) => a.status === 'confirmado').length;
    const avaliacoesMes = avaliacoes.filter((a: any) => new Date(a.created_at) >= startOfMonth).length;

    // Patients without any evaluation (new leads)
    const pacientesComAvaliacao = new Set(avaliacoes.map((a: any) => a.paciente_id));
    const pacientesComMyID = new Set(myidAvaliacoes.filter((m: any) => m.status === 'concluido').map((m: any) => m.paciente_id));
    const leads = patients.filter((p: any) => !pacientesComAvaliacao.has(p.id) && !pacientesComMyID.has(p.id));
    const emAvaliacao = pendingLinks.map((l: any) => l.pacientes).filter(Boolean);
    const avaliados = patients.filter((p: any) => pacientesComAvaliacao.has(p.id) || pacientesComMyID.has(p.id));

    // Inactive patients (evaluated more than 30 days ago, no recent session)
    const pacientesComSessaoRecente = new Set(agendamentos.map((a: any) => a.paciente_id));
    const inativos = avaliados.filter((p: any) => !pacientesComSessaoRecente.has(p.id));

    // Taxa conversão
    const taxaConversao = totalPacientes > 0 ? Math.round((avaliados.length / totalPacientes) * 100) : 0;

    const sendToPatient = (patientId: string, callback: (name: string, phone: string) => void) => {
        const p = patients.find((pat: any) => pat.id === patientId);
        if (!p?.telefone) { toast({ title: 'Paciente sem telefone', variant: 'destructive' }); return; }
        callback(`${p.nome} ${p.sobrenome || ''}`.trim(), p.telefone);
        toast({ title: '📩 Mensagem aberta no WhatsApp!' });
    };

    const handleRelembrar = (link: any) => {
        const pac = link.pacientes;
        if (!pac?.telefone) { toast({ title: 'Paciente sem telefone', variant: 'destructive' }); return; }
        const tel = pac.telefone.replace(/\D/g, '');
        const msg = encodeURIComponent(
            `Olá ${pac.nome}! 👋\n\nNotei que ainda não preencheu o questionário que enviei. ` +
            `É bem rápido e super importante para o seu tratamento personalizado.\n\n` +
            `Pode preencher quando tiver um tempinho? O link ainda está ativo! 😊`
        );
        window.open(`https://wa.me/55${tel}?text=${msg}`, '_blank');
        toast({ title: '📩 Lembrete enviado!' });
    };

    const handleSendPacote = (pacote: Pacote) => {
        if (!selectedPatient?.telefone) { toast({ title: 'Selecione um paciente com telefone', variant: 'destructive' }); return; }
        const details = pacote.diferenciais.map(d => `✅ ${d}`).join('\n');
        const valor = customValue || `R$ ${pacote.valorSugerido}`;
        sharePacoteInfo(`${selectedPatient.nome} ${selectedPatient.sobrenome || ''}`, selectedPatient.telefone, pacote.nome, details, valor);
        toast({ title: '📩 Pacote enviado via WhatsApp!' });
    };

    // ── Tabs ─────────────────────────────────────────────────────────
    const TABS: { id: TabId; label: string; icon: any }[] = [
        { id: 'pipeline', label: 'Pipeline', icon: Target },
        { id: 'mensagens', label: 'Mensagens', icon: MessageSquare },
        { id: 'pacotes', label: 'Pacotes', icon: Package },
        { id: 'metricas', label: 'Métricas', icon: BarChart3 },
        { id: 'notas', label: 'Controle', icon: ClipboardCheck },
    ];

    return (
        <AppLayout title="Gestão & CRM">
            <div className="space-y-6">
                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-none">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg"><Users className="h-5 w-5" /></div>
                            <div><p className="text-[10px] opacity-80 uppercase font-bold">Pacientes</p><h3 className="text-2xl font-black">{totalPacientes}</h3></div>
                        </CardContent>
                    </Card>
                    <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white border-none">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg"><Clock className="h-5 w-5" /></div>
                            <div><p className="text-[10px] opacity-80 uppercase font-bold">Pendentes</p><h3 className="text-2xl font-black">{linksPendentes}</h3></div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg text-muted-foreground"><TrendingUp className="h-5 w-5" /></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Sessões/Mês</p><h3 className="text-2xl font-black">{sessoesMes}</h3></div>
                        </CardContent>
                    </Card>
                    <Card className="bg-card border">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg text-muted-foreground"><Activity className="h-5 w-5" /></div>
                            <div><p className="text-[10px] text-muted-foreground uppercase font-bold">Avaliações/Mês</p><h3 className="text-2xl font-black">{avaliacoesMes}</h3></div>
                        </CardContent>
                    </Card>
                </div>

                {/* ── Tab Selector ── */}
                <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            <tab.icon className="h-3.5 w-3.5" />{tab.label}
                        </button>
                    ))}
                </div>

                {/* ══════════════════ PIPELINE TAB ══════════════════ */}
                {activeTab === 'pipeline' && (
                    <div className="space-y-4">
                        {/* Funnel stages */}
                        <FunnelStage title="Leads (Sem Avaliação)" icon={<UserPlus className="h-4 w-4 text-blue-600" />} count={leads.length} color="blue" defaultOpen={leads.length > 0}>
                            {leads.length === 0 ? <p className="text-xs text-muted-foreground italic p-3">Todos os pacientes já iniciaram avaliação 🎉</p> : (
                                leads.slice(0, 5).map((p: any) => (
                                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold">{p.nome?.[0]}</div>
                                            <div>
                                                <span className="text-sm font-medium">{p.nome} {p.sobrenome}</span>
                                                <div className="text-[10px] text-muted-foreground">{p.telefone || 'Sem telefone'}</div>
                                            </div>
                                        </div>
                                        {p.telefone && (
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-blue-600"
                                                    onClick={() => sendToPatient(p.id, (n, ph) => shareBoasVindas(n, ph, user?.user_metadata?.nome || 'Terapeuta'))}>
                                                    <Send className="h-3 w-3" /> Boas-vindas
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </FunnelStage>

                        <FunnelStage title="Questionário Pendente" icon={<Clock className="h-4 w-4 text-amber-600" />} count={pendingLinks.length} color="amber" defaultOpen={pendingLinks.length > 0}>
                            {pendingLinks.length === 0 ? <p className="text-xs text-muted-foreground italic p-3">Nenhum pendente 🎉</p> : (
                                pendingLinks.slice(0, 5).map((link: any) => {
                                    const days = differenceInDays(now, new Date(link.created_at));
                                    const urgent = days >= 3;
                                    return (
                                        <div key={link.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30">
                                            <div className="flex items-center gap-2">
                                                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {link.pacientes?.nome?.[0]}
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium">{link.pacientes?.nome} {link.pacientes?.sobrenome}</span>
                                                    <div className="text-[10px] text-muted-foreground">{days}d atrás {urgent && '⚠️'}</div>
                                                </div>
                                            </div>
                                            <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-amber-600" onClick={() => handleRelembrar(link)}>
                                                <MessageSquare className="h-3 w-3" /> Relembrar
                                            </Button>
                                        </div>
                                    );
                                })
                            )}
                        </FunnelStage>

                        <FunnelStage title="Avaliados (Ativos)" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} count={avaliados.length - inativos.length} color="emerald" defaultOpen={false}>
                            {avaliados.filter(p => !inativos.includes(p)).slice(0, 5).map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30">
                                    <div className="flex items-center gap-2">
                                        <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold">{p.nome?.[0]}</div>
                                        <span className="text-sm font-medium">{p.nome} {p.sobrenome}</span>
                                    </div>
                                    {p.telefone && (
                                        <div className="flex gap-1">
                                            <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1"
                                                onClick={() => sendToPatient(p.id, (n, ph) => sharePosAvaliacao(n, ph, '📊 Seus resultados estão prontos!'))}>
                                                <FileText className="h-3 w-3" /> Pós-Avaliação
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </FunnelStage>

                        <FunnelStage title="Follow-up Necessário" icon={<AlertCircle className="h-4 w-4 text-red-600" />} count={inativos.length} color="red" defaultOpen={inativos.length > 0}>
                            {inativos.length === 0 ? <p className="text-xs text-muted-foreground italic p-3">Todos os pacientes estão em dia! 🎉</p> : (
                                inativos.slice(0, 5).map((p: any) => (
                                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/30">
                                        <div className="flex items-center gap-2">
                                            <div className="h-7 w-7 rounded-full bg-red-100 flex items-center justify-center text-red-700 text-xs font-bold">{p.nome?.[0]}</div>
                                            <div>
                                                <span className="text-sm font-medium">{p.nome} {p.sobrenome}</span>
                                                <div className="text-[10px] text-muted-foreground">Sem sessão recente</div>
                                            </div>
                                        </div>
                                        {p.telefone && (
                                            <div className="flex gap-1">
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-amber-600"
                                                    onClick={() => sendToPatient(p.id, (n, ph) => shareLembreteRetorno(n, ph, 'em breve'))}>
                                                    <CalendarDays className="h-3 w-3" /> Retorno
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-red-600"
                                                    onClick={() => sendToPatient(p.id, (n, ph) => sharePosAlta(n, ph))}>
                                                    <Heart className="h-3 w-3" /> Pós-Alta
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </FunnelStage>
                    </div>
                )}

                {/* ══════════════════ MENSAGENS TAB ══════════════════ */}
                {activeTab === 'mensagens' && (
                    <div className="space-y-4">
                        {/* Patient Selector */}
                        <Card className="border">
                            <CardContent className="p-4">
                                <label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Selecionar Paciente</label>
                                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                    onChange={(e) => setSelectedPatient(patients.find((p: any) => p.id === e.target.value) || null)}>
                                    <option value="">Selecione um paciente...</option>
                                    {patients.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.nome} {p.sobrenome} {p.telefone ? `· ${p.telefone}` : '(sem tel)'}</option>
                                    ))}
                                </select>
                                {selectedPatient && !selectedPatient.telefone && (
                                    <p className="text-xs text-destructive mt-1">⚠️ Este paciente não tem telefone cadastrado</p>
                                )}
                            </CardContent>
                        </Card>

                        {/* Message Categories */}
                        {(['funil', 'clinico', 'comercial'] as const).map(cat => {
                            const labels = { funil: '👤 Etapas do Funil', clinico: '🏥 Clínico', comercial: '💰 Comercial' };
                            const templates = MESSAGE_TEMPLATES.filter(t => t.category === cat);
                            return (
                                <div key={cat}>
                                    <h3 className="font-bold text-sm mb-2">{labels[cat]}</h3>
                                    <div className="grid gap-2">
                                        {templates.map(tpl => {
                                            const isEditing = editingTemplate === tpl.id;
                                            const msg = customMessages[tpl.id] || tpl.defaultMessage;
                                            return (
                                                <div key={tpl.id} className="clinical-card !p-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-lg">{tpl.icon}</span>
                                                            <div>
                                                                <span className="text-sm font-bold">{tpl.label}</span>
                                                                <div className="flex gap-1 mt-0.5">
                                                                    {tpl.variables.map(v => <Badge key={v} variant="outline" className="text-[8px]">{`{${v}}`}</Badge>)}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                                                                onClick={() => setEditingTemplate(isEditing ? null : tpl.id)}>
                                                                <Edit3 className="h-3 w-3" />
                                                            </Button>
                                                            <Button size="sm" variant="default" className="h-7 text-[10px] gap-1 bg-green-600 hover:bg-green-700"
                                                                disabled={!selectedPatient?.telefone}
                                                                onClick={() => {
                                                                    if (!selectedPatient?.telefone) return;
                                                                    let finalMsg = msg
                                                                        .replace('{nome}', `${selectedPatient.nome} ${selectedPatient.sobrenome || ''}`.trim())
                                                                        .replace('{terapeuta}', user?.user_metadata?.nome || 'Terapeuta')
                                                                        .replace('{data}', format(new Date(), "dd 'de' MMMM", { locale: ptBR }))
                                                                        .replace('{servico}', 'Método Identidade')
                                                                        .replace('{valor}', 'consulte')
                                                                        .replace('{score}', '—')
                                                                        .replace('{classificacao}', '—');
                                                                    shareViaWhatsApp(selectedPatient.telefone, finalMsg);
                                                                    toast({ title: '📩 Mensagem aberta no WhatsApp!' });
                                                                }}>
                                                                <Send className="h-3 w-3" /> Enviar
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {isEditing && (
                                                        <div className="mt-2 pt-2 border-t">
                                                            <Textarea className="text-xs min-h-[60px]" value={msg}
                                                                onChange={(e) => setCustomMessages(prev => ({ ...prev, [tpl.id]: e.target.value }))} />
                                                            <p className="text-[9px] text-muted-foreground mt-1">Variáveis: {tpl.variables.map(v => `{${v}}`).join(', ')}</p>
                                                        </div>
                                                    )}
                                                    {!isEditing && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{msg}</p>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ══════════════════ PACOTES TAB ══════════════════ */}
                {activeTab === 'pacotes' && (
                    <div className="space-y-4">
                        <Card className="border">
                            <CardContent className="p-4">
                                <label className="text-[10px] uppercase font-black text-muted-foreground mb-1 block">Paciente</label>
                                <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                                    onChange={(e) => setSelectedPatient(patients.find((p: any) => p.id === e.target.value) || null)}>
                                    <option value="">Selecione...</option>
                                    {patients.map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>
                                    ))}
                                </select>
                            </CardContent>
                        </Card>

                        {(['Método Identidade', 'COB° ZERO', 'Studio Personal ID'] as const).map(servico => {
                            const pacotes = PACOTES_PREDEFINIDOS.filter(p => p.servico === servico);
                            return (
                                <div key={servico}>
                                    <h3 className="font-bold text-sm mb-2">{servico}</h3>
                                    <div className="grid gap-3 md:grid-cols-2">
                                        {pacotes.map(pacote => {
                                            const isSelected = selectedPacote === pacote.id;
                                            return (
                                                <div key={pacote.id} className={`clinical-card cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/30'}`}
                                                    onClick={() => { setSelectedPacote(isSelected ? null : pacote.id); setCustomValue(pacote.valorSugerido); }}>
                                                    <div className="flex items-start justify-between mb-2">
                                                        <div>
                                                            <h4 className="font-bold text-sm">{pacote.nome}</h4>
                                                            <p className="text-[10px] text-muted-foreground">{pacote.sessoes} sessões · {pacote.duracao}</p>
                                                        </div>
                                                        <Badge className="bg-primary/10 text-primary border-0 font-black">R$ {pacote.valorSugerido}</Badge>
                                                    </div>
                                                    <div className="space-y-1 mb-3">
                                                        {pacote.diferenciais.map((d, i) => (
                                                            <div key={i} className="flex items-center gap-1.5 text-[10px]">
                                                                <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                                                <span>{d}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {isSelected && (
                                                        <div className="pt-2 border-t space-y-2">
                                                            <div className="flex gap-2">
                                                                <div className="flex-1">
                                                                    <label className="text-[9px] uppercase font-bold text-muted-foreground">Valor personalizado</label>
                                                                    <div className="relative">
                                                                        <span className="absolute left-2 top-2 text-xs text-muted-foreground font-bold">R$</span>
                                                                        <Input className="pl-7 h-8 text-sm font-bold" value={customValue}
                                                                            onChange={(e) => setCustomValue(e.target.value)} />
                                                                    </div>
                                                                </div>
                                                                <Button className="h-8 self-end bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
                                                                    disabled={!selectedPatient?.telefone}
                                                                    onClick={(e) => { e.stopPropagation(); handleSendPacote(pacote); }}>
                                                                    <Send className="h-3 w-3" /> WhatsApp
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ══════════════════ MÉTRICAS TAB ══════════════════ */}
                {activeTab === 'metricas' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <MetricCard label="Taxa de Conversão" value={`${taxaConversao}%`} desc="Leads → Avaliados" icon={TrendingUp} color="primary" />
                            <MetricCard label="Leads" value={leads.length.toString()} desc="Sem avaliação" icon={UserPlus} color="blue" />
                            <MetricCard label="Follow-up" value={inativos.length.toString()} desc="Sem sessão recente" icon={AlertCircle} color="red" />
                            <MetricCard label="Ativos" value={(avaliados.length - inativos.length).toString()} desc="Com sessões" icon={CheckCircle2} color="emerald" />
                        </div>

                        {/* Funnel Visual */}
                        <Card className="border">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2"><Target className="h-4 w-4" /> Funil de Conversão</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <FunnelBar label="Total Pacientes" value={totalPacientes} max={totalPacientes} color="bg-blue-500" />
                                    <FunnelBar label="Questionário Enviado" value={pendingLinks.length + avaliados.length} max={totalPacientes} color="bg-amber-500" />
                                    <FunnelBar label="Avaliados" value={avaliados.length} max={totalPacientes} color="bg-emerald-500" />
                                    <FunnelBar label="Com Sessões Ativas" value={avaliados.length - inativos.length} max={totalPacientes} color="bg-primary" />
                                </div>
                            </CardContent>
                        </Card>

                        {/* Monthly stats */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Card className="border">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">📊 Resumo do Mês</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <StatRow label="Novos pacientes" value={patients.filter((p: any) => differenceInCalendarDays(now, new Date(p.created_at)) <= 30).length} />
                                    <StatRow label="Avaliações realizadas" value={avaliacoesMes} />
                                    <StatRow label="Sessões confirmadas" value={sessoesMes} />
                                    <StatRow label="Links pendentes" value={linksPendentes} />
                                </CardContent>
                            </Card>
                            <Card className="border">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold">🎯 Ações Recomendadas</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    {leads.length > 0 && <ActionItem icon="👋" text={`Enviar boas-vindas para ${leads.length} lead(s)`} />}
                                    {linksPendentes > 0 && <ActionItem icon="📋" text={`Relembrar ${linksPendentes} questionário(s) pendente(s)`} />}
                                    {inativos.length > 0 && <ActionItem icon="⏰" text={`Follow-up com ${inativos.length} paciente(s) inativo(s)`} />}
                                    {leads.length === 0 && linksPendentes === 0 && inativos.length === 0 && (
                                        <p className="text-xs text-muted-foreground italic">Tudo em dia! 🎉</p>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* ══════════════════ CONTROLE DE ATENDIMENTO TAB ══════════════════ */}
                {activeTab === 'notas' && (() => {
                    // Current day appointments
                    const dailyAgs = agendamentos
                        .filter((ag: any) => isSameDay(parseISO(ag.data_inicio), currentDate) && ag.status !== 'cancelado')
                        .sort((a: any, b: any) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime());

                    const atendidos = dailyAgs.filter((ag: any) => checkedIds[ag.id] === 'atendido').length;
                    const faltaram = dailyAgs.filter((ag: any) => checkedIds[ag.id] === 'faltou').length;
                    const pendentes = dailyAgs.length - atendidos - faltaram;
                    const pctDone = dailyAgs.length > 0 ? Math.round((atendidos / dailyAgs.length) * 100) : 0;

                    const cycleStatus = (agId: string) => {
                        const current = checkedIds[agId] || 'pendente';
                        const next = current === 'pendente' ? 'atendido' : current === 'atendido' ? 'faltou' : 'pendente';
                        saveChecks({ ...checkedIds, [agId]: next });
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
                                            <Select value={addPacienteForm.pacienteId} onValueChange={(val) => setAddPacienteForm({ ...addPacienteForm, pacienteId: val })}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Selecione o paciente" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-60">
                                                    {patients.map((p: any) => (
                                                        <SelectItem key={p.id} value={p.id}>
                                                            {p.nome} {p.sobrenome || ''}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Hora Início</Label>
                                                <Input
                                                    type="time"
                                                    value={addPacienteForm.horaInicio}
                                                    onChange={(e) => setAddPacienteForm({ ...addPacienteForm, horaInicio: e.target.value })}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Hora Fim</Label>
                                                <Input
                                                    type="time"
                                                    value={addPacienteForm.horaFim}
                                                    onChange={(e) => setAddPacienteForm({ ...addPacienteForm, horaFim: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Status Inicial</Label>
                                            <Select value={addPacienteForm.status} onValueChange={(val) => setAddPacienteForm({ ...addPacienteForm, status: val })}>
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pendente">Pendente</SelectItem>
                                                    <SelectItem value="atendido">Já Atendido</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setAddPacienteModal(false)} disabled={addingPaciente}>
                                            Cancelar
                                        </Button>
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
                                                    tipo_atendimento: 'sessao_regular'
                                                }).select('id').single();

                                                if (error) throw error;

                                                if (data && addPacienteForm.status !== 'pendente') {
                                                    saveChecks({ ...checkedIds, [data.id]: addPacienteForm.status });
                                                }

                                                toast({ title: 'Paciente adicionado ao dia!' });
                                                setAddPacienteModal(false);
                                                setAddPacienteForm({ pacienteId: '', horaInicio: '08:00', horaFim: '09:00', status: 'pendente' });
                                                queryClient.invalidateQueries({ queryKey: ['crm-agendamentos'] });
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
                                    {/* ── Daily Progress ── */}
                                    <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5">
                                        <CardContent className="p-4">
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
                                                <div className="flex items-center gap-2">
                                                    <ClipboardCheck className="h-5 w-5 text-primary" />
                                                    <h3 className="text-sm font-black">Progresso do Dia</h3>
                                                </div>

                                                {/* Date Navigation */}
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

                                            {/* Progress bar */}
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

                                    {/* ── Daily Checklist ── */}
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between mb-2 px-1 mt-4">
                                            <div className="flex items-center gap-2">
                                                <CalendarDays className="h-4 w-4 text-blue-500" />
                                                <span className="text-sm font-bold">Atendimentos</span>
                                                <span className="text-[10px] text-muted-foreground hidden sm:inline-block ml-2">(Toque no ícone para alterar status)</span>
                                            </div>
                                            <Button
                                                size="sm"
                                                className="h-7 text-xs gap-1 bg-gradient-primary text-white"
                                                onClick={() => setAddPacienteModal(true)}
                                            >
                                                <Plus className="h-3 w-3" /> Adicionar Paciente
                                            </Button>
                                        </div>

                                        {dailyAgs.length > 0 ? dailyAgs.map((ag: any) => {
                                            const status = checkedIds[ag.id] || 'pendente';
                                            const pac = patients.find((p: any) => p.id === ag.paciente_id);
                                            const name = ag.titulo || (pac ? `${pac.nome} ${pac.sobrenome || ''}`.trim() : 'Agendamento');
                                            const hora = format(parseISO(ag.data_inicio), 'HH:mm');
                                            const horaFim = format(parseISO(ag.data_fim), 'HH:mm');

                                            return (
                                                <div key={ag.id} className={`rounded-xl border-2 p-3 transition-all ${(statusStyles as any)[status]}`}>
                                                    <div className="flex items-center gap-3">
                                                        <button onClick={() => cycleStatus(ag.id)} className="shrink-0 p-1.5 rounded-lg hover:bg-muted/50 transition-colors" title="Alternar status">
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
                                /* ── Per-Patient History ── */
                                <Card className="border">
                                    <CardHeader className="pb-3 border-b">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                                            <History className="h-4 w-4 text-primary" /> Histórico do Paciente
                                        </CardTitle>
                                        <p className="text-xs text-muted-foreground mt-1 mb-2">Visão geral de todas as sessões e anotações.</p>
                                        <div className="mt-1">
                                            <select
                                                className="w-full text-sm flex h-9 rounded-md border border-input bg-transparent px-3 py-1 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                value={historicoPatientId}
                                                onChange={(e) => setHistoricoPatientId(e.target.value)}
                                            >
                                                <option value="" disabled>Selecione um paciente...</option>
                                                {patients.map((p: any) => (
                                                    <option key={p.id} value={p.id}>{p.nome} {p.sobrenome}</option>
                                                ))}
                                            </select>
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
                                                .sort((a: any, b: any) => parseISO(b.data_inicio).getTime() - parseISO(a.data_inicio).getTime()); // Newest first

                                            const statsAtendidos = patientAgs.filter((ag: any) => checkedIds[ag.id] === 'atendido').length;
                                            const statsFaltas = patientAgs.filter((ag: any) => checkedIds[ag.id] === 'faltou').length;

                                            return (
                                                <div className="space-y-4">
                                                    {/* Patient Stats */}
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

                                                    {/* Timeline */}
                                                    <div className="relative border-l-2 border-muted ml-3 pl-4 space-y-4 py-2 mt-2">
                                                        {patientAgs.length > 0 ? patientAgs.map((ag: any) => {
                                                            const status = checkedIds[ag.id] || 'pendente';
                                                            const isPast = parseISO(ag.data_inicio).getTime() < new Date().getTime();
                                                            // auto visually mark past un-checked as red (optional)
                                                            // For now we keep the actual state

                                                            return (
                                                                <div key={ag.id} className="relative">
                                                                    {/* Timeline dot */}
                                                                    <div className={`absolute -left-[22px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background ${status === 'atendido' ? 'bg-emerald-500' : status === 'faltou' ? 'bg-red-500' : 'bg-amber-400'}`} />

                                                                    <div className={`p-2 rounded-lg border text-xs ${status === 'atendido' ? 'bg-emerald-50/30 border-emerald-100 dark:border-emerald-900' : status === 'faltou' ? 'bg-red-50/30 border-red-100 dark:border-red-900 opacity-70' : 'bg-card'}`}>
                                                                        <div className="flex justify-between items-start mb-1">
                                                                            <span className="font-bold flex items-center gap-1.5">
                                                                                {format(parseISO(ag.data_inicio), 'dd/MM/yyyy')}
                                                                                <span className="font-normal text-muted-foreground">· {format(parseISO(ag.data_inicio), 'HH:mm')}</span>
                                                                            </span>
                                                                            <button onClick={() => cycleStatus(ag.id)} className="flex items-center gap-1 hover:opacity-80 transition-opacity">
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
                            {/* ── General VIP and Notes sections (Common to both modes) ── */}
                            <Card className="border mt-8">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" /> Pacientes VIP
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-2">
                                    <div className="relative">
                                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                        <Input placeholder="Buscar para marcar VIP..." value={vipSearch} onChange={e => setVipSearch(e.target.value)} className="pl-8 h-8 text-xs" />
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

                            {/* ── General Notes ── */}
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
                })()}
            </div>
        </AppLayout >
    );
}

// ── Helper Components ─────────────────────────────────────────────────

function FunnelStage({ title, icon, count, color, defaultOpen, children }: {
    title: string; icon: React.ReactNode; count: number; color: string; defaultOpen: boolean; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const borderColors: Record<string, string> = { blue: 'border-blue-300', amber: 'border-amber-300', emerald: 'border-emerald-300', red: 'border-red-300' };
    const bgColors: Record<string, string> = { blue: 'bg-blue-50', amber: 'bg-amber-50', emerald: 'bg-emerald-50', red: 'bg-red-50' };
    return (
        <div className={`rounded-xl border-2 overflow-hidden ${borderColors[color] || 'border-border'}`}>
            <button className={`w-full flex items-center justify-between p-3 ${bgColors[color] || ''} text-left`} onClick={() => setOpen(!open)}>
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="font-bold text-sm">{title}</span>
                    <Badge className="text-[10px]">{count}</Badge>
                </div>
                {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
            {open && <div className="p-2 bg-background">{children}</div>}
        </div>
    );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-3">
            <span className="text-xs w-40 font-medium truncate">{label}</span>
            <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${color} transition-all flex items-center justify-end pr-2`} style={{ width: `${Math.max(pct, 8)}%` }}>
                    <span className="text-[10px] text-white font-bold">{value}</span>
                </div>
            </div>
            <span className="text-xs font-bold w-10 text-right">{pct}%</span>
        </div>
    );
}

function MetricCard({ label, value, desc, icon: Icon, color }: { label: string; value: string; desc: string; icon: any; color: string }) {
    const colors: Record<string, string> = { primary: 'text-primary', blue: 'text-blue-600', red: 'text-red-600', emerald: 'text-emerald-600' };
    return (
        <Card className="border">
            <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                    <Icon className={`h-4 w-4 ${colors[color] || ''}`} />
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">{label}</span>
                </div>
                <div className={`text-2xl font-black ${colors[color] || ''}`}>{value}</div>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
            </CardContent>
        </Card>
    );
}

function StatRow({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex items-center justify-between py-1 border-b border-dashed last:border-0">
            <span className="text-xs text-muted-foreground">{label}</span>
            <span className="text-sm font-bold">{value}</span>
        </div>
    );
}

function ActionItem({ icon, text }: { icon: string; text: string }) {
    return (
        <div className="flex items-center gap-2 py-1">
            <span className="text-sm">{icon}</span>
            <span className="text-xs">{text}</span>
        </div>
    );
}
