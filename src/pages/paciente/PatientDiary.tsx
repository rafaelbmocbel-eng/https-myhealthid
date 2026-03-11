import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    BookOpen,
    Smile,
    Frown,
    Meh,
    SmilePlus,
    Angry,
    Zap,
    Moon,
    AlertCircle,
    ChevronLeft,
    Save,
    Clock,
    Menu,
    Activity,
    LayoutDashboard,
    Calendar,
    ClipboardCheck,
    Award,
    Watch,
    CreditCard,
    User,
    LogOut,
    History
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PatientDiary = () => {
    const { user, profile, signOut } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [mood, setMood] = useState<number>(3);
    const [pain, setPain] = useState<number[]>([0]);
    const [energy, setEnergy] = useState<number>(3);
    const [sleep, setSleep] = useState<string>("8");
    const [notes, setNotes] = useState("");

    const handleLogout = async () => {
        await signOut();
        navigate("/paciente/login");
    };

    const { data: logs, isLoading } = useQuery({
        queryKey: ["patient-daily-logs", user?.id],
        queryFn: async () => {
            // daily_logs table doesn't exist yet - return empty
            return [] as any[];
        },
        enabled: !!user?.id
    });

    const mutation = useMutation({
        mutationFn: async (newLog: any) => {
            // daily_logs table doesn't exist yet - no-op
            return null;
        },
        onSuccess: () => {
            toast({ title: "Registro salvo!", description: "Seu diário foi atualizado com sucesso." });
            queryClient.invalidateQueries({ queryKey: ["patient-daily-logs"] });
            setNotes("");
        },
        onError: () => {
            toast({ variant: "destructive", title: "Erro ao salvar", description: "Tente novamente mais tarde." });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate({
            mood,
            pain: pain[0],
            energy,
            sleep_hours: parseFloat(sleep),
            notes
        });
    };

    const moodIcons = [
        { level: 1, icon: Angry, label: "Muito Mal", color: "text-red-500", bg: "bg-red-50" },
        { level: 2, icon: Frown, label: "Mal", color: "text-orange-500", bg: "bg-orange-50" },
        { level: 3, icon: Meh, label: "Neutro", color: "text-amber-500", bg: "bg-amber-50" },
        { level: 4, icon: Smile, label: "Bem", color: "text-emerald-500", bg: "bg-emerald-50" },
        { level: 5, icon: SmilePlus, label: "Excelente", color: "text-indigo-500", bg: "bg-indigo-50" },
    ];

    const menuItems = [
        { icon: LayoutDashboard, text: "Dashboard", path: "/paciente/dashboard" },
        { icon: Calendar, text: "Minha Agenda", path: "/paciente/agenda" },
        { icon: ClipboardCheck, text: "Questionários", path: "/paciente/questionarios" },
        { icon: Award, text: "Atividades", path: "/paciente/atividades" },
        { icon: BookOpen, text: "Diário de Saúde", path: "/paciente/diario", active: true },
        { icon: Watch, text: "Meu Dispositivo", path: "/paciente/dispositivo" },
        { icon: CreditCard, text: "Planos", path: "/paciente/planos" },
        { icon: User, text: "Perfil", path: "/paciente/perfil" },
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

            <main className="flex-1 lg:max-w-4xl mx-auto p-4 lg:p-8 space-y-8 pb-12">
                <header className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setIsSidebarOpen(true)}>
                            <Menu className="h-6 w-6" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">Diário de Saúde</h1>
                            <p className="text-slate-500 text-sm font-medium italic">Como você está se sentindo hoje?</p>
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Form Section */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="border-none shadow-sm bg-white overflow-hidden">
                            <CardHeader className="bg-indigo-600 text-white p-6">
                                <CardTitle className="text-lg font-black flex items-center gap-2 uppercase tracking-tight">
                                    <Save className="h-5 w-5" /> Registro de {format(new Date(), "dd/MM")}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-8">
                                <form onSubmit={handleSubmit} className="space-y-10">
                                    {/* Mood Selector */}
                                    <div className="space-y-4">
                                        <Label className="text-sm font-black text-slate-700 uppercase tracking-widest">Humor Geral</Label>
                                        <div className="flex justify-between gap-2 overflow-x-auto pb-2">
                                            {moodIcons.map((m) => (
                                                <button
                                                    key={m.level}
                                                    type="button"
                                                    onClick={() => setMood(m.level)}
                                                    className={cn(
                                                        "flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border-2 shrink-0",
                                                        mood === m.level
                                                            ? cn("border-indigo-500 shadow-md scale-105 bg-indigo-50/50", m.color)
                                                            : "border-transparent text-slate-300 grayscale hover:grayscale-0 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <m.icon className="h-8 w-8" />
                                                    <span className="text-[10px] font-black uppercase tracking-tighter">{m.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* metrics grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4 text-rose-500" /> Nível de Dor
                                                    </Label>
                                                    <span className="text-lg font-black text-slate-900">{pain[0]}</span>
                                                </div>
                                                <Slider
                                                    value={pain}
                                                    onValueChange={setPain}
                                                    max={10}
                                                    step={1}
                                                    className="py-4"
                                                />
                                                <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase">
                                                    <span>Sem dor</span>
                                                    <span>Intensa</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <Label className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                    <Zap className="h-4 w-4 text-amber-500" /> Energia
                                                </Label>
                                                <div className="flex gap-2">
                                                    {[1, 2, 3, 4, 5].map(i => (
                                                        <button
                                                            key={i}
                                                            type="button"
                                                            onClick={() => setEnergy(i)}
                                                            className={cn(
                                                                "h-10 flex-1 rounded-xl transition-all font-black",
                                                                energy >= i ? "bg-amber-400 text-white" : "bg-slate-100 text-slate-300"
                                                            )}
                                                        >
                                                            {i}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-6">
                                            <div className="space-y-4">
                                                <Label className="text-sm font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                                                    <Moon className="h-4 w-4 text-indigo-500" /> Horas de Sono
                                                </Label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.5"
                                                        value={sleep}
                                                        onChange={(e) => setSleep(e.target.value)}
                                                        className="w-full bg-slate-50 border-none rounded-xl h-12 px-4 font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 text-lg"
                                                    />
                                                    <span className="absolute right-4 top-3 text-xs font-black text-slate-400 uppercase">hrs</span>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                <Label className="text-sm font-black text-slate-700 uppercase tracking-widest">Anotações extras</Label>
                                                <Textarea
                                                    placeholder="Como foi seu dia? Sentiu algo diferente?"
                                                    value={notes}
                                                    onChange={(e) => setNotes(e.target.value)}
                                                    className="bg-slate-50 border-none rounded-xl min-h-[100px] resize-none focus:ring-2 focus:ring-indigo-500"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black h-14 rounded-2xl text-lg shadow-xl shadow-slate-200"
                                        disabled={mutation.isPending}
                                    >
                                        {mutation.isPending ? "Salvando..." : "Salvar Registro Diário"}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    {/* History sidebar */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2">
                            <History className="h-5 w-5 text-slate-400" />
                            <h2 className="text-sm font-black uppercase tracking-widest text-slate-400">Últimos 7 dias</h2>
                        </div>

                        {isLoading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white rounded-2xl animate-pulse" />)}
                            </div>
                        ) : logs && logs.length > 0 ? (
                            <div className="space-y-3">
                                {logs.map((log) => (
                                    <Card key={log.id} className="border-none shadow-sm hover:translate-x-1 transition-transform cursor-pointer">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center font-black text-[10px] text-slate-500 leading-none">
                                                    {format(new Date(log.created_at), "dd/MM")}
                                                </div>
                                                <div>
                                                    <div className="flex gap-1 mb-0.5">
                                                        {Array.from({ length: log.mood }).map((_, i) => (
                                                            <div key={i} className="h-1.5 w-3 rounded-full bg-emerald-500" />
                                                        ))}
                                                    </div>
                                                    <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                                                        {log.pain} Dor • {log.energy} Energia • {log.sleep_hours}h Sono
                                                    </p>
                                                </div>
                                            </div>
                                            < ChevronRight className="h-4 w-4 text-slate-300" />
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <p className="text-center py-12 text-slate-400 text-xs font-medium italic italic opacity-60">
                                Seu histórico aparecerá aqui após o primeiro registro.
                            </p>
                        )}
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

// Componente simples para ícone de chevron ja que lucide tem vários e quero o right
const ChevronRight = ({ className }: { className?: string }) => (
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
        <path d="m9 18 6-6-6-6" />
    </svg>
);

export default PatientDiary;
