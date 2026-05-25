import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export default function ProtectedPatientRoute({ children }: Props) {
  const { user, loading: authLoading, authReady } = useAuth();
  const location = useLocation();
  const [role, setRole] = useState<'patient' | 'professional' | 'unknown' | null>(null);
  const [cadastroStatus, setCadastroStatus] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (authLoading || !authReady) return;
    if (!user) {
      setChecking(false);
      return;
    }

    const detectRole = async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        const { data: paciente } = await supabase
          .from('pacientes')
          .select('id, cadastro_status')
          .eq('user_id', user.id)
          .maybeSingle();

        if (paciente) {
          setRole('patient');
          setCadastroStatus((paciente as any).cadastro_status || null);
        } else if (profile) {
          setRole('professional');
        } else {
          // Usuário sem role ainda (vinculação em andamento) — tenta de novo
          if (retryCount < 3) {
            setTimeout(() => setRetryCount(c => c + 1), 1500);
            return;
          }
          setRole('unknown');
        }
      } catch (err) {
        console.error('[ProtectedPatientRoute] Erro ao detectar role:', err);
        if (retryCount < 2) {
          setTimeout(() => setRetryCount(c => c + 1), 2000);
          return;
        }
        setRole('unknown');
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

  return <>{children}</>;
}
