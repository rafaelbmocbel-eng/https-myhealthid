import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getDiretrizSnapshotFromScores, type DiretrizSnapshotPhase } from '@/lib/protocoloSnapshot';

export function useProtocoloFaseAtual(pacienteId: string) {
  const { data: protocolo, isLoading: loadingProtocolo } = useQuery({
    queryKey: ['protocolo-ativo-resumo', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('protocolos')
        .select('id, scores_avaliacao, origem')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      const lista = data || [];
      return lista.find((p: any) => {
        const scores = p.scores_avaliacao || {};
        const snapshot = scores.diretriz_snapshot;
        const origem = String(p.origem || scores.origem || snapshot?.origem || '');
        return !!snapshot?.fases?.length && ['ia_voz', 'ia_escrita', 'avaliacao_voz'].includes(origem);
      }) || null;
    },
    enabled: !!pacienteId,
  });

  const { data: progressao, isLoading: loadingProgressao } = useQuery({
    queryKey: ['protocolo-ativo-progressao', protocolo?.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('protocolo_progressao')
        .select('fase_atual')
        .eq('protocolo_id', protocolo!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!protocolo?.id,
  });

  const isLoading = loadingProtocolo || loadingProgressao;
  const snapshot = protocolo ? getDiretrizSnapshotFromScores((protocolo as any).scores_avaliacao) : null;
  const faseAtual = progressao?.fase_atual || 1;
  const fase: DiretrizSnapshotPhase | null = snapshot
    ? (snapshot.fases.find(f => f.numero === faseAtual) || snapshot.fases[0] || null)
    : null;

  return { protocolo, fase, isLoading };
}
