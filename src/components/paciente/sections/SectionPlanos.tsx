import { useAuth } from "@/contexts/AuthContext";
import {
  CreditCard, CheckCircle2, Zap, Star, Crown, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function SectionPlanos() {
  const { profile } = useAuth();

  const plans = [
    {
      name: "Smart Básico", price: "R$ 0", description: "Ideal para quem está começando sua jornada de saúde.",
      features: ["Acesso ao Dashboard", "Minha Agenda", "Questionários MyID (Limitado)", "Diário de Saúde"],
      icon: Zap, color: "text-slate-400", bg: "bg-slate-50", current: !profile?.plan || profile?.plan === "basic",
    },
    {
      name: "Smart Pro", price: "R$ 49,90", description: "Para quem quer insights profundos e acompanhamento.",
      features: ["Todos do Básico", "Integração de Wearables", "Atividades Prescritas", "Ranking e Badges Pro", "Relatórios Mensais"],
      icon: Star, color: "text-indigo-600", bg: "bg-indigo-50", popular: true, current: profile?.plan === "pro",
    },
    {
      name: "Smart Diamond", price: "R$ 149,90", description: "Experiência VIP completa com seu profissional.",
      features: ["Todos do Pro", "Suporte Prioritário", "Análise Bioestatística MyID", "Check-ins Semanais Ilimitados", "Integração Bluetooth Direta"],
      icon: Crown, color: "text-amber-500", bg: "bg-amber-50", current: profile?.plan === "diamond",
    },
  ];

  return (
    <div className="lg:max-w-6xl mx-auto space-y-10">
      <header className="flex flex-col items-center text-center space-y-4 pt-6">
        <Badge className="bg-indigo-50 text-indigo-600 border-none px-4 py-1 font-black text-[10px] uppercase tracking-widest leading-none">Planos Smart MyHealth</Badge>
        <h1 className="text-4xl lg:text-5xl font-black text-slate-900 leading-tight tracking-tighter max-w-2xl italic">A biologia evolui, e o seu plano também.</h1>
        <p className="text-slate-500 text-lg font-medium max-w-xl">Escolha a experiência ideal para potencializar seus resultados.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {plans.map((plan, i) => (
          <Card key={i} className={cn("border-none shadow-sm flex flex-col overflow-hidden relative transition-all duration-300 hover:shadow-2xl hover:-translate-y-2", plan.popular ? "bg-white scale-105 z-10 ring-4 ring-indigo-500/10" : "bg-white")}>
            {plan.popular && (
              <div className="absolute top-0 right-0"><div className="bg-indigo-600 text-white text-[10px] font-black uppercase px-6 py-2 rotate-45 transform translate-x-4 shadow-lg">Popular</div></div>
            )}
            <CardHeader className="p-8 space-y-2">
              <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center mb-4", plan.bg)}><plan.icon className={cn("h-6 w-6", plan.color)} /></div>
              <CardTitle className="text-2xl font-black text-slate-900 tracking-tight">{plan.name}</CardTitle>
              <CardDescription className="text-slate-500 font-medium leading-relaxed">{plan.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-8 flex-1 space-y-6">
              <div className="flex items-baseline gap-1"><span className="text-4xl font-black text-slate-900">{plan.price}</span><span className="text-slate-400 font-bold text-sm">/mês</span></div>
              <div className="space-y-3">
                {plan.features.map((f, j) => (
                  <div key={j} className="flex items-start gap-3 text-sm font-bold text-slate-600"><CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />{f}</div>
                ))}
              </div>
            </CardContent>
            <CardFooter className="p-8 pt-0">
              <Button className={cn("w-full h-14 rounded-2xl font-black text-lg shadow-xl transition-all", plan.current ? "bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-default" : plan.popular ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200" : "bg-slate-900 text-white hover:bg-slate-800")} disabled={plan.current}>
                {plan.current ? "Seu plano atual" : "Selecionar Plano"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <div className="flex flex-col md:flex-row items-center justify-center gap-10 opacity-60">
        <div className="flex items-center gap-3 text-slate-500"><CreditCard className="h-6 w-6" /><span className="text-xs font-bold uppercase tracking-widest">Pagamento Seguro</span></div>
        <div className="flex items-center gap-3 text-slate-500"><Info className="h-6 w-6" /><span className="text-xs font-bold uppercase tracking-widest">Cancele quando quiser</span></div>
      </div>
    </div>
  );
}
