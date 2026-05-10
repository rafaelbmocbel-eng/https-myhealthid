import { useState, useCallback, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useServicosAtivos } from '@/hooks/useServicosAtivos';
import AppLayout from '@/components/AppLayout';
import { AvaliacaoMyID, DEFAULT_BLOCO1, DEFAULT_BLOCO2, DEFAULT_BLOCO3, DEFAULT_BLOCO4, DEFAULT_BLOCO5, DEFAULT_BLOCO6, DEFAULT_RED_FLAGS } from '@/types/myid';
import PacienteDashboardIdentidade from '@/components/paciente/PacienteDashboardIdentidade';
import { MyIDPhasedFlow } from '@/components/myid/MyIDPhasedFlow';
import { MyIDCalculator } from '@/utils/myid/calculator';
import RelatorioIdentidade from '@/components/identidade/RelatorioIdentidade';
import ProtocoloEditor from '@/components/protocolo/ProtocoloEditor';

import {
  CheckCircle2, Circle, ClipboardList, Activity, Brain,
  Bed, Dumbbell, Users, Link2, Copy, Loader2, Search, ChevronRight, ArrowLeft, ArrowRight, MessageCircle,
  CalendarDays, Clock, Smartphone, Mail
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { usePacientes } from '@/hooks/usePacientes';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { differenceInDays, format, parseISO, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { getAgendaUrl, getPortalUrl } from '@/utils/linkUrls';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Navigate, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAvaliacoesIdentidade } from '@/hooks/useAvaliacoesSalvas';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { clearDraft, readDraft, writeDraft } from '@/lib/draftStorage';
import LinkActionsBar, { type LinkActionItem } from '@/components/paciente/LinkActionsBar';

const MYID_DRAFT_VERSION = 1;

const blocos = [
  { id: 1, label: 'Identificação', sublabel: 'Gatilho I', icon: ClipboardList, time: '2 min' },
  { id: 2, label: 'Mapeamento Dor', sublabel: 'Score D', icon: Activity, time: '4 min' },
  { id: 3, label: 'Funcionalidade', sublabel: 'Score EFI', icon: Activity, time: '3 min' },
  { id: 4, label: 'Comportamento', sublabel: 'Score P', icon: Brain, time: '4 min' },
  { id: 5, label: 'Regulação', sublabel: 'Scores R e C', icon: Bed, time: '5 min' },
  { id: 6, label: 'Ruído Sistêmico', sublabel: 'Score N', icon: Dumbbell, time: '3 min' },
];

const makeDefaultAvaliacao = (pacienteNome = 'Paciente'): AvaliacaoMyID => ({
  pacienteNome,
  pacienteIdade: 35,
  dataAvaliacao: new Date().toLocaleDateString('pt-BR'),
  bloco1: { ...DEFAULT_BLOCO1 },
  bloco2: { ...DEFAULT_BLOCO2 },
  bloco3: { ...DEFAULT_BLOCO3 },
  bloco4: { ...DEFAULT_BLOCO4 },
  bloco5: { ...DEFAULT_BLOCO5 },
  bloco6: { ...DEFAULT_BLOCO6 },
  resultado: { myidScore: 0, myidStatus: '', componentScores: { D: 0, EFI: 0, P: 0, I: 0, R: 0, C: 0, N: 0 }, redFlagsDetected: false, redFlagAlerts: [], classificacao: '' },
  blocoAtual: 1,
  concluido: false,
});

export default function MetodoIdentidade() {
  const { user, loading: authLoading } = useAuth();
  const { pacientes, isLoading: loadingPacientes } = usePacientes('metodo_identidade');
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { salvar: salvarAvaliacao } = useAvaliacoesIdentidade();

  const navigateTo = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(searchParams.get('paciente'));
  const autoIniciar = searchParams.get('iniciar') === '1';
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente') && !autoIniciar);
  const [searchPac, setSearchPac] = useState('');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoMyID>(makeDefaultAvaliacao());
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [showDiretrizBuilder, setShowDiretrizBuilder] = useState(false);
  const [savedAvaliacaoId, setSavedAvaliacaoId] = useState<string | null>(null);
  const [blocosConcluidos, setBlocosConcluidos] = useState<Set<number>>(new Set());
  const [draftReady, setDraftReady] = useState(false);


  const { servicos: servicosAtivos } = useServicosAtivos();
  const myidDraftKey = `metodo-identidade:${user?.id ?? 'anon'}`;

  // Stats queries (always called for hook order)
  const { data: agendamentosHoje = [] } = useQuery({
    queryKey: ['metodo-agenda-hoje', user?.id],
    queryFn: async () => {
      const today = startOfDay(new Date());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      // Get patients enrolled in identidade service
      const { data: servicoPacientes } = await supabase
        .from('paciente_servicos')
        .select('paciente_id')
        .eq('servico', 'identidade')
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
    enabled: !!user && servicosAtivos.identidade,
  });

  const { data: myidAvaliacoesCount = 0 } = useQuery({
    queryKey: ['myid-count', user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from('myid_avaliacoes')
        .select('id', { count: 'exact', head: true })
        .eq('terapeuta_id', user!.id)
        .eq('status', 'concluido');
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

  const [pendingDraft, setPendingDraft] = useState<{
    selectedPacienteId: string | null;
    showDashboard: boolean;
    avaliacao: AvaliacaoMyID;
    showRelatorio: boolean;
    blocosConcluidos: number[];
  } | null>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;

    void readDraft<{
      selectedPacienteId: string | null;
      showDashboard: boolean;
      avaliacao: AvaliacaoMyID;
      showRelatorio: boolean;
      blocosConcluidos: number[];
    }>(myidDraftKey, MYID_DRAFT_VERSION).then((draft) => {
      if (!active) return;
      if (draft && (draft.blocosConcluidos?.length > 0 || draft.avaliacao?.blocoAtual > 1 || draft.showRelatorio)) {
        setPendingDraft(draft);
      } else {
        if (draft) void clearDraft(myidDraftKey);
      }
      setDraftReady(true);
    });

    return () => {
      active = false;
    };
  }, [myidDraftKey, user]);

  const handleRestoreDraft = () => {
    if (!pendingDraft) return;
    setSelectedPacienteId(pendingDraft.selectedPacienteId);
    setShowDashboard(pendingDraft.showDashboard);
    setAvaliacao(pendingDraft.avaliacao);
    setShowRelatorio(pendingDraft.showRelatorio);
    setShowDiretrizBuilder(false);
    setSavedAvaliacaoId(null);
    setBlocosConcluidos(new Set(pendingDraft.blocosConcluidos ?? []));
    setPendingDraft(null);
    toast({ title: '✅ Avaliação restaurada', description: 'Continuando de onde você parou.' });
  };

  const handleDiscardDraft = async () => {
    await clearDraft(myidDraftKey);
    setSelectedPacienteId(null);
    setShowDashboard(false);
    setShowRelatorio(false);
    setShowDiretrizBuilder(false);
    setSavedAvaliacaoId(null);
    setAvaliacao(makeDefaultAvaliacao());
    setBlocosConcluidos(new Set());
    setPendingDraft(null);
    toast({ title: 'Rascunho descartado', description: 'Você pode iniciar uma nova avaliação.' });
  };

  useEffect(() => {
    if (!user || !draftReady || showDiretrizBuilder || pendingDraft) return;

    const hasProgress = Boolean(
      selectedPacienteId ||
      showRelatorio ||
      blocosConcluidos.size > 0 ||
      avaliacao.blocoAtual > 1 ||
      avaliacao.concluido ||
      avaliacao.resultado?.myidScore
    );

    if (!hasProgress) {
      void clearDraft(myidDraftKey);
      return;
    }

    void writeDraft(myidDraftKey, {
      selectedPacienteId,
      showDashboard,
      avaliacao,
      showRelatorio,
      blocosConcluidos: Array.from(blocosConcluidos),
    }, MYID_DRAFT_VERSION);
  }, [avaliacao, blocosConcluidos, draftReady, myidDraftKey, pendingDraft, selectedPacienteId, showDashboard, showDiretrizBuilder, showRelatorio, user]);

  // Abre o dashboard interno do Método Identidade
  const handleSelectPaciente = (pac: typeof pacientes[0]) => {
    setSelectedPacienteId(pac.id);
    setShowDashboard(true);
  };

  // Inicia avaliação a partir do dashboard — com pré-carga de respostas do questionário
  const handleIniciarAvaliacao = (precarga?: { bloco1?: any; bloco2?: any; bloco3?: any; bloco4?: any; bloco5?: any }) => {
    if (!selectedPaciente) return;
    const base = makeDefaultAvaliacao(`${selectedPaciente.nome} ${selectedPaciente.sobrenome}`);

    if (precarga) {
      // Pré-carregar dados do questionário remoto
      if (precarga.bloco1) base.bloco1 = { ...base.bloco1, ...precarga.bloco1 };
      if (precarga.bloco2) base.bloco2 = { ...base.bloco2, ...precarga.bloco2 };
      if (precarga.bloco3) base.bloco3 = { ...base.bloco3, ...precarga.bloco3 };
      if (precarga.bloco4) base.bloco4 = { ...base.bloco4, ...precarga.bloco4 };
      if (precarga.bloco5) base.bloco5 = { ...base.bloco5, ...precarga.bloco5 };
      // Marcar blocos do questionário como concluídos (para edição ou visualização)
      setBlocosConcluidos(new Set([1, 2, 3, 4, 5, 6]));
      base.blocoAtual = 6;
    } else {
      setBlocosConcluidos(new Set());
      base.blocoAtual = 1;
    }

    setAvaliacao(base);
    setShowDashboard(false);
    setShowRelatorio(false);
  };

  // Auto-iniciar avaliação quando vier da Avaliação Presencial com ?iniciar=1
  useEffect(() => {
    if (autoIniciar && selectedPaciente && draftReady && !pendingDraft) {
      handleIniciarAvaliacao();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIniciar, selectedPaciente?.id, draftReady, pendingDraft]);

  const updateData = useCallback((newData: any) => {
    setAvaliacao(prev => ({ ...prev, ...newData }));
  }, []);

  const BLOCK_ORDER = [1, 2, 3, 4, 5, 6];

  const avancarBloco = useCallback(async (blocoAtual: number) => {
    setBlocosConcluidos(prev => new Set([...prev, blocoAtual]));
    const currentIdx = BLOCK_ORDER.indexOf(blocoAtual);
    const nextBlock = BLOCK_ORDER[currentIdx + 1];
    if (nextBlock) {
      setAvaliacao(prev => ({ ...prev, blocoAtual: nextBlock }));
    } else {
      // Last block — finalize MyID
      const calculator = new MyIDCalculator(avaliacao);
      const resultado = calculator.getFullResult();

      const finalAv = { ...avaliacao, resultado, concluido: true };
      setAvaliacao(finalAv);
      
      // Auto-save to patient record and redirect to diretriz builder
      if (selectedPacienteId) {
        try {
          const savedData = await salvarAvaliacao({ avaliacao: finalAv, pacienteId: selectedPacienteId });
          setSavedAvaliacaoId(savedData?.id || null);
          await clearDraft(myidDraftKey);
          toast({ title: '✅ Avaliação salva automaticamente!', description: 'Agora monte a Diretriz de Tratamento.' });
          setShowDiretrizBuilder(true);
        } catch (err) {
          console.error('Erro ao salvar avaliação:', err);
          setShowRelatorio(true);
        }
      } else {
        setShowRelatorio(true);
      }
    }
  }, [avaliacao, selectedPacienteId, salvarAvaliacao, toast]);

  const voltarBloco = useCallback(() => {
    setAvaliacao(prev => {
      const currentIdx = BLOCK_ORDER.indexOf(prev.blocoAtual);
      const prevBlock = BLOCK_ORDER[Math.max(0, currentIdx - 1)];
      return { ...prev, blocoAtual: prevBlock };
    });
  }, []);

  const progresso = (blocosConcluidos.size / 6) * 100;

  // React Hook rules: All hooks must be defined before any early return based on conditions
  const draftDialog = (
    <AlertDialog open={!!pendingDraft}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>📝 Avaliação em andamento</AlertDialogTitle>
          <AlertDialogDescription>
            Você tem uma avaliação MyID não finalizada. Deseja continuar de onde parou ou descartar e começar do zero?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleDiscardDraft}>Descartar</AlertDialogCancel>
          <AlertDialogAction onClick={handleRestoreDraft}>Continuar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  if (!draftReady && user) {
    return (
      <AppLayout>
        {draftDialog}
        <div className="container py-10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (showDiretrizBuilder && selectedPacienteId && savedAvaliacaoId) {
    // Build a compatible avaliacao object for ProtocoloEditor
    const editorAvaliacao = {
      id: savedAvaliacaoId,
      paciente_id: selectedPacienteId,
      created_at: new Date().toISOString(),
      score_e: avaliacao.resultado?.componentScores?.E || 0,
      score_p: avaliacao.resultado?.componentScores?.P || 0,
      score_c: avaliacao.resultado?.componentScores?.C || 0,
      score_f: 0,
      score_d: avaliacao.resultado?.componentScores?.D || 0,
      score_r: avaliacao.resultado?.componentScores?.R || 0,
      score_efi: avaliacao.resultado?.componentScores?.EFI || 0,
      dor_identidade: avaliacao.resultado?.myidScore || 0,
      status: 'concluida',
    };

    return (
      <AppLayout>
        {draftDialog}
        <div className="container py-8">
          <ProtocoloEditor
            avaliacao={editorAvaliacao}
            pacienteNome={avaliacao.pacienteNome}
            onSave={() => {
              toast({ title: '✅ Diretriz salva!', description: 'Diretriz disponível em Diretrizes e Tratamentos e no prontuário do paciente.' });
              setShowDiretrizBuilder(false);
              setShowDashboard(true);
            }}
            onCancel={() => {
              setShowDiretrizBuilder(false);
              setShowRelatorio(true);
            }}
          />
        </div>
      </AppLayout>
    );
  }

  if (showRelatorio) {
    return (
      <AppLayout>
        {draftDialog}
        <RelatorioIdentidade avaliacao={avaliacao} pacienteId={selectedPacienteId || undefined} onBack={() => {
          setShowRelatorio(false);
          if (showDashboard || selectedPacienteId) setShowDashboard(true);
        }} />
      </AppLayout>
    );
  }

  // Dashboard do paciente selecionado
  if (selectedPacienteId && showDashboard && selectedPaciente) {
    const handleEditarAvaliacao = (av: AvaliacaoMyID) => {
      // Load saved assessment back into form for editing
      setAvaliacao({ ...av, blocoAtual: 1, concluido: false });
      setBlocosConcluidos(new Set());
      setShowDashboard(false);
      setShowRelatorio(false);
    };

    return (
      <AppLayout>
        {draftDialog}
        <div className="container py-6 max-w-4xl">
          <PacienteDashboardIdentidade
            paciente={selectedPaciente}
            onBack={() => { setSelectedPacienteId(null); setShowDashboard(false); }}
            onIniciarAvaliacao={handleIniciarAvaliacao}
            onVerRelatorio={(av) => { setAvaliacao(av); setShowRelatorio(true); }}
            onEditarAvaliacao={handleEditarAvaliacao}
          />
        </div>
      </AppLayout>
    );
  }

  // Tela de seleção de paciente
  if (!selectedPacienteId) {
    return (
      <AppLayout>
        {draftDialog}
        <div className="container py-6 max-w-4xl">
          {/* Module Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-identidade flex items-center justify-center shadow-lg">
              <Activity className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground">MyID</h1>
              <p className="text-muted-foreground text-sm">A impressão digital da sua saúde</p>
            </div>
          </div>

          {/* Quick Stats — compact */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { icon: Users, label: 'Pacientes', value: pacientes.length },
              { icon: CalendarDays, label: 'Hoje', value: agendamentosHoje.length },
              { icon: Activity, label: 'MyID', value: myidAvaliacoesCount },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="border-primary/10">
                  <CardContent className="pt-3 pb-2 text-center">
                    <Icon className="h-4 w-4 mx-auto mb-0.5 text-primary" />
                    <div className="text-xl font-black text-foreground">{stat.value}</div>
                    <div className="text-[9px] text-muted-foreground">{stat.label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Agenda Hoje */}
          {servicosAtivos.identidade && agendamentosHoje.length > 0 && (
            <Card className="mb-6">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-3">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm text-foreground">
                    Agenda Hoje — {format(new Date(), "EEEE, dd/MM", { locale: ptBR })}
                  </h3>
                </div>
                <div className="space-y-2">
                  {agendamentosHoje.map((ag: any) => (
                    <div key={ag.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                      <div className="h-8 w-8 rounded-lg bg-gradient-identidade flex items-center justify-center shrink-0">
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

          {/* Acesso aos pacientes consolidado em /pacientes */}
          <Card>
            <CardContent className="py-10 text-center">
              <Users className="h-10 w-10 mx-auto mb-3 text-primary opacity-70" />
              <h3 className="font-bold text-base text-foreground mb-1">Acesse seus clientes</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">
                A gestão e seleção de pacientes está centralizada no serviço <strong>Clientes</strong>. Abra o perfil do cliente e inicie a avaliação MyID por lá.
              </p>
              <Button
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
                onClick={() => navigateTo('/pacientes')}
              >
                <Users className="h-4 w-4" />
                Ir para Clientes
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Assessment screen
  return (
    <AppLayout>
      {draftDialog}
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-identidade flex items-center justify-center">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">MyID</h1>
              <p className="text-muted-foreground text-sm">A impressão digital da sua saúde | {avaliacao.dataAvaliacao}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => setSelectedPacienteId(null)}>
              <Users className="h-3.5 w-3.5 mr-1" /> Trocar paciente
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progresso da avaliação</span>
                <span className="font-medium text-primary">{blocosConcluidos.size}/6 blocos</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Paciente</div>
              <div className="font-semibold">{avaliacao.pacienteNome}</div>
            </div>
          </div>
        </div>

        {/* Ações compactas: link remoto, portal, relatório parcial */}
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedPacienteId && (() => {
            const linkAtivo = getLinkAtivo(selectedPacienteId);
            if (linkAtivo) {
              return selectedPaciente?.telefone ? (
                <Button size="sm" className="text-xs gap-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => shareAvaliacaoLink(`${selectedPaciente.nome} ${selectedPaciente.sobrenome}`, selectedPaciente.telefone!, getLinkUrl(linkAtivo.token))}>
                  <Smartphone className="h-3 w-3" /> Enviar avaliação via WhatsApp
                </Button>
              ) : (
                <Button size="sm" variant="outline" className="text-xs gap-1 h-8" onClick={() => copiarLink(linkAtivo.token)}>
                  <Copy className="h-3 w-3" /> Copiar link da avaliação
                </Button>
              );
            }
            return (
              <Button size="sm" variant="outline" className="text-xs gap-1 h-8" onClick={async () => {
                const novo = await gerarLink(selectedPacienteId);
                if (novo) copiarLink(novo.token);
              }} disabled={gerando}>
                {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                Gerar link 30 dias
              </Button>
            );
          })()}

          {selectedPaciente?.portal_token && (
            selectedPaciente.telefone ? (
              <Button size="sm" className="text-xs gap-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => { const url = getPortalUrl(selectedPaciente.portal_token!); const msg = `Olá ${selectedPaciente.nome}! 🩺\n\nAcesse seu Portal do Paciente:\n${url}`; window.open(`https://wa.me/${selectedPaciente.telefone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank'); }}>
                <Smartphone className="h-3 w-3" /> Portal via WhatsApp
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="text-xs gap-1 h-8" onClick={() => { navigator.clipboard.writeText(getPortalUrl(selectedPaciente.portal_token!)); toast({ title: 'Link do Portal copiado! 🔗' }); }}>
                <Copy className="h-3 w-3" /> Copiar link do Portal
              </Button>
            )
          )}

          {blocosConcluidos.size > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1 h-8 ml-auto"
              onClick={() => {
                const calculator = new MyIDCalculator(avaliacao);
                const resultado = calculator.getFullResult();
                setAvaliacao(prev => ({ ...prev, resultado }));
                setShowRelatorio(true);
              }}
            >
              Ver Relatório Parcial
            </Button>
          )}
        </div>

        {/* Fluxo MyID em 4 fases — unificado com link público */}
        <MyIDPhasedFlow
          initialData={avaliacao}
          faseConcluida={
            blocosConcluidos.has(6) ? 4 :
            blocosConcluidos.has(5) ? 3 :
            (blocosConcluidos.has(3) && blocosConcluidos.has(4)) ? 2 :
            (blocosConcluidos.has(1) && blocosConcluidos.has(2)) ? 1 : 0
          }
          pacienteNome={avaliacao.pacienteNome}
          onDataChange={(d) => setAvaliacao(prev => ({ ...prev, ...d } as any))}
          onPhaseSave={async (fase) => {
            const blocosFase: Record<number, number[]> = { 1: [1, 2], 2: [3, 4], 3: [5], 4: [6] };
            setBlocosConcluidos(prev => new Set([...prev, ...blocosFase[fase]]));
            return true;
          }}
          onComplete={async () => {
            setBlocosConcluidos(new Set([1, 2, 3, 4, 5, 6]));
            const calculator = new MyIDCalculator(avaliacao);
            const resultado = calculator.getFullResult();
            const finalAv = { ...avaliacao, resultado, concluido: true };
            setAvaliacao(finalAv);
            if (selectedPacienteId) {
              try {
                const savedData = await salvarAvaliacao({ avaliacao: finalAv, pacienteId: selectedPacienteId });
                setSavedAvaliacaoId(savedData?.id || null);
                await clearDraft(myidDraftKey);
                toast({ title: '✅ Avaliação salva automaticamente!', description: 'Agora monte a Diretriz de Tratamento.' });
                setShowDiretrizBuilder(true);
              } catch (err) {
                console.error('Erro ao salvar avaliação:', err);
                setShowRelatorio(true);
              }
            } else {
              setShowRelatorio(true);
            }
            return true;
          }}
        />
      </div>
    </AppLayout>
  );
}
