import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import VoiceAssessment from './VoiceAssessment';
import AvaliacaoSecoesEditaveis from './AvaliacaoSecoesEditaveis';

interface Props {
  pacienteId: string;
  patientName: string;
  serviceType?: 'identidade' | 'cobzero' | 'studio';
}

export default function AvaliacaoVozAtual({ pacienteId, patientName, serviceType = 'identidade' }: Props) {
  const { user } = useAuth();

  const { data: latest, isLoading } = useQuery({
    queryKey: ['avaliacao-voz-latest', pacienteId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('id, created_at, resultado, transcricao')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!pacienteId,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="icon-sm animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!latest) return null;

  const mode = (latest as any).resultado?._meta?.mode === 'written' ? 'written' : 'voice';

  const hasResult = !!(latest as any).resultado;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-caption text-muted-foreground">
        <FileText className="icon-xs" />
        <span>
          Última avaliação — {format(new Date(latest.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
        </span>
      </div>
      {hasResult ? (
        <AvaliacaoSecoesEditaveis
          pacienteId={pacienteId}
          avaliacaoId={latest.id}
          resultado={(latest as any).resultado}
          transcricao={(latest as any).transcricao}
        />
      ) : (
        <VoiceAssessment
          key={latest.id}
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          mode={mode as any}
          initialRecord={{ id: latest.id, resultado: (latest as any).resultado, transcricao: latest.transcricao }}
        />
      )}
    </section>
  );
}
