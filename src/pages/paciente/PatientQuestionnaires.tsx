import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
    ClipboardCheck,
    CheckCircle2,
    Clock,
    ArrowRight,
    AlertCircle,
    Menu,
    Activity,
    LayoutDashboard,
    Calendar,
    Award,
    BookOpen,
    Watch,
    CreditCard,
    User,
    LogOut,
    Sparkles,
    FileText
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PatientQuestionnaires = () => {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const handleLogout = async () => {
        await signOut();
        navigate("/paciente/login");
    };

    const { data: assessments, isLoading } = useQuery({
        queryKey: ["patient-assessments", user?.email],
        queryFn: async () => {
            // 1. Buscar ID do paciente na tabela legada
            const { data: pacienteData } = await supabase
                .from("pacientes")
                .select("id")
                .eq("email", user?.email)
                .maybeSingle();

            if (!pacienteData) return [];

            // 2. Buscar avaliações vinculadas a esse paciente
            const { data } = await supabase
                .from("myid_avaliacoes")
                .select("*")
                .eq("paciente_id", pacienteData.id)
                .order("created_at", { ascending: false });

            return data || [];
        },
        enabled: !!user?.email
    });

    const menuItems = [
        { icon: LayoutDashboard, text: "Dashboard", path: "/paciente/dashboard" },
        { icon: Calendar, text: "Minha Agenda", path: "/paciente/agenda" },
        { icon: ClipboardCheck, text: "Questionários", path: "/paciente/questionarios", active: true },
        { icon: Award, text: "Atividades", path: "/paciente/atividades" },
        { icon: BookOpen, text: "Diário de Saúde", path: "/paciente/diario" },
        { icon: Watch, text: "Meu Dispositivo", path: "/paciente/dispositivo" },
        { icon: CreditCard, text: "Planos", path: "/paciente/planos" },
        { icon: User, text: "Perfil", path: "/paciente/perfil" },
    ];

    const pending = assessments?.filter(a => a.status === 'pendente') || [];
    const completed = assessments?.filter(a => a.status === 'concluido') || [];

    return (
        <div className="min-h-screen bg-slate-50 flex">
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

            <main className="flex-1 lg:max-w-4xl mx-auto p-4 lg:p-8 space-y-8">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
                            <Menu className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Questionários</h1>
                            <p className="text-slate-500 text-sm font-medium">Avalie seu estado atual e receba insights personalizados.</p>
                        </div>
                    </div>
                </header>

                {isLoading ? (
                    <div className="grid gap-4">
                        {[1, 2].map(i => <div key={i} className="h-32 bg-white rounded-2xl animate-pulse shadow-sm" />)}
                    </div>
                ) : (
                    <div className="space-y-8">
                        <section className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="h-5 w-5 text-orange-500" />
                                    <h2 className="text-lg font-black text-slate-900">Pendentes ({pending.length})</h2>
                                </div>
                                {pending.length > 0 && (
                                    <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 rounded-full border border-orange-100 animate-bounce">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-black uppercase tracking-tight">Ganhe +50 pts</span>
                                    </div>
                                )}
                            </div>

                            {pending.length > 0 ? (
                                <div className="grid gap-4">
                                    {pending.map((a) => (
                                        <Card key={a.id} className="border-none shadow-sm hover:shadow-md transition-all group bg-white overflow-hidden">
                                            <CardContent className="p-0">
                                                <div className="flex flex-col sm:flex-row">
                                                    <div className="p-6 flex-1 space-y-4">
                                                        <div className="flex items-start justify-between">
                                                            <div className="space-y-1">
                                                                <h3 className="text-lg font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase tracking-tight italic">Avaliação MyID</h3>
                                                                <p className="text-xs text-slate-500 font-medium">Enviada em {format(new Date(a.created_at), "dd 'de' MMMM", { locale: ptBR })}</p>
                                                            </div>
                                                            <Badge className="bg-orange-100 text-orange-700 border-none px-3 h-6 text-[10px] font-black uppercase tracking-widest">Pendente</Badge>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-[11px] font-bold text-slate-400">
                                                            <div className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> 5-10 min</div>
                                                            <div className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Múltipla Escolha</div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 p-6 flex items-center justify-center shrink-0">
                                                        <Button
                                                            onClick={() => navigate(`/myid/responder/${a.token_acesso}`)}
                                                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-xl px-8 shadow-md transform group-hover:scale-105 transition-transform"
                                                        >
                                                            Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white p-12 rounded-2xl border-2 border-dashed border-slate-100 text-center flex flex-col items-center gap-3">
                                    <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                                    </div>
                                    <p className="font-bold text-slate-900">Parabéns! Você está em dia.</p>
                                    <p className="text-xs text-slate-500">Não há questionários pendentes para você no momento.</p>
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-slate-400" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Concluídos</h2>
                            </div>

                            {completed.length > 0 ? (
                                <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-50 overflow-hidden">
                                    {completed.map((a) => (
                                        <div key={a.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shrink-0">
                                                    <FileText className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900">Avaliação MyID</p>
                                                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">Finalizada em {format(new Date(a.updated_at || a.created_at), "dd/MM/yyyy")}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 border-none text-[9px] font-black uppercase">Pontuado</Badge>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                                                    <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-8 text-slate-300 text-xs font-medium italic opacity-60">Nenhum questionário concluído ainda.</p>
                            )}
                        </section>
                    </div>
                )}
            </main>

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

export default PatientQuestionnaires;
