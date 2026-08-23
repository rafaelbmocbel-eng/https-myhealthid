import { useAuth } from '@/contexts/AuthContext';

// Super-admins do produto (dono do app). Mantido em sincronia com o
// SUPER_ADMINS de usePodeChancelar e do edge function admin-metrics.
export const SUPER_ADMINS = ['rafaelbmocbel@gmail.com'];

/** True quando o usuário logado é o dono do produto (acesso ao painel admin). */
export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return !!user?.email && SUPER_ADMINS.includes(user.email.toLowerCase());
}
