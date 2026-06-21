import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Share2, Sparkles, Loader2, Copy, RefreshCw, ChevronDown } from 'lucide-react';
import { getBaseUrl } from '@/utils/linkUrls';
import { format, parseISO } from 'date-fns';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  terapeutaNome: string;
}

export default function AcoesIdentidadeDropdown({ pacienteId, pacienteNome, terapeutaNome }: Props) {
  const { toast } = useToast();
  const [exportando, setExportando] = useState(false);
  const [resumoOpen, setResumoOpen] = useState(false);
  const [resumoLoading, setResumoLoading] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);

  const { data: ultimaMyID } = useQuery({
    queryKey: ['ultima-myid-concluida', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('id, token_acesso, resultado_processado, myid_score_parcial, updated_at')
        .eq('paciente_id', pacienteId)
        .eq('status', 'concluido')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const hasMyID = !!ultimaMyID?.resultado_processado;

  const handleExportarPDF = async () => {
    if (!ultimaMyID?.resultado_processado) {
      toast({
        title: 'Sem MyID concluído',
        description: 'É preciso ter pelo menos um MyID finalizado para exportar a Identidade.',
        variant: 'destructive',
      });
      return;
    }
    setExportando(true);
    try {
      const r: any = ultimaMyID.resultado_processado;
      const { gerarPDFRespostaCompleta } = await import('@/utils/pdfRespostaCompleta');
      await gerarPDFRespostaCompleta({
        pacienteId,
        terapeutaNome,
        avaliacao: {
          pacienteNome,
          dataAvaliacao: format(parseISO(ultimaMyID.updated_at), 'dd/MM/yyyy'),
          resultado: {
            componentScores: r.componentScores || r.scores || {},
            myidScore: ultimaMyID.myid_score_parcial ?? r.myidScore ?? 0,
            classificacao: r.classificacao || r.classification || '—',
            ...r,
          },
        },
      });
      toast({ title: '📄 Identidade exportada!', description: 'PDF baixado com sucesso.' });
    } catch (e: any) {
      console.error(e);
      toast({ title: 'Erro ao exportar', description: e.message, variant: 'destructive' });
    } finally {
      setExportando(false);
    }
  };

  const handleCompartilharLink = async () => {
    if (!ultimaMyID?.token_acesso) {
      toast({
        title: 'Sem MyID concluído',
        description: 'Gere/conclua um MyID antes de compartilhar.',
        variant: 'destructive',
      });
      return;
    }
    const url = `${getBaseUrl()}/myid/ver/${ultimaMyID.token_acesso}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: '🔗 Link copiado!',
        description: 'Visualização read-only — qualquer profissional pode abrir sem cadastro.',
      });
    } catch {
      toast({ title: url });
    }
  };

  const gerarResumo = async () => {
    setResumoLoading(true);
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
      setResumoOpen(false);
    } finally {
      setResumoLoading(false);
    }
  };

  const handleAbrirResumo = () => {
    setResumoOpen(true);
    gerarResumo();
  };

  const handleCopiarResumo = async () => {
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={exportando}>
            {exportando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span className="text-xs font-semibold">Identidade</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={handleExportarPDF}
            disabled={!hasMyID}
            title={!hasMyID ? 'Disponível após o primeiro MyID concluído' : 'Exportar PDF da Identidade'}
          >
            <Download className="h-4 w-4 mr-2" /> Exportar PDF
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={handleCompartilharLink}
            disabled={!hasMyID}
            title={!hasMyID ? 'Disponível após o primeiro MyID concluído' : 'Copiar link de visualização do MyID'}
          >
            <Share2 className="h-4 w-4 mr-2" /> Compartilhar MyID
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleAbrirResumo}>
            <Sparkles className="h-4 w-4 mr-2 text-primary" /> Resumo (IA)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={resumoOpen} onOpenChange={setResumoOpen}>
        <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Briefing — {pacienteNome}
            </DialogTitle>
          </DialogHeader>

          {resumoLoading && (
            <div className="flex flex-col items-center gap-2 py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analisando dados clínicos…</p>
            </div>
          )}

          {!resumoLoading && resumo && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border/40 bg-muted/30 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {resumo}
              </div>
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={gerarResumo}>
                  <RefreshCw className="h-4 w-4 mr-1.5" /> Regenerar
                </Button>
                <Button size="sm" variant="outline" onClick={handleCopiarResumo}>
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
