import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { withAuthLockRetry } from '@/lib/authLock';

interface Profile {
  id: string;
  user_id: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string;
  crefito?: string;
  especialidade?: string;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await withAuthLockRetry(() =>
        supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()
      );

      if (error) {
        throw error;
      }

      setProfile(data);
    } catch (error) {
      console.error('[Auth] Falha ao buscar perfil:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, nextSession) => {
        setSession(nextSession);
        setUser(nextSession?.user ?? null);
        setAuthReady(true);

        if (nextSession?.user) {
          setLoading(true);
          setTimeout(() => {
            void fetchProfile(nextSession.user.id);
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    const bootstrapSession = async () => {
      try {
        const { data: { session: currentSession } } = await withAuthLockRetry(
          () => supabase.auth.getSession(),
          { maxAttempts: 5, baseDelayMs: 300 }
        );

        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setAuthReady(true);

        if (currentSession?.user) {
          await fetchProfile(currentSession.user.id);
        } else {
          setLoading(false);
        }
      } catch (error) {
        console.warn('[Auth] Sessão não restaurada (lock timeout?). O listener vai tentar novamente.', error);
        // Don't block the app – onAuthStateChange will fire when lock is released
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
        setAuthReady(true);
      }
    };

    void bootstrapSession();

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await withAuthLockRetry(() =>
        supabase.auth.signInWithPassword({ email, password })
      );
      return { error };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Falha ao autenticar.') };
    }
  };

  const signUp = async (email: string, password: string, nome: string) => {
    try {
      const { error } = await withAuthLockRetry(() =>
        supabase.auth.signUp({
          email,
          password,
          options: { data: { nome } },
        })
      );
      return { error };
    } catch (error) {
      return { error: error instanceof Error ? error : new Error('Falha ao cadastrar.') };
    }
  };

  const signOut = async () => {
    try {
      await withAuthLockRetry(() => supabase.auth.signOut());
    } catch (error) {
      console.error('[Auth] Falha ao sair da sessão:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, authReady, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
