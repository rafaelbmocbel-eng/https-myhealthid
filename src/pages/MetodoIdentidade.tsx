import { useState, useCallback, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useServicosAtivos } from '@/hooks/useServicosAtivos';
import AppLayout from '@/components/AppLayout';
import { AvaliacaoMyID, DEFAULT_BLOCO1, DEFAULT_BLOCO2, DEFAULT_BLOCO3, DEFAULT_BLOCO4, DEFAULT_BLOCO5, DEFAULT_BLOCO6, DEFAULT_RED_FLAGS } from '@/types/myid';
import PacienteDashboardIdentidade from '@/components/paciente/PacienteDashboardIdentidade';
import { Bloco1 } from '@/components/myid/steps/Bloco1';
import { Bloco2 } from '@/components/myid/steps/Bloco2';
import { Bloco3 } from '@/components/myid/steps/Bloco3';
import { Bloco4 } from '@/components/myid/steps/Bloco4';
import { Bloco5 } from '@/components/myid/steps/Bloco5';
import { Bloco6 } from '@/components/myid/steps/Bloco6';
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
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente'));
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
              <h1 className="text-2xl font-black text-foreground">Método Identidade</h1>
              <p className="text-muted-foreground text-sm">Avaliação Integrada de Disfunções e Saúde</p>
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
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredPac.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">Nenhum paciente com Método Identidade ativo</p>
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
                        className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border hover:border-primary/40 hover:bg-primary-light/10 transition-all cursor-pointer bg-card"
                        onClick={() => handleSelectPaciente(p)}
                      >
                        {/* Paciente Info */}
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-gradient-identidade flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-md">
                            {p.nome[0]}{p.sobrenome?.[0] || ''}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                            <div className="flex justify-between items-center sm:block mt-0.5">
                              <p className="text-xs text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Actions — simplified */}
                        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                          {p.portal_token && p.telefone ? (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-[#25D366]" onClick={() => { const url = getPortalUrl(p.portal_token!); const msg = `Olá ${p.nome}! 🩺\n\nAcesse seu Portal:\n${url}`; window.open(`https://wa.me/${p.telefone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank'); }} title="Enviar Portal via WhatsApp">
                              <Smartphone className="h-3.5 w-3.5" />
                            </Button>
                          ) : p.portal_token ? (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-violet-600" onClick={() => { navigator.clipboard.writeText(getPortalUrl(p.portal_token!)); toast({ title: 'Link do Portal copiado! 🔗' }); }} title="Copiar Link do Portal">
                              <Smartphone className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                          {(() => {
                            const linkAtivo = getLinkAtivo(p.id);
                            return linkAtivo ? (
                              p.telefone ? (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-[#25D366]" onClick={() => shareAvaliacaoLink(`${p.nome} ${p.sobrenome}`, p.telefone!, getLinkUrl(linkAtivo.token))} title="Enviar MyID WhatsApp">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </Button>
                              ) : (
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => copiarLink(linkAtivo.token)} title="Copiar Link MyID">
                                  <Copy className="h-3.5 w-3.5" />
                                </Button>
                              )
                            ) : (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" disabled={gerando} onClick={() => gerarLink(p.id)} title="Gerar Link">
                                {gerando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                              </Button>
                            );
                          })()}
                          <Button
                            size="sm"
                            className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1"
                            onClick={() => handleSelectPaciente(p)}
                          >
                            Abrir <ChevronRight className="h-3 w-3" />
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
              <h1 className="text-2xl font-bold text-foreground">Método Identidade</h1>
              <p className="text-muted-foreground text-sm">Avaliação Integrada da Disfunção | {avaliacao.dataAvaliacao}</p>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Sidebar - horizontal scroll on mobile, vertical on desktop */}
          <div className="lg:col-span-1">
            <div className="clinical-card lg:sticky lg:top-24 !p-3 sm:!p-6">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-3 hidden lg:block">Blocos de Avaliação</h3>
              <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 -mx-1 px-1 snap-x snap-mandatory lg:snap-none">
                {blocos.map(bloco => {
                  const Icon = bloco.icon;
                  const isActive = avaliacao.blocoAtual === bloco.id;
                  const isConcluido = blocosConcluidos.has(bloco.id);
                  return (
                    <button
                      key={bloco.id}
                      onClick={() => setAvaliacao(prev => ({ ...prev, blocoAtual: bloco.id }))}
                      className={`shrink-0 lg:shrink text-left block-step snap-start min-w-[140px] lg:min-w-0 lg:w-full ${isActive ? 'active' : isConcluido ? 'completed' : 'pending'}`}
                    >
                      <div className="flex items-center gap-2 sm:gap-3">
                        {isConcluido ? (
                          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-success flex-shrink-0" />
                        ) : isActive ? (
                          <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                        ) : (
                          <Circle className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className={cn('text-xs sm:text-sm font-medium truncate', isActive ? 'text-primary' : isConcluido ? 'text-success' : 'text-foreground')}>
                            {bloco.label}
                          </div>
                          <div className="text-[10px] sm:text-xs text-muted-foreground hidden lg:block">{bloco.sublabel} · {bloco.time}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Link de avaliação remota */}
              {selectedPacienteId && (() => {
                const linkAtivo = getLinkAtivo(selectedPacienteId);
                return (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avaliação Remota</p>
                    {linkAtivo ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Link ativo · {differenceInDays(new Date(linkAtivo.data_expiracao), new Date())} dias
                        </div>
                        {selectedPaciente?.telefone ? (
                          <Button size="sm" className="w-full text-xs gap-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => shareAvaliacaoLink(`${selectedPaciente.nome} ${selectedPaciente.sobrenome}`, selectedPaciente.telefone!, getLinkUrl(linkAtivo.token))}>
                            <Smartphone className="h-3 w-3" /> Enviar via WhatsApp
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" className="w-full text-xs gap-1 h-8" onClick={() => copiarLink(linkAtivo.token)}>
                            <Copy className="h-3 w-3" /> Copiar link
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs gap-1 h-8"
                        onClick={async () => {
                          const novo = await gerarLink(selectedPacienteId);
                          if (novo) copiarLink(novo.token);
                        }}
                        disabled={gerando}
                      >
                        {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                        Gerar link 30 dias
                      </Button>
                    )}
                  </div>
                );
              })()}

              {/* Link do Portal do Paciente */}
              {selectedPaciente?.portal_token && (
                <div className="mt-4 pt-4 border-t space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Portal do Paciente</p>
                  {selectedPaciente.telefone ? (
                    <Button size="sm" className="w-full text-xs gap-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white" onClick={() => { const url = getPortalUrl(selectedPaciente.portal_token!); const msg = `Olá ${selectedPaciente.nome}! 🩺\n\nAcesse seu Portal do Paciente:\n${url}`; window.open(`https://wa.me/${selectedPaciente.telefone!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank'); }}>
                      <Smartphone className="h-3 w-3" /> Enviar via WhatsApp
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="w-full text-xs gap-1 h-8" onClick={() => { navigator.clipboard.writeText(getPortalUrl(selectedPaciente.portal_token!)); toast({ title: 'Link do Portal copiado! 🔗' }); }}>
                      <Copy className="h-3 w-3" /> Copiar link do Portal
                    </Button>
                  )}
                </div>
              )}

              {blocosConcluidos.size > 0 && (
                <Button
                  className="w-full mt-3 bg-gradient-primary text-white text-xs"
                  onClick={() => {
                    const calculator = new MyIDCalculator(avaliacao);
                    const resultado = calculator.getFullResult();
                    setAvaliacao(prev => ({ ...prev, resultado }));
                    setAvaliacao(prev => ({ ...prev, resultado }));
                    setShowRelatorio(true);
                  }}
                >
                  Ver Relatório Parcial
                </Button>
              )}
            </div>
          </div>

          {/* Conteúdo principal */}
          <div className="lg:col-span-3">
            <div className="animate-slide-in">
              {avaliacao.blocoAtual === 1 && (
                <Bloco1 data={avaliacao} updateData={updateData} />
              )}
              {avaliacao.blocoAtual === 2 && (
                <Bloco2 data={avaliacao} updateData={updateData} />
              )}
              {avaliacao.blocoAtual === 3 && (
                <Bloco3 data={avaliacao} updateData={updateData} />
              )}
              {avaliacao.blocoAtual === 4 && (
                <Bloco4 data={avaliacao} updateData={updateData} />
              )}
              {avaliacao.blocoAtual === 5 && (
                <Bloco5 data={avaliacao} updateData={updateData} />
              )}
              {avaliacao.blocoAtual === 6 && (
                <Bloco6 data={avaliacao} updateData={updateData} />
              )}

            </div>

            {/* Navegação entre Blocos */}
            {(
              <div className="flex justify-between items-center mt-8 bg-card p-4 rounded-xl shadow-sm border">
                <Button
                  variant="outline"
                  onClick={voltarBloco}
                  className="gap-2 h-10 px-6"
                  disabled={avaliacao.blocoAtual === 1}
                >
                  <ArrowLeft className="h-4 w-4" /> Anterior
                </Button>

                <Button
                  onClick={() => avancarBloco(avaliacao.blocoAtual)}
                  className="bg-gradient-primary text-white gap-2 h-10 px-8"
                >
                  {avaliacao.blocoAtual === 6 ? (
                    <>Finalizar Avaliação <CheckCircle2 className="h-4 w-4" /></>
                  ) : (
                    <>Próximo Passo <ArrowRight className="h-4 w-4" /></>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
