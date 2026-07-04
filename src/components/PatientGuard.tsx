import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import AppErrorBoundary from './AppErrorBoundary';

/**
 * Wraps professional-only routes. If the logged-in user is a patient, they are
 * redirected to /paciente/dashboard. The role lookup is cached per user-id in
 * memory so navigation between professional routes does not re-query the DB.
 */

type RoleResult = 'patient' | 'professional' | 'unknown';
const roleCache = new Map<string, RoleResult>();
const inflight = new Map<string, Promise<RoleResult>>();

async function resolveRole(userId: string, userEmail?: string, userName?: string): Promise<RoleResult> {
  const cached = roleCache.get(userId);
  if (cached && cached !== 'unknown') return cached;
  const existing = inflight.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    const [{ data: profissional }, { data: paciente }] = await Promise.all([
      supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle(),
      supabase.from('pacientes').select('id').eq('user_id', userId).maybeSingle(),
    ]);
    let role: RoleResult;
    if (profissional) role = 'professional';
    else if (paciente) role = 'patient';
    else {
      // Profile missing — trigger may have failed. Auto-create it so the therapist can proceed.
      const { error } = await supabase.from('profiles').upsert(
        { user_id: userId, email: userEmail ?? '', nome: userName ?? '' },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );
      role = error ? 'unknown' : 'professional';
    }
    roleCache.set(userId, role);
    inflight.delete(userId);
    return role;
  })();

  inflight.set(userId, promise);
  return promise;
}

export default function ProfessionalGuard({ children }: { children: ReactNode }) {
  const { user, loading, authReady } = useAuth();
  const location = useLocation();
  const initial = user ? roleCache.get(user.id) ?? null : null;
  const [role, setRole] = useState<RoleResult | null>(initial);

  useEffect(() => {
    if (loading || !authReady) return;
    if (!user) {
      setRole(null);
      return;
    }
    let active = true;
    resolveRole(user.id, user.email, user.user_metadata?.nome as string | undefined).then((r) => {
      if (active) setRole(r);
    }).catch((err) => {
      console.error('[PatientGuard] role lookup failed:', err);
      if (active) setRole('professional');
    });
    return () => { active = false; };
  }, [user, loading, authReady]);

  if (loading || !authReady || role === null) {
    if (!loading && authReady && !user) {
      return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (role === 'patient') {
    return <Navigate to="/paciente/dashboard" replace />;
  }

  if (role === 'unknown') {
    return <Navigate to="/auth" replace />;
  }

  return (
    <AppErrorBoundary resetKey={location.pathname}>
      {children}
    </AppErrorBoundary>
  );
}
