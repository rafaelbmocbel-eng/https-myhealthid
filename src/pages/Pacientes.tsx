import { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { PlanoGate } from '@/components/planos/PlanoGate';
import { PacienteSchema } from '@/lib/validations';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { SkeletonList } from '@/components/ui/skeleton-list';
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import {
  Users, Plus, Search, Phone, Mail, Calendar, Edit, Trash2,
  Loader2, User, Activity, AlignCenter, CalendarDays, CalendarPlus, Link2, Copy, RefreshCw,
  ArrowUpDown, MessageCircle, ClipboardList, Clock, FileText, Zap, Send, UserPlus, Download, BarChart3,
  DollarSign, MessageSquare, MoreHorizontal, Bell, Store, ShieldCheck, UserCheck,
} from 'lucide-react';
import { format, parseISO, differenceInDays, formatDistanceToNow } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { CODIGOS_CASSI } from '@/lib/cassiGuias';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { exportToCsv } from '@/utils/exportCsv';
import { shareBoasVindas, shareLembreteRetorno, sharePosAlta, waUrl } from '@/utils/whatsapp';
import { useEquipe } from '@/hooks/useEquipe';
import { useConvenios } from '@/hooks/useConvenios';
import PainelAcompanhamento from '@/components/paciente/PainelAcompanhamento';
import { getBaseUrl } from '@/utils/linkUrls';
import EnviarPortalDialog from '@/components/paciente/EnviarPortalDialog';

const FinanceiroGeral = lazy(() => import('@/components/paciente/FinanceiroGeral'));
const FinanceiroPage = lazy(() => import('@/pages/Financeiro'));

type MainTab = 'clientes' | 'financeiro';

// ── Classificação automática de pacientes ───────────────────────────────────
type ClassificacaoTag = 'novo' | 'recorrente' | 'lead' | 'inadimplente' | 'a_pagar';

const CLASSIFICACOES: { key: ClassificacaoTag; label: string; emoji: string; color: string; bgColor: string; dot: string }[] = [
  { key: 'lead', label: 'Lead', emoji: '🟡', color: 'text-yellow-700', bgColor: 'bg-yellow-100 border-yellow-300', dot: 'hsl(45 90% 50%)' },
  { key: 'novo', label: 'Cliente Novo', emoji: '🟢', color: 'text-emerald-700', bgColor: 'bg-emerald-100 border-emerald-300', dot: 'hsl(152 55% 42%)' },
  { key: 'recorrente', label: 'Recorrente', emoji: '🔵', color: 'text-blue-700', bgColor: 'bg-blue-100 border-blue-300', dot: 'hsl(210 80% 52%)' },
  { key: 'inadimplente', label: 'Inadimplente', emoji: '🔴', color: 'text-red-700', bgColor: 'bg-red-100 border-red-300', dot: 'hsl(0 72% 55%)' },
  { key: 'a_pagar', label: 'A Pagar', emoji: '🟠', color: 'text-orange-700', bgColor: 'bg-orange-100 border-orange-300', dot: 'hsl(30 90% 52%)' },
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
const maskCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
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
  origem?: string | null;
  _servicos?: string[];
}

const SERVICOS = [
  
  
  
  { key: 'agenda_premium', label: 'Agenda Premium', color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

type TipoPagamento = 'particular' | 'plano';
type PlanoSaude = 'FUSEX' | 'CASSI' | 'TRT';
const PLANOS_SAUDE: PlanoSaude[] = ['FUSEX', 'CASSI', 'TRT'];

interface FormData {
  nome: string; sobrenome: string; email: string; telefone: string;
  data_nascimento: string; genero: string; cpf: string;
  cep: string; endereco: string; endereco_numero: string; endereco_complemento: string;
  bairro: string; cidade: string; uf: string;
  queixa_principal: string; observacoes: string;
  responsavel_id: string;
  tipo_pagamento: TipoPagamento;
  plano_saude: string;
  convenio_id: string;
  carteirinha: string;
  codigos_cassi: string[];
  guias_por_mes: number;
  lgpd_aceite: boolean;
  contato_emergencia_nome: string;
  contato_emergencia_telefone: string;
  contato_emergencia_parentesco: string;
  alergias: string;
  medicamentos_uso: string;
  condicoes_preexistentes: string;
  origem_lead: string;
}

const emptyForm: FormData = {
  nome: '', sobrenome: '', email: '', telefone: '',
  data_nascimento: '', genero: '', cpf: '',
  cep: '', endereco: '', endereco_numero: '', endereco_complemento: '',
  bairro: '', cidade: '', uf: '',
  queixa_principal: '', observacoes: '',
  responsavel_id: '',
  tipo_pagamento: 'particular',
  plano_saude: '',
  convenio_id: '',
  carteirinha: '',
  codigos_cassi: [],
  guias_por_mes: 1,
  lgpd_aceite: false,
  contato_emergencia_nome: '',
  contato_emergencia_telefone: '',
  contato_emergencia_parentesco: '',
  alergias: '',
  medicamentos_uso: '',
  condicoes_preexistentes: '',
  origem_lead: '',
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
          {pac.telefone ? (
            <Button className="flex-1 gap-2 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => {
              const url = getLinkUrl(linkAtivo.token);
              const msg = `Olá ${pac.nome}! 🩺\n\nPreencha sua avaliação:\n${url}`;
              window.open(waUrl(pac.telefone, msg), '_blank');
            }}>
              <MessageCircle className="icon-sm" /> Enviar via WhatsApp
            </Button>
          ) : (
            <Button className="flex-1 gap-2" onClick={() => copiarLink(linkAtivo.token)}>
              <Copy className="icon-sm" /> Copiar Link
            </Button>
          )}
          <Button variant="outline" className="gap-2" onClick={async () => {
            await cancelarLink(linkAtivo.id);
            await gerarLink(pac.id);
          }} disabled={gerando}>
            {gerando ? <Loader2 className="icon-sm animate-spin" /> : <RefreshCw className="icon-sm" />}
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
      <Button className="w-full rounded-xl gap-2" onClick={async () => {
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
  const { membros: membrosEquipe } = useEquipe();
  const { convenios } = useConvenios();

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(search), 160);
    return () => clearTimeout(searchTimerRef.current);
  }, [search]);
  const [filterServico, setFilterServico] = useState('todos');
  // Um único chip ativo por vez (classificação OU marcador). Evita filtros
  // grudados que deixavam a lista vazia "pra sempre" ao combinar chips.
  // Valores: 'todos' | 'novo' | 'recorrente' | 'a_pagar' | 'cassi' | 'prof' | 'vitrine'
  const [chip, setChip] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<SortKey>('nome');
  const [modal, setModal] = useState<{ open: boolean; paciente?: Paciente }>({ open: false });
  const [linkModal, setLinkModal] = useState<{ open: boolean; paciente?: Paciente }>({ open: false });
  const [quickModal, setQuickModal] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [quickForm, setQuickForm] = useState({ nome: '', sobrenome: '', email: '', telefone: '', lgpd_aceite: false });
  const [shareModal, setShareModal] = useState<{ open: boolean; nome?: string; telefone?: string; url?: string }>({ open: false });
  const [form, setForm] = useState<FormData>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [recentlyAddedIds, setRecentlyAddedIds] = useState<string[]>([]);
  const pinRecent = (id: string) => {
    setRecentlyAddedIds(prev => (prev.includes(id) ? prev : [id, ...prev]));
    setTimeout(() => {
      setRecentlyAddedIds(prev => prev.filter(x => x !== id));
    }, 30000);
  };
  const [searchParams, setSearchParams] = useSearchParams();
  // Links antigos com ?tab=crm caem em Clientes em vez de tela vazia
  const activeMainTab: MainTab = searchParams.get('tab') === 'financeiro' ? 'financeiro' : 'clientes';
  const setActiveMainTab = (tab: MainTab) => {
    if (tab === 'clientes') {
      searchParams.delete('tab');
      setSearchParams(searchParams, { replace: true });
    } else {
      setSearchParams({ tab }, { replace: true });
    }
  };

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

  // Quem veio da Vitrine: além do campo origem (que pode não ter sido preenchido
  // em quem foi vinculado antes), deriva pelo vínculo real — toda solicitação de
  // conexão aceita deste profissional. Assim o marcador não depende de um campo
  // de texto que pode estar em branco.
  const { data: vitrineIds = [] } = useQuery({
    queryKey: ['vitrine-user-ids', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('solicitacoes_conexao')
        .select('paciente_user_id')
        .eq('terapeuta_id', user!.id)
        .eq('status', 'aceita');
      return (data || []).map((s: any) => s.paciente_user_id as string);
    },
  });
  // O Set é montado localmente (nunca guardado no cache) para garantir que
  // continua sendo um Set de verdade — guardar Set direto no React Query pode
  // deixá-lo sem o método .has e quebrar a lista inteira.
  const vitrineUserIds = useMemo(() => new Set(vitrineIds), [vitrineIds]);
  const ehVitrine = (p: any) =>
    p?.origem === 'vitrine' || (p?.user_id && vitrineUserIds.has(p.user_id));

  // Fetch all agendamentos for each paciente (for tracking panel)
  const { data: todosAgendamentos = [] } = useQuery({
    queryKey: ['todos-agendamentos-pacientes', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('paciente_id, data_inicio, data_fim, status, tipo_atendimento, membro_equipe_id')
        .eq('terapeuta_id', user!.id)
        .order('data_inicio', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Derive ultimo agendamento map from all agendamentos
  const ultimosAgendamentos = useMemo(() => {
    const map: Record<string, { data: string; status: string }> = {};
    todosAgendamentos.forEach((a: any) => {
      if (!map[a.paciente_id]) map[a.paciente_id] = { data: a.data_inicio, status: a.status };
    });
    return map;
  }, [todosAgendamentos]);

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

  // Fetch agendamentos por membro de equipe
  const { data: agendamentosPorMembro = {} } = useQuery({
    queryKey: ['agendamentos-por-membro', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('agendamentos')
        .select('paciente_id, membro_equipe_id')
        .eq('terapeuta_id', user!.id)
        .not('membro_equipe_id', 'is', null)
        .not('paciente_id', 'is', null);
      const map: Record<string, string[]> = {};
      (data || []).forEach((a: any) => {
        if (!map[a.membro_equipe_id]) map[a.membro_equipe_id] = [];
        if (!map[a.membro_equipe_id].includes(a.paciente_id)) {
          map[a.membro_equipe_id].push(a.paciente_id);
        }
      });
      return map;
    },
    enabled: !!user,
  });


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

  // Pendências por paciente (notificações não lidas) — badge na lista
  const { data: pendenciasPorPaciente = {} } = useQuery({
    queryKey: ['pendencias-por-paciente', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notificacoes')
        .select('tipo, titulo, metadata')
        .eq('terapeuta_id', user!.id)
        .eq('lida', false);
      const map: Record<string, { count: number; tipos: string[]; titulos: string[] }> = {};
      (data || []).forEach((n: any) => {
        const pid = n.metadata?.paciente_id;
        if (!pid) return;
        if (!map[pid]) map[pid] = { count: 0, tipos: [], titulos: [] };
        map[pid].count += 1;
        if (!map[pid].tipos.includes(n.tipo)) map[pid].tipos.push(n.tipo);
        if (map[pid].titulos.length < 4) map[pid].titulos.push(n.titulo);
      });
      return map;
    },
    enabled: !!user,
    refetchInterval: 60000,
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

      // 🟢 Cliente novo: cadastrado há até 30 dias, tem alguma sessão ou avaliação
      const diasCadastro = differenceInDays(new Date(), new Date(createdAt));
      if (diasCadastro <= 30 && (hasAvaliacao || hasAgendamento || totalSessoes > 0)) return 'novo';

      // 🟡 Lead: sem sessões, sem avaliação
      return 'lead';
    };
  }, [sessoes, avaliacoesIdentidade, avaliacoesPendentes, ultimosAgendamentos]);

  const getServicosForPaciente = (pid: string): string[] => {
    const p = pacientes.find(x => x.id === pid);
    return p?._servicos || [];
  };

  const openNew = () => { setForm(emptyForm); setModal({ open: true }); };
  const openQuick = () => {
    setQuickForm({ nome: '', sobrenome: '', email: '', telefone: '', lgpd_aceite: false });
    setQuickModal(true);
  };

  const handleQuickSave = async () => {
    if (!quickForm.nome.trim()) return toast({ title: 'Nome é obrigatório', variant: 'destructive' });
    const telDigits = quickForm.telefone.replace(/\D/g, '');
    if (telDigits.length < 10) return toast({ title: 'WhatsApp/Telefone obrigatório', variant: 'destructive' });
    if (!quickForm.lgpd_aceite) return toast({ title: 'Confirme o aceite LGPD do paciente', variant: 'destructive' });
    setSubmitting(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      const payload: any = {
        nome: quickForm.nome.trim(),
        sobrenome: quickForm.sobrenome.trim(),
        email: quickForm.email.trim().toLowerCase() || null,
        telefone: quickForm.telefone,
        terapeuta_id: user!.id,
        ativo: true,
        cadastro_status: 'pendente_paciente',
        portal_token: token,
        origem: 'cadastro_rapido',
        lgpd_aceite_em: new Date().toISOString(),
        lgpd_versao: '1.0',
        tipo_pagamento: 'particular',
      };
      const { data, error } = await supabase.from('pacientes').insert(payload).select('id, portal_token, nome, telefone').single();
      if (error) throw error;
      pinRecent(data.id);
      try {
        await supabase.from('termos_consentimento').insert({
          paciente_id: data.id, terapeuta_id: user!.id, tipo: 'lgpd', versao: '1.0',
          texto_termo: 'Autorizo o tratamento dos meus dados pessoais e de saúde para fins clínicos e administrativos, conforme a LGPD.',
          aceito: true, data_aceite: new Date().toISOString(),
        });
      } catch {/* nb */}
      qc.invalidateQueries({ queryKey: ['pacientes-com-servicos'] });
      const url = `${getBaseUrl()}/portaldocliente/completar/${data.portal_token}`;
      setQuickModal(false);
      setShareModal({ open: true, nome: data.nome, telefone: data.telefone || undefined, url });
    } catch (e: any) {
      const msg = e?.message || '';
      let friendly = 'Erro ao criar cadastro.';
      if (msg.includes('uniq_pacientes_terapeuta_email')) friendly = 'Já existe um paciente ativo com este e-mail.';
      toast({ title: 'Erro', description: friendly, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (p: Paciente) => {
    setForm({
      nome: p.nome, sobrenome: p.sobrenome, email: p.email || '',
      telefone: p.telefone || '', data_nascimento: p.data_nascimento || '',
      genero: p.genero || '', cpf: p.cpf ? maskCPF(p.cpf) : '',
      cep: (p as any).cep ? maskCEP((p as any).cep) : '',
      endereco: p.endereco || '',
      endereco_numero: (p as any).endereco_numero || '',
      endereco_complemento: (p as any).endereco_complemento || '',
      bairro: (p as any).bairro || '',
      cidade: (p as any).cidade || '',
      uf: (p as any).uf || '',
      queixa_principal: (p as any).queixa_principal || '', observacoes: p.observacoes || '',
      responsavel_id: (p as any).responsavel_id || '',
      tipo_pagamento: ((p as any).tipo_pagamento as TipoPagamento) || 'particular',
      plano_saude: (p as any).plano_saude || '',
      convenio_id: (p as any).convenio_id || '',
      carteirinha: (p as any).carteirinha || '',
      codigos_cassi: Array.isArray((p as any).codigos_cassi) ? (p as any).codigos_cassi : [],
      guias_por_mes: Number((p as any).guias_por_mes) >= 2 ? 2 : 1,
      lgpd_aceite: !!(p as any).lgpd_aceite_em,
      contato_emergencia_nome: (p as any).contato_emergencia_nome || '',
      contato_emergencia_telefone: (p as any).contato_emergencia_telefone || '',
      contato_emergencia_parentesco: (p as any).contato_emergencia_parentesco || '',
      alergias: (p as any).alergias || '',
      medicamentos_uso: (p as any).medicamentos_uso || '',
      condicoes_preexistentes: (p as any).condicoes_preexistentes || '',
      origem_lead: (p as any).origem || '',
    });
    setModal({ open: true, paciente: p });
  };

  const handleSave = async () => {
    const parsed = PacienteSchema.safeParse(form);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Dados inválidos';
      return toast({ title: firstError, variant: 'destructive' });
    }
    if (!modal.paciente && !form.lgpd_aceite) {
      return toast({ title: 'É obrigatório confirmar o aceite LGPD do paciente', variant: 'destructive' });
    }
    setSubmitting(true);
    try {
      let pacienteId = modal.paciente?.id;
      const validated = parsed.data;
      const convenioSel = form.tipo_pagamento === 'plano' ? convenios.find((c: any) => c.id === form.convenio_id) : null;
      const payload: any = {
        nome: validated.nome!,
        sobrenome: validated.sobrenome!,
        email: validated.email ?? null,
        telefone: validated.telefone ?? null,
        data_nascimento: validated.data_nascimento ?? null,
        genero: validated.genero ?? null,
        cpf: validated.cpf ?? null,
        cep: validated.cep ?? null,
        endereco: validated.endereco ?? null,
        endereco_numero: validated.endereco_numero ?? null,
        endereco_complemento: validated.endereco_complemento ?? null,
        bairro: validated.bairro ?? null,
        cidade: validated.cidade ?? null,
        uf: validated.uf ?? null,
        observacoes: validated.observacoes ?? null,
        queixa_principal: validated.queixa_principal ?? null,
        contato_emergencia_nome: validated.contato_emergencia_nome ?? null,
        contato_emergencia_telefone: validated.contato_emergencia_telefone ?? null,
        contato_emergencia_parentesco: validated.contato_emergencia_parentesco ?? null,
        alergias: validated.alergias ?? null,
        medicamentos_uso: validated.medicamentos_uso ?? null,
        condicoes_preexistentes: validated.condicoes_preexistentes ?? null,
        terapeuta_id: user!.id,
        responsavel_id: form.responsavel_id || null,
        tipo_pagamento: form.tipo_pagamento,
        convenio_id: convenioSel?.id || null,
        plano_saude: convenioSel?.nome || null,
      };
      // CASSI: carteirinha + códigos habituais (também editáveis pelo Controle
      // CASSI). Só entram no payload quando o cliente é CASSI — o cadastro comum
      // não toca nessas colunas.
      if (/cassi/i.test(convenioSel?.nome || '')) {
        payload.carteirinha = form.carteirinha.trim() || null;
        payload.codigos_cassi = form.codigos_cassi;
        payload.guias_por_mes = form.guias_por_mes;
      }
      if (!modal.paciente) {
        payload.origem = form.origem_lead || 'cadastro_manual';
        // Todo cliente novo já nasce com link de acesso ao portal — assim nunca
        // fica sem link (o cadastro rápido já fazia; o cadastro completo faltava).
        payload.portal_token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      } else if (form.origem_lead) {
        payload.origem = form.origem_lead;
      }
      if (!modal.paciente && form.lgpd_aceite) {
        payload.lgpd_aceite_em = new Date().toISOString();
        payload.lgpd_versao = '1.0';
      }
      if (pacienteId) {
        const { error } = await supabase.from('pacientes').update(payload).eq('id', pacienteId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('pacientes').insert(payload).select().single();
        if (error) throw error;
        pacienteId = data.id;
        pinRecent(data.id);
        // Registra termo de consentimento LGPD
        try {
          await supabase.from('termos_consentimento').insert({
            paciente_id: pacienteId,
            terapeuta_id: user!.id,
            tipo: 'lgpd',
            versao: '1.0',
            texto_termo: 'Autorizo o tratamento dos meus dados pessoais e de saúde para fins clínicos e administrativos, conforme a Lei Geral de Proteção de Dados (LGPD).',
            aceito: true,
            data_aceite: new Date().toISOString(),
          });
        } catch { /* não bloqueia */ }
      }
      qc.invalidateQueries({ queryKey: ['pacientes-com-servicos'] });
      toast({ title: modal.paciente ? 'Paciente atualizado!' : 'Paciente cadastrado!' });
      setModal({ open: false });
    } catch (e: any) {
      const msg = e?.message || '';
      let friendly = msg;
      if (msg.includes('uniq_pacientes_terapeuta_cpf')) friendly = 'Já existe um paciente ativo com este CPF.';
      else if (msg.includes('uniq_pacientes_terapeuta_email')) friendly = 'Já existe um paciente ativo com este e-mail.';
      else if (msg.toLowerCase().includes('cpf inválido')) friendly = 'CPF inválido. Verifique os dígitos.';
      toast({ title: 'Erro ao salvar', description: friendly, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (p: Paciente) => {
    if (!confirm(`EXCLUIR DEFINITIVAMENTE ${p.nome} ${p.sobrenome}?\n\nIsso apagará TODO o histórico, avaliações, agendamentos e links deste paciente. Esta ação é IRREVERSÍVEL.`)) return;
    try {
      const { error } = await (supabase as any).rpc('excluir_paciente_completo', { p_paciente_id: p.id });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['pacientes-com-servicos'] });
      toast({ title: 'Paciente excluído definitivamente' });
    } catch (e: any) {
      const msg = e?.message || '';
      let friendly = msg;
      if (msg.includes('sem_permissao')) friendly = 'Você não tem permissão para excluir este paciente.';
      else if (msg.includes('paciente_nao_encontrado')) friendly = 'Paciente não encontrado.';
      toast({ title: 'Erro ao excluir', description: friendly, variant: 'destructive' });
    }
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

  // Contagens dos marcadores (CASSI, com responsável, vitrine) para os chips.
  const markerCounts = useMemo(() => ({
    cassi: pacientes.filter(p => /cassi/i.test(String((p as any).plano_saude || ''))).length,
    comResponsavel: pacientes.filter(p => (p as any).responsavel_id).length,
    vitrine: pacientes.filter(p => ehVitrine(p)).length,
  }), [pacientes, vitrineUserIds]);

  // Nº de sessões por paciente (para o mini-stat na linha)
  const sessoesCount = useMemo(() => {
    const m: Record<string, number> = {};
    sessoes.forEach((s: any) => { m[s.paciente_id] = (m[s.paciente_id] || 0) + 1; });
    return m;
  }, [sessoes]);

  // Próxima sessão futura de cada paciente
  const proximaSessao = useMemo(() => {
    const now = new Date();
    const m: Record<string, string> = {};
    todosAgendamentos.forEach((a: any) => {
      if (a.status === 'cancelado' || !a.paciente_id) return;
      const d = new Date(a.data_inicio);
      if (d <= now) return;
      if (!m[a.paciente_id] || new Date(m[a.paciente_id]) > d) m[a.paciente_id] = a.data_inicio;
    });
    return m;
  }, [todosAgendamentos]);

  // Pacientes sem consulta há mais de 30 dias (KPI)
  const semConsulta30d = useMemo(() => {
    const now = new Date();
    return pacientes.filter(p => {
      const u = ultimosAgendamentos[p.id];
      return !u || differenceInDays(now, new Date(u.data)) > 30;
    }).length;
  }, [pacientes, ultimosAgendamentos]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    const list = pacientes.filter(p => {
      if (q) {
        const nome = (p.nome || '').toLowerCase();
        const sobrenome = (p.sobrenome || '').toLowerCase();
        const full = `${nome} ${sobrenome}`.trim();
        // 1 letra: começar por ela em nome OU sobrenome
        // 2+ chars: substring em nome completo, email ou telefone
        const matchSearch = q.length === 1
          ? nome.startsWith(q) || sobrenome.startsWith(q)
          : full.includes(q)
            || (p.email || '').toLowerCase().includes(q)
            || (p.telefone || '').toLowerCase().includes(q);
        if (!matchSearch) return false;
      }
      if (filterServico !== 'todos' && !getServicosForPaciente(p.id).includes(filterServico)) return false;
      if (['novo', 'recorrente', 'a_pagar'].includes(chip) && getClassificacao(p.id, p.created_at) !== chip) return false;
      if (chip === 'cassi' && !/cassi/i.test(String((p as any).plano_saude || ''))) return false;
      if (chip === 'prof' && !(p as any).responsavel_id) return false;
      if (chip === 'vitrine' && !ehVitrine(p)) return false;
      return true;
    });
    // Ordem alfabética estável em pt-BR (insensível a acento/caixa), por nome
    // completo. É o padrão e o que vale sempre durante uma busca.
    const cmpNome = (a: Paciente, b: Paciente) =>
      `${a.nome || ''} ${a.sobrenome || ''}`.trim()
        .localeCompare(`${b.nome || ''} ${b.sobrenome || ''}`.trim(), 'pt-BR', { sensitivity: 'base', numeric: true });
    const agora = Date.now();
    const UMA_HORA = 3600_000;
    // Cadastrado na última 1h (por created_at → persiste após recarregar) ou
    // acabado de criar (pin imediato). Depois de 1h volta à ordem normal.
    const ehRecente = (p: Paciente) =>
      recentlyAddedIds.includes(p.id) || (agora - new Date(p.created_at).getTime() < UMA_HORA);
    return [...list].sort((a, b) => {
      // Durante a busca, resultado sempre em ordem alfabética pura.
      if (q) return cmpNome(a, b);
      // Fora da busca, recém-cadastrados (1h) no topo, o mais novo primeiro.
      const aRec = ehRecente(a);
      const bRec = ehRecente(b);
      if (aRec !== bRec) return aRec ? -1 : 1;
      if (aRec && bRec) return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'nome') return cmpNome(a, b);
      if (sortBy === 'created_at') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'ultimo_agendamento') {
        const da = ultimosAgendamentos[a.id]?.data || '1900-01-01';
        const db = ultimosAgendamentos[b.id]?.data || '1900-01-01';
        return new Date(db).getTime() - new Date(da).getTime();
      }
      return 0;
    });
  }, [pacientes, debouncedSearch, filterServico, chip, vitrineUserIds, sortBy, ultimosAgendamentos, getClassificacao, recentlyAddedIds]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="container py-4 sm:py-6 max-w-6xl">
          <div className="mb-5 sm:mb-7 space-y-2">
            <div className="h-3 w-20 bg-muted/60 rounded animate-pulse" />
            <div className="h-8 w-48 bg-muted/60 rounded animate-pulse" />
          </div>
          <SkeletonList rows={6} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-4 sm:py-6 max-w-6xl">
        {/* Hero — clean & airy */}
        <div className="mb-5 sm:mb-7">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="eyebrow-accent mb-1.5">Cadastro</div>
              <h1 className="h-page">Pacientes</h1>
              <p className="text-caption mt-1">
                {pacientes.length} {pacientes.length === 1 ? 'cadastrado' : 'cadastrados'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-10 w-10 rounded-xl" aria-label="Mais ações">
                    <MoreHorizontal className="icon-sm" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem disabled={pacientes.length === 0} onClick={() => setPortalOpen(true)}>
                    <MessageCircle className="icon-sm mr-2" /> Enviar portal (WhatsApp)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={filtered.length === 0}
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
                  >
                    <Download className="icon-sm mr-2" /> Exportar CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={openQuick} variant="outline" className="rounded-xl gap-2 h-10" size="sm" title="Cadastro rápido: só nome, e-mail e celular. O paciente completa pelo portal.">
                <Zap className="icon-sm" /> <span className="hidden sm:inline">Cadastro rápido</span><span className="sm:hidden">Rápido</span>
              </Button>
              <Button onClick={openNew} className="rounded-xl gap-2 rounded-xl h-10" size="sm">
                <Plus className="icon-sm" /> <span className="hidden sm:inline">Novo paciente</span><span className="sm:hidden">Novo</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Main Tabs — só ícones (rótulo vira title/aria) ──
            O Zap tem lugar próprio no menu; aqui ficam só Clientes e Financeiro. */}
        <div className="flex gap-1 bg-muted/40 p-1 rounded-xl mb-5">
          {([
            { id: 'clientes' as MainTab, label: 'Clientes', icon: Users },
            { id: 'financeiro' as MainTab, label: 'Financeiro', icon: DollarSign },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveMainTab(tab.id)}
              title={tab.label}
              aria-label={tab.label}
              className={cn(
                'flex-1 flex items-center justify-center py-2 rounded-lg transition-all',
                activeMainTab === tab.id
                  ? 'bg-background text-primary shadow-xs ring-1 ring-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="h-5 w-5" />
            </button>
          ))}
        </div>

        {/* ── Tab Content ── */}
        {activeMainTab === 'financeiro' && (
          <Suspense fallback={<div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <PlanoGate feature="financeiro_avancado" title="Financeiro avançado" description="Conciliação, despesas, faturamento TISS e relatórios financeiros estão nos planos superiores.">
              <FinanceiroPage embedded />
            </PlanoGate>
          </Suspense>
        )}

        {activeMainTab === 'clientes' && (
        <>
        {/* ── KPIs compactos: uma linha de chips (rolável no mobile) — filtram a lista ── */}
        <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
          {([
            { key: 'todos' as const, label: 'Ativos', value: pacientes.length, gold: false, dot: '' },
            { key: 'novo' as const, label: 'Novos 30d', value: classificationCounts.novo || 0, gold: true, dot: 'hsl(152 55% 42%)' },
            { key: 'recorrente' as const, label: 'Recorrentes', value: classificationCounts.recorrente || 0, gold: false, dot: 'hsl(210 80% 52%)' },
            { key: 'a_pagar' as const, label: 'A pagar', value: classificationCounts.a_pagar || 0, gold: true, dot: 'hsl(30 90% 52%)' },
            { key: '__sem' as const, label: 'Sem consulta 30d', value: semConsulta30d, gold: false, dot: 'hsl(220 12% 66%)' },
          ]).map(k => {
            const clickable = k.key !== '__sem';
            const active = clickable && chip === k.key;
            return (
              <button
                key={k.label}
                disabled={!clickable}
                onClick={() => { if (clickable) setChip(active ? 'todos' : k.key); }}
                className={cn(
                  'shrink-0 flex items-center gap-1.5 rounded-full border pl-3 pr-2.5 py-1.5 transition-colors',
                  active
                    ? 'border-primary/50 bg-muted/40 ring-1 ring-primary/20'
                    : 'border-border/40 bg-card',
                  clickable ? 'hover:border-primary/40 hover:bg-muted/20' : 'cursor-default',
                )}
              >
                {k.dot && <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: k.dot }} />}
                <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">{k.label}</span>
                <span className={cn('kpi-hero tabular-nums leading-none text-sm', k.gold ? 'text-gradient-gold' : 'text-foreground')}>
                  {k.value}
                </span>
              </button>
            );
          })}

          {/* Marcadores (ligam/desligam): CASSI, por profissional responsável, vitrine */}
          {([
            { key: 'cassi' as const, label: 'Plano CASSI', icon: ShieldCheck, value: markerCounts.cassi, active: chip === 'cassi', toggle: () => setChip(c => c === 'cassi' ? 'todos' : 'cassi') },
            { key: 'prof' as const, label: 'Por profissional', icon: UserCheck, value: markerCounts.comResponsavel, active: chip === 'prof', toggle: () => setChip(c => c === 'prof' ? 'todos' : 'prof') },
            { key: 'vitrine' as const, label: 'Vitrine', icon: Store, value: markerCounts.vitrine, active: chip === 'vitrine', toggle: () => setChip(c => c === 'vitrine' ? 'todos' : 'vitrine') },
          ]).map(k => (
            <button
              key={k.key}
              onClick={k.toggle}
              className={cn(
                'shrink-0 flex items-center gap-1.5 rounded-full border pl-3 pr-2.5 py-1.5 transition-colors hover:border-primary/40 hover:bg-muted/20',
                k.active
                  ? 'border-primary/50 bg-muted/40 ring-1 ring-primary/20'
                  : 'border-border/40 bg-card',
              )}
            >
              <k.icon className={cn('h-3.5 w-3.5 shrink-0', k.active ? 'text-primary' : 'text-muted-foreground')} />
              <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">{k.label}</span>
              <span className="kpi-hero tabular-nums leading-none text-sm text-foreground">{k.value}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-52">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary pointer-events-none z-10" />
            <Input
              placeholder="Buscar paciente..."
              className="pl-12 h-11 bg-primary/5 border-2 border-primary/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 placeholder:text-primary/60 font-medium shadow-sm transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-48">
              <ArrowUpDown className="icon-sm mr-1.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nome">Nome (A-Z)</SelectItem>
              <SelectItem value="created_at">Mais recentes</SelectItem>
              <SelectItem value="ultimo_agendamento">Última consulta</SelectItem>
            </SelectContent>
          </Select>
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
              const pend = pendenciasPorPaciente[p.id];
              const proxima = proximaSessao[p.id];
              const nSessoes = sessoesCount[p.id] || 0;
              return (
                <div key={p.id} className="clinical-card group relative overflow-hidden p-3 sm:p-4 pl-4 sm:pl-5 hover:shadow-md hover:-translate-y-0.5 hover:border-[hsl(var(--gold)/0.45)] transition-all cursor-pointer" onClick={() => navigate(`/pacientes/${p.id}`)}>
                  {/* Faixa lateral na cor do status */}
                  <span className={cn('absolute left-0 top-0 bottom-0 w-1', status.color)} aria-hidden />
                  <div className="flex items-center gap-3 sm:gap-4">
                    {/* Avatar com gradiente + ponto de status */}
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-sm shadow-sm">
                        {p.nome[0]}{p.sobrenome?.[0] || ''}
                      </div>
                      <div className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card', status.color)} title={status.label} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{p.nome} {p.sobrenome}</span>
                        {/* Selo Vitrine — paciente que chegou pelo marketplace */}
                        {ehVitrine(p) && (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1 border font-medium border-[hsl(var(--gold)/0.4)] bg-[hsl(var(--gold)/0.1)] text-amber-700">
                            <Store className="h-3 w-3" /> Vitrine
                          </Badge>
                        )}
                        {/* Selo Plano de saúde */}
                        {(p as any).tipo_pagamento === 'plano' && (
                          <Badge variant="outline" className="text-[10px] h-5 gap-1 border font-medium border-sky-300 bg-sky-50 text-sky-700">
                            <ShieldCheck className="h-3 w-3" /> {(p as any).plano_saude || 'Plano de saúde'}
                          </Badge>
                        )}
                        {/* Selo Responsável — profissional vinculado ao paciente */}
                        {(p as any).responsavel_id && (() => {
                          const resp = membrosEquipe.find(m => m.id === (p as any).responsavel_id);
                          if (!resp) return null;
                          return (
                            <Badge variant="outline" className="text-[10px] h-5 gap-1 border font-medium border-violet-300 bg-violet-50 text-violet-700">
                              <UserCheck className="h-3 w-3" /> {resp.nome}
                            </Badge>
                          );
                        })()}
                        {/* Chip de classificação (sempre visível, com bolinha) */}
                        <Badge variant="outline" className={cn('text-[10px] h-5 gap-1 border font-medium', tagCfg.bgColor, tagCfg.color)}>
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: tagCfg.dot }} />
                          {tagCfg.label}
                        </Badge>
                        {(() => {
                          // Mostra só o badge de maior prioridade inline; o resto fica acessível via tooltip "+N".
                          const candidatos: { key: string; node: React.ReactNode }[] = [];
                          if (pend && pend.count > 0) {
                            candidatos.push({
                              key: 'pend',
                              node: (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 bg-amber-50 text-amber-800 border-amber-300 gap-1 animate-pulse"
                                >
                                  <Bell className="h-2.5 w-2.5" /> {pend.count} pendência{pend.count > 1 ? 's' : ''}
                                </Badge>
                              ),
                            });
                          }
                          if ((p as any).cadastro_status === 'pendente_paciente') {
                            candidatos.push({
                              key: 'aguardando',
                              node: (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] h-5 bg-amber-50 text-amber-800 border-amber-300 gap-1 cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const url = `${getBaseUrl()}/portaldocliente/completar/${(p as any).portal_token}`;
                                    setShareModal({ open: true, nome: p.nome, telefone: p.telefone || undefined, url });
                                  }}
                                >
                                  <Clock className="h-2.5 w-2.5" /> Aguardando dados
                                </Badge>
                              ),
                            });
                          }
                          if (linkAtivo) {
                            candidatos.push({
                              key: 'link',
                              node: (
                                <Badge variant="outline" className="text-[10px] h-5 bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                                  <Link2 className="h-2.5 w-2.5" /> {diasRestantes}d
                                </Badge>
                              ),
                            });
                          }
                          if (candidatos.length === 0) return null;
                          const [principal, ...resto] = candidatos;
                          return (
                            <>
                              {pend && pend.count > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>{principal.node}</TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-xs">
                                    <div className="space-y-1">
                                      <p className="font-semibold text-xs">Pendências no perfil:</p>
                                      {pend.titulos.map((t, i) => (
                                        <p key={i} className="text-xs">• {t}</p>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                principal.node
                              )}
                              {resto.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground cursor-default">
                                      +{resto.length}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="flex flex-col gap-1">
                                    {resto.map(c => c.node)}
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      <div className="hidden sm:flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                        {p.telefone ? (
                          <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.telefone}</span>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); openEdit(p); }}
                            className="flex items-center gap-1 text-rose-500 hover:underline font-medium"
                            title="Este paciente não tem telefone — sem WhatsApp"
                          >
                            <Phone className="h-3 w-3" />Sem WhatsApp — completar
                          </button>
                        )}
                        {proxima ? (
                          <span className="flex items-center gap-1 text-primary/80 font-medium"><CalendarDays className="h-3 w-3" />Próxima: {format(new Date(proxima), "dd/MM 'às' HH'h'")}</span>
                        ) : ultimoAg ? (
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />Sessão {formatDistanceToNow(new Date(ultimoAg.data), { addSuffix: true, locale: ptBR })}</span>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-400"><Clock className="h-3 w-3" />Sem consultas</span>
                        )}
                      </div>
                    </div>
                    {/* Mini-stat: nº de sessões */}
                    <div className="hidden sm:block text-right shrink-0 pr-1">
                      <div className="text-sm font-bold tabular-nums text-foreground leading-none">{nSessoes || '—'}</div>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground/70 mt-1">sessões</div>
                    </div>
                    {/* Actions — primary (WhatsApp) + overflow menu */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                      {p.telefone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-[#25D366] hover:bg-[#25D366]/10"
                          title="WhatsApp"
                          onClick={() => {
                            window.open(waUrl(p.telefone, `Olá ${p.nome}! 👋\n\n`), '_blank');
                          }}
                        >
                          <MessageCircle className="icon-sm" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground" title="Mais ações">
                            <MoreHorizontal className="icon-sm" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => navigate(`/pacientes/${p.id}`)}>
                            <User className="icon-sm mr-2" /> Abrir perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/agenda?novo=1&paciente=${p.id}`)}>
                            <CalendarPlus className="icon-sm mr-2" /> Agendar sessão
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(p)}>
                            <Edit className="icon-sm mr-2" /> Editar dados
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(p)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="icon-sm mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </>
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

            {/* Endereço (necessário para emissão fiscal/NFS-e) */}
            <div className="space-y-2 rounded-lg border border-border/40 p-3 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground">Endereço</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1 col-span-1">
                  <Label className="text-xs">CEP</Label>
                  <Input placeholder="00000-000" value={form.cep}
                    onChange={async e => {
                      const masked = maskCEP(e.target.value);
                      setForm(f => ({ ...f, cep: masked }));
                      const digits = masked.replace(/\D/g, '');
                      if (digits.length === 8) {
                        try {
                          const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
                          const d = await r.json();
                          if (!d.erro) {
                            setForm(f => ({
                              ...f,
                              endereco: d.logradouro || f.endereco,
                              bairro: d.bairro || f.bairro,
                              cidade: d.localidade || f.cidade,
                              uf: d.uf || f.uf,
                            }));
                          }
                        } catch { /* offline ok */ }
                      }
                    }}
                    maxLength={9} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Logradouro</Label>
                  <Input placeholder="Rua, avenida..." value={form.endereco}
                    onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Número</Label>
                  <Input placeholder="123" value={form.endereco_numero}
                    onChange={e => setForm(f => ({ ...f, endereco_numero: e.target.value }))} />
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs">Complemento</Label>
                  <Input placeholder="Apto, sala..." value={form.endereco_complemento}
                    onChange={e => setForm(f => ({ ...f, endereco_complemento: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Bairro</Label>
                  <Input value={form.bairro}
                    onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cidade</Label>
                  <Input value={form.cidade}
                    onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">UF</Label>
                  <Input value={form.uf} maxLength={2}
                    onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Queixa Principal</Label>
              <Input placeholder="Ex: Dor lombar crônica, escoliose..." value={form.queixa_principal}
                onChange={e => setForm(f => ({ ...f, queixa_principal: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea placeholder="Outras notas relevantes..." rows={2} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>

            {/* ── Saúde rápida ────────────────────────────────── */}
            <div className="space-y-3 p-3 rounded-lg border border-dashed bg-muted/20">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Saúde rápida</div>
              <div className="space-y-1">
                <Label className="text-xs">Alergias</Label>
                <Input placeholder="Ex: AAS, frutos do mar, látex..." value={form.alergias}
                  onChange={e => setForm(f => ({ ...f, alergias: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Medicamentos em uso</Label>
                <Input placeholder="Ex: Losartana 50mg, AAS 100mg..." value={form.medicamentos_uso}
                  onChange={e => setForm(f => ({ ...f, medicamentos_uso: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Condições pré-existentes</Label>
                <Input placeholder="Ex: HAS, DM2, escoliose..." value={form.condicoes_preexistentes}
                  onChange={e => setForm(f => ({ ...f, condicoes_preexistentes: e.target.value }))} />
              </div>
            </div>

            {/* ── Contato de emergência ───────────────────────── */}
            <div className="space-y-3 p-3 rounded-lg border border-dashed bg-muted/20">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contato de emergência</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input value={form.contato_emergencia_nome}
                    onChange={e => setForm(f => ({ ...f, contato_emergencia_nome: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Parentesco</Label>
                  <Input placeholder="Cônjuge, mãe..." value={form.contato_emergencia_parentesco}
                    onChange={e => setForm(f => ({ ...f, contato_emergencia_parentesco: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefone</Label>
                <Input inputMode="tel" placeholder="(11) 99999-9999" value={form.contato_emergencia_telefone}
                  onChange={e => setForm(f => ({ ...f, contato_emergencia_telefone: maskPhone(e.target.value) }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Profissional Responsável</Label>
              <Select
                value={form.responsavel_id || 'none'}
                onValueChange={v => setForm(f => ({ ...f, responsavel_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável definido</SelectItem>
                  {membrosEquipe.filter(m => m.ativo).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Pode ser alterado a qualquer momento.</p>
            </div>

            <div className="space-y-1">
              <Label>Origem do paciente</Label>
              <Select
                value={form.origem_lead || 'none'}
                onValueChange={v => setForm(f => ({ ...f, origem_lead: v === 'none' ? '' : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Como chegou até você?" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não informado</SelectItem>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="google">Google / Busca</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="evento">Evento / Palestra</SelectItem>
                  <SelectItem value="convenio">Convênio</SelectItem>
                  <SelectItem value="cadastro_manual">Cadastro manual</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Ajuda a medir canais de aquisição no CRM.</p>
            </div>


            <div className="space-y-2">
              <Label>Tipo de Atendimento</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo_pagamento: 'particular', plano_saude: '', convenio_id: '' }))}
                  className={cn(
                    'p-3 rounded-lg border text-sm font-medium transition-colors',
                    form.tipo_pagamento === 'particular'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent/30 text-foreground'
                  )}
                >
                  Particular
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo_pagamento: 'plano' }))}
                  className={cn(
                    'p-3 rounded-lg border text-sm font-medium transition-colors',
                    form.tipo_pagamento === 'plano'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-accent/30 text-foreground'
                  )}
                >
                  Plano de Saúde
                </button>
              </div>
              {form.tipo_pagamento === 'plano' && (
                <div className="pt-2 space-y-1">
                  <Label className="text-xs">Convênio</Label>
                  {convenios.length === 0 ? (
                    <div className="text-xs text-muted-foreground p-2 rounded-md border border-dashed">
                      Nenhum convênio cadastrado. Vá em <strong>Financeiro → Convênios</strong> para adicionar (ex: Unimed, Bradesco).
                    </div>
                  ) : (
                    <Select
                      value={form.convenio_id || ''}
                      onValueChange={v => setForm(f => ({ ...f, convenio_id: v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecionar convênio" /></SelectTrigger>
                      <SelectContent>
                        {convenios.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}{c.valor_padrao ? ` — R$ ${Number(c.valor_padrao).toFixed(2).replace('.', ',')}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    O valor e o repasse desse paciente serão preenchidos automaticamente em cada sessão.
                  </p>

                  {/* CASSI: carteirinha + códigos habituais (também editáveis no Controle CASSI) */}
                  {/cassi/i.test(convenios.find((c: any) => c.id === form.convenio_id)?.nome || '') && (
                    <div className="pt-2 mt-2 space-y-2 border-t border-border/40">
                      <div>
                        <Label className="text-xs">Carteirinha CASSI</Label>
                        <Input value={form.carteirinha} onChange={e => setForm(f => ({ ...f, carteirinha: e.target.value }))} placeholder="nº da carteirinha" />
                      </div>
                      <div>
                        <Label className="text-xs">Códigos habituais</Label>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {CODIGOS_CASSI.map(c => {
                            const on = form.codigos_cassi.includes(c.codigo);
                            return (
                              <button type="button" key={c.codigo}
                                onClick={() => setForm(f => ({ ...f, codigos_cassi: on ? f.codigos_cassi.filter(x => x !== c.codigo) : [...f.codigos_cassi, c.codigo] }))}
                                className={cn('text-[11px] px-2 py-1 rounded-full border', on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground')}>
                                {c.codigo} · {c.descricao}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Pré-preenchem as guias novas deste cliente no Controle CASSI.</p>
                      </div>
                      <div>
                        <Label className="text-xs">Guias por mês</Label>
                        <div className="flex gap-1.5 mt-1">
                          {[1, 2].map(n => (
                            <button type="button" key={n}
                              onClick={() => setForm(f => ({ ...f, guias_por_mes: n }))}
                              className={cn('flex-1 text-[12px] py-1.5 rounded-lg border font-medium', form.guias_por_mes === n ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-border text-muted-foreground')}>
                              {n} guia{n > 1 ? 's' : ''}/mês
                            </button>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">2/mês: o Controle CASSI avisa pra pedir a próxima guia ~13 dias após a resposta da CASSI.</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {!modal.paciente && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3">
                <Checkbox
                  id="lgpd-aceite"
                  checked={form.lgpd_aceite}
                  onCheckedChange={c => setForm(f => ({ ...f, lgpd_aceite: !!c }))}
                />
                <Label htmlFor="lgpd-aceite" className="text-[11px] leading-snug cursor-pointer text-foreground">
                  <strong>Aceite LGPD (obrigatório):</strong> O paciente autorizou o tratamento dos seus dados pessoais e de saúde para fins clínicos e administrativos, conforme a Lei Geral de Proteção de Dados.
                </Label>
              </div>
            )}
            {modal.paciente && (form.lgpd_aceite ? (
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400">✓ Termo LGPD já aceito</p>
            ) : (
              <p className="text-[11px] text-amber-600">⚠ Termo LGPD ainda não registrado para este paciente</p>
            ))}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setModal({ open: false })}>Cancelar</Button>
              <Button className="flex-1 rounded-xl" onClick={handleSave} disabled={submitting}>
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

      {/* Modal Cadastro Rápido */}
      <Dialog open={quickModal} onOpenChange={setQuickModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" /> Cadastro rápido
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Cadastre o essencial agora e envie um link para o paciente completar o restante (CPF, endereço, saúde) com calma em casa.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={quickForm.nome} onChange={e => setQuickForm(f => ({ ...f, nome: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sobrenome</Label>
                <Input value={quickForm.sobrenome} onChange={e => setQuickForm(f => ({ ...f, sobrenome: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={quickForm.email} onChange={e => setQuickForm(f => ({ ...f, email: e.target.value }))} className="text-[16px] sm:text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp / Telefone *</Label>
              <Input value={quickForm.telefone} onChange={e => setQuickForm(f => ({ ...f, telefone: maskPhone(e.target.value) }))} maxLength={15} className="text-[16px] sm:text-sm" placeholder="(11) 98765-4321" />
            </div>
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40 p-2">
              <Checkbox id="lgpd-quick" checked={quickForm.lgpd_aceite} onCheckedChange={c => setQuickForm(f => ({ ...f, lgpd_aceite: !!c }))} />
              <Label htmlFor="lgpd-quick" className="text-[11px] leading-snug cursor-pointer">
                <strong>Aceite LGPD:</strong> o paciente autorizou (verbalmente / em consulta) o tratamento dos dados pessoais e de saúde.
              </Label>
            </div>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setQuickModal(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleQuickSave} disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar e gerar link'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal Compartilhar Link de Cadastro Completo */}
      <Dialog open={shareModal.open} onOpenChange={o => setShareModal({ open: o })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" /> Enviar link de cadastro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Envie este link para <strong>{shareModal.nome}</strong> completar o cadastro (CPF, endereço, saúde, contato de emergência). Quando concluir, você recebe uma notificação.
            </p>
            <div className="p-3 rounded-lg bg-muted/40 border border-border break-all text-[11px] font-mono">
              {shareModal.url}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  if (shareModal.url) {
                    navigator.clipboard.writeText(shareModal.url);
                    toast({ title: 'Link copiado!' });
                  }
                }}
              >
                <Copy className="h-4 w-4" /> Copiar
              </Button>
              <Button
                className="gap-2"
                disabled={!shareModal.telefone}
                onClick={() => {
                  if (!shareModal.url || !shareModal.telefone) return;
                  const msg = `Olá ${shareModal.nome}! Para agilizar seu atendimento, complete seu cadastro neste link seguro:\n\n${shareModal.url}\n\nLeva menos de 3 minutos. 🙏`;
                  window.open(waUrl(shareModal.telefone, msg), '_blank');
                }}
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </Button>
            </div>
            {!shareModal.telefone && (
              <p className="text-[10px] text-amber-600">Cadastre um telefone para enviar pelo WhatsApp.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {portalOpen && (
        <EnviarPortalDialog
          pacientes={pacientes.map((p: any) => ({
            id: p.id, nome: p.nome, sobrenome: p.sobrenome,
            telefone: p.telefone, email: p.email, portal_token: p.portal_token,
          }))}
          onClose={() => setPortalOpen(false)}
        />
      )}

    </AppLayout>
  );
}
