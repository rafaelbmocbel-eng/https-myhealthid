import { useAuth } from "@/contexts/AuthContext";
import {
    CreditCard,
    CheckCircle2,
    Zap,
    Star,
    Crown,
    Info,
    ArrowRight,
    Sparkles,
    ShieldCheck,
    Gem
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientPlans = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const plans = [
        {
            name: "Smart Básico",
            price: "R$ 0",
            description: "A porta de entrada para sua melhor versão biológica.",
            features: [
                "Dashboard de Performance",
                "Gestão de Agendamentos",
                "Questionários MyID",
                "Diário de Saúde Digital",
            ],
            icon: Zap,
            color: "text-slate-400",
            bg: "bg-slate-50",
            current: profile?.plan === "basic" || !profile?.plan
        },
        {
            name: "Smart Pro",
            price: "R$ 49,90",
            description: "Insights biocomportamentais profundos e precisão.",
            features: [
                "Todos os recursos Básico",
                "Sincronização de Wearables",
                "Atividades Prescritas",
                "Gamificação & Ranking Pro",
                "Relatórios de Evolução"
            ],
            icon: Star,
            color: "text-indigo-600",
            bg: "bg-indigo-50",
            popular: true,
            current: profile?.plan === "pro"
        },
        {
            name: "Smart Diamond",
            price: "R$ 149,90",
            description: "O ápice do acompanhamento clínico personalizado.",
            features: [
                "Experiência Pro Completa",
                "Suporte Prioritário 24/7",
                "Análise MyID Bioestatística",
                "Check-ins Ilimitados",
                "Integração Bluetooth Direta"
            ],
            icon: Gem,
            color: "text-amber-500",
            bg: "bg-amber-50",
            current: profile?.plan === "diamond"
        }
    ];

    return (
        <PatientLayout>
            <div className="max-w-6xl mx-auto space-y-12 pb-20">
                <header className="flex flex-col items-center text-center space-y-6 pt-10">
                    <div className="inline-flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100 shadow-sm animate-fade-in">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] leading-none">Upgrade de Performance</span>
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-black text-slate-900 leading-tight tracking-tighter max-w-3xl italic uppercase">
                        Sua evolução biológica <br /> começa com a escolha certa.
                    </h1>
                    <p className="text-slate-500 text-lg font-medium max-w-2xl leading-relaxed">
                        Selecione o nível de suporte que sua saúde merece. De dados básicos a insights de alta performance.
                    </p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-10 pt-10">
                    {plans.map((plan, i) => (
                        <Card
                            key={i}
                            className={cn(
                                "border-none shadow-2xl flex flex-col items-stretch overflow-hidden relative transition-all duration-500 group rounded-[3rem] border-2",
                                plan.popular
                                    ? "bg-white scale-105 z-10 border-indigo-600/20 shadow-indigo-200/50"
                                    : "bg-white border-transparent hover:border-slate-100 hover:-translate-y-2"
                            )}
                        >
                            {plan.popular && (
                                <div className="absolute top-0 right-0 p-0 m-0 overflow-hidden h-32 w-32">
                                    <div className="bg-indigo-600 text-white text-[9px] font-black uppercase px-12 py-2 rotate-45 transform translate-x-8 translate-y-4 shadow-xl tracking-widest text-center">
                                        Recomendado
                                    </div>
                                </div>
                            )}

                            <CardHeader className="p-10 space-y-4 pb-0">
                                <div className={cn("h-16 w-16 rounded-[1.5rem] flex items-center justify-center mb-4 transition-transform group-hover:rotate-12 group-hover:scale-110 shadow-inner", plan.bg)}>
                                    <plan.icon className={cn("h-8 w-8", plan.color)} />
                                </div>
                                <CardTitle className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">{plan.name}</CardTitle>
                                <CardDescription className="text-slate-400 font-medium leading-relaxed min-h-[48px]">{plan.description}</CardDescription>
                            </CardHeader>

                            <CardContent className="p-10 flex-1 space-y-10">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-black text-slate-900 tracking-tighter">{plan.price}</span>
                                    <span className="text-slate-300 font-black text-[10px] uppercase tracking-widest">/ mensal</span>
                                </div>

                                <div className="space-y-4">
                                    {plan.features.map((feature, j) => (
                                        <div key={j} className="flex items-start gap-4 text-xs font-black text-slate-600 uppercase tracking-tight group/item">
                                            <div className="h-5 w-5 rounded-full bg-slate-50 flex items-center justify-center shrink-0 border border-slate-100 group-hover/item:border-emerald-200 transition-colors">
                                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            </div>
                                            <span className="pt-0.5">{feature}</span>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>

                            <CardFooter className="p-10 pt-0">
                                <Button
                                    className={cn(
                                        "w-full h-16 rounded-[2rem] font-black text-sm uppercase italic tracking-widest shadow-2xl transition-all active:scale-95",
                                        plan.current
                                            ? "bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-default border border-slate-200"
                                            : plan.popular
                                                ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-300/40"
                                                : "bg-slate-900 text-white hover:bg-black"
                                    )}
                                    disabled={plan.current}
                                    onClick={() => !plan.current && navigate("/paciente/financeiro")}
                                >
                                    {plan.current ? (
                                        <span className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Ativo agora</span>
                                    ) : (
                                        <span className="flex items-center gap-2">Fazer Upgrade <ArrowRight className="h-5 w-5" /></span>
                                    )}
                                </Button>
                            </CardFooter>
                        </Card>
                    ))}
                </div>

                {/* Trust / Security */}
                <div className="flex flex-col md:flex-row items-center justify-center gap-12 pt-10 border-t border-slate-100 mt-20 opacity-40 grayscale group hover:opacity-100 hover:grayscale-0 transition-all duration-500">
                    <div className="flex items-center gap-4 group/trust">
                        <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner group-hover/trust:border-indigo-200 transition-colors">
                            <CreditCard className="h-6 w-6 text-slate-400 group-hover/trust:text-indigo-600" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Pagamento Seguro</p>
                            <p className="text-[9px] font-medium text-slate-500">Checkout Stripe Criptografado</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 group/trust">
                        <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner group-hover/trust:border-emerald-200 transition-colors">
                            <ShieldCheck className="h-6 w-6 text-slate-400 group-hover/trust:text-emerald-600" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Cancelamento Livre</p>
                            <p className="text-[9px] font-medium text-slate-500">Sem carência ou multas rescisórias</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 group/trust">
                        <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-100 shadow-inner group-hover/trust:border-amber-200 transition-colors">
                            <Info className="h-6 w-6 text-slate-400 group-hover/trust:text-amber-600" />
                        </div>
                        <div className="space-y-0.5">
                            <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">Dúvidas Frequentes</p>
                            <p className="text-[9px] font-medium text-slate-500">Fale com nosso suporte VIP</p>
                        </div>
                    </div>
                </div>
            </div>
        </PatientLayout>
    );
};

export default PatientPlans;
