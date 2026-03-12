import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Activity, Lock, Info } from 'lucide-react';
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<'login' | 'activate'>('login');

  // If already logged in as patient, redirect
  useEffect(() => {
    if (user) {
      navigate('/paciente/dashboard', { replace: true });
    }
  }, [user, navigate]);

  // Fetch patient by token
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome, email, telefone, user_id')
        .eq('portal_token', token)
        .maybeSingle() as any;

      if (error || !data) {
        toast({ title: 'Link inválido', description: 'Este link de portal não é válido.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      setPatient(data);
      setEmail(data.email || '');
      setMode(data.user_id ? 'login' : 'activate');
      setLoading(false);
    })();
  }, [token]);

  // Generate default password hint
  const getPasswordHint = () => {
    if (!patient) return '';
    const firstName = patient.nome?.toLowerCase().trim() || '';
    const phone = (patient.telefone || '').replace(/\D/g, '');
    const lastFour = phone.slice(-4) || '****';
    return `${firstName}${lastFour}`;
  };

  const handleSubmit = async () => {
    if (!patient) return;
    setSubmitting(true);

    if (mode === 'activate') {
      // Create account with default password
      const defaultPassword = getPasswordHint();
      const signUpEmail = email || `${patient.id}@portal.myhealthid.app`;

      const { error } = await supabase.auth.signUp({
        email: signUpEmail,
        password: defaultPassword,
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

      // Link user_id to pacientes record
      // The trigger handle_new_user will create the profile

      toast({ title: 'Conta ativada!', description: 'Faça login com sua senha padrão.' });
      setMode('login');
      setPassword(defaultPassword);
      setSubmitting(false);
    } else {
      // Login
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({ title: 'Erro ao entrar', description: error.message, variant: 'destructive' });
        setSubmitting(false);
        return;
      }

      navigate('/paciente/dashboard', { replace: true });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Activity className="h-8 w-8 animate-spin text-indigo-600" />
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
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-black text-slate-900 tracking-tight">Central ID</span>
        </div>

        <h2 className="text-lg font-black text-slate-900 text-center mb-1">
          Olá, {patient.nome}! 👋
        </h2>
        <p className="text-sm text-slate-500 text-center mb-6">
          {mode === 'activate' ? 'Ative sua conta para acessar o portal.' : 'Entre com suas credenciais para acessar o portal.'}
        </p>

        {/* Password hint */}
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-bold text-indigo-700 mb-1">Sua senha padrão é:</p>
              <p className="text-sm font-mono font-bold text-indigo-900 bg-white rounded-lg px-3 py-1.5 inline-block">
                {patient.nome?.toLowerCase().trim()}
                <span className="text-indigo-400">+</span>
                4 últimos dígitos do celular
              </p>
              <p className="text-[10px] text-indigo-500 mt-2">
                Exemplo: se seu nome é "Rafael" e celular termina em 4321, a senha é <strong>rafael4321</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">E-mail</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="bg-slate-50"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha padrão"
              className="bg-slate-50"
            />
          </div>
          <Button
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-12"
            onClick={handleSubmit}
            disabled={submitting || !email}
          >
            <Lock className="h-4 w-4 mr-2" />
            {submitting ? 'Processando...' : mode === 'activate' ? 'Ativar minha conta' : 'Entrar no portal'}
          </Button>
        </div>

        <p className="text-[10px] text-slate-400 text-center mt-6">
          Se precisar de ajuda, entre em contato com seu profissional de saúde.
        </p>
      </div>
    </div>
  );
}
