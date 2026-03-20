import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export interface ServicoFunil {
  nome: string;
  descricao: string;
  valor: number;
  parcelas_max: number;
}

export interface FunilConfig {
  id?: string;
  terapeuta_id?: string;
  slug?: string;
  ativo: boolean;
  mensagem_boas_vindas: string;
  diferenciais: string[];
  servicos: ServicoFunil[];
  pix_chave?: string;
  pix_tipo?: string;
  pix_nome?: string;
  link_cartao?: string;
  mensagem_diferenciais?: string;
  mensagem_servicos?: string;
  mensagem_agendamento?: string;
  mensagem_pagamento?: string;
  mensagem_confirmacao?: string;
}

export function useFunilConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['funil-config', user?.id],
    queryFn: async () => {
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
    },
    enabled: !!user,
  });

  const saveConfig = useMutation({
    mutationFn: async (cfg: Partial<FunilConfig>) => {
      if (!user) throw new Error('Not authenticated');
      const payload = {
        ...cfg,
        terapeuta_id: user.id,
        diferenciais: JSON.stringify(cfg.diferenciais),
        servicos: JSON.stringify(cfg.servicos),
      };

      if (config?.id) {
        const { error } = await supabase
          .from('funil_config')
          .update(payload as any)
          .eq('id', config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('funil_config')
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['funil-config'] });
      toast({ title: 'Funil salvo! ✅' });
    },
    onError: (e: any) => {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    },
  });

  return { config, isLoading, saveConfig };
}

// Public: load funil config by slug via secure RPC (no payment data exposed)
export function useFunilPublico(slug?: string) {
  return useQuery({
    queryKey: ['funil-publico', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_funil_publico', { p_slug: slug! });
      if (error) throw error;
      if (!data || data.length === 0) return null;
      const row = data[0];
      return {
        ...row,
        diferenciais: (row.diferenciais as any) || [],
        servicos: (row.servicos as any) || [],
      } as FunilConfig & { id: string; terapeuta_id: string };
    },
    enabled: !!slug,
  });
}

// Fetch payment details only when lead reaches payment step
export async function fetchFunilPagamento(funilConfigId: string, leadId: string) {
  const { data, error } = await supabase
    .rpc('get_funil_pagamento', { p_funil_config_id: funilConfigId, p_lead_id: leadId });
  if (error) throw error;
  if (!data || data.length === 0) return null;
  return data[0] as { pix_chave: string; pix_tipo: string; pix_nome: string; link_cartao: string };
}
