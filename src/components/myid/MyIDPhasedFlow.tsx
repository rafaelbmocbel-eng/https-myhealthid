import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Loader2, Clock, CheckCircle2 } from 'lucide-react';
import { Bloco1 } from './steps/Bloco1';
import { Bloco2 } from './steps/Bloco2';
import { Bloco3 } from './steps/Bloco3';
import { Bloco4 } from './steps/Bloco4';
import { Bloco5 } from './steps/Bloco5';
import { Bloco6 } from './steps/Bloco6';
import { MyIDCalculator, MyIDResponses } from '@/utils/myid/calculator';
import { MyIDFaseTransicao, FASES_INFO } from './MyIDFaseTransicao';
import { useToast } from '@/components/ui/use-toast';

type Fase = 1 | 2 | 3 | 4;
type ScreenMode = 'inicio' | 'fase' | 'transicao' | 'final';

// Phase → list of Bloco indices (1-based)
const FASE_BLOCOS: Record<Fase, number[]> = {
  1: [1, 2],
  2: [3, 4],
  3: [5],
  4: [6],
};

const ALL_DIMENSIONS = ['D', 'I', 'EFI', 'P', 'R', 'C', 'N'] as const;

interface Props {
  initialData?: MyIDResponses;
  initialPhase?: Fase;
  faseConcluida?: number; // 0-4 (last completed phase from server)
  pacienteNome?: string;
  onPhaseSave: (
    fase: Fase,
    data: MyIDResponses,
    scoreParcial: number,
    dimensoes: string[],
    redFlags: boolean,
  ) => Promise<boolean>;
  onComplete: (data: MyIDResponses, fullResult: any) => Promise<boolean>;
  /** Optional: notified on every data update (for parent draft autosave). */
  onDataChange?: (data: MyIDResponses) => void;
}

function dimsForPhase(fase: number): string[] {
  const map: Record<number, string[]> = {
    1: ['D', 'I'],
    2: ['D', 'I', 'EFI', 'P'],
    3: ['D', 'I', 'EFI', 'P', 'R', 'C'],
    4: ['D', 'I', 'EFI', 'P', 'R', 'C', 'N'],
  };
  return map[fase] || [];
}

export function MyIDPhasedFlow({
  initialData,
  initialPhase,
  faseConcluida = 0,
  pacienteNome,
  onPhaseSave,
  onComplete,
  onDataChange,
}: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<MyIDResponses>(initialData || {});
  const [fase, setFase] = useState<Fase>((initialPhase || Math.min(4, (faseConcluida || 0) + 1) || 1) as Fase);
  const [blocoIdxInPhase, setBlocoIdxInPhase] = useState(0);
  const [screen, setScreen] = useState<ScreenMode>(faseConcluida > 0 ? 'fase' : 'inicio');
  const [saving, setSaving] = useState(false);

  // Last partial score for showing on transition
  const [lastScoreParcial, setLastScoreParcial] = useState<number | undefined>();
  const [lastDimensions, setLastDimensions] = useState<string[]>(dimsForPhase(faseConcluida));
  const [lastPartialScores, setLastPartialScores] = useState<Record<string, number> | undefined>();


  const updateData = useCallback((newData: Partial<MyIDResponses>) => {
    setData((prev) => {
      const next = { ...prev, ...newData };
      onDataChange?.(next);
      return next;
    });
  }, [onDataChange]);

  // Scroll to top on screen/phase changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [screen, fase, blocoIdxInPhase]);

  const blocosNaFase = FASE_BLOCOS[fase];
  const totalBlocosNaFase = blocosNaFase.length;
  const blocoNumero = blocosNaFase[blocoIdxInPhase];

  // ── Timer estimado por fase ──
  const parseMinutes = (s: string) => {
    const m = s.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 3;
  };
  const totalSecondsFase = useMemo(
    () => parseMinutes(FASES_INFO[fase].tempoEstimado) * 60,
    [fase],
  );
  const [secondsLeft, setSecondsLeft] = useState(totalSecondsFase);

  // Reset timer ao entrar/trocar de fase
  useEffect(() => {
    if (screen !== 'fase') return;
    setSecondsLeft(totalSecondsFase);
    const id = setInterval(() => {
      setSecondsLeft((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [fase, screen, totalSecondsFase]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // Progresso da fase atual (0-100)
  const progressoFase = totalBlocosNaFase > 0
    ? ((blocoIdxInPhase + 1) / totalBlocosNaFase) * 100
    : 0;

  // Overall progress: (completed phases + progress in current phase) / 4
  const progressoGeral = useMemo(() => {
    const completed = Math.max(0, fase - 1);
    const inCurrent = totalBlocosNaFase > 0 ? (blocoIdxInPhase + 1) / totalBlocosNaFase : 0;
    return ((completed + inCurrent) / 4) * 100;
  }, [fase, blocoIdxInPhase, totalBlocosNaFase]);


  // Compute partial score for current data up to a given phase
  const computePartialScore = useCallback(
    (currentData: MyIDResponses, atPhase: Fase) => {
      const calc = new MyIDCalculator(currentData);
      // Always run all calculators we have data for; the missing ones return 0
      // This naturally produces a partial losses sum.
      try {
        const myid = calc.calculateMyID();
        const redFlags = calc.detectRedFlags();
        return { score: myid, redFlags, fullResult: { ...calc.result, scores: calc.scores, perdas: calc.perdas } };
      } catch (e) {
        return { score: 0, redFlags: false, fullResult: null };
      }
    },
    [],
  );

  const handleAdvance = async () => {
    // Inside the phase: still has more blocos
    if (blocoIdxInPhase < totalBlocosNaFase - 1) {
      setBlocoIdxInPhase((i) => i + 1);
      return;
    }

    // End of phase → save
    setSaving(true);
    const { score, redFlags } = computePartialScore(data, fase);
    const dims = dimsForPhase(fase);

    try {
      if (fase === 4) {
        // Final phase → run full calculation and call complete-myid
        const calc = new MyIDCalculator(data);
        const myid = calc.calculateMyID();
        calc.interpretStatus();
        calc.determineClinicalPriority?.();
        const fullResult = { ...calc.result, scores: calc.scores, perdas: calc.perdas };

        const ok = await onComplete(data, fullResult);
        if (!ok) {
          setSaving(false);
          return;
        }
        setLastScoreParcial(myid);
        setLastDimensions(dims);
        setScreen('final');
      } else {
        const ok = await onPhaseSave(fase, data, score, dims, redFlags);
        if (!ok) {
          setSaving(false);
          return;
        }
        setLastScoreParcial(score);
        setLastDimensions(dims);
        setScreen('transicao');
      }
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar fase',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleContinuarProximaFase = () => {
    setFase((f) => Math.min(4, f + 1) as Fase);
    setBlocoIdxInPhase(0);
    setScreen('fase');
  };

  const handleSalvarESair = () => {
    toast({
      title: '✓ Progresso salvo',
      description: 'Quando reabrir o link, você continua de onde parou.',
    });
  };

  const handleVoltar = () => {
    if (blocoIdxInPhase > 0) {
      setBlocoIdxInPhase((i) => i - 1);
    }
  };

  // ── RENDER ──
  if (screen === 'inicio') {
    return (
      <MyIDFaseTransicao
        modo="inicio"
        onContinuar={() => setScreen('fase')}
      />
    );
  }

  if (screen === 'transicao') {
    return (
      <MyIDFaseTransicao
        modo="concluida"
        faseConcluida={fase}
        proximaFase={Math.min(4, fase + 1) as Fase}
        scoreParcial={lastScoreParcial}
        dimensoesPreenchidas={lastDimensions}
        onContinuar={handleContinuarProximaFase}
        onSalvarESair={handleSalvarESair}
      />
    );
  }

  if (screen === 'final') {
    return (
      <MyIDFaseTransicao
        modo="final"
        scoreParcial={lastScoreParcial}
        onContinuar={() => {}}
      />
    );
  }

  // screen === 'fase'
  const faseInfo = FASES_INFO[fase];

  return (
    <div className="w-full max-w-3xl mx-auto py-6 px-4 sm:px-6">
      {/* Top progress */}
      <div className="mb-6 space-y-3">
        {/* Pílulas das 4 fases */}
        <div className="grid grid-cols-4 gap-1.5">
          {([1, 2, 3, 4] as Fase[]).map((f) => {
            const done = f < fase;
            const active = f === fase;
            return (
              <div
                key={f}
                className={`h-1.5 rounded-full transition-colors ${
                  done
                    ? 'bg-emerald-500'
                    : active
                    ? 'bg-primary'
                    : 'bg-muted'
                }`}
                aria-label={`Fase ${f}`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Badge variant="outline" className="text-xs shrink-0">
              Fase {fase}/4
            </Badge>
            <span className="text-sm font-semibold text-foreground truncate">
              {faseInfo.titulo}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
            <Clock className="h-3 w-3" />
            <span>
              {secondsLeft > 0
                ? `${formatTime(secondsLeft)} restantes`
                : 'tempo esgotado'}
            </span>
            <span className="opacity-50">· est. {faseInfo.tempoEstimado}</span>
          </div>
        </div>

        {/* Barra DESTA fase */}
        <div className="space-y-1">
          <Progress value={progressoFase} className="h-2" />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">
              Bloco {blocoIdxInPhase + 1} de {totalBlocosNaFase} desta fase
            </p>
            <p className="text-[11px] text-muted-foreground">
              {Math.round(progressoGeral)}% total
            </p>
          </div>
        </div>
      </div>

      <Card className="border-0 shadow-none sm:border sm:shadow-sm">
        <CardContent className="p-0 sm:p-6 lg:p-8">
          {blocoNumero === 1 && <Bloco1 data={data} updateData={updateData} />}
          {blocoNumero === 2 && <Bloco2 data={data} updateData={updateData} />}
          {blocoNumero === 3 && <Bloco3 data={data} updateData={updateData} />}
          {blocoNumero === 4 && <Bloco4 data={data} updateData={updateData} />}
          {blocoNumero === 5 && <Bloco5 data={data} updateData={updateData} />}
          {blocoNumero === 6 && <Bloco6 data={data} updateData={updateData} />}
        </CardContent>
      </Card>

      <div className="flex justify-between items-center mt-6 gap-3">
        <Button
          variant="outline"
          onClick={handleVoltar}
          disabled={blocoIdxInPhase === 0 || saving}
          className="min-w-24"
        >
          Voltar
        </Button>
        <Button onClick={handleAdvance} disabled={saving} className="min-w-32">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando…
            </>
          ) : blocoIdxInPhase < totalBlocosNaFase - 1 ? (
            'Avançar'
          ) : fase === 4 ? (
            'Finalizar MyID'
          ) : (
            `Concluir Fase ${fase}`
          )}
        </Button>
      </div>
    </div>
  );
}
