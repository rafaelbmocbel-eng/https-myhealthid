import { useState, useMemo, useCallback } from 'react';
import { getAgendaUrl, getBaseUrl, getPortalUrl } from '@/utils/linkUrls';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  ArrowLeft, User, Mail, Phone, Calendar, FileText, Activity,
  CalendarDays, Link2, Copy, Loader2, Clock, MessageCircle,
  TrendingUp, AlignCenter, ExternalLink, ClipboardList, BarChart3, ChevronRight,
  Plus, Trash2, Edit, Dumbbell, AlertTriangle, Droplets, Footprints,
  BedDouble, Cigarette, Wine, Armchair, Shield, Heart, Sparkles, Stethoscope, DollarSign, Package, Target, LayoutDashboard, Smartphone,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isBefore, isAfter, startOfToday, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { useAvaliacoesIdentidade, useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';
import { useToast } from '@/hooks/use-toast';
import { useAgenda } from '@/hooks/useAgenda';
import QuestionariosComparacao from '@/components/paciente/QuestionariosComparacao';
import EvolucaoDashboard from '@/components/paciente/EvolucaoDashboard';
import { useEvolucaoPaciente } from '@/hooks/useEvolucaoPaciente';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import PacienteProtocolosTab from '@/components/paciente/PacienteProtocolosTab';
import AvaliacaoPresencial from '@/components/presencial/AvaliacaoPresencial';
import IndicesRiscoComprometimento from '@/components/paciente/IndicesRiscoComprometimento';
import PortalControleTab from '@/components/paciente/PortalControleTab';
import ProntuarioTimeline from '@/components/paciente/ProntuarioTimeline';
import { useNotasProntuario } from '@/hooks/useNotasProntuario';
import SoapNoteForm from '@/components/prontuario/SoapNoteForm';
import TermoConsentimentoLGPD from '@/components/prontuario/TermoConsentimentoLGPD';
import NpsSurveyCard from '@/components/nps/NpsSurveyCard';
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import ResumoNarrativo from '@/components/paciente/ResumoNarrativo';
import PacoteSessoesManager from '@/components/paciente/PacoteSessoesManager';
import PacienteFinanceiroTab from '@/components/paciente/PacienteFinanceiroTab';
import ChatPacienteTab from '@/components/chat/ChatPacienteTab';
import PacienteDashboardIdentidade from '@/components/paciente/PacienteDashboardIdentidade';
import LinkActionsBar, { type LinkActionItem } from '@/components/paciente/LinkActionsBar';
import DocumentosModal from '@/components/documentos/DocumentosModal';


const SERVICOS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  metodo_identidade: { label: 'Método Identidade', color: 'bg-primary/10 text-primary border-primary/20', icon: <Activity className="h-3 w-3" /> },
  cob_zero: { label: 'COB° ZERO', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <AlignCenter className="h-3 w-3" /> },
  agenda_premium: { label: 'Agenda Premium', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <CalendarDays className="h-3 w-3" /> },
};

export default function PacientePerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useMemo(() => [new URLSearchParams(window.location.search)], []);
  const rawTab = searchParams.get('tab') || '';
  // Aba ativa: '' (Visão Integrada padrão) | historico | diretrizes | evolucao-prontuario | portal
  const VALID_TABS = ['historico', 'diretrizes', 'evolucao-prontuario', 'portal'];
  const normalizedTab = rawTab === 'prontuario' || rawTab === 'evolucao'
    ? 'evolucao-prontuario'
    : rawTab === 'avaliacoes' || rawTab === 'agenda' || rawTab === 'historico-avaliacoes' || rawTab === 'clinico'
      ? 'historico'
      : rawTab === 'protocolos'
        ? 'diretrizes'
        : rawTab === 'engajamento' || rawTab === 'chat'
          ? 'portal'
          : rawTab;
  const initialTab = VALID_TABS.includes(normalizedTab) ? normalizedTab : '';
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { links, gerarLink, copiarLink, cancelarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { avaliacoes: avaliacoesId, isLoading: loadingId } = useAvaliacoesIdentidade(id);
  const { avaliacoes: avaliacoesCob, isLoading: loadingCob } = useAvaliacoesCobZero(id);
  const { evolucoes: evolucoesId } = useEvolucaoPaciente(id);
  const { notas: notasProntuario, isLoading: loadingNotas } = useNotasProntuario(id);
  const { data: avaliacoesVoz = [], isLoading: loadingVoz } = useQuery({
    queryKey: ['avaliacoes-voz', user?.id, id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('avaliacoes_voz')
        .select('*')
        .eq('paciente_id', id!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!id,
  });
  const [gerandoAgenda, setGerandoAgenda] = useState(false);
  const [gerandoMyIDLink, setGerandoMyIDLink] = useState(false);
  const [agendandoNovo, setAgendandoNovo] = useState(false);
  const [tratamentoAberto, setTratamentoAberto] = useState<string | null>(null);
  const [docsModalOpen, setDocsModalOpen] = useState(false);

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
    enabled: !!user && !!id,
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

  const sessoesInfo = useMemo(() => {
    const realizadas = sessoesPaciente.filter((s: any) => s.status === 'realizada');
    const ultimaSessao = realizadas[0];
    const numeroAtual = ultimaSessao?.numero_sessao || 0;
    // Detect active package: group by tipo_atendimento or count
    const totalRealizadas = realizadas.length;
    return { numeroAtual, totalRealizadas, ultimaSessao };
  }, [sessoesPaciente]);

  const { data: tratamentosMap = {} } = useQuery({
    queryKey: ['tratamentos-perfil', id, protocolos.map((p: any) => p.id).join(',')],
    queryFn: async () => {
      const protIds = protocolos.map((p: any) => p.id);
      if (protIds.length === 0) return {};
      const { data, error } = await (supabase as any)
        .from('protocolo_tratamentos')
        .select('*, tecnica:tecnica_id(nome, categoria, nivel_evidencia, descricao, indicacoes, contraindicacoes, complexidade, parametros)')
        .in('protocolo_id', protIds)
        .eq('ativo', true)
        .order('fase_numero');
      if (error) throw error;
      const map: Record<string, any[]> = {};
      (data || []).forEach((t: any) => {
        if (!map[t.protocolo_id]) map[t.protocolo_id] = [];
        map[t.protocolo_id].push(t);
      });
      return map;
    },
    enabled: protocolos.length > 0,
  });

  // Calculate session metrics (must be before early returns)
  const sessionMetrics = useMemo(() => {
    let checks: Record<string, string> = {};
    try {
      checks = JSON.parse(localStorage.getItem('checks-all') || '{}');
    } catch { }

    const atendidas = agendamentos.filter((ag: any) => checks[ag.id] === 'atendido').length;
    const faltas = agendamentos.filter((ag: any) => checks[ag.id] === 'faltou').length;
    return {
      total: agendamentos.length,
      atendidas,
      faltas
    };
  }, [agendamentos]);

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
  const agendamentosFuturos = agendamentos.filter((ag: any) => isAfter(parseISO(ag.data_inicio), hoje) || format(parseISO(ag.data_inicio), 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd'));
  const agendamentosPassados = agendamentos.filter((ag: any) => isBefore(parseISO(ag.data_inicio), hoje) && format(parseISO(ag.data_inicio), 'yyyy-MM-dd') !== format(hoje, 'yyyy-MM-dd'));

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
                'linear-gradient(135deg, hsl(var(--primary) / 0.18) 0%, hsl(var(--primary) / 0.05) 50%, hsl(40 95% 52% / 0.12) 100%)',
            }}
          />
          <div
            className="pointer-events-none absolute -top-12 -right-10 w-44 h-44 rounded-full opacity-30 blur-3xl"
            style={{ background: 'radial-gradient(circle, hsl(var(--primary) / 0.5), transparent 70%)' }}
          />

          <div className="relative p-3 sm:p-5">
            {/* Top row: back + actions */}
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
                onClick={() => navigate('/pacientes')}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Pacientes</span>
              </Button>
              <div className="flex items-center gap-1">
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 bg-background/80 backdrop-blur"
                      onClick={() => setDocsModalOpen(true)}
                    >
                      <FileText className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-semibold hidden sm:inline">Documentos</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Gerar atestado, recibo, declaração…
                  </TooltipContent>
                </Tooltip>
                <Tooltip delayDuration={0}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={handleDeletePaciente}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    Excluir definitivamente
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Identity row */}
            <div className="flex items-start gap-3 sm:gap-4">
              <div
                className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl flex items-center justify-center shrink-0 text-white font-black text-lg sm:text-xl shadow-lg ring-4 ring-background"
                style={{
                  background:
                    'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.7) 100%)',
                }}
              >
                {paciente.nome[0]}
                {paciente.sobrenome?.[0] || ''}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-2xl font-black text-foreground leading-tight truncate">
                  {paciente.nome} {paciente.sobrenome}
                </h1>
                {/* Contact pills */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {idade !== null && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 text-[10px] font-medium text-muted-foreground">
                      <Calendar className="h-2.5 w-2.5" />
                      {idade} anos
                    </span>
                  )}
                  {paciente.genero && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 text-[10px] font-medium text-muted-foreground capitalize">
                      <User className="h-2.5 w-2.5" />
                      {paciente.genero}
                    </span>
                  )}
                  {paciente.telefone && (
                    <a
                      href={`https://wa.me/${paciente.telefone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 text-[10px] font-medium text-emerald-700 border border-emerald-200 transition-colors"
                      title="Abrir conversa no WhatsApp"
                    >
                      <Phone className="h-2.5 w-2.5" />
                      {paciente.telefone}
                    </a>
                  )}
                  {paciente.email && (
                    <a
                      href={`mailto:${paciente.email}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted/70 hover:bg-muted text-[10px] font-medium text-muted-foreground transition-colors max-w-[200px] truncate"
                      title={paciente.email}
                    >
                      <Mail className="h-2.5 w-2.5 shrink-0" />
                      <span className="truncate">{paciente.email}</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Links toolbar — labeled and prominent */}
            <div className="mt-4 pt-3 border-t border-border/40">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Links de acesso do paciente
                </span>
              </div>
              <LinkActionsBar
                items={(() => {
                  const items: LinkActionItem[] = [];
                  items.push({
                    key: 'myid',
                    label: 'MyID',
                    active: !!linkMyIDAtivo,
                    loading: gerandoMyIDLink,
                    color: 'emerald',
                    isWhatsApp: !!linkMyIDAtivo && !!paciente.telefone,
                    onAction: () =>
                      linkMyIDAtivo &&
                      (paciente.telefone
                        ? shareAvaliacaoLink(
                            `${paciente.nome} ${paciente.sobrenome}`,
                            paciente.telefone,
                            `${getBaseUrl()}/myid/responder/${linkMyIDAtivo.token_acesso}`,
                          )
                        : (() => {
                            navigator.clipboard.writeText(
                              `${getBaseUrl()}/myid/responder/${linkMyIDAtivo.token_acesso}`,
                            );
                            toast({ title: 'Link MyID copiado! 📋' });
                          })()),
                    onGenerate: gerarLinkMyID,
                  });
                  items.push({
                    key: 'agenda',
                    label: 'Agenda',
                    active: !!linkAgendaAtivo,
                    loading: gerandoAgenda,
                    color: 'blue',
                    isWhatsApp: !!linkAgendaAtivo && !!paciente.telefone,
                    onAction: () =>
                      linkAgendaAtivo &&
                      (paciente.telefone
                        ? shareAgendaLink(
                            `${paciente.nome} ${paciente.sobrenome}`,
                            paciente.telefone,
                            getAgendaUrl(linkAgendaAtivo.token),
                          )
                        : copiarAgendaLink(linkAgendaAtivo.token)),
                    onGenerate: gerarLinkAgenda,
                  });
                  if (paciente.portal_token) {
                    items.push({
                      key: 'portal',
                      label: 'Portal',
                      active: true,
                      color: 'violet',
                      isWhatsApp: !!paciente.telefone,
                      onAction: () =>
                        paciente.telefone
                          ? (() => {
                              const url = getPortalUrl(paciente.portal_token!);
                              const msg = `Olá ${paciente.nome}! 🩺\n\nAcesse seu Portal do Paciente:\n${url}`;
                              window.open(
                                `https://wa.me/${paciente.telefone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`,
                                '_blank',
                              );
                            })()
                          : (() => {
                              navigator.clipboard.writeText(getPortalUrl(paciente.portal_token!));
                              toast({ title: 'Link do Portal copiado! 🔗' });
                            })(),
                    });
                  }
                  return items;
                })()}
              />
            </div>
          </div>
        </div>

        {/* ============ KPI CARDS — bigger, more readable ============ */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {/* Tempo de cadastro */}
          <div className="rounded-xl border border-border/60 bg-card p-3 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Clock className="h-3 w-3" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Cliente há</span>
            </div>
            <div className="text-base sm:text-lg font-black leading-tight text-foreground">
              {formatDistanceToNow(new Date(paciente.created_at), { locale: ptBR }).replace('cerca de ', '~')}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              desde {format(parseISO(paciente.created_at), 'dd/MM/yy')}
            </div>
          </div>

          {/* Avaliações */}
          <div className="rounded-xl border border-border/60 bg-card p-3 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Activity className="h-3 w-3" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Avaliações</span>
            </div>
            <div className="text-base sm:text-lg font-black leading-tight text-foreground">
              {avaliacoesId.length + avaliacoesCob.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {avaliacoesId.length} ID · {avaliacoesCob.length} COB°
            </div>
          </div>

          {/* Próxima sessão */}
          <div className="rounded-xl border border-border/60 bg-card p-3 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <CalendarDays className="h-3 w-3" />
              <span className="text-[10px] font-semibold uppercase tracking-wide">Próxima</span>
            </div>
            <div className="text-base sm:text-lg font-black leading-tight text-foreground">
              {agendamentosFuturos[0]
                ? format(parseISO(agendamentosFuturos[0].data_inicio), 'dd/MM', { locale: ptBR })
                : '—'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {agendamentosFuturos[0]
                ? format(parseISO(agendamentosFuturos[0].data_inicio), "HH:mm 'h'", { locale: ptBR })
                : 'sem agenda'}
            </div>
          </div>

          {/* KPI Sessões — clicável, abre Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-left hover:bg-primary/10 hover:shadow-md hover:border-primary/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 group"
                title="Abrir gestão de sessões e pacotes"
              >
                <div className="flex items-center gap-1.5 text-primary mb-1">
                  <Package className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Sessões</span>
                  <ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-base sm:text-lg font-black leading-tight text-foreground">
                  #{sessoesInfo.numeroAtual || 0}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {sessoesInfo.totalRealizadas} realizadas
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
                <PacoteSessoesManager pacienteId={id!} />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">
                      Próximas sessões ({agendamentosFuturos.length})
                    </h3>
                  </div>
                  {loadingAg ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : agendamentosFuturos.length === 0 ? (
                    <EmptyState
                      icon={<CalendarDays />}
                      title="Nenhuma sessão agendada"
                      subtitle="Use a Agenda para criar um novo agendamento."
                    />
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
                    <EmptyState
                      icon={<Clock />}
                      title="Sem histórico"
                      subtitle="Sessões realizadas aparecerão aqui."
                    />
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

          {/* KPI Financeiro — clicável, abre Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-left hover:bg-emerald-50 hover:shadow-md hover:border-emerald-300 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/40 group"
                title="Abrir financeiro"
              >
                <div className="flex items-center gap-1.5 text-emerald-700 mb-1">
                  <DollarSign className="h-3 w-3" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide">Financeiro</span>
                  <ChevronRight className="h-3 w-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="text-base sm:text-lg font-black leading-tight text-foreground">R$</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">recibos & pagto</div>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600" /> Financeiro
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <PacienteFinanceiroTab
                  pacienteId={id!}
                  pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Observações inline (se houver) */}
        {paciente.observacoes && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-amber-50/60 border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
            <span className="leading-snug">
              <span className="font-semibold">Observações:</span> {paciente.observacoes}
            </span>
          </div>
        )}

        {/* ==== ABAS COMPLEMENTARES — logo abaixo do telefone ====
            Histórico │ Diretrizes │ Prontuário │ Engajar │ Chat
            Visão Integrada é a entrada padrão (sem aba ativa). */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            // Permite "desselecionar" clicando na mesma aba ativa, voltando à Visão Integrada
            const next = v === activeTab ? '' : v;
            setActiveTab(next);
            navigate(`/pacientes/${id}${next ? `?tab=${next}` : ''}`, { replace: true });
          }}
        >
          {activeTab && (
            <button
              type="button"
              onClick={() => {
                setActiveTab('');
                navigate(`/pacientes/${id}`, { replace: true });
              }}
              className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-semibold active:scale-[0.98]"
              title="Voltar para Visão Integrada"
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" />
              <span>Voltar para Visão Integrada</span>
            </button>
          )}
          <TabsList className="bg-muted/60 p-1 rounded-xl grid grid-cols-5 h-auto gap-1 w-full mb-4">
            <TabsTrigger value="presencial" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1 py-2 flex-col sm:flex-row" title="Avaliação Clínica (Voz/Áudio/Escrita + IA baseada em PubMed)">
              <Activity className="h-4 w-4 shrink-0" /> <span>Avaliação</span>
            </TabsTrigger>
            <TabsTrigger value="historico" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1 py-2 flex-col sm:flex-row" title="Histórico de Avaliações">
              <FileText className="h-4 w-4 shrink-0" /> <span>Histórico</span>
            </TabsTrigger>
            <TabsTrigger value="diretrizes" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1 py-2 flex-col sm:flex-row" title="Diretrizes e Tratamentos">
              <Target className="h-4 w-4 shrink-0" /> <span>Diretrizes</span>
            </TabsTrigger>
            <TabsTrigger value="evolucao-prontuario" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1 py-2 flex-col sm:flex-row">
              <ClipboardList className="h-4 w-4 shrink-0" /> <span>Prontuário</span>
            </TabsTrigger>
            <TabsTrigger value="portal" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1 py-2 flex-col sm:flex-row" title="Controle do Portal do Paciente">
              <Smartphone className="h-4 w-4 shrink-0" /> <span>Portal</span>
            </TabsTrigger>
          </TabsList>

          {/* LGPD Consent — botão compacto */}
          <div className="mb-3 flex justify-end">
            <TermoConsentimentoLGPD pacienteId={id!} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} compact />
          </div>

          {/* ==== VISÃO INTEGRADA — sempre visível como entrada padrão ==== */}
          {!activeTab && (
            <div className="mb-4">
              <PacienteDashboardIdentidade
                paciente={paciente as any}
                onBack={() => navigate('/pacientes')}
                onIniciarAvaliacao={() => navigate(`/metodo-identidade?paciente=${id}`)}
                onVerRelatorio={() => navigate(`/metodo-identidade?paciente=${id}`)}
                onEditarAvaliacao={() => navigate(`/metodo-identidade?paciente=${id}`)}
                subTab="integrada"
              />
            </div>
          )}

          {/* TAB: AVALIAÇÃO PRESENCIAL — Avatar 3D + Voz/Áudio/Escrita */}
          <TabsContent value="presencial" className="mt-4">
            <AvaliacaoPresencial
              pacienteId={id!}
              patientName={`${paciente.nome} ${paciente.sobrenome}`}
              serviceType="identidade"
              onAssessmentComplete={() => qc.invalidateQueries({ queryKey: ['notas-prontuario'] })}
            />
          </TabsContent>

          {/* TAB: HISTÓRICO DE AVALIAÇÕES */}
          <TabsContent value="historico" className="mt-4">
            <PacienteDashboardIdentidade
              paciente={paciente as any}
              onBack={() => navigate('/pacientes')}
              onIniciarAvaliacao={() => navigate(`/metodo-identidade?paciente=${id}`)}
              onVerRelatorio={() => navigate(`/metodo-identidade?paciente=${id}`)}
              onEditarAvaliacao={() => navigate(`/metodo-identidade?paciente=${id}`)}
              subTab="historico"
            />
          </TabsContent>

          {/* TAB: DIRETRIZES E TRATAMENTOS */}
          <TabsContent value="diretrizes" className="mt-4 space-y-6">
            <PacienteDashboardIdentidade
              paciente={paciente as any}
              onBack={() => navigate('/pacientes')}
              onIniciarAvaliacao={() => navigate(`/metodo-identidade?paciente=${id}`)}
              onVerRelatorio={() => navigate(`/metodo-identidade?paciente=${id}`)}
              onEditarAvaliacao={() => navigate(`/metodo-identidade?paciente=${id}`)}
              subTab="avaliacoes"
            />
          </TabsContent>

          {/* TAB: EVOLUÇÃO E PRONTUÁRIOS */}
          <TabsContent value="evolucao-prontuario" className="mt-4 space-y-6">
            <ResumoNarrativo pacienteId={id!} notas={notasProntuario} />
            <SoapNoteForm pacienteId={id!} onSuccess={() => qc.invalidateQueries({ queryKey: ['notas-prontuario'] })} />
            <ProntuarioTimeline notas={notasProntuario} isLoading={loadingNotas} />

            {evolucoesId.length >= 2 ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Evolução — Método Identidade</h3>
                </div>
                <EvolucaoDashboard evolucoes={evolucoesId} pacienteNome={`${paciente?.nome} ${paciente?.sobrenome}`} />
              </div>
            ) : (
              <EmptyState icon={<BarChart3 />} title="Dados insuficientes (Identidade)" subtitle="São necessárias pelo menos 2 avaliações Identidade para gerar o comparativo evolutivo." />
            )}

            {respostasPaciente.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Evolução — Questionários Remotos</h3>
                </div>
                <QuestionariosComparacao linksAvPaciente={linksAvaliacao} respostas={respostasPaciente} />
              </div>
            )}

            {avaliacoesId.length < 2 && respostasPaciente.length === 0 && notasProntuario.length === 0 && (
              <EmptyState icon={<TrendingUp />} title="Sem dados para evolução" subtitle="Realize avaliações ou envie questionários remotos para acompanhar a evolução." />
            )}
          </TabsContent>

          {/* TAB: PORTAL — Controle dos espaços do cliente */}
          <TabsContent value="portal" className="mt-4 space-y-6">
            {paciente && (
              <>
                <PortalControleTab
                  pacienteId={id!}
                  pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                  portalToken={paciente.portal_token}
                  telefone={paciente.telefone}
                />
                <ChatPacienteTab
                  pacienteId={id!}
                  pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                  pacienteTelefone={paciente.telefone}
                />
                <NpsSurveyCard pacienteId={id!} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
      {paciente && (
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
      )}
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
