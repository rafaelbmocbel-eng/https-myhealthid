import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Activity, Loader2, ArrowRight, UserCheck, Lock, ShieldCheck } from "lucide-react";

const PatientLogin = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { signIn, profile, user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const metadataRole = user?.user_metadata?.role;
    const resolvedRole = profile?.role ?? (metadataRole === 'admin' || metadataRole === 'professional' || metadataRole === 'patient' ? metadataRole : null);

    useEffect(() => {
        if (user && resolvedRole) {
            if (resolvedRole === 'patient') {
                navigate("/paciente/dashboard");
            } else {
                navigate("/");
            }
        }
    }, [user, resolvedRole, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { error } = await signIn(email, password);
            if (error) {
                toast({
                    variant: "destructive",
                    title: "Erro ao entrar",
                    description: "Verifique suas credenciais e tente novamente.",
                });
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center p-4 font-sans">
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
                        <h1 className="text-2xl font-black mb-1">Acesso ao Portal</h1>
                        <p className="text-indigo-100 text-xs font-medium uppercase tracking-widest opacity-80">
                            Central de Engajamento MyID
                        </p>
                    </div>

                    <CardContent className="p-8 space-y-6">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Seu E-mail</Label>
                                    <div className="relative">
                                        <UserCheck className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            type="email"
                                            placeholder="seu@email.com"
                                            className="rounded-xl border-slate-200 pl-11 py-6 focus:ring-indigo-500"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Sua Senha</Label>
                                        <Link
                                            to="/recuperar-senha"
                                            className="text-[9px] font-black text-indigo-600 hover:text-indigo-500 uppercase tracking-tighter"
                                        >
                                            Esqueceu a senha?
                                        </Link>
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                        <Input
                                            type="password"
                                            placeholder="Sua senha"
                                            className="rounded-xl border-slate-200 pl-11 py-6 focus:ring-indigo-500"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl py-8 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-lg active:scale-95"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <>Entrar no Portal <ArrowRight className="h-5 w-5" /></>}
                            </Button>
                        </form>

                        <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-2">
                            <div className="flex items-center gap-2 text-indigo-900 font-bold text-[10px] uppercase tracking-tighter">
                                <ShieldCheck className="h-3.5 w-3.5" /> Dica de Acesso
                            </div>
                            <p className="text-[10px] text-indigo-700/70 font-medium">
                                Por padrão, sua senha é seu **primeiro nome** (minúsculo) + os **4 últimos dígitos** do seu celular. Ex: <span className="font-bold">rafael4321</span>
                            </p>
                        </div>

                        <div className="text-center pt-2">
                            <p className="text-xs text-slate-400 font-medium">
                                Não tem uma conta?{" "}
                                <Link
                                    to="/paciente/cadastro"
                                    className="font-black text-indigo-600 hover:underline"
                                >
                                    Cadastre-se agora
                                </Link>
                            </p>
                        </div>

                        <p className="text-center text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] opacity-50 pt-4">
                            Sistema de Saúde MyHealthID • Digital Care
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default PatientLogin;
