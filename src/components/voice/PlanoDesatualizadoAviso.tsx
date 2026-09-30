import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { atualizarPlanoComEdicoes, planoDesatualizado } from '@/utils/voiceAssessment/atualizarPlanoComEdicoes';
import { invalidarCachesAvaliacaoVoz } from '@/utils/voiceAssessment/reprocessarComplemento';

// Aparece onde o plano em fases é exibido quando o profissional editou a
// avaliação (quadro clínico, condutas...) e o plano ainda não foi refeito.
export default function PlanoDesatualizadoAviso({ avaliacaoId, pacienteId, resultado, ocupado }: {
  avaliacaoId?: string | null;
  pacienteId: string;
  resultado: any;
  // Uma atualização já em andamento em outro ponto da tela.
  ocupado?: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rodando, setRodando] = useState(false);

  if (!avaliacaoId || !user || !planoDesatualizado(resultado)) return null;
  const carregando = rodando || !!ocupado;

  const atualizar = async () => {
    setRodando(true);
    try {
      await atualizarPlanoComEdicoes({ avaliacaoId, terapeutaId: user.id });
      invalidarCachesAvaliacaoVoz(qc, pacienteId);
      qc.invalidateQueries({ queryKey: ['avaliacao-voz-diretriz-protocolo'] });
      qc.invalidateQueries({ queryKey: ['avaliacoes-voz-diretriz-pendente', pacienteId] });
      toast.success('Plano atualizado com as suas edições');
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao atualizar o plano');
    } finally {
      setRodando(false);
    }
  };

  return (
    <div className="rounded-xl border border-amber-300/70 bg-amber-50 dark:bg-amber-900/15 p-3 flex items-start gap-3 flex-wrap">
      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Suas edições ainda não estão neste plano</p>
        <p className="text-xs text-amber-900/80 dark:text-amber-100/80">
          Você editou a avaliação depois que o plano foi gerado. Atualize para incluir as condutas que escreveu.
        </p>
      </div>
      <Button size="sm" onClick={atualizar} disabled={carregando} className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
        {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {carregando ? 'Atualizando...' : 'Atualizar plano'}
      </Button>
    </div>
  );
}
