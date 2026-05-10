import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';
import logoMyHealthId from '@/assets/logo-my-health-id.jpg';
import { MyIDPhasedFlow } from '@/components/myid/MyIDPhasedFlow';
import { MyIDCalculator, MyIDResponses } from '@/utils/myid/calculator';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import { getMyIDFingerprintData, getMyIDSeverityColor } from '@/utils/myidCalculations';

interface LinkInfo {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  blocos_inclusos: number[];
  data_expiracao: string;
}

const FASE_BLOCOS: Record<number, number[]> = {
  1: [1, 2],
  2: [3, 4],
  3: [5],
  4: [6],
};

export default function AvaliacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [concluido, setConcluido] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState<any>(null);

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

  const salvarBlocoNoBackend = async (blocoNum: number, dados: any) => {
    if (!linkInfo) return;
    try {
      await supabase.functions.invoke('salvar-bloco-avaliacao', {
        body: {
          link_id: linkInfo.id,
          paciente_id: linkInfo.paciente_id,
          bloco_numero: blocoNum,
          dados_respostas: dados,
        },
      });
    } catch (e) {
      console.warn('Erro salvar bloco', blocoNum, e);
    }
  };

  const handlePhaseSave = async (fase: 1 | 2 | 3 | 4, data: MyIDResponses) => {
    const blocos = FASE_BLOCOS[fase] || [];
    for (const b of blocos) {
      await salvarBlocoNoBackend(b, data);
    }
    return true;
  };

  const handleComplete = async (data: MyIDResponses, _fullResult: any) => {
    // Garantir que a fase final (bloco 6) é persistida
    await salvarBlocoNoBackend(6, data);

    try {
      const calculator = new MyIDCalculator(data);
      const resultado = calculator.getFullResult();
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-myid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            link_avaliacao_id: linkInfo?.id,
            result: resultado,
            raw_data: data,
          }),
        }
      );
      setResultadoFinal(resultado);
    } catch (e) {
      console.warn('Erro ao sincronizar resultado:', e);
    }
    setConcluido(true);
    return true;
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

  if (concluido && resultadoFinal) {
    const fpData = getMyIDFingerprintData(resultadoFinal.component_scores);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-6">
        <img src={logoMyHealthId} alt="MyID" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
        <CheckCircle2 className="h-16 w-16 text-emerald-500" />
        <div className="text-center max-w-sm">
          <h2 className="text-2xl font-bold text-foreground mb-2">Avaliação MyID Concluída!</h2>
          <p className="text-muted-foreground mb-4">Suas respostas foram salvas com sucesso.</p>
        </div>
        <div className={`px-6 py-4 rounded-xl border-2 ${getMyIDSeverityColor(resultadoFinal.status)} text-center`}>
          <div className="text-3xl font-bold">{resultadoFinal.MyID_score.toFixed(1)}</div>
          <div className="text-sm font-medium mt-1">{resultadoFinal.status}</div>
        </div>
        <div className="w-full max-w-2xl">
          <MyIDFingerprint rings={fpData} myidScore={resultadoFinal.MyID_score} />
        </div>
        <p className="text-[10px] text-muted-foreground text-center max-w-sm italic">
          *Esta visualização ajuda seu terapeuta a entender a relação entre demanda e capacidade do seu sistema.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-4 py-3 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <img src={logoMyHealthId} alt="MyID" className="h-9 w-9 rounded-xl object-cover shrink-0" />
          <div>
            <h1 className="font-bold text-sm text-foreground">Questionário MyID</h1>
            <p className="text-xs text-muted-foreground">Avaliação em 4 fases</p>
          </div>
        </div>
      </div>

      <MyIDPhasedFlow
        onPhaseSave={handlePhaseSave}
        onComplete={handleComplete}
      />
    </div>
  );
}
