import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, Lock, Loader2, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PatientRecord {
  id: string;
  nome: string;
  sobrenome: string;
  email: string | null;
  telefone: string | null;
  user_id: string | null;
}

export default function PatientPortalAccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'activate'>('login');

  // Login fields
  const [firstName, setFirstName] = useState('');
  const [lastFourDigits, setLastFourDigits] = useState('');

  // Registration fields (activate mode)
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');

  useEffect(() => {
    if (user) {
      navigate('/paciente/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: rows, error } = await supabase
        .rpc('get_patient_by_portal_token', { p_token: token }) as any;
      const data = rows?.[0] || null;

      if (error || !data) {
        toast({ title: 'Link inválido', description: 'Este link de portal não é válido.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      setPatient(data);
      setRegEmail(data.email || '');
      setRegPhone(data.telefone || '');
      setMode(data.user_id ? 'login' : 'activate');
      setLoading(false);
    })();
  }, [token]);

  const buildPassword = (name: string, digits: string) => {
    return `${name.toLowerCase().trim()}${digits}`;
  };

  const handleLogin = async () => {
    if (!patient || !firstName || lastFourDigits.length !== 4) return;
    setSubmitting(true);

    const password = buildPassword(firstName, lastFourDigits);
    const loginEmail = patient.email || `${patient.id}@portal.myhealthid.app`;

    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      toast({ title: 'Erro ao entrar', description: 'Verifique seu nome e os dígitos do celular.', variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    navigate('/paciente/dashboard', { replace: true });
  };

  const handleActivate = async () => {
    if (!patient) return;
    if (!firstName || lastFourDigits.length !== 4) {
      toast({ title: 'Preencha os campos', description: 'Informe seu primeiro nome e os 4 últimos dígitos do celular.', variant: 'destructive' });
      return;
    }

    setSubmitting(true);
    const password = buildPassword(firstName, lastFourDigits);
    const signUpEmail = regEmail || `${patient.id}@portal.myhealthid.app`;

    const { error } = await supabase.auth.signUp({
      email: signUpEmail,
      password,
      options: {
        data: {
          nome: patient.nome,
          sobrenome: patient.sobrenome,
          role: 'patient',
        },
      },
    });

    if (error) {
      toast({ title: 'Erro ao ativar', description: error.message, variant: 'destructive' });
      setSubmitting(false);
      return;
    }

    // Update pacientes record with user linkage will happen via trigger
    toast({ title: 'Conta ativada!', description: 'Entrando no portal...' });

    // Auto-login after activation
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: signUpEmail,
      password,
    });

    if (loginError) {
      toast({ title: 'Conta criada', description: 'Faça login com seu nome e dígitos do celular.' });
      setMode('login');
    } else {
      navigate('/paciente/dashboard', { replace: true });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <h1 className="text-2xl font-black text-slate-900 mb-2">Link inválido</h1>
          <p className="text-slate-500">Este link de acesso ao portal não é válido ou expirou.</p>
          <Button className="mt-6" onClick={() => navigate('/paciente/login')}>Ir para login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">Central ID</span>
        </div>

        <h2 className="text-lg font-black text-slate-900 text-center mb-1">
          Olá, {patient.nome}! 👋
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          {mode === 'activate'
            ? 'Ative sua conta para acessar o portal.'
            : 'Entre com seus dados para acessar o portal.'}
        </p>

        {/* Fields */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Primeiro Nome</label>
            <Input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ex: Rafael"
              className="bg-slate-50"
              autoComplete="given-name"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">4 últimos dígitos do celular</label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={lastFourDigits}
              onChange={(e) => setLastFourDigits(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Ex: 4321"
              className="bg-slate-50 tracking-[0.3em] text-center font-mono text-lg"
            />
          </div>

          {/* Activate: show optional email/phone */}
          {mode === 'activate' && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <UserPlus className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-700 uppercase">Dados para cadastro</span>
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-700 mb-1 block">E-mail</label>
                <Input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="seu@email.com"
                  className="bg-white"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-emerald-700 mb-1 block">Celular</label>
                <Input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="bg-white"
                />
              </div>
            </div>
          )}

          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12 rounded-xl"
            onClick={mode === 'activate' ? handleActivate : handleLogin}
            disabled={submitting || !firstName || lastFourDigits.length !== 4}
          >
            {submitting ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Lock className="h-4 w-4 mr-2" />
                {mode === 'activate' ? 'Ativar minha conta' : 'Entrar no portal'}
              </>
            )}
          </Button>
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-6">
          Sua senha é seu primeiro nome + 4 últimos dígitos do celular.
          <br />Se precisar de ajuda, entre em contato com seu profissional.
        </p>
      </div>
    </div>
  );
}
