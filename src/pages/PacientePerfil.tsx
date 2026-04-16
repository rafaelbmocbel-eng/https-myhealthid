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
import {
  ArrowLeft, User, Mail, Phone, Calendar, FileText, Activity,
  CalendarDays, Link2, Copy, Loader2, Clock, MessageCircle,
  TrendingUp, AlignCenter, ExternalLink, ClipboardList, BarChart3, ChevronRight,
  Plus, Trash2, Edit, Dumbbell, AlertTriangle, Droplets, Footprints,
  BedDouble, Cigarette, Wine, Armchair, Shield, Heart, Sparkles, Stethoscope, DollarSign,
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
import StudioNotasTab from '@/components/studio/StudioNotasTab';
import PacienteEngajamentoTab from '@/components/paciente/PacienteEngajamentoTab';
import ProntuarioTimeline from '@/components/paciente/ProntuarioTimeline';
import { useNotasProntuario } from '@/hooks/useNotasProntuario';
import SoapNoteForm from '@/components/prontuario/SoapNoteForm';
import TermoConsentimentoLGPD from '@/components/prontuario/TermoConsentimentoLGPD';
import NpsSurveyCard from '@/components/nps/NpsSurveyCard';
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import StudioTreinosTab from '@/components/studio/StudioTreinosTab';
import StudioPortalControlTab from '@/components/studio/StudioPortalControlTab';
import ResumoNarrativo from '@/components/paciente/ResumoNarrativo';
import PacoteSessoesManager from '@/components/paciente/PacoteSessoesManager';
import PacienteFinanceiroTab from '@/components/paciente/PacienteFinanceiroTab';
import ChatPacienteTab from '@/components/chat/ChatPacienteTab';


const SERVICOS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  metodo_identidade: { label: 'Método Identidade', color: 'bg-primary/10 text-primary border-primary/20', icon: <Activity className="h-3 w-3" /> },
  cob_zero: { label: 'COB° ZERO', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <AlignCenter className="h-3 w-3" /> },
  studio_personal_id: { label: 'Studio Personal ID', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <Sparkles className="h-3 w-3" /> },
  agenda_premium: { label: 'Agenda Premium', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <CalendarDays className="h-3 w-3" /> },
};

export default function PacientePerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useMemo(() => [new URLSearchParams(window.location.search)], []);
  const rawTab = searchParams.get('tab') || 'avaliacoes';
  const defaultTab = rawTab === 'prontuario' || rawTab === 'evolucao' ? 'evolucao-prontuario' : rawTab === 'agenda' || rawTab === 'historico-avaliacoes' ? 'avaliacoes' : rawTab;
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
  const [agendandoNovo, setAgendandoNovo] = useState(false);
  const [tratamentoAberto, setTratamentoAberto] = useState<string | null>(null);

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
              {paciente.portal_token && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-primary hover:bg-primary/10 shrink-0"
                  title="Copiar link do Portal do Paciente"
                  onClick={() => {
                    const url = getPortalUrl(paciente.portal_token!);
                    navigator.clipboard.writeText(url);
                    toast({ title: 'Link copiado! 🔗', description: 'Envie este link ao paciente para acesso ao portal.' });
                  }}
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
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

        {/* KPI Cards — compact grid, show only available data */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          {[
            idade !== null ? { icon: Calendar, label: 'Idade', value: `${idade}a`, sub: paciente.data_nascimento ? format(parseISO(paciente.data_nascimento), 'dd/MM/yy') : undefined } : null,
            { icon: Clock, label: 'Desde', value: formatDistanceToNow(new Date(paciente.created_at), { locale: ptBR }).replace('cerca de ', '~'), sub: format(parseISO(paciente.created_at), 'dd/MM/yy') },
            { icon: Activity, label: 'Aval.', value: `${avaliacoesId.length + avaliacoesCob.length}`, sub: avaliacoesId.length > 0 ? `${avaliacoesId.length} ID` : avaliacoesCob.length > 0 ? `${avaliacoesCob.length} COB°` : undefined },
            { icon: ClipboardList, label: 'Sessão', value: `#${sessoesInfo.numeroAtual}`, sub: `${sessoesInfo.totalRealizadas} total` },
          ].filter(Boolean).map((kpi: any) => {
            const Icon = kpi.icon;
            return (
              <div key={kpi.label} className="clinical-card !p-2.5 text-center">
                <Icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />
                <div className="text-base font-bold leading-tight">{kpi.value}</div>
                <div className="text-[9px] text-muted-foreground">{kpi.sub || kpi.label}</div>
              </div>
            );
          })}
          <PacoteSessoesManager pacienteId={id!} compact />
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

        {/* Contact + Notes removed — now inline above */}
        {/* ==== 4 TABS ==== */}
        <Tabs defaultValue={defaultTab} onValueChange={(v) => navigate(`/pacientes/${id}?tab=${v}`, { replace: true })}>
          <TabsList className="bg-muted/60 p-1 rounded-xl grid grid-cols-5 h-auto gap-1 w-full">
            <TabsTrigger value="avaliacoes" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1.5 py-1.5">
              <Stethoscope className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Avaliações</span><span className="sm:hidden">Aval.</span>
            </TabsTrigger>
            <TabsTrigger value="protocolos" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1.5 py-1.5">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Diretrizes e Tratamentos</span><span className="sm:hidden">Dir.</span>
            </TabsTrigger>
            <TabsTrigger value="evolucao-prontuario" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1.5 py-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Prontuário</span><span className="sm:hidden">Pront.</span>
            </TabsTrigger>
            <TabsTrigger value="financeiro" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1.5 py-1.5">
              <DollarSign className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Financeiro</span><span className="sm:hidden">Fin.</span>
            </TabsTrigger>
            <TabsTrigger value="engajamento" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1.5 py-1.5">
              <Heart className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Engajamento</span><span className="sm:hidden">Engaj.</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-1.5 py-1.5">
              <MessageCircle className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Chat</span><span className="sm:hidden">Chat</span>
            </TabsTrigger>
          </TabsList>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: AVALIAÇÕES (hub centralizado de todos os serviços)
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="avaliacoes" className="mt-4 space-y-6">
            {/* Service Action Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Método Identidade */}
              <div className="clinical-card border-l-4 border-primary cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/metodo-identidade?paciente=${id}`)}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold">Método Identidade</h3>
                    <p className="text-[10px] text-muted-foreground">{avaliacoesId.length} avaliação(ões)</p>
                  </div>
                  <Button size="sm" className="bg-primary/10 text-primary hover:bg-primary/20 gap-1 h-8 shrink-0" onClick={(e) => { e.stopPropagation(); navigate(`/metodo-identidade?paciente=${id}`); }}>
                    <Plus className="h-3.5 w-3.5" /> Nova
                  </Button>
                </div>
              </div>

              {/* COB° ZERO */}
              <div className="clinical-card border-l-4 border-blue-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/cob-zero?paciente=${id}`)}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <AlignCenter className="h-5 w-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold">COB° ZERO</h3>
                    <p className="text-[10px] text-muted-foreground">{avaliacoesCob.length} avaliação(ões)</p>
                  </div>
                  <Button size="sm" className="bg-blue-50 text-blue-700 hover:bg-blue-100 gap-1 h-8 shrink-0" onClick={(e) => { e.stopPropagation(); navigate(`/cob-zero?paciente=${id}`); }}>
                    <Plus className="h-3.5 w-3.5" /> Nova
                  </Button>
                </div>
              </div>

              {/* Studio Personal ID */}
              <div className="clinical-card border-l-4 border-emerald-500 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/studio-personal-id?paciente=${id}`)}>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold">Studio Personal ID</h3>
                    <p className="text-[10px] text-muted-foreground">Hub de treinos e medidas</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </div>

              {/* Avaliação por Voz */}
              <div className="clinical-card border-l-4 border-indigo-500">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold">Avaliação por Voz</h3>
                    <p className="text-[10px] text-muted-foreground">{avaliacoesVoz.length} avaliação(ões)</p>
                  </div>
                </div>
                <VoiceAssessment
                  serviceType="identidade"
                  pacienteId={id!}
                  patientName={`${paciente.nome} ${paciente.sobrenome}`}
                />
              </div>
            </div>




            {/* Links Compactos (barra de ícones) */}
            <div className="clinical-card !p-3">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Link Avaliação */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Link2 className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-xs font-semibold shrink-0">Questionário</span>
                  {linkAvAtivo ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-[10px] text-emerald-600 shrink-0">{differenceInDays(new Date(linkAvAtivo.data_expiracao), new Date())}d</span>
                      {paciente.telefone ? (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#25D366]"
                          onClick={() => shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getLinkUrl(linkAvAtivo.token))}>
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarLink(linkAvAtivo.token)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-primary" disabled={gerando}
                      onClick={async () => { const novo = await gerarLink(id!); if (novo) copiarLink(novo.token); }}>
                      {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Gerar
                    </Button>
                  )}
                </div>

                <div className="h-6 w-px bg-border shrink-0" />

                {/* Link Agenda */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <CalendarDays className="h-4 w-4 text-amber-600 shrink-0" />
                  <span className="text-xs font-semibold shrink-0">Agenda</span>
                  {linkAgendaAtivo ? (
                    <>
                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-[10px] text-emerald-600 shrink-0">{differenceInDays(new Date(linkAgendaAtivo.data_expiracao), new Date())}d</span>
                      {paciente.telefone ? (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#25D366]"
                          onClick={() => shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getAgendaUrl(linkAgendaAtivo.token))}>
                          <MessageCircle className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarAgendaLink(linkAgendaAtivo.token)}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-amber-600" disabled={gerandoAgenda}
                      onClick={gerarLinkAgenda}>
                      {gerandoAgenda ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                      Gerar
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Pontos Críticos da Última Avaliação */}
            {avaliacoesId.length > 0 && (() => {
              const ult = avaliacoesId[0] as any;
              const dados = ult.dados_avaliacao as any;
              const scores = {
                e: ult.score_e || 0, p: ult.score_p || 0, c: ult.score_c || 0,
                f: ult.score_f || 0, d: ult.score_d || 0, r: ult.score_r || 0,
                idFinal: ult.id_final || 0,
              };

              const alertas: Array<{ icon: any; label: string; valor: string; status: 'critico' | 'alerta' | 'ok'; dica: string }> = [];
              if (scores.p > 7.5) alertas.push({ icon: AlertTriangle, label: 'Cinesiofobia', valor: `${scores.p.toFixed(1)}/10`, status: 'critico', dica: 'Psicoeducação em dor + exposição gradual' });
              else if (scores.p > 5) alertas.push({ icon: AlertTriangle, label: 'Cinesiofobia', valor: `${scores.p.toFixed(1)}/10`, status: 'alerta', dica: 'Educação sobre movimento seguro' });
              if (scores.r < 3) alertas.push({ icon: Shield, label: 'Regulação', valor: `${scores.r.toFixed(1)}/10`, status: 'critico', dica: 'Avaliação neurovegetativa urgente' });
              else if (scores.r < 5) alertas.push({ icon: Shield, label: 'Regulação', valor: `${scores.r.toFixed(1)}/10`, status: 'alerta', dica: 'Técnicas de regulação + higiene do sono' });
              if (scores.d > 8) alertas.push({ icon: Heart, label: 'Dor', valor: `${scores.d.toFixed(1)}/10`, status: 'critico', dica: 'Dor intensa/neuropática — TENS + terapia manual' });
              else if (scores.d > 5) alertas.push({ icon: Heart, label: 'Dor', valor: `${scores.d.toFixed(1)}/10`, status: 'alerta', dica: 'Modulação de dor ativa' });
              if (scores.c > 8) alertas.push({ icon: AlertTriangle, label: 'Carga Contextual', valor: `${scores.c.toFixed(1)}/10`, status: 'critico', dica: 'Encaminhamento psicológico recomendado' });
              else if (scores.c > 5) alertas.push({ icon: AlertTriangle, label: 'Contexto', valor: `${scores.c.toFixed(1)}/10`, status: 'alerta', dica: 'Suporte emocional + escuta ativa' });
              if (scores.e > 6) alertas.push({ icon: Activity, label: 'Estrutural', valor: `${scores.e.toFixed(1)}/10`, status: 'critico', dica: 'Intervenção manual intensiva' });

              if (dados?.bloco1) {
                const b1 = dados.bloco1;
                if (b1.atividadeFisica === 'nenhuma') alertas.push({ icon: Footprints, label: 'Sedentário', valor: 'Sem atividade', status: 'critico', dica: 'Iniciar caminhadas 20min 3×/sem' });
                if ((b1.litrosAgua ?? 2) < 1.5) alertas.push({ icon: Droplets, label: 'Hidratação', valor: `${b1.litrosAgua ?? 0}L/dia`, status: 'alerta', dica: 'Aumentar para ≥2L/dia' });
                if (b1.tabagismo) alertas.push({ icon: Cigarette, label: 'Tabagismo', valor: 'Ativo', status: 'critico', dica: 'Cessação — retarda cicatrização' });
                if (b1.alcool === 'frequente') alertas.push({ icon: Wine, label: 'Álcool', valor: 'Frequente', status: 'critico', dica: 'Reduzir consumo' });
                if (b1.horasSedentario >= 10) alertas.push({ icon: Armchair, label: 'Horas sentado', valor: `${b1.horasSedentario}h/dia`, status: 'critico', dica: 'Pausas ativas a cada 45min' });
              }
              if (dados?.bloco5) {
                const r1 = dados.bloco5.scoreR1 ?? 5;
                const r2 = dados.bloco5.scoreR2 ?? 5;
                const r3 = dados.bloco5.scoreR3 ?? 5;
                if (r1 > 7) alertas.push({ icon: BedDouble, label: 'Sono', valor: `R1: ${r1.toFixed(1)}`, status: 'critico', dica: 'Higiene do sono urgente' });
                else if (r1 > 4) alertas.push({ icon: BedDouble, label: 'Sono', valor: `R1: ${r1.toFixed(1)}`, status: 'alerta', dica: 'Regularizar rotina de sono' });
                if (r2 > 7) alertas.push({ icon: Activity, label: 'Energia', valor: `R2: ${r2.toFixed(1)}`, status: 'critico', dica: 'Fadiga severa — investigar causa' });
                if (r3 > 7) alertas.push({ icon: AlertTriangle, label: 'Psicológico', valor: `R3: ${r3.toFixed(1)}`, status: 'critico', dica: 'Suporte psicológico urgente' });
              }

              if (alertas.length === 0) return null;
              const criticos = alertas.filter(a => a.status === 'critico');
              const alertasList = alertas.filter(a => a.status === 'alerta');
              const getStyle = (s: 'critico' | 'alerta' | 'ok') =>
                s === 'critico' ? 'border-red-200 bg-red-50/60' : s === 'alerta' ? 'border-amber-200 bg-amber-50/60' : 'border-green-200 bg-green-50/60';
              const getIconStyle = (s: 'critico' | 'alerta' | 'ok') =>
                s === 'critico' ? 'text-red-600' : s === 'alerta' ? 'text-amber-600' : 'text-green-600';

              return (
                <div className="clinical-card border-2 border-destructive/20">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Pontos Críticos — {ult.data_avaliacao}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                        ID {scores.idFinal.toFixed(1)}/50
                      </Badge>
                      {ult.classificacao && (
                        <Badge variant="outline" className="text-[10px]">{ult.classificacao}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {[...criticos, ...alertasList].map((al, i) => {
                      const Icon = al.icon;
                      return (
                        <div key={i} className={`rounded-lg border p-2.5 ${getStyle(al.status)}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className={`h-4 w-4 shrink-0 ${getIconStyle(al.status)}`} />
                            <span className="text-xs font-bold truncate">{al.label}</span>
                          </div>
                          <div className="text-sm font-black">{al.valor}</div>
                          <div className="text-[10px] text-muted-foreground mt-1 leading-tight">💡 {al.dica}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Índices de Risco Biopsicossocial */}
            {(() => {
              if (avaliacoesId.length > 0) {
                const ult = avaliacoesId[0] as any;
                return <IndicesRiscoComprometimento scores={ult} dadosAvaliacao={ult?.dados_avaliacao} />;
              }
              if (respostasPaciente.length > 0) {
                const scoresFromResponses: Record<string, number> = {};
                respostasPaciente.forEach((r: any) => {
                  const dados = r.dados_respostas as any;
                  if (!dados) return;
                  Object.entries(dados).forEach(([k, v]) => {
                    if (k.startsWith('score') && typeof v === 'number') {
                      scoresFromResponses[k] = v;
                    }
                  });
                });
                if (Object.keys(scoresFromResponses).length > 0) {
                  return <IndicesRiscoComprometimento scores={scoresFromResponses} parcial />;
                }
              }
              return null;
            })()}

            {/* Resumo rápido de avaliações */}
            <div className="grid grid-cols-3 gap-2">
              <div className="border rounded-xl p-3 text-center bg-card">
                <Activity className="h-4 w-4 mx-auto mb-1 text-primary" />
                <div className="text-lg font-bold">{avaliacoesId.length}</div>
                <div className="text-[10px] text-muted-foreground">Identidade</div>
              </div>
              <div className="border rounded-xl p-3 text-center bg-card">
                <AlignCenter className="h-4 w-4 mx-auto mb-1 text-blue-600" />
                <div className="text-lg font-bold">{avaliacoesCob.length}</div>
                <div className="text-[10px] text-muted-foreground">COB° ZERO</div>
              </div>
              <div className="border rounded-xl p-3 text-center bg-card">
                <Stethoscope className="h-4 w-4 mx-auto mb-1 text-indigo-600" />
                <div className="text-lg font-bold">{avaliacoesVoz.length}</div>
                <div className="text-[10px] text-muted-foreground">Voz</div>
              </div>
            </div>

            {/* Diretriz vigente (resumo) */}
            {protocolos.length > 0 && (() => {
              const vigente = protocolos.find((p: any) => p.status === 'ativo') || protocolos[0];
              return (
                <div className="clinical-card border-l-4 border-primary">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">Diretriz Vigente</h3>
                    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] ml-auto">{vigente.status}</Badge>
                  </div>
                  <p className="text-sm font-medium">{vigente.titulo}</p>
                  {vigente.objetivo_geral && <p className="text-xs text-muted-foreground mt-1">{vigente.objetivo_geral}</p>}
                  <p className="text-[10px] text-muted-foreground mt-1">{vigente.duracao_total} · {vigente.frequencia}</p>
                </div>
              );
            })()}

            {/* Histórico detalhado de avaliações */}
            {(loadingId || loadingCob) ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                {avaliacoesId.length > 0 && (
                  <div className="clinical-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Histórico Identidade ({avaliacoesId.length})</h3>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {avaliacoesId.length === 1 ? '1ª Avaliação' : `${avaliacoesId.length - 1} reavaliação(ões)`}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {avaliacoesId.map((av: any, idx: number) => (
                        <div key={av.id} className="rounded-xl border p-3 flex items-center gap-3 cursor-pointer hover:border-primary/40 transition-colors" onClick={() => navigate(`/metodo-identidade?paciente=${id}`)}>
                          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', idx === 0 ? 'bg-primary/15' : 'bg-muted')}>
                            <TrendingUp className={cn('h-4 w-4', idx === 0 ? 'text-primary' : 'text-muted-foreground')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{av.data_avaliacao}</span>
                              {av.classificacao && <Badge variant="outline" className="text-[10px] h-4">{av.classificacao}</Badge>}
                              {idx === 0 && <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-4">Mais recente</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              ID: {av.id_final?.toFixed(1)}/50 · E:{av.score_e?.toFixed(1)} P:{av.score_p?.toFixed(1)} D:{av.score_d?.toFixed(1)} F:{av.score_f?.toFixed(1)} R:{av.score_r?.toFixed(1)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {avaliacoesCob.length > 0 && (
                  <div className="clinical-card">
                    <div className="flex items-center gap-2 mb-3">
                      <AlignCenter className="h-4 w-4 text-blue-600" />
                      <h3 className="font-semibold text-sm">Histórico COB° ZERO ({avaliacoesCob.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {avaliacoesCob.map((av: any, idx: number) => (
                        <div key={av.id} className="rounded-xl border p-3 flex items-center gap-3 cursor-pointer hover:border-blue-400/40 transition-colors" onClick={() => navigate(`/cob-zero?paciente=${id}`)}>
                          <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', idx === 0 ? 'bg-blue-100' : 'bg-muted')}>
                            <AlignCenter className={cn('h-4 w-4', idx === 0 ? 'text-blue-600' : 'text-muted-foreground')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{av.data_avaliacao}</span>
                              {av.lenke_type && <Badge variant="outline" className="text-[10px] h-4">Lenke {av.lenke_type}</Badge>}
                              {av.risco_level && <Badge variant="outline" className="text-[10px] h-4">{av.risco_level}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              Cobb: {av.cobb_angle}° · Risco: {av.risco_percentage}% · E:{av.score_e?.toFixed(1)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {avaliacoesVoz.length > 0 && (
                  <div className="clinical-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Stethoscope className="h-4 w-4 text-indigo-600" />
                      <h3 className="font-semibold text-sm">Histórico Voz ({avaliacoesVoz.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {avaliacoesVoz.map((av: any, idx: number) => {
                        const severityColors: Record<string, string> = {
                          'Favorável': 'bg-green-100 text-green-700 border-green-200',
                          'Atenção': 'bg-yellow-100 text-yellow-700 border-yellow-200',
                          'Moderado': 'bg-orange-100 text-orange-700 border-orange-200',
                          'Severo': 'bg-red-100 text-red-700 border-red-200',
                          'Risco de Cronificação': 'bg-purple-100 text-purple-700 border-purple-200',
                        };
                        return (
                          <div key={av.id} className="rounded-xl border p-3 flex items-center gap-3">
                            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', idx === 0 ? 'bg-indigo-100' : 'bg-muted')}>
                              <Stethoscope className={cn('h-4 w-4', idx === 0 ? 'text-indigo-600' : 'text-muted-foreground')} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-semibold">
                                  {format(parseISO(av.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                </span>
                                {av.classificacao_severidade && (
                                  <Badge variant="outline" className={cn('text-[10px] h-4', severityColors[av.classificacao_severidade] || '')}>
                                    {av.classificacao_severidade}
                                  </Badge>
                                )}
                              </div>
                              {av.queixa_principal && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">Queixa: {av.queixa_principal}</p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Questionários Remotos */}
            {(respostasPaciente.length > 0 || linksAvaliacao.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Questionários Remotos</h3>
                </div>
                <QuestionariosComparacao linksAvPaciente={linksAvaliacao} respostas={respostasPaciente} />
              </div>
            )}

            {avaliacoesId.length === 0 && avaliacoesCob.length === 0 && avaliacoesVoz.length === 0 && respostasPaciente.length === 0 && (
              <EmptyState icon={<Activity />} title="Nenhuma avaliação registrada" subtitle="Utilize os cards acima para iniciar uma avaliação." />
            )}
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
            <StudioNotasTab pacienteId={id!} showSummary={true} />

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

            {/* Treinos */}
            <div>
              <StudioTreinosTab pacienteId={id!} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} />
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: ENGAJAMENTO DO PACIENTE (Portal)
          ══════════════════════════════════════════════════════════════════ */}
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

            {/* Portal do Paciente — Monitoramento */}
            <div>
              <StudioPortalControlTab pacienteId={id!} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} />
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB: FINANCEIRO
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="financeiro" className="mt-4">
            <PacienteFinanceiroTab pacienteId={id!} pacienteNome={`${paciente.nome} ${paciente.sobrenome}`} />
          </TabsContent>

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
