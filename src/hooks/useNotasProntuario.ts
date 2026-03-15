import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface NotaProntuario {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  dados_extras: any;
  referencia_id: string | null;
  created_at: string;
}

export function useNotasProntuario(pacienteId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ['notas-prontuario', user?.id, pacienteId],
    queryFn: async () => {
      if (!pacienteId) return [];
      const { data, error } = await (supabase as any)
        .from('notas_prontuario')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as NotaProntuario[];
    },
    enabled: !!user && !!pacienteId,
  });

  const adicionarNota = useMutation({
    mutationFn: async (payload: {
      pacienteId: string;
      tipo: string;
      titulo: string;
      descricao: string;
      dadosExtras?: any;
      referenciaId?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from('notas_prontuario')
        .insert({
          paciente_id: payload.pacienteId,
          terapeuta_id: user!.id,
          tipo: payload.tipo,
          titulo: payload.titulo,
          descricao: payload.descricao,
          dados_extras: payload.dadosExtras || {},
          referencia_id: payload.referenciaId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
    },
  });

  return {
    notas,
    isLoading,
    adicionar: adicionarNota.mutateAsync,
    adicionando: adicionarNota.isPending,
  };
}
