import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, AlertCircle, ClipboardList, Activity, Brain, Bed } from 'lucide-react';
import logoMetodo from '@/assets/logo-metodo-identidade.jpg';
import Bloco1Anamnese from '@/components/identidade/Bloco1Anamnese';
import Bloco3Funcionalidade from '@/components/identidade/Bloco3Funcionalidade';
import Bloco4Kinesiophobia from '@/components/identidade/Bloco4Kinesiophobia';
import Bloco5Regulacao from '@/components/identidade/Bloco5Regulacao';
import type { Bloco1Data, Bloco2Data, Bloco3Data, Bloco4Data, Bloco5Data } from '@/types/identidade';

interface LinkInfo {
  id: string;
  paciente_id: string;
  blocos_inclusos: number[];
  data_expiracao: string;
}

const STEPS = [
  { blocoNum: 1, label: 'Anamnese e Mapeamento da Dor', icon: ClipboardList },
  { blocoNum: 3, label: 'Funcionalidade', icon: Activity },
  { blocoNum: 4, label: 'Comportamento', icon: Brain },
  { blocoNum: 5, label: 'Regulação Neurovegetativa', icon: Bed },
];

const defaultBloco1: Bloco1Data = {
  queixaPrincipal: '', duracao: '', eventoPrecipitante: false, eventoPrecipitanteDescricao: '',
  historicoMedico: [], historicoFamiliar: false, historicoFamiliarDescricao: '',
  metasTerapeuticas: ['', '', ''], profissao: '', horasSedentario: 8, atividadeFisica: 'leve',
  qualidadeSono: 5, tabagismo: false, alcool: 'nenhum', litrosAgua: 2,
  impactoQualidadeVida: 5, interferenciaTrbalho: 5, quantidadeComorbidades: 2, historicoFamiliarPeso: 3,
  scoreF: 0,
};
const defaultBloco2: Bloco2Data = { regioes: [], scoreD: 0 };
const defaultBloco3: Bloco3Data = { trabalho: 5, domesticas: 5, exercicio: 5, independencia: 5, vidaSocial: 5, scoreEFI: 5 };
const defaultBloco4: Bloco4Data = { respostas: Array(11).fill(2), scoreP: 0 };
const defaultBloco5: Bloco5Data = {
  qualidadeSono: 5, horasSono: 7, acordaNaNoite: 3, dorAfetaSono: 3, descansadoAoAcordar: 6,
  scoreR1: 0, energiaAoAcordar: 6, fadigaDia: 4, precisaCochiblar: 2, motivacao: 6, resistenciaFisica: 6,
  scoreR2: 0, nivelStress: 5, humorGeral: 6, concentracao: 6, preocupacaoSaude: 4, sensacaoControle: 6,
  scoreR3: 0, cargaLaboral: 5, relacionamentos: 4, situacaoFinanceira: 4, eventosEstressantes: 3,
  scoreC: 0, scoreR: 0,
};

export default function AvaliacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [blocoAtual, setBlocoAtual] = useState(1);
  const [blocosConcluidos, setBlocosConcluidos] = useState<Set<number>>(new Set());
  const [concluido, setConcluido] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [bloco1, setBloco1] = useState<Bloco1Data>(defaultBloco1);
  const [bloco2, setBloco2] = useState<Bloco2Data>(defaultBloco2);
  const [bloco3, setBloco3] = useState<Bloco3Data>(defaultBloco3);
  const [bloco4, setBloco4] = useState<Bloco4Data>(defaultBloco4);
  const [bloco5, setBloco5] = useState<Bloco5Data>(defaultBloco5);

  const currentStepIdx = STEPS.findIndex(s => s.blocoNum === blocoAtual);
  const completedSteps = STEPS.filter(s => blocosConcluidos.has(s.blocoNum)).length;
  const progresso = (completedSteps / STEPS.length) * 100;

  useEffect(() => {
    if (!token) { setErro('Link inválido.'); setLoading(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('validar-token-avaliacao', {
          body: { token },
        });
        if (error || !data || data.error) {
          setErro(data?.error || 'Link não encontrado.');
          setLoading(false);
          return;
        }
        setLinkInfo(data as LinkInfo);
      } catch {
        setErro('Erro ao validar o link. Tente novamente.');
      }
      setLoading(false);
    })();
  }, [token]);

  const salvarBloco = async (blocoNum: number, dados: any) => {
    if (!linkInfo) return;
    setSalvando(true);
    try {
      let tentativa = 1;
      const { data: existente } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('id, numero_tentativa')
        .eq('link_id', linkInfo.id)
        .eq('bloco_numero', blocoNum)
        .order('numero_tentativa', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existente) tentativa = (existente.numero_tentativa || 1) + 1;

      const { error } = await supabase.from('respostas_avaliacao_paciente').insert({
        link_id: linkInfo.id,
        paciente_id: linkInfo.paciente_id,
        bloco_numero: blocoNum,
        dados_respostas: dados,
        numero_tentativa: tentativa,
      });

      if (error) {
        console.error('Erro ao inserir bloco:', error);
      }
    } catch (e) {
      console.error('Erro ao salvar bloco:', e);
    } finally {
      setSalvando(false);
    }
  };

  const BLOCK_ORDER = [1, 3, 4, 5];

  const avancarBloco = async (blocoNum: number, dados: any) => {
    await salvarBloco(blocoNum, dados);
    setBlocosConcluidos(prev => new Set([...prev, blocoNum]));
    const currentIdx = BLOCK_ORDER.indexOf(blocoNum);
    const nextBlock = BLOCK_ORDER[currentIdx + 1];
    if (nextBlock) {
      setBlocoAtual(nextBlock);
    } else {
      setConcluido(true);
    }
  };

  const voltarBloco = () => {
    const currentIdx = BLOCK_ORDER.indexOf(blocoAtual);
    if (currentIdx > 0) setBlocoAtual(BLOCK_ORDER[currentIdx - 1]);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (erro) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
      <XCircle className="h-16 w-16 text-destructive" />
      <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
      <p className="text-muted-foreground text-center max-w-sm">{erro}</p>
    </div>
  );

  if (concluido) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-6">
      <img src={logoMetodo} alt="Logo" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <div className="text-center max-w-sm">
        <h2 className="text-2xl font-bold text-foreground mb-2">Avaliação Concluída!</h2>
        <p className="text-muted-foreground">Suas respostas foram salvas com sucesso. Seu terapeuta já pode visualizá-las.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <img src={logoMetodo} alt="Logo" className="h-10 w-10 rounded-xl object-cover shrink-0" />
            <div className="flex-1">
              <h1 className="font-bold text-sm text-foreground">Questionário Identidade</h1>
              <div className="flex items-center gap-3 mt-1">
                <Progress value={progresso} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{completedSteps}/{STEPS.length} etapas</span>
              </div>
            </div>
            {salvando && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
          </div>

          {/* Step indicator */}
          <div className="flex gap-1">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStepIdx;
              const isDone = blocosConcluidos.has(step.blocoNum);
              return (
                <div
                  key={step.blocoNum}
                  className={`flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-all ${
                    isActive ? 'bg-primary/10 text-primary border border-primary/20' :
                    isDone ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' :
                    'text-muted-foreground'
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : (
                    <Icon className="h-3 w-3 shrink-0" />
                  )}
                  <span className="hidden sm:inline truncate">{step.label}</span>
                  <span className="sm:hidden">{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          Preencha com honestidade. Suas respostas são confidenciais.
        </div>

        {blocoAtual === 1 && (
          <Bloco1Anamnese
            data={bloco1}
            bloco2Data={bloco2}
            onChange={setBloco1}
            onBloco2Change={setBloco2}
            onNext={() => avancarBloco(1, { ...bloco1, regioes: bloco2.regioes, scoreD: bloco2.scoreD })}
          />
        )}
        {blocoAtual === 3 && (
          <Bloco3Funcionalidade
            data={bloco3}
            onChange={setBloco3}
            onNext={() => avancarBloco(3, bloco3)}
            onBack={voltarBloco}
          />
        )}
        {blocoAtual === 4 && (
          <Bloco4Kinesiophobia
            data={bloco4}
            onChange={setBloco4}
            onNext={() => avancarBloco(4, bloco4)}
            onBack={voltarBloco}
          />
        )}
        {blocoAtual === 5 && (
          <Bloco5Regulacao
            data={bloco5}
            onChange={setBloco5}
            onNext={() => avancarBloco(5, bloco5)}
            onBack={voltarBloco}
          />
        )}
      </div>
    </div>
  );
}
