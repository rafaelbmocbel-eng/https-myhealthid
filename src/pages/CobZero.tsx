import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { AvaliacaoCobZero } from '@/types/cobzero';
import CobEtapaBasica from '@/components/cobzero/CobEtapaBasica';
import CobEtapaAntropometrica from '@/components/cobzero/CobEtapaAntropometrica';
import CobEtapaLenke from '@/components/cobzero/CobEtapaLenke';
import CobEtapaUnidades from '@/components/cobzero/CobEtapaUnidades';
import CobEtapaPrograma from '@/components/cobzero/CobEtapaPrograma';
import RelatorioCobZero from '@/components/cobzero/RelatorioCobZero';
import { CheckCircle2, Circle, AlignCenter, ClipboardList, Ruler, BookOpen, Dumbbell, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

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

export default function CobZero() {
  const [avaliacao, setAvaliacao] = useState<AvaliacaoCobZero>(defaultAvaliacao);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [etapasConcluidas, setEtapasConcluidas] = useState<Set<number>>(new Set());

  const updateEtapa = (key: keyof AvaliacaoCobZero, data: any) => {
    setAvaliacao(prev => ({ ...prev, [key]: data }));
  };

  const avancarEtapa = (etapaAtual: number) => {
    setEtapasConcluidas(prev => new Set([...prev, etapaAtual]));
    if (etapaAtual < 5) {
      setAvaliacao(prev => ({ ...prev, etapaAtual: etapaAtual + 1 }));
    } else {
      setAvaliacao(prev => ({ ...prev, concluido: true }));
      setShowRelatorio(true);
    }
  };

  const voltarEtapa = () => {
    setAvaliacao(prev => ({ ...prev, etapaAtual: Math.max(1, prev.etapaAtual - 1) }));
  };

  const progresso = (etapasConcluidas.size / 5) * 100;

  if (showRelatorio) {
    return (
      <AppLayout>
        <RelatorioCobZero avaliacao={avaliacao} onBack={() => setShowRelatorio(false)} />
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="clinical-card sticky top-24">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Etapas de Avaliação</h3>
              <div className="space-y-2">
                {etapas.map(etapa => {
                  const Icon = etapa.icon;
                  const isActive = avaliacao.etapaAtual === etapa.id;
                  const isConcluida = etapasConcluidas.has(etapa.id);
                  return (
                    <button
                      key={etapa.id}
                      onClick={() => setAvaliacao(prev => ({ ...prev, etapaAtual: etapa.id }))}
                      className={`w-full text-left block-step ${
                        isActive ? 'active' : isConcluida ? 'completed' : 'pending'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isConcluida ? (
                          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                        ) : isActive ? (
                          <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate ${isActive ? 'text-primary' : isConcluida ? 'text-success' : 'text-foreground'}`}>
                            {etapa.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{etapa.sublabel} · {etapa.time}</div>
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
