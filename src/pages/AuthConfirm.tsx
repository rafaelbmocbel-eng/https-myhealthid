import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

/**
 * Processa o link de confirmação de e-mail no fluxo PKCE do Supabase.
 * O Supabase envia e-mails com links no formato:
 *   https://[site]/auth/confirm?token_hash=...&type=signup&next=[redirect]
 * Esta página troca o token pela sessão e redireciona o usuário.
 */
export default function AuthConfirm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash');
    const type = searchParams.get('type') as 'signup' | 'recovery' | 'email' | null;
    const next = searchParams.get('next');

    if (!tokenHash || !type) {
      setErro('Link inválido ou expirado.');
      return;
    }

    const confirmar = async () => {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

      if (error) {
        console.error('[AuthConfirm] Erro ao verificar token:', error.message);
        setErro('Link expirado ou já utilizado. Faça login novamente.');
        setTimeout(() => navigate('/paciente/login', { replace: true }), 2500);
        return;
      }

      if (type === 'recovery') {
        navigate('/nova-senha?portal=1', { replace: true });
        return;
      }

      // signup / email — redireciona para next se válido, senão app do profissional
      // (pacientes sempre têm next explícito vindo do emailRedirectTo do cadastro)
      const destino = next && next.startsWith('/') ? next : '/auth';
      navigate(destino, { replace: true });
    };

    confirmar();
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-center px-4">
      {erro ? (
        <>
          <p className="text-sm font-semibold text-destructive">{erro}</p>
          <p className="text-xs text-muted-foreground">Redirecionando para o login…</p>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Confirmando seu e-mail…</p>
        </>
      )}
    </div>
  );
}
