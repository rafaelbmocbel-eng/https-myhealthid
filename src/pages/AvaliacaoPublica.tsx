import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, AlertCircle, ClipboardList, MapPin, Activity, Brain, Bed, Stethoscope } from 'lucide-react';
import logoMyHealthId from '@/assets/logo-my-health-id.jpg';
import MyIDBloco1 from '@/components/myid/MyIDBloco1';
import MyIDBloco2 from '@/components/myid/MyIDBloco2';
import MyIDBloco3 from '@/components/myid/MyIDBloco3';
import MyIDBloco4 from '@/components/myid/MyIDBloco4';
import MyIDBloco5 from '@/components/myid/MyIDBloco5';
import MyIDBloco6 from '@/components/myid/MyIDBloco6';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import type {
  MyIDBloco1Data, MyIDBloco2Data, MyIDBloco3Data,
  MyIDBloco4Data, MyIDBloco5Data, MyIDBloco6Data,
} from '@/types/myid';
import {
  DEFAULT_BLOCO1, DEFAULT_BLOCO2, DEFAULT_BLOCO3,
  DEFAULT_BLOCO4, DEFAULT_BLOCO5, DEFAULT_BLOCO6,
} from '@/types/myid';
import {
  calcularScoreI, calcularScoreD_MyID, calcularScoreEFI_MyID,
  calcularScoreP_MyID, calcularScoreR_MyID, calcularScoreN,
  calcularMyID, getMyIDFingerprintData, getMyIDSeverityColor,
} from '@/utils/myidCalculations';

interface LinkInfo {
  id: string;
  paciente_id: string;
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

  const [bloco1, setBloco1] = useState<MyIDBloco1Data>({ ...DEFAULT_BLOCO1 });
  const [bloco2, setBloco2] = useState<MyIDBloco2Data>({ ...DEFAULT_BLOCO2 });
  const [bloco3, setBloco3] = useState<MyIDBloco3Data>({ ...DEFAULT_BLOCO3 });
  const [bloco4, setBloco4] = useState<MyIDBloco4Data>({ ...DEFAULT_BLOCO4 });
  const [bloco5, setBloco5] = useState<MyIDBloco5Data>({ ...DEFAULT_BLOCO5 });
  const [bloco6, setBloco6] = useState<MyIDBloco6Data>({ ...DEFAULT_BLOCO6 });

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
      await supabase.from('respostas_avaliacao_paciente').insert({
        link_id: linkInfo.id,
        paciente_id: linkInfo.paciente_id,
        bloco_numero: blocoNum,
        dados_respostas: dados,
        numero_tentativa: tentativa,
      });
    } catch (e) {
      console.error('Erro ao salvar bloco:', e);
    } finally {
      setSalvando(false);
    }
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
    await salvarBloco(6, bloco6);
    setBlocosConcluidos(prev => new Set([...prev, 6]));
    setConcluido(true);
  };

  // ── Cálculo final para tela de conclusão ──
  const computeMyID = () => {
    const i = calcularScoreI(bloco1);
    const d = calcularScoreD_MyID(bloco2);
    const efi = calcularScoreEFI_MyID(bloco3);
    const p = calcularScoreP_MyID(bloco4);
    const { r, c } = calcularScoreR_MyID(bloco5);
    const n = calcularScoreN(bloco6);
    return calcularMyID(d, efi, p, i, r, c, n);
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
    const fpData = getMyIDFingerprintData(resultado.componentScores);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-6">
        <img src={logoMyHealthId} alt="MyID" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        <div className="text-center max-w-sm">
          <h2 className="text-2xl font-bold text-foreground mb-2">Avaliação MyID Concluída!</h2>
          <p className="text-muted-foreground mb-4">Suas respostas foram salvas com sucesso.</p>
        </div>

        {/* MyID Score */}
        <div className={`px-6 py-4 rounded-xl border-2 ${getMyIDSeverityColor(resultado.classificacao)} text-center`}>
          <div className="text-3xl font-bold">{resultado.myidScore.toFixed(1)}</div>
          <div className="text-sm font-medium mt-1">{resultado.myidStatus}</div>
        </div>

        {/* Fingerprint */}
        <div className="w-full max-w-md">
          <MyIDFingerprint rings={fpData} myidScore={resultado.myidScore} />
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
                  className={`flex-1 flex items-center gap-1 rounded-lg px-1.5 py-1.5 text-[10px] font-medium transition-all ${
                    isActive ? 'bg-primary/10 text-primary border border-primary/20' :
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
        {blocoAtual === 1 && (
          <>
            {/* Welcome message on first block */}
            {!blocosConcluidos.has(1) && (
              <div className="clinical-card mb-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
                <div className="text-center space-y-2">
                  <h2 className="text-lg font-bold">🎯 Bem-vindo ao MyID</h2>
                  <p className="text-sm text-muted-foreground">Sua Identidade Sistêmica Decodificada</p>
                  <p className="text-xs text-muted-foreground">
                    Este questionário leva 5-7 minutos. Não existem respostas "certas" ou "erradas".
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
                    🔒 Seus dados são confidenciais
                  </p>
                </div>
              </div>
            )}
            <MyIDBloco1 data={bloco1} onChange={setBloco1}
              onNext={() => avancarBloco(1, bloco1)} />
          </>
        )}
        {blocoAtual === 2 && (
          <MyIDBloco2 data={bloco2} onChange={setBloco2}
            onNext={() => avancarBloco(2, bloco2)} onBack={voltarBloco} />
        )}
        {blocoAtual === 3 && (
          <MyIDBloco3 data={bloco3} onChange={setBloco3}
            onNext={() => avancarBloco(3, bloco3)} onBack={voltarBloco} />
        )}
        {blocoAtual === 4 && (
          <MyIDBloco4 data={bloco4} onChange={setBloco4}
            onNext={() => avancarBloco(4, bloco4)} onBack={voltarBloco} />
        )}
        {blocoAtual === 5 && (
          <MyIDBloco5 data={bloco5} onChange={setBloco5}
            onNext={() => avancarBloco(5, bloco5)} onBack={voltarBloco} />
        )}
        {blocoAtual === 6 && (
          <MyIDBloco6 data={bloco6} onChange={setBloco6}
            onSubmit={handleFinalizar} onBack={voltarBloco} submitting={salvando} />
        )}
      </div>
    </div>
  );
}
