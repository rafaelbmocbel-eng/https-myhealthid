import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type TrackingConfig = {
  terapeuta_id: string;
  meta_pixel_id: string | null;
  ga4_id: string | null;
  ativos: boolean;
  updated_at: string;
};

export function useTrackingConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['tracking-config', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracking_config')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as TrackingConfig | null;
    },
    enabled: !!user?.id,
  });

  const salvar = useMutation({
    mutationFn: async (payload: { meta_pixel_id: string | null; ga4_id: string | null; ativos: boolean }) => {
      const { error } = await supabase
        .from('tracking_config')
        .upsert(
          { terapeuta_id: user!.id, ...payload, updated_at: new Date().toISOString() },
          { onConflict: 'terapeuta_id' },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tracking-config', user?.id] });
      toast.success('Configuração salva');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  return { config, isLoading, salvar };
}

/** Public fetch by terapeuta_id (uses public SELECT RLS). */
export async function fetchPublicTrackingConfig(terapeutaId: string): Promise<TrackingConfig | null> {
  if (!terapeutaId) return null;
  const { data } = await supabase
    .from('tracking_config')
    .select('*')
    .eq('terapeuta_id', terapeutaId)
    .eq('ativos', true)
    .maybeSingle();
  return (data || null) as TrackingConfig | null;
}
