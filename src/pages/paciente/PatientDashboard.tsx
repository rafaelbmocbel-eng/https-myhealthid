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
    Activity,
    Heart,
    Footprints,
    Moon,
    Zap,
    CreditCard,
    Clock,
    ExternalLink,
    Watch,
    AlertCircle
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import PatientRadarFingerprint from "@/components/paciente/PatientRadarFingerprint";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientDashboard = () => {
    const { profile, user } = useAuth();
    const navigate = useNavigate();

    // 1. Buscar dados do registro clínico associado ao user_id
    const { data: pacienteData, isLoading: loadingPac } = useQuery({
        queryKey: ["patient-clinical-data", user?.id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("pacientes")
                .select("*")
                .eq("user_id", user?.id)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!user?.id
    });

    // 2. Buscar a próxima consulta
    const { data: nextAppointment, isLoading: loadingAppt } = useQuery({
        queryKey: ["patient-next-appointment", pacienteData?.id],
        queryFn: async () => {
            if (!pacienteData?.id) return null;

            const { data: appointment, error: appointmentError } = await supabase
                .from("agendamentos")
                .select("id, data_inicio, data_fim, status, tipo_atendimento, terapeuta_id")
                .eq("paciente_id", pacienteData.id)
                .gte("data_inicio", new Date().toISOString())
                .order("data_inicio", { ascending: true })
                .limit(1)
                .maybeSingle();

            if (appointmentError) throw appointmentError;
            if (!appointment) return null;

            const { data: therapist, error: therapistError } = await supabase
                .from("profiles")
                .select("user_id, nome, sobrenome, especialidade, avatar_url")
                .eq("user_id", appointment.terapeuta_id)
                .maybeSingle();

            if (therapistError) {
                console.error("Erro ao buscar terapeuta:", therapistError);
            }

            return {
                ...appointment,
                therapist: therapist ?? null,
            };
        },
        enabled: !!pacienteData?.id
    });

    // 3. Buscar questionários pendentes
    const { data: pendingQuestionnaires = [], isLoading: loadingQuests } = useQuery({
        queryKey: ["patient-pending-questionnaires", pacienteData?.id],
        queryFn: async () => {
            if (!pacienteData?.id) return [];

            const { data, error } = await supabase
                .from("myid_avaliacoes")
                .select("id, status, token_acesso, created_at")
                .eq("paciente_id", pacienteData.id)
                .eq("status", "pendente");

            if (error) throw error;
            return data || [];
        },
        enabled: !!pacienteData?.id
    });

    // 4. Buscar o MyID Fingerprint (última avaliação)
    const { data: latestEvaluation, isLoading: loadingEval } = useQuery({
        queryKey: ["patient-latest-evaluation", pacienteData?.id],
        queryFn: async () => {
            if (!pacienteData?.id) return null;

            const { data, error } = await supabase
                .from("avaliacoes_identidade")
                .select("score_e, score_p, score_c, score_f, score_d, score_r, score_efi")
                .eq("paciente_id", pacienteData.id)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        enabled: !!pacienteData?.id
    });

    // 5. Stats de tarefas (mockado por enquanto)
    const taskStats = { total: 3, completed: 1 };
    const loadingTasks = false;

    return (
        <PatientLayout>
            <div className="space-y-8 max-w-7xl mx-auto">
                {/* Boas vindas se não houver consultas ainda */}
                {pacienteData && !nextAppointment && !loadingAppt && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-[2rem] p-8 flex flex-col items-center text-center gap-4">
                        <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-sm shadow-indigo-100">
                            <Activity className="h-8 w-8" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-indigo-900 text-xl font-black italic uppercase">Bem-vindo à sua nova jornada!</h3>
                            <p className="text-indigo-700/70 text-sm max-w-md font-medium">Seu espaço exclusivo está pronto. Suas métricas e agendamentos aparecerão aqui conforme as sessões forem programadas.</p>
                        </div>
                    </div>
                )}

                {/* Questionários em Atraso / Urgentes */}
                {(pendingQuestionnaires?.length ?? 0) > 0 && (
                    <div className="bg-gradient-to-r from-rose-500/10 to-pink-500/10 border border-rose-500/20 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-rose-500/20 rounded-2xl flex items-center justify-center">
                                <AlertCircle className="h-7 w-7 text-rose-600" />
                            </div>
                            <div>
                                <p className="text-base font-black text-rose-950 uppercase italic tracking-tight">Questionários Pendentes</p>
                                <p className="text-sm text-rose-900/70 font-medium">Você tem {pendingQuestionnaires?.length} avaliação(ões) pendente(s). Seu feedback é vital para o tratamento.</p>
                            </div>
                        </div>
                        <Button
                            onClick={() => navigate("/paciente/questionarios")}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-black rounded-2xl shadow-xl shadow-rose-200 px-8 h-12"
                        >
                            Responder Agora
                        </Button>
                    </div>
                )}

                {/* Check-in Banner para Próxima Consulta */}
                {nextAppointment && (
                    <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-amber-500/20 rounded-2xl flex items-center justify-center">
                                <ClipboardCheck className="h-7 w-7 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-base font-black text-amber-950 uppercase italic tracking-tight">Próxima Consulta: Check-in Aberto</p>
                                <p className="text-sm text-amber-900/70 font-medium">Prepare-se para sua consulta com Dr(a). {nextAppointment.therapist?.nome || "seu terapeuta"}.</p>
                            </div>
                        </div>
                        <Button className="bg-amber-600 hover:bg-amber-700 text-white font-black rounded-2xl shadow-xl shadow-amber-200 px-8 h-12">
                            Check-in Agora
                        </Button>
                    </div>
                )}

                {/* MyID Radar Fingerprint Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <PatientRadarFingerprint
                            scores={latestEvaluation}
                            isLoading={loadingEval}
                            className="h-full"
                        />
                    </div>
                    <div className="flex flex-col gap-6">
                        <Card className="border-none shadow-2xl bg-indigo-600 text-white overflow-hidden rounded-[2.5rem] flex-1 group">
                            <CardContent className="p-8 flex flex-col justify-between h-full relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-500" />

                                <div className="relative z-10">
                                    <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                                        <CreditCard className="h-7 w-7" />
                                    </div>
                                    <h3 className="text-2xl font-black leading-tight mb-3 italic uppercase">Seu Hub Financeiro</h3>
                                    <p className="text-indigo-100/80 text-sm font-medium">Acompanhe suas sessões, faturas e planos com total transparência.</p>
                                </div>
                                <Button
                                    onClick={() => navigate("/paciente/financeiro")}
                                    className="bg-white text-indigo-600 hover:bg-indigo-50 font-black rounded-2xl w-full mt-8 py-7 shadow-xl active:scale-95 transition-all text-base relative z-10"
                                >
                                    Abrir Financeiro
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Quick Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="border-none shadow-sm bg-white hover:translate-y-[-4px] transition-all rounded-3xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-inner">
                                    <Calendar className="h-6 w-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-bold">Próxima Consulta</span>
                            </div>
                            {loadingAppt ? (
                                <div className="h-10 w-24 bg-slate-100 animate-pulse rounded-xl" />
                            ) : nextAppointment ? (
                                <div className="space-y-1">
                                    <p className="text-lg font-black text-slate-900 leading-tight">
                                        {format(new Date(nextAppointment.data_inicio), "dd 'de' MMM", { locale: ptBR })}
                                    </p>
                                    <p className="text-xs text-slate-500 font-bold truncate opacity-70">
                                        às {format(new Date(nextAppointment.data_inicio), "HH:mm")} • Dr. {nextAppointment.therapist?.nome || "Terapeuta"}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <p className="text-lg font-black text-slate-300 italic uppercase">Nenhuma</p>
                                    <p className="text-xs text-slate-400 font-bold">Solicite um horário</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white hover:translate-y-[-4px] transition-all rounded-3xl font-bold">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="h-10 w-10 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center shadow-inner">
                                    <ClipboardCheck className="h-6 w-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tarefas Pendentes</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-lg font-black text-slate-900 leading-tight">{pendingQuestionnaires?.length || 0} Ações</p>
                                <div className="flex items-center gap-1.5">
                                    <div className={cn("h-1.5 w-1.5 rounded-full animate-pulse", (pendingQuestionnaires?.length || 0) > 0 ? "bg-rose-500" : "bg-emerald-500")} />
                                    <p className={cn("text-[10px] font-black uppercase tracking-wider", (pendingQuestionnaires?.length || 0) > 0 ? "text-rose-500" : "text-emerald-500")}>
                                        {(pendingQuestionnaires?.length || 0) > 0 ? "Urgente" : "Tudo em dia"}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white hover:translate-y-[-4px] transition-all rounded-3xl font-bold">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="h-10 w-10 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-inner">
                                    <Trophy className="h-6 w-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Meu Score</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-lg font-black text-slate-900 leading-tight">{profile?.total_points || 0} <span className="text-slate-300">PTS</span></p>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider opacity-60">⭐ Nível {profile?.current_level || 'Bronze'}</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white hover:translate-y-[-4px] transition-all rounded-3xl font-bold">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="h-10 w-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shadow-inner">
                                    <CheckCircle2 className="h-6 w-6" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Atividades</span>
                            </div>
                            <div className="space-y-1">
                                <p className="text-lg font-black text-slate-900 leading-tight">
                                    {loadingTasks ? "..." : `${taskStats?.completed || 0} / ${taskStats?.total || 0}`}
                                </p>
                                <p className="text-[10px] text-slate-500 font-black uppercase tracking-wider opacity-60">Foco do Dia</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Smartwatch Row */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                            Métricas Biométricas (Wearables) <Badge className="bg-indigo-100 text-indigo-700 border-none h-4 px-1 text-[8px]">LIVE</Badge>
                        </h2>
                        <Button variant="ghost" size="sm" className="text-indigo-600 font-black text-xs hover:bg-indigo-50 rounded-xl gap-2 transition-all">Sincronizar <Watch className="h-4 w-4" /></Button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                            { label: "Freq. Cardíaca", val: "72", unit: "bpm", icon: Heart, color: "rose" },
                            { label: "Passos do Dia", val: "4.520", unit: "", icon: Footprints, color: "blue" },
                            { label: "Qualidade Sono", val: "7.2", unit: "hrs", icon: Moon, color: "indigo" },
                            { label: "Gasto Calórico", val: "320", unit: "kcal", icon: Zap, color: "orange" },
                        ].map((item, idx) => (
                            <div key={idx} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4 hover:shadow-md transition-all hover:scale-[1.02]">
                                <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", `bg-${item.color}-50 text-${item.color}-600 shadow-inner`)}>
                                    <item.icon className="h-7 w-7" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400 mb-0.5">{item.label}</p>
                                    <p className="text-xl font-black text-slate-900">
                                        {item.val}
                                        {item.unit && <span className="text-[10px] text-slate-300 uppercase ml-1 font-bold">{item.unit}</span>}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Bottom Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pb-12">
                    {/* Saúde Mental e Humor */}
                    <Card className="border-none shadow-sm overflow-hidden bg-white rounded-[2.5rem]">
                        <CardHeader className="border-b border-slate-50 bg-slate-50/30 p-6">
                            <CardTitle className="text-base font-black flex items-center gap-2 italic uppercase">
                                <TrendingUp className="h-5 w-5 text-indigo-600" /> Meu Bem-Estar Semanal
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-10 flex flex-col items-center justify-center text-center space-y-6">
                            <div className="h-28 w-28 bg-indigo-50 rounded-full flex items-center justify-center shadow-inner relative group">
                                <Activity className="h-12 w-12 text-indigo-300 animate-pulse" />
                                <div className="absolute inset-0 rounded-full border-4 border-indigo-100/50 border-t-indigo-600 animate-spin-slow opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="space-y-2 font-bold">
                                <h3 className="font-black text-slate-900 text-lg uppercase italic">Diário Clínico Digital</h3>
                                <p className="text-sm text-slate-500 max-w-[280px] font-medium leading-relaxed font-bold">Como você está hoje? Registrar seu humor e nível de dor ajuda no seu plano de cuidado personalizado.</p>
                            </div>
                            <Button
                                variant="outline"
                                className="font-black text-indigo-600 border-indigo-100 hover:bg-indigo-50 rounded-2xl px-8 h-12 shadow-sm transition-all active:scale-95"
                                onClick={() => navigate("/paciente/diario")}
                            >
                                Registrar Meu Dia
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Próximas Atividades e Sessões */}
                    <Card className="border-none shadow-sm bg-white overflow-hidden rounded-[2.5rem]">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-slate-50 bg-slate-50/30 p-6">
                            <CardTitle className="text-base font-black flex items-center gap-2 italic uppercase">
                                <Calendar className="h-5 w-5 text-indigo-600" /> Minha Agenda Clínica
                            </CardTitle>
                            <Button variant="ghost" size="sm" className="text-xs text-indigo-600 font-bold hover:bg-indigo-50 px-4 h-9 rounded-xl font-black" onClick={() => navigate("/paciente/agenda")}>Abrir Agenda</Button>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-slate-50">
                                {nextAppointment ? (
                                    <div className="flex gap-5 p-6 hover:bg-indigo-50/30 transition-all group cursor-pointer">
                                        <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex flex-col items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-100 transition-transform group-hover:scale-105">
                                            <span className="text-[10px] font-black uppercase tracking-widest opacity-80 font-bold">{format(new Date(nextAppointment.data_inicio), "MMM", { locale: ptBR })}</span>
                                            <span className="text-2xl font-black leading-none">{format(new Date(nextAppointment.data_inicio), "dd")}</span>
                                        </div>
                                        <div className="flex-1 min-w-0 py-1">
                                            <h4 className="font-black text-slate-900 text-base italic uppercase leading-tight">Consulta de Especialidade</h4>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-2">
                                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-600" /> Dr(a). {nextAppointment.therapist?.nome || "Terapeuta"}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-1">
                                                <Clock className="h-3.5 w-3.5 text-slate-400" /> {format(new Date(nextAppointment.data_inicio), "HH:mm")}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end justify-center py-1">
                                            <Badge className="bg-emerald-100/50 text-emerald-700 hover:bg-emerald-100 border-none text-[10px] font-black uppercase px-2 py-1">Confirmado</Badge>
                                            <Button variant="ghost" size="icon" className="h-10 w-10 text-slate-300 mt-2 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
                                                <ExternalLink className="h-5 w-5" />
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-16 text-center flex flex-col items-center gap-4">
                                        <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center shadow-inner">
                                            <Calendar className="h-10 w-10 text-slate-200" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-slate-400 uppercase italic">Nenhum evento futuro</p>
                                            <Button onClick={() => navigate("/paciente/agendar")} variant="link" className="text-indigo-600 font-bold h-auto p-0 font-black">Agendar Agora</Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </PatientLayout >
    );
};

export default PatientDashboard;
