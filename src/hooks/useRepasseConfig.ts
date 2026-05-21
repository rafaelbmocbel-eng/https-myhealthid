import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface RepasseConfig {
  id: string;
  terapeuta_id: string;
  membro_equipe_id: string;
  convenio_id: string | null; // null = particular
  percentual: number;
  valor_fixo: number | null;
  ativo: boolean;
}

export function useRepasseConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['repasse_config', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('repasse_config' as any)
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true);
      if (error) throw error;
      return (data || []) as unknown as RepasseConfig[];
    },
  });

  const setRepasse = useMutation({
    mutationFn: async (payload: {
      membro_equipe_id: string;
      convenio_id: string | null;
      percentual: number;
      valor_fixo?: number | null;
    }) => {
      if (!user) throw new Error('not_authenticated');
      const existing = (query.data || []).find(
        (r) => r.membro_equipe_id === payload.membro_equipe_id && r.convenio_id === payload.convenio_id,
      );
      if (existing) {
        const { error } = await supabase
          .from('repasse_config' as any)
          .update({ percentual: payload.percentual, valor_fixo: payload.valor_fixo ?? null })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('repasse_config' as any).insert({
          terapeuta_id: user.id,
          membro_equipe_id: payload.membro_equipe_id,
          convenio_id: payload.convenio_id,
          percentual: payload.percentual,
          valor_fixo: payload.valor_fixo ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repasse_config'] });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  /** Resolve o repasse aplicável: membro × convenio (null = particular). Fallback: registro do membro sem convênio específico. */
  const getRepasse = (membro_equipe_id: string, convenio_id: string | null) => {
    const list = query.data || [];
    return (
      list.find((r) => r.membro_equipe_id === membro_equipe_id && r.convenio_id === convenio_id) ||
      list.find((r) => r.membro_equipe_id === membro_equipe_id && r.convenio_id === null) ||
      null
    );
  };

  return { repasses: query.data || [], loading: query.isLoading, setRepasse, getRepasse };
}
