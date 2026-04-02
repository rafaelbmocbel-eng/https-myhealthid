import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Navigate, useSearchParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePacientes } from '@/hooks/usePacientes';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles, Users, Search, ChevronRight, Loader2,
  CalendarDays, Target, TrendingUp, BarChart3,
  Dumbbell, Clock, FileText, Plus, Link2,
  Activity, MessageCircle, ExternalLink,
  ArrowLeft, AlertTriangle, Bell, Eye,
  ClipboardList, StickyNote, Ruler, Copy, Smartphone,
  Calendar, X, AlignCenter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { differenceInDays, format, parseISO, isToday, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getAgendaUrl, getBaseUrl, getPortalUrl } from '@/utils/linkUrls';
import { shareAgendaLink, shareAvaliacaoLink } from '@/utils/whatsapp';
import { useToast } from '@/hooks/use-toast';
import { useServicosAtivos } from '@/hooks/useServicosAtivos';

// Sub-components
import StudioTreinosTab from '@/components/studio/StudioTreinosTab';
import StudioEvolucaoTab from '@/components/studio/StudioEvolucaoTab';
import StudioNotasTab from '@/components/studio/StudioNotasTab';
import StudioAvaliacaoTab from '@/components/studio/StudioAvaliacaoTab';
import StudioPortalControlTab from '@/components/studio/StudioPortalControlTab';
import PacoteBadge from '@/components/paciente/PacoteBadge';

export default function StudioPersonalID() {
  const { user, loading: authLoading } = useAuth();
  const { allPacientes: pacientes, isLoading: loadingPacientes } = usePacientes();
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const navigateTo = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(searchParams.get('paciente'));
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente'));
  const [searchPac, setSearchPac] = useState('');

  const { servicos: servicosAtivos } = useServicosAtivos();

  // Stats queries (always called for hook order)
  const { data: agendamentosHoje = [] } = useQuery({
    queryKey: ['studio-agenda-hoje', user?.id],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { data: servicoPacientes } = await supabase
        .from('paciente_servicos')
        .select('paciente_id')
        .eq('servico', 'studio')
        .eq('ativo', true);
      const pacienteIds = (servicoPacientes || []).map((s: any) => s.paciente_id);
      if (pacienteIds.length === 0) return [];
      const { data } = await supabase
        .from('agendamentos')
        .select('*, pacientes(nome, sobrenome)')
        .eq('terapeuta_id', user!.id)
        .in('paciente_id', pacienteIds)
        .gte('data_inicio', today.toISOString())
        .lt('data_inicio', tomorrow.toISOString())
        .order('data_inicio');
      return data || [];
    },
    enabled: !!user && servicosAtivos.studio,
  });

  const { data: studioTreinosCount = 0 } = useQuery({
    queryKey: ['studio-treinos-count', user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('studio_treinos')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true);
      return count || 0;
    },
    enabled: !!user,
  });

  const { data: linksAgenda = [] } = useQuery({
    queryKey: ['links-agenda-dashboard', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('status', 'ativo')
        .gt('data_expiracao', new Date().toISOString());
      return data || [];
    },
    enabled: !!user,
  });

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const selectedPaciente = pacientes.find(p => p.id === selectedPacienteId);
  const filteredPac = pacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(searchPac.toLowerCase())
  );

  const getLinkAtivo = (pid: string) =>
    links.find(l => l.paciente_id === pid && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  const getAgendaAtivo = (pid: string) => linksAgenda.find(l => l.paciente_id === pid);

  const copiarAgendaLink = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link da agenda copiado! 📋' });
  };

  const handleSelectPaciente = (pac: typeof pacientes[0]) => {
    setSelectedPacienteId(pac.id);
    setShowDashboard(true);
  };

  // ─── Student Dashboard (Tab-based) ──────────────────────────────────────────
  if (selectedPacienteId && showDashboard && selectedPaciente) {
    return (
      <AppLayout>
        <div className="container py-6 max-w-4xl">
          {/* Header Unificado */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => { setSelectedPacienteId(null); setShowDashboard(false); }} className="shrink-0 h-8 w-8 p-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-studio flex items-center justify-center text-white font-bold">
                {selectedPaciente.nome[0]}{selectedPaciente.sobrenome?.[0] || ''}
              </div>
              <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-8">
                <div>
                  <h1 className="text-lg md:text-xl font-bold text-foreground leading-tight truncate">
                    {selectedPaciente.nome} {selectedPaciente.sobrenome}
                  </h1>
                  <p className="text-xs md:text-sm text-muted-foreground">{selectedPaciente.email || selectedPaciente.telefone || 'Sem contato'}</p>
                </div>

                {/* Botões de Ação Dinâmicos (Ao lado do nome) */}
                <div className="flex items-center gap-4 md:gap-5 pt-1">
                  {/* AGENDA */}
                  <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
                    <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Agenda</span>
                    <div className="flex gap-1">
                      {getAgendaAtivo(selectedPaciente.id) ? (
                        selectedPaciente.telefone ? (
                          <Button size="icon" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => shareAgendaLink(`${selectedPaciente.nome} ${selectedPaciente.sobrenome}`, selectedPaciente.telefone!, getAgendaUrl(getAgendaAtivo(selectedPaciente.id).token))} title="Enviar no WhatsApp">
                            <Smartphone className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800" onClick={() => copiarAgendaLink(getAgendaAtivo(selectedPaciente.id).token)} title="Copiar Link Agenda">
                            <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          </Button>
                        )
                      ) : (
                        <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-dashed text-accent/80" disabled={true} title="Sem Agenda Ativa">
                          <Plus className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* PORTAL */}
                  {selectedPaciente.portal_token && (
                    <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
                      <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Portal</span>
                      <div className="flex gap-1">
                        {selectedPaciente.telefone ? (
                          <Button size="icon" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => { const url = getPortalUrl(selectedPaciente.portal_token!); const msg = `Olá ${selectedPaciente.nome}! 🩺\n\nAcesse seu Portal do Paciente:\n${url}`; window.open(`https://wa.me/${selectedPaciente.telefone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank'); }} title="Enviar Portal via WhatsApp">
                            <Smartphone className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="outline" className="h-[24px] w-[24px] md:h-[28px] md:w-[28px] rounded-lg border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 hover:text-violet-800" onClick={() => { navigator.clipboard.writeText(getPortalUrl(selectedPaciente.portal_token!)); toast({ title: 'Link do Portal copiado! 🔗' }); }} title="Copiar Link do Portal">
                            <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                  <PacoteBadge pacienteId={selectedPaciente.id} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="hidden sm:flex gap-2 border-border hover:bg-muted" asChild>
                <Link to={`/pacientes/${selectedPaciente.id}`}>
                  <ExternalLink className="h-4 w-4" />
                  Perfil
                </Link>
              </Button>
              <Button className="hidden sm:flex bg-studio hover:bg-studio/90 text-white gap-2">
                <AlignCenter className="h-4 w-4" /> Nova Avaliação
              </Button>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="avaliacao" className="w-full">
            <TabsList className="grid w-full grid-cols-5 h-10 bg-muted/60">
              <TabsTrigger value="avaliacao" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <ClipboardList className="h-3.5 w-3.5" /> Avaliação
              </TabsTrigger>
              <TabsTrigger value="treinos" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <Dumbbell className="h-3.5 w-3.5" /> Treinos
              </TabsTrigger>
              <TabsTrigger value="portal" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <Eye className="h-3.5 w-3.5" /> Portal
              </TabsTrigger>
              <TabsTrigger value="evolucao" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <BarChart3 className="h-3.5 w-3.5" /> Evolução
              </TabsTrigger>
              <TabsTrigger value="notas" className="text-xs gap-1 data-[state=active]:bg-gradient-studio data-[state=active]:text-white">
                <StickyNote className="h-3.5 w-3.5" /> Notas
              </TabsTrigger>
            </TabsList>

            <TabsContent value="avaliacao" className="mt-4">
              <StudioAvaliacaoTab pacienteId={selectedPaciente.id} pacienteNome={selectedPaciente.nome} pacienteTelefone={selectedPaciente.telefone} />
            </TabsContent>

            <TabsContent value="treinos" className="mt-4">
              <StudioTreinosTab pacienteId={selectedPaciente.id} pacienteNome={selectedPaciente.nome} />
            </TabsContent>

            <TabsContent value="portal" className="mt-4">
              <StudioPortalControlTab pacienteId={selectedPaciente.id} pacienteNome={selectedPaciente.nome} />
            </TabsContent>

            <TabsContent value="evolucao" className="mt-4">
              <StudioEvolucaoTab pacienteId={selectedPaciente.id} />
            </TabsContent>

            <TabsContent value="notas" className="mt-4">
              <StudioNotasTab pacienteId={selectedPaciente.id} />
            </TabsContent>
          </Tabs>
        </div>
      </AppLayout>
    );
  }

  // ─── Main Dashboard ─────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="container py-6 max-w-4xl">
        {/* Module Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-gradient-studio flex items-center justify-center shadow-lg">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Studio Personal ID</h1>
            <p className="text-muted-foreground text-sm">Treinamento Personalizado Integrado à Saúde</p>
          </div>
        </div>

        {/* Visão Geral Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { icon: Users, label: 'Alunos Ativos', value: pacientes.length, color: 'text-studio' },
            { icon: CalendarDays, label: 'Sessões Hoje', value: agendamentosHoje.length, color: 'text-studio' },
            { icon: Dumbbell, label: 'Treinos Ativos', value: studioTreinosCount, color: 'text-studio' },
            { icon: Activity, label: 'Status', value: 'On', color: 'text-studio' },
          ].map(stat => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label} className="border-studio/10 hover:border-studio/30 transition-all">
                <CardContent className="pt-4 pb-3 text-center">
                  <Icon className={cn('h-5 w-5 mx-auto mb-1', stat.color)} />
                  <div className="text-2xl font-black text-foreground">{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>


        {/* Agenda Hoje */}
        {servicosAtivos.studio && agendamentosHoje.length > 0 && (
          <Card className="mb-6">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-3">
                <CalendarDays className="h-4 w-4 text-studio" />
                <h3 className="font-bold text-sm text-foreground">
                  Agenda Hoje — {format(new Date(), "EEEE, dd/MM", { locale: ptBR })}
                </h3>
              </div>
              <div className="space-y-2">
                {agendamentosHoje.map((ag: any) => (
                  <div key={ag.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="h-8 w-8 rounded-lg bg-gradient-studio flex items-center justify-center shrink-0">
                      <Clock className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {format(parseISO(ag.data_inicio), "HH:mm")} — {(ag.pacientes as any)?.nome || ag.titulo || 'Sessão'}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{ag.tipo_atendimento || 'Atendimento'}</div>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px]',
                      ag.status === 'confirmado' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        ag.status === 'pendente' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-muted text-muted-foreground'
                    )}>{ag.status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Patient List */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Alunos</h3>
              </div>
              <Badge variant="outline" className="text-xs">{pacientes.length}</Badge>
            </div>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar aluno..." className="pl-9" value={searchPac} onChange={e => setSearchPac(e.target.value)} />
            </div>

            {loadingPacientes ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-studio" /></div>
            ) : filteredPac.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">Nenhum aluno cadastrado</p>
                <p className="text-sm mt-1">Cadastre em <strong>Pacientes</strong> para começar</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPac.map(p => {
                  const linkAtivo = getLinkAtivo(p.id);
                  const linkAgenda = getAgendaAtivo(p.id);

                  return (
                    <div key={p.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border hover:border-studio/40 hover:bg-studio-light/20 transition-all cursor-pointer bg-card"
                      onClick={() => handleSelectPaciente(p)}
                    >
                      {/* Paciente Info */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-10 w-10 rounded-full bg-gradient-studio flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-md">
                          {p.nome[0]}{p.sobrenome?.[0] || ''}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                          <div className="flex justify-between items-center sm:block mt-0.5">
                            <p className="text-xs text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                          </div>
                        </div>
                      </div>

                      {/* Ações (Links + Avaliação) */}
                      <div className="flex items-center justify-between sm:justify-end gap-3 flex-wrap sm:flex-nowrap" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 border-r pr-3">
                          {/* Link MyID */}
                          <div className="flex flex-col gap-1 items-center">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">MyID</span>
                            {linkAtivo ? (
                              <div className="flex items-center gap-1">
                                {p.telefone ? (
                                  <Button size="icon" variant="outline" className="h-7 w-7 rounded-sm border-emerald-200 text-white bg-[#25D366] hover:bg-[#20BE5C]" onClick={() => shareAvaliacaoLink(`${p.nome} ${p.sobrenome}`, p.telefone!, getLinkUrl(linkAtivo.token))} title="Enviar MyID WhatsApp">
                                    <Smartphone className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Button size="icon" variant="outline" className="h-7 w-7 rounded-sm border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100" onClick={() => copiarLink(linkAtivo.token)} title="Copiar Link MyID">
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <Button size="sm" variant="outline" className="h-7 text-[10px] px-2" disabled={gerando} onClick={() => gerarLink(p.id)}>
                                {gerando ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link2 className="h-3 w-3 mr-1" />} Novo Link
                              </Button>
                            )}
                          </div>

                          {/* Link Agenda */}
                          <div className="flex flex-col gap-1 items-center pl-1">
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Agenda</span>
                            {linkAgenda ? (
                              <div className="flex items-center gap-1">
                                {p.telefone ? (
                                  <Button size="icon" variant="outline" className="h-7 w-7 rounded-sm border-indigo-200 text-white bg-[#25D366] hover:bg-[#20BE5C]" onClick={() => shareAgendaLink(`${p.nome} ${p.sobrenome}`, p.telefone!, getAgendaUrl(linkAgenda.token))} title="Enviar Agenda WhatsApp">
                                    <Smartphone className="h-3 w-3" />
                                  </Button>
                                ) : (
                                  <Button size="icon" variant="outline" className="h-7 w-7 rounded-sm border-indigo-200 text-indigo-600 bg-indigo-50 hover:bg-indigo-100" onClick={() => copiarAgendaLink(linkAgenda.token)} title="Copiar Link Agenda">
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground mt-1">S/ Link</span>
                            )}
                          </div>
                        </div>

                        <Button
                          size="sm"
                          className="bg-studio hover:bg-studio-dark text-white gap-1 ml-1"
                          onClick={() => handleSelectPaciente(p)}
                        >
                          Avaliação <ChevronRight className="h-3 w-3" />
                        </Button>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
