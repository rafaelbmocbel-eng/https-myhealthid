import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

export interface SinaisVitais {
  id: string;
  terapeuta_id: string;
  paciente_id: string;
  medido_em: string;
  pa_sistolica: number | null;
  pa_diastolica: number | null;
  fc: number | null;
  temperatura: number | null;
  spo2: number | null;
  peso_kg: number | null;
  altura_cm: number | null;
  glicemia: number | null;
  observacoes: string | null;
  created_at: string;
}

export type NovoSinalVital = Omit<
  SinaisVitais,
  'id' | 'terapeuta_id' | 'paciente_id' | 'created_at'
>;

export function useSinaisVitais(pacienteId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ['sinais-vitais', pacienteId],
    enabled: !!pacienteId && !!user?.id,
    queryFn: async (): Promise<SinaisVitais[]> => {
      const { data, error } = await supabase
        .from('sinais_vitais' as any)
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('medido_em', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as SinaisVitais[];
    },
  });

  const criar = useMutation({
    mutationFn: async (novo: NovoSinalVital) => {
      if (!user?.id || !pacienteId) throw new Error('Sem sessão');
      const { error } = await supabase.from('sinais_vitais' as any).insert({
        ...novo,
        terapeuta_id: user.id,
        paciente_id: pacienteId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Sinais vitais registrados' });
      qc.invalidateQueries({ queryKey: ['sinais-vitais', pacienteId] });
    },
    onError: (e: any) =>
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sinais_vitais' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sinais-vitais', pacienteId] }),
  });

  return { list, criar, remover };
}
