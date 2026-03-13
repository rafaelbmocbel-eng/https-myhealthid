import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Activity, ShieldCheck, ArrowRight, UserCheck, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type PortalPatient = {
  id: string;
  nome: string;
  sobrenome: string;
  email: string | null;
  telefone: string | null;
  user_id: string | null;
};

const normalizeFirstName = (fullName: string) =>
  fullName.split(" ")[0]?.toLowerCase().trim() || "paciente";

const getPhoneLastDigits = (phone?: string | null) =>
  phone?.replace(/\D/g, "").slice(-4) || "1234";

const PatientPortalAccess = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patient, setPatient] = useState<PortalPatient | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [inputName, setInputName] = useState("");
  const [inputDigits, setInputDigits] = useState("");

  useEffect(() => {
    const fetchPortalData = async () => {
      if (!token) {
        setError("Link de acesso inválido ou expirado.");
        setLoading(false);
        return;
      }

      try {
        const { data: rows, error: rpcError } = await supabase.rpc("get_patient_by_portal_token", {
          p_token: token,
        });

        const portalPatient = Array.isArray(rows) ? (rows[0] as PortalPatient | undefined) : undefined;

        if (rpcError || !portalPatient) {
          setError("Link de acesso inválido ou expirado.");
          return;
        }

        setPatient(portalPatient);

        const patientPortalEmail = `${portalPatient.id}@portal.myhealthid.app`;
        if (user?.email && user.email === patientPortalEmail) {
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

  const firstName = useMemo(() => (patient ? normalizeFirstName(patient.nome) : ""), [patient]);
  const lastDigits = useMemo(() => (patient ? getPhoneLastDigits(patient.telefone) : ""), [patient]);
  const portalEmail = useMemo(() => (patient ? `${patient.id}@portal.myhealthid.app` : ""), [patient]);

  const handleLogin = async () => {
    if (!patient) return;

    if (inputName.toLowerCase().trim() !== firstName || inputDigits !== lastDigits) {
      toast({
        title: "Acesso Negado",
        description: "Nome ou dígitos do celular não conferem.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const password = `${firstName}${lastDigits}`;

    try {
      if (user && user.email !== portalEmail && user.email !== patient.email) {
        await supabase.auth.signOut();
      }

      let signInResult = await supabase.auth.signInWithPassword({
        email: portalEmail,
        password,
      });

      if (signInResult.error?.message?.toLowerCase().includes("invalid login credentials")) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: portalEmail,
          password,
          options: {
            data: {
              nome: `${patient.nome} ${patient.sobrenome || ""}`.trim(),
              role: "patient",
            },
          },
        });

        if (signUpError && !signUpError.message.includes("User already registered")) {
          throw signUpError;
        }

        signInResult = await supabase.auth.signInWithPassword({
          email: portalEmail,
          password,
        });
      }

      if (signInResult.error || !signInResult.data.user) {
        throw signInResult.error ?? new Error("Não foi possível autenticar.");
      }

      if (token) {
        const { error: linkError } = await supabase.rpc("link_patient_user_by_token", { p_token: token });
        if (linkError) {
          console.error("Falha ao vincular paciente ao usuário autenticado:", linkError);
        }
      }

      await supabase.auth.updateUser({
        data: {
          ...(signInResult.data.user.user_metadata ?? {}),
          role: "patient",
          nome: firstName,
        },
      });

      toast({
        title: "Portal Acessado!",
        description: `Bem-vindo, ${patient.nome}!`,
      });

      navigate("/paciente/dashboard");
    } catch (err) {
      console.error(err);
      toast({
        title: "Erro ao entrar",
        description: "Não foi possível validar seu acesso agora.",
        variant: "destructive",
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 to-violet-50 p-4 font-sans">
      <div className="max-w-md w-full space-y-6">
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
            <h1 className="text-2xl font-black mb-1">Olá, {patient?.nome}! 👋</h1>
            <p className="text-indigo-100 text-xs font-medium uppercase tracking-widest opacity-80">
              Central de Engajamento MyID
            </p>
          </div>

          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-1">
              <h2 className="text-xl font-black text-slate-900">Acesse seu Hub</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                Confirme seu primeiro nome e os 4 últimos dígitos
              </p>
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
                    onChange={(e) => setInputDigits(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-2">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-tighter">
                <ShieldCheck className="h-3.5 w-3.5" /> Segurança MyID
              </div>
              <p className="text-[10px] text-indigo-700/70 font-medium">
                A senha usada é: primeiro nome em minúsculo + 4 últimos dígitos do celular (ex: rafael4321).
              </p>
            </div>

            <Button
              onClick={handleLogin}
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
