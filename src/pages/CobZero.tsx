import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { AvaliacaoCobZero } from '@/types/cobzero';
import CobEtapaBasica from '@/components/cobzero/CobEtapaBasica';
import CobEtapaAntropometrica from '@/components/cobzero/CobEtapaAntropometrica';
import CobEtapaLenke from '@/components/cobzero/CobEtapaLenke';
import CobEtapaUnidades from '@/components/cobzero/CobEtapaUnidades';
import CobEtapaPrograma from '@/components/cobzero/CobEtapaPrograma';
import RelatorioCobZero from '@/components/cobzero/RelatorioCobZero';
import { CheckCircle2, Circle, AlignCenter, ClipboardList, Ruler, BookOpen, Dumbbell, BarChart3, Users, Search, ChevronRight, Loader2, History, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePacientes } from '@/hooks/usePacientes';
import { useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

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
  const { avaliacoes: avaliacoesSalvas, deletar: deletarAvaliacao } = useAvaliacoesCobZero();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(null);
  const [searchPac, setSearchPac] = useState('');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoCobZero>(defaultAvaliacao);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [etapasConcluidas, setEtapasConcluidas] = useState<Set<number>>(new Set());
  const [expandedAvaliacaoId, setExpandedAvaliacaoId] = useState<string | null>(null);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

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
  const filteredPac = pacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(searchPac.toLowerCase())
  );
  const handleSelectPaciente = (pac: typeof pacientes[0]) => {
    setSelectedPacienteId(pac.id);
    setAvaliacao({ ...defaultAvaliacao, pacienteNome: `${pac.nome} ${pac.sobrenome}` });
    setEtapasConcluidas(new Set());
    setShowRelatorio(false);
  };

  if (showRelatorio) {
    return (
      <AppLayout>
        <RelatorioCobZero avaliacao={avaliacao} pacienteId={selectedPacienteId || undefined} onBack={() => setShowRelatorio(false)} />
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
              <p className="text-muted-foreground text-sm">Selecione o paciente para iniciar o protocolo</p>
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
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border hover:border-blue-300 hover:bg-blue-50/50 transition-all group">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                      {p.nome[0]}{p.sobrenome?.[0] || ''}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                      <p className="text-xs text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                    </div>
                    <Button size="sm" className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1" onClick={() => handleSelectPaciente(p)}>
                      Iniciar <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Histórico COB° ZERO */}
          {avaliacoesSalvas.length > 0 && (
            <div className="clinical-card mt-4">
              <div className="flex items-center gap-3 mb-4">
                <History className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Histórico de Avaliações</h3>
              </div>
              <div className="space-y-2">
                {avaliacoesSalvas.map((av: any) => (
                  <div key={av.id} className="border rounded-xl overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 hover:bg-accent/20 transition-all cursor-pointer"
                      onClick={() => setExpandedAvaliacaoId(expandedAvaliacaoId === av.id ? null : av.id)}
                    >
                      <div className="h-9 w-9 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                        {av.paciente_nome?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{av.paciente_nome}</span>
                          {av.risco_level && (
                            <Badge variant="outline" className="text-[10px] h-4">{av.risco_level}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {av.data_avaliacao} · Cobb: {av.cobb_angle}° · Lenke {av.lenke_type}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deletarAvaliacao(av.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {expandedAvaliacaoId === av.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedAvaliacaoId === av.id && (
                      <div className="px-4 pb-3 border-t bg-muted/30">
                        <div className="grid grid-cols-3 gap-3 pt-3 text-center">
                          {[
                            { label: 'Cobb', value: av.cobb_angle ? `${av.cobb_angle}°` : '–' },
                            { label: 'Risco', value: av.risco_percentage ? `${av.risco_percentage}%` : '–' },
                            { label: 'Score E', value: av.score_e ? av.score_e.toFixed(1) : '–' },
                          ].map(s => (
                            <div key={s.label} className="bg-background rounded-lg p-2">
                              <div className="text-xs text-muted-foreground">{s.label}</div>
                              <div className="font-bold text-sm text-foreground">{s.value}</div>
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white text-xs"
                          onClick={() => {
                            const pac = pacientes.find(p => p.id === av.paciente_id);
                            if (pac) {
                              setSelectedPacienteId(pac.id);
                              setAvaliacao(av.dados_avaliacao as AvaliacaoCobZero);
                              setShowRelatorio(true);
                            }
                          }}
                        >
                          Ver relatório completo
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
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
