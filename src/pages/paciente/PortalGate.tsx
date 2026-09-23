import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * PortalGate — se o paciente dono do link já está logado, vai direto ao portal;
 * senão encerra qualquer outra sessão antes de mostrar o login do paciente.
 * This guarantees the patient portal link never leaks into the professional app.
 */
export default function PortalGate() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [PacienteLogin, setPacienteLogin] = useState<React.ComponentType | null>(null);
  const [demorandoMuito, setDemorandoMuito] = useState(false);

  // Se o carregamento inicial demorar demais, avisa o paciente em vez de deixar o spinner vago.
  useEffect(() => {
    if (ready) { setDemorandoMuito(false); return; }
    const timer = setTimeout(() => setDemorandoMuito(true), 6000);
    return () => clearTimeout(timer);
  }, [ready]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      // 0) O próprio paciente dono deste link já está logado? Vai direto ao
      //    portal — antes cada toque no link do WhatsApp deslogava e pedia
      //    cadastro de novo (atrito alto, principalmente para idosos).
      if (token) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: pac } = await supabase
              .from('pacientes')
              .select('id')
              .eq('user_id', session.user.id)
              .eq('portal_token', token)
              .maybeSingle();
            if (pac && !cancelled) {
              navigate('/paciente/dashboard', { replace: true });
              return;
            }
          }
        } catch (e) {
          console.warn('[PortalGate] checagem de sessão falhou (segue para o login):', e);
        }
      }

      // 1) Sessão de outra pessoa (profissional ou outra ficha): sai antes do login
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('[PortalGate] signOut error (ignored):', e);
      }

      // 2) Clear any lingering local/session storage keys related to auth & routing
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith('sb-') && key.includes('-auth-token')) {
            localStorage.removeItem(key);
          }
        }
        // Impede o RouteRestorer de restaurar rota de profissional após o signOut
        sessionStorage.removeItem('myhealthid.route-restored');
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready || !PacienteLogin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3 px-6 text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Preparando portal...</p>
        {demorandoMuito && (
          <>
            <p className="text-xs text-muted-foreground max-w-xs">
              Isso está demorando mais que o normal. Verifique sua conexão com a internet.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold text-primary underline"
            >
              Tentar novamente
            </button>
          </>
        )}
      </div>
    );
  }

  return <PacienteLogin />;
}
