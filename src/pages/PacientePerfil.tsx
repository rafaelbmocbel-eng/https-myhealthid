import { useState } from 'react';
import { getAgendaUrl } from '@/utils/linkUrls';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft, User, Mail, Phone, Calendar, MapPin, FileText, Activity,
  CalendarDays, Link2, Copy, Loader2, Clock, MessageCircle, RefreshCw,
  TrendingUp, AlignCenter, ExternalLink, ClipboardList, BarChart3,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { useAvaliacoesIdentidade, useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';
import { useToast } from '@/hooks/use-toast';
import QuestionariosComparacao from '@/components/paciente/QuestionariosComparacao';
import EvolucaoDashboard from '@/components/paciente/EvolucaoDashboard';

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
  const { links, gerarLink, copiarLink, cancelarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { avaliacoes: avaliacoesId, isLoading: loadingId } = useAvaliacoesIdentidade(id);
  const { avaliacoes: avaliacoesCob, isLoading: loadingCob } = useAvaliacoesCobZero(id);

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

  const allLinks = [
    ...linksAvaliacao.map((l: any) => ({ ...l, tipo: 'Avaliação', validade: '30 dias' })),
    ...linksAgenda.map((l: any) => ({ ...l, tipo: 'Agenda', validade: '90 dias' })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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

        {/* Tabs */}
        <Tabs defaultValue="avaliacoes">
          <TabsList className="bg-secondary p-1 rounded-xl flex-wrap h-auto gap-1">
            <TabsTrigger value="avaliacoes" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
              <Activity className="h-3.5 w-3.5" /> Avaliações
            </TabsTrigger>
            <TabsTrigger value="questionarios" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
              <FileText className="h-3.5 w-3.5" /> Questionários
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
            <TabsTrigger value="links" className="gap-1.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-xs">
              <Link2 className="h-3.5 w-3.5" /> Links
            </TabsTrigger>
          </TabsList>

          {/* Aba Agenda */}
          <TabsContent value="agenda" className="mt-4">
            {loadingAg ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : agendamentos.length === 0 ? (
              <EmptyState icon={<CalendarDays />} title="Nenhum agendamento" subtitle="Este paciente não possui sessões agendadas." />
            ) : (
              <div className="space-y-2">
                {agendamentos.map((ag: any) => (
                  <div key={ag.id} className="clinical-card !p-3 flex items-center gap-3">
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
                ))}
              </div>
            )}
          </TabsContent>

          {/* Aba Avaliações */}
          <TabsContent value="avaliacoes" className="mt-4">
            {(loadingId || loadingCob) ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (avaliacoesId.length + avaliacoesCob.length) === 0 ? (
              <EmptyState icon={<Activity />} title="Nenhuma avaliação" subtitle="Nenhuma avaliação foi salva para este paciente." />
            ) : (
              <div className="space-y-4">
                {avaliacoesId.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">Método Identidade ({avaliacoesId.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {avaliacoesId.map((av: any) => (
                        <div key={av.id} className="clinical-card !p-3 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <TrendingUp className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold">{av.data_avaliacao}</span>
                              {av.classificacao && <Badge variant="outline" className="text-[10px] h-4">{av.classificacao}</Badge>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              ID: {av.id_final?.toFixed(1)}/50 · E:{av.score_e?.toFixed(1)} P:{av.score_p?.toFixed(1)} D:{av.score_d?.toFixed(1)} F:{av.score_f?.toFixed(1)} R:{av.score_r?.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {avaliacoesCob.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlignCenter className="h-4 w-4 text-blue-600" />
                      <h3 className="text-sm font-semibold">COB° ZERO ({avaliacoesCob.length})</h3>
                    </div>
                    <div className="space-y-2">
                      {avaliacoesCob.map((av: any) => (
                        <div key={av.id} className="clinical-card !p-3 flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                            <AlignCenter className="h-4 w-4 text-blue-600" />
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
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Aba Questionários Recebidos */}
          <TabsContent value="questionarios" className="mt-4">
            <QuestionariosComparacao linksAvPaciente={linksAvaliacao} respostas={respostasPaciente} />
          </TabsContent>

          {/* Aba Evolução Comparativa */}
          <TabsContent value="evolucao" className="mt-4">
            {avaliacoesId.length < 2 ? (
              <EmptyState icon={<BarChart3 />} title="Dados insuficientes" subtitle="São necessárias pelo menos 2 avaliações Identidade para gerar o comparativo evolutivo." />
            ) : (
              <EvolucaoDashboard avaliacoes={avaliacoesId} />
            )}
          </TabsContent>

          {/* Aba Protocolos de Tratamento */}
          <TabsContent value="protocolos" className="mt-4">
            {loadingProto ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : protocolos.length === 0 ? (
              <EmptyState icon={<ClipboardList />} title="Nenhum protocolo" subtitle="Nenhum protocolo de tratamento foi gerado para este paciente." />
            ) : (
              <div className="space-y-4">
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

          {/* Aba Links Enviados */}
          <TabsContent value="links" className="mt-4">
            {allLinks.length === 0 ? (
              <EmptyState icon={<Link2 />} title="Nenhum link enviado" subtitle="Nenhum link de avaliação ou agenda foi gerado para este paciente." />
            ) : (
              <div className="space-y-2">
                {allLinks.map((link: any) => {
                  const ativo = link.status === 'ativo' && new Date(link.data_expiracao) > new Date();
                  const diasRestantes = ativo ? differenceInDays(new Date(link.data_expiracao), new Date()) : 0;
                  return (
                    <div key={link.id} className="clinical-card !p-3 flex items-center gap-3">
                      <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', ativo ? 'bg-emerald-100' : 'bg-muted')}>
                        <Link2 className={cn('h-4 w-4', ativo ? 'text-emerald-600' : 'text-muted-foreground')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold">{link.tipo}</span>
                          <Badge variant="outline" className={cn('text-[10px] h-4', ativo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-muted text-muted-foreground')}>
                            {ativo ? `Ativo · ${diasRestantes}d restantes` : 'Expirado'}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Criado em {format(parseISO(link.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })} · {link.acessos_totais || 0} acesso(s)
                        </div>
                      </div>
                      {ativo && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => {
                          const url = link.tipo === 'Avaliação'
                            ? getLinkUrl(link.token)
                            : getAgendaUrl(link.token);
                          navigator.clipboard.writeText(url);
                          toast({ title: 'Link copiado!' });
                        }}>
                          <Copy className="h-3 w-3" /> Copiar
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
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
