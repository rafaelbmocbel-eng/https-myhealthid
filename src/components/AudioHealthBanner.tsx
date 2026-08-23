import { useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const DISMISS_KEY = 'mhid.audio-health-dismissed-id';

/**
 * Banner global de status do pipeline de áudio (transcrição/Gemini).
 * Só aparece quando o último health-check do Guardião de Áudio FALHOU —
 * avisa o profissional que a avaliação por áudio pode estar fora do ar,
 * para ele usar texto enquanto isso. Dispensável por incidente (some quando
 * o serviço volta; reaparece se um novo incidente ocorrer).
 */
export default function AudioHealthBanner() {
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    setDismissedId(localStorage.getItem(DISMISS_KEY));
  }, []);

  const { data } = useQuery({
    queryKey: ['audio-health-latest'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audio_health_checks')
        .select('id, ok, checked_at')
        .order('checked_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; ok: boolean; checked_at: string } | null;
    },
    // Revalida de vez em quando; não precisa ser agressivo.
    refetchInterval: 5 * 60 * 1000,
    staleTime: 4 * 60 * 1000,
    retry: false,
  });

  if (!data || data.ok) return null;
  if (dismissedId === data.id) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, data.id);
    setDismissedId(data.id);
  };

  return (
    <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs sm:text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        <span className="truncate">
          <strong className="font-semibold text-destructive">Transcrição por áudio instável</strong>{' '}
          <span className="text-muted-foreground">
            — o motor de áudio está fora do ar no momento. Se precisar avaliar agora, use a entrada por <strong>texto</strong>; a equipe já foi avisada.
          </span>
        </span>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Fechar"
        className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/5"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
