import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, AlertCircle, ClipboardList, MapPin, Activity, Brain, Bed, Stethoscope, ArrowLeft, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoMyHealthId from '@/assets/logo-my-health-id.jpg';
import { Bloco1 } from '@/components/myid/steps/Bloco1';
import { Bloco2 } from '@/components/myid/steps/Bloco2';
import { Bloco3 } from '@/components/myid/steps/Bloco3';
import { Bloco4 } from '@/components/myid/steps/Bloco4';
import { Bloco5 } from '@/components/myid/steps/Bloco5';
import { Bloco6 } from '@/components/myid/steps/Bloco6';
import { MyIDCalculator } from '@/utils/myid/calculator';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import type {
  MyIDBloco1Data, MyIDBloco2Data, MyIDBloco3Data,
  MyIDBloco4Data, MyIDBloco5Data, MyIDBloco6Data,
} from '@/types/myid';
import {
  DEFAULT_BLOCO1, DEFAULT_BLOCO2, DEFAULT_BLOCO3,
  DEFAULT_BLOCO4, DEFAULT_BLOCO5, DEFAULT_BLOCO6,
} from '@/types/myid';
import { getMyIDFingerprintData, getMyIDSeverityColor } from '@/utils/myidCalculations';

interface LinkInfo {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  blocos_inclusos: number[];
  data_expiracao: string;
}

const STEPS = [
  { blocoNum: 1, label: 'Identificação', icon: ClipboardList },
  { blocoNum: 2, label: 'Mapeamento Dor', icon: MapPin },
  { blocoNum: 3, label: 'Funcionalidade', icon: Activity },
  { blocoNum: 4, label: 'Comportamento', icon: Brain },
  { blocoNum: 5, label: 'Regulação', icon: Bed },
  { blocoNum: 6, label: 'Ruído Sistêmico', icon: Stethoscope },
];

const BLOCK_ORDER = [1, 2, 3, 4, 5, 6];

export default function AvaliacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [blocoAtual, setBlocoAtual] = useState(1);
  const [blocosConcluidos, setBlocosConcluidos] = useState<Set<number>>(new Set());
  const [concluido, setConcluido] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [data, setData] = useState<any>({
    ...DEFAULT_BLOCO1,
    ...DEFAULT_BLOCO2,
    ...DEFAULT_BLOCO3,
    ...DEFAULT_BLOCO4,
    ...DEFAULT_BLOCO5,
    ...DEFAULT_BLOCO6,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [blocoAtual, concluido]);

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
      // Salva via edge function para não expor a tabela anonimamente
      await supabase.functions.invoke('salvar-bloco-avaliacao', {
        body: {
          link_id: linkInfo.id,
          paciente_id: linkInfo.paciente_id,
          bloco_numero: blocoNum,
          dados_respostas: dados,
        },
      });
    } catch (e) {
      console.error('Erro ao salvar bloco:', e);
    } finally {
      setSalvando(false);
    }
  };

  const updateData = (newData: any) => {
    setData((prev: any) => ({ ...prev, ...newData }));
  };

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

  const handleFinalizar = async () => {
    await salvarBloco(6, data);
    setBlocosConcluidos(prev => new Set([...prev, 6]));
    setConcluido(true);
  };

  // ── Cálculo final para tela de conclusão ──
  const computeMyID = () => {
    const calculator = new MyIDCalculator(data);
    return calculator.getFullResult();
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

  if (concluido) {
    const resultado = computeMyID();
    const fpData = getMyIDFingerprintData(resultado.component_scores);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-6">
        <img src={logoMyHealthId} alt="MyID" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        <div className="text-center max-w-sm">
          <h2 className="text-2xl font-bold text-foreground mb-2">Avaliação MyID Concluída!</h2>
          <p className="text-muted-foreground mb-4">Suas respostas foram salvas com sucesso.</p>
        </div>

        {/* MyID Score */}
        <div className={`px-6 py-4 rounded-xl border-2 ${getMyIDSeverityColor(resultado.status)} text-center`}>
          <div className="text-3xl font-bold">{resultado.MyID_score.toFixed(1)}</div>
          <div className="text-sm font-medium mt-1">{resultado.status}</div>
        </div>

        {/* Fingerprint */}
        <div className="w-full max-w-md">
          <MyIDFingerprint rings={fpData} myidScore={resultado.MyID_score} />
        </div>

        <p className="text-[10px] text-muted-foreground text-center max-w-sm italic">
          *Esta visualização ajuda seu terapeuta a entender a relação entre demanda e capacidade do seu sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <img src={logoMyHealthId} alt="MyID" className="h-10 w-10 rounded-xl object-cover shrink-0" />
            <div className="flex-1">
              <h1 className="font-bold text-sm text-foreground">Questionário MyID</h1>
              <div className="flex items-center gap-3 mt-1">
                <Progress value={progresso} className="h-1.5 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{completedSteps}/{STEPS.length}</span>
              </div>
            </div>
            {salvando && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
          </div>

          <div className="flex gap-1">
            {STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isActive = idx === currentStepIdx;
              const isDone = blocosConcluidos.has(step.blocoNum);
              return (
                <div key={step.blocoNum}
                  className={`flex-1 flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-medium transition-all ${isActive ? 'bg-primary/10 text-primary border border-primary/20' :
                    isDone ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30' :
                      'text-muted-foreground'
                    }`}>
                  {isDone ? <CheckCircle2 className="h-3 w-3 shrink-0" /> : <Icon className="h-3 w-3 shrink-0" />}
                  <span className="hidden sm:inline truncate">{step.label}</span>
                  <span className="sm:hidden">{idx + 1}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {blocoAtual === 1 && <Bloco1 data={data} updateData={updateData} />}
        {blocoAtual === 2 && <Bloco2 data={data} updateData={updateData} />}
        {blocoAtual === 3 && <Bloco3 data={data} updateData={updateData} />}
        {blocoAtual === 4 && <Bloco4 data={data} updateData={updateData} />}
        {blocoAtual === 5 && <Bloco5 data={data} updateData={updateData} />}
        {blocoAtual === 6 && <Bloco6 data={data} updateData={updateData} />}

        {/* Navegação entre Blocos */}
        <div className="flex justify-between items-center mt-10 pt-6 border-t">
          <Button
            variant="outline"
            onClick={voltarBloco}
            className="gap-2"
            disabled={blocoAtual === 1 || salvando}
          >
            <ArrowLeft className="h-4 w-4" /> Anterior
          </Button>

          <Button
            onClick={() => {
              if (blocoAtual === 6) {
                handleFinalizar();
              } else {
                avancarBloco(blocoAtual, data);
              }
            }}
            className="bg-primary text-white gap-2 px-8"
            disabled={salvando}
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : blocoAtual === 6 ? (
              <>Concluir <CheckCircle2 className="h-4 w-4" /></>
            ) : (
              <>Continuar <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
