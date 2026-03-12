import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Smile,
    Frown,
    Meh,
    SmilePlus,
    Angry,
    Zap,
    Moon,
    AlertCircle,
    Save,
    Clock,
    History,
    ChevronRight,
    Star,
    PenLine
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientDiary = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [mood, setMood] = useState<number>(3);
    const [pain, setPain] = useState<number[]>([0]);
    const [energy, setEnergy] = useState<number>(3);
    const [sleep, setSleep] = useState<string>("8");
    const [notes, setNotes] = useState("");

    const { data: logs, isLoading } = useQuery({
        queryKey: ["patient-daily-logs", user?.id],
        queryFn: async () => {
            // Se a tabela ainda não existir no Supabase, retornamos vazio para evitar crash
            const { data, error } = await supabase
                .from("daily_logs")
                .select("*")
                .eq("user_id", user?.id)
                .order("created_at", { ascending: false })
                .limit(10);

            if (error) return [];
            return data || [];
        },
        enabled: !!user?.id
    });

    const mutation = useMutation({
        mutationFn: async (newLog: any) => {
            const { error } = await supabase
                .from("daily_logs")
                .insert([{ ...newLog, user_id: user?.id }]);
            if (error) throw error;
        },
        onSuccess: () => {
            toast({
                title: "Registro salvo com sucesso!",
                description: "Sua evolução está sendo mapeada.",
                className: "bg-emerald-600 text-white border-none rounded-2xl font-bold"
            });
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
        { level: 1, icon: Angry, label: "CRÍTICO", color: "text-rose-500", bg: "bg-rose-50" },
        { level: 2, icon: Frown, label: "BAIXO", color: "text-orange-500", bg: "bg-orange-50" },
        { level: 3, icon: Meh, label: "NEUTRO", color: "text-amber-500", bg: "bg-amber-50" },
        { level: 4, icon: Smile, label: "BOM", color: "text-emerald-500", bg: "bg-emerald-50" },
        { level: 5, icon: SmilePlus, label: "EXCELENTE", color: "text-indigo-500", bg: "bg-indigo-50" },
    ];

    return (
        <PatientLayout>
            <div className="max-w-5xl mx-auto space-y-10">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-slate-900 italic uppercase leading-none tracking-tight">Diário Clínico</h1>
                    <p className="text-slate-500 font-medium">Auto-observação é a chave do sucesso. Registre seu estado atual.</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-8">
                        <Card className="border-none shadow-2xl bg-white overflow-hidden rounded-[2.5rem] border border-slate-100">
                            <CardContent className="p-0">
                                <form onSubmit={handleSubmit} className="space-y-0">
                                    <div className="bg-slate-900 p-8 flex items-center justify-between">
                                        <h3 className="text-white font-black text-lg uppercase italic tracking-widest flex items-center gap-3">
                                            <PenLine className="h-6 w-6 text-indigo-400" /> Registro de {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
                                        </h3>
                                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                                    </div>

                                    <div className="p-10 space-y-12">
                                        <div className="space-y-6">
                                            <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Como está seu humor agora?</Label>
                                            <div className="grid grid-cols-5 gap-3">
                                                {moodIcons.map((m) => (
                                                    <button
                                                        key={m.level}
                                                        type="button"
                                                        onClick={() => setMood(m.level)}
                                                        className={cn(
                                                            "group flex flex-col items-center gap-3 p-6 rounded-[2rem] transition-all duration-300 border-2 active:scale-95",
                                                            mood === m.level
                                                                ? cn("border-indigo-600 bg-indigo-50/50 shadow-xl shadow-indigo-100", m.color)
                                                                : "border-slate-50 text-slate-300 grayscale opacity-60 hover:opacity-100 hover:grayscale-0 hover:border-indigo-200"
                                                        )}
                                                    >
                                                        <m.icon className={cn("h-10 w-10 transition-transform group-hover:scale-110", mood === m.level && "animate-bounce")} />
                                                        <span className="text-[9px] font-black uppercase tracking-tighter">{m.label}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                            <div className="space-y-8">
                                                <div className="space-y-6">
                                                    <div className="flex justify-between items-center">
                                                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                            <AlertCircle className="h-4 w-4 text-rose-500" /> Intensidade de Dor
                                                        </Label>
                                                        <span className="text-2xl font-black text-slate-900">{pain[0]}/10</span>
                                                    </div>
                                                    <div className="px-2">
                                                        <Slider
                                                            value={pain}
                                                            onValueChange={setPain}
                                                            max={10}
                                                            step={1}
                                                            className="py-4 cursor-pointer"
                                                        />
                                                    </div>
                                                    <div className="flex justify-between text-[9px] font-black text-slate-300 uppercase tracking-widest">
                                                        <span>Sem dor</span>
                                                        <span>Intensa</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <Zap className="h-4 w-4 text-amber-500" /> Nível de Energia
                                                    </Label>
                                                    <div className="flex gap-2">
                                                        {[1, 2, 3, 4, 5].map(i => (
                                                            <button
                                                                key={i}
                                                                type="button"
                                                                onClick={() => setEnergy(i)}
                                                                className={cn(
                                                                    "h-12 flex-1 rounded-2xl transition-all font-black text-sm active:scale-90",
                                                                    energy >= i ? "bg-amber-400 text-white shadow-lg shadow-amber-100" : "bg-slate-50 text-slate-200 border border-slate-100"
                                                                )}
                                                            >
                                                                {i}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-8">
                                                <div className="space-y-6">
                                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                                        <Moon className="h-4 w-4 text-indigo-500" /> Repouso (Horas)
                                                    </Label>
                                                    <div className="relative group">
                                                        <input
                                                            type="number"
                                                            step="0.5"
                                                            value={sleep}
                                                            onChange={(e) => setSleep(e.target.value)}
                                                            className="w-full bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] h-14 px-6 font-black text-slate-900 focus:bg-white focus:border-indigo-600 focus:ring-0 transition-all text-xl shadow-inner group-hover:border-slate-200"
                                                        />
                                                        <span className="absolute right-6 top-4 text-[9px] font-black text-slate-300 uppercase tracking-widest">HRS</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-6">
                                                    <Label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Observações do Dia</Label>
                                                    <Textarea
                                                        placeholder="Insights, sensações ou eventos importantes..."
                                                        value={notes}
                                                        onChange={(e) => setNotes(e.target.value)}
                                                        className="bg-slate-50 border-2 border-slate-50 rounded-[1.5rem] min-h-[140px] p-6 resize-none focus:bg-white focus:border-indigo-600 focus:ring-0 transition-all text-sm font-medium shadow-inner"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <Button
                                            type="submit"
                                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black h-16 rounded-[2rem] text-lg shadow-2xl shadow-indigo-200 active:scale-95 transition-all uppercase italic flex gap-3"
                                            disabled={mutation.isPending}
                                        >
                                            {mutation.isPending ? (
                                                <div className="h-6 w-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    Finalizar Registro Diário <Save className="h-6 w-6" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="space-y-8">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                <History className="h-6 w-6" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase italic">Histórico Recente</h2>
                        </div>

                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-24 bg-white rounded-[2rem] animate-pulse shadow-sm border border-slate-100" />
                                ))}
                            </div>
                        ) : logs && logs.length > 0 ? (
                            <div className="space-y-4">
                                {logs.map((log: any) => (
                                    <Card key={log.id} className="border-none shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all cursor-pointer group rounded-[2rem] border border-slate-50">
                                        <CardContent className="p-5 flex items-center justify-between">
                                            <div className="flex items-center gap-5">
                                                <div className="h-14 w-14 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white transition-colors rounded-2xl flex flex-col items-center justify-center font-black text-[10px] text-indigo-600 leading-tight shrink-0 border border-indigo-100/30">
                                                    <span>{format(new Date(log.created_at), "dd")}</span>
                                                    <span className="uppercase text-[8px] tracking-widest">{format(new Date(log.created_at), "MMM")}</span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex gap-1">
                                                        {Array.from({ length: 5 }).map((_, i) => (
                                                            <div
                                                                key={i}
                                                                className={cn(
                                                                    "h-1.5 w-4 rounded-full transition-colors",
                                                                    i < log.mood ? "bg-indigo-500" : "bg-slate-100"
                                                                )}
                                                            />
                                                        ))}
                                                    </div>
                                                    <p className="text-[9px] font-black uppercase tracking-tight text-slate-400">
                                                        <span className="text-rose-500">{log.pain} DOR</span> • <span className="text-amber-500">{log.energy} ENG</span> • <span className="text-indigo-400">{log.sleep_hours}H SONO</span>
                                                    </p>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-5 w-5 text-slate-200 group-hover:text-indigo-600 transition-colors" />
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button variant="ghost" className="w-full text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 py-6">
                                    Ver histórico completo <Star className="h-3 w-3 ml-2" />
                                </Button>
                            </div>
                        ) : (
                            <div className="bg-slate-50/50 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-slate-100">
                                <p className="text-slate-300 font-black italic uppercase tracking-widest text-[10px]">Primeiro registro pendente...</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </PatientLayout>
    );
};

export default PatientDiary;
