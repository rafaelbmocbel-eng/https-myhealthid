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

  // Repasse padrão (%) para profissionais da equipe sem % próprio. Editável na
  // tela de repasse; 40% enquanto a clínica não definir outro valor.
  const padraoQuery = useQuery({
    queryKey: ['repasse_padrao', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('config_clinica' as any)
        .select('*')
        .eq('terapeuta_id', user!.id)
        .maybeSingle();
      const v = Number((data as any)?.repasse_padrao_pct);
      return Number.isFinite(v) ? v : 40;
    },
  });
  const padraoPct = padraoQuery.data ?? 40;

  const setPadrao = useMutation({
    mutationFn: async (pct: number) => {
      if (!user) throw new Error('not_authenticated');
      const valor = Math.max(0, Math.min(100, pct));
      const { error } = await supabase
        .from('config_clinica' as any)
        .upsert({ terapeuta_id: user.id, repasse_padrao_pct: valor }, { onConflict: 'terapeuta_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repasse_padrao'] });
      toast({ title: 'Repasse padrão atualizado' });
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

  /**
   * Valor do repasse de UMA sessão. Regra única usada em todo o financeiro:
   * - sem profissional da equipe vinculado (o próprio dono atendeu) → 0;
   * - profissional com % ou valor fixo configurado → usa o configurado;
   * - profissional sem configuração → repasse padrão da clínica.
   */
  const calcularRepasse = (valor: number, membro_equipe_id: string | null | undefined, convenio_id: string | null) => {
    if (!membro_equipe_id) return { repasse: 0, percentual: 0, custom: false };
    const cfg = getRepasse(membro_equipe_id, convenio_id);
    if (cfg) {
      if (cfg.valor_fixo != null) {
        const repasse = Number(cfg.valor_fixo);
        return { repasse, percentual: valor > 0 ? (repasse / valor) * 100 : 0, custom: true };
      }
      const percentual = Number(cfg.percentual);
      return { repasse: valor * (percentual / 100), percentual, custom: true };
    }
    return { repasse: valor * (padraoPct / 100), percentual: padraoPct, custom: false };
  };

  return { repasses: query.data || [], loading: query.isLoading, setRepasse, getRepasse, padraoPct, setPadrao, calcularRepasse };
}
