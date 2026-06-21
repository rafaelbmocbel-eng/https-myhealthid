import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Loader2, Copy, RefreshCw } from 'lucide-react';

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

export default function ResumoRapido30s({ pacienteId, pacienteNome }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);

  const gerarResumo = async () => {
    setLoading(true);
    setResumo(null);
    try {
      const { data, error } = await supabase.functions.invoke('resumo-30s', {
        body: { pacienteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResumo(data.resumo);
    } catch (e: any) {
      toast({
        title: 'Erro ao gerar resumo',
        description: e.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleAbrir = () => {
    setOpen(true);
    gerarResumo();
  };

  const handleCopiar = async () => {
    if (!resumo) return;
    try {
      await navigator.clipboard.writeText(resumo);
      toast({ title: '📋 Resumo copiado!' });
    } catch {
      toast({ title: 'Não foi possível copiar' });
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        onClick={handleAbrir}
      >
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-xs font-semibold">Resumo</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Briefing — {pacienteNome}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center gap-2 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando dados clínicos…</p>
            </div>
          )}

          {!loading && resumo && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/40 bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {resumo}
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={gerarResumo}>
                  <RefreshCw className="h-4 w-4 mr-1.5" /> Regenerar
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopiar}>
                  <Copy className="h-4 w-4 mr-1.5" /> Copiar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground text-center">
                Suporte à decisão — não substitui análise clínica.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
