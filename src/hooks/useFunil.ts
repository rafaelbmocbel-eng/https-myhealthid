import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from './use-toast';
import { withAuthLockRetry } from '@/lib/authLock';

export interface ServicoFunil {
  nome: string;
  descricao: string;
  valor: number;
  parcelas_max: number;
}

export interface FunilConfig {
  id?: string;
  terapeuta_id?: string;
  slug: string;
  ativo: boolean;
  mensagem_boas_vindas: string;
  mensagem_diferenciais: string;
  mensagem_servicos: string;
  mensagem_agendamento: string;
  mensagem_pagamento: string;
  mensagem_confirmacao: string;
  diferenciais: string[];
  servicos: ServicoFunil[];
  pix_tipo: string;
  pix_chave: string;
  pix_nome: string;
  link_cartao: string;
}

export function useFunil() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['funil-config', user?.id],
    queryFn: async () => {
      return withAuthLockRetry(async () => {
        const { data, error } = await supabase
          .from('funil_config')
          .select('*')
          .eq('terapeuta_id', user!.id)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
          ...data,
          diferenciais: (data.diferenciais as any) || [],
          servicos: (data.servicos as any) || [],
        } as FunilConfig;
      }, { maxAttempts: 4, baseDelayMs: 300 });
    },
    enabled: !!user,
  });

  const saveConfig = useMutation({
    mutationFn: async (cfg: Partial<FunilConfig>) => {
      if (!user) throw new Error('Not authenticated');

      const payload = {
        ...cfg,
        terapeuta_id: user.id,
      };

      await withAuthLockRetry(async () => {
        if (config?.id) {
          const { error } = await supabase
            .from('funil_config')
            .update(payload as any)
            .eq('id', config.id);

          if (error) throw error;
          return;
        }

        const { error } = await supabase
          .from('funil_config')
          .insert(payload as any);

        if (error) throw error;
      }, { maxAttempts: 4, baseDelayMs: 300 });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funil-config'] });
      toast({ title: 'Configurações do funil salvas! ✅' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao salvar funil', description: e.message, variant: 'destructive' });
    },
  });

  return { config, isLoading, saveConfig };
}

export function useFunilPublico(slug?: string) {
  return useQuery({
    queryKey: ['funil-publico', slug],
    queryFn: async () => {
      return withAuthLockRetry(async () => {
        const { data, error } = await supabase
          .from('funil_config')
          .select('*')
          .eq('slug', slug!)
          .eq('ativo', true)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        return {
          ...data,
          diferenciais: (data.diferenciais as any) || [],
          servicos: (data.servicos as any) || [],
        } as FunilConfig & { id: string; terapeuta_id: string };
      }, { maxAttempts: 4, baseDelayMs: 300 });
    },
    enabled: !!slug,
  });
}
