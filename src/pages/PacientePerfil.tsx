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
  BedDouble, Cigarette, Wine, Armchair, Shield, Heart, Sparkles, Stethoscope, DollarSign, Package,
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
import IndicesRiscoComprometimento from '@/components/paciente/IndicesRiscoComprometimento';
import PacienteEngajamentoTab from '@/components/paciente/PacienteEngajamentoTab';
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
  // Aba única consolidada: avaliacoes | protocolos | evolucao-prontuario | engajamento | chat
  // Sem aba ativa por padrão — conteúdo aparece somente ao clicar.
  const VALID_TABS = ['avaliacoes', 'protocolos', 'evolucao-prontuario', 'engajamento', 'chat'];
  const normalizedTab = rawTab === 'prontuario' || rawTab === 'evolucao'
    ? 'evolucao-prontuario'
    : rawTab === 'agenda' || rawTab === 'historico-avaliacoes' || rawTab === 'clinico'
      ? 'avaliacoes'
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
        {/* Rich Header */}
        <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mt-1 shrink-0" onClick={() => navigate('/pacientes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-11 w-11 sm:h-14 sm:w-14 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-white font-bold text-base sm:text-lg">
            {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate">{paciente.nome} {paciente.sobrenome}</h1>
              {paciente.telefone && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-[#25D366] hover:bg-[#25D366]/10 shrink-0" title="WhatsApp"
                  onClick={() => window.open(`https://wa.me/55${paciente.telefone?.replace(/\D/g, '')}`, '_blank')}>
                  <MessageCircle className="h-4 w-4" />
                </Button>
              )}
              {/* Links rápidos: MyID · Agenda · Portal */}
              <LinkActionsBar items={(() => {
                const items: LinkActionItem[] = [];
                items.push({
                  key: 'myid', label: 'MyID',
                  active: !!linkMyIDAtivo,
                  loading: gerandoMyIDLink,
                  color: 'emerald',
                  isWhatsApp: !!linkMyIDAtivo && !!paciente.telefone,
                  onAction: () => linkMyIDAtivo && (paciente.telefone
                    ? shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone, `${getBaseUrl()}/myid/responder/${linkMyIDAtivo.token_acesso}`)
                    : (() => { navigator.clipboard.writeText(`${getBaseUrl()}/myid/responder/${linkMyIDAtivo.token_acesso}`); toast({ title: 'Link MyID copiado! 📋' }); })()),
                  onGenerate: gerarLinkMyID,
                });
                items.push({
                  key: 'agenda', label: 'Agenda',
                  active: !!linkAgendaAtivo,
                  loading: gerandoAgenda,
                  color: 'blue',
                  isWhatsApp: !!linkAgendaAtivo && !!paciente.telefone,
                  onAction: () => linkAgendaAtivo && (paciente.telefone
                    ? shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone, getAgendaUrl(linkAgendaAtivo.token))
                    : copiarAgendaLink(linkAgendaAtivo.token)),
                  onGenerate: gerarLinkAgenda,
                });
                if (paciente.portal_token) {
                  items.push({
                    key: 'portal', label: 'Portal',
                    active: true,
                    color: 'violet',
                    isWhatsApp: !!paciente.telefone,
                    onAction: () => paciente.telefone
                      ? (() => { const url = getPortalUrl(paciente.portal_token!); const msg = `Olá ${paciente.nome}! 🩺\n\nAcesse seu Portal do Paciente:\n${url}`; window.open(`https://wa.me/${paciente.telefone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank'); })()
                      : (() => { navigator.clipboard.writeText(getPortalUrl(paciente.portal_token!)); toast({ title: 'Link do Portal copiado! 🔗' }); })(),
                  });
                }
                return items;
              })()} />
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0 ml-auto" title="Excluir Definitivamente"
                onClick={handleDeletePaciente}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {(paciente._servicos as string[]).map((s: string) => {
                const cfg = SERVICOS_MAP[s];
                return cfg ? (
                  <Badge key={s} variant="outline" className={cn('text-xs gap-1', cfg.color)}>
                    {cfg.icon} {cfg.label}
                  </Badge>
                ) : null;
              })}
              {(paciente._servicos as string[]).length === 0 && (
                <Badge variant="outline" className="text-xs text-muted-foreground">Sem serviços vinculados</Badge>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards — compact grid; Sessão e Pacote são clicáveis e abrem painéis Sessões/Financeiro */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {(() => {
            const staticKpis = [
              idade !== null ? { icon: Calendar, label: 'Idade', value: `${idade}a`, sub: paciente.data_nascimento ? format(parseISO(paciente.data_nascimento), 'dd/MM/yy') : undefined } : null,
              { icon: Clock, label: 'Desde', value: formatDistanceToNow(new Date(paciente.created_at), { locale: ptBR }).replace('cerca de ', '~'), sub: format(parseISO(paciente.created_at), 'dd/MM/yy') },
              { icon: Activity, label: 'Aval.', value: `${avaliacoesId.length + avaliacoesCob.length}`, sub: avaliacoesId.length > 0 ? `${avaliacoesId.length} ID` : avaliacoesCob.length > 0 ? `${avaliacoesCob.length} COB°` : undefined },
            ].filter(Boolean) as any[];
            return staticKpis.map((kpi: any) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="clinical-card !p-2.5 text-center">
                  <Icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-base font-bold leading-tight">{kpi.value}</div>
                  <div className="text-[9px] text-muted-foreground">{kpi.sub || kpi.label}</div>
                </div>
              );
            });
          })()}

          {/* KPI Sessões — abre painel completo */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="clinical-card !p-2.5 text-center hover:border-primary/40 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
                title="Abrir gestão de sessões"
              >
                <ClipboardList className="h-3.5 w-3.5 mx-auto mb-1 text-primary" />
                <div className="text-base font-bold leading-tight">#{sessoesInfo.numeroAtual}</div>
                <div className="text-[9px] text-muted-foreground">{sessoesInfo.totalRealizadas} sessões</div>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> Sessões e Pacotes</SheetTitle>
              </SheetHeader>
              <div className="mt-4 space-y-6">
                <PacoteSessoesManager pacienteId={id!} />
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Próximas sessões ({agendamentosFuturos.length})</h3>
                  </div>
                  {loadingAg ? (
                    <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
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

          {/* KPI Financeiro — abre painel completo */}
          <Sheet>
            <SheetTrigger asChild>
              <button
                type="button"
                className="clinical-card !p-2.5 text-center hover:border-primary/40 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-primary/40"
                title="Abrir financeiro"
              >
                <DollarSign className="h-3.5 w-3.5 mx-auto mb-1 text-emerald-600" />
                <div className="text-base font-bold leading-tight">R$</div>
                <div className="text-[9px] text-muted-foreground">Financeiro</div>
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><DollarSign className="h-4 w-4 text-emerald-600" /> Financeiro</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <PacienteFinanceiroTab pacienteId={id!} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Contact inline */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4 px-1">
          {paciente.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{paciente.telefone}</span>}
          {paciente.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{paciente.email}</span>}
          {paciente.genero && <span className="flex items-center gap-1 capitalize"><User className="h-3 w-3" />{paciente.genero}</span>}
          {paciente.observacoes && <span className="flex items-center gap-1 text-muted-foreground/70" title={paciente.observacoes}><FileText className="h-3 w-3" />Obs: {paciente.observacoes.slice(0, 40)}{paciente.observacoes.length > 40 ? '…' : ''}</span>}
        </div>

        {/* LGPD Consent */}
        <div className="mb-4">
          <TermoConsentimentoLGPD pacienteId={id!} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} />
        </div>

        {/* ==== 4 GRUPOS PRINCIPAIS ====
            Clínico (sub-abas: Avaliações, Diretrizes, Prontuário) │ Financeiro │ Engajamento │ Chat */}
        <Tabs
          defaultValue={outerTab}
          onValueChange={(v) => navigate(`/pacientes/${id}?tab=${v}`, { replace: true })}
        >
          <TabsList className="bg-muted/60 p-1 rounded-xl grid grid-cols-3 h-auto gap-1 w-full">
            <TabsTrigger value="clinico" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[11px] sm:text-xs px-1.5 py-2">
              <Stethoscope className="h-4 w-4 shrink-0" /> <span>Clínico</span>
            </TabsTrigger>
            <TabsTrigger value="engajamento" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[11px] sm:text-xs px-1.5 py-2">
              <Heart className="h-4 w-4 shrink-0" /> <span>Engajar</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[11px] sm:text-xs px-1.5 py-2">
              <MessageCircle className="h-4 w-4 shrink-0" /> <span>Chat</span>
            </TabsTrigger>
          </TabsList>

          {/* ══ GRUPO CLÍNICO ══ contém sub-abas: Avaliações | Diretrizes | Prontuário */}
          <TabsContent value="clinico" className="mt-4">
            <Tabs defaultValue={innerClinicoTab}>
              <TabsList className="bg-background border border-border/60 p-1 rounded-lg grid grid-cols-3 h-auto gap-1 w-full mb-4">
                <TabsTrigger value="avaliacoes" className="gap-1 rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs px-1.5 py-1.5">
                  <Stethoscope className="h-3.5 w-3.5 shrink-0" /> <span>Avaliações</span>
                </TabsTrigger>
                <TabsTrigger value="protocolos" className="gap-1 rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs px-1.5 py-1.5">
                  <ClipboardList className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Diretrizes</span><span className="sm:hidden">Dir.</span>
                </TabsTrigger>
                <TabsTrigger value="evolucao-prontuario" className="gap-1 rounded-md data-[state=active]:bg-primary/10 data-[state=active]:text-primary text-[11px] sm:text-xs px-1.5 py-1.5">
                  <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Prontuário</span><span className="sm:hidden">Pront.</span>
                </TabsTrigger>
              </TabsList>
              {/* Sub-abas internas (avaliacoes / protocolos / evolucao-prontuario)
                  estão definidas logo abaixo neste mesmo bloco <Tabs> interno.
                  O fechamento </Tabs> e </TabsContent> ocorre após a sub-aba
                  "evolucao-prontuario" mais adiante. */}

          {/* ══════════════════════════════════════════════════════════════════
              TAB: AVALIAÇÕES (hub centralizado de todos os serviços)
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="avaliacoes" className="mt-4">
            {/* Dashboard Identidade completo com sub-abas:
                Visão Integrada | Histórico de Avaliações | Avaliação Presencial | Diretrizes e Tratamentos */}
            <PacienteDashboardIdentidade
              paciente={paciente as any}
              onBack={() => navigate('/pacientes')}
              onIniciarAvaliacao={() => navigate(`/metodo-identidade?paciente=${id}`)}
              onVerRelatorio={() => navigate(`/metodo-identidade?paciente=${id}`)}
              onEditarAvaliacao={() => navigate(`/metodo-identidade?paciente=${id}`)}
            />
          </TabsContent>




          {/* ══════════════════════════════════════════════════════════════════
              TAB: EVOLUÇÃO E PRONTUÁRIOS
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="evolucao-prontuario" className="mt-4 space-y-6">
            {/* Resumo Narrativo */}
            <ResumoNarrativo pacienteId={id!} notas={notasProntuario} />

            {/* SOAP Note + Prontuário */}
            <SoapNoteForm pacienteId={id!} onSuccess={() => qc.invalidateQueries({ queryKey: ['notas-prontuario'] })} />
            <ProntuarioTimeline notas={notasProntuario} isLoading={loadingNotas} />

            {/* Evolução Avaliações Identidade */}
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

            {/* Evolução Questionários */}
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

          {/* ══════════════════════════════════════════════════════════════════
              TAB: DIRETRIZES / PROTOCOLOS DE TRATAMENTO
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="protocolos" className="mt-4 space-y-6">
            <PacienteProtocolosTab pacienteId={id!} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} tipo="identidade" />
          </TabsContent>
            </Tabs>
          </TabsContent>
          {/* ══ FIM GRUPO CLÍNICO ══ */}
          <TabsContent value="engajamento" className="mt-4 space-y-6">
            {paciente && (
              <PacienteEngajamentoTab
                pacienteId={id!}
                pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
              />
            )}

            {/* NPS do Paciente */}
            <div>
              <NpsSurveyCard pacienteId={id!} />
            </div>
          </TabsContent>

          {/* Sessões e Financeiro foram movidos para botões/cards no header (Sheets) */}


          {/* ══════════════════════════════════════════════════════════════════
              TAB: CHAT INTERNO
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="chat" className="mt-4">
            {paciente && (
              <ChatPacienteTab
                pacienteId={id!}
                pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
                pacienteTelefone={paciente.telefone}
              />
            )}
          </TabsContent>


        </Tabs>
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
