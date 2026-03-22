import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/**
 * Wraps therapist-only routes. If the logged-in user is a patient (has a
 * row in `pacientes` with their user_id but NO professional profile),
 * they are redirected to /paciente/dashboard.
 *
 * For non-authenticated users or professionals, children render normally.
 */
export default function PatientGuard({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [isPatient, setIsPatient] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    // Not logged in — let the page handle its own auth redirect
    if (!user) {
      setIsPatient(false);
      return;
    }

    // If AuthContext already loaded a professional profile, this is NOT a patient
    if (profile) {
      setIsPatient(false);
      return;
    }

    // No profile — check if user_id exists in pacientes table
    const check = async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      setIsPatient(!!data);
    };
    check();
  }, [user, profile, loading]);

  // Still checking
  if (loading || isPatient === null) return null;

  if (isPatient) {
    return <Navigate to="/paciente/dashboard" replace />;
  }

  return <>{children}</>;
}
