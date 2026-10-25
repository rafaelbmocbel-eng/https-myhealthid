import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { format } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { COLUNA_ORIGEM, VALOR_SO_PACIENTE, redFlagsDoResultado } from '@/utils/voiceAssessment/origemAvaliacao';

interface Props {
  pacienteId: string;
}

/**
 * Sinais de alerta que o próprio paciente relatou no portal. O relato não substitui a avaliação do profissional e
 * por isso não aparece como "última avaliação"; mas um alerta dele não pode ficar escondido (segurança).
 */
export default function AlertaRelatoDoPaciente({ pacienteId }: Props) {
  const { data } = useQuery({
    queryKey: ['alerta-relato-paciente', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('resultado, created_at')
        .eq('paciente_id', pacienteId)
        .filter(COLUNA_ORIGEM, 'in', VALOR_SO_PACIENTE)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { resultado: unknown; created_at: string } | null;
    },
  });

  const alertas = redFlagsDoResultado(data?.resultado);
  if (!data || alertas.length === 0) return null;

  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[12.5px] leading-snug space-y-1">
      <p className="flex items-center gap-1.5 font-semibold text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        O paciente relatou sinais de alerta no portal
        <span className="font-normal text-destructive/80">
          {' '}({format(new Date(data.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })})
        </span>
      </p>
      <ul className="list-disc pl-5 text-foreground/90">
        {alertas.map((a) => <li key={a}>{a}</li>)}
      </ul>
      <p className="text-[11.5px] text-muted-foreground">
        É o que ele contou, ainda sem confirmação clínica. O relato completo está no histórico de avaliações desta aba.
      </p>
    </div>
  );
}
