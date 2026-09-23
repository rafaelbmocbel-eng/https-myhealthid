import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import PortalErrorBoundary from './PortalErrorBoundary';
import PortalErrorState from './PortalErrorState';

// Cada página do portal também se envolve neste guard; o cache evita refazer
// as consultas de papel (e o spinner extra) a cada troca de tela.
const pacienteOkCache = new Set<string>();

interface Props {
  children: ReactNode;
}

export default function ProtectedPatientRoute({ children }: Props) {
  const { user, loading: authLoading, authReady } = useAuth();
  const location = useLocation();
  const [role, setRole] = useState<'patient' | 'professional' | 'unknown' | 'erro' | null>(null);
  const [cadastroStatus, setCadastroStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (authLoading || !authReady) return;
    if (!user) {
      setChecking(false);
      return;
    }

    if (pacienteOkCache.has(user.id)) {
      setRole('patient');
      setCadastroStatus('completo');
      setChecking(false);
      return;
    }

    const detectRole = async () => {
      try {
        const { data: profile, error: errProfile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (errProfile) throw errProfile;

        const { data: paciente, error: errPac } = await supabase
          .from('pacientes')
          .select('id, cadastro_status')
          .eq('user_id', user.id)
          .maybeSingle();
        if (errPac) throw errPac;

        if (paciente) {
          setRole('patient');
          setCadastroStatus((paciente as any).cadastro_status || null);
          if ((paciente as any).cadastro_status === 'completo') pacienteOkCache.add(user.id);
        } else if (profile) {
          setRole('professional');
        } else {
          // Check for standalone patient (self-registered)
          const { data: portalPaciente, error: errPortal } = await supabase
            .from('portal_pacientes')
            .select('id, cadastro_status')
            .eq('user_id', user.id)
            .maybeSingle();
          if (errPortal) throw errPortal;

          if (portalPaciente) {
            setRole('patient');
            setCadastroStatus('completo');
          } else if (retryCount < 3) {
            setTimeout(() => setRetryCount(c => c + 1), 1500);
            return;
          } else {
            setRole('unknown');
          }
        }
      } catch (err) {
        console.error('[ProtectedPatientRoute] Erro ao detectar role:', err);
        if (retryCount < 2) {
          setTimeout(() => setRetryCount(c => c + 1), 2000);
          return;
        }
        // Falha de rede não é "cadastro inexistente": mandar ao login faria o
        // paciente achar que perdeu a conta.
        setRole('erro');
      }
      setChecking(false);
    };

    detectRole();
  }, [user, authLoading, authReady, retryCount]);

  if (authLoading || !authReady || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/paciente/login" replace />;
  }

  if (role === 'erro') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <PortalErrorState onRetry={() => { setChecking(true); setRole(null); setRetryCount(0); }} />
      </div>
    );
  }

  if (role === 'professional') {
    return <Navigate to="/agenda" replace />;
  }

  if (role !== 'patient') {
    return <Navigate to="/paciente/login" replace />;
  }

  // Gate: força o paciente a concluir o cadastro antes de acessar o portal
  if (cadastroStatus !== 'completo' && location.pathname !== '/paciente/completar-cadastro') {
    return <Navigate to="/paciente/completar-cadastro" replace />;
  }

  return (
    <PortalErrorBoundary resetKey={location.pathname}>
      {children}
    </PortalErrorBoundary>
  );
}
