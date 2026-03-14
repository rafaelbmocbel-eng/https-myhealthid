import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    User,
    ChevronLeft,
    ExternalLink,
    Info,
    AlertCircle,
    CheckCircle2,
    XCircle,
    Menu,
    Activity,
    LayoutDashboard,
    ClipboardCheck,
    Award,
    BookOpen,
    Watch,
    CreditCard,
    LogOut
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const PatientAgenda = () => {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { toast } = useToast();

    const handleLogout = async () => {
        await signOut();
        navigate("/paciente/login");
    };

    const { data: appointments, isLoading, refetch } = useQuery({
        queryKey: ["patient-all-appointments", user?.id],
        queryFn: async () => {
            const { data: pacienteData } = await supabase
                .from("pacientes")
                .select("id")
                .eq("email", user?.email)
                .maybeSingle();

            if (!pacienteData) return [];

            const { data } = await supabase
                .from("agendamentos")
                .select("*, profiles!agendamentos_terapeuta_id_fkey(nome, sobrenome, especialidade, avatar_url)")
                .eq("paciente_id", pacienteData.id)
                .neq("status", "cancelado")
                .order("data_inicio", { ascending: false });

            return data || [];
        },
        enabled: !!user?.email
    });

    const handleCancelAppointment = async (id: string) => {
        if (!confirm("Tem certeza que deseja cancelar esta consulta?")) return;

        try {
            const { error } = await supabase
                .from("agendamentos")
                .update({ status: "cancelado" })
                .eq("id", id);

            if (error) throw error;

            toast({
                title: "Consulta cancelada",
                description: "Sua sessão foi cancelada com sucesso.",
            });
            refetch();
        } catch (error) {
            console.error(error);
            toast({
                variant: "destructive",
                title: "Erro ao cancelar",
                description: "Não foi possível cancelar a consulta agora.",
            });
        }
    };

    const menuItems = [
        { icon: LayoutDashboard, text: "Dashboard", path: "/paciente/dashboard" },
        { icon: CalendarIcon, text: "Minha Agenda", path: "/paciente/agenda", active: true },
        { icon: ClipboardCheck, text: "Questionários", path: "/paciente/questionarios" },
        { icon: Award, text: "Atividades", path: "/paciente/atividades" },
        { icon: BookOpen, text: "Diário de Saúde", path: "/paciente/diario" },
        { icon: Watch, text: "Meu Dispositivo", path: "/paciente/dispositivo" },
        { icon: CreditCard, text: "Planos", path: "/paciente/planos" },
        { icon: User, text: "Perfil", path: "/paciente/perfil" },
    ];

    const futureAppointments = appointments?.filter(appt => isAfter(new Date(appt.data_inicio), new Date())) || [];
    const pastAppointments = appointments?.filter(appt => !isAfter(new Date(appt.data_inicio), new Date())) || [];

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
                            <h1 className="text-2xl font-black text-slate-900">Minha Agenda</h1>
                            <p className="text-slate-500 text-sm font-medium">Controle suas consultas e histórico de sessões.</p>
                        </div>
                    </div>
                </header>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse shadow-sm" />)}
                    </div>
                ) : (
                    <div className="space-y-8">
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-indigo-600" />
                                <h2 className="text-lg font-black text-slate-900">Próximas Consultas</h2>
                            </div>

                            {futureAppointments.length > 0 ? (
                                <div className="grid gap-4">
                                    {futureAppointments.slice().reverse().map((appt) => (
                                        <Card key={appt.id} className="border-none shadow-sm hover:shadow-md transition-shadow group">
                                            <CardContent className="p-0 overflow-hidden rounded-2xl">
                                                <div className="flex flex-col sm:flex-row divide-y sm:divide-y-0 sm:divide-x divide-slate-50">
                                                    <div className="p-6 sm:w-32 bg-indigo-50/50 flex flex-col items-center justify-center shrink-0">
                                                        <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">{format(new Date(appt.data_inicio), "MMM", { locale: ptBR })}</span>
                                                        <span className="text-3xl font-black text-indigo-700 leading-none">{format(new Date(appt.data_inicio), "dd")}</span>
                                                        <span className="text-[10px] font-bold text-indigo-400 mt-1 uppercase tracking-tighter">{format(new Date(appt.data_inicio), "EEEE", { locale: ptBR })}</span>
                                                    </div>

                                                    <div className="p-6 flex-1 space-y-3">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">Sessão Confirmada</Badge>
                                                            <span className="text-xs font-bold text-slate-400">{format(new Date(appt.data_inicio), "HH:mm")} às {format(new Date(appt.data_fim), "HH:mm")}</span>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-black text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">Consulta Presencial</h3>
                                                            <div className="flex items-center gap-4 mt-2">
                                                                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                                                                    <User className="h-4 w-4" /> Dr. {(appt as any).profiles?.nome} {(appt as any).profiles?.sobrenome}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                                                                    <MapPin className="h-4 w-4" /> Studio MyHealth
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="p-6 flex sm:flex-col items-center justify-center gap-2 bg-slate-50/30">
                                                        <Button className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-sm">Detalhes</Button>
                                                        <Button
                                                            variant="ghost"
                                                            className="w-full text-red-500 hover:bg-red-50 font-bold rounded-xl h-9 text-xs"
                                                            onClick={() => handleCancelAppointment(appt.id)}
                                                        >
                                                            Cancelar
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-4">
                                    <CalendarIcon className="h-10 w-10 text-slate-200" />
                                    <div>
                                        <p className="font-bold text-slate-900">Nenhuma consulta agendada.</p>
                                        <p className="text-sm text-slate-500">Agende sua próxima sessão para continuar sua jornada.</p>
                                    </div>
                                    <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl px-8 shadow-md">Agendar Sessão</Button>
                                </div>
                            )}
                        </section>

                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-slate-400" />
                                <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Histórico de Sessões</h2>
                            </div>

                            {pastAppointments.length > 0 ? (
                                <div className="bg-white rounded-2xl shadow-sm divide-y divide-slate-50 overflow-hidden">
                                    {pastAppointments.map((appt) => (
                                        <div key={appt.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-center gap-4">
                                                <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 font-bold text-xs shrink-0">
                                                    {format(new Date(appt.data_inicio), "dd/MM")}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900">Avaliação Biomecânica</p>
                                                    <p className="text-[10px] text-slate-500 font-medium tracking-tight">Com Dr. {(appt as any).profiles?.nome} • {format(new Date(appt.data_inicio), "HH:mm")}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-black uppercase tracking-tight">
                                                    <CheckCircle2 className="h-3 w-3" /> Realizada
                                                </div>
                                                <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg border-slate-200">
                                                    <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center py-8 text-slate-400 text-sm font-medium italic">Seu histórico está vazio.</p>
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

export default PatientAgenda;
