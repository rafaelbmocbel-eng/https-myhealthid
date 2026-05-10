import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Ausencia {
  id: string;
  terapeuta_id: string;
  data_inicio: string; // YYYY-MM-DD
  data_fim: string;
  motivo?: string | null;
  dia_inteiro: boolean;
  hora_inicio?: string | null;
  hora_fim?: string | null;
  cor?: string | null;
}

export function useAusencias() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['ausencias', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ausencias_terapeuta' as any)
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('data_inicio', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Ausencia[];
    },
    enabled: !!user,
  });

  const create = useMutation({
    mutationFn: async (a: Omit<Ausencia, 'id' | 'terapeuta_id'>) => {
      const { error } = await supabase
        .from('ausencias_terapeuta' as any)
        .insert({ ...a, terapeuta_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ausencias'] });
      toast({ title: 'Ausência registrada ✅' });
    },
    onError: (e: any) => toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ausencias_terapeuta' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ausencias'] });
      toast({ title: 'Ausência removida' });
    },
  });

  return { ausencias: query.data || [], loading: query.isLoading, create, remove };
}
