import { useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { AvaliacaoIdentidade } from '@/types/identidade';
import Bloco1Anamnese from '@/components/identidade/Bloco1Anamnese';
import Bloco2Dor from '@/components/identidade/Bloco2Dor';
import Bloco3Funcionalidade from '@/components/identidade/Bloco3Funcionalidade';
import Bloco4Kinesiophobia from '@/components/identidade/Bloco4Kinesiophobia';
import Bloco5Regulacao from '@/components/identidade/Bloco5Regulacao';
import Bloco6Estrutural from '@/components/identidade/Bloco6Estrutural';
import RelatorioIdentidade from '@/components/identidade/RelatorioIdentidade';
import { calcularIDFinal } from '@/utils/calculations';
import { CheckCircle2, Circle, ChevronRight, ClipboardList, HeartPulse, Activity, Brain, Bed, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

const blocos = [
  { id: 1, label: 'Anamnese & Contexto', sublabel: 'Score F', icon: ClipboardList, time: '8 min' },
  { id: 2, label: 'Avaliação da Dor', sublabel: 'Score D', icon: HeartPulse, time: '12 min' },
  { id: 3, label: 'Funcionalidade', sublabel: 'Score EFI', icon: Activity, time: '4 min' },
  { id: 4, label: 'Kinesiophobia', sublabel: 'Score P (TSK-11)', icon: Brain, time: '6 min' },
  { id: 5, label: 'Regulação Neurovegetativa', sublabel: 'Scores R e C', icon: Bed, time: '10 min' },
  { id: 6, label: 'Avaliação Estrutural', sublabel: 'Score E (8 UCs)', icon: Dumbbell, time: '15 min' },
];

const defaultAvaliacao: AvaliacaoIdentidade = {
  pacienteNome: 'João Silva',
  pacienteIdade: 35,
  terapeutaNome: 'Dr. Paulo Alves',
  dataAvaliacao: new Date().toLocaleDateString('pt-BR'),
  bloco1: {
    queixaPrincipal: '', duracao: '', eventoPrecipitante: false, eventoPrecipitanteDescricao: '',
    historicoMedico: [], historicoFamiliar: false, historicoFamiliarDescricao: '',
    metasTerapeuticas: ['', '', ''], profissao: '', horasSedentario: 8, atividadeFisica: 'leve',
    qualidadeSono: 5, tabagismo: false, alcool: 'nenhum', litrosAgua: 2,
    impactoQualidadeVida: 5, interferenciaTrbalho: 5, quantidadeComorbidades: 2, historicoFamiliarPeso: 3,
    scoreF: 0,
  },
  bloco2: { regioes: [], scoreD: 0 },
  bloco3: { trabalho: 5, domesticas: 5, exercicio: 5, independencia: 5, vidaSocial: 5, scoreEFI: 5 },
  bloco4: { respostas: Array(11).fill(2), scoreP: 0 },
  bloco5: {
    qualidadeSono: 5, horasSono: 7, acordaNaNoite: 3, dorAfetaSono: 3, descansadoAoAcordar: 6,
    scoreR1: 0, energiaAoAcordar: 6, fadigaDia: 4, precisaCochiblar: 2, motivacao: 6, resistenciaFisica: 6,
    scoreR2: 0, nivelStress: 5, humorGeral: 6, concentracao: 6, preocupacaoSaude: 4, sensacaoControle: 6,
    scoreR3: 0, cargaLaboral: 5, relacionamentos: 4, situacaoFinanceira: 4, eventosEstressantes: 3,
    scoreC: 0, scoreR: 0,
  },
  bloco6: { unidades: [], scoreE: 0 },
  idFinal: 0,
  classificacao: '',
  blocoAtual: 1,
  concluido: false,
};

export default function MetodoIdentidade() {
  const [avaliacao, setAvaliacao] = useState<AvaliacaoIdentidade>(defaultAvaliacao);
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [blocosConcluidos, setBlocosConcluidos] = useState<Set<number>>(new Set());

  const updateBloco = useCallback((blocoKey: keyof AvaliacaoIdentidade, data: any) => {
    setAvaliacao(prev => ({ ...prev, [blocoKey]: data }));
  }, []);

  const avancarBloco = useCallback((blocoAtual: number) => {
    setBlocosConcluidos(prev => new Set([...prev, blocoAtual]));
    if (blocoAtual < 6) {
      setAvaliacao(prev => ({ ...prev, blocoAtual: blocoAtual + 1 }));
    } else {
      // Calcular ID final
      const { idFinal, classificacao } = calcularIDFinal(
        avaliacao.bloco6.scoreE,
        avaliacao.bloco4.scoreP,
        avaliacao.bloco5.scoreC,
        avaliacao.bloco1.scoreF,
        avaliacao.bloco2.scoreD,
        avaliacao.bloco5.scoreR,
      );
      setAvaliacao(prev => ({ ...prev, idFinal, classificacao, concluido: true }));
      setShowRelatorio(true);
    }
  }, [avaliacao]);

  const voltarBloco = useCallback(() => {
    setAvaliacao(prev => ({ ...prev, blocoAtual: Math.max(1, prev.blocoAtual - 1) }));
  }, []);

  const progresso = (blocosConcluidos.size / 6) * 100;

  if (showRelatorio) {
    return (
      <AppLayout>
        <RelatorioIdentidade avaliacao={avaliacao} onBack={() => setShowRelatorio(false)} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Método Identidade</h1>
              <p className="text-muted-foreground text-sm">Avaliação Integrada da Disfunção | {avaliacao.dataAvaliacao}</p>
            </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar de blocos */}
          <div className="lg:col-span-1">
            <div className="clinical-card sticky top-24">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Blocos de Avaliação</h3>
              <div className="space-y-2">
                {blocos.map(bloco => {
                  const Icon = bloco.icon;
                  const isActive = avaliacao.blocoAtual === bloco.id;
                  const isConcluido = blocosConcluidos.has(bloco.id);
                  return (
                    <button
                      key={bloco.id}
                      onClick={() => setAvaliacao(prev => ({ ...prev, blocoAtual: bloco.id }))}
                      className={`w-full text-left block-step ${
                        isActive ? 'active' : isConcluido ? 'completed' : 'pending'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {isConcluido ? (
                          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                        ) : isActive ? (
                          <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className={`text-sm font-medium truncate ${isActive ? 'text-primary' : isConcluido ? 'text-success' : 'text-foreground'}`}>
                            {bloco.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{bloco.sublabel} · {bloco.time}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {blocosConcluidos.size > 0 && (
                <Button
                  className="w-full mt-4 bg-gradient-primary text-white"
                  onClick={() => {
                    const { idFinal, classificacao } = calcularIDFinal(
                      avaliacao.bloco6.scoreE,
                      avaliacao.bloco4.scoreP,
                      avaliacao.bloco5.scoreC,
                      avaliacao.bloco1.scoreF,
                      avaliacao.bloco2.scoreD,
                      avaliacao.bloco5.scoreR,
                    );
                    setAvaliacao(prev => ({ ...prev, idFinal, classificacao }));
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
                <Bloco1Anamnese
                  data={avaliacao.bloco1}
                  onChange={(d) => updateBloco('bloco1', d)}
                  onNext={() => avancarBloco(1)}
                />
              )}
              {avaliacao.blocoAtual === 2 && (
                <Bloco2Dor
                  data={avaliacao.bloco2}
                  onChange={(d) => updateBloco('bloco2', d)}
                  onNext={() => avancarBloco(2)}
                  onBack={voltarBloco}
                />
              )}
              {avaliacao.blocoAtual === 3 && (
                <Bloco3Funcionalidade
                  data={avaliacao.bloco3}
                  onChange={(d) => updateBloco('bloco3', d)}
                  onNext={() => avancarBloco(3)}
                  onBack={voltarBloco}
                />
              )}
              {avaliacao.blocoAtual === 4 && (
                <Bloco4Kinesiophobia
                  data={avaliacao.bloco4}
                  onChange={(d) => updateBloco('bloco4', d)}
                  onNext={() => avancarBloco(4)}
                  onBack={voltarBloco}
                />
              )}
              {avaliacao.blocoAtual === 5 && (
                <Bloco5Regulacao
                  data={avaliacao.bloco5}
                  onChange={(d) => updateBloco('bloco5', d)}
                  onNext={() => avancarBloco(5)}
                  onBack={voltarBloco}
                />
              )}
              {avaliacao.blocoAtual === 6 && (
                <Bloco6Estrutural
                  data={avaliacao.bloco6}
                  onChange={(d) => updateBloco('bloco6', d)}
                  onNext={() => avancarBloco(6)}
                  onBack={voltarBloco}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
