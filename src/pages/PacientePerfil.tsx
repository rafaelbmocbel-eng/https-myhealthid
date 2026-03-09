import { useState, useMemo, useCallback } from 'react';
import { getAgendaUrl } from '@/utils/linkUrls';
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
  BedDouble, Cigarette, Wine, Armchair, Shield, Heart, Sparkles,
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
  const defaultTab = searchParams.get('tab') || 'avaliacoes';
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { links, gerarLink, copiarLink, cancelarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { avaliacoes: avaliacoesId, isLoading: loadingId, deletar: deletarId } = useAvaliacoesIdentidade(id);
  const { avaliacoes: avaliacoesCob, isLoading: loadingCob, deletar: deletarCob } = useAvaliacoesCobZero(id);
  const { evolucoes: evolucoesId } = useEvolucaoPaciente(id);
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

  const [isDeletingQuest, setIsDeletingQuest] = useState<string | null>(null);

  // Real-time update for evaluations and links
  useEffect(() => {
    if (!id || !user) return;

    const channel = supabase
      .channel(`paciente-perfil-updates-${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'avaliacoes_identidade',
          filter: `paciente_id=eq.${id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['avaliacoes-identidade', user.id, id] });
          qc.invalidateQueries({ queryKey: ['evolucao-paciente', user.id, id] });
          qc.invalidateQueries({ queryKey: ['respostas-av-perfil', id] });
          qc.invalidateQueries({ queryKey: ['myid-latest', id] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'links_avaliacao',
          filter: `paciente_id=eq.${id}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['links-av-perfil', id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user, qc]);

  const handleDeleteQuestionario = async (questId: string, tipo: 'antigo' | 'myid') => {
    try {
      setIsDeletingQuest(questId);
      if (tipo === 'antigo') {
        const { error } = await supabase
          .from('respostas_avaliacao_paciente')
          .delete()
          .eq('link_id', questId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('myid_avaliacoes')
          .delete()
          .eq('id', questId);
        if (error) throw error;
      }
      toast({ title: 'Questionário excluído com sucesso' });
      qc.invalidateQueries({ queryKey: ['respostas-av-perfil', id] });
      qc.invalidateQueries({ queryKey: ['avaliacoes-identidade', user?.id, id] });
    } catch (error: any) {
      toast({ title: 'Erro ao excluir questionário', description: error.message, variant: 'destructive' });
    } finally {
      setIsDeletingQuest(null);
    }
  };

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

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {/* Idade */}
          <div className="clinical-card !p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Idade</span>
            </div>
            <div className="text-lg font-bold">
              {idade !== null ? `${idade} anos` : '—'}
            </div>
            {paciente.data_nascimento && (
              <span className="text-[10px] text-muted-foreground">{format(parseISO(paciente.data_nascimento), 'dd/MM/yyyy')}</span>
            )}
          </div>

          {/* Tempo de acompanhamento */}
          <div className="clinical-card !p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Acompanhamento</span>
            </div>
            <div className="text-lg font-bold">
              {formatDistanceToNow(new Date(paciente.created_at), { locale: ptBR })}
            </div>
            <span className="text-[10px] text-muted-foreground">Desde {format(parseISO(paciente.created_at), 'dd/MM/yyyy')}</span>
          </div>

          {/* Total de avaliações */}
          <div className="clinical-card !p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Avaliações</span>
            </div>
            <div className="text-lg font-bold">
              {avaliacoesId.length + avaliacoesCob.length}
            </div>
            <div className="flex gap-2">
              {avaliacoesId.length > 0 && <span className="text-[10px] text-primary">{avaliacoesId.length} ID</span>}
              {avaliacoesCob.length > 0 && <span className="text-[10px] text-blue-600">{avaliacoesCob.length} COB°</span>}
              {avaliacoesId.length + avaliacoesCob.length === 0 && <span className="text-[10px] text-muted-foreground">Nenhuma</span>}
            </div>
          </div>

          {/* Próxima consulta */}
          <div className="clinical-card !p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Próxima Consulta</span>
            </div>
            {agendamentosFuturos.length > 0 ? (
              <>
                <div className="text-lg font-bold">
                  {format(parseISO(agendamentosFuturos[agendamentosFuturos.length - 1].data_inicio), 'dd/MM', { locale: ptBR })}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {format(parseISO(agendamentosFuturos[agendamentosFuturos.length - 1].data_inicio), "HH:mm", { locale: ptBR })}
                </span>
              </>
            ) : (
              <div className="text-lg font-bold text-muted-foreground">—</div>
            )}
          </div>

          {/* Controle de Sessões */}
          <div className="clinical-card !p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wide">Sessões</span>
            </div>
            <div className="text-lg font-bold">
              {sessionMetrics.total > 0 ? `${sessionMetrics.atendidas}/${sessionMetrics.total}` : '—'}
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] text-emerald-600 font-medium">{sessionMetrics.atendidas} ✓</span>
              <span className="text-[10px] text-red-600 font-medium">{sessionMetrics.faltas} ✗</span>
            </div>
          </div>
        </div>

        {/* Contact + Notes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          {/* Contact info */}
          <div className="clinical-card !p-3">
            <div className="space-y-1.5">
              {paciente.telefone && (
                <div className="flex items-center gap-2 text-xs">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{paciente.telefone}</span>
                </div>
              )}
              {paciente.email && (
                <div className="flex items-center gap-2 text-xs">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{paciente.email}</span>
                </div>
              )}
              {paciente.genero && (
                <div className="flex items-center gap-2 text-xs">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="capitalize">{paciente.genero}</span>
                </div>
              )}
            </div>
          </div>
          {/* Observations */}
          {paciente.observacoes && (
            <div className="clinical-card !p-3">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Observações</span>
              </div>
              <p className="text-xs text-muted-foreground">{paciente.observacoes}</p>
            </div>
          )}
        </div>

        {/* ==== 4 TABS ==== */}
        <Tabs defaultValue={defaultTab} onValueChange={(v) => navigate(`/pacientes/${id}?tab=${v}`, { replace: true })}>
          <TabsList className="bg-secondary/50 p-1.5 rounded-xl grid grid-cols-5 h-auto gap-1.5 w-full border shadow-sm">
            <TabsTrigger value="avaliacoes" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-2 py-2">
              <Activity className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Avaliações</span><span className="sm:hidden">Aval.</span>
            </TabsTrigger>

            <TabsTrigger
              value="prontuario"
              className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md text-[10px] sm:text-xs px-3 py-2.5 border-2 border-emerald-500/40 bg-emerald-50/80 data-[state=active]:border-emerald-600 data-[state=active]:text-emerald-800 font-black transition-all hover:bg-emerald-100"
            >
              <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="hidden sm:inline">Evoluções e Prontuário</span>
              <span className="sm:hidden">Prontuário</span>
            </TabsTrigger>

            <TabsTrigger
              value="evolucao"
              className="gap-2 rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-md text-[10px] sm:text-xs px-3 py-2.5 border-2 border-blue-500/40 bg-blue-50/80 data-[state=active]:border-blue-600 data-[state=active]:text-blue-800 font-black transition-all hover:bg-blue-100"
            >
              <BarChart3 className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="hidden sm:inline">Evolução Gráfica</span>
              <span className="sm:hidden">Evolução</span>
            </TabsTrigger>

            <TabsTrigger value="protocolos" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-2 py-2">
              <ClipboardList className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Diretrizes</span><span className="sm:hidden">Dir.</span>
            </TabsTrigger>

            <TabsTrigger value="agenda" className="gap-1 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-[10px] sm:text-xs px-2 py-2">
              <CalendarDays className="h-3.5 w-3.5 shrink-0" /> Agenda
            </TabsTrigger>

          </TabsList>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 1: AVALIAÇÕES & QUESTIONÁRIOS (unificada)
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="avaliacoes" className="mt-4 space-y-6">
            {/* Action Buttons */}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="bg-gradient-primary text-white gap-1.5" onClick={() => navigate(`/metodo-identidade?paciente=${id}`)}>
                <Plus className="h-3.5 w-3.5" /> Nova Avaliação Identidade
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-50" onClick={() => navigate(`/cob-zero?paciente=${id}`)}>
                <Plus className="h-3.5 w-3.5" /> Nova Avaliação COB° ZERO
              </Button>
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
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarLink(linkAvAtivo.token)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      {paciente.telefone && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#25D366]"
                          onClick={() => shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getLinkUrl(linkAvAtivo.token))}>
                          <MessageCircle className="h-3 w-3" />
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
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarAgendaLink(linkAgendaAtivo.token)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      {paciente.telefone && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-[#25D366]"
                          onClick={() => shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getAgendaUrl(linkAgendaAtivo.token))}>
                          <MessageCircle className="h-3 w-3" />
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

              // Build critical alerts from scores
              const alertas: Array<{ icon: any; label: string; valor: string; status: 'critico' | 'alerta' | 'ok'; dica: string }> = [];

              // Score-based alerts
              if (scores.p > 7.5) alertas.push({ icon: AlertTriangle, label: 'Cinesiofobia', valor: `${scores.p.toFixed(1)}/10`, status: 'critico', dica: 'Psicoeducação em dor + exposição gradual' });
              else if (scores.p > 5) alertas.push({ icon: AlertTriangle, label: 'Cinesiofobia', valor: `${scores.p.toFixed(1)}/10`, status: 'alerta', dica: 'Educação sobre movimento seguro' });

              if (scores.r < 3) alertas.push({ icon: Shield, label: 'Regulação', valor: `${scores.r.toFixed(1)}/10`, status: 'critico', dica: 'Avaliação neurovegetativa urgente' });
              else if (scores.r < 5) alertas.push({ icon: Shield, label: 'Regulação', valor: `${scores.r.toFixed(1)}/10`, status: 'alerta', dica: 'Técnicas de regulação + higiene do sono' });

              if (scores.d > 8) alertas.push({ icon: Heart, label: 'Dor', valor: `${scores.d.toFixed(1)}/10`, status: 'critico', dica: 'Dor intensa/neuropática — TENS + terapia manual' });
              else if (scores.d > 5) alertas.push({ icon: Heart, label: 'Dor', valor: `${scores.d.toFixed(1)}/10`, status: 'alerta', dica: 'Modulação de dor ativa' });

              if (scores.c > 8) alertas.push({ icon: AlertTriangle, label: 'Carga Contextual', valor: `${scores.c.toFixed(1)}/10`, status: 'critico', dica: 'Encaminhamento psicológico recomendado' });
              else if (scores.c > 5) alertas.push({ icon: AlertTriangle, label: 'Contexto', valor: `${scores.c.toFixed(1)}/10`, status: 'alerta', dica: 'Suporte emocional + escuta ativa' });

              if (scores.e > 6) alertas.push({ icon: Activity, label: 'Estrutural', valor: `${scores.e.toFixed(1)}/10`, status: 'critico', dica: 'Intervenção manual intensiva' });

              // Lifestyle alerts from dados_avaliacao
              if (dados?.bloco1) {
                const b1 = dados.bloco1;
                if (b1.atividadeFisica === 'nenhuma') alertas.push({ icon: Footprints, label: 'Sedentário', valor: 'Sem atividade', status: 'critico', dica: 'Iniciar caminhadas 20min 3×/sem' });
                if ((b1.litrosAgua ?? 2) < 1.5) alertas.push({ icon: Droplets, label: 'Hidratação', valor: `${b1.litrosAgua ?? 0}L/dia`, status: 'alerta', dica: 'Aumentar para ≥2L/dia' });
                if (b1.tabagismo) alertas.push({ icon: Cigarette, label: 'Tabagismo', valor: 'Ativo', status: 'critico', dica: 'Cessação — retarda cicatrização' });
                if (b1.alcool === 'frequente') alertas.push({ icon: Wine, label: 'Álcool', valor: 'Frequente', status: 'critico', dica: 'Reduzir consumo' });
                if (b1.horasSedentario >= 10) alertas.push({ icon: Armchair, label: 'Horas sentado', valor: `${b1.horasSedentario}h/dia`, status: 'critico', dica: 'Pausas ativas a cada 45min' });
              }
              if (dados?.bloco5) {
                // R1/R2/R3 are INVERTED: high = bad (10 = worst)
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

            {/* Índices de Risco Biopsicossocial — do questionário ou avaliação */}
            {(() => {
              // Prefer latest evaluation scores, fallback to questionnaire responses
              if (avaliacoesId.length > 0) {
                const ult = avaliacoesId[0] as any;
                return <IndicesRiscoComprometimento scores={ult} dadosAvaliacao={ult?.dados_avaliacao} />;
              }
              // Check if there are questionnaire responses with scores
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

            {/* Avaliações Salvas: Método Identidade */}
            {(loadingId || loadingCob) ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <>
                {avaliacoesId.length > 0 && (
                  <div className="clinical-card">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Método Identidade ({avaliacoesId.length})</h3>
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
                              {idx === avaliacoesId.length - 1 && avaliacoesId.length > 1 && <Badge variant="outline" className="text-[10px] h-4 text-muted-foreground">1ª Avaliação</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              ID: {av.id_final?.toFixed(1)}/50 · E:{av.score_e?.toFixed(1)} P:{av.score_p?.toFixed(1)} D:{av.score_d?.toFixed(1)} F:{av.score_f?.toFixed(1)} R:{av.score_r?.toFixed(1)}
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Tem certeza que deseja excluir esta avaliação do histórico? Esta ação não pode ser desfeita.')) {
                                deletarId(av.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {avaliacoesCob.length > 0 && (
                  <div className="clinical-card">
                    <div className="flex items-center gap-2 mb-3">
                      <AlignCenter className="h-4 w-4 text-blue-600" />
                      <h3 className="font-semibold text-sm">COB° ZERO ({avaliacoesCob.length})</h3>
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
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 ml-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm('Tem certeza que deseja excluir esta avaliação COB° ZERO do histórico?')) {
                                deletarCob(av.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {avaliacoesId.length === 0 && avaliacoesCob.length === 0 && (
                  <EmptyState icon={<Activity />} title="Nenhuma avaliação salva" subtitle="Realize uma avaliação completa para visualizar o histórico." />
                )}
              </>
            )}

            {/* Questionários Recebidos */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Questionários Remotos Recebidos</h3>
              </div>
              <QuestionariosComparacao
                linksAvPaciente={linksAvaliacao}
                respostas={respostasPaciente}
                onDelete={handleDeleteQuestionario}
                isDeleting={isDeletingQuest}
              />
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: EVOLUÇÃO
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="evolucao" className="mt-4 space-y-6">
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
                <QuestionariosComparacao
                  linksAvPaciente={linksAvaliacao}
                  respostas={respostasPaciente}
                  onDelete={handleDeleteQuestionario}
                  isDeleting={isDeletingQuest}
                />
              </div>
            )}

            {avaliacoesId.length < 2 && respostasPaciente.length === 0 && (
              <EmptyState icon={<TrendingUp />} title="Sem dados para evolução" subtitle="Realize avaliações ou envie questionários remotos para acompanhar a evolução." />
            )}
          </TabsContent>

          <TabsContent value="protocolos" className="mt-4">
            <PacienteProtocolosTab
              pacienteId={id!}
              pacienteNome={`${paciente.nome} ${paciente.sobrenome}`}
              tipo="identidade"
            />
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 4: AGENDA
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="agenda" className="mt-4 space-y-4">
            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="bg-gradient-primary text-white gap-1.5" onClick={agendarRapido}>
                <Plus className="h-3.5 w-3.5" /> Agendar Sessão
              </Button>
            </div>

            {/* Link de Automarcação */}
            <div className="clinical-card">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-amber-600" />
                <h3 className="font-semibold text-sm">Link de Automarcação</h3>
              </div>
              {linkAgendaAtivo ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-600 mb-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Link ativo — expira em {differenceInDays(new Date(linkAgendaAtivo.data_expiracao), new Date())} dias</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-xs font-mono text-muted-foreground truncate">
                    {getAgendaUrl(linkAgendaAtivo.token)}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => copiarAgendaLink(linkAgendaAtivo.token)}>
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    {paciente.telefone && (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                        onClick={() => shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getAgendaUrl(linkAgendaAtivo.token))}>
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground flex-1">Nenhum link de automarcação ativo.</p>
                  <Button size="sm" variant="outline" className="gap-1 border-amber-400 text-amber-700 hover:bg-amber-50" disabled={gerandoAgenda}
                    onClick={gerarLinkAgenda}>
                    {gerandoAgenda ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarDays className="h-3 w-3" />}
                    Gerar Link (90 dias)
                  </Button>
                </div>
              )}
            </div>

            {/* Sessões Futuras */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-emerald-600" />
                <h3 className="font-semibold text-sm">Próximas Sessões ({agendamentosFuturos.length})</h3>
              </div>
              {loadingAg ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : agendamentosFuturos.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border rounded-xl border-dashed">
                  <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhuma sessão futura agendada.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {agendamentosFuturos.map((ag: any) => (
                    <AgendamentoCard key={ag.id} ag={ag} statusColors={statusColors} />
                  ))}
                </div>
              )}
            </div>

            {/* Sessões Passadas */}
            {agendamentosPassados.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-semibold text-sm text-muted-foreground">Histórico de Sessões ({agendamentosPassados.length})</h3>
                </div>
                <div className="space-y-2">
                  {agendamentosPassados.map((ag: any) => (
                    <AgendamentoCard key={ag.id} ag={ag} statusColors={statusColors} muted />
                  ))}
                </div>
              </div>
            )}

            {!loadingAg && agendamentos.length === 0 && (
              <EmptyState icon={<CalendarDays />} title="Nenhum agendamento" subtitle="Este paciente não possui sessões agendadas." />
            )}
          </TabsContent>

          <TabsContent value="prontuario" className="mt-4">
            <StudioNotasTab pacienteId={id!} showSummary={true} />
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
