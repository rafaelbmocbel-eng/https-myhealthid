import { useState, useMemo, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { getAgendaUrl, getBaseUrl, getPortalUrl } from '@/utils/linkUrls';
import { Navigate, useParams, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft, User, Mail, Phone, Calendar, FileText, Activity,
  CalendarDays, Link2, Copy, Loader2, Clock, MessageCircle,
  TrendingUp, AlignCenter, ExternalLink, ClipboardList, BarChart3, ChevronRight, ChevronDown,
  Plus, Trash2, Edit, Dumbbell, AlertTriangle, Droplets, Footprints, CalendarPlus,
  BedDouble, Cigarette, Wine, Armchair, Shield, Heart, Sparkles, DollarSign, Package, Target, LayoutDashboard, Smartphone,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isBefore, isAfter, startOfToday, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { useToast } from '@/hooks/use-toast';
import { useAgenda } from '@/hooks/useAgenda';
import { useLayoutConfig } from '@/contexts/LayoutConfigContext';
const QuestionariosComparacao = lazy(() => import('@/components/paciente/QuestionariosComparacao'));
const EvolucaoDashboard = lazy(() => import('@/components/paciente/EvolucaoDashboard'));
import { useEvolucaoPaciente } from '@/hooks/useEvolucaoPaciente';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { useNotasProntuario } from '@/hooks/useNotasProntuario';
import StatusClinicoBadge from '@/components/paciente/StatusClinicoBadge';
import { useAcessoClinicoPaciente } from '@/hooks/useAcessoClinicoPaciente';
import LinkActionsBar, { type LinkActionItem } from '@/components/paciente/LinkActionsBar';
import { PacienteSchema } from '@/lib/validations';
import { useEquipe } from '@/hooks/useEquipe';
import { useConvenios } from '@/hooks/useConvenios';
import PacienteAvatarUpload from '@/components/paciente/PacienteAvatarUpload';

// Conteúdo de abas/sheets/modais — só carrega quando o usuário abre.
// Mantém o chunk inicial do perfil pequeno (DocumentosModal sozinho puxa jspdf+html2canvas).
const PacienteDashboardIdentidade = lazy(() => import('@/components/paciente/PacienteDashboardIdentidade'));
const PacienteProtocolosTab = lazy(() => import('@/components/paciente/PacienteProtocolosTab'));
const ResumoConsultaPresencial = lazy(() => import('@/components/presencial/ResumoConsultaPresencial'));
const AvaliacaoVozAtual = lazy(() => import('@/components/voice/AvaliacaoVozAtual'));
const PortalControleTab = lazy(() => import('@/components/paciente/PortalControleTab'));
const ProntuarioTimeline = lazy(() => import('@/components/paciente/ProntuarioTimeline'));
const ProntuarioEstruturado = lazy(() => import('@/components/paciente/ProntuarioEstruturado'));
const JornadaPacienteCard = lazy(() => import('@/components/paciente/JornadaPacienteCard'));
const TimelineUnificada = lazy(() =>
  import('@/components/paciente/TimelineUnificada').then(m => ({ default: m.TimelineUnificada })),
);
const NpsSurveyCard = lazy(() => import('@/components/nps/NpsSurveyCard'));
const ResumoNarrativo = lazy(() => import('@/components/paciente/ResumoNarrativo'));
const PacoteSessoesManager = lazy(() => import('@/components/paciente/PacoteSessoesManager'));
const PacienteFinanceiroTab = lazy(() => import('@/components/paciente/PacienteFinanceiroTab'));
const CompartilharPacienteSheet = lazy(() => import('@/components/paciente/CompartilharPacienteSheet'));
const DocumentosModal = lazy(() => import('@/components/documentos/DocumentosModal'));
const WearableMonitorCard = lazy(() => import('@/components/perfil-paciente/WearableMonitorCard'));
const SinaisVitaisCard = lazy(() => import('@/components/medicina/SinaisVitaisCard'));
const DiagnosticosCID10Card = lazy(() => import('@/components/medicina/DiagnosticosCID10Card'));
const PrescricaoMedicaCard = lazy(() => import('@/components/medicina/PrescricaoMedicaCard'));
const ImportarExameCard = lazy(() => import('@/components/medicina/ImportarExameCard'));
const AntropometriaCard = lazy(() => import('@/components/educador/AntropometriaCard'));
const TestesFuncionaisCard = lazy(() => import('@/components/educador/TestesFuncionaisCard'));
const PlanoTreinoCard = lazy(() => import('@/components/educador/PlanoTreinoCard'));
const RecordatorioCard = lazy(() => import('@/components/nutricao/RecordatorioCard'));
const PlanoAlimentarCard = lazy(() => import('@/components/nutricao/PlanoAlimentarCard'));
const DiretrizNutricionalCard = lazy(() => import('@/components/nutricao/DiretrizNutricionalCard'));
const DiretrizTreinoCard = lazy(() => import('@/components/educador/DiretrizTreinoCard'));
const EscalasPsicologiaCard = lazy(() => import('@/components/psicologia/EscalasPsicologiaCard'));
import { useLenteAtiva, temBloco } from '@/hooks/useLenteAtiva';

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

type TipoPagamento = 'particular' | 'plano';
type PlanoSaude = 'FUSEX' | 'CASSI' | 'TRT';
const PLANOS_SAUDE: PlanoSaude[] = ['FUSEX', 'CASSI', 'TRT'];


const SERVICOS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  metodo_identidade: { label: 'Avaliação (legado)', color: 'bg-muted text-muted-foreground border-border', icon: <Activity className="h-3 w-3" /> },
  cob_zero: { label: 'Estrutural (legado)', color: 'bg-muted text-muted-foreground border-border', icon: <AlignCenter className="h-3 w-3" /> },
  agenda_premium: { label: 'Agenda Premium', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <CalendarDays className="h-3 w-3" /> },
};

const LazyFallback = (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

export default function PacientePerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: acessoClinico } = useAcessoClinicoPaciente(id);
  const { data: lenteAtiva } = useLenteAtiva();
  const { config: layoutCfg } = useLayoutConfig();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const rawTab = searchParams.get('tab') || '';
  // Aba ativa: '' (Visão Integrada padrão) | presencial | diretrizes | evolucao-prontuario | portal
  const VALID_TABS = ['presencial', 'diretrizes', 'evolucao-prontuario', 'portal'];
  const normalizedTab = rawTab === 'prontuario' || rawTab === 'evolucao'
    ? 'evolucao-prontuario'
    : rawTab === 'avaliacoes' || rawTab === 'agenda' || rawTab === 'historico-avaliacoes' || rawTab === 'clinico' || rawTab === 'historico'
      ? 'presencial'
      : rawTab === 'protocolos'
        ? 'diretrizes'
        : rawTab === 'engajamento' || rawTab === 'chat'
          ? 'portal'
          : rawTab;
  const initialTab = VALID_TABS.includes(normalizedTab) ? normalizedTab : '';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const tabsSectionRef = useRef<HTMLDivElement | null>(null);
  // Sincroniza a aba ativa quando a URL muda (ex.: navigate após confirmar diretriz)
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);
  useEffect(() => {
    if (!initialTab) return;
    window.requestAnimationFrame(() => {
      tabsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [initialTab, location.search]);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { links, gerarLink, copiarLink, cancelarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { data: myidCount = 0 } = useQuery({
    queryKey: ['myid-count-paciente', id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('myid_avaliacoes')
        .select('id', { count: 'exact', head: true })
        .eq('paciente_id', id!)
        .eq('status', 'concluido');
      if (error) throw error;
      return count || 0;
    },
    enabled: !!id,
  });
  // Queries pesadas só quando a aba "Evolução / Prontuário" está aberta
  const evolucaoTabAtiva = activeTab === 'evolucao-prontuario';
  const { evolucoes: evolucoesId } = useEvolucaoPaciente(evolucaoTabAtiva ? id : undefined);
  const { notas: notasProntuario, isLoading: loadingNotas } = useNotasProntuario(evolucaoTabAtiva ? id : undefined);
  const [gerandoAgenda, setGerandoAgenda] = useState(false);
  const [gerandoMyIDLink, setGerandoMyIDLink] = useState(false);
  const [agendandoNovo, setAgendandoNovo] = useState(false);
  const [tratamentoAberto, setTratamentoAberto] = useState<string | null>(null);
  const [docsModalOpen, setDocsModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nome: '', sobrenome: '', email: '', telefone: '',
    data_nascimento: '', genero: '', cpf: '', endereco: '',
    queixa_principal: '', observacoes: '',
    responsavel_id: '', tipo_pagamento: 'particular' as TipoPagamento,
    plano_saude: '' as string,
    convenio_id: '' as string,
  });
  const [submittingEdit, setSubmittingEdit] = useState(false);
  const [statsExpanded, setStatsExpanded] = useState(false);
  const { membros: membrosEquipe } = useEquipe();
  const { convenios } = useConvenios();

  // Link MyID ativo (pendente)
  const { data: linksMyID = [], refetch: refetchLinksMyID } = useQuery({
    queryKey: ['links-myid-perfil', user?.id, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', id!)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
  });
  const linkMyIDAtivo = linksMyID[0];

  const gerarLinkMyID = async () => {
    if (!user) return;
    setGerandoMyIDLink(true);
    try {
      const token = Math.random().toString(36).substring(2, 12);
      const { error } = await supabase.from('myid_avaliacoes').insert({
        terapeuta_id: user.id,
        paciente_id: id!,
        token_acesso: token,
        status: 'pendente',
      });
      if (error) throw error;
      refetchLinksMyID();
      toast({ title: 'Link MyID gerado! ✅' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link MyID', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoMyIDLink(false);
    }
  };

  const { data: paciente, isLoading: loadingPac } = useQuery({
    queryKey: ['paciente-perfil', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*, paciente_servicos(id, servico, ativo)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return {
        ...data,
        _servicos: (data.paciente_servicos || []).filter((s: any) => s.ativo).map((s: any) => s.servico) as string[],
      };
    },
    enabled: !!user && !!id,
  });

  const { data: agendamentos = [], isLoading: loadingAg } = useQuery({
    queryKey: ['agendamentos-paciente', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agendamentos')
        .select('*')
        .eq('paciente_id', id!)
        .eq('terapeuta_id', user!.id)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
  });

  const { data: linksAvaliacao = [] } = useQuery({
    queryKey: ['links-av-perfil', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('paciente_id', id!)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
  });

  const { data: respostasPaciente = [] } = useQuery({
    queryKey: ['respostas-av-perfil', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('*')
        .eq('paciente_id', id!)
        .order('data_preenchimento', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id && evolucaoTabAtiva,
  });

  const { data: linksAgenda = [] } = useQuery({
    queryKey: ['links-agenda-perfil', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('paciente_id', id!)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
  });

  const { data: protocolos = [], isLoading: loadingProto } = useQuery({
    queryKey: ['protocolos-perfil', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos')
        .select('*')
        .eq('paciente_id', id!)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
  });

  const { data: sessoesPaciente = [] } = useQuery({
    queryKey: ['sessoes-paciente-perfil', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('controle_sessoes')
        .select('*')
        .eq('paciente_id', id!)
        .eq('terapeuta_id', user!.id)
        .order('data_sessao', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
  });

  const { data: pagamentosPac = [] } = useQuery({
    queryKey: ['pagamentos-perfil', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pagamentos_paciente')
        .select('valor, status')
        .eq('paciente_id', id!)
        .eq('terapeuta_id', user!.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
  });

  const finResumo = useMemo(() => {
    let pago = 0, pendente = 0;
    pagamentosPac.forEach((p: any) => {
      const v = Number(p.valor) || 0;
      if (p.status === 'pago' || p.status === 'confirmado') pago += v;
      else if (p.status === 'pendente') pendente += v;
    });
    return { pago, pendente };
  }, [pagamentosPac]);

  const fmtBRL = (n: number) =>
    n >= 1000
      ? `R$ ${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
      : `R$ ${n.toFixed(0)}`;

  const sessoesInfo = useMemo(() => {
    const realizadas = sessoesPaciente.filter((s: any) => s.status === 'realizada');
    const ultimaSessao = realizadas[0];
    const numeroAtual = ultimaSessao?.numero_sessao || 0;
    // Detect active package: group by tipo_atendimento or count
    const totalRealizadas = realizadas.length;
    return { numeroAtual, totalRealizadas, ultimaSessao };
  }, [sessoesPaciente]);

  // (query 'tratamentos-perfil' removida — não era consumida em lugar nenhum)

  // Calculate session metrics (must be before early returns)
  const sessionMetrics = useMemo(() => {
    let checks: Record<string, string> = {};
    try {
      checks = JSON.parse(localStorage.getItem('checks-all') || '{}');
    } catch { /* localStorage corrompido — segue sem checks */ }

    const atendidas = agendamentos.filter((ag: any) => checks[ag.id] === 'atendido').length;
    const faltas = agendamentos.filter((ag: any) => checks[ag.id] === 'faltou').length;
    return {
      total: agendamentos.length,
      atendidas,
      faltas
    };
  }, [agendamentos]);

  const { data: ultimoScoreKpi } = useQuery({
    queryKey: ['score-kpi', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('myid_score')
        .eq('paciente_id', id!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!id && !!user,
  });

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  if (loadingPac) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!paciente) {
    return (
      <AppLayout>
        <div className="container py-12 text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Paciente não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/pacientes')}>Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  const idade = paciente.data_nascimento
    ? Math.floor((Date.now() - new Date(paciente.data_nascimento).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  const statusColors: Record<string, string> = {
    confirmado: 'bg-emerald-100 text-emerald-700',
    pendente: 'bg-amber-100 text-amber-700',
    concluido: 'bg-blue-100 text-blue-700',
    cancelado: 'bg-red-100 text-red-700',
    faltou: 'bg-red-100 text-red-700',
    bloqueado: 'bg-muted text-muted-foreground',
  };

  // Links helpers
  const linkAvAtivo = linksAvaliacao.find((l: any) => l.status === 'ativo' && new Date(l.data_expiracao) > new Date());
  const linkAgendaAtivo = linksAgenda.find((l: any) => l.status === 'ativo' && new Date(l.data_expiracao) > new Date());
  const scoreCritico = ultimoScoreKpi?.myid_score != null && Number(ultimoScoreKpi.myid_score) < 50;

  const gerarLinkAgenda = async () => {
    if (!user) return;
    setGerandoAgenda(true);
    try {
      await supabase
        .from('links_agenda_paciente')
        .update({ status: 'cancelado' })
        .eq('paciente_id', id!)
        .eq('terapeuta_id', user.id)
        .eq('status', 'ativo');
      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 90);
      const { error } = await supabase.from('links_agenda_paciente').insert({
        paciente_id: id!,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links-agenda-perfil'] });
      toast({ title: 'Link de agenda gerado! ✅', description: 'Válido por 90 dias.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoAgenda(false);
    }
  };

  const copiarAgendaLink = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link de agenda copiado! 📋' });
  };

  const hoje = startOfToday();
  const agendamentosFuturos = agendamentos
    .filter((ag: any) => isAfter(parseISO(ag.data_inicio), hoje) || format(parseISO(ag.data_inicio), 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd'))
    .sort((a: any, b: any) => parseISO(a.data_inicio).getTime() - parseISO(b.data_inicio).getTime());
  const agendamentosPassados = agendamentos.filter((ag: any) => isBefore(parseISO(ag.data_inicio), hoje) && format(parseISO(ag.data_inicio), 'yyyy-MM-dd') !== format(hoje, 'yyyy-MM-dd'));
  const temAgendaFutura = agendamentosFuturos.length > 0;

  const handleDeletePaciente = async () => {
    if (!confirm(`EXCLUIR DEFINITIVAMENTE ${paciente.nome} ${paciente.sobrenome}?\n\nIsso apagará TODO o histórico, avaliações, agendamentos e links deste paciente. Esta ação é IRREVERSÍVEL.`)) return;

    try {
      const pId = paciente.id;
      // Deleção em Cascata
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

      toast({ title: 'Paciente excluído definitivamente' });
      navigate('/pacientes');
    } catch (e: any) {
      toast({ title: 'Erro ao excluir', description: e.message, variant: 'destructive' });
    }
  };

  // Quick schedule
  const agendarRapido = async () => {
    navigate(`/agenda`);
  };

  // ── Editar paciente ─────────────────────────────────────────────────
  const openEdit = () => {
    if (!paciente) return;
    setEditForm({
      nome: paciente.nome || '',
      sobrenome: paciente.sobrenome || '',
      email: paciente.email || '',
      telefone: paciente.telefone || '',
      data_nascimento: paciente.data_nascimento || '',
      genero: paciente.genero || '',
      cpf: paciente.cpf || '',
      endereco: paciente.endereco || '',
      queixa_principal: (paciente as any).queixa_principal || '',
      observacoes: paciente.observacoes || '',
      responsavel_id: (paciente as any).responsavel_id || '',
      tipo_pagamento: ((paciente as any).tipo_pagamento as TipoPagamento) || 'particular',
      plano_saude: (paciente as any).plano_saude || '',
      convenio_id: (paciente as any).convenio_id || '',
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!paciente || !user) return;
    const parsed = PacienteSchema.safeParse(editForm);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message || 'Dados inválidos';
      return toast({ title: firstError, variant: 'destructive' });
    }
    setSubmittingEdit(true);
    try {
      const validated = parsed.data;
      const payload: any = {
        nome: validated.nome!,
        sobrenome: validated.sobrenome!,
        email: validated.email ?? null,
        telefone: validated.telefone ?? null,
        data_nascimento: validated.data_nascimento ?? null,
        genero: validated.genero ?? null,
        cpf: validated.cpf ?? null,
        endereco: editForm.endereco || null,
        observacoes: validated.observacoes ?? null,
        responsavel_id: editForm.responsavel_id || null,
        tipo_pagamento: editForm.tipo_pagamento,
        convenio_id: editForm.tipo_pagamento === 'plano'
          ? (convenios.find((c: any) => c.id === editForm.convenio_id)?.id || null)
          : null,
        plano_saude: editForm.tipo_pagamento === 'plano'
          ? (convenios.find((c: any) => c.id === editForm.convenio_id)?.nome || null)
          : null,
      };
      const { error } = await supabase.from('pacientes').update(payload).eq('id', paciente.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['paciente-perfil', paciente.id] });
      qc.invalidateQueries({ queryKey: ['pacientes-com-servicos'] });
      toast({ title: 'Paciente atualizado! ✅' });
      setEditModalOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSubmittingEdit(false);
    }
  };

  return (
    <AppLayout>
      <div className="container py-4 sm:py-6 max-w-5xl px-3 sm:px-6">
        {/* ============ HERO HEADER ============ */}
        <div className="relative mb-4 sm:mb-5 overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          {/* Decorative gradient strip */}
          <div
            className="absolute inset-x-0 top-0 h-24 sm:h-28 opacity-90"
            style={{
              background:
                'linear-gradient(135deg, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary) / 0.05) 50%, hsl(190 85% 50% / 0.12) 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute -top-12 -right-10 w-44 h-44 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 70%)' }}
          />

          <div className="relative p-3">
            {/* ── Linha 1: navegação + todas as ações ───────────────────────── */}
            <div className="flex items-center gap-1 mb-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 -ml-1.5 text-muted-foreground hover:text-foreground shrink-0 px-2"
                onClick={() => navigate('/pacientes')}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Pacientes</span>
              </Button>

              <div className="flex-1" />

              {/* Agendar — ação primária */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 bg-background/80 backdrop-blur text-xs"
                    onClick={() => navigate(`/agenda?novo=1&paciente=${id}`)}
                  >
                    <CalendarPlus className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden xs:inline font-semibold">Agendar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Novo agendamento</TooltipContent>
              </Tooltip>

              {/* Portal — enviar link ao paciente */}
              {layoutCfg.header_portal && paciente.portal_token && (
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 px-2 bg-background/80 backdrop-blur text-xs"
                      onClick={() =>
                        paciente.telefone
                          ? window.open(
                              `https://wa.me/${paciente.telefone.replace(/\D/g, '')}?text=${encodeURIComponent(
                                `Olá ${paciente.nome}! 🩺\n\nAcesse seu Portal do Paciente:\n${getPortalUrl(paciente.portal_token!)}`,
                              )}`,
                              '_blank',
                            )
                          : (() => {
                              navigator.clipboard.writeText(getPortalUrl(paciente.portal_token!));
                              toast({ title: 'Link do Portal copiado! 🔗' });
                            })()
                      }
                    >
                      <Smartphone className="h-3.5 w-3.5 text-violet-600" />
                      <span className="hidden sm:inline font-semibold">Portal</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {paciente.telefone ? 'Enviar link do portal via WhatsApp' : 'Copiar link do portal'}
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Documentos */}
              {layoutCfg.header_docs && (
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 px-2 bg-background/80 backdrop-blur text-xs"
                    onClick={() => setDocsModalOpen(true)}
                  >
                    <FileText className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline font-semibold">Docs</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Atestados, recibos, declarações</TooltipContent>
              </Tooltip>
              )}

              {/* Compartilhar (MyID + Avatar + Resumo IA → WhatsApp) */}
              {layoutCfg.header_identidade && (
                <Suspense fallback={null}>
                  <CompartilharPacienteSheet
                    pacienteId={paciente.id}
                    pacienteNome={`${paciente.nome} ${paciente.sobrenome || ''}`.trim()}
                    pacienteTelefone={paciente.telefone}
                    terapeutaNome={user?.email?.split('@')[0] || 'Profissional'}
                  />
                </Suspense>
              )}


              {/* Editar e excluir — secundários */}
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={openEdit}>
                    <Edit className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Editar cadastro</TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10" onClick={handleDeletePaciente}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">Excluir paciente</TooltipContent>
              </Tooltip>
            </div>

            {/* ── Linha 2: identidade do paciente ───────────────────────────── */}
            <div className="flex items-center gap-3">
              <PacienteAvatarUpload
                folderId={paciente.id}
                pacienteId={paciente.id}
                avatarUrl={(paciente as any).avatar_url}
                nome={paciente.nome}
                sobrenome={paciente.sobrenome}
                size="md"
                editable={true}
                showLabel={false}
                onUpdated={() => qc.invalidateQueries({ queryKey: ['paciente', id] })}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground leading-tight truncate">
                    {paciente.nome} {paciente.sobrenome}
                  </h1>
                  {acessoClinico && (
                    <StatusClinicoBadge
                      status={acessoClinico.status}
                      diasRestantesCarencia={acessoClinico.diasRestantesCarencia}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                  {idade !== null && (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{idade} anos
                    </span>
                  )}
                  {paciente.genero && (
                    <><span className="text-muted-foreground/40">·</span>
                    <span className="capitalize">{paciente.genero}</span></>
                  )}
                  <span
                    className={cn(
                      'text-[10px] font-bold px-1.5 py-0.5 rounded leading-none',
                      (paciente as any).lgpd_aceite_em
                        ? 'bg-emerald-500 text-white'
                        : 'bg-yellow-400 text-yellow-900',
                    )}
                  >
                    LGPD
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ============ KPI STRIP — painel colapsável ============ */}
        {layoutCfg.mostrar_stats && (
          <div className="mb-3">
            {/* Barra compacta — sempre visível */}
            <button
              type="button"
              onClick={() => setStatsExpanded(e => !e)}
              className="w-full flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-left hover:bg-accent/30 transition-colors"
            >
              {/* Ponto de alerta se sem agenda */}
              {!agendamentosFuturos[0] && scoreCritico && (
                <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
              )}

              {/* Mini-resumo em linha */}
              <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden text-xs">
                <span className="flex items-center gap-1 text-muted-foreground shrink-0">
                  <Clock className="h-3 w-3" />
                  <span className="font-medium text-foreground">
                    {formatDistanceToNow(new Date(paciente.created_at), { locale: ptBR }).replace('cerca de ', '~')}
                  </span>
                </span>

                <span className="text-border">·</span>

                <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400 shrink-0">
                  <Activity className="h-3 w-3" />
                  <span className="font-medium">{myidCount} MyID</span>
                </span>

                <span className="text-border">·</span>

                {!agendamentosFuturos[0] ? (
                  <span className="flex items-center gap-1 text-red-500 shrink-0">
                    <AlertTriangle className="h-3 w-3" />
                    <span className="font-medium">Sem agenda</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-violet-600 dark:text-violet-400 shrink-0">
                    <CalendarDays className="h-3 w-3" />
                    <span className="font-medium">
                      {(() => {
                        const d = parseISO(agendamentosFuturos[0].data_inicio);
                        const dias = differenceInDays(d, hoje);
                        if (dias === 0) return 'Hoje';
                        if (dias === 1) return 'Amanhã';
                        return format(d, 'dd/MM', { locale: ptBR });
                      })()}
                    </span>
                  </span>
                )}

                <span className="text-border">·</span>

                <span className="flex items-center gap-1 text-primary shrink-0">
                  <Package className="h-3 w-3" />
                  <span className="font-medium">{sessoesInfo.totalRealizadas} sess.</span>
                </span>

                <span className="text-border hidden sm:inline">·</span>

                <span className="hidden sm:flex items-center gap-1 shrink-0 text-emerald-700 dark:text-emerald-400">
                  <DollarSign className="h-3 w-3" />
                  <span className="font-medium">
                    {finResumo.pendente > 0 ? `${fmtBRL(finResumo.pendente)} pend.` : 'Em dia'}
                  </span>
                </span>
              </div>

              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
                statsExpanded && "rotate-180"
              )} />
            </button>

            {/* Painel expandido — grid de cards */}
            {statsExpanded && (
              <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
                {/* Cliente há */}
                <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-card p-3 hover:shadow-sm transition-shadow">
                  <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Cliente há</div>
                    <div className="text-sm font-bold tracking-tight">
                      {formatDistanceToNow(new Date(paciente.created_at), { locale: ptBR }).replace('cerca de ', '~')}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      desde {format(parseISO(paciente.created_at), 'dd/MM/yy')}
                    </div>
                  </div>
                </div>

                {/* MyID */}
                <div className="flex items-center gap-2.5 rounded-xl border border-sky-200/70 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20 p-3 hover:shadow-sm transition-shadow">
                  <div className="h-7 w-7 rounded-lg bg-sky-100 dark:bg-sky-900/50 flex items-center justify-center shrink-0">
                    <Activity className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-400">MyID</div>
                    <div className="text-sm font-bold tracking-tight">
                      {myidCount > 0 ? `${myidCount} ${myidCount === 1 ? 'avaliação' : 'avaliações'}` : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{myidCount === 0 ? 'nenhuma ainda' : 'concluídas'}</div>
                  </div>
                </div>

                {/* Próxima sessão */}
                <div className={cn(
                  "flex items-center gap-2.5 rounded-xl border p-3 hover:shadow-sm transition-shadow",
                  !agendamentosFuturos[0] && scoreCritico
                    ? "border-red-200/70 bg-red-50/50 dark:border-red-800/40 dark:bg-red-950/20"
                    : "border-violet-200/70 bg-violet-50/50 dark:border-violet-800/40 dark:bg-violet-950/20"
                )}>
                  <div className={cn(
                    "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                    !agendamentosFuturos[0] && scoreCritico
                      ? "bg-red-100 dark:bg-red-900/50"
                      : "bg-violet-100 dark:bg-violet-900/50"
                  )}>
                    {!agendamentosFuturos[0] && scoreCritico
                      ? <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
                      : <CalendarDays className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    }
                  </div>
                  <div className="min-w-0">
                    <div className={cn(
                      "text-[10px] font-semibold uppercase tracking-wider",
                      !agendamentosFuturos[0] && scoreCritico
                        ? "text-red-600 dark:text-red-400"
                        : "text-violet-600 dark:text-violet-400"
                    )}>Próxima</div>
                    <div className="text-sm font-bold tracking-tight">
                      {agendamentosFuturos[0]
                        ? (() => {
                            const d = parseISO(agendamentosFuturos[0].data_inicio);
                            const dias = differenceInDays(d, hoje);
                            if (dias === 0) return 'Hoje';
                            if (dias === 1) return 'Amanhã';
                            if (dias < 7) return `em ${dias}d`;
                            return format(d, 'dd/MM', { locale: ptBR });
                          })()
                        : 'Sem agenda'}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {agendamentosFuturos[0]
                        ? format(parseISO(agendamentosFuturos[0].data_inicio), "HH:mm · dd/MM", { locale: ptBR })
                        : 'agende agora'}
                    </div>
                  </div>
                </div>

                {/* Sessões — abre Sheet */}
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/5 p-3 text-left hover:bg-primary/10 hover:shadow-sm hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 group"
                    >
                      <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                        <Package className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                          Sessões
                          {sessoesInfo.numeroAtual > 0 && (
                            <span className="font-normal normal-case tracking-normal text-muted-foreground">· nº{sessoesInfo.numeroAtual}</span>
                          )}
                          <ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                        </div>
                        <div className="text-sm font-bold tracking-tight">
                          {sessoesInfo.totalRealizadas > 0 ? sessoesInfo.totalRealizadas : '—'}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {sessoesInfo.totalRealizadas === 0
                            ? 'nenhuma ainda'
                            : sessoesInfo.totalRealizadas === 1
                              ? 'sessão realizada'
                              : 'sessões realizadas'}
                        </div>
                      </div>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-primary" /> Sessões e Pacotes
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 space-y-6">
                      <Suspense fallback={LazyFallback}>
                        <PacoteSessoesManager pacienteId={id!} />
                      </Suspense>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CalendarDays className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold text-sm">Próximas sessões ({agendamentosFuturos.length})</h3>
                        </div>
                        {loadingAg ? (
                          <div className="flex justify-center py-6">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          </div>
                        ) : agendamentosFuturos.length === 0 ? (
                          <EmptyState icon={<CalendarDays />} title="Nenhuma sessão agendada" subtitle="Use a Agenda para criar um novo agendamento." />
                        ) : (
                          <div className="space-y-2">
                            {agendamentosFuturos.slice(0, 10).map((ag: any) => (
                              <AgendamentoCard key={ag.id} ag={ag} statusColors={statusColors} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <h3 className="font-semibold text-sm">Histórico ({agendamentosPassados.length})</h3>
                        </div>
                        {agendamentosPassados.length === 0 ? (
                          <EmptyState icon={<Clock />} title="Sem histórico" subtitle="Sessões realizadas aparecerão aqui." />
                        ) : (
                          <div className="space-y-2">
                            {agendamentosPassados.slice(0, 15).map((ag: any) => (
                              <AgendamentoCard key={ag.id} ag={ag} statusColors={statusColors} muted />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                {/* Financeiro — abre Sheet */}
                <Sheet>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-2.5 rounded-xl border border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20 p-3 text-left hover:bg-emerald-50 hover:shadow-sm hover:border-emerald-300 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 group"
                    >
                      <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                          Financeiro
                          <ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
                        </div>
                        <div className="text-sm font-bold tracking-tight">
                          {finResumo.pago > 0 ? fmtBRL(finResumo.pago) : 'R$ 0'}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {finResumo.pendente > 0 ? `${fmtBRL(finResumo.pendente)} pendente` : 'em dia'}
                        </div>
                      </div>
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-600" /> Financeiro
                      </SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      <Suspense fallback={LazyFallback}>
                        <PacienteFinanceiroTab
                          pacienteId={id!}
                          pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                        />
                      </Suspense>
                    </div>
                  </SheetContent>
                </Sheet>
              </div>
            )}
          </div>
        )}

        {/* Observações inline (se houver) */}
        {paciente.observacoes && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
            <FileText className="icon-sm shrink-0 mt-0.5 text-amber-600" />
            <span className="leading-snug">
              <span className="font-semibold">Observações:</span> {paciente.observacoes}
            </span>
          </div>
        )}

        {/* Banner: rascunhos de diretriz IA aguardando aprovação */}
        {(() => {
          const rascunhos = (protocolos || []).filter(
            (p: any) => p.status === 'rascunho' && typeof p.origem === 'string' && p.origem.startsWith('ia_')
          );
          if (rascunhos.length === 0) return null;
          const primeiro = rascunhos[0];
          const origemLabel = primeiro.origem === 'ia_voz' ? 'Voz' : primeiro.origem === 'ia_escrita' ? 'Escrita' : primeiro.origem === 'ia_myid' ? 'MyID' : 'IA';
          return (
            <div className="mb-3 p-3 rounded-xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-900/20 dark:border-amber-700/40 flex items-start sm:items-center gap-3 flex-col sm:flex-row">
              <div className="flex items-start gap-2 flex-1">
                <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
                <div className="text-xs">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">
                    {rascunhos.length === 1
                      ? `Diretriz IA · ${origemLabel} aguardando aprovação`
                      : `${rascunhos.length} diretrizes IA aguardando aprovação`}
                  </p>
                  <p className="text-amber-800/80 dark:text-amber-300/80 leading-snug">
                    Revise, edite e ative para enviá-la oficialmente ao prontuário do paciente.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setActiveTab('diretrizes');
                  navigate(`/pacientes/${id}?tab=diretrizes&protocolo=${primeiro.id}`, { replace: true });
                }}
                className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white shrink-0 w-full sm:w-auto"
              >
                Revisar agora
                <ChevronRight className="icon-sm shrink-0" />
              </Button>
            </div>
          );
        })()}

        {/* ==== ABAS COMPLEMENTARES ==== */}
        <div ref={tabsSectionRef} className="scroll-mt-4">
        <Tabs
          value={activeTab || 'integrada'}
          onValueChange={(v) => {
            const next = v === 'integrada' ? '' : v === activeTab ? '' : v;
            setActiveTab(next);
            navigate(`/pacientes/${id}${next ? `?tab=${next}` : ''}`, { replace: true });
          }}
        >
          {(() => {
            const MAIN_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
              integrada: LayoutDashboard,
              presencial: Activity,
              diretrizes: Target,
              'evolucao-prontuario': ClipboardList,
              portal: Smartphone,
            };
            const visibleMainTabs = [
              { id: 'integrada', label: 'Visão Geral', visivel: true, ordem: -1 },
              ...layoutCfg.main_tabs.filter(t => t.visivel && t.id !== 'historico'),
            ];
            const mainGridCols = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'][Math.min(visibleMainTabs.length, 5)] ?? 'grid-cols-5';
            return (
          <TabsList className={`bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 p-1 rounded-2xl grid ${mainGridCols} h-auto gap-0.5 w-full mb-4 border border-primary/15 shadow-sm`}>
            {visibleMainTabs.map(tab => {
              const Icon = MAIN_TAB_ICONS[tab.id] || Activity;
              const compactCls = layoutCfg.tabs_compacto ? 'py-1.5 min-h-[34px]' : 'py-2.5 min-h-[50px]';
              return (
                <TabsTrigger key={tab.id} value={tab.id}
                  className={cn(
                    'gap-1 rounded-xl text-[11px] sm:text-xs font-semibold px-1 flex-col sm:flex-row transition-colors',
                    // Inativo: menos apagado + realce no hover
                    'text-foreground/70 hover:text-foreground hover:bg-background/60',
                    // Ativo: cor de acento + sombra e anel para destacar
                    'data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md data-[state=active]:ring-1 data-[state=active]:ring-primary/25 data-[state=active]:border data-[state=active]:border-primary/20 data-[state=active]:font-bold',
                    compactCls,
                  )}>
                  {layoutCfg.tabs_icone && <Icon className="h-4 w-4 shrink-0" />}
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
            );
          })()}

          {/* ==== VISÃO INTEGRADA — sempre visível como entrada padrão ==== */}
          {!activeTab && (
            <div className="mb-4 space-y-4">
              <Suspense fallback={LazyFallback}>
                <PacienteDashboardIdentidade
                  paciente={paciente as any}
                  onBack={() => navigate('/pacientes')}
                  subTab="integrada"
                />
              </Suspense>
            </div>
          )}

          {/* TAB: AVALIAÇÃO PRESENCIAL — Avatar 3D + Voz/Áudio/Escrita */}
          <TabsContent value="presencial" className="mt-4 space-y-4">
            <Suspense fallback={LazyFallback}>
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10 p-3">
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <Plus className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-foreground">Nova Avaliação</p>
                <p className="text-[11px] text-muted-foreground">Registre uma nova avaliação presencial ou por voz para este paciente.</p>
              </div>
            </div>
            {temBloco(lenteAtiva, 'vitais') && id && <SinaisVitaisCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'cid') && id && <DiagnosticosCID10Card pacienteId={id} />}
            {temBloco(lenteAtiva, 'prescricao') && id && <PrescricaoMedicaCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'exames') && id && <ImportarExameCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'antropometria') && id && <AntropometriaCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'testes_funcionais') && id && <TestesFuncionaisCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'plano_treino') && id && <PlanoTreinoCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'plano_treino') && id && <DiretrizTreinoCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'recordatorio') && id && <RecordatorioCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'plano_alimentar') && id && <PlanoAlimentarCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'plano_alimentar') && id && <DiretrizNutricionalCard pacienteId={id} />}
            {temBloco(lenteAtiva, 'escalas_psicologia') && id && <EscalasPsicologiaCard pacienteId={id} />}
            <AvaliacaoVozAtual
              pacienteId={id!}
              patientName={`${paciente.nome} ${paciente.sobrenome}`}
              serviceType="identidade"
            />
            <ResumoConsultaPresencial
              pacienteId={id!}
              patientName={`${paciente.nome} ${paciente.sobrenome}`}
              serviceType="identidade"
              onAssessmentComplete={() => {
                qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
                qc.invalidateQueries({ queryKey: ['avaliacoes-voz'] });
                qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest'] });
              }}
            />
            </Suspense>
          </TabsContent>

          {/* TAB: DIRETRIZES E TRATAMENTOS */}
          <TabsContent value="diretrizes" className="mt-4 space-y-6">
            <Suspense fallback={LazyFallback}>
              <PacienteProtocolosTab
                pacienteId={id!}
                pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                tipo="identidade"
              />
            </Suspense>
          </TabsContent>

          {/* TAB: EVOLUÇÃO E PRONTUÁRIOS */}
          <TabsContent value="evolucao-prontuario" className="mt-4 space-y-6">
            <Suspense fallback={LazyFallback}>
              {/* Prontuário estruturado: avaliação atual → histórico → diretriz vigente → sessões */}
              <ProntuarioEstruturado notas={notasProntuario} isLoading={loadingNotas} />

              {/* Resumo narrativo (IA) e registro cronológico completo — recolhidos */}
              <details className="rounded-xl border border-border/50 group">
                <summary className="cursor-pointer list-none px-3 py-2.5 flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  <FileText className="h-4 w-4" />
                  Resumo narrativo e registro cronológico completo
                  <span className="ml-auto text-[10px] group-open:hidden">expandir</span>
                  <span className="ml-auto text-[10px] hidden group-open:inline">recolher</span>
                </summary>
                <div className="px-3 pb-3 pt-1 space-y-5">
                  <ResumoNarrativo pacienteId={id!} notas={notasProntuario} />
                  <TimelineUnificada pacienteId={id!} />
                  <ProntuarioTimeline notas={notasProntuario} isLoading={loadingNotas} />
                </div>
              </details>
            </Suspense>

            {evolucoesId.length >= 2 ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Evolução — Avaliações</h3>
                </div>
                <Suspense fallback={LazyFallback}>
                  <EvolucaoDashboard evolucoes={evolucoesId} pacienteNome={`${paciente?.nome} ${paciente?.sobrenome}`} />
                </Suspense>
              </div>
            ) : (
              <EmptyState icon={<BarChart3 />} title="Dados insuficientes" subtitle="São necessárias pelo menos 2 avaliações para gerar o comparativo evolutivo." />
            )}

            {respostasPaciente.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Evolução — Questionários Remotos</h3>
                </div>
                <Suspense fallback={LazyFallback}>
                  <QuestionariosComparacao linksAvPaciente={linksAvaliacao} respostas={respostasPaciente} />
                </Suspense>
              </div>
            )}

            {myidCount < 2 && respostasPaciente.length === 0 && notasProntuario.length === 0 && (
              <EmptyState icon={<TrendingUp />} title="Sem dados para evolução" subtitle="Realize avaliações ou envie questionários remotos para acompanhar a evolução." />
            )}
          </TabsContent>

          {/* TAB: PORTAL — Controle dos espaços do cliente */}
          <TabsContent value="portal" className="mt-4 space-y-6">
            {paciente && (
              <Suspense fallback={LazyFallback}>
                <PortalControleTab
                  pacienteId={id!}
                  pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                  portalToken={paciente.portal_token}
                  telefone={paciente.telefone}
                  tipoConta={paciente.tipo_conta}
                />
                {/* Jornada do paciente — recolhida por padrão (a aba já é longa) */}
                <details className="rounded-xl border border-border/40 bg-card">
                  <summary className="cursor-pointer select-none px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                    🚀 Jornada do paciente — o que ele vê e cumpre (toque para abrir)
                  </summary>
                  <div className="px-3 pb-3">
                    <JornadaPacienteCard pacienteId={id!} />
                  </div>
                </details>
                <WearableMonitorCard
                  pacienteId={id!}
                  pacienteNome={paciente.nome}
                />
                <NpsSurveyCard pacienteId={id!} />
              </Suspense>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {paciente && (
        <>
          {/* Renderiza só quando aberto — evita baixar jspdf/html2canvas junto com a página */}
          {docsModalOpen && (
            <Suspense fallback={null}>
              <DocumentosModal
                open={docsModalOpen}
                onOpenChange={setDocsModalOpen}
                paciente={{
                  id: paciente.id,
                  nome: paciente.nome,
                  sobrenome: paciente.sobrenome,
                  cpf: paciente.cpf,
                  data_nascimento: (paciente as any).data_nascimento,
                  sexo: (paciente as any).sexo,
                }}
              />
            </Suspense>
          )}
          <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-4 w-4 text-primary" /> Editar Paciente
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nome *</Label>
                    <Input placeholder="Maria" value={editForm.nome} onChange={e => setEditForm(f => ({ ...f, nome: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Sobrenome</Label>
                    <Input placeholder="Silva" value={editForm.sobrenome} onChange={e => setEditForm(f => ({ ...f, sobrenome: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>E-mail</Label>
                  <Input type="email" placeholder="maria@email.com" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Telefone</Label>
                    <Input placeholder="(11) 98765-4321" value={editForm.telefone}
                      onChange={e => setEditForm(f => ({ ...f, telefone: maskPhone(e.target.value) }))}
                      maxLength={15} />
                  </div>
                  <div className="space-y-1">
                    <Label>Data de Nascimento</Label>
                    <Input
                      type="text"
                      placeholder="dd/mm/aaaa"
                      maxLength={10}
                      value={editForm.data_nascimento ? (() => {
                        if (/^\d{4}-\d{2}-\d{2}$/.test(editForm.data_nascimento)) {
                          const [y, m, d] = editForm.data_nascimento.split('-');
                          return `${d}/${m}/${y}`;
                        }
                        return editForm.data_nascimento;
                      })() : ''}
                      onChange={e => {
                        let v = e.target.value.replace(/[^\d/]/g, '');
                        const digits = v.replace(/\//g, '');
                        if (digits.length >= 5) {
                          v = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
                        } else if (digits.length >= 3) {
                          v = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                        }
                        setEditForm(f => ({ ...f, data_nascimento: v }));
                      }}
                      onBlur={e => {
                        const v = e.target.value;
                        const match = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        if (match) {
                          const [, d, m, y] = match;
                          const iso = `${y}-${m}-${d}`;
                          const date = new Date(iso);
                          if (!isNaN(date.getTime()) && date.getFullYear() === Number(y)) {
                            setEditForm(f => ({ ...f, data_nascimento: iso }));
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Gênero</Label>
                    <Select value={editForm.genero} onValueChange={v => setEditForm(f => ({ ...f, genero: v }))}>
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
                    <Input placeholder="123.456.789-00" value={editForm.cpf}
                      onChange={e => setEditForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))}
                      maxLength={14} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Endereço</Label>
                  <Input placeholder="Rua, número, bairro, cidade" value={editForm.endereco} onChange={e => setEditForm(f => ({ ...f, endereco: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Queixa Principal</Label>
                  <Input placeholder="Ex: Dor lombar crônica, escoliose..." value={editForm.queixa_principal}
                    onChange={e => setEditForm(f => ({ ...f, queixa_principal: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Observações</Label>
                  <Textarea placeholder="Histórico clínico, alergias..." rows={2} value={editForm.observacoes} onChange={e => setEditForm(f => ({ ...f, observacoes: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Profissional Responsável</Label>
                  <Select
                    value={editForm.responsavel_id || 'none'}
                    onValueChange={v => setEditForm(f => ({ ...f, responsavel_id: v === 'none' ? '' : v }))}
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

                <div className="space-y-2">
                  <Label>Tipo de Atendimento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, tipo_pagamento: 'particular', plano_saude: '', convenio_id: '' }))}
                      className={cn(
                        'p-3 rounded-lg border text-sm font-medium transition-colors',
                        editForm.tipo_pagamento === 'particular'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-accent/30 text-foreground'
                      )}
                    >
                      Particular
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm(f => ({ ...f, tipo_pagamento: 'plano' }))}
                      className={cn(
                        'p-3 rounded-lg border text-sm font-medium transition-colors',
                        editForm.tipo_pagamento === 'plano'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-accent/30 text-foreground'
                      )}
                    >
                      Plano de Saúde
                    </button>
                  </div>
                  {editForm.tipo_pagamento === 'plano' && (
                    <div className="pt-2 space-y-1">
                      <Label className="text-xs">Convênio</Label>
                      {convenios.length === 0 ? (
                        <div className="text-xs text-muted-foreground p-2 rounded-md border border-dashed">
                          Nenhum convênio cadastrado. Vá em <strong>Financeiro → Convênios</strong> para adicionar.
                        </div>
                      ) : (
                        <Select
                          value={editForm.convenio_id || ''}
                          onValueChange={v => setEditForm(f => ({ ...f, convenio_id: v }))}
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
                        O valor e o repasse serão preenchidos automaticamente em cada sessão.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setEditModalOpen(false)}>Cancelar</Button>
                  <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleSaveEdit} disabled={submittingEdit}>
                    {submittingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </>
      )}
      </div>
    </AppLayout >
  );
}

function AgendamentoCard({ ag, statusColors, muted }: { ag: any; statusColors: Record<string, string>; muted?: boolean }) {
  return (
    <div className={cn('clinical-card !p-3 flex items-center gap-3', muted && 'opacity-70')}>
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: ag.cor || 'hsl(var(--primary))' }}>
        <Clock className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">
            {format(parseISO(ag.data_inicio), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </span>
          <Badge variant="outline" className={cn('text-[10px] h-4', statusColors[ag.status] || '')}>
            {ag.status}
          </Badge>
          {ag.tipo_atendimento && (
            <Badge variant="outline" className="text-[10px] h-4">{ag.tipo_atendimento}</Badge>
          )}
        </div>
        {ag.titulo && <p className="text-xs text-muted-foreground mt-0.5">{ag.titulo}</p>}
        {ag.observacoes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{ag.observacoes}</p>}
      </div>
      <span className="text-xs text-muted-foreground shrink-0">
        {Math.round((new Date(ag.data_fim).getTime() - new Date(ag.data_inicio).getTime()) / 60000)} min
      </span>
    </div>
  );
}

function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
      <div className="h-10 w-10 mx-auto mb-3 opacity-30 flex items-center justify-center">{icon}</div>
      <p className="font-medium">{title}</p>
      <p className="text-sm mt-1">{subtitle}</p>
    </div>
  );
}
