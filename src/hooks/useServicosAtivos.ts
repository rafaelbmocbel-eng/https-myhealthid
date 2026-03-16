import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ServicosAtivos {
  identidade: boolean;
  cob_zero: boolean;
  studio: boolean;
}

const DEFAULT_SERVICOS: ServicosAtivos = {
  identidade: true,
  cob_zero: true,
  studio: true,
};

export function useServicosAtivos() {
  const { user } = useAuth();
  const [servicos, setServicos] = useState<ServicosAtivos>(DEFAULT_SERVICOS);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from('config_agenda')
      .select('servicos_ativos')
      .eq('terapeuta_id', user.id)
      .maybeSingle();
    if (data?.servicos_ativos) {
      setServicos({ ...DEFAULT_SERVICOS, ...(data.servicos_ativos as unknown as ServicosAtivos) });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { void fetch(); }, [fetch]);

  const saveServicos = useCallback(async (next: ServicosAtivos) => {
    if (!user) return;
    setServicos(next);
    await supabase
      .from('config_agenda')
      .update({ servicos_ativos: next as any })
      .eq('terapeuta_id', user.id);
  }, [user]);

  return { servicos, saveServicos, loading };
}
