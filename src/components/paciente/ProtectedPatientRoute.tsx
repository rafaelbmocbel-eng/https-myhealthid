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
  const [role, setRole] = useState<'patient' | 'professional' | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChecking(false);
      return;
    }

    const detectRole = async () => {
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
      }
      setChecking(false);
    };

    detectRole();
  }, [user, authLoading]);

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
