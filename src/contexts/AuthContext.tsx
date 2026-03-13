import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface Profile {
  id: string;
  user_id: string;
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string;
  crefito?: string;
  especialidade?: string;
  avatar_url?: string;
  role: 'admin' | 'professional' | 'patient';
  session_credits?: number;
  total_points?: number;
  current_level?: string;
  plan?: string;
  fitbit_access_token?: string;
  fitbit_refresh_token?: string;
  wearable_device?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string, role?: string, professionalId?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getRoleFromMetadata = (
  metadata?: Record<string, unknown>
): Profile['role'] => {
  const role = metadata?.role;
  if (role === 'admin' || role === 'professional' || role === 'patient') {
    return role;
  }
  return 'professional';
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user.user_metadata as Record<string, unknown>);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchProfile(session.user.id, session.user.user_metadata as Record<string, unknown>);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, metadata?: Record<string, unknown>) => {
    const metadataFallback =
      metadata ??
      (session?.user?.id === userId ? session.user.user_metadata as Record<string, unknown> : undefined) ??
      (user?.id === userId ? user.user_metadata as Record<string, unknown> : undefined);

    const resolvedRole = getRoleFromMetadata(metadataFallback);

    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setProfile({ ...(data as any), role: resolvedRole } as Profile);
      } else {
        const fallbackEmail =
          typeof metadataFallback?.email === 'string'
            ? metadataFallback.email
            : session?.user?.email ?? user?.email ?? '';

        const fallbackName =
          typeof metadataFallback?.nome === 'string'
            ? metadataFallback.nome
            : '';

        setProfile({
          id: userId,
          user_id: userId,
          nome: fallbackName,
          sobrenome: '',
          email: fallbackEmail,
          role: resolvedRole,
        } as Profile);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, nome: string, role: string = 'patient', professionalId?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nome,
          role,
          professional_id: professionalId
        }
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
