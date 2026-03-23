import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
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

  if (loading || isPatient === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isPatient) {
    return <Navigate to="/paciente/dashboard" replace />;
  }

  return <>{children}</>;
}
