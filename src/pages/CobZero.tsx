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
import { CheckCircle2, Circle, AlignCenter, ClipboardList, Ruler, BookOpen, Dumbbell, BarChart3, Users, Search, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { usePacientes } from '@/hooks/usePacientes';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';

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
  const [searchParams] = useSearchParams();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(searchParams.get('paciente'));
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente'));
  const [searchPac, setSearchPac] = useState('');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoCobZero>(defaultAvaliacao);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [etapasConcluidas, setEtapasConcluidas] = useState<Set<number>>(new Set());

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const selectedPaciente = pacientes.find(p => p.id === selectedPacienteId);

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
        <div className="container py-8 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg">
              <AlignCenter className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">COB° ZERO</h1>
              <p className="text-muted-foreground text-sm">Selecione o paciente para ver o dashboard ou iniciar avaliação</p>
            </div>
          </div>
          <div className="clinical-card">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Pacientes — COB° ZERO</h3>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar paciente..." className="pl-9" value={searchPac} onChange={e => setSearchPac(e.target.value)} />
            </div>
            {loadingPacientes ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filteredPac.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">Nenhum paciente com COB° ZERO ativo</p>
                <p className="text-sm mt-1">Cadastre pacientes em <strong>Pacientes</strong> e ative o serviço.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPac.map(p => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border hover:border-primary/30 hover:bg-accent/20 transition-all cursor-pointer" onClick={() => handleSelectPaciente(p)}>
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                      {p.nome[0]}{p.sobrenome?.[0] || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                      <p className="text-xs text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                    </div>
                    <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={() => handleSelectPaciente(p)}>
                      Abrir <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
                      className={`shrink-0 lg:shrink text-left block-step snap-start min-w-[130px] lg:min-w-0 lg:w-full ${
                        isActive ? 'active' : isConcluida ? 'completed' : 'pending'
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
