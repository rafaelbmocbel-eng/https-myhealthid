import { useState, useMemo } from 'react';
import { PacienteSchema } from '@/lib/validations';
import { Navigate, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Plus, Search, Phone, Mail, Calendar, Edit2, Trash2,
  Loader2, User, Activity, AlignCenter, CalendarDays, Link2, Copy, RefreshCw,
  ArrowUpDown, MessageCircle, ClipboardList, Clock, FileText, Zap, Send, UserPlus, Download, BarChart3,
} from 'lucide-react';
import { format, parseISO, differenceInDays, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { exportToCsv } from '@/utils/exportCsv';
import { shareBoasVindas, shareLembreteRetorno, sharePosAlta } from '@/utils/whatsapp';

// ── Classificação automática de pacientes ───────────────────────────────────
type ClassificacaoTag = 'novo' | 'recorrente' | 'lead' | 'inadimplente' | 'a_pagar';

const CLASSIFICACOES: { key: ClassificacaoTag; label: string; emoji: string; color: string; bgColor: string }[] = [
  { key: 'lead', label: 'Lead', emoji: '🟡', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300' },
  { key: 'novo', label: 'Cliente Novo', emoji: '🟢', color: 'text-emerald-700', bgColor: 'bg-emerald-100 border-emerald-300' },
  { key: 'recorrente', label: 'Recorrente', emoji: '🔵', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300' },
  { key: 'inadimplente', label: 'Inadimplente', emoji: '🔴', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300' },
  { key: 'a_pagar', label: 'A Pagar', emoji: '🟠', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300' },
];

// ── Utilitários de máscara ──────────────────────────────────────────────────
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};
const maskCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};

type SortKey = 'nome' | 'created_at' | 'ultimo_agendamento';

interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string;
  telefone?: string;
  data_nascimento?: string;
  genero?: string;
  cpf?: string;
  endereco?: string;
  observacoes?: string;
  ativo: boolean;
  created_at: string;
  terapeuta_id: string;
  _servicos?: string[];
}

const SERVICOS = [
  { key: 'metodo_identidade', label: 'Método Identidade', color: 'bg-primary/10 text-primary border-primary/20' },
  { key: 'cob_zero', label: 'COB° ZERO', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { key: 'studio_personal_id', label: 'Studio Personal ID', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { key: 'agenda_premium', label: 'Agenda Premium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

interface FormData {
  nome: string; sobrenome: string; email: string; telefone: string;
  data_nascimento: string; genero: string; cpf: string; endereco: string;
  queixa_principal: string; observacoes: string; servicos: string[];
}

const emptyForm: FormData = {
  nome: '', sobrenome: '', email: '', telefone: '',
  data_nascimento: '', genero: '', cpf: '', endereco: '',
  queixa_principal: '', observacoes: '',
  servicos: [],
};

// ── Sub-componente para modal de link ───────────────────────────────────────
function LinkModalContent({ pac, links, gerando, gerarLink, copiarLink, cancelarLink, getLinkUrl }: {
  pac: Paciente;
  links: any[];
  gerando: boolean;
  gerarLink: (id: string) => Promise<any>;
  copiarLink: (token: string) => void;
  cancelarLink: (id: string) => void;
  getLinkUrl: (token: string) => string;
}) {
  const pacLinks = links.filter(l => l.paciente_id === pac.id);
  const linkAtivo = pacLinks.find(l => l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  if (linkAtivo) {
    return (
      <div className="space-y-3">
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-xs font-semibold text-emerald-700">Link ativo</span>
            <span className="text-xs text-emerald-600 ml-auto">
              {differenceInDays(new Date(linkAtivo.data_expiracao), new Date())} dias restantes
            </span>
          </div>
          <div className="text-xs font-mono text-muted-foreground break-all bg-card rounded p-2">
            {getLinkUrl(linkAtivo.token)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1 gap-2" onClick={() => copiarLink(linkAtivo.token)}>
            <Copy className="h-3.5 w-3.5" /> Copiar Link
          </Button>
          <Button variant="outline" className="gap-2" onClick={async () => {
            await cancelarLink(linkAtivo.id);
            await gerarLink(pac.id);
          }} disabled={gerando}>
            {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Renovar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{linkAtivo.acessos_totais} acesso(s) registrado(s)</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg bg-muted/50 border border-dashed text-center text-sm text-muted-foreground">
        Nenhum link ativo para este paciente
      </div>
      <Button className="w-full bg-gradient-primary text-white gap-2" onClick={async () => {
        const novo = await gerarLink(pac.id);
        if (novo) copiarLink(novo.token);
      }} disabled={gerando}>
        {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
        Gerar Link de Avaliação
      </Button>
    </div>
  );
}

// ── Página Principal ────────────────────────────────────────────────────────
export default function Pacientes() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { links, gerarLink, copiarLink, cancelarLink, getLinkUrl, gerando } = useLinksAvaliacao();

  const [search, setSearch] = useState('');
  const [filterServico, setFilterServico] = useState('todos');
  const [filterTag, setFilterTag] = useState<ClassificacaoTag | 'todos'>('todos');
  const [sortBy, setSortBy] = useState<SortKey>('nome');
  const [modal, setModal] = useState<{ open: boolean; paciente?: Paciente }>({ open: false });
  const [linkModal, setLinkModal] = useState<{ open: boolean; paciente?: Paciente }>({ open: false });
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['pacientes-com-servicos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*, paciente_servicos(id, servico, ativo, paciente_id)')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []).map((p: any) => ({
        ...p,
        _servicos: (p.paciente_servicos || []).filter((s: any) => s.ativo).map((s: any) => s.servico),
      })) as Paciente[];
    },
    enabled: !!user,
  });

  // Fetch ultimo agendamento for each paciente
  const { data: ultimosAgendamentos = {} } = useQuery({
    queryKey: ['ultimos-agendamentos', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('paciente_id, data_inicio, status')
        .eq('terapeuta_id', user!.id)
        .order('data_inicio', { ascending: false });
      const map: Record<string, { data: string; status: string }> = {};
      (data || []).forEach((a: any) => {
        if (!map[a.paciente_id]) map[a.paciente_id] = { data: a.data_inicio, status: a.status };
      });
      return map;
    },
    enabled: !!user,
  });

  // Fetch pending evaluations
  const { data: avaliacoesPendentes = {} } = useQuery({
    queryKey: ['avaliacoes-pendentes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('myid_avaliacoes')
        .select('paciente_id, status')
        .eq('terapeuta_id', user!.id)
        .neq('status', 'concluido');
      const map: Record<string, boolean> = {};
      (data || []).forEach((a: any) => { if (a.paciente_id) map[a.paciente_id] = true; });
      return map;
    },
    enabled: !!user,
  });

  // Fetch controle_sessoes for payment classification
  const { data: sessoes = [] } = useQuery({
    queryKey: ['pacientes-sessoes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('controle_sessoes')
        .select('paciente_id, status, valor_cobrado, forma_pagamento, data_sessao')
        .eq('terapeuta_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch avaliacoes_identidade to know who has been evaluated
  const { data: avaliacoesIdentidade = [] } = useQuery({
    queryKey: ['pacientes-avaliacoes-identidade', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('paciente_id')
        .eq('terapeuta_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  // ── Compute automated classification per patient ──────────────────
  const getClassificacao = useMemo(() => {
    const avaliadosSet = new Set(avaliacoesIdentidade.map((a: any) => a.paciente_id));
    const myidConcluidos = new Set(
      Object.entries(avaliacoesPendentes)
        .filter(([, pending]) => !pending)
        .map(([pid]) => pid)
    );

    // Group sessoes by paciente
    const sessoesPorPaciente: Record<string, any[]> = {};
    sessoes.forEach((s: any) => {
      if (!sessoesPorPaciente[s.paciente_id]) sessoesPorPaciente[s.paciente_id] = [];
      sessoesPorPaciente[s.paciente_id].push(s);
    });

    return (pid: string, createdAt: string): ClassificacaoTag => {
      const pSessoes = sessoesPorPaciente[pid] || [];
      const hasAvaliacao = avaliadosSet.has(pid);
      const hasAgendamento = !!ultimosAgendamentos[pid];
      const totalSessoes = pSessoes.length;

      // 🔴 Inadimplente: sessões realizadas sem pagamento (valor_cobrado = 0 ou null) há mais de 30 dias
      const sessoesNaoPagas = pSessoes.filter(
        (s: any) => s.status === 'realizada' && (!s.valor_cobrado || Number(s.valor_cobrado) === 0)
          && differenceInDays(new Date(), new Date(s.data_sessao)) > 30
      );
      if (sessoesNaoPagas.length > 0) return 'inadimplente';

      // 🟠 A pagar: sessões realizadas sem pagamento (recentes, <= 30 dias)
      const sessoesAPagar = pSessoes.filter(
        (s: any) => s.status === 'realizada' && (!s.valor_cobrado || Number(s.valor_cobrado) === 0)
          && differenceInDays(new Date(), new Date(s.data_sessao)) <= 30
      );
      if (sessoesAPagar.length > 0) return 'a_pagar';

      // 🔵 Recorrente: has 3+ sessions
      if (totalSessoes >= 3) return 'recorrente';

      // 🟢 Cliente novo: cadastrado há menos de 60 dias, tem alguma sessão ou avaliação
      const diasCadastro = differenceInDays(new Date(), new Date(createdAt));
      if (diasCadastro <= 60 && (hasAvaliacao || hasAgendamento || totalSessoes > 0)) return 'novo';

      // 🟡 Lead: sem sessões, sem avaliação
      return 'lead';
    };
  }, [sessoes, avaliacoesIdentidade, avaliacoesPendentes, ultimosAgendamentos]);

  const getServicosForPaciente = (pid: string): string[] => {
    const p = pacientes.find(x => x.id === pid);
    return p?._servicos || [];
  };

  const openNew = () => { setForm(emptyForm); setModal({ open: true }); };
  const openEdit = (p: Paciente) => {
    setForm({
      nome: p.nome, sobrenome: p.sobrenome, email: p.email || '',
      telefone: p.telefone || '', data_nascimento: p.data_nascimento || '',
      genero: p.genero || '', cpf: p.cpf || '', endereco: p.endereco || '',
      queixa_principal: (p as any).queixa_principal || '', observacoes: p.observacoes || '',
      servicos: p._servicos || [],
    });
    setModal({ open: true, paciente: p });
  };

  const handleSave = async () => {
    const parsed = PacienteSchema.safeParse(form);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Dados inválidos';
      return toast({ title: firstError, variant: 'destructive' });
    }
    setSubmitting(true);
    try {
      let pacienteId = modal.paciente?.id;
      const validated = parsed.data;
      const payload = {
        nome: validated.nome!,
        sobrenome: validated.sobrenome!,
        email: validated.email ?? null,
        telefone: validated.telefone ?? null,
        data_nascimento: validated.data_nascimento ?? null,
        genero: validated.genero ?? null,
        cpf: validated.cpf ?? null,
        endereco: validated.endereco ?? null,
        observacoes: validated.observacoes ?? null,
        terapeuta_id: user!.id,
      };
      if (pacienteId) {
        await supabase.from('pacientes').update(payload).eq('id', pacienteId);
      } else {
        const { data, error } = await supabase.from('pacientes').insert(payload).select().single();
        if (error) throw error;
        pacienteId = data.id;
      }
      await supabase.from('paciente_servicos').delete().eq('paciente_id', pacienteId!);
      if (form.servicos.length > 0) {
        await supabase.from('paciente_servicos').insert(
          form.servicos.map(s => ({
            paciente_id: pacienteId!, servico: s, ativo: true,
            data_inicio: new Date().toISOString().split('T')[0],
          }))
        );
      }
      qc.invalidateQueries({ queryKey: ['pacientes-com-servicos'] });
      toast({ title: modal.paciente ? 'Paciente atualizado!' : 'Paciente cadastrado!' });
      setModal({ open: false });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: Paciente) => {
    if (!confirm(`EXCLUIR DEFINITIVAMENTE ${p.nome} ${p.sobrenome}?\n\nIsso apagará TODO o histórico, avaliações, agendamentos e links deste paciente. Esta ação é IRREVERSÍVEL.`)) return;

    try {
      const pId = p.id;
      await supabase.from('links_avaliacao').delete().eq('paciente_id', pId);
      await supabase.from('links_agenda_paciente').delete().eq('paciente_id', pId);

      const { data: protos } = await supabase.from('protocolos').select('id').eq('paciente_id', pId);
      if (protos && protos.length > 0) {
        const pIds = protos.map(x => x.id);
        await supabase.from('protocolo_tratamentos').delete().in('protocolo_id', pIds);
        await supabase.from('protocolos').delete().eq('paciente_id', pId);
      }

      await supabase.from('respostas_avaliacao_paciente').delete().eq('paciente_id', pId);
      await supabase.from('avaliacoes_identidade').delete().eq('paciente_id', pId);
      await supabase.from('avaliacoes_cob_zero').delete().eq('paciente_id', pId);
      await supabase.from('studio_medidas').delete().eq('paciente_id', pId);
      await supabase.from('myid_avaliacoes').delete().eq('paciente_id', pId);
      await supabase.from('agendamentos').delete().eq('paciente_id', pId);
      await supabase.from('paciente_servicos').delete().eq('paciente_id', pId);

      const { error } = await supabase.from('pacientes').delete().eq('id', pId);
      if (error) throw error;

      qc.invalidateQueries({ queryKey: ['pacientes-com-servicos'] });
      toast({ title: 'Paciente excluído definitivamente' });
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    }
  };

  const toggleServico = (s: string) => {
    setForm(f => ({
      ...f,
      servicos: f.servicos.includes(s) ? f.servicos.filter(x => x !== s) : [...f.servicos, s],
    }));
  };

  const getLinksForPaciente = (pid: string) => links.filter(l => l.paciente_id === pid);

  // Patient status helper
  const getPatientStatus = (pid: string): { color: string; label: string } => {
    if (avaliacoesPendentes[pid]) return { color: 'bg-amber-400', label: 'Avaliação pendente' };
    const ultimo = ultimosAgendamentos[pid];
    if (!ultimo) return { color: 'bg-slate-300', label: 'Sem agendamentos' };
    const dias = differenceInDays(new Date(), new Date(ultimo.data));
    if (dias <= 7) return { color: 'bg-emerald-400', label: 'Ativo' };
    if (dias <= 30) return { color: 'bg-amber-400', label: `Última consulta há ${dias}d` };
    return { color: 'bg-slate-300', label: `Inativo (${dias}d)` };
  };

  // Classification counts for filter chips
  const classificationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CLASSIFICACOES.forEach(c => counts[c.key] = 0);
    pacientes.forEach(p => {
      const tag = getClassificacao(p.id, p.created_at);
      counts[tag] = (counts[tag] || 0) + 1;
    });
    return counts;
  }, [pacientes, getClassificacao]);

  const filtered = useMemo(() => {
    const list = pacientes.filter(p => {
      const matchSearch = `${p.nome} ${p.sobrenome} ${p.email || ''} ${p.telefone || ''}`.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filterServico !== 'todos' && !getServicosForPaciente(p.id).includes(filterServico)) return false;
      if (filterTag !== 'todos' && getClassificacao(p.id, p.created_at) !== filterTag) return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sortBy === 'nome') return a.nome.localeCompare(b.nome);
      if (sortBy === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'ultimo_agendamento') {
        const da = ultimosAgendamentos[a.id]?.data || '1900-01-01';
        const db = ultimosAgendamentos[b.id]?.data || '1900-01-01';
        return new Date(db).getTime() - new Date(da).getTime();
      }
      return 0;
    });
  }, [pacientes, search, filterServico, filterTag, sortBy, ultimosAgendamentos, getClassificacao]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold truncate">Meus Pacientes</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">{pacientes.length} cadastrados</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rows = filtered.map(p => ({
                      nome: p.nome,
                      sobrenome: p.sobrenome,
                      email: p.email || '',
                      telefone: p.telefone || '',
                      cpf: p.cpf || '',
                      data_nascimento: p.data_nascimento || '',
                      genero: p.genero || '',
                      servicos: (p._servicos || []).join(', '),
                      cadastro: p.created_at ? format(parseISO(p.created_at), 'dd/MM/yyyy') : '',
                    }));
                    exportToCsv(`pacientes_${format(new Date(), 'yyyy-MM-dd')}.csv`, rows, [
                      { key: 'nome', label: 'Nome' },
                      { key: 'sobrenome', label: 'Sobrenome' },
                      { key: 'email', label: 'E-mail' },
                      { key: 'telefone', label: 'Telefone' },
                      { key: 'cpf', label: 'CPF' },
                      { key: 'data_nascimento', label: 'Nascimento' },
                      { key: 'genero', label: 'Gênero' },
                      { key: 'servicos', label: 'Serviços' },
                      { key: 'cadastro', label: 'Data Cadastro' },
                    ]);
                    toast({ title: `${rows.length} pacientes exportados!` });
                  }}
                  disabled={filtered.length === 0}
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline ml-1.5">CSV</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar lista para CSV</TooltipContent>
            </Tooltip>
            <Button onClick={openNew} className="bg-gradient-primary text-white gap-2" size="sm">
              <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo Paciente</span><span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar paciente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterServico} onValueChange={setFilterServico}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os serviços</SelectItem>
              {SERVICOS.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-48">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
              <SelectItem value="created_at">Mais recentes</SelectItem>
              <SelectItem value="ultimo_agendamento">Última consulta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Classification Tag Chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setFilterTag('todos')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
              filterTag === 'todos' ? 'bg-foreground text-background border-foreground' : 'bg-muted text-muted-foreground border-border hover:bg-accent'
            )}
          >
            Todos ({pacientes.length})
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
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum paciente encontrado</p>
            <p className="text-sm mt-1">Clique em "Novo Paciente" para começar</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filtered.map(p => {
              const pServicos = getServicosForPaciente(p.id);
              const pLinks = getLinksForPaciente(p.id);
              const linkAtivo = pLinks.find(l => l.status === 'ativo' && new Date(l.data_expiracao) > new Date());
              const diasRestantes = linkAtivo ? differenceInDays(new Date(linkAtivo.data_expiracao), new Date()) : 0;
              const status = getPatientStatus(p.id);
              const ultimoAg = ultimosAgendamentos[p.id];
              const tag = getClassificacao(p.id, p.created_at);
              const tagCfg = CLASSIFICACOES.find(c => c.key === tag)!;
              return (
                <div key={p.id} className="clinical-card group p-3 sm:p-4 hover:shadow-md transition-all cursor-pointer" onClick={() => navigate(`/pacientes/${p.id}`)}>
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Avatar with status dot */}
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-gradient-primary flex items-center justify-center text-white font-bold text-sm">
                        {p.nome[0]}{p.sobrenome?.[0] || ''}
                      </div>
                      <div className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white', status.color)} title={status.label} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{p.nome} {p.sobrenome}</span>
                        {linkAtivo && (
                          <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                            <Link2 className="h-2.5 w-2.5" /> {diasRestantes}d
                          </Badge>
                        )}
                        <Badge variant="outline" className={cn('text-[10px] h-5 border', tagCfg.bgColor, tagCfg.color)}>
                          {tagCfg.emoji} {tagCfg.label}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pServicos.map(s => {
                          const cfg = SERVICOS.find(x => x.key === s);
                          return cfg ? (
                            <Badge key={s} variant="outline" className={cn('text-[10px] h-5', cfg.color)}>{cfg.label}</Badge>
                          ) : null;
                        })}
                      </div>
                      <div className="hidden sm:flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                        {p.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telefone}</span>}
                        {ultimoAg ? (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Última consulta: {formatDistanceToNow(new Date(ultimoAg.data), { addSuffix: true, locale: ptBR })}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400"><Clock className="h-3 w-3" />Sem consultas</span>
                        )}
                      </div>
                    </div>
                    {/* Actions — compact */}
                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                      {p.telefone && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-[#25D366] hover:bg-[#25D366]/10" title="WhatsApp"
                          onClick={() => {
                            const msg = encodeURIComponent(`Olá ${p.nome}! 👋\n\n`);
                            window.open(`https://wa.me/55${p.telefone?.replace(/\D/g, '')}?text=${msg}`, '_blank');
                          }}>
                          <MessageCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title="Editar">
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal Paciente */}
      <Dialog open={modal.open} onOpenChange={o => setModal({ open: o })}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modal.paciente ? 'Editar Paciente' : 'Novo Paciente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input placeholder="Maria" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Sobrenome</Label>
                <Input placeholder="Silva" value={form.sobrenome} onChange={e => setForm(f => ({ ...f, sobrenome: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>E-mail</Label>
              <Input type="email" placeholder="maria@email.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input placeholder="(11) 98765-4321" value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: maskPhone(e.target.value) }))}
                  maxLength={15} />
              </div>
              <div className="space-y-1">
                <Label>Data de Nascimento</Label>
                <Input
                  type="text"
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                  value={form.data_nascimento ? (() => {
                    if (/^\d{4}-\d{2}-\d{2}$/.test(form.data_nascimento)) {
                      const [y, m, d] = form.data_nascimento.split('-');
                      return `${d}/${m}/${y}`;
                    }
                    return form.data_nascimento;
                  })() : ''}
                  onChange={e => {
                    let v = e.target.value.replace(/[^\d/]/g, '');
                    const digits = v.replace(/\//g, '');
                    if (digits.length >= 5) {
                      v = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
                    } else if (digits.length >= 3) {
                      v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                    }
                    setForm(f => ({ ...f, data_nascimento: v }));
                  }}
                  onBlur={e => {
                    const v = e.target.value;
                    const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                    if (match) {
                      const [, d, m, y] = match;
                      const iso = `${y}-${m}-${d}`;
                      const date = new Date(iso);
                      if (!isNaN(date.getTime()) && date.getFullYear() === Number(y)) {
                        setForm(f => ({ ...f, data_nascimento: iso }));
                      }
                    }
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Gênero</Label>
                <Select value={form.genero} onValueChange={v => setForm(f => ({ ...f, genero: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input placeholder="123.456.789-00" value={form.cpf}
                  onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))}
                  maxLength={14} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Queixa Principal</Label>
              <Input placeholder="Ex: Dor lombar crônica, escoliose..." value={form.queixa_principal}
                onChange={e => setForm(f => ({ ...f, queixa_principal: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea placeholder="Histórico clínico, alergias..." rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Serviços Ativos</Label>
              <div className="space-y-2">
                {SERVICOS.map(s => (
                  <label key={s.key} className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent/20 transition-colors">
                    <Checkbox checked={form.servicos.includes(s.key)} onCheckedChange={() => toggleServico(s.key)} />
                    <span className="text-sm font-medium">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal({ open: false })}>Cancelar</Button>
              <Button className="flex-1 bg-gradient-primary text-white" onClick={handleSave} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Link de Avaliação */}
      <Dialog open={linkModal.open} onOpenChange={o => setLinkModal({ open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-primary" />
              Link de Avaliação — {linkModal.paciente?.nome} {linkModal.paciente?.sobrenome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Gere um link para que o paciente preencha os 5 primeiros blocos da avaliação. Válido por <strong>30 dias</strong>.
            </p>
            {linkModal.paciente && (
              <LinkModalContent
                pac={linkModal.paciente}
                links={links}
                gerando={gerando}
                gerarLink={gerarLink}
                copiarLink={copiarLink}
                cancelarLink={cancelarLink}
                getLinkUrl={getLinkUrl}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Floating Action Buttons (FAB) ── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col-reverse items-end gap-3">
        {/* Main FAB */}
        <button
          onClick={() => setFabOpen(!fabOpen)}
          className={cn(
            'h-14 w-14 rounded-full bg-gradient-primary text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95',
            fabOpen && 'rotate-45'
          )}
        >
          <Plus className="h-6 w-6" />
        </button>

        {/* Sub-actions */}
        {fabOpen && (
          <>
            <button
              onClick={() => { setFabOpen(false); openNew(); }}
              className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-card border shadow-md text-sm font-medium hover:bg-accent transition-colors"
            >
              <UserPlus className="h-4 w-4 text-emerald-600" />
              <span>Novo Paciente</span>
            </button>
            <button
              onClick={() => { setFabOpen(false); navigate('/metodo-identidade'); }}
              className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-card border shadow-md text-sm font-medium hover:bg-accent transition-colors"
            >
              <ClipboardList className="h-4 w-4 text-primary" />
              <span>Nova Avaliação</span>
            </button>
            <button
              onClick={() => { setFabOpen(false); navigate('/agenda'); }}
              className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-card border shadow-md text-sm font-medium hover:bg-accent transition-colors"
            >
              <CalendarDays className="h-4 w-4 text-amber-600" />
              <span>Agenda</span>
            </button>
            <button
              onClick={() => { setFabOpen(false); navigate('/crm'); }}
              className="flex items-center gap-2 h-11 pl-4 pr-5 rounded-full bg-card border shadow-md text-sm font-medium hover:bg-accent transition-colors"
            >
              <Send className="h-4 w-4 text-blue-600" />
              <span>CRM & WhatsApp</span>
            </button>
          </>
        )}
      </div>

      {/* Overlay to close FAB */}
      {fabOpen && <div className="fixed inset-0 z-40 bg-black/10" onClick={() => setFabOpen(false)} />}
    </AppLayout>
  );
}
