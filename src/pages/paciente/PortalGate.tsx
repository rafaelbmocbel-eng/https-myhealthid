import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * PortalGate — intermediate component that forcefully signs out ANY existing
 * Supabase session before rendering the patient login page.
 * This guarantees the patient portal link never leaks into the professional app.
 */
export default function PortalGate() {
  const { token } = useParams();
  const [searchParams] = useSearchParams();
  const [ready, setReady] = useState(false);
  const [PacienteLogin, setPacienteLogin] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // 1) Force sign out — no matter who is logged in
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[PortalGate] signOut error (ignored):', e);
      }

      // 2) Clear any lingering local storage keys related to auth
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith('sb-') && key.includes('-auth-token')) {
            localStorage.removeItem(key);
          }
        }
      } catch (_) { /* ignore in SSR */ }

      // 3) Dynamically import PacienteLogin to avoid it reading stale session
      const mod = await import('./PacienteLogin');
      if (!cancelled) {
        setPacienteLogin(() => mod.default);
        setReady(true);
      }
    };

    init();
    return () => { cancelled = true; };
  }, []);

  if (!ready || !PacienteLogin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparando portal...</p>
      </div>
    );
  }

  return <PacienteLogin />;
}
