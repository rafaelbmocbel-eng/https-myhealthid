import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type AiCreditsStatus = 'active' | 'exhausted' | 'rate_limited' | 'unconfigured' | 'error' | 'unknown';

export interface AiCreditsState {
  status: AiCreditsStatus;
  httpStatus: number;
  message: string;
  detail?: string;
  checkedAt: string | null;
  loading: boolean;
}

const CACHE_KEY = 'ai_credits_status_cache_v1';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedPayload {
  status: AiCreditsStatus;
  httpStatus: number;
  message: string;
  detail?: string;
  checkedAt: string;
  cachedAt: number;
}

function readCache(): CachedPayload | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(payload: Omit<CachedPayload, 'cachedAt'>) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...payload, cachedAt: Date.now() }));
  } catch {
    /* ignore quota errors */
  }
}

export function useAiCreditsStatus(autoCheck: boolean = true): AiCreditsState & { refresh: () => Promise<void> } {
  const cached = readCache();
  const [state, setState] = useState<AiCreditsState>({
    status: cached?.status ?? 'unknown',
    httpStatus: cached?.httpStatus ?? 0,
    message: cached?.message ?? 'Verificando...',
    detail: cached?.detail,
    checkedAt: cached?.checkedAt ?? null,
    loading: !cached,
  });

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true }));
    try {
      const { data, error } = await supabase.functions.invoke('ai-credits-status');
      if (error) throw error;
      const next: AiCreditsState = {
        status: (data?.status as AiCreditsStatus) ?? 'error',
        httpStatus: data?.httpStatus ?? 0,
        message: data?.message ?? 'Status desconhecido',
        detail: data?.detail,
        checkedAt: data?.checkedAt ?? new Date().toISOString(),
        loading: false,
      };
      setState(next);
      writeCache({
        status: next.status,
        httpStatus: next.httpStatus,
        message: next.message,
        detail: next.detail,
        checkedAt: next.checkedAt!,
      });
    } catch (e) {
      setState(s => ({
        ...s,
        status: 'error',
        message: e instanceof Error ? e.message : 'Falha ao verificar status',
        loading: false,
        checkedAt: new Date().toISOString(),
      }));
    }
  }, []);

  useEffect(() => {
    if (!autoCheck) return;
    if (cached) return; // use cache; user can manually refresh
    refresh();
  }, [autoCheck, refresh]);

  return { ...state, refresh };
}
