import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
    Watch,
    Smartphone,
    RefreshCcw,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Menu,
    Activity,
    LayoutDashboard,
    Calendar,
    ClipboardCheck,
    Award,
    BookOpen,
    CreditCard,
    User,
    LogOut,
    Bluetooth,
    Link as LinkIcon,
    Zap,
    Moon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PatientWearable = () => {
    const { profile, signOut } = useAuth();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);

    const handleLogout = async () => {
        await signOut();
        navigate("/paciente/login");
    };

    const handleFitbitConnect = () => {
        // URL Mock para Etapa 8 (OAuth será implementada no backend real)
        const fitbitAuthUrl = "https://www.fitbit.com/oauth2/authorize?...";
        window.location.href = fitbitAuthUrl;
    };

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            alert("Dados sincronizados com sucesso!");
        }, 2000);
    };

    const menuItems = [
        { icon: LayoutDashboard, text: "Dashboard", path: "/paciente/dashboard" },
        { icon: Calendar, text: "Minha Agenda", path: "/paciente/agenda" },
        { icon: ClipboardCheck, text: "Questionários", path: "/paciente/questionarios" },
        { icon: Award, text: "Atividades", path: "/paciente/atividades" },
        { icon: BookOpen, text: "Diário de Saúde", path: "/paciente/diario" },
        { icon: Watch, text: "Meu Dispositivo", path: "/paciente/dispositivo", active: true },
        { icon: CreditCard, text: "Planos", path: "/paciente/planos" },
        { icon: User, text: "Perfil", path: "/paciente/perfil" },
    ];

    const devices = [
        {
            id: 'fitbit',
            name: 'Fitbit',
            status: profile?.fitbit_access_token ? 'connected' : 'disconnected',
            icon: Watch,
            color: 'text-cyan-500',
            bg: 'bg-cyan-50'
        },
        {
            id: 'bluetooth',
            name: 'Dispositivo BT',
            status: 'available',
            icon: Bluetooth,
            color: 'text-blue-500',
            bg: 'bg-blue-50'
        }
    ];

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
                            <h1 className="text-2xl font-black text-slate-900 leading-none">Meus Dispositivos</h1>
                            <p className="text-slate-500 text-sm font-medium italic">Sincronize sua biologia em tempo real.</p>
                        </div>
                    </div>
                    {profile?.fitbit_access_token && (
                        <Button
                            variant="outline"
                            className="rounded-xl font-black text-xs gap-2 border-slate-200"
                            onClick={handleSync}
                            disabled={isSyncing}
                        >
                            <RefreshCcw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                            {isSyncing ? "Sincronizando..." : "Sincronizar Agora"}
                        </Button>
                    )}
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {devices.map(device => (
                        <Card key={device.id} className="border-none shadow-sm bg-white hover:shadow-md transition-all group overflow-hidden">
                            <CardContent className="p-8 space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className={cn("h-16 w-16 rounded-3xl flex items-center justify-center transition-transform group-hover:scale-110", device.bg)}>
                                        <device.icon className={cn("h-8 w-8", device.color)} />
                                    </div>
                                    <Badge className={cn(
                                        "font-black text-[10px] uppercase tracking-widest px-3 h-6 border-none",
                                        device.status === 'connected' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"
                                    )}>
                                        {device.status === 'connected' ? 'Conectado' : 'Disponível'}
                                    </Badge>
                                </div>

                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{device.name} Smartwatch</h3>
                                    <p className="text-sm text-slate-500 font-medium">Importe passos, sono e batimentos.</p>
                                </div>

                                {device.id === 'fitbit' ? (
                                    device.status === 'connected' ? (
                                        <Button variant="ghost" className="w-full text-red-500 hover:bg-red-50 font-bold rounded-xl h-12">
                                            Desconectar dispositivo
                                        </Button>
                                    ) : (
                                        <Button
                                            onClick={handleFitbitConnect}
                                            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl h-12 shadow-lg"
                                        >
                                            Conectar agora <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                    )
                                ) : (
                                    <Button
                                        disabled
                                        variant="outline"
                                        className="w-full rounded-xl h-12 font-bold text-slate-300 border-dashed border-slate-200"
                                    >
                                        Bluetooth em breve
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Sync Info / Stats */}
                {profile?.fitbit_access_token && (
                    <section className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Activity className="h-5 w-5 text-indigo-600" />
                            <h2 className="text-lg font-black text-slate-900">Últimos Dados Importados</h2>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <Card className="border-none shadow-sm bg-indigo-50/50">
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="h-10 w-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                                        <Zap className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Passos</p>
                                        <p className="text-xl font-black text-slate-900">8.432</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-sm bg-rose-50/50">
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="h-10 w-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600">
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-rose-400 tracking-widest">FC Média</p>
                                        <p className="text-xl font-black text-slate-900">72 bpm</p>
                                    </div>
                                </CardContent>
                            </Card>
                            <Card className="border-none shadow-sm bg-blue-50/50">
                                <CardContent className="p-6 flex items-center gap-4">
                                    <div className="h-10 w-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                                        <Moon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest">Sono</p>
                                        <p className="text-xl font-black text-slate-900">7h 20m</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </section>
                )}

                {/* Sync Troubleshooting */}
                <div className="bg-white p-6 rounded-2xl border border-slate-100 flex items-start gap-4">
                    <div className="h-10 w-10 bg-amber-50 rounded-full flex items-center justify-center shrink-0">
                        <AlertCircle className="h-6 w-6 text-amber-500" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-bold text-slate-900 text-sm italic">Como funciona a sincronização?</h4>
                        <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Seus dados são coletados diretamente do seu dispositivo e sincronizados com o MyHealthID.
                            O MyID Index utiliza essas informações para ajustar sua pontuação de saúde em tempo real.
                            Sempre clique em "Sincronizar Agora" após seus treinos ou ao acordar.
                        </p>
                    </div>
                </div>
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

const ArrowRight = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);

export default PatientWearable;
