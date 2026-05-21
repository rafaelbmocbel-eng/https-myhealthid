import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface Convenio {
  id: string;
  terapeuta_id: string;
  nome: string;
  valor_padrao: number | null;
  prazo_repasse_dias: number | null;
  codigo_tuss: string | null;
  ativo: boolean;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export function useConvenios(includeInactive = false) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ['convenios', user?.id, includeInactive],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('convenios' as any).select('*').eq('terapeuta_id', user!.id).order('nome');
      if (!includeInactive) q = q.eq('ativo', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as Convenio[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: Partial<Convenio> & { nome: string }) => {
      if (!user) throw new Error('not_authenticated');
      const row: any = { ...payload, terapeuta_id: user.id };
      const { error } = await supabase.from('convenios' as any).upsert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['convenios'] });
      toast({ title: 'Convênio salvo' });
    },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('convenios' as any).update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['convenios'] });
      toast({ title: 'Convênio arquivado' });
    },
  });

  return { convenios: query.data || [], loading: query.isLoading, upsert, remove };
}
