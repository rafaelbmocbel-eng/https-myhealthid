import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
    Calendar,
    ClipboardCheck,
    Trophy,
    CheckCircle2,
    TrendingUp,
    Bell,
    LogOut,
    User,
    Activity,
    Footprints,
    Moon,
    Zap,
    LayoutDashboard,
    Award,
    BookOpen,
    Watch,
    CreditCard,
    Menu,
    Clock,
    ExternalLink,
    Heart
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PatientDashboard = () => {
    const { profile, user, signOut } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await signOut();
        navigate("/paciente/login");
    };

    // 1. Buscar a próxima consulta
    const { data: nextAppointment, isLoading: loadingAppt } = useQuery({
        queryKey: ["patient-next-appointment", user?.id],
        queryFn: async () => {
            // Primeiro encontrar o ID do paciente na tabela legada pelo email
            const { data: pacienteData } = await supabase
                .from("pacientes")
                .select("id")
                .eq("email", user?.email)
                .maybeSingle();

            if (!pacienteData) return null;

            const { data } = await supabase
                .from("agendamentos")
                .select("*, profiles!agendamentos_terapeuta_id_fkey(nome, sobrenome, especialidade)")
                .eq("paciente_id", pacienteData.id)
                .gte("data_inicio", new Date().toISOString())
                .order("data_inicio", { ascending: true })
                .limit(1)
                .maybeSingle();

            return data;
        },
        enabled: !!user?.email
    });

    // 2. Buscar questionários pendentes
    const { data: pendingQuestionnaires, isLoading: loadingQuests } = useQuery({
        queryKey: ["patient-pending-questionnaires", user?.id],
        queryFn: async () => {
            const { data: paciente } = await supabase
                .from("pacientes")
                .select("id")
                .eq("user_id", user?.id)
                .single();
            if (!paciente) return [];
            const { data } = await supabase
                .from("myid_avaliacoes")
                .select("id, token_acesso, status")
                .eq("paciente_id", paciente.id)
                .eq("status", "pendente");
            return data || [];
        },
        enabled: !!user?.email
    });

    const menuItems = [
        { icon: LayoutDashboard, text: "Dashboard", path: "/paciente/dashboard", active: true },
        { icon: Calendar, text: "Minha Agenda", path: "/paciente/agenda" },
        { icon: ClipboardCheck, text: "Questionários", path: "/paciente/questionarios" },
        { icon: Award, text: "Atividades", path: "/paciente/atividades" },
        { icon: BookOpen, text: "Diário de Saúde", path: "/paciente/diario" },
        { icon: Watch, text: "Meu Dispositivo", path: "/paciente/dispositivo" },
        { icon: CreditCard, text: "Planos", path: "/paciente/planos" },
        { icon: User, text: "Perfil", path: "/paciente/perfil" },
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            {/* Sidebar Desktop */}
            <aside className="hidden lg:flex w-64 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
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

            {/* Main Content */}
            <main className="flex-1 lg:max-w-7xl mx-auto p-4 lg:p-8 space-y-8">
                {/* Header */}
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu className="h-6 w-6" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-lg shadow-md border-2 border-white">
                                {profile?.nome?.[0] || "P"}
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-slate-900 leading-none mb-1">Olá, {profile?.nome || "Paciente"}! 👋</h1>
                                <div className="flex items-center gap-2">
                                    <Badge variant="secondary" className="bg-indigo-100/50 text-indigo-700 text-[9px] font-black uppercase tracking-wider h-4 px-1.5 border-none">
                                        ⭐ {profile?.current_level || 'Iniciante'}
                                    </Badge>
                                    {profile?.plan && profile.plan !== 'free' && (
                                        <Badge className="bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-wider h-4 px-1.5 border-none">
                                            PRO
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-slate-200">
                            <Bell className="h-5 w-5 text-slate-600" />
                        </Button>
                    </div>
                </header>

                {/* Check-in Banner */}
                {nextAppointment && (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                <ClipboardCheck className="h-6 w-6 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-amber-950">📋 Faça seu check-in pré-consulta!</p>
                                <p className="text-xs text-amber-900/70 font-medium">Relate como você está se sentindo para o Dr. {(nextAppointment as any).profiles?.nome}.</p>
                            </div>
                        </div>
                        <Button className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md whitespace-nowrap px-6">
                            Check-in Agora
                        </Button>
                    </div>
                )}

                {/* Quick Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm bg-white hover:translate-y-[-2px] transition-transform">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-8 w-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                                    <Calendar className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Próxima Consulta</span>
                            </div>
                            {loadingAppt ? (
                                <div className="h-10 w-24 bg-slate-100 animate-pulse rounded" />
                            ) : nextAppointment ? (
                                <>
                                    <p className="text-lg font-black text-slate-900 leading-tight">
                                        {format(new Date(nextAppointment.data_inicio), "dd 'de' MMMM", { locale: ptBR })}
                                    </p>
                                    <p className="text-xs text-slate-500 font-medium truncate">
                                        às {format(new Date(nextAppointment.data_inicio), "HH:mm")} com Dr. {(nextAppointment as any).profiles?.nome}
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="text-lg font-black text-slate-300">Nenhuma</p>
                                    <p className="text-xs text-slate-400 font-medium">Agende sua sessão</p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white hover:translate-y-[-2px] transition-transform">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-8 w-8 bg-violet-50 text-violet-600 rounded-lg flex items-center justify-center">
                                    <ClipboardCheck className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avaliações</span>
                            </div>
                            {loadingQuests ? (
                                <div className="h-10 w-24 bg-slate-100 animate-pulse rounded" />
                            ) : (
                                <>
                                    <p className="text-lg font-black text-slate-900 leading-tight">{pendingQuestionnaires?.length || 0} Pendentes</p>
                                    <p className={cn("text-xs font-bold", (pendingQuestionnaires?.length || 0) > 0 ? "text-orange-500" : "text-emerald-500")}>
                                        {(pendingQuestionnaires?.length || 0) > 0 ? "Ação necessária" : "Tudo em dia!"}
                                    </p>
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white hover:translate-y-[-2px] transition-transform">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-8 w-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                                    <Trophy className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pontuação</span>
                            </div>
                            <p className="text-lg font-black text-slate-900 leading-tight">{profile?.total_points || 0} pts</p>
                            <p className="text-xs text-slate-500 font-medium">Bônus por diário: +5</p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white hover:translate-y-[-2px] transition-transform">
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <div className="h-8 w-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
                                    <CheckCircle2 className="h-5 w-5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Atividades</span>
                            </div>
                            <p className="text-lg font-black text-slate-900 leading-tight">0 / 0</p>
                            <p className="text-xs text-slate-500 font-medium">Nenhuma prescrita</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Smartwatch Row */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Dados do Dia (Smartwatch)</h2>
                        <Button variant="ghost" size="sm" className="text-indigo-600 font-bold hover:bg-indigo-50">Sincronizar <Watch className="ml-1.5 h-3 w-3" /></Button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-rose-500 flex items-center gap-4">
                            <div className="h-10 w-10 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600">
                                <Heart className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Freq. Cardíaca</p>
                                <p className="text-lg font-black text-slate-900">72 <span className="text-[10px] text-slate-400 uppercase">bpm</span></p>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-blue-500 flex items-center gap-4">
                            <div className="h-10 w-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                                <Footprints className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Passos</p>
                                <p className="text-lg font-black text-slate-900">4.520</p>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-indigo-500 flex items-center gap-4">
                            <div className="h-10 w-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                                <Moon className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Sono</p>
                                <p className="text-lg font-black text-slate-900">7.2 <span className="text-[10px] text-slate-400 uppercase">hrs</span></p>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow-sm border-l-4 border-orange-500 flex items-center gap-4">
                            <div className="h-10 w-10 bg-orange-50 rounded-xl flex items-center justify-center text-orange-600">
                                <Zap className="h-6 w-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">Calorias</p>
                                <p className="text-lg font-black text-slate-900">320 <span className="text-[10px] text-slate-400 uppercase">kcal</span></p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Content Tabs/Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-8">
                    {/* Minha Semana */}
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <CardHeader className="border-b border-slate-50 bg-slate-50/30">
                            <CardTitle className="text-base font-black flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-indigo-600" /> Minha Semana
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                            <div className="h-24 w-24 bg-indigo-50 rounded-full flex items-center justify-center">
                                <Activity className="h-10 w-10 text-indigo-200" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900">Acompanhe sua Evolução</h3>
                                <p className="text-xs text-slate-500 max-w-[240px] mt-1">Preencha seu Diário de Saúde para habilitar o gráfico de humor e dor.</p>
                            </div>
                            <Button variant="outline" className="font-bold text-indigo-600 border-indigo-100 hover:bg-indigo-50 rounded-xl" onClick={() => navigate("/paciente/diario")}>
                                Ir para o Diário
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Próximas Consultas */}
                    <Card className="border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-50 bg-slate-50/30">
                            <CardTitle className="text-base font-black flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-indigo-600" /> Próximas Consultas
                            </CardTitle>
                            <Button variant="ghost" size="sm" className="text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-3" onClick={() => navigate("/paciente/agenda")}>Ver agenda</Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-50">
                                {nextAppointment ? (
                                    <div className="flex gap-4 p-5 hover:bg-slate-50 transition-colors">
                                        <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex flex-col items-center justify-center text-indigo-700 shrink-0 border border-indigo-100 shadow-sm">
                                            <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{format(new Date(nextAppointment.data_inicio), "MMM", { locale: ptBR })}</span>
                                            <span className="text-xl font-black leading-none">{format(new Date(nextAppointment.data_inicio), "dd")}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 py-1">
                                            <h4 className="font-bold text-sm text-slate-900 truncate">Sessão Individual</h4>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                                                <User className="h-3 w-3" /> Dr. {(nextAppointment as any).profiles?.nome}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                                <Clock className="h-3 w-3" /> {format(new Date(nextAppointment.data_inicio), "HH:mm")}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end justify-center py-1">
                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-bold">Confirmado</Badge>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 mt-1 hover:text-indigo-600">
                                                <ExternalLink className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-12 text-center flex flex-col items-center gap-3">
                                        <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center">
                                            <Calendar className="h-8 w-8 text-slate-200" />
                                        </div>
                                        <p className="text-sm font-medium text-slate-400">Nenhum agendamento futuro encontrado.</p>
                                        <Button onClick={() => navigate("/paciente/agenda")} variant="link" className="text-indigo-600 font-bold">Agendar Agora</Button>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 lg:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                >
                    <div
                        className="w-72 h-full bg-white p-6 shadow-2xl animate-in slide-in-from-left duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-10 justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                                    <Activity className="h-5 w-5 text-white" />
                                </div>
                                <span className="text-xl font-black text-slate-900 tracking-tight">MyHealthID</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                                <Menu className="h-5 w-5" />
                            </Button>
                        </div>
                        <nav className="space-y-2">
                            {menuItems.map((item, i) => (
                                <button
                                    key={i}
                                    onClick={() => {
                                        navigate(item.path);
                                        setIsSidebarOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all",
                                        item.active
                                            ? "bg-indigo-50 text-indigo-600 shadow-sm shadow-indigo-100"
                                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.text}
                                </button>
                            ))}
                        </nav>
                        <div className="absolute bottom-6 left-6 right-6 pt-6 border-t border-slate-100">
                            <button
                                onClick={handleLogout}
                                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all text-left"
                            >
                                <LogOut className="h-5 w-5" />
                                Sair da conta
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PatientDashboard;
