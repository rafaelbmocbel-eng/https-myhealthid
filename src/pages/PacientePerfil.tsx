import { useState, useMemo } from 'react';
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
  Plus, Trash2, Edit, Dumbbell,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isBefore, isAfter, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { useAvaliacoesIdentidade, useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';
import { useToast } from '@/hooks/use-toast';
import { useAgenda } from '@/hooks/useAgenda';
import QuestionariosComparacao from '@/components/paciente/QuestionariosComparacao';
import EvolucaoDashboard from '@/components/paciente/EvolucaoDashboard';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';

const SERVICOS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  metodo_identidade: { label: 'Método Identidade', color: 'bg-primary/10 text-primary border-primary/20', icon: <Activity className="h-3 w-3" /> },
  cob_zero: { label: 'COB° ZERO', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: <AlignCenter className="h-3 w-3" /> },
  agenda_premium: { label: 'Agenda Premium', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <CalendarDays className="h-3 w-3" /> },
};

export default function PacientePerfil() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { links, gerarLink, copiarLink, cancelarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { avaliacoes: avaliacoesId, isLoading: loadingId } = useAvaliacoesIdentidade(id);
  const { avaliacoes: avaliacoesCob, isLoading: loadingCob } = useAvaliacoesCobZero(id);
  const [gerandoAgenda, setGerandoAgenda] = useState(false);
  const [agendandoNovo, setAgendandoNovo] = useState(false);

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

  // Agenda: separar passadas e futuras
  const hoje = startOfToday();
  const agendamentosFuturos = agendamentos.filter((ag: any) => isAfter(parseISO(ag.data_inicio), hoje) || format(parseISO(ag.data_inicio), 'yyyy-MM-dd') === format(hoje, 'yyyy-MM-dd'));
  const agendamentosPassados = agendamentos.filter((ag: any) => isBefore(parseISO(ag.data_inicio), hoje) && format(parseISO(ag.data_inicio), 'yyyy-MM-dd') !== format(hoje, 'yyyy-MM-dd'));

  // Quick schedule
  const agendarRapido = async () => {
    navigate(`/agenda`);
  };

  return (
    <AppLayout>
      <div className="container py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-6">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 mt-1" onClick={() => navigate('/pacientes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="h-14 w-14 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-white font-bold text-lg">
            {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">{paciente.nome} {paciente.sobrenome}</h1>
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

        {/* Info Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {paciente.email && (
            <div className="clinical-card !p-3 flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{paciente.email}</span>
            </div>
          )}
          {paciente.telefone && (
            <div className="clinical-card !p-3 flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{paciente.telefone}</span>
            </div>
          )}
          {paciente.data_nascimento && (
            <div className="clinical-card !p-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                {format(parseISO(paciente.data_nascimento), 'dd/MM/yyyy', { locale: ptBR })}
                {idade !== null && ` (${idade} anos)`}
              </span>
            </div>
          )}
          {paciente.genero && (
            <div className="clinical-card !p-3 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground capitalize">{paciente.genero}</span>
            </div>
          )}
        </div>

        {paciente.observacoes && (
          <div className="clinical-card !p-3 mb-6">
            <p className="text-xs text-muted-foreground">{paciente.observacoes}</p>
          </div>
        )}

        {/* ==== 4 TABS ==== */}
        <Tabs defaultValue="avaliacoes">
          <TabsList className="bg-secondary p-1 rounded-xl flex-wrap h-auto gap-1">
            <TabsTrigger value="avaliacoes" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
              <Activity className="h-3.5 w-3.5" /> Avaliações & Questionários
            </TabsTrigger>
            <TabsTrigger value="evolucao" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
              <BarChart3 className="h-3.5 w-3.5" /> Evolução
            </TabsTrigger>
            <TabsTrigger value="protocolos" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
              <ClipboardList className="h-3.5 w-3.5" /> Protocolos
            </TabsTrigger>
            <TabsTrigger value="agenda" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
              <CalendarDays className="h-3.5 w-3.5" /> Agenda
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

            {/* Link de Avaliação Remota */}
            <div className="clinical-card">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Link de Questionário Remoto</h3>
              </div>
              {linkAvAtivo ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-emerald-600 mb-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Link ativo — expira em {differenceInDays(new Date(linkAvAtivo.data_expiracao), new Date())} dias</span>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2 text-xs font-mono text-muted-foreground truncate">
                    {getLinkUrl(linkAvAtivo.token)}
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => copiarLink(linkAvAtivo.token)}>
                      <Copy className="h-3 w-3" /> Copiar
                    </Button>
                    {paciente.telefone && (
                      <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10"
                        onClick={() => shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getLinkUrl(linkAvAtivo.token))}>
                        <MessageCircle className="h-3 w-3" /> WhatsApp
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-muted-foreground flex-1">Nenhum link de questionário ativo.</p>
                  <Button size="sm" className="bg-gradient-primary text-white gap-1" disabled={gerando}
                    onClick={async () => { const novo = await gerarLink(id!); if (novo) copiarLink(novo.token); }}>
                    {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                    Gerar Link (30 dias)
                  </Button>
                </div>
              )}
            </div>

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
              <QuestionariosComparacao linksAvPaciente={linksAvaliacao} respostas={respostasPaciente} />
            </div>
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 2: EVOLUÇÃO
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="evolucao" className="mt-4 space-y-6">
            {/* Evolução Avaliações Identidade */}
            {avaliacoesId.length >= 2 ? (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Evolução — Método Identidade</h3>
                </div>
                <EvolucaoDashboard avaliacoes={avaliacoesId} />
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

            {avaliacoesId.length < 2 && respostasPaciente.length === 0 && (
              <EmptyState icon={<TrendingUp />} title="Sem dados para evolução" subtitle="Realize avaliações ou envie questionários remotos para acompanhar a evolução." />
            )}
          </TabsContent>

          {/* ══════════════════════════════════════════════════════════════════
              TAB 3: PROTOCOLOS
          ══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="protocolos" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-sm">Protocolos de Tratamento</h3>
              </div>
              <Button size="sm" className="bg-gradient-primary text-white gap-1.5" onClick={() => navigate(`/protocolos?paciente=${id}`)}>
                <Plus className="h-3.5 w-3.5" /> Novo Protocolo
              </Button>
            </div>

            {/* Info: baseado em dados atuais */}
            {(avaliacoesId.length > 0 || avaliacoesCob.length > 0) && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                <p className="text-xs text-primary">
                  💡 O novo protocolo será gerado com base na avaliação mais recente
                  {avaliacoesId.length > 0 && ` (Identidade: ${avaliacoesId[0]?.data_avaliacao})`}
                  {avaliacoesCob.length > 0 && ` (COB° ZERO: ${avaliacoesCob[0]?.data_avaliacao})`}
                  {respostasPaciente.length > 0 && ` e ${respostasPaciente.length} questionário(s) remoto(s)`}.
                </p>
              </div>
            )}

            {loadingProto ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : protocolos.length === 0 ? (
              <EmptyState icon={<ClipboardList />} title="Nenhum protocolo" subtitle="Crie um protocolo de tratamento baseado nas avaliações e questionários atuais." />
            ) : (
              <div className="space-y-3">
                {protocolos.map((proto: any) => (
                  <div key={proto.id} className="clinical-card !p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <ClipboardList className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{proto.titulo}</span>
                          <Badge variant="outline" className={cn('text-[10px] h-4', proto.status === 'ativo' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground')}>{proto.status}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {proto.duracao_total} · {proto.frequencia}
                          {proto.created_at && ` · Criado em ${format(parseISO(proto.created_at), 'dd/MM/yyyy', { locale: ptBR })}`}
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => navigate(`/protocolos`)}>
                        <ExternalLink className="h-3 w-3" /> Ver Completo
                      </Button>
                    </div>
                    {proto.objetivo_geral && (
                      <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{proto.objetivo_geral}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
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
        </Tabs>
      </div>
    </AppLayout>
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
