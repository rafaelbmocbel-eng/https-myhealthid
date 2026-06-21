import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Loader2, ShieldAlert, CheckCircle2, Search } from 'lucide-react';

interface BackfillResult {
  ok: boolean;
  dryRun: boolean;
  total_checadas: number;
  total_alteradas: number;
  amostras: Array<{ tabela: string; id: string; oldScore?: number; newScore?: number }>;
}

export default function BackfillMyIdEfi() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<BackfillResult | null>(null);
  const [applied, setApplied] = useState<BackfillResult | null>(null);

  const invocar = async (dryRun: boolean) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<BackfillResult>('backfill-myid-efi', {
        body: { dryRun },
      });
      if (error) throw error;
      if (dryRun) {
        setPreview(data || null);
        setApplied(null);
      } else {
        setApplied(data || null);
        setPreview(null);
        toast({ title: 'Correção aplicada! ✅', description: `${data?.total_alteradas ?? 0} registro(s) corrigido(s).` });
      }
    } catch (e: any) {
      toast({ title: 'Erro ao executar correção', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="clinical-card">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="icon-sm text-amber-600" />
        <h2 className="h-section">Correção de avaliações antigas (bug de EFI)</h2>
      </div>
      <p className="text-caption mb-3">
        Avaliações MyID concluídas antes da correção do dia de hoje podem ter o score, a classificação
        e o driver primário calculados com a dimensão Funcionalidade (EFI) invertida. Esta ferramenta
        recalcula os dados já salvos das suas avaliações, sem precisar refazer nenhum questionário.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="rounded-xl gap-2" onClick={() => invocar(true)} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Verificar (simulação, não altera nada)
        </Button>

        {preview && preview.total_alteradas > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="rounded-xl gap-2" disabled={loading}>
                Aplicar correção definitiva
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Aplicar correção em {preview.total_alteradas} registro(s)?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai atualizar permanentemente o score MyID-100, a classificação e o driver primário
                  das avaliações afetadas, dos protocolos ativos enriquecidos e do gráfico de evolução dos
                  seus pacientes. Não é possível desfazer automaticamente.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => invocar(false)}>Sim, aplicar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {preview && (
        <div className="mt-3 p-3 rounded-xl bg-muted/30 border text-xs">
          <p className="font-medium mb-1">
            {preview.total_alteradas > 0
              ? `Encontradas ${preview.total_alteradas} de ${preview.total_checadas} avaliação(ões)/registro(s) com o cálculo desatualizado.`
              : `Nenhuma alteração necessária (${preview.total_checadas} registro(s) verificado(s)).`}
          </p>
          {preview.amostras.length > 0 && (
            <ul className="space-y-0.5 text-muted-foreground mt-1">
              {preview.amostras.slice(0, 10).map((a, i) => (
                <li key={i}>
                  {a.tabela} · {a.oldScore !== undefined ? `score ${a.oldScore} → ${a.newScore}` : `driver alterado`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {applied && (
        <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="font-medium text-emerald-900">
            Correção aplicada: {applied.total_alteradas} de {applied.total_checadas} registro(s) atualizado(s).
          </span>
        </div>
      )}
    </div>
  );
}
