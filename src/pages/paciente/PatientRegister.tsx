import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Loader2, ArrowLeft, ShieldCheck } from "lucide-react";

const PatientRegister = () => {
    const [formData, setFormData] = useState({
        nome: "",
        email: "",
        password: "",
        confirmPassword: "",
        telefone: "",
        dataNascimento: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const { signUp } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData((prev) => ({ ...prev, [id]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            toast({
                variant: "destructive",
                title: "Senhas divergentes",
                description: "As senhas não coincidem. Por favor, verifique.",
            });
            return;
        }

        setIsLoading(true);

        try {
            // O role 'patient' é garantido pelo trigger on_auth_user_created que atualizamos na migração
            const { error } = await signUp(formData.email, formData.password, formData.nome);

            if (error) {
                toast({
                    variant: "destructive",
                    title: "Erro no cadastro",
                    description: error.message || "Não foi possível criar sua conta agora.",
                });
            } else {
                toast({
                    title: "Conta criada com sucesso!",
                    description: "Bem-vindo ao MyID. Redirecionando você...",
                });
                setTimeout(() => navigate("/paciente/dashboard"), 1500);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-lg border-none shadow-xl">
                <CardHeader className="space-y-1">
                    <Link to="/paciente/login" className="flex items-center text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors mb-4 group">
                        <ArrowLeft className="mr-1 h-3 w-3 group-hover:-translate-x-1 transition-transform" /> Voltar para o Login
                    </Link>
                    <CardTitle className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        Crie sua conta <UserPlus className="h-6 w-6 text-indigo-600" />
                    </CardTitle>
                    <CardDescription className="text-slate-500 font-medium italic">
                        Comece a cuidar da sua saúde de forma inteligente e gamificada.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="nome">Nome Completo</Label>
                                <Input
                                    id="nome"
                                    placeholder="Seu nome"
                                    required
                                    value={formData.nome}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">E-mail</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="seu@email.com"
                                    required
                                    value={formData.email}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="telefone">Telefone</Label>
                                <Input
                                    id="telefone"
                                    placeholder="(00) 00000-0000"
                                    value={formData.telefone}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="dataNascimento">Data de Nascimento</Label>
                                <Input
                                    id="dataNascimento"
                                    type="date"
                                    required
                                    value={formData.dataNascimento}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="password">Senha</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    required
                                    value={formData.password}
                                    onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    required
                                    value={formData.confirmPassword}
                                    onChange={handleInputChange}
                                />
                            </div>
                        </div>

                        <div className="bg-emerald-50 rounded-lg p-3 flex items-start gap-3 border border-emerald-100 mt-2">
                            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                            <p className="text-[11px] text-emerald-800 leading-tight">
                                Seus dados estão protegidos por criptografia de ponta a ponta e políticas de privacidade rigorosas.
                            </p>
                        </div>

                        <Button
                            type="submit"
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold h-12 rounded-xl mt-4"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                "Finalizar meu Cadastro"
                            )}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter>
                    <div className="text-xs text-center w-full text-slate-500">
                        Ao se cadastrar, você concorda com nossos{" "}
                        <Link to="/termos" className="font-bold underline">Termos de Uso</Link> e{" "}
                        <Link to="/privacidade" className="font-bold underline">Política de Privacidade</Link>.
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
};

export default PatientRegister;
