import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { format } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { COLUNA_ORIGEM, VALOR_SO_PACIENTE, redFlagsDoResultado } from '@/utils/voiceAssessment/origemAvaliacao';

interface Props {
  pacienteId: string;
}

// Quantos relatos recentes entram. Um relato mais novo sem alerta não apaga o alerta de um anterior.
const RELATOS_CONSIDERADOS = 5;

interface Relato {
  resultado: unknown;
  created_at: string;
}

/**
 * Sinais de alerta que o próprio paciente relatou no portal. O relato não substitui a avaliação do profissional e
 * por isso não aparece como "última avaliação"; mas um alerta dele não pode ficar escondido (segurança).
 */
export default function AlertaRelatoDoPaciente({ pacienteId }: Props) {
  const { data, isError } = useQuery({
    queryKey: ['alerta-relato-paciente', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('resultado, created_at')
        .eq('paciente_id', pacienteId)
        .filter(COLUNA_ORIGEM, 'in', VALOR_SO_PACIENTE)
        .order('created_at', { ascending: false })
        .limit(RELATOS_CONSIDERADOS);
      if (error) throw error;
      return (data ?? []) as Relato[];
    },
  });

  if (isError) {
    return (
      <p role="status" className="rounded-xl border border-border/40 bg-muted/30 px-3.5 py-2 text-[12px] text-muted-foreground">
        Não foi possível verificar os alertas do relato do paciente. Recarregue a aba.
      </p>
    );
  }

  // Cada alerta aparece uma vez, com a data do relato mais recente que o trouxe.
  const alertas = new Map<string, string>();
  for (const relato of data ?? []) {
    for (const alerta of redFlagsDoResultado(relato.resultado)) {
      if (!alertas.has(alerta)) alertas.set(alerta, relato.created_at);
    }
  }
  if (alertas.size === 0) return null;

  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-[12.5px] leading-snug space-y-1">
      <p className="flex items-center gap-1.5 font-semibold text-destructive">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        O paciente relatou sinais de alerta no portal
      </p>
      <ul className="list-disc pl-5 text-foreground/90">
        {[...alertas].map(([alerta, quando]) => (
          <li key={alerta}>
            {alerta}
            <span className="text-muted-foreground"> · {format(new Date(quando), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11.5px] text-muted-foreground">
        É o que ele contou, ainda sem confirmação clínica. O relato completo está em Evolução e Prontuário &gt; Histórico de
        avaliações por voz.
      </p>
    </div>
  );
}
