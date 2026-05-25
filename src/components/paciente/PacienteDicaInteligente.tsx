import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Mostra a última dica inteligente enviada para o paciente
 * (baseada no Driver Primário do MyID).
 */
export default function PacienteDicaInteligente() {
  const { user } = useAuth();

  const { data: dica } = useQuery({
    queryKey: ['paciente-dica-inteligente', user?.id],
    queryFn: async () => {
      // pega paciente do user
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!pac) return null;

      const { data } = await supabase
        .from('notificacao_envios')
        .select('id, mensagem, driver, enviado_em')
        .eq('paciente_id', pac.id)
        .order('enviado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 60_000,
  });

  if (!dica) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/0 p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <Sparkles className="icon-sm text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">
            Dica para você
          </p>
          <p className="text-sm leading-relaxed">{dica.mensagem}</p>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {formatDistanceToNow(new Date(dica.enviado_em), { addSuffix: true, locale: ptBR })}
          </p>
        </div>
      </div>
    </div>
  );
}
