import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import {
  LayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
} from '@/hooks/useLayoutConfig';

interface LayoutConfigContextType {
  config: LayoutConfig;
  loading: boolean;
  save: (next: LayoutConfig) => Promise<void>;
  reset: () => Promise<void>;
}

const LayoutConfigContext = createContext<LayoutConfigContextType>({
  config: DEFAULT_LAYOUT_CONFIG,
  loading: true,
  save: async () => {},
  reset: async () => {},
});

export function LayoutConfigProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<LayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const [loading, setLoading] = useState(true);

  // Load global config from Supabase on mount (once auth is ready).
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_layout_config')
        .select('config')
        .eq('id', 1)
        .maybeSingle();

      if (!cancelled) {
        if (!error && data?.config && Object.keys(data.config as object).length > 0) {
          const stored = data.config as Partial<LayoutConfig>;
          setConfig({
            ...DEFAULT_LAYOUT_CONFIG,
            ...stored,
            botao_presencial: {
              ...DEFAULT_LAYOUT_CONFIG.botao_presencial,
              ...(stored.botao_presencial ?? {}),
            },
            botao_resposta_completa: {
              ...DEFAULT_LAYOUT_CONFIG.botao_resposta_completa,
              ...(stored.botao_resposta_completa ?? {}),
            },
            main_tabs: stored.main_tabs ?? DEFAULT_LAYOUT_CONFIG.main_tabs,
            sub_tabs: stored.sub_tabs ?? DEFAULT_LAYOUT_CONFIG.sub_tabs,
          });
        }
        setLoading(false);
      }
    }
    // Only load when we have an authenticated user (RLS requires it).
    if (user) {
      load();
    } else {
      setLoading(false);
    }
    return () => { cancelled = true; };
  }, [user?.id]);

  const save = useCallback(async (next: LayoutConfig) => {
    // Optimistic update — UI reflects change immediately.
    setConfig(next);
    await supabase
      .from('app_layout_config')
      .update({ config: next as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq('id', 1);
  }, []);

  const reset = useCallback(async () => {
    setConfig(DEFAULT_LAYOUT_CONFIG);
    await supabase
      .from('app_layout_config')
      .update({ config: DEFAULT_LAYOUT_CONFIG as unknown as Record<string, unknown>, updated_at: new Date().toISOString() })
      .eq('id', 1);
  }, []);

  return (
    <LayoutConfigContext.Provider value={{ config, loading, save, reset }}>
      {children}
    </LayoutConfigContext.Provider>
  );
}

export function useLayoutConfig() {
  return useContext(LayoutConfigContext);
}
