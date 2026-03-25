import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { withAuthLockRetry } from '@/lib/authLock';

export interface ServicosAtivos {
  identidade: boolean;
  cob_zero: boolean;
  studio: boolean;
  eventos: boolean;
}

export const DEFAULT_SERVICOS: ServicosAtivos = {
  identidade: true,
  cob_zero: true,
  studio: true,
  eventos: true,
};

export function useServicosAtivos() {
  const { user, authReady } = useAuth();
  const [servicos, setServicos] = useState<ServicosAtivos>(DEFAULT_SERVICOS);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!authReady) return;
    if (!user) { setLoading(false); return; }
    const { data } = await withAuthLockRetry(() =>
      supabase
        .from('config_agenda')
        .select('servicos_ativos')
        .eq('terapeuta_id', user.id)
        .maybeSingle()
    );
    setServicos({ ...DEFAULT_SERVICOS, ...((data?.servicos_ativos as unknown as Partial<ServicosAtivos>) || {}) });
    setLoading(false);
  }, [user, authReady]);

  useEffect(() => { void fetch(); }, [fetch]);

  const saveServicos = useCallback(async (next: ServicosAtivos) => {
    if (!user) return;
    const normalized = { ...DEFAULT_SERVICOS, ...next };
    setServicos(normalized);

    const { data: existingConfig } = await withAuthLockRetry(() =>
      supabase
        .from('config_agenda')
        .select('id')
        .eq('terapeuta_id', user.id)
        .maybeSingle()
    );

    if (existingConfig?.id) {
      await withAuthLockRetry(() =>
        supabase
          .from('config_agenda')
          .update({ servicos_ativos: normalized as any })
          .eq('id', existingConfig.id)
      );
      return;
    }

    await withAuthLockRetry(() =>
      supabase
        .from('config_agenda')
        .insert({ terapeuta_id: user.id, servicos_ativos: normalized as any })
    );
  }, [user]);

  return { servicos, saveServicos, loading };
}
