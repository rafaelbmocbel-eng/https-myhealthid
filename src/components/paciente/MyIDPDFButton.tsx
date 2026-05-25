/**
 * Botão "Baixar / Compartilhar meu PDF MyID" para o paciente.
 *
 * - Carrega o gerador pesado (jsPDF) por dynamic import (lazy).
 * - Busca a última avaliação MyID concluída do paciente autenticado.
 * - Compartilha via Web Share API quando disponível, com fallback para download.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { buildAutoMissoes } from '@/utils/myid/buildAutoMissoes';

const DIM_LABELS: Record<string, string> = {
  D: 'Dor', EFI: 'Funcionalidade', P: 'Psicológico', I: 'Demanda/Inércia',
  R: 'Regulação (Sono)', C: 'Contexto', AF: 'Atividade Física', HID: 'Hidratação',
  NUT: 'Nutrição', ERG: 'Ergonomia', N: 'Ruído/Estresse', MED: 'Medicação',
};

function extractScores(result: any) {
  const s = result?.componentScores || result?.component_scores || {};
  const norm: Record<string, number> = {};
  for (const k of Object.keys(DIM_LABELS)) {
    const v = s[k] ?? s[`${k}_pain`] ?? s[`${k}_functionality`] ?? s[`${k}_psychological`] ??
      s[`${k}_inertia`] ?? s[`${k}_regulation`] ?? s[`${k}_context`] ?? s[`${k}_activity`] ??
      s[`${k}_hydration`] ?? s[`${k}_nutrition`] ?? s[`${k}_ergonomics`] ?? s[`${k}_noise`] ??
      s[`${k}_penalty`];
    if (v !== undefined && v !== null) norm[k] = Number(v);
  }
  return norm;
}

function defaultFases(driver?: string) {
  const dim = driver ? (DIM_LABELS[driver] || driver) : null;
  return [
    {
      titulo: 'Aliviar e organizar',
      descricao: dim
        ? `Reduzir o impacto imediato em ${dim} com ajustes simples na rotina.`
        : 'Reduzir gatilhos do dia a dia e estabelecer uma base estável.',
      foco: ['Sono', 'Hidratação', 'Pausas ativas'],
    },
    {
      titulo: 'Construir capacidade',
      descricao: 'Aumentar gradualmente força, mobilidade e tolerância às atividades do dia.',
      foco: ['Movimento progressivo', 'Respiração', 'Nutrição'],
    },
    {
      titulo: 'Sustentar e prevenir',
      descricao: 'Consolidar os ganhos em hábitos duradouros e prevenir recaídas.',
      foco: ['Rotina', 'Autoconhecimento', 'Reavaliações'],
    },
  ];
}

export default function MyIDPDFButton() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (modo: 'share' | 'download') => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Resolve paciente + profissional
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id, nome, terapeuta_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!pac) throw new Error('Paciente não encontrado.');

      const [{ data: avaliacao }, { data: prof }] = await Promise.all([
        supabase.from('myid_avaliacoes')
          .select('id, updated_at, resultado_processado')
          .eq('paciente_id', pac.id)
          .eq('status', 'concluido')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('profiles')
          .select('nome, sobrenome')
          .eq('user_id', pac.terapeuta_id)
          .maybeSingle(),
      ]);

      if (!avaliacao?.resultado_processado) {
        toast({
          title: 'Sem avaliação MyID',
          description: 'Responda um questionário MyID para gerar seu relatório.',
        });
        setLoading(false);
        return;
      }

      const result = avaliacao.resultado_processado as any;
      const scores = extractScores(result);
      const myidScore = Number(
        result.myidScore ?? result.MyID_score ?? result.myid_100?.score ?? result.myid_100?.pontuacao_final ?? 0,
      );
      const classificacao = String(
        result.classificacao || result.myidStatus || result.myid_100?.classificacao || 'MODERADO',
      );
      const driverRaw = result.myid_100?.driver_primario || result.driverPrimario || null;

      const missoes = (buildAutoMissoes(scores as any, myidScore) || [])
        .slice(0, 6)
        .map((m) => ({
          titulo: m.titulo,
          descricao: m.acao_imediata || m.descricao,
          xp: m.xp_recompensa,
          categoria: m.categoria,
        }));

      // 2. Lazy import the heavy PDF generator
      const { gerarPDFMyIDPaciente, downloadPDFBlob } = await import('@/utils/pdfMyIDPaciente');
      const blob = await gerarPDFMyIDPaciente({
        pacienteNome: pac.nome,
        profissionalNome: prof ? [prof.nome, prof.sobrenome].filter(Boolean).join(' ') : undefined,
        dataAvaliacao: avaliacao.updated_at,
        myidScore,
        classificacao,
        scores: scores as any,
        driverPrimario: driverRaw ? {
          dimensao: driverRaw.dimensao,
          descricao: driverRaw.descricao || driverRaw.message,
        } : null,
        fases: defaultFases(driverRaw?.dimensao),
        missoes,
      });

      const filename = `MyID_${pac.nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;

      // 3. Share or download
      const navAny = navigator as any;
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (modo === 'share' && navAny.canShare && navAny.canShare({ files: [file] })) {
        try {
          await navAny.share({
            files: [file],
            title: 'Meu MyID',
            text: `Meu resultado MyID: ${Math.round(myidScore)}/100 (${classificacao}).`,
          });
        } catch (err: any) {
          if (err?.name !== 'AbortError') downloadPDFBlob(blob, filename);
        }
      } else {
        downloadPDFBlob(blob, filename);
        if (modo === 'share') {
          toast({
            title: 'PDF baixado',
            description: 'Compartilhamento direto indisponível neste dispositivo — envie pelo WhatsApp.',
          });
        }
      }
    } catch (err: any) {
      console.error('[MyIDPDFButton] erro:', err);
      toast({
        title: 'Não foi possível gerar o PDF',
        description: err?.message || 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card shadow-xs p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="h-card mb-0.5">Seu PDF MyID</h3>
          <p className="text-caption text-muted-foreground">
            Um resumo amigável para compartilhar com sua família ou outro profissional.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          onClick={() => handleGenerate('share')}
          disabled={loading}
          className="flex-1"
        >
          {loading ? <Loader2 className="icon-sm animate-spin shrink-0" /> : <Share2 className="icon-sm shrink-0" />}
          Compartilhar
        </Button>
        <Button
          variant="outline"
          onClick={() => handleGenerate('download')}
          disabled={loading}
          className="flex-1"
        >
          {loading ? <Loader2 className="icon-sm animate-spin shrink-0" /> : <FileDown className="icon-sm shrink-0" />}
          Baixar PDF
        </Button>
      </div>
    </div>
  );
}
