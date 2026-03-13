import { useAuth } from "@/contexts/AuthContext";
import {
    Award,
    Trophy,
    Zap,
    CheckCircle2,
    Clock,
    TrendingUp,
    Activity,
    Star,
    ChevronRight,
    Target,
    BarChart3
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import PatientLayout from "@/components/paciente/PatientLayout";

interface ActivityItem {
  id: number;
  title: string;
  category: string;
  icon: typeof Zap;
  points: number;
  completed: boolean;
  time: string;
}

const PatientActivities = () => {
    const { profile } = useAuth();

    const activities: ActivityItem[] = [
        { id: 1, title: "Mobilidade de Quadril", category: "Fisioterapia", icon: Zap, points: 20, completed: false, time: "10 min" },
        { id: 2, title: "Caminhada Leve", category: "Cardio", icon: Activity, points: 15, completed: true, time: "20 min" },
        { id: 3, title: "Beber 2L de Água", category: "Hábito", icon: Target, points: 10, completed: false, time: "Diário" },
    ];

    const badges = [
        { name: "Iniciante MyID", icon: Star, color: "text-amber-500", bg: "bg-amber-100" },
        { name: "Sempre Pontual", icon: Clock, color: "text-blue-500", bg: "bg-blue-100" },
        { name: "Foco Total", icon: Target, color: "text-rose-500", bg: "bg-rose-100" },
    ];

    return (
        <PatientLayout>
            <div className="max-w-5xl mx-auto space-y-10">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-slate-900 italic uppercase leading-none tracking-tight">Missões & Ranking</h1>
                    <p className="text-slate-500 font-medium">Complete suas atividades diárias, acumule XP e desbloqueie novas conquistas.</p>
                </div>

                {/* Level Card */}
                <Card className="border-none shadow-2xl bg-slate-900 text-white overflow-hidden rounded-[2.5rem] relative group border border-slate-800">
                    <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:rotate-12 group-hover:scale-125 transition-all duration-700">
                        <Trophy size={140} />
                    </div>
                    <CardContent className="p-10 relative z-10">
                        <div className="flex flex-col lg:flex-row items-center justify-between gap-10">
                            <div className="space-y-6 text-center lg:text-left flex-1">
                                <div className="space-y-2">
                                    <Badge className="bg-indigo-500 text-white hover:bg-indigo-500 border-none font-black text-[10px] uppercase tracking-[0.2em] px-4 py-1 rounded-full shadow-lg shadow-indigo-500/20">
                                        Nível Iniciante
                                    </Badge>
                                    <h2 className="text-4xl font-black italic tracking-tighter leading-none">A caminho da Maestria!</h2>
                                </div>
                                <div className="max-w-md space-y-3">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-400">
                                        <span>0 XP Acumulados</span>
                                        <span className="text-indigo-400">Próximo Nível: 1000 XP</span>
                                    </div>
                                    <div className="relative h-4 bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
                                        <div
                                            className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full transition-all duration-1000"
                                            style={{ width: '0%' }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-6 shrink-0">
                                <div className="text-center group/stat">
                                    <div className="h-20 w-20 bg-white/10 rounded-[1.5rem] flex items-center justify-center mb-3 border border-white/10 shadow-lg group-hover/stat:bg-white/20 transition-colors">
                                        <Zap className="h-10 w-10 text-amber-400" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Ofensiva</span>
                                    <p className="font-black text-2xl leading-none tracking-tighter">3 DIAS</p>
                                </div>
                                <div className="text-center group/stat">
                                    <div className="h-20 w-20 bg-white/10 rounded-[1.5rem] flex items-center justify-center mb-3 border border-white/10 shadow-lg group-hover/stat:bg-white/20 transition-colors">
                                        <Trophy className="h-10 w-10 text-indigo-400" />
                                    </div>
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Badges</span>
                                    <p className="font-black text-2xl leading-none tracking-tighter">{badges.length}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase italic">Missões Ativas</h2>
                        </div>

                        <div className="grid gap-6">
                            {activities.map(activity => (
                                <Card key={activity.id} className={cn(
                                    "border-none shadow-xl transition-all overflow-hidden group rounded-[2.5rem] border border-slate-100",
                                    activity.completed ? "bg-slate-50/50 opacity-70" : "bg-white hover:border-indigo-100 hover:shadow-2xl"
                                )}>
                                    <CardContent className="p-0">
                                        <div className="flex flex-col sm:flex-row items-stretch">
                                            <div className={cn(
                                                "w-20 sm:w-24 flex items-center justify-center shrink-0 border-r border-slate-50 transition-colors",
                                                activity.completed ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white"
                                            )}>
                                                <activity.icon className="h-8 w-8" />
                                            </div>
                                            <div className="p-8 flex-1 flex flex-col sm:flex-row items-center justify-between gap-6">
                                                <div className="text-center sm:text-left space-y-2">
                                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest px-2 border-slate-200 text-slate-400">
                                                        {activity.category}
                                                    </Badge>
                                                    <h4 className={cn("text-xl font-black text-slate-900 leading-tight uppercase italic", activity.completed && "line-through decoration-emerald-500/30 text-slate-400")}>
                                                        {activity.title}
                                                    </h4>
                                                    <div className="flex items-center justify-center sm:justify-start gap-4">
                                                        <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {activity.time}</span>
                                                        <span className="text-[10px] font-black text-indigo-500 uppercase flex items-center gap-1.5"><Star className="h-3.5 w-3.5 fill-indigo-50" /> +{activity.points} XP</span>
                                                    </div>
                                                </div>
                                                <Button
                                                    size="lg"
                                                    variant={activity.completed ? "secondary" : "default"}
                                                    className={cn(
                                                        "rounded-2xl font-black text-[10px] uppercase tracking-widest px-8 shadow-lg active:scale-95 transition-all h-12",
                                                        activity.completed
                                                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 cursor-default"
                                                            : "bg-slate-900 text-white hover:bg-black"
                                                    )}
                                                >
                                                    {activity.completed ? <CheckCircle2 className="h-5 w-5 mr-2" /> : null}
                                                    {activity.completed ? "Missão Concluída" : "Concluir Missão"}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="bg-indigo-50/50 rounded-[2.5rem] p-10 border-4 border-dashed border-indigo-100/50 flex flex-col items-center text-center gap-4">
                            <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center shadow-lg">
                                <TrendingUp className="h-8 w-8 text-indigo-600" />
                            </div>
                            <div className="space-y-1">
                                <h4 className="font-black text-indigo-900 text-lg uppercase italic leading-none">Novos Desafios Estão Chegando</h4>
                                <p className="text-sm text-indigo-700/60 max-w-sm font-medium">Seu mentor MyHealthID está analisando seus dados para criar missões personalizadas.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-10">
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                    <Award className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Conquistas</h2>
                            </div>
                            <div className="grid gap-4">
                                {badges.map((badge, i) => (
                                    <div key={i} className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-50 flex items-center gap-5 group hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer">
                                        <div className={cn("h-16 w-16 rounded-[1.5rem] flex items-center justify-center shrink-0 shadow-inner transition-transform group-hover:rotate-12 group-hover:scale-110", badge.bg)}>
                                            <badge.icon className={cn("h-8 w-8", badge.color)} />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="font-black text-slate-900 text-sm uppercase italic leading-none group-hover:text-indigo-600 transition-colors">{badge.name}</p>
                                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Desbloqueado em Jan/26</p>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="ghost" className="w-full text-[10px] font-black uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 rounded-2xl py-8 h-auto border-2 border-dashed border-indigo-100/50 flex flex-col gap-2">
                                    <span>Ver Galeria de Troféus</span>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </section>

                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                    <BarChart3 className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Top Performance</h2>
                            </div>
                            <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem] border border-slate-50">
                                <CardContent className="p-0">
                                    <div className="divide-y divide-slate-50">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className={cn("flex items-center justify-between p-6 transition-colors", i === 1 ? "bg-amber-50/30" : "hover:bg-slate-50/50")}>
                                                <div className="flex items-center gap-4">
                                                    <span className={cn("text-2xl font-black w-6 text-center italic leading-none", i === 1 ? "text-amber-500" : "text-slate-200")}>{i}</span>
                                                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center font-black text-sm", i === 1 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500")}>
                                                        {i === 1 ? (profile?.nome?.[0] || "?") : String.fromCharCode(64 + i)}
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-sm text-slate-900 leading-none">{i === 1 ? (profile?.nome || "Você") : `Participante ${i}`}</p>
                                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{i === 1 ? "Você" : "Comunidade"}</p>
                                                    </div>
                                                </div>
                                                <span className={cn("font-black text-sm", i === 1 ? "text-amber-600" : "text-slate-400")}>{(4 - i) * 120} XP</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    </div>
                </div>
            </div>
        </PatientLayout>
    );
};

export default PatientActivities;
