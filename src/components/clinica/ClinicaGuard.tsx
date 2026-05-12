import { ReactNode } from 'react';
import { useClinicaContext, type ClinicaPapel } from '@/hooks/useClinicaContext';

interface ClinicaGuardProps {
  children: ReactNode;
  /** Papel mínimo exigido. Se omitido, basta pertencer a uma clínica ativa. */
  requires?: ClinicaPapel;
  /** Renderiza isto quando o usuário não tem permissão (default: nada). */
  fallback?: ReactNode;
  /** Se true, também renderiza para usuários em modo solo (sem clínica). */
  allowSolo?: boolean;
}

/**
 * Renderiza filhos apenas se o usuário tem o papel requerido na clínica ativa.
 * Em modo solo (sem clínica), por padrão NÃO renderiza — use allowSolo se quiser permitir.
 *
 * Uso futuro (Sprint 1+):
 *   <ClinicaGuard requires="dono">
 *     <BotaoConvidarProfissional />
 *   </ClinicaGuard>
 */
export function ClinicaGuard({ children, requires, fallback = null, allowSolo = false }: ClinicaGuardProps) {
  const { contexto, isSolo, loading } = useClinicaContext();

  if (loading) return null;
  if (isSolo) return allowSolo ? <>{children}</> : <>{fallback}</>;
  if (!contexto) return <>{fallback}</>;
  if (requires && contexto.papel !== requires) return <>{fallback}</>;

  return <>{children}</>;
}
