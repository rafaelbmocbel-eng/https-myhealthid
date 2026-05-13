import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, Share2, Loader2, Fingerprint } from 'lucide-react';
// gerarPDFRespostaCompleta carregado dinamicamente no clique
import { getBaseUrl } from '@/utils/linkUrls';
import { format, parseISO } from 'date-fns';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  terapeutaNome: string;
}

export default function IdentidadePortavelActions({ pacienteId, pacienteNome, terapeutaNome }: Props) {
  const { toast } = useToast();
  const [exportando, setExportando] = useState(false);

  // Última MyID concluída
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

  const hasMyID = !!ultimaMyID?.resultado_processado;

  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <div className="flex items-center gap-1.5 mb-2">
        <Fingerprint className="h-3 w-3 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Identidade portátil
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={handleExportarPDF}
          disabled={exportando || !hasMyID}
        >
          {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          <span className="text-xs font-semibold">Exportar PDF</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5"
          onClick={handleCompartilharLink}
          disabled={!hasMyID}
        >
          <Share2 className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">Compartilhar MyID</span>
        </Button>
      </div>
      {!hasMyID && (
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Disponível após o paciente concluir o primeiro MyID.
        </p>
      )}
    </div>
  );
}
