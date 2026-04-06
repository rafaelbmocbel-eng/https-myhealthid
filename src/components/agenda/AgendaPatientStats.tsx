import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Package, CheckCircle2 } from 'lucide-react';

interface AgendaPatientStatsProps {
  pacienteId: string;
}

export default function AgendaPatientStats({ pacienteId }: AgendaPatientStatsProps) {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ['agenda-patient-stats', pacienteId],
    queryFn: async () => {
      const [sessoesRes, pacoteRes] = await Promise.all([
        supabase
          .from('controle_sessoes')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', pacienteId)
          .eq('terapeuta_id', user!.id)
          .eq('status', 'realizada'),
        (supabase as any)
          .from('pacotes_sessoes')
          .select('total_sessoes, sessoes_utilizadas, nome')
          .eq('paciente_id', pacienteId)
          .eq('terapeuta_id', user!.id)
          .eq('status', 'ativo')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        totalSessoes: sessoesRes.count ?? 0,
        pacote: pacoteRes.data,
      };
    },
    enabled: !!user && !!pacienteId,
  });

  if (!data) return null;

  const { totalSessoes, pacote } = data;

  return (
    <div className="flex items-center gap-3 pt-1 border-t border-primary/10">
      {/* Total sessions done */}
      <div className="flex items-center gap-1.5 text-[11px]">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        <span className="font-bold text-foreground">{totalSessoes}</span>
        <span className="text-muted-foreground">sessões realizadas</span>
      </div>

      {/* Active package */}
      {pacote && (
        <>
          <span className="text-muted-foreground/40">|</span>
          <div className="flex items-center gap-1.5 text-[11px]">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="font-bold text-foreground">
              {pacote.sessoes_utilizadas}/{pacote.total_sessoes}
            </span>
            <span className="text-muted-foreground">
              ({pacote.total_sessoes - pacote.sessoes_utilizadas} rest.)
            </span>
          </div>
        </>
      )}
    </div>
  );
}
