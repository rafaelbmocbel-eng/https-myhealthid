import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type LinkUtms = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export type LinkRastreavel = {
  id: string;
  terapeuta_id: string;
  label: string;
  url_destino: string;
  url_final: string;
  utms: LinkUtms;
  cliques: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export function useLinksRastreaveis() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links-rastreaveis', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_rastreaveis')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as LinkRastreavel[];
    },
    enabled: !!user?.id,
  });

  const criar = useMutation({
    mutationFn: async (payload: Omit<LinkRastreavel, 'id' | 'terapeuta_id' | 'cliques' | 'ativo' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('links_rastreaveis')
        .insert({ ...payload, terapeuta_id: user!.id, utms: payload.utms as any })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links-rastreaveis', user?.id] });
      toast.success('Link criado');
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao criar link'),
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('links_rastreaveis')
        .update({ ativo })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['links-rastreaveis', user?.id] }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('links_rastreaveis').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['links-rastreaveis', user?.id] });
      toast.success('Link excluído');
    },
  });

  return { links, isLoading, criar, toggleAtivo, excluir };
}
