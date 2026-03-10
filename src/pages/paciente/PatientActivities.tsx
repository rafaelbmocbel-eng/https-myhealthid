import { useAuth } from "@/contexts/AuthContext";
import {
    Award,
    Trophy,
    Zap,
    CheckCircle2,
    Clock,
    TrendingUp,
    Menu,
    Activity,
    LayoutDashboard,
    Calendar,
    ClipboardCheck,
    BookOpen,
    Watch,
    CreditCard,
    User,
    LogOut,
    Star,
    ChevronRight,
    Target
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const PatientActivities = () => {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await signOut();
        navigate("/paciente/login");
    };

    const menuItems = [
        { icon: LayoutDashboard, text: "Dashboard", path: "/paciente/dashboard" },
        { icon: Calendar, text: "Minha Agenda", path: "/paciente/agenda" },
        { icon: ClipboardCheck, text: "Questionários", path: "/paciente/questionarios" },
        { icon: Award, text: "Atividades", path: "/paciente/atividades", active: true },
        { icon: BookOpen, text: "Diário de Saúde", path: "/paciente/diario" },
        { icon: Watch, text: "Meu Dispositivo", path: "/paciente/dispositivo" },
        { icon: CreditCard, text: "Planos", path: "/paciente/planos" },
        { icon: User, text: "Perfil", path: "/paciente/perfil" },
    ];

    // Dados simulados para Etapa 6
    const activities = [
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
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar Desktop */}
            <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8" onClick={() => navigate("/paciente/dashboard")} style={{ cursor: 'pointer' }}>
                        <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200/50">
                            <Activity className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-xl font-black text-slate-900 tracking-tight">MyHealthID</span>
                    </div>
                    <nav className="space-y-1">
                        {menuItems.map((item, i) => (
                            <button
                                key={i}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all",
                                    item.active
                                        ? "bg-indigo-50 text-indigo-600"
                                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                )}
                            >
                                <item.icon className="h-5 w-5" />
                                {item.text}
                            </button>
                        ))}
                    </nav>
                </div>
                <div className="mt-auto p-6 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all text-left"
                    >
                        <LogOut className="h-5 w-5" />
                        Sair da conta
                    </button>
                </div>
            </aside>

            <main className="flex-1 lg:max-w-5xl mx-auto p-4 lg:p-8 space-y-8 pb-12">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
                            <Menu className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900 leading-tight">Missões & Ranking</h1>
                            <p className="text-slate-500 text-sm font-medium">Complete suas atividades diárias e suba de nível.</p>
                        </div>
                    </div>
                </header>

                {/* Level Card */}
                <Card className="border-none shadow-sm bg-slate-900 text-white overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 transform scale-150">
                        <Trophy className="h-24 w-24" />
                    </div>
                    <CardContent className="p-8 relative z-10">
                        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                            <div className="space-y-4 text-center md:text-left">
                                <div className="space-y-1">
                                    <Badge className="bg-indigo-500 text-white hover:bg-indigo-500 border-none font-black text-[10px] uppercase tracking-widest px-3 h-6">
                                        Nível {profile?.current_level || 'Iniciante'}
                                    </Badge>
                                    <h2 className="text-3xl font-black italic tracking-tighter">Em busca do próximo nível!</h2>
                                </div>
                                <div className="max-w-md space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-slate-400">
                                        <span>{profile?.total_points || 0} XP</span>
                                        <span>1000 XP para elevar a barra</span>
                                    </div>
                                    <Progress value={((profile?.total_points || 0) / 1000) * 100} className="h-3 bg-white/10" />
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="text-center">
                                    <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center mb-2 border border-white/10 shadow-lg">
                                        <Zap className="h-8 w-8 text-amber-400" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Fogo Social</span>
                                    <p className="font-black text-xl leading-none">3 Dias</p>
                                </div>
                                <div className="text-center">
                                    <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center mb-2 border border-white/10 shadow-lg">
                                        <Trophy className="h-8 w-8 text-indigo-400" />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Badges</span>
                                    <p className="font-black text-xl leading-none">{badges.length}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Atividades Prescritas */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                            <h2 className="text-lg font-black text-slate-900 leading-none">Minhas Missões</h2>
                        </div>

                        <div className="grid gap-4">
                            {activities.map(activity => (
                                <Card key={activity.id} className={cn(
                                    "border-none shadow-sm transition-all overflow-hidden group items-center",
                                    activity.completed ? "bg-white/60 opacity-80" : "bg-white hover:translate-x-1"
                                )}>
                                    <CardContent className="p-0">
                                        <div className="flex items-stretch">
                                            <div className={cn(
                                                "w-16 flex items-center justify-center shrink-0",
                                                activity.completed ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                                            )}>
                                                <activity.icon className="h-6 w-6" />
                                            </div>
                                            <div className="p-5 flex-1 flex items-center justify-between gap-4">
                                                <div className="min-w-0">
                                                    <Badge variant="outline" className="text-[9px] font-black uppercase tracking-tighter mb-1 h-4 border-slate-200 text-slate-400">
                                                        {activity.category}
                                                    </Badge>
                                                    <h4 className={cn("font-black text-slate-900 leading-tight truncate", activity.completed && "line-through decoration-emerald-500/50")}>
                                                        {activity.title}
                                                    </h4>
                                                    <p className="text-[10px] font-bold text-slate-400 mt-0.5">{activity.time} • +{activity.points} pts</p>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant={activity.completed ? "secondary" : "default"}
                                                    className={cn(
                                                        "rounded-xl font-black text-xs px-5 shadow-sm",
                                                        activity.completed
                                                            ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 cursor-default"
                                                            : "bg-slate-900 text-white hover:bg-slate-800"
                                                    )}
                                                >
                                                    {activity.completed ? <CheckCircle2 className="h-4 w-4" /> : "Marcar como feito"}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="bg-indigo-50/50 rounded-2xl p-6 border-2 border-dashed border-indigo-100/50 flex flex-col items-center text-center gap-2">
                            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center mb-2">
                                <TrendingUp className="h-6 w-6 text-indigo-600" />
                            </div>
                            <h4 className="font-bold text-indigo-900 text-sm">Mais atividades em breve</h4>
                            <p className="text-xs text-indigo-700/60 max-w-[280px]">Seu profissional de saúde pode prescrever novos exercícios para você subir de nível!</p>
                        </div>
                    </div>

                    {/* Ranking & Badges */}
                    <div className="space-y-8">
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Award className="h-5 w-5 text-indigo-600" />
                                <h2 className="text-lg font-black text-slate-900 leading-none">Conquistas</h2>
                            </div>
                            <div className="grid grid-cols-1 gap-3">
                                {badges.map((badge, i) => (
                                    <div key={i} className="bg-white p-3 rounded-2xl shadow-sm flex items-center gap-4 group hover:shadow-md transition-shadow cursor-pointer">
                                        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-110", badge.bg)}>
                                            <badge.icon className={cn("h-6 w-6", badge.color)} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-black text-slate-900 text-sm tracking-tight truncate leading-none mb-1">{badge.name}</p>
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Desbloqueado em Jan/26</p>
                                        </div>
                                    </div>
                                ))}
                                <Button variant="ghost" className="w-full text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-xl py-6 h-auto border border-dashed border-indigo-100">
                                    Ver Galeria de Troféus <ChevronRight className="ml-1 h-3 w-3" />
                                </Button>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <RankingIcon className="h-5 w-5 text-indigo-600" />
                                <h2 className="text-lg font-black text-slate-900 leading-none">Top do Mês</h2>
                            </div>
                            <Card className="border-none shadow-sm bg-white overflow-hidden">
                                <CardContent className="p-0">
                                    <div className="divide-y divide-slate-50">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className={cn("flex items-center justify-between p-4", i === 1 && "bg-amber-50/50")}>
                                                <div className="flex items-center gap-3">
                                                    <span className={cn("text-lg font-black w-4", i === 1 ? "text-amber-500" : "text-slate-300")}>{i}</span>
                                                    <div className="h-8 w-8 rounded-full bg-slate-200 border-2 border-white" />
                                                    <span className="text-sm font-bold text-slate-700">{i === 1 ? "Você" : `Usuário ${i}`}</span>
                                                </div>
                                                <span className="text-sm font-black text-slate-900">{2000 - i * 300} XP</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    </div>
                </div>
            </main>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden" onClick={() => setIsSidebarOpen(false)}>
                    <div className="w-72 h-full bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-2 mb-10 justify-between">
                            <div className="flex items-center gap-2" onClick={() => { navigate("/paciente/dashboard"); setIsSidebarOpen(false); }} style={{ cursor: 'pointer' }}>
                                <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white"><Activity className="h-5 w-5" /></div>
                                <span className="text-xl font-black text-slate-900 tracking-tight">MyHealthID</span>
                            </div>
                        </div>
                        <nav className="space-y-2">
                            {menuItems.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => { navigate(item.path); setIsSidebarOpen(false); }}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all",
                                        item.active ? "bg-indigo-50 text-indigo-600 shadow-sm" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.text}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>
            )}
        </div>
    );
};

// Componente simples para ícone de ranking já que não encontrei um oficial lucide imediato compatível com o nome
const RankingIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="m21 16-4 4-4-4" />
        <path d="M17 20V4" />
        <path d="m3 8 4-4 4 4" />
        <path d="M7 4v16" />
    </svg>
);

export default PatientActivities;
