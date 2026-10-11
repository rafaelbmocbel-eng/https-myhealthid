import { useAuth } from '@/contexts/AuthContext';
import { SUPER_ADMINS } from '@/lib/superAdmins';

// Super-admins do produto (dono do app): a lista fica em src/lib/superAdmins.ts.
export { SUPER_ADMINS };

/** True quando o usuário logado é o dono do produto (acesso ao painel admin). */
export function useIsSuperAdmin(): boolean {
  const { user } = useAuth();
  return !!user?.email && SUPER_ADMINS.includes(user.email.toLowerCase());
}
