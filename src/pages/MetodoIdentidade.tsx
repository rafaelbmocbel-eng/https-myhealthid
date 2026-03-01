import { useState, useCallback, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { AvaliacaoMyID, DEFAULT_BLOCO1, DEFAULT_BLOCO2, DEFAULT_BLOCO3, DEFAULT_BLOCO4, DEFAULT_BLOCO5, DEFAULT_BLOCO6, DEFAULT_RED_FLAGS } from '@/types/myid';
import PacienteDashboardIdentidade from '@/components/paciente/PacienteDashboardIdentidade';
import { calcularMyID, calcularScoreI, calcularScoreD_MyID, calcularScoreEFI_MyID, calcularScoreP_MyID, calcularScoreR_MyID, calcularScoreN } from '@/utils/myidCalculations';
import MyIDBloco1 from '@/components/myid/MyIDBloco1';
import MyIDBloco2 from '@/components/myid/MyIDBloco2';
import MyIDBloco3 from '@/components/myid/MyIDBloco3';
import MyIDBloco4 from '@/components/myid/MyIDBloco4';
import MyIDBloco5 from '@/components/myid/MyIDBloco5';
import MyIDBloco6 from '@/components/myid/MyIDBloco6';
import RelatorioIdentidade from '@/components/identidade/RelatorioIdentidade';
import {
  CheckCircle2, Circle, ClipboardList, Activity, Brain,
  Bed, Dumbbell, Users, Link2, Copy, Loader2, Search, ChevronRight, MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePacientes } from '@/hooks/usePacientes';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { differenceInDays } from 'date-fns';
import { shareAvaliacaoLink } from '@/utils/whatsapp';
import { cn } from '@/lib/utils';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAvaliacoesIdentidade } from '@/hooks/useAvaliacoesSalvas';

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
  resultado: { myidScore: 0, myidStatus: '', componentScores: { D:0, EFI:0, P:0, I:0, R:0, C:0, N:0 }, redFlagsDetected: false, redFlagAlerts: [], classificacao: '' },
  blocoAtual: 1,
  concluido: false,
});

export default function MetodoIdentidade() {
  const { user, loading: authLoading } = useAuth();
  const { pacientes, isLoading: loadingPacientes } = usePacientes('metodo_identidade');
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { salvar: salvarAvaliacao } = useAvaliacoesIdentidade();

  const [searchParams] = useSearchParams();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(searchParams.get('paciente'));
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente'));
  const [searchPac, setSearchPac] = useState('');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoMyID>(makeDefaultAvaliacao());
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [blocosConcluidos, setBlocosConcluidos] = useState<Set<number>>(new Set());

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const selectedPaciente = pacientes.find(p => p.id === selectedPacienteId);
  const filteredPac = pacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(searchPac.toLowerCase())
  );

  const getLinkAtivo = (pid: string) =>
    links.find(l => l.paciente_id === pid && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  // Abre o dashboard do paciente
  const handleSelectPaciente = (pac: typeof pacientes[0]) => {
    setSelectedPacienteId(pac.id);
    setShowDashboard(true);
    setShowRelatorio(false);
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

  const updateBloco = useCallback((blocoKey: keyof AvaliacaoMyID, data: any) => {
    setAvaliacao(prev => ({ ...prev, [blocoKey]: data }));
  }, []);

  const BLOCK_ORDER = [1, 2, 3, 4, 5, 6];

  const avancarBloco = useCallback((blocoAtual: number) => {
    setBlocosConcluidos(prev => new Set([...prev, blocoAtual]));
    const currentIdx = BLOCK_ORDER.indexOf(blocoAtual);
    const nextBlock = BLOCK_ORDER[currentIdx + 1];
    if (nextBlock) {
      setAvaliacao(prev => ({ ...prev, blocoAtual: nextBlock }));
    } else {
      const i = calcularScoreI(avaliacao.bloco1);
      const d = calcularScoreD_MyID(avaliacao.bloco2);
      const efi = calcularScoreEFI_MyID(avaliacao.bloco3);
      const p = calcularScoreP_MyID(avaliacao.bloco4);
      const { r, c } = calcularScoreR_MyID(avaliacao.bloco5);
      const n = calcularScoreN(avaliacao.bloco6);
      const resultado = calcularMyID(d, efi, p, i, r, c, n);

      const finalAv = { ...avaliacao, resultado, concluido: true };
      setAvaliacao(finalAv);
      setShowRelatorio(true);
      // Auto-save to patient record
      if (selectedPacienteId) {
        salvarAvaliacao({ avaliacao: finalAv, pacienteId: selectedPacienteId });
      }
    }
  }, [avaliacao, selectedPacienteId, salvarAvaliacao]);

  const voltarBloco = useCallback(() => {
    setAvaliacao(prev => {
      const currentIdx = BLOCK_ORDER.indexOf(prev.blocoAtual);
      const prevBlock = BLOCK_ORDER[Math.max(0, currentIdx - 1)];
      return { ...prev, blocoAtual: prevBlock };
    });
  }, []);

  const progresso = (blocosConcluidos.size / 6) * 100; // still 6 total blocks conceptually

  if (showRelatorio) {
    return (
      <AppLayout>
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
        <div className="container py-8 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-identidade flex items-center justify-center">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Método Identidade</h1>
              <p className="text-muted-foreground text-sm">Selecione o paciente para ver o dashboard ou iniciar avaliação</p>
            </div>
          </div>

          <div className="clinical-card">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Pacientes — Método Identidade</h3>
            </div>
            <div className="relative mb-4">
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
              <div className="space-y-2">
                {filteredPac.map(p => {
                  const linkAtivo = getLinkAtivo(p.id);
                  const diasRestantes = linkAtivo ? differenceInDays(new Date(linkAtivo.data_expiracao), new Date()) : 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 p-3 rounded-xl border hover:border-primary/30 hover:bg-accent/20 transition-all cursor-pointer"
                      onClick={() => handleSelectPaciente(p)}
                    >
                      <div className="h-10 w-10 rounded-full bg-gradient-identidade flex items-center justify-center shrink-0 text-white font-bold text-sm">
                        {p.nome[0]}{p.sobrenome?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                          {linkAtivo && (
                            <Badge variant="outline" className="text-[10px] h-4 bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                              <Link2 className="h-2.5 w-2.5" /> {diasRestantes}d
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 sm:h-8 sm:w-auto sm:px-3"
                          onClick={async () => {
                            if (linkAtivo) copiarLink(linkAtivo.token);
                            else { const novo = await gerarLink(p.id); if (novo) copiarLink(novo.token); }
                          }}
                          disabled={gerando}
                        >
                          {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                          <span className="hidden sm:inline text-xs ml-1">{linkAtivo ? 'Copiar' : 'Link'}</span>
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-gradient-primary text-white gap-1"
                          onClick={() => handleSelectPaciente(p)}
                        >
                          <span className="hidden sm:inline">Abrir</span> <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  // Assessment screen
  return (
    <AppLayout>
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
                        <Button size="sm" variant="outline" className="w-full text-xs gap-1 h-8" onClick={() => copiarLink(linkAtivo.token)}>
                          <Copy className="h-3 w-3" /> Copiar link
                        </Button>
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

              {blocosConcluidos.size > 0 && (
                <Button
                  className="w-full mt-3 bg-gradient-primary text-white text-xs"
                  onClick={() => {
                    const i = calcularScoreI(avaliacao.bloco1);
                    const d = calcularScoreD_MyID(avaliacao.bloco2);
                    const efi = calcularScoreEFI_MyID(avaliacao.bloco3);
                    const p = calcularScoreP_MyID(avaliacao.bloco4);
                    const { r, c } = calcularScoreR_MyID(avaliacao.bloco5);
                    const n = calcularScoreN(avaliacao.bloco6);
                    const resultado = calcularMyID(d, efi, p, i, r, c, n);
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
                <MyIDBloco1 data={avaliacao.bloco1} onChange={(d) => updateBloco('bloco1', d)} onNext={() => avancarBloco(1)} />
              )}
              {avaliacao.blocoAtual === 2 && (
                <MyIDBloco2 data={avaliacao.bloco2} onChange={(d) => updateBloco('bloco2', d)} onNext={() => avancarBloco(2)} onBack={voltarBloco} />
              )}
              {avaliacao.blocoAtual === 3 && (
                <MyIDBloco3 data={avaliacao.bloco3} onChange={(d) => updateBloco('bloco3', d)} onNext={() => avancarBloco(3)} onBack={voltarBloco} />
              )}
              {avaliacao.blocoAtual === 4 && (
                <MyIDBloco4 data={avaliacao.bloco4} onChange={(d) => updateBloco('bloco4', d)} onNext={() => avancarBloco(4)} onBack={voltarBloco} />
              )}
              {avaliacao.blocoAtual === 5 && (
                <MyIDBloco5 data={avaliacao.bloco5} onChange={(d) => updateBloco('bloco5', d)} onNext={() => avancarBloco(5)} onBack={voltarBloco} />
              )}
              {avaliacao.blocoAtual === 6 && (
                <MyIDBloco6 data={avaliacao.bloco6} onChange={(d) => updateBloco('bloco6', d)} onSubmit={() => avancarBloco(6)} onBack={voltarBloco} />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
