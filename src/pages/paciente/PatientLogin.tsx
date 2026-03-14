import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Heart, Loader2, ArrowRight, Sparkles } from "lucide-react";

const PatientLogin = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { signIn, profile, user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        if (user && profile) {
            if (profile.role === 'patient') {
                navigate("/paciente/dashboard");
            } else {
                navigate("/");
            }
        }
    }, [user, profile, navigate]);

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
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-emerald-50 flex items-center justify-center p-4">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500" />

            <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-sm">
                <CardHeader className="space-y-1 text-center pb-8">
                    <div className="flex justify-center mb-4">
                        <div className="h-16 w-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg transform -rotate-6">
                            <Heart className="h-8 w-8 text-white" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-black tracking-tight text-slate-900">
                        Bem-vindo ao <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">MyID</span>
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium">
                        Sua jornada de saúde personalizada começa aqui.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="email">E-mail</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="seu@email.com"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-white/50 border-slate-200 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="password">Senha</Label>
                                <Link
                                    to="/recuperar-senha"
                                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                                >
                                    Esqueceu a senha?
                                </Link>
                            </div>
                            <Input
                                id="password"
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-white/50 border-slate-200 focus:ring-indigo-500"
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-bold h-12 rounded-xl transition-all shadow-md active:scale-[0.98]"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    Entrar no Portal <ArrowRight className="ml-2 h-5 w-5" />
                                </>
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4 pt-4 border-t border-slate-100">
                    <div className="text-sm text-center text-slate-600">
                        Não tem uma conta?{" "}
                        <Link
                            to="/paciente/cadastro"
                            className="font-black text-indigo-600 hover:underline underline-offset-4"
                        >
                            Cadastre-se agora
                        </Link>
                    </div>
                    <div className="flex items-center gap-2 justify-center py-2 opacity-50">
                        <Sparkles className="h-3 w-3 text-emerald-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Powered by Antigravity</span>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default PatientLogin;
