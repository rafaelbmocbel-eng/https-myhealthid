import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Activity, Loader2, ArrowLeft, UserPlus, Phone, Calendar, Mail, ShieldCheck, Heart } from "lucide-react";

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
    const [searchParams] = useSearchParams();
    const professionalId = searchParams.get("professional_id") || searchParams.get("ref");
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
            const { error } = await signUp(formData.email, formData.password, formData.nome, 'patient', professionalId || undefined);

            if (error) {
                toast({
                    variant: "destructive",
                    title: "Erro no cadastro",
                    description: error.message || "Não foi possível criar sua conta agora.",
                });
            } else {
                toast({
                    title: "Conta criada com sucesso! 🚀",
                    description: "Bem-vindo ao MyID. Vamos começar!",
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
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center p-4 font-sans">
            <div className="max-w-xl w-full space-y-6">
                {/* Branding */}
                <div className="flex items-center justify-center gap-2 mb-4">
                    <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200/50">
                        <Activity className="h-5 w-5 text-white" />
                    </div>
                    <span className="text-xl font-black text-slate-900 tracking-tight">MyHealthID</span>
                </div>

                <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white/90 backdrop-blur-md">
                    <div className="bg-gradient-to-tr from-indigo-600 to-violet-600 p-6 text-white text-center relative overflow-hidden">
                        {/* Decorative Background Element */}
                        <div className="absolute top-0 right-0 -mr-10 -mt-10 h-40 w-40 bg-white/10 rounded-full blur-3xl" />

                        <Link to="/paciente/login" className="absolute left-6 top-6 flex items-center text-[10px] font-black uppercase tracking-tighter text-white/70 hover:text-white transition-colors group">
                            <ArrowLeft className="mr-1 h-3.5 w-3.5 group-hover:-translate-x-1 transition-transform" /> Voltar
                        </Link>

                        <div className="h-16 w-16 rounded-2xl bg-white/20 border-2 border-white/30 flex items-center justify-center mx-auto mb-3 shadow-inner">
                            <UserPlus className="h-8 w-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-black mb-1 leading-tight">Nova Conta MyID</h1>
                        <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">
                            Saúde Inteligente e Gamificada
                        </p>
                    </div>

                    <CardContent className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nome Completo</Label>
                                    <Input
                                        id="nome"
                                        placeholder="Seu nome"
                                        className="rounded-xl border-slate-200 py-6 focus:ring-indigo-500"
                                        required
                                        value={formData.nome}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Seu Melhor E-mail</Label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input
                                            id="email"
                                            type="email"
                                            placeholder="seu@email.com"
                                            className="rounded-xl border-slate-200 pl-11 py-6 focus:ring-indigo-500"
                                            required
                                            value={formData.email}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">WhatsApp / Telefone</Label>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input
                                            id="telefone"
                                            placeholder="(00) 00000-0000"
                                            className="rounded-xl border-slate-200 pl-11 py-6 focus:ring-indigo-500"
                                            value={formData.telefone}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nascimento</Label>
                                    <div className="relative">
                                        <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                        <Input
                                            id="dataNascimento"
                                            type="date"
                                            className="rounded-xl border-slate-200 pl-11 py-6 focus:ring-indigo-500"
                                            required
                                            value={formData.dataNascimento}
                                            onChange={handleInputChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100 flex-grow">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Criar Senha</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder="Min. 6 caracteres"
                                        className="rounded-xl border-slate-200 py-6 focus:ring-indigo-500"
                                        required
                                        value={formData.password}
                                        onChange={handleInputChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-400 ml-1">Confirmar Senha</Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="Repita a senha"
                                        className="rounded-xl border-slate-200 py-6 focus:ring-indigo-500"
                                        required
                                        value={formData.confirmPassword}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-start gap-4 shadow-sm">
                                <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                </div>
                                <p className="text-[10px] text-emerald-800 font-medium leading-relaxed">
                                    Seus dados estão protegidos por criptografia de ponta a ponta e políticas de privacidade rigorosas da rede MyID.
                                </p>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-black text-white font-black rounded-2xl py-8 shadow-xl shadow-indigo-200 transition-all flex items-center justify-center gap-2 text-lg active:scale-95 mt-2"
                                disabled={isLoading}
                            >
                                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <>Finalizar meu Cadastro <Activity className="h-5 w-5" /></>}
                            </Button>

                            <div className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
                                Ao se cadastrar, você concorda com nossos{" "}
                                <Link to="/termos" className="text-indigo-600 hover:underline">Termos de Uso</Link> e{" "}
                                <Link to="/privacidade" className="text-indigo-600 hover:underline">Políticas</Link>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Patient Portal Link Helper */}
                <div className="flex items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
                    <Heart className="h-4 w-4 text-red-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-tighter text-slate-500">
                        Cuidando da sua saúde de forma integrada
                    </span>
                </div>
            </div>
        </div>
    );
};

export default PatientRegister;
