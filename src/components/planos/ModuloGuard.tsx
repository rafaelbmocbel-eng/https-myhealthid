import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { usePlanoAtivo, temAcessoModulo } from '@/hooks/usePlanoAtivo';

/**
 * Guarda de ROTA por módulo de plano. Se o plano do usuário não libera o módulo,
 * redireciona para /precos. Usado para impedir acesso direto por URL a
 * funcionalidades pagas (o sidebar já esconde o item).
 */
export default function ModuloGuard({ modulo, children }: { modulo: string; children: ReactNode }) {
  const { data: plano, isLoading } = usePlanoAtivo();
  if (isLoading) return null;
  if (!temAcessoModulo(plano, modulo)) return <Navigate to="/precos" replace />;
  return <>{children}</>;
}
