import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ContatoBloqueado {
  id: string;
  telefone: string;
  nome: string | null;
  motivo: string | null;
  created_at: string;
}

export function useWhatsappBloqueados() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['wa-bloqueados', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_contatos_bloqueados')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ContatoBloqueado[];
    },
    enabled: !!user,
  });

  const adicionar = useMutation({
    mutationFn: async (params: { telefone: string; nome?: string; motivo?: string }) => {
      const tel = params.telefone.replace(/\D/g, '');
      if (!tel) throw new Error('Telefone inválido');
      const { error } = await supabase.from('whatsapp_contatos_bloqueados').insert({
        terapeuta_id: user!.id,
        telefone: tel,
        nome: params.nome || null,
        motivo: params.motivo || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-bloqueados', user?.id] }),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_contatos_bloqueados').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wa-bloqueados', user?.id] }),
  });

  return { ...query, adicionar, remover };
}
