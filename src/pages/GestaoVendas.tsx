import { useState, useMemo, useCallback, memo } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
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
    ChevronLeft, ChevronRight, History, MessageCircle,
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
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { useMensagensWhatsApp } from '@/hooks/useMensagensWhatsApp';
import FunilConfigPanel from '@/components/funil/FunilConfigPanel';
import { useFunil } from '@/hooks/useFunil';
import { Navigate, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// ── Classificação automática (shared with Pacientes) ──────────────────────
type ClassificacaoTag = 'novo' | 'recorrente' | 'lead' | 'inadimplente' | 'a_pagar';

const CLASSIFICACOES: { key: ClassificacaoTag; label: string; emoji: string; color: string; bgColor: string }[] = [
    { key: 'lead', label: 'Lead', emoji: '🟡', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300' },
    { key: 'novo', label: 'Cliente Novo', emoji: '🟢', color: 'text-emerald-700', bgColor: 'bg-emerald-100 border-emerald-300' },
    { key: 'recorrente', label: 'Recorrente', emoji: '🔵', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300' },
    { key: 'inadimplente', label: 'Inadimplente', emoji: '🔴', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300' },
    { key: 'a_pagar', label: 'A Pagar', emoji: '🟠', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300' },
];

type TabId = 'pipeline' | 'mensagens' | 'notas' | 'servicos' | 'relatorios';

export default function GestaoVendas() {
    const navigate = useNavigate();
    const [filterTag, setFilterTag] = useState<ClassificacaoTag | 'todos'>('todos');
    const [fabOpen, setFabOpen] = useState(false);
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
    const [paymentModal, setPaymentModal] = useState<{ open: boolean; patientId: string; agendamentoId?: string; valor: string; data: string; sessaoId?: string }>({
        open: false, patientId: '', valor: '0', data: format(new Date(), 'yyyy-MM-dd')
    });

    // Attendance specific state
    const [currentDate, setCurrentDate] = useState<Date>(new Date());
    const [controleTabModo, setControleTabModo] = useState<'diario' | 'historico'>('diario');
    const [historicoPatientId, setHistoricoPatientId] = useState<string>('');
    const queryClient = useQueryClient();
    const { logMensagem, conversas, mensagens } = useMensagensWhatsApp();
    const { config: funilConfig } = useFunil();

    // Modal de Adição Diária
    const [addPacienteModal, setAddPacienteModal] = useState(false);
    const [addingPaciente, setAddingPaciente] = useState(false);
    const [addPacienteForm, setAddPacienteForm] = useState({
        pacienteId: '',
        horaInicio: '08:00',
        horaFim: '09:00',
        status: 'pendente'
    });

    // Persisted VIP list and notes (localStorage)
    const storageKey = user?.id ? `crm-notas-${user.id}` : 'crm-notas';
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const [vipIds, setVipIds] = useState<string[]>(() => {
        try { return JSON.parse(localStorage.getItem(`${storageKey}-vip`) || '[]'); } catch { return []; }
    });
    const [notes, setNotes] = useState<{ id: string; text: string; createdAt: string }[]>(() => {
        try { return JSON.parse(localStorage.getItem(`${storageKey}-notes`) || '[]'); } catch { return []; }
    });
    // Per-patient quick notes linked to appointments
    const [patientNotes, setPatientNotes] = useState<Record<string, string>>(() => {
        try { return JSON.parse(localStorage.getItem(`${storageKey}-pnotes-all`) || '{}'); } catch { return {}; }
    });
    const saveVip = (ids: string[]) => { setVipIds(ids); localStorage.setItem(`${storageKey}-vip`, JSON.stringify(ids)); };
    const saveNotes = (n: typeof notes) => { setNotes(n); localStorage.setItem(`${storageKey}-notes`, JSON.stringify(n)); };
    const savePatientNotes = (pn: Record<string, string>) => { setPatientNotes(pn); localStorage.setItem(`${storageKey}-pnotes-all`, JSON.stringify(pn)); };

    // ── Queries ──────────────────────────────────────────────────────
    const { data: patients = [] } = useQuery({
        queryKey: ['crm-patients', user?.id],
        queryFn: async () => {
            const { data } = await supabase.from('pacientes').select('*').eq('terapeuta_id', user!.id).eq('ativo', true).order('nome');
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

    // ── Mutations ──────────────────────────────────────────────────
    const upsertSessao = useMutation({
        mutationFn: async (sessao: any) => {
            const { data: existing, error: selectError } = await supabase
                .from('controle_sessoes')
                .select('id, valor_cobrado, forma_pagamento, observacoes, numero_sessao, duracao_minutos, tipo_atendimento')
                .eq('agendamento_id', sessao.agendamento_id)
                .maybeSingle();

            if (selectError) throw selectError;

            if (existing?.id) {
                const { error } = await supabase
                    .from('controle_sessoes')
                    .update({
                        ...sessao,
                        terapeuta_id: user!.id,
                        valor_cobrado: sessao.valor_cobrado ?? existing.valor_cobrado ?? 0,
                        forma_pagamento: sessao.forma_pagamento ?? existing.forma_pagamento ?? null,
                        observacoes: sessao.observacoes ?? existing.observacoes ?? null,
                        numero_sessao: sessao.numero_sessao ?? existing.numero_sessao ?? 1,
                        duracao_minutos: sessao.duracao_minutos ?? existing.duracao_minutos ?? 45,
                        tipo_atendimento: sessao.tipo_atendimento ?? existing.tipo_atendimento ?? 'retorno',
                    })
                    .eq('id', existing.id);
                if (error) throw error;
                return;
            }

            const { error } = await supabase.from('controle_sessoes').insert({
                ...sessao,
                terapeuta_id: user!.id,
                valor_cobrado: sessao.valor_cobrado ?? 0,
                numero_sessao: sessao.numero_sessao ?? 1,
                duracao_minutos: sessao.duracao_minutos ?? 45,
                tipo_atendimento: sessao.tipo_atendimento ?? 'retorno',
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-sessoes'] });
        }
    });

    const deleteSessao = useMutation({
        mutationFn: async (agendamentoId: string) => {
            const { error } = await supabase.from('controle_sessoes').delete().eq('agendamento_id', agendamentoId);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['crm-sessoes'] });
        }
    });

    const attendanceStatusByAgendamento = useMemo(() => {
        const statusMap: Record<string, 'pendente' | 'atendido' | 'faltou'> = {};

        sessoes.forEach((sessao: any) => {
            if (!sessao.agendamento_id) return;

            statusMap[sessao.agendamento_id] = sessao.status === 'realizada'
                ? 'atendido'
                : sessao.status === 'falta' || sessao.status === 'faltou'
                    ? 'faltou'
                    : 'pendente';
        });

        return statusMap;
    }, [sessoes]);

    const getAttendanceStatus = (agendamentoId: string) => attendanceStatusByAgendamento[agendamentoId] || 'pendente';

    // ── Classificação automática dos pacientes ──────────────────────
    const getClassificacao = useMemo(() => {
        const avaliadosSet = new Set(avaliacoes.map((a: any) => a.paciente_id));
        const myidConcluidosSet = new Set(myidAvaliacoes.filter((m: any) => m.status === 'concluido').map((m: any) => m.paciente_id));

        const sessoesPorPaciente: Record<string, any[]> = {};
        sessoes.forEach((s: any) => {
            if (!sessoesPorPaciente[s.paciente_id]) sessoesPorPaciente[s.paciente_id] = [];
            sessoesPorPaciente[s.paciente_id].push(s);
        });

        return (pid: string, createdAt: string): ClassificacaoTag => {
            const pSessoes = sessoesPorPaciente[pid] || [];
            const hasAvaliacao = avaliadosSet.has(pid) || myidConcluidosSet.has(pid);
            const totalSessoes = pSessoes.length;

            const sessoesNaoPagas = pSessoes.filter(
                (s: any) => s.status === 'realizada' && (!s.valor_cobrado || Number(s.valor_cobrado) === 0)
                    && differenceInDays(new Date(), new Date(s.data_sessao)) > 30
            );
            if (sessoesNaoPagas.length > 0) return 'inadimplente';

            const sessoesAPagar = pSessoes.filter(
                (s: any) => s.status === 'realizada' && (!s.valor_cobrado || Number(s.valor_cobrado) === 0)
                    && differenceInDays(new Date(), new Date(s.data_sessao)) <= 30
            );
            if (sessoesAPagar.length > 0) return 'a_pagar';

            if (totalSessoes >= 3) return 'recorrente';

            const diasCadastro = differenceInDays(new Date(), new Date(createdAt));
            if (diasCadastro <= 60 && (hasAvaliacao || totalSessoes > 0)) return 'novo';

            return 'lead';
        };
    }, [sessoes, avaliacoes, myidAvaliacoes]);

    // Classification counts
    const classificationCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        CLASSIFICACOES.forEach(c => counts[c.key] = 0);
        patients.forEach((p: any) => {
            const tag = getClassificacao(p.id, p.created_at);
            counts[tag] = (counts[tag] || 0) + 1;
        });
        return counts;
    }, [patients, getClassificacao]);


    // ── Computed metrics (memoized) ─────────────────────────────────
    const computedMetrics = useMemo(() => {
        const totalPacientes = patients.length;
        const linksPendentes = pendingLinks.length;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const sessoesMes = agendamentos.filter((a: any) => a.status === 'confirmado').length;
        const avaliacoesMes = avaliacoes.filter((a: any) => new Date(a.created_at) >= startOfMonth).length;

        const pacientesComAvaliacao = new Set(avaliacoes.map((a: any) => a.paciente_id));
        const pacientesComMyID = new Set(myidAvaliacoes.filter((m: any) => m.status === 'concluido').map((m: any) => m.paciente_id));
        const leads = patients.filter((p: any) => !pacientesComAvaliacao.has(p.id) && !pacientesComMyID.has(p.id));
        const avaliados = patients.filter((p: any) => pacientesComAvaliacao.has(p.id) || pacientesComMyID.has(p.id));

        const pacientesComSessaoRecente = new Set(agendamentos.map((a: any) => a.paciente_id));
        const inativos = avaliados.filter((p: any) => !pacientesComSessaoRecente.has(p.id));

        const taxaConversao = totalPacientes > 0 ? Math.round((avaliados.length / totalPacientes) * 100) : 0;

        const receitaMes = sessoes
            .filter((s: any) => new Date(s.data_sessao) >= startOfMonth && s.status === 'realizada')
            .reduce((acc: number, s: any) => acc + (Number(s.valor_cobrado) || 0), 0);

        const agendamentosMes = agendamentos.filter((a: any) => new Date(a.data_inicio) >= startOfMonth);
        const faltasMes = agendamentosMes.filter((a: any) => a.status === 'faltou').length;
        const taxaFaltas = agendamentosMes.length > 0 ? Math.round((faltasMes / agendamentosMes.length) * 100) : 0;

        const aniversariantes = patients.filter((p: any) => {
            if (!p.data_nascimento) return false;
            const nascimento = new Date(p.data_nascimento);
            const anivEsteAno = new Date(now.getFullYear(), nascimento.getMonth(), nascimento.getDate());
            if (anivEsteAno < now) anivEsteAno.setFullYear(now.getFullYear() + 1);
            return differenceInCalendarDays(anivEsteAno, now) <= 30 && differenceInCalendarDays(anivEsteAno, now) >= 0;
        }).sort((a: any, b: any) => {
            const dA = new Date(a.data_nascimento);
            const dB = new Date(b.data_nascimento);
            const anivA = new Date(now.getFullYear(), dA.getMonth(), dA.getDate());
            const anivB = new Date(now.getFullYear(), dB.getMonth(), dB.getDate());
            if (anivA < now) anivA.setFullYear(now.getFullYear() + 1);
            if (anivB < now) anivB.setFullYear(now.getFullYear() + 1);
            return anivA.getTime() - anivB.getTime();
        });

        return {
            totalPacientes, linksPendentes, now, sessoesMes, avaliacoesMes,
            leads, avaliados, inativos, taxaConversao, receitaMes,
            faltasMes, taxaFaltas, aniversariantes,
        };
    }, [patients, pendingLinks, agendamentos, avaliacoes, myidAvaliacoes, sessoes]);

    const {
        totalPacientes, linksPendentes, now, sessoesMes, avaliacoesMes,
        leads, avaliados, inativos, taxaConversao, receitaMes,
        faltasMes, taxaFaltas, aniversariantes,
    } = computedMetrics;

    if (!authLoading && !user) return <Navigate to="/auth" replace />;

    const sendToPatient = async (patientId: string, callback: (name: string, phone: string) => Promise<{ success: boolean, error?: string }>, templateId: string = 'acao-rapida') => {
        const p = patients.find((pat: any) => pat.id === patientId);
        if (!p?.telefone) { toast({ title: 'Paciente sem telefone', variant: 'destructive' }); return; }

        toast({ title: 'Abrindo o WhatsApp...', description: 'Aguarde um momento.' });

        try {
            const result = await callback(`${p.nome} ${p.sobrenome || ''}`.trim(), p.telefone);
            if (result.success) {
                toast({ title: '✅ WhatsApp Aberto!', description: `Mensagem pronta para enviar para ${p.nome}.` });
                logMensagem.mutate({ paciente_id: patientId, mensagem: `[Ação Rápida de Funil] → ${templateId}`, tipo: 'template', template_id: templateId });
            } else {
                toast({ title: 'Erro ao Enviar', description: result.error || 'Falha na comunicação', variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Erro Crítico', description: err.message || 'Erro inesperado', variant: 'destructive' });
        }
    };

    const handleRelembrar = async (link: any) => {
        const pac = link.pacientes;
        if (!pac?.telefone) { toast({ title: 'Paciente sem telefone', variant: 'destructive' }); return; }
        const tel = pac.telefone;
        const msg =
            `Olá ${pac.nome}! 👋\n\nNotei que ainda não preencheu o questionário que enviei. ` +
            `É bem rápido e super importante para o seu tratamento personalizado.\n\n` +
            `Pode preencher quando tiver um tempinho? O link ainda está ativo! 😊`;

        toast({ title: 'Enviando lembrete...', description: 'Aguarde um momento.' });
        try {
            const result = await shareViaWhatsApp(tel, msg);
            if (result.success) {
                toast({ title: '✅ Lembrete aberto no WhatsApp!' });
                logMensagem.mutate({ paciente_id: pac.id, mensagem: msg, tipo: 'template', template_id: 'lembrete-questionario' });
            } else {
                toast({ title: 'Erro ao Enviar', description: result.error, variant: 'destructive' });
            }
        } catch (err: any) {
            toast({ title: 'Erro Crítico', description: err.message, variant: 'destructive' });
        }
    };

    const handleSendPacote = (pacote: Pacote) => {
        if (!selectedPatient?.telefone) { toast({ title: 'Selecione um paciente com telefone', variant: 'destructive' }); return; }
        const details = pacote.diferenciais.map(d => `✅ ${d}`).join('\n');
        const valor = customValue || `R$ ${pacote.valorSugerido}`;
        sharePacoteInfo(`${selectedPatient.nome} ${selectedPatient.sobrenome || ''}`, selectedPatient.telefone, pacote.nome, details, valor);
        logMensagem.mutate({ paciente_id: selectedPatient.id, mensagem: `[Proposta de Pacote] 📦 ${pacote.nome} - Valor sugerido: ${valor}`, tipo: 'template', template_id: 'proposta-pacote' });
        toast({ title: '📩 Pacote aberto no WhatsApp!' });
    };

    // ── Tabs ─────────────────────────────────────────────────────────
    const TABS: { id: TabId; label: string; icon: any; desc: string }[] = [
        { id: 'pipeline', label: 'Pacientes', icon: Users, desc: 'Veja todos os pacientes e seus status' },
        { id: 'mensagens', label: 'WhatsApp', icon: MessageCircle, desc: 'Envie mensagens e veja o histórico' },
        { id: 'notas', label: 'Controle', icon: ClipboardCheck, desc: 'Checklist diário de atendimentos' },
        { id: 'servicos', label: 'Serviços', icon: Package, desc: 'Gerencie serviços, valores e pagamentos' },
        { id: 'relatorios', label: 'Relatórios', icon: BarChart3, desc: 'Métricas e desempenho' },
    ];

    return (
        <AppLayout title="Gestão & CRM">
            <div className="space-y-6">
                {/* ── KPI Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
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
                    <Card className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white border-none">
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className="p-2 bg-white/20 rounded-lg"><DollarSign className="h-5 w-5" /></div>
                            <div><p className="text-[10px] opacity-80 uppercase font-bold">Receita/Mês</p><h3 className="text-xl font-black">R$ {receitaMes.toLocaleString('pt-BR')}</h3></div>
                        </CardContent>
                    </Card>
                    <Card className={`border ${taxaFaltas > 15 ? 'bg-gradient-to-br from-red-500 to-red-600 text-white border-none' : 'bg-card'}`}>
                        <CardContent className="p-3 flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${taxaFaltas > 15 ? 'bg-white/20' : 'bg-muted text-muted-foreground'}`}><XCircle className="h-5 w-5" /></div>
                            <div><p className={`text-[10px] uppercase font-bold ${taxaFaltas > 15 ? 'opacity-80' : 'text-muted-foreground'}`}>Faltas/Mês</p><h3 className="text-2xl font-black">{taxaFaltas}%</h3></div>
                        </CardContent>
                    </Card>
                </div>

                {/* Aniversariantes */}
                {aniversariantes.length > 0 && (
                    <Card className="border border-pink-200 bg-gradient-to-r from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Gift className="h-4 w-4 text-pink-500" />
                                <span className="text-sm font-bold text-pink-700 dark:text-pink-300">🎂 Aniversariantes Próximos</span>
                            </div>
                            <div className="flex gap-3 overflow-x-auto pb-1">
                                {aniversariantes.slice(0, 6).map((p: any) => {
                                    const nascimento = new Date(p.data_nascimento);
                                    const anivEsteAno = new Date(now.getFullYear(), nascimento.getMonth(), nascimento.getDate());
                                    if (anivEsteAno < now) anivEsteAno.setFullYear(now.getFullYear() + 1);
                                    const diasAte = differenceInCalendarDays(anivEsteAno, now);
                                    const isHoje = diasAte === 0;
                                    return (
                                        <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border shrink-0 ${isHoje ? 'bg-pink-100 border-pink-300 dark:bg-pink-900/30' : 'bg-white/80 dark:bg-card border-border'}`}>
                                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${isHoje ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-700'}`}>
                                                {p.nome?.[0]}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold">{p.nome} {p.sobrenome}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {isHoje ? '🎉 Hoje!' : `em ${diasAte} dia${diasAte > 1 ? 's' : ''}`} · {format(nascimento, 'dd/MM')}
                                                </p>
                                            </div>
                                            {p.telefone && (
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-pink-500 hover:text-pink-700 shrink-0"
                                                    onClick={() => sendToPatient(p.id, (n, ph) => shareAniversario(n, ph), 'aniversario')}>
                                                    <Send className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ── Tab Selector ── */}
                <div className="flex gap-1 bg-muted/50 p-1 rounded-xl overflow-x-auto">
                    {TABS.map(tab => (
                        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                            className={`flex-1 flex flex-col items-center justify-center gap-0.5 px-3 py-2.5 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
                            <tab.icon className="h-4 w-4" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* ── Classification Filter Chips ── */}
                <div className="flex flex-wrap gap-2">
                    <button
                        onClick={() => setFilterTag('todos')}
                        className={cn(
                            'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                            filterTag === 'todos' ? 'bg-foreground text-background border-foreground' : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                        )}
                    >
                        Todos ({patients.length})
                    </button>
                    {CLASSIFICACOES.map(c => (
                        <button
                            key={c.key}
                            onClick={() => setFilterTag(filterTag === c.key ? 'todos' : c.key)}
                            className={cn(
                                'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                filterTag === c.key ? cn(c.bgColor, c.color) : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                            )}
                        >
                            {c.emoji} {c.label} ({classificationCounts[c.key] || 0})
                        </button>
                    ))}
                </div>

                {/* ══════════════════ PIPELINE TAB ══════════════════ */}
                {activeTab === 'pipeline' && (() => {
                    // Filter patients by tag if selected
                    const filteredPatients = filterTag === 'todos' ? patients : patients.filter((p: any) => getClassificacao(p.id, p.created_at) === filterTag);
                    const filteredLeads = leads.filter((p: any) => filterTag === 'todos' || getClassificacao(p.id, p.created_at) === filterTag);
                    const filteredAvaliados = avaliados.filter((p: any) => filterTag === 'todos' || getClassificacao(p.id, p.created_at) === filterTag);
                    const filteredInativos = inativos.filter((p: any) => filterTag === 'todos' || getClassificacao(p.id, p.created_at) === filterTag);

                    // Inadimplentes e A Pagar
                    const inadimplentes = patients.filter((p: any) => getClassificacao(p.id, p.created_at) === 'inadimplente');
                    const aPagar = patients.filter((p: any) => getClassificacao(p.id, p.created_at) === 'a_pagar');

                    const renderPatientRow = (p: any, actions: React.ReactNode) => {
                        const tag = getClassificacao(p.id, p.created_at);
                        const tagCfg = CLASSIFICACOES.find(c => c.key === tag)!;
                        const patientMsgs = mensagens.filter((m: any) => m.paciente_id === p.id);
                        const lastMsg = patientMsgs.length > 0 ? patientMsgs[0] : null;
                        return (
                            <div key={p.id} className="flex flex-col p-2.5 rounded-lg hover:bg-muted/30 transition-colors gap-1.5">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">{p.nome?.[0]}</div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-sm font-medium">{p.nome} {p.sobrenome}</span>
                                                <Badge variant="outline" className={cn('text-[9px] h-4 border', tagCfg.bgColor, tagCfg.color)}>{tagCfg.emoji} {tagCfg.label}</Badge>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">{p.telefone || 'Sem telefone'}</div>
                                        </div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        {p.telefone && (
                                            <Button size="sm" variant="default" className="h-7 text-[10px] gap-1 bg-[#25D366] hover:bg-[#20BE5C] text-white"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    const msg = encodeURIComponent(`Olá ${p.nome}! 👋\n\n`);
                                                    window.open(`https://wa.me/55${p.telefone.replace(/\D/g, '')}?text=${msg}`, '_blank');
                                                }}>
                                                <MessageCircle className="h-3 w-3" /> Chamar
                                            </Button>
                                        )}
                                        {actions}
                                    </div>
                                </div>
                                {lastMsg && (
                                    <div className="ml-9 flex items-center gap-1.5 text-[10px] text-muted-foreground bg-muted/30 px-2 py-1 rounded-md">
                                        <MessageCircle className="h-3 w-3 text-[#25D366] shrink-0" />
                                        <span className="truncate flex-1">{lastMsg.mensagem.substring(0, 60)}{lastMsg.mensagem.length > 60 ? '...' : ''}</span>
                                        <span className="shrink-0 font-medium">{format(new Date(lastMsg.created_at), 'dd/MM')}</span>
                                        {patientMsgs.length > 1 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{patientMsgs.length}</Badge>}
                                    </div>
                                )}
                            </div>
                        );
                    };

                    return (
                        <div className="space-y-4">
                            {/* Leads */}
                            <FunnelStage title="Leads (Sem Avaliação)" icon={<UserPlus className="h-4 w-4 text-blue-600" />} count={filteredLeads.length} color="blue" defaultOpen={filteredLeads.length > 0}>
                                {filteredLeads.length === 0 ? <p className="text-xs text-muted-foreground italic p-3">Todos os pacientes já iniciaram avaliação 🎉</p> : (
                                    filteredLeads.map((p: any) => (
                                        renderPatientRow(p, 
                                            p.telefone ? (
                                                <>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-blue-600"
                                                        onClick={() => sendToPatient(p.id, (n, ph) => shareBoasVindas(n, ph, user?.user_metadata?.nome || 'Terapeuta'), 'boas-vindas')}>
                                                        <Send className="h-3 w-3" /> Boas-vindas
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
                                                        onClick={() => window.open(`https://wa.me/55${p.telefone.replace(/\D/g, '')}`, '_blank')}>
                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            ) : null
                                        )
                                    ))
                                )}
                            </FunnelStage>

                            {/* Questionário Pendente */}
                            <FunnelStage title="Questionário Pendente" icon={<Clock className="h-4 w-4 text-amber-600" />} count={pendingLinks.length} color="amber" defaultOpen={pendingLinks.length > 0}>
                                {pendingLinks.length === 0 ? <p className="text-xs text-muted-foreground italic p-3">Nenhum pendente 🎉</p> : (
                                    pendingLinks.map((link: any) => {
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
                                                <div className="flex gap-1">
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-amber-600" onClick={() => handleRelembrar(link)}>
                                                        <MessageSquare className="h-3 w-3" /> Relembrar
                                                    </Button>
                                                    {link.pacientes?.telefone && (
                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
                                                            onClick={() => window.open(`https://wa.me/55${link.pacientes.telefone.replace(/\D/g, '')}`, '_blank')}>
                                                            <MessageCircle className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </FunnelStage>

                            {/* Inadimplentes 🔴 */}
                            {inadimplentes.length > 0 && (
                                <FunnelStage title="Inadimplentes (>30 dias)" icon={<AlertCircle className="h-4 w-4 text-red-600" />} count={inadimplentes.length} color="red" defaultOpen={true}>
                                    {inadimplentes.map((p: any) => (
                                        renderPatientRow(p, 
                                            p.telefone ? (
                                                <>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-red-600"
                                                        onClick={() => sendToPatient(p.id, (n, ph) => shareViaWhatsApp(ph, `Olá ${n}! 👋\n\nIdentificamos uma pendência financeira em sua conta. Podemos conversar sobre a regularização? Estamos à disposição para facilitar! 😊`), 'cobranca-inadimplente')}>
                                                        <DollarSign className="h-3 w-3" /> Cobrar
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-emerald-600"
                                                        onClick={() => {
                                                            const pessao = (sessoes as any[]).find((s: any) => s.paciente_id === p.id && s.status === 'realizada' && (!s.valor_cobrado || Number(s.valor_cobrado) === 0));
                                                            setPaymentModal({
                                                                open: true,
                                                                patientId: p.id,
                                                                sessaoId: pessao?.id,
                                                                agendamentoId: pessao?.agendamento_id,
                                                                valor: '0',
                                                                data: pessao ? format(new Date(pessao.data_sessao), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
                                                            });
                                                        }}>
                                                        <CheckCircle2 className="h-3 w-3" /> Baixar
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
                                                        onClick={() => window.open(`https://wa.me/55${p.telefone.replace(/\D/g, '')}`, '_blank')}>
                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            ) : null
                                        )
                                    ))}
                                </FunnelStage>
                            )}

                            {/* A Pagar 🟠 */}
                            {aPagar.length > 0 && (
                                <FunnelStage title="A Pagar (Débito Recente)" icon={<DollarSign className="h-4 w-4 text-orange-600" />} count={aPagar.length} color="amber" defaultOpen={true}>
                                    {aPagar.map((p: any) => (
                                        renderPatientRow(p, 
                                            p.telefone ? (
                                                <>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-orange-600"
                                                        onClick={() => sendToPatient(p.id, (n, ph) => shareViaWhatsApp(ph, `Olá ${n}! 👋\n\nLembrete gentil sobre o pagamento da sua última sessão. Qualquer dúvida estou à disposição! 😊`), 'lembrete-pagamento')}>
                                                        <DollarSign className="h-3 w-3" /> Lembrar
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-emerald-600"
                                                        onClick={() => {
                                                            const pessao = (sessoes as any[]).find((s: any) => s.paciente_id === p.id && s.status === 'realizada' && (!s.valor_cobrado || Number(s.valor_cobrado) === 0));
                                                            setPaymentModal({
                                                                open: true,
                                                                patientId: p.id,
                                                                sessaoId: pessao?.id,
                                                                agendamentoId: pessao?.agendamento_id,
                                                                valor: '0',
                                                                data: pessao ? format(new Date(pessao.data_sessao), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
                                                            });
                                                        }}>
                                                        <CheckCircle2 className="h-3 w-3" /> Baixar
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
                                                        onClick={() => window.open(`https://wa.me/55${p.telefone.replace(/\D/g, '')}`, '_blank')}>
                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            ) : null
                                        )
                                    ))}
                                </FunnelStage>
                            )}

                            {/* Avaliados (Ativos) */}
                            <FunnelStage title="Avaliados (Ativos)" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} count={filteredAvaliados.filter(p => !inativos.includes(p)).length} color="emerald" defaultOpen={false}>
                                {filteredAvaliados.filter(p => !inativos.includes(p)).map((p: any) => (
                                    renderPatientRow(p, 
                                        p.telefone ? (
                                            <>
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1"
                                                    onClick={() => sendToPatient(p.id, (n, ph) => sharePosAvaliacao(n, ph, '📊 Seus resultados estão prontos!'), 'pos-avaliacao')}>
                                                    <FileText className="h-3 w-3" /> Pós-Avaliação
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-green-600"
                                                    onClick={() => sendToPatient(p.id, (n, ph) => sharePropostaComercial(n, ph, 'Método Identidade', 'consulte'), 'proposta-comercial')}>
                                                    <Package className="h-3 w-3" /> Proposta
                                                </Button>
                                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
                                                    onClick={() => window.open(`https://wa.me/55${p.telefone.replace(/\D/g, '')}`, '_blank')}>
                                                    <MessageCircle className="h-3.5 w-3.5" />
                                                </Button>
                                            </>
                                        ) : null
                                    )
                                ))}
                            </FunnelStage>

                            {/* Follow-up Necessário */}
                            <FunnelStage title="Follow-up Necessário" icon={<AlertCircle className="h-4 w-4 text-red-600" />} count={filteredInativos.length} color="red" defaultOpen={filteredInativos.length > 0}>
                                {filteredInativos.length === 0 ? <p className="text-xs text-muted-foreground italic p-3">Todos os pacientes estão em dia! 🎉</p> : (
                                    filteredInativos.map((p: any) => (
                                        renderPatientRow(p, 
                                            p.telefone ? (
                                                <>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-amber-600"
                                                        onClick={() => sendToPatient(p.id, (n, ph) => shareLembreteRetorno(n, ph, 'em breve'), 'lembrete-retorno')}>
                                                        <CalendarDays className="h-3 w-3" /> Retorno
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-red-600"
                                                        onClick={() => sendToPatient(p.id, (n, ph) => sharePosAlta(n, ph), 'pos-alta')}>
                                                        <Heart className="h-3 w-3" /> Pós-Alta
                                                    </Button>
                                                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600"
                                                        onClick={() => window.open(`https://wa.me/55${p.telefone.replace(/\D/g, '')}`, '_blank')}>
                                                        <MessageCircle className="h-3.5 w-3.5" />
                                                    </Button>
                                                </>
                                            ) : null
                                        )
                                    ))
                                )}
                            </FunnelStage>

                            {/* Modal de Pagamento */}
                            <Dialog open={paymentModal.open} onOpenChange={o => setPaymentModal(prev => ({ ...prev, open: o }))}>
                                <DialogContent className="sm:max-w-[400px]">
                                    <DialogHeader>
                                        <DialogTitle>Registrar Pagamento</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        {/* Quick-select from configured services */}
                                        {funilConfig?.servicos && funilConfig.servicos.length > 0 && (
                                            <div className="space-y-2">
                                                <Label className="text-xs text-muted-foreground">Selecionar Serviço</Label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {funilConfig.servicos.map((s, i) => (
                                                        <button
                                                            key={i}
                                                            onClick={() => setPaymentModal(prev => ({ ...prev, valor: String(s.valor) }))}
                                                            className={cn(
                                                                'flex items-center justify-between p-3 rounded-xl border text-left transition-all',
                                                                Number(paymentModal.valor) === s.valor
                                                                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                                                    : 'border-border hover:border-primary/50 hover:bg-primary/5'
                                                            )}
                                                        >
                                                            <div>
                                                                <p className="text-sm font-semibold">{s.nome}</p>
                                                                {s.descricao && <p className="text-[10px] text-muted-foreground">{s.descricao}</p>}
                                                            </div>
                                                            <span className="text-sm font-bold text-primary">
                                                                R$ {s.valor.toFixed(2).replace('.', ',')}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        <div className="space-y-2">
                                            <Label>Valor Recebido (R$)</Label>
                                            <Input
                                                type="number"
                                                value={paymentModal.valor}
                                                onChange={e => setPaymentModal(prev => ({ ...prev, valor: e.target.value }))}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Data do Pagamento</Label>
                                            <Input
                                                type="date"
                                                value={paymentModal.data}
                                                onChange={e => setPaymentModal(prev => ({ ...prev, data: e.target.value }))}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setPaymentModal(prev => ({ ...prev, open: false }))}>Cancelar</Button>
                                        <Button
                                            className="bg-gradient-primary text-white"
                                            disabled={upsertSessao.isPending}
                                            onClick={() => {
                                                upsertSessao.mutate({
                                                    id: paymentModal.sessaoId,
                                                    paciente_id: paymentModal.patientId,
                                                    agendamento_id: paymentModal.agendamentoId,
                                                    valor_cobrado: Number(paymentModal.valor),
                                                    data_sessao: paymentModal.data,
                                                    status: 'realizada'
                                                });
                                                setPaymentModal(prev => ({ ...prev, open: false }));
                                                toast({ title: '✅ Pagamento registrado!' });
                                            }}
                                        >
                                            Confirmar Pagamento
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    );
                })()}

                {/* ══════════════════ MENSAGENS TAB ══════════════════ */}
                {activeTab === 'mensagens' && (
                    <div className="space-y-4">
                    <Card className="border overflow-hidden h-[500px] flex flex-col md:flex-row">
                        {/* Sidebar (Left) */}
                        <div className="w-full md:w-1/3 bg-muted/20 border-r flex flex-col">
                            <div className="p-3 border-b flex-shrink-0 bg-card">
                                <h3 className="font-bold text-sm mb-2 flex items-center gap-2">
                                    <MessageSquare className="h-4 w-4 text-primary" /> Conversas Recentes
                                </h3>
                                <Select value={selectedPatient?.id || ''} onValueChange={(val) => setSelectedPatient(patients.find((p: any) => p.id === val) || null)}>
                                    <SelectTrigger className="w-full text-xs h-8">
                                        <SelectValue placeholder="Iniciar nova conversa..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {patients.map((p: any) => (
                                            <SelectItem key={p.id} value={p.id}>{p.nome} {p.sobrenome}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                                {conversas.length === 0 && <p className="text-xs text-muted-foreground p-2 text-center mt-4">Nenhuma conversa registrada.</p>}
                                {conversas.map((conv: any) => {
                                    const pac = patients.find((p: any) => p.id === conv.paciente_id);
                                    if (!pac) return null;
                                    const isSel = selectedPatient?.id === pac.id;
                                    return (
                                        <button key={conv.paciente_id} onClick={() => setSelectedPatient(pac)}
                                            className={`w-full text-left p-2 rounded-lg transition-colors flex items-center gap-3 ${isSel ? 'bg-primary/10 border-primary/20 shadow-sm' : 'hover:bg-muted/50'}`}>
                                            <div className="h-9 w-9 shrink-0 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-bold text-xs shadow-sm">
                                                {pac.nome[0]}{pac.sobrenome?.[0] || ''}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-0.5">
                                                    <span className="font-bold text-xs truncate">{pac.nome} {pac.sobrenome}</span>
                                                    <span className="text-[9px] text-muted-foreground">{format(new Date(conv.lastDate), 'dd/MM')}</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground truncate opacity-80">{conv.lastMessage}</p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Chat Area (Right) */}
                        <div className="flex-1 flex flex-col bg-card relative">
                            {!selectedPatient ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 bg-muted/5">
                                    <MessageSquare className="h-12 w-12 mb-3 text-muted-foreground/30" />
                                    <p className="text-sm font-bold">Selecione uma conversa</p>
                                    <p className="text-[10px] mt-1">O histórico de envios locais aparecerá aqui.</p>
                                </div>
                            ) : (
                                <>
                                    {/* Chat Header */}
                                    <div className="p-3 border-b bg-card flex items-center justify-between shadow-sm z-10 w-full">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 shrink-0 bg-gradient-to-br from-primary to-primary/80 rounded-full flex items-center justify-center text-primary-foreground font-bold text-sm shadow-sm">
                                                {selectedPatient.nome[0]}{selectedPatient.sobrenome?.[0] || ''}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-sm">{selectedPatient.nome} {selectedPatient.sobrenome}</h3>
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    {selectedPatient.telefone ? (
                                                        <><Phone className="h-2.5 w-2.5" /> {selectedPatient.telefone}</>
                                                    ) : (
                                                        <><AlertCircle className="h-2.5 w-2.5 text-destructive" /> Sem telefone cadastrado</>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" className="h-8 gap-1 text-[11px] bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366] hover:text-white border-[#25D366]/30 transition-colors"
                                            onClick={() => window.open(`https://wa.me/55${selectedPatient.telefone?.replace(/\D/g, '')}`, '_blank')}
                                            disabled={!selectedPatient.telefone}>
                                            <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp Web
                                        </Button>
                                    </div>

                                    {/* Message History */}
                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')] bg-repeat opacity-[0.97] dark:opacity-20 flex flex-col-reverse relative">
                                        <div className="absolute inset-0 bg-background/80 pointer-events-none z-0" />
                                        <div className="z-10 flex flex-col space-y-4">
                                            {(() => {
                                                const msgs = mensagens.filter((m: any) => m.paciente_id === selectedPatient.id).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                                                if (msgs.length === 0) {
                                                    return (
                                                        <div className="bg-yellow-100/80 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 text-[10px] p-2 rounded-lg text-center mx-auto max-w-[80%] shadow-sm my-4">
                                                            Nenhuma mensagem registrada. <br />
                                                            Mensagens enviadas por este painel aparecerão aqui.
                                                        </div>
                                                    );
                                                }
                                                return msgs.map((msg: any) => (
                                                    <div key={msg.id} className="flex flex-col items-end animate-slide-in">
                                                        <div className="bg-[#dcf8c6] dark:bg-primary/20 border border-[#dcf8c6]/50 dark:border-primary/30 text-[#303030] dark:text-foreground p-2.5 px-3 rounded-2xl rounded-tr-sm max-w-[85%] text-[11px] shadow-sm whitespace-pre-wrap leading-relaxed">
                                                            {msg.mensagem}
                                                        </div>
                                                        <span className="text-[9px] text-muted-foreground mt-1 mr-1 flex items-center gap-1 font-medium bg-background/50 px-1 rounded-sm">
                                                            {format(new Date(msg.created_at), "dd/MM 'às' HH:mm")}
                                                            <CheckCircle2 className="h-2.5 w-2.5 text-[#53bdeb] drop-shadow-sm" />
                                                        </span>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </div>

                                    {/* Input Area */}
                                    <div className="p-3 border-t bg-card/95 backdrop-blur z-10 w-full shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
                                        <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted">
                                            {MESSAGE_TEMPLATES.map(tpl => (
                                                <Badge key={tpl.id} variant="secondary" className="text-[9px] cursor-pointer whitespace-nowrap hover:bg-primary/10 border-primary/10 transition-colors shrink-0 py-1"
                                                    onClick={() => {
                                                        const m = tpl.defaultMessage
                                                            .replace('{nome}', `${selectedPatient.nome} ${selectedPatient.sobrenome || ''}`.trim())
                                                            .replace('{terapeuta}', user?.user_metadata?.nome || 'Terapeuta')
                                                            .replace('{data}', format(new Date(), "dd 'de' MMMM", { locale: ptBR }))
                                                            .replace('{servico}', 'Método Identidade')
                                                            .replace('{valor}', 'consulte')
                                                            .replace('{score}', '—')
                                                            .replace('{classificacao}', '—');
                                                        setCustomMessages(prev => ({ ...prev, currentInput: m }));
                                                    }}>
                                                    {tpl.icon} <span className="ml-1 opacity-80">{tpl.label}</span>
                                                </Badge>
                                            ))}
                                        </div>
                                        <div className="flex items-end gap-2">
                                            <div className="relative flex-1">
                                                <Textarea
                                                    className="w-full min-h-[44px] max-h-[120px] text-xs resize-none rounded-xl pr-10 focus-visible:ring-primary/30 py-3"
                                                    placeholder="Digite uma mensagem ou selecione um template acima..."
                                                    value={customMessages['currentInput'] || ''}
                                                    onChange={e => setCustomMessages(prev => ({ ...prev, currentInput: e.target.value }))}
                                                />
                                            </div>
                                            <Button
                                                className="h-[44px] w-[44px] p-0 shrink-0 bg-primary hover:bg-primary/90 rounded-xl shadow-md disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-95"
                                                disabled={!customMessages['currentInput'] || !selectedPatient.telefone}
                                                onClick={async () => {
                                                    const txt = customMessages['currentInput'];
                                                    if (!txt || !selectedPatient.telefone) return;
                                                    logMensagem.mutate({ paciente_id: selectedPatient.id, mensagem: txt, tipo: 'manual' });
                                                    shareViaWhatsApp(selectedPatient.telefone, txt);
                                                    setCustomMessages(prev => ({ ...prev, currentInput: '' }));
                                                    toast({ title: 'Ação registrada!', description: 'Abrindo o WhatsApp Web/App com a mensagem pronta.' });
                                                }}>
                                                <Send className="h-4 w-4 ml-0.5" />
                                            </Button>
                                        </div>
                                        {!selectedPatient.telefone && (
                                            <p className="text-[10px] text-destructive mt-2 text-center flex items-center justify-center gap-1 font-medium bg-destructive/10 py-1 rounded-md">
                                                <AlertCircle className="h-3 w-3" /> Impossível enviar: paciente sem número de telefone.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </Card>

                    {/* ── Pacotes (Propostas Rápidas) ── */}
                    <Card className="border">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Package className="h-4 w-4 text-primary" /> Enviar Proposta de Pacote
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">Selecione um paciente acima e envie uma proposta comercial via WhatsApp.</p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {(['Método Identidade', 'COB° ZERO', 'Studio Personal ID'] as const).map(servico => {
                                const pacotes = PACOTES_PREDEFINIDOS.filter(p => p.servico === servico);
                                return (
                                    <div key={servico}>
                                        <h4 className="font-bold text-xs mb-1.5 text-muted-foreground">{servico}</h4>
                                        <div className="grid gap-2 md:grid-cols-2">
                                            {pacotes.map(pacote => {
                                                const isSelected = selectedPacote === pacote.id;
                                                return (
                                                    <div key={pacote.id} className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/30'}`}
                                                        onClick={() => { setSelectedPacote(isSelected ? null : pacote.id); setCustomValue(pacote.valorSugerido); }}>
                                                        <div className="flex items-start justify-between mb-1">
                                                            <div>
                                                                <h5 className="font-bold text-xs">{pacote.nome}</h5>
                                                                <p className="text-[10px] text-muted-foreground">{pacote.sessoes} sessões · {pacote.duracao}</p>
                                                            </div>
                                                            <Badge className="bg-primary/10 text-primary border-0 font-black text-[10px]">R$ {pacote.valorSugerido}</Badge>
                                                        </div>
                                                        {isSelected && (
                                                            <div className="pt-2 border-t mt-2 space-y-2">
                                                                <div className="space-y-1">
                                                                    {pacote.diferenciais.map((d, i) => (
                                                                        <div key={i} className="flex items-center gap-1.5 text-[10px]">
                                                                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                                                                            <span>{d}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <div className="flex-1">
                                                                        <div className="relative">
                                                                            <span className="absolute left-2 top-2 text-xs text-muted-foreground font-bold">R$</span>
                                                                            <Input className="pl-7 h-8 text-sm font-bold" value={customValue}
                                                                                onChange={(e) => setCustomValue(e.target.value)} />
                                                                        </div>
                                                                    </div>
                                                                    <Button className="h-8 bg-[#25D366] hover:bg-[#20BE5C] text-white gap-1 text-xs"
                                                                        disabled={!selectedPatient?.telefone}
                                                                        onClick={(e) => { e.stopPropagation(); handleSendPacote(pacote); }}>
                                                                        <Send className="h-3 w-3" /> Enviar
                                                                    </Button>
                                                                </div>
                                                                {!selectedPatient && <p className="text-[9px] text-destructive">⚠️ Selecione um paciente primeiro</p>}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>
                    </div>
                )}

                {/* ══════════════════ RELATÓRIOS TAB ══════════════════ */}
                {activeTab === 'relatorios' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                            <MetricCard label="Taxa de Conversão" value={`${taxaConversao}%`} desc="Leads → Avaliados" icon={TrendingUp} color="primary" />
                            <MetricCard label="Leads" value={leads.length.toString()} desc="Sem avaliação" icon={UserPlus} color="blue" />
                            <MetricCard label="Follow-up" value={inativos.length.toString()} desc="Sem sessão recente" icon={AlertCircle} color="red" />
                            <MetricCard label="Ativos" value={(avaliados.length - inativos.length).toString()} desc="Com sessões" icon={CheckCircle2} color="emerald" />
                            <MetricCard label="Receita/Mês" value={`R$ ${receitaMes.toLocaleString('pt-BR')}`} desc="Sessões realizadas" icon={DollarSign} color="emerald" />
                            <MetricCard label="Taxa de Faltas" value={`${taxaFaltas}%`} desc={`${faltasMes} falta(s) no mês`} icon={XCircle} color="red" />
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

                {/* ══════════════════ SERVIÇOS & PAGAMENTOS TAB ══════════════════ */}
                {activeTab === 'servicos' && (
                    <div className="space-y-4">
                        <Card className="border">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    <Package className="h-4 w-4 text-primary" /> Serviços, Valores & Funil de Vendas
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Os serviços e valores configurados aqui aparecerão automaticamente no portal do paciente na área de pagamentos.
                                </p>
                            </CardHeader>
                            <CardContent>
                                <FunilConfigPanel />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ══════════════════ CONTROLE DE ATENDIMENTO TAB ══════════════════ */}
                {activeTab === 'notas' && (() => {
                    // Current day appointments
                    const dailyAgs = agendamentos
                        .filter((ag: any) => isSameDay(parseISO(ag.data_inicio), currentDate) && ag.status !== 'cancelado')
                        .sort((a: any, b: any) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime());

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

                                            const statsAtendidos = patientAgs.filter((ag: any) => getAttendanceStatus(ag.id) === 'atendido').length;
                                            const statsFaltas = patientAgs.filter((ag: any) => getAttendanceStatus(ag.id) === 'faltou').length;

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
                                                            const status = getAttendanceStatus(ag.id);
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

                {/* Funil is now inside Relatórios tab */}
            </div>

            {/* ── Floating Action Buttons (FAB) ── */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
                <button
                    onClick={() => setFabOpen(!fabOpen)}
                    className={cn(
                        'h-14 w-14 rounded-full bg-gradient-primary text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95',
                        fabOpen && 'rotate-45'
                    )}
                >
                    <Plus className="h-6 w-6" />
                </button>
                {
                    fabOpen && (
                        <>
                            <button onClick={() => { setFabOpen(false); navigate('/pacientes'); }}
                                className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-card border shadow-md text-sm font-medium hover:bg-accent transition-colors">
                                <UserPlus className="h-4 w-4 text-emerald-600" /><span>Pacientes</span>
                            </button>
                            <button onClick={() => { setFabOpen(false); navigate('/metodo-identidade'); }}
                                className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-card border shadow-md text-sm font-medium hover:bg-accent transition-colors">
                                <ClipboardList className="h-4 w-4 text-primary" /><span>Nova Avaliação</span>
                            </button>
                            <button onClick={() => { setFabOpen(false); navigate('/agenda'); }}
                                className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-card border shadow-md text-sm font-medium hover:bg-accent transition-colors">
                                <CalendarDays className="h-4 w-4 text-amber-600" /><span>Agenda</span>
                            </button>
                            <button onClick={() => { setFabOpen(false); setActiveTab('mensagens'); }}
                                className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-card border shadow-md text-sm font-medium hover:bg-accent transition-colors">
                                <MessageCircle className="h-4 w-4 text-green-600" /><span>WhatsApp</span>
                            </button>
                        </>
                    )
                }
            </div>
            {fabOpen && <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setFabOpen(false)} />}
        </AppLayout>
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
