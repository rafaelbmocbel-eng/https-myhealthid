import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Package } from 'lucide-react';

interface PacoteBadgeProps {
  pacienteId: string;
}

export default function PacoteBadge({ pacienteId }: PacoteBadgeProps) {
  const { user } = useAuth();

  const { data: pacoteAtivo } = useQuery({
    queryKey: ['pacote-badge', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('pacotes_sessoes')
        .select('total_sessoes, sessoes_utilizadas, nome')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user && !!pacienteId,
  });

  if (!pacoteAtivo) return null;

  const restantes = pacoteAtivo.total_sessoes - pacoteAtivo.sessoes_utilizadas;
  const pct = Math.min(100, (pacoteAtivo.sessoes_utilizadas / pacoteAtivo.total_sessoes) * 100);

  return (
    <div className="flex flex-col flex-shrink-0 items-center justify-center gap-1">
      <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground tracking-wider uppercase">Pacote</span>
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border bg-muted/40">
        <Package className="h-3 w-3 text-primary" />
        <span className="text-xs font-bold">
          {pacoteAtivo.sessoes_utilizadas}/{pacoteAtivo.total_sessoes}
        </span>
        <span className="text-[9px] text-muted-foreground">
          {restantes > 0 ? `(${restantes} rest.)` : '✓'}
        </span>
      </div>
    </div>
  );
}
