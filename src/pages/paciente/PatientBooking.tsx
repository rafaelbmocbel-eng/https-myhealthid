import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
    Calendar as CalendarIcon,
    Clock,
    ChevronLeft,
    ChevronRight,
    CheckCircle2,
    Loader2,
    ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format, addDays, startOfWeek, isSameDay, isAfter, isBefore, addMinutes, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import PatientLayout from "@/components/paciente/PatientLayout";
import { useToast } from "@/hooks/use-toast";

const DAY_MAP: Record<number, string> = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' };

const PatientBooking = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [semanaOffset, setSemanaOffset] = useState(0);
    const [selectedSlot, setSelectedSlot] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 1. Buscar dados do paciente para obter o terapeuta_id
    const { data: pacienteData } = useQuery({
        queryKey: ["patient-clinical-data", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("pacientes")
                .select("*")
                .eq("user_id", user?.id)
                .maybeSingle();
            return data;
        },
        enabled: !!user?.id
    });

    const terapeutaId = pacienteData?.terapeuta_id;

    // 2. Buscar configurações de agenda do terapeuta
    const { data: config } = useQuery({
        queryKey: ["config-agenda-patient", terapeutaId],
        queryFn: async () => {
            const { data } = await supabase
                .from("config_agenda")
                .select("*")
                .eq("terapeuta_id", terapeutaId)
                .maybeSingle();
            return data;
        },
        enabled: !!terapeutaId
    });

    // 3. Buscar agendamentos existentes para filtrar slots
    const { data: agendamentos = [] } = useQuery({
        queryKey: ["existing-appointments-booking", terapeutaId],
        queryFn: async () => {
            const { data } = await supabase
                .from("agendamentos")
                .select("data_inicio, data_fim, status")
                .eq("terapeuta_id", terapeutaId)
                .gte("data_inicio", new Date().toISOString())
                .neq("status", "cancelado");
            return data || [];
        },
        enabled: !!terapeutaId
    });

    const getSlotsDisponiveis = () => {
        if (!config) return [];
        const hoje = startOfDay(new Date());
        const inicioSemana = startOfWeek(addDays(hoje, semanaOffset * 7), { weekStartsOn: 1 });
        const dias: any[] = [];
        const diasSemanaMap: Record<string, number> = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0 };
        const diasAtivos = Object.entries(config.dias_semana as Record<string, boolean>)
            .filter(([, ativo]) => ativo)
            .map(([dia]) => diasSemanaMap[dia]);

        for (let i = 0; i < 7; i++) {
            const dia = addDays(inicioSemana, i);
            if (isBefore(dia, hoje)) continue;
            if (!diasAtivos.includes(dia.getDay())) continue;

            const [hIni] = (config.horario_inicio || '08:00:00').split(':').map(Number);
            const [hFim] = (config.horario_fim || '18:00:00').split(':').map(Number);
            const duracao = config.duracao_padrao || 60;
            const intervalo = config.intervalo_entre_sessoes || 0;
            const slots: any[] = [];
            let minutoAtual = hIni * 60;

            while (minutoAtual + duracao <= hFim * 60) {
                const h = Math.floor(minutoAtual / 60);
                const m = minutoAtual % 60;
                const horaStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

                const slotInicio = new Date(dia);
                slotInicio.setHours(h, m, 0, 0);
                const slotFim = addMinutes(slotInicio, duracao);

                // Evitar slots passados no mesmo dia
                if (isSameDay(dia, new Date()) && isBefore(slotInicio, new Date())) {
                    minutoAtual += duracao + intervalo;
                    continue;
                }

                const vagasMax = config.vagas_por_horario || 1;
                const ocupadas = agendamentos.filter(ag => {
                    const agStart = new Date(ag.data_inicio).getTime();
                    const agEnd = new Date(ag.data_fim).getTime();
                    return slotInicio.getTime() < agEnd && slotFim.getTime() > agStart;
                }).length;

                if (ocupadas < vagasMax) {
                    slots.push({
                        hora: horaStr,
                        dataInicio: slotInicio,
                        dataFim: slotFim,
                    });
                }
                minutoAtual += duracao + intervalo;
            }

            if (slots.length > 0) dias.push({ data: dia, slots });
        }
        return dias;
    };

    const handleConfirmBooking = async () => {
        if (!selectedSlot || !pacienteData) return;
        setIsSubmitting(true);

        try {
            const { error } = await supabase.from("agendamentos").insert({
                terapeuta_id: terapeutaId,
                paciente_id: pacienteData.id,
                data_inicio: selectedSlot.dataInicio.toISOString(),
                data_fim: selectedSlot.dataFim.toISOString(),
                status: "pendente",
                tipo_atendimento: "retorno",
                titulo: "Auto-agendamento via Portal"
            });

            if (error) throw error;

            toast({
                title: "Solicitação Enviada! 🎉",
                description: "Seu horário foi reservado. Aguarde a confirmação.",
            });
            navigate("/paciente/agenda");
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Erro ao agendar",
                description: err.message || "Tente novamente mais tarde.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const diasComSlots = getSlotsDisponiveis();

    return (
        <PatientLayout>
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/paciente/agenda")} className="rounded-2xl">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-black text-slate-900 uppercase italic">Novo Agendamento</h1>
                        <p className="text-slate-500 font-medium tracking-tight">Escolha o melhor dia e horário para sua próxima sessão.</p>
                    </div>
                </div>

                {!config ? (
                    <div className="text-center py-20 bg-slate-50 rounded-[3rem] border border-slate-100">
                        <Loader2 className="h-10 w-10 animate-spin text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500 font-bold uppercase italic tracking-widest text-sm">Carregando horários...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Selector Section */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Week Nav */}
                            <div className="flex items-center justify-between bg-white p-4 rounded-3xl shadow-sm border border-slate-100">
                                <Button variant="ghost" onClick={() => setSemanaOffset(p => Math.max(0, p - 1))} disabled={semanaOffset === 0}>
                                    <ChevronLeft className="h-5 w-5 mr-1" /> Anterior
                                </Button>
                                <span className="text-sm font-black uppercase italic text-indigo-600">
                                    {semanaOffset === 0 ? "Esta Semana" : `Semana +${semanaOffset}`}
                                </span>
                                <Button variant="ghost" onClick={() => setSemanaOffset(p => p + 1)}>
                                    Próxima <ChevronRight className="h-5 w-5 ml-1" />
                                </Button>
                            </div>

                            {/* Days Grid */}
                            <div className="space-y-4">
                                {diasComSlots.map((dia: any) => (
                                    <div key={dia.data.toISOString()} className="bg-white rounded-[2.5rem] shadow-sm border border-slate-50 overflow-hidden">
                                        <div className="bg-slate-50/50 px-6 py-4 flex items-center justify-between border-b border-slate-100">
                                            <div className="flex items-center gap-3">
                                                <CalendarIcon className="h-4 w-4 text-indigo-500" />
                                                <span className="font-black text-slate-700 uppercase italic text-sm">
                                                    {format(dia.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-2 py-1 rounded-lg">
                                                {dia.slots.length} Horários
                                            </span>
                                        </div>
                                        <div className="p-4 grid grid-cols-3 sm:grid-cols-4 gap-3">
                                            {dia.slots.map((slot: any) => (
                                                <button
                                                    key={slot.dataInicio.toISOString()}
                                                    onClick={() => setSelectedSlot(slot)}
                                                    className={cn(
                                                        "group flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95",
                                                        selectedSlot?.dataInicio.toISOString() === slot.dataInicio.toISOString()
                                                            ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                                                            : "bg-white border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30"
                                                    )}
                                                >
                                                    <Clock className={cn("h-4 w-4 mb-2 opacity-30", selectedSlot === slot && "opacity-100")} />
                                                    <span className="text-base font-black italic">{slot.hora}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Confirmation Card */}
                        <div className="space-y-6">
                            <div className={cn(
                                "sticky top-8 bg-white rounded-[3rem] p-8 shadow-2xl border transition-all duration-300",
                                selectedSlot ? "border-indigo-100 opacity-100" : "border-slate-50 opacity-10 blur-[1px] pointer-events-none"
                            )}>
                                <div className="text-center space-y-6">
                                    <div className="h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto text-indigo-600 shrink-0">
                                        <CheckCircle2 className="h-8 w-8" />
                                    </div>
                                    <div className="space-y-1">
                                        <h2 className="text-xl font-black text-slate-900 uppercase italic">Confirmar Sessão</h2>
                                        <p className="text-sm text-slate-500 font-medium">Revise os detalhes abaixo antes de reservar.</p>
                                    </div>

                                    {selectedSlot && (
                                        <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Data Selecionada</p>
                                                <p className="text-sm font-black text-slate-900 capitalize">
                                                    {format(selectedSlot.dataInicio, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-1">Horário</p>
                                                <p className="text-3xl font-black text-indigo-600 italic tracking-tighter">{selectedSlot.hora}</p>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleConfirmBooking}
                                        disabled={isSubmitting || !selectedSlot}
                                        className="w-full h-16 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl text-lg shadow-xl shadow-indigo-100 transition-all active:scale-95"
                                    >
                                        {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin mr-2" /> : "Confirmar Agora"}
                                    </Button>

                                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest pt-4">
                                        Sua reserva passará por análise
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </PatientLayout>
    );
};

export default PatientBooking;
