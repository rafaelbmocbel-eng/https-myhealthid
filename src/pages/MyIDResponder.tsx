import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MyIDPhasedFlow } from '@/components/myid/MyIDPhasedFlow';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';
import { PublicTrackingPixels } from '@/components/tracking/PublicTrackingPixels';

export default function MyIDResponder() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [evalData, setEvalData] = useState<any>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        toast({ title: 'Erro', description: 'Token inválido.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      try {
        // Try new RPC first (includes phase tracking)
        const { data, error } = await supabase.rpc('get_myid_em_andamento', { p_token: token });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        if (!row) {
          toast({ title: 'Erro', description: 'Avaliação não encontrada.', variant: 'destructive' });
        } else {
          setEvalData(row);
        }
      } catch (e: any) {
        toast({ title: 'Erro', description: 'Erro ao carregar avaliação.', variant: 'destructive' });
      }
      setLoading(false);
    }
    load();
  }, [token, toast]);

  const handlePhaseSave = async (
    fase: number,
    data: any,
    scoreParcial: number,
    dimensoes: string[],
    redFlags: boolean,
  ): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc('salvar_fase_myid', {
        p_token: token!,
        p_fase: fase,
        p_respostas: data,
        p_score_parcial: scoreParcial,
        p_dimensoes: dimensoes,
        p_red_flags: redFlags,
      });
      if (error) throw error;
      toast({ title: `✓ Fase ${fase} salva`, description: 'Seu progresso está seguro.' });
      return true;
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const handleComplete = async (data: any, fullResult: any): Promise<boolean> => {
    try {
      // Save phase 4 first
      const dims = ['D', 'I', 'EFI', 'P', 'R', 'C', 'N'];
      await supabase.rpc('salvar_fase_myid', {
        p_token: token!,
        p_fase: 4,
        p_respostas: data,
        p_score_parcial: fullResult.MyID,
        p_dimensoes: dims,
        p_red_flags: !!fullResult.red_flags_detected,
      });

      // Then call existing complete-myid edge fn for AI analysis + sync
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/complete-myid`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            avaliacao_id: evalData.id,
            result: fullResult,
            raw_data: data,
          }),
        },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Erro ao processar');
      }
      toast({ title: '🎉 MyID enviado!', description: 'Seu profissional já recebeu o resultado.' });
      return true;
    } catch (e: any) {
      toast({
        title: 'Erro ao finalizar',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
      return false;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Carregando…</p>
        </div>
      </div>
    );
  }

  if (!evalData) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Link inválido</h1>
        <p className="text-muted-foreground">Este link não é válido ou já expirou.</p>
      </div>
    );
  }

  if (evalData.status === 'concluido') {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-3">
          <div className="text-5xl">✅</div>
          <h1 className="text-2xl font-bold">MyID concluído</h1>
          <p className="text-muted-foreground">
            Esta avaliação já foi finalizada e enviada ao profissional.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background overflow-x-clip">
      <PublicTrackingPixels terapeutaId={evalData?.terapeuta_id} />
      <header className="bg-card/80 backdrop-blur border-b border-border/40 sticky top-0 z-10 px-4 py-3 flex items-center justify-center">
        <div className="font-bold text-lg text-primary flex items-center gap-2">
          <span className="bg-primary text-primary-foreground w-8 h-8 rounded-full flex items-center justify-center text-sm">
            ID
          </span>
          MyID
        </div>
      </header>
      <main className="pb-12 pt-2">
        <MyIDPhasedFlow
          initialData={evalData.respostas_brutas || {}}
          faseConcluida={evalData.fase_concluida || 0}
          onPhaseSave={handlePhaseSave}
          onComplete={handleComplete}
        />
      </main>
    </div>
  );
}
