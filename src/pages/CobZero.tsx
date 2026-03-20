import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { AvaliacaoCobZero } from '@/types/cobzero';
import CobEtapaBasica from '@/components/cobzero/CobEtapaBasica';
import CobEtapaAntropometrica from '@/components/cobzero/CobEtapaAntropometrica';
import CobEtapaLenke from '@/components/cobzero/CobEtapaLenke';
import CobEtapaUnidades from '@/components/cobzero/CobEtapaUnidades';
import CobEtapaPrograma from '@/components/cobzero/CobEtapaPrograma';
import RelatorioCobZero from '@/components/cobzero/RelatorioCobZero';
import PacienteDashboardCobZero from '@/components/paciente/PacienteDashboardCobZero';
import {
  CheckCircle2, Circle, AlignCenter, ClipboardList, Ruler, BookOpen, Dumbbell, BarChart3, Users, Search, ChevronRight, Loader2,
  CalendarDays, Clock, Activity, Smartphone, Copy, Link2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { usePacientes } from '@/hooks/usePacientes';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, startOfDay, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { getAgendaUrl } from '@/utils/linkUrls';
import { shareAgendaLink, shareAvaliacaoLink } from '@/utils/whatsapp';
import { useToast } from '@/hooks/use-toast';
import { useServicosAtivos } from '@/hooks/useServicosAtivos';

const etapas = [
  { id: 1, label: 'Dados Básicos', sublabel: 'Queixa & História', icon: ClipboardList, time: '5 min' },
  { id: 2, label: 'Antropometria', sublabel: 'Adam, ATR, Goniometria', icon: Ruler, time: '10 min' },
  { id: 3, label: 'Radiografia & Lenke', sublabel: 'Cobb, Risser, Tipo', icon: AlignCenter, time: '15 min' },
  { id: 4, label: 'Unidades Corporais', sublabel: 'UC1-UC4, UA, ID/DD', icon: Dumbbell, time: '10 min' },
  { id: 5, label: 'Plano Terapêutico', sublabel: '4 Fases COB° ZERO', icon: BookOpen, time: '5 min' },
];

const defaultAvaliacao: AvaliacaoCobZero = {
  pacienteNome: 'Maria Oliveira',
  pacienteIdade: 15,
  pacienteSexo: 'F',
  terapeutaNome: 'Dr. Paulo Alves',
  dataAvaliacao: new Date().toLocaleDateString('pt-BR'),
  etapaBasica: {
    queixaPrincipal: '', duracaoMeses: 0, aindaCrescendo: true,
    tannerStage: 3, metasTerapeuticas: ['', '', ''], atividadeFisica: 'moderada',
    historicEscoliose: false,
  },
  etapaAntropometrica: {
    altura: 165, peso: 55, circumferenceCintura: 68, testeAdam: 8,
    atr: 12, romCervical: 80, romToracica: 70, romLombar: 75, fotosUrls: [],
  },
  etapaLenke: {
    cobbAngle: 32, lenkeType: '1', lumbarModifier: 'B',
    sagittalModifier: 'N', risserStage: 2, verticalRotation: 15,
    radiographDate: '', aguardandoRadiografia: false,
  },
  etapaRisco: { riskPercentage: 0, riskLevel: 'MODERADO', risserAdjustment: 0 },
  unidades: [],
  scoreE: 0,
  etapaSRS: {
    funcaoAtividade: [3, 3, 3, 3, 3], aparencia: [3, 3, 3, 3, 3],
    dor: [3, 3, 3, 3, 3], saudeMental: [3, 3, 3, 3, 3],
    satisfacaoTratamento: [3, 3], scoreSRS22r: 65,
  },
  redFlags: {
    dorNoturna: false, progressaoRapida: false, deficitNeurologico: false,
    sintomasSistemicos: false, coletePrevio: false, cirurgiaPrevia: false, terapiaAnterior: false,
  },
  diagnosticoIA: '',
  metodoRecomendado: '',
  prognostico: '',
  faseAtual: 1,
  etapaAtual: 1,
  concluido: false,
};

const makeDefaultAvaliacao = (pacienteNome = 'Paciente'): AvaliacaoCobZero => ({
  ...defaultAvaliacao,
  pacienteNome,
});

export default function CobZero() {
  const { user, loading: authLoading } = useAuth();
  const { pacientes, isLoading: loadingPacientes } = usePacientes('cob_zero');
  const { salvar: salvarAvaliacao } = useAvaliacoesCobZero();
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const navigateTo = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(searchParams.get('paciente'));
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente'));
  const [searchPac, setSearchPac] = useState('');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoCobZero>(defaultAvaliacao);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [etapasConcluidas, setEtapasConcluidas] = useState<Set<number>>(new Set());

  const { servicos: servicosAtivos } = useServicosAtivos();

  // Stats queries
  const { data: agendamentosHoje = [] } = useQuery({
    queryKey: ['cobzero-agenda-hoje', user?.id],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { data: servicoPacientes } = await supabase
        .from('paciente_servicos')
        .select('paciente_id')
        .eq('servico', 'cob_zero')
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
    enabled: !!user && servicosAtivos.cob_zero,
  });

  const { data: cobZeroAvaliacoesCount = 0 } = useQuery({
    queryKey: ['cobzero-count', user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('avaliacoes_cob_zero')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id);
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
  const getLinkAtivo = (pid: string) => links.find(l => l.paciente_id === pid && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());
  const getAgendaAtivo = (pid: string) => linksAgenda.find(l => l.paciente_id === pid);

  const copiarAgendaLink = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link da agenda copiado! 📋' });
  };

  const updateEtapa = (key: keyof AvaliacaoCobZero, data: any) => {
    setAvaliacao(prev => ({ ...prev, [key]: data }));
  };

  const avancarEtapa = (etapaAtual: number) => {
    setEtapasConcluidas(prev => new Set([...prev, etapaAtual]));
    if (etapaAtual < 5) {
      setAvaliacao(prev => ({ ...prev, etapaAtual: etapaAtual + 1 }));
    } else {
      const finalAv = { ...avaliacao, concluido: true };
      setAvaliacao(finalAv);
      setShowRelatorio(true);
      // Auto-save to patient record
      if (selectedPacienteId) {
        salvarAvaliacao({ avaliacao: finalAv, pacienteId: selectedPacienteId });
      }
    }
  };

  const voltarEtapa = () => {
    setAvaliacao(prev => ({ ...prev, etapaAtual: Math.max(1, prev.etapaAtual - 1) }));
  };

  const progresso = (etapasConcluidas.size / 5) * 100;
  const filteredPac = pacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(searchPac.toLowerCase())
  );

  const handleSelectPaciente = (pac: typeof pacientes[0]) => {
    setSelectedPacienteId(pac.id);
    setShowDashboard(true);
    setShowRelatorio(false);
  };

  const handleIniciarAvaliacao = () => {
    if (!selectedPaciente) return;
    setAvaliacao({ ...defaultAvaliacao, pacienteNome: `${selectedPaciente.nome} ${selectedPaciente.sobrenome}` });
    setEtapasConcluidas(new Set());
    setShowDashboard(false);
    setShowRelatorio(false);
  };

  if (showRelatorio) {
    return (
      <AppLayout>
        <RelatorioCobZero avaliacao={avaliacao} pacienteId={selectedPacienteId || undefined} onBack={() => {
          setShowRelatorio(false);
          if (selectedPacienteId) setShowDashboard(true);
        }} />
      </AppLayout>
    );
  }

  if (selectedPacienteId && showDashboard && selectedPaciente) {
    return (
      <AppLayout>
        <div className="container py-6 max-w-4xl">
          <PacienteDashboardCobZero
            paciente={selectedPaciente}
            onBack={() => { setSelectedPacienteId(null); setShowDashboard(false); }}
            onIniciarAvaliacao={handleIniciarAvaliacao}
            onVerRelatorio={(av) => { setAvaliacao(av); setShowRelatorio(true); }}
          />
        </div>
      </AppLayout>
    );
  }

  if (!selectedPacienteId) {
    return (
      <AppLayout>
        <div className="container py-6 max-w-4xl">
          {/* Module Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg">
              <AlignCenter className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">COB° ZERO</h1>
              <p className="text-muted-foreground text-sm">Protocolo Integrado de Escoliose</p>
            </div>
          </div>

          {/* Visão Geral Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { icon: Users, label: 'Pacientes Ativos', value: pacientes.length, color: 'text-blue-600' },
              { icon: CalendarDays, label: 'Sessões Hoje', value: agendamentosHoje.length, color: 'text-blue-600' },
              { icon: Activity, label: 'Exames Efetuados', value: cobZeroAvaliacoesCount, color: 'text-blue-600' },
              { icon: CheckCircle2, label: 'Status', value: 'On', color: 'text-blue-600' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="border-blue-600/10 hover:border-blue-600/30 transition-all">
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
          {servicosAtivos.cob_zero && agendamentosHoje.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-blue-600" />
                  <h3 className="font-bold text-sm text-foreground">
                    Agenda Hoje — {format(new Date(), "EEEE, dd/MM", { locale: ptBR })}
                  </h3>
                </div>
                <div className="space-y-2">
                  {agendamentosHoje.map((ag: any) => (
                    <div key={ag.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0">
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
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Pacientes</h3>
                </div>
                <Badge variant="outline" className="text-xs">{pacientes.length}</Badge>
              </div>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar paciente..."
                  className="pl-9"
                  value={searchPac}
                  onChange={e => setSearchPac(e.target.value)}
                />
              </div>

              {loadingPacientes ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : filteredPac.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Nenhum paciente com COB° ZERO ativo</p>
                  <p className="text-sm mt-1">Cadastre pacientes em <strong>Pacientes</strong> e ative o serviço.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredPac.map(p => {
                    const linkAtivo = getLinkAtivo(p.id);
                    const linkAgenda = getAgendaAtivo(p.id);

                    return (
                      <div
                        key={p.id}
                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border hover:border-blue-600/40 hover:bg-blue-50/50 transition-all cursor-pointer bg-card"
                        onClick={() => handleSelectPaciente(p)}
                      >
                        {/* Paciente Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-md">
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
                                  <Button size="icon" variant="outline" className="h-7 w-7 rounded-sm border-emerald-200 text-emerald-600 bg-emerald-50 hover:bg-emerald-100" onClick={() => copiarLink(linkAtivo.token)} title="Copiar Link MyID">
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  {p.telefone && (
                                    <Button size="icon" variant="outline" className="h-7 w-7 rounded-sm border-emerald-200 text-white bg-[#25D366] hover:bg-[#20BE5C]" onClick={() => shareAvaliacaoLink(`${p.nome} ${p.sobrenome}`, p.telefone!, getLinkUrl(linkAtivo.token))} title="Enviar MyID WhatsApp">
                                      <Smartphone className="h-3 w-3" />
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
                                  <Button size="icon" variant="outline" className="h-7 w-7 rounded-sm border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100" onClick={() => copiarAgendaLink(linkAgenda.token)} title="Copiar Link Agenda">
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  {p.telefone && (
                                    <Button size="icon" variant="outline" className="h-7 w-7 rounded-sm border-blue-200 text-white bg-[#25D366] hover:bg-[#20BE5C]" onClick={() => shareAgendaLink(`${p.nome} ${p.sobrenome}`, p.telefone!, getAgendaUrl(linkAgenda.token))} title="Enviar Agenda WhatsApp">
                                      <Smartphone className="h-3 w-3" />
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
                            className="bg-blue-600 hover:bg-blue-700 text-white gap-1 ml-1"
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

  return (
    <AppLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg">
              <AlignCenter className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">COB° ZERO</h1>
              <p className="text-muted-foreground text-sm">Protocolo Integrado de Escoliose | {avaliacao.dataAvaliacao}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => setSelectedPacienteId(null)}>
              <Users className="h-3.5 w-3.5 mr-1" /> Trocar paciente
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progresso da avaliação</span>
                <span className="font-medium text-blue-600">{etapasConcluidas.size}/5 etapas</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Paciente</div>
              <div className="font-semibold">{avaliacao.pacienteNome}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Sidebar - horizontal scroll on mobile */}
          <div className="lg:col-span-1">
            <div className="clinical-card lg:sticky lg:top-24 !p-3 sm:!p-6">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 hidden lg:block">Etapas de Avaliação</h3>
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-1 px-1 snap-x snap-mandatory lg:snap-none">
                {etapas.map(etapa => {
                  const Icon = etapa.icon;
                  const isActive = avaliacao.etapaAtual === etapa.id;
                  const isConcluida = etapasConcluidas.has(etapa.id);
                  return (
                    <button
                      key={etapa.id}
                      onClick={() => setAvaliacao(prev => ({ ...prev, etapaAtual: etapa.id }))}
                      className={`shrink-0 lg:shrink text-left block-step snap-start min-w-[130px] lg:min-w-0 lg:w-full ${isActive ? 'active' : isConcluida ? 'completed' : 'pending'
                        }`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        {isConcluida ? (
                          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
                        ) : isActive ? (
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className={`text-xs sm:text-sm font-medium truncate ${isActive ? 'text-primary' : isConcluida ? 'text-success' : 'text-foreground'}`}>
                            {etapa.label}
                          </div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground hidden lg:block">{etapa.sublabel} · {etapa.time}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {etapasConcluidas.size >= 3 && (
                <Button
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => setShowRelatorio(true)}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Ver Relatório
                </Button>
              )}
            </div>
          </div>

          {/* Conteúdo */}
          <div className="lg:col-span-3 animate-slide-in">
            {avaliacao.etapaAtual === 1 && (
              <CobEtapaBasica
                data={avaliacao.etapaBasica}
                onChange={(d) => updateEtapa('etapaBasica', d)}
                onNext={() => avancarEtapa(1)}
              />
            )}
            {avaliacao.etapaAtual === 2 && (
              <CobEtapaAntropometrica
                data={avaliacao.etapaAntropometrica}
                onChange={(d) => updateEtapa('etapaAntropometrica', d)}
                onNext={() => avancarEtapa(2)}
                onBack={voltarEtapa}
              />
            )}
            {avaliacao.etapaAtual === 3 && (
              <CobEtapaLenke
                data={avaliacao.etapaLenke}
                pacienteSexo={avaliacao.pacienteSexo}
                onChange={(d) => updateEtapa('etapaLenke', d)}
                onRiscoChange={(d) => updateEtapa('etapaRisco', d)}
                onNext={() => avancarEtapa(3)}
                onBack={voltarEtapa}
              />
            )}
            {avaliacao.etapaAtual === 4 && (
              <CobEtapaUnidades
                unidades={avaliacao.unidades}
                onChange={(u, s) => setAvaliacao(prev => ({ ...prev, unidades: u, scoreE: s }))}
                onNext={() => avancarEtapa(4)}
                onBack={voltarEtapa}
              />
            )}
            {avaliacao.etapaAtual === 5 && (
              <CobEtapaPrograma
                avaliacao={avaliacao}
                onNext={() => avancarEtapa(5)}
                onBack={voltarEtapa}
              />
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
