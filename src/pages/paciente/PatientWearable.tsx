import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
    Watch,
    RefreshCcw,
    Activity,
    Bluetooth,
    Zap,
    Moon,
    ArrowRight,
    ShieldCheck,
    Cpu,
    Smartphone
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientWearable = () => {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const [isSyncing, setIsSyncing] = useState(false);

    const handleFitbitConnect = () => {
        // URL Mock para OAuth
        const fitbitAuthUrl = "https://www.fitbit.com/oauth2/authorize?...";
        window.location.href = fitbitAuthUrl;
    };

    const handleSync = () => {
        setIsSyncing(true);
        setTimeout(() => {
            setIsSyncing(false);
            // toast ou alert de sucesso
        }, 2000);
    };

    const devices = [
        {
            id: 'fitbit',
            name: 'FITBIT ecosystem',
            status: profile?.fitbit_access_token ? 'connected' : 'disconnected',
            icon: Watch,
            color: 'text-cyan-500',
            bg: 'bg-cyan-50'
        },
        {
            id: 'bluetooth',
            name: 'LOCAL bluetooth',
            status: 'available',
            icon: Bluetooth,
            color: 'text-blue-500',
            bg: 'bg-blue-50'
        }
    ];

    return (
        <PatientLayout>
            <div className="max-w-5xl mx-auto space-y-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-black text-slate-900 italic uppercase leading-none tracking-tight">Wearables & Dispositivos</h1>
                        <p className="text-slate-500 font-medium">Sincronize seus dados biométricos para um ajuste fino do seu MyID Index.</p>
                    </div>
                    {profile?.fitbit_access_token && (
                        <Button
                            variant="outline"
                            className={cn(
                                "rounded-2xl font-black text-[10px] uppercase tracking-widest gap-2 h-12 px-6 border-2 transition-all active:scale-95",
                                isSyncing ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "bg-white border-slate-100 text-slate-600 hover:border-indigo-600 hover:text-indigo-600"
                            )}
                            onClick={handleSync}
                            disabled={isSyncing}
                        >
                            <RefreshCcw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                            {isSyncing ? "Sincronizando Biometria..." : "Sincronizar Agora"}
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {devices.map(device => (
                        <Card key={device.id} className="border-none shadow-2xl bg-white hover:border-indigo-100 hover:shadow-indigo-100/30 transition-all group overflow-hidden rounded-[2.5rem] border-2 border-transparent">
                            <CardContent className="p-10 space-y-8">
                                <div className="flex items-center justify-between">
                                    <div className={cn("h-20 w-20 rounded-[1.5rem] flex items-center justify-center transition-all duration-500 shadow-inner group-hover:rotate-6", device.bg)}>
                                        <device.icon className={cn("h-10 w-10", device.color)} />
                                    </div>
                                    <Badge className={cn(
                                        "font-black text-[10px] uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border-none shadow-sm",
                                        device.status === 'connected' ? "bg-emerald-100 text-emerald-700" : "bg-slate-50 text-slate-300"
                                    )}>
                                        {device.status === 'connected' ? 'Ativo' : 'Pendente'}
                                    </Badge>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition-colors uppercase italic leading-tight">{device.name}</h3>
                                    <p className="text-sm text-slate-500 font-medium">Integração nativa para monitoramento de performance, sono e variabilidade cardíaca.</p>
                                </div>

                                {device.id === 'fitbit' ? (
                                    device.status === 'connected' ? (
                                        <div className="space-y-3">
                                            <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/50 flex items-center gap-3">
                                                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                                                <span className="text-[10px] font-black text-emerald-700 uppercase">Conexão Segura Estabelecida</span>
                                            </div>
                                            <Button variant="ghost" className="w-full text-rose-500 hover:bg-rose-50 font-black rounded-2xl h-14 uppercase text-[10px] tracking-widest italic transition-colors">
                                                Interromper Sincronização
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            onClick={handleFitbitConnect}
                                            className="w-full bg-slate-900 hover:bg-black text-white font-black rounded-[1.5rem] h-16 shadow-xl active:scale-95 transition-all text-sm uppercase italic flex gap-3"
                                        >
                                            Vincular Dispositivo <ArrowRight className="h-5 w-5" />
                                        </Button>
                                    )
                                ) : (
                                    <Button
                                        disabled
                                        variant="outline"
                                        className="w-full rounded-[1.5rem] h-16 font-black text-slate-300 border-4 border-dashed border-slate-50 bg-slate-50/20 uppercase text-[10px] tracking-widest italic"
                                    >
                                        Expansão em Breve
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Status Section */}
                <section className="space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                            <Cpu className="h-6 w-6" />
                        </div>
                        <h2 className="text-xl font-black text-slate-900 uppercase italic">Dados do Ecossistema</h2>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <Card className="border-none shadow-xl bg-white rounded-[2rem] border border-slate-50 overflow-hidden group hover:border-indigo-100 transition-all">
                            <CardContent className="p-8 flex items-center gap-5">
                                <div className="h-14 w-14 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white transition-all rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                    <Zap className="h-7 w-7" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Gasto Calórico</p>
                                    <p className="text-2xl font-black text-slate-900">2.432 <span className="text-[10px] text-slate-300 font-bold">KCAL</span></p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-xl bg-white rounded-[2rem] border border-slate-50 overflow-hidden group hover:border-indigo-100 transition-all">
                            <CardContent className="p-8 flex items-center gap-5">
                                <div className="h-14 w-14 bg-rose-50 group-hover:bg-rose-500 group-hover:text-white transition-all rounded-2xl flex items-center justify-center text-rose-600 shadow-inner">
                                    <Activity className="h-7 w-7" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Frequência Médio</p>
                                    <p className="text-2xl font-black text-slate-900">72 <span className="text-[10px] text-slate-300 font-bold">BPM</span></p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="border-none shadow-xl bg-white rounded-[2rem] border border-slate-50 overflow-hidden group hover:border-indigo-100 transition-all">
                            <CardContent className="p-8 flex items-center gap-5">
                                <div className="h-14 w-14 bg-blue-50 group-hover:bg-blue-600 group-hover:text-white transition-all rounded-2xl flex items-center justify-center text-blue-600 shadow-inner">
                                    <Moon className="h-7 w-7" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-1">Ciclo de Sono</p>
                                    <p className="text-2xl font-black text-slate-900">7h 20m</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </section>

                <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Smartphone size={100} />
                    </div>
                    <div className="h-16 w-16 bg-white/10 rounded-2xl flex items-center justify-center shrink-0 border border-white/10">
                        <Smartphone className="h-8 w-8 text-indigo-400" />
                    </div>
                    <div className="space-y-2 text-center md:text-left flex-1">
                        <h4 className="font-black text-xl italic uppercase tracking-tight">Otimização de Performance MyID</h4>
                        <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-2xl">
                            A sincronização frequente permite que nossa inteligência clínica ajuste as diretrizes do seu tratamento baseado na sua recuperação diária. Seus dados são processados localmente e criptografados para garantir sua privacidade absoluta.
                        </p>
                    </div>
                </div>
            </div>
        </PatientLayout>
    );
};

export default PatientWearable;
