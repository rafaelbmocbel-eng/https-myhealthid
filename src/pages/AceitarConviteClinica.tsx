import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Building2, CheckCircle2, XCircle } from 'lucide-react';

// Aceite de convite para a clínica. Precisa estar logado como profissional:
// se não estiver, manda para o login guardando o destino para voltar aqui.
export default function AceitarConviteClinica() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, authReady } = useAuth();
  const [estado, setEstado] = useState<'processando' | 'ok' | 'erro'>('processando');
  const [msg, setMsg] = useState('');
  const [clinicaNome, setClinicaNome] = useState('');
  const jaRodou = useRef(false);

  useEffect(() => {
    if (!authReady || !user || !token || jaRodou.current) return;
    jaRodou.current = true;
    (async () => {
      const { data, error } = await (supabase as any).rpc('aceitar_convite_clinica', { p_token: token });
      if (error) {
        const m = error.message || '';
        setMsg(/expirado/.test(m) ? 'Este convite expirou ou já foi usado.'
          : /invalido/.test(m) ? 'Convite inválido.'
          : /limite/.test(m) ? 'A clínica atingiu o limite de profissionais.'
          : /indisponivel|inativa/.test(m) ? 'Esta clínica não está disponível.'
          : 'Não foi possível aceitar o convite.');
        setEstado('erro');
        return;
      }
      setClinicaNome((data as any)?.nome || '');
      setEstado('ok');
      setTimeout(() => navigate('/clinica'), 1800);
    })();
  }, [authReady, user, token, navigate]);

  // Não logado → login, voltando para cá depois.
  if (authReady && !user) {
    return <Navigate to={`/auth?redirect=${encodeURIComponent(`/clinica/convite/${token}`)}`} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="p-8 max-w-sm w-full text-center space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          {estado === 'processando' && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
          {estado === 'ok' && <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
          {estado === 'erro' && <XCircle className="h-6 w-6 text-destructive" />}
        </div>
        {estado === 'processando' && <p className="text-sm text-muted-foreground">Entrando na clínica…</p>}
        {estado === 'ok' && (
          <>
            <div className="flex items-center justify-center gap-1.5 font-semibold"><Building2 className="h-4 w-4" /> {clinicaNome || 'Clínica'}</div>
            <p className="text-sm text-muted-foreground">Você agora faz parte desta clínica. Redirecionando…</p>
          </>
        )}
        {estado === 'erro' && (
          <>
            <p className="text-sm text-muted-foreground">{msg}</p>
            <Button size="sm" variant="outline" onClick={() => navigate('/inicio-app')}>Ir para o início</Button>
          </>
        )}
      </Card>
    </div>
  );
}
