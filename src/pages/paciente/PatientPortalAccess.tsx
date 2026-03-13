import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Activity, ShieldCheck, Zap, ArrowRight, UserCheck, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const PatientPortalAccess = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patient, setPatient] = useState<any>(null);
  const [professional, setProfessional] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [inputName, setInputName] = useState("");
  const [inputDigits, setInputDigits] = useState("");

  useEffect(() => {
    const fetchPortalData = async () => {
      if (!token) return;
      try {
        const { data: pac, error: pacErr } = await supabase
          .from("pacientes")
          .select("*, profiles!pacientes_terapeuta_id_fkey(nome, sobrenome, especialidade)")
          .eq("portal_token", token)
          .single();

        if (pacErr || !pac) {
          setError("Link de acesso inválido ou expirado.");
          return;
        }

        setPatient(pac);
        setProfessional(pac.profiles);

        // Se o usuário logado FOR o paciente, vai pro dashboard
        if (user && user.email === pac.email) {
          navigate("/paciente/dashboard");
        }
      } catch (err) {
        console.error(err);
        setError("Ocorreu um erro ao carregar seu portal.");
      } finally {
        setLoading(false);
      }
    };

    fetchPortalData();
  }, [token, user, navigate]);

  const handleActivate = async () => {
    if (!patient) return;
    setIsSubmitting(true);

    const firstName = patient.nome.split(' ')[0].toLowerCase().trim();
    const lastDigits = patient.telefone ? patient.telefone.replace(/\D/g, '').slice(-4) : '1234';
    const defaultPassword = `${firstName}${lastDigits}`;

    try {
      // Se já houver um usuário logado (ex: profissional), desloga para evitar conflito
      if (user && user.email !== patient.email) {
        await supabase.auth.signOut();
      }

      // 1. SignUp
      const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
        email: patient.email || `${patient.id}@portal.myhealthid.app`,
        password: defaultPassword,
        options: {
          data: {
            nome: `${patient.nome} ${patient.sobrenome || ''}`.trim(),
            role: 'patient',
            professional_id: patient.terapeuta_id
          }
        }
      });

      // Se o erro for que o usuário já existe, não tem problema
      if (signUpErr && !signUpErr.message.includes("User already registered")) {
        throw signUpErr;
      }

      // 2. Mark as activated AND link user_id in patients table
      const activeUserId = signUpData?.user?.id;
      const updateData: any = { portal_activated: true };
      if (activeUserId) {
        updateData.user_id = activeUserId;
      }

      await supabase.from("pacientes").update(updateData).eq("id", patient.id);

      toast({
        title: "Portal Ativado! 🎉",
        description: "Sua conta está pronta. Entrando...",
      });

      // Tentamos logar logo em seguida
      await handleLogin(true);

    } catch (err: any) {
      toast({
        title: "Erro na ativação",
        description: err.message || "Não conseguimos ativar seu portal agora.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (isPostActivation = false) => {
    if (!patient) return;

    const actualFirstName = patient.nome.split(' ')[0].toLowerCase().trim();
    const actualDigits = patient.telefone ? patient.telefone.replace(/\D/g, '').slice(-4) : '1234';

    // Se não for pós-ativação, validamos os campos
    if (!isPostActivation) {
      if (inputName.toLowerCase().trim() !== actualFirstName || inputDigits !== actualDigits) {
        toast({
          title: "Acesso Negado",
          description: "Nome ou dígitos do celular não conferem.",
          variant: "destructive"
        });
        return;
      }
    }

    setIsSubmitting(true);
    const password = `${actualFirstName}${actualDigits}`;

    try {
      // Se já houver um usuário logado (ex: profissional), desloga para entrar como paciente
      if (user && user.email !== patient.email) {
        await supabase.auth.signOut();
      }

      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: patient.email || `${patient.id}@portal.myhealthid.app`,
        password: password,
      });

      if (signInErr) throw signInErr;

      // Self-healing: Ensure user_id is linked in pacientes table
      if (data.user && (!patient.user_id || patient.user_id !== data.user.id)) {
        await supabase
          .from("pacientes")
          .update({ user_id: data.user.id, portal_activated: true })
          .eq("id", patient.id);
      }

      toast({
        title: "Portal Acessado!",
        description: `Bem-vindo de volta, ${patient.nome}!`,
      });

      navigate("/paciente/dashboard");
    } catch (err: any) {
      toast({
        title: "Erro ao entrar",
        description: "Credenciais inválidas ou erro no servidor.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full border-none shadow-xl rounded-[2rem] overflow-hidden">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <Activity className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-slate-900">{error}</h2>
            <Button variant="outline" className="w-full rounded-2xl py-6" onClick={() => navigate("/")}>
              Voltar ao início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isActivated = patient.portal_activated;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-violet-50 p-4 font-sans">
      <div className="max-w-md w-full space-y-6">
        {/* Branding */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200/50">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-black text-slate-900 tracking-tight">MyHealthID</span>
        </div>

        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/90 backdrop-blur-md">
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-8 text-white text-center">
            <div className="h-20 w-20 rounded-full bg-white/20 border-2 border-white/30 flex items-center justify-center mx-auto mb-4 shadow-inner">
              <UserCheck className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-2xl font-black mb-1">Olá, {patient.nome}! 👋</h1>
            <p className="text-indigo-100 text-xs font-medium uppercase tracking-widest opacity-80">
              Central de Engajamento MyID
            </p>
          </div>

          <CardContent className="p-8 space-y-6">
            {!isActivated ? (
              /* ACTIVATION STATE */
              <div className="space-y-6">
                <div className="space-y-4 text-center">
                  <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-indigo-50 text-indigo-600 mb-2">
                    <Zap className="h-6 w-6" />
                  </div>
                  <h2 className="text-xl font-black text-slate-900">Ative seu Hub de Saúde</h2>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Dr(a). <span className="font-bold text-slate-900">{professional?.nome}</span> preparou um espaço exclusivo para você gerenciar seus treinos, questionários e evolução.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-tighter">
                    <ShieldCheck className="h-3.5 w-3.5" /> Segurança MyID
                  </div>
                  <p className="text-[10px] text-indigo-700/70 font-medium">
                    Ao ativar, você poderá entrar usando apenas seu primeiro nome e os últimos dígitos do celular.
                  </p>
                </div>

                <Button
                  onClick={handleActivate}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl py-8 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-lg active:scale-95"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <>Ativar Meu Espaço <ArrowRight className="h-5 w-5" /></>}
                </Button>
              </div>
            ) : (
              /* LOGIN STATE */
              <div className="space-y-6">
                <div className="text-center space-y-1">
                  <h2 className="text-xl font-black text-slate-900">Acesse seu Hub</h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Confirme seus dados cadastrais</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Primeiro Nome</Label>
                    <div className="relative">
                      <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Ex: Rafael"
                        className="rounded-xl border-slate-200 pl-11 py-6 focus:ring-indigo-500"
                        value={inputName}
                        onChange={(e) => setInputName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">4 Últimos Dígitos do Celular</Label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="Ex: 4321"
                        maxLength={4}
                        className="rounded-xl border-slate-200 pl-11 py-6 focus:ring-indigo-500"
                        value={inputDigits}
                        onChange={(e) => setInputDigits(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => handleLogin()}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl py-8 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-lg active:scale-95"
                  disabled={isSubmitting || !inputName || inputDigits.length < 4}
                >
                  {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : <>Entrar no Portal <ArrowRight className="h-5 w-5" /></>}
                </Button>

                <div className="text-center">
                  <button
                    onClick={() => navigate("/paciente/login")}
                    className="text-[10px] font-black text-slate-400 uppercase hover:text-indigo-600 transition-colors tracking-tighter"
                  >
                    Entrar com e-mail/senha manual?
                  </button>
                </div>
              </div>
            )}
            <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] opacity-50 pt-2">
              Sistema de Saúde MyHealthID • Digital Care
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PatientPortalAccess;
