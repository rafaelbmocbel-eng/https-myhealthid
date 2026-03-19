import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

export default function ProtectedPatientRoute({ children }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<'patient' | 'professional' | 'unknown' | null>(null);
  const [checking, setChecking] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }

    const detectRole = async () => {
      try {
        // Check if user has a profile (professional)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        // Check if user is linked as a patient
        const { data: paciente } = await supabase
          .from('pacientes')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (paciente) {
          setRole('patient');
        } else if (profile) {
          setRole('professional');
        } else {
          // FIX: User exists but has no role yet (e.g., just registered, linking in progress).
          // Retry a few times with delay before giving up — the linking RPC may still be running.
          if (retryCount < 3) {
            setTimeout(() => setRetryCount(c => c + 1), 1500);
            return; // don't set checking=false yet
          }
          setRole('unknown');
        }
      } catch (err) {
        console.error('[ProtectedPatientRoute] Erro ao detectar role:', err);
        // On error, retry once
        if (retryCount < 2) {
          setTimeout(() => setRetryCount(c => c + 1), 2000);
          return;
        }
        setRole('unknown');
      }
      setChecking(false);
    };

    detectRole();
  }, [user, authLoading, retryCount]);

  if (authLoading || checking) {
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

  return <>{children}</>;
}
