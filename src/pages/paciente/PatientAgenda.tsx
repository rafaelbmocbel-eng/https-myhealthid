import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    ExternalLink,
    CheckCircle2,
    Activity,
    Info,
    User
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientAgenda = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    // 1. Buscar dados do registro clínico associado ao user_id
    const { data: pacienteData } = useQuery({
        queryKey: ["patient-clinical-data", user?.id],
        queryFn: async () => {
            const { data } = await supabase
                .from("pacientes")
                .select("id")
                .eq("user_id", user?.id)
                .maybeSingle();
            return data;
        },
        enabled: !!user?.id
    });

    const { data: appointments = [], isLoading, refetch } = useQuery({
        queryKey: ["patient-all-appointments", pacienteData?.id],
        queryFn: async () => {
            if (!pacienteData?.id) return [];

            const { data, error } = await supabase
                .from("agendamentos")
                .select("id, data_inicio, data_fim, status, tipo_atendimento, terapeuta_id")
                .eq("paciente_id", pacienteData.id)
                .neq("status", "cancelado")
                .order("data_inicio", { ascending: false });

            if (error) throw error;

            const rows = data || [];
            const therapistIds = [...new Set(rows.map((row) => row.terapeuta_id).filter(Boolean))];

            if (therapistIds.length === 0) return rows;

            const { data: therapistProfiles, error: therapistError } = await supabase
                .from("profiles")
                .select("user_id, nome, sobrenome, especialidade, avatar_url")
                .in("user_id", therapistIds);

            if (therapistError) {
                console.error("Erro ao carregar perfis dos terapeutas:", therapistError);
            }

            const profileByUserId = new Map((therapistProfiles || []).map((p) => [p.user_id, p]));

            return rows.map((row) => ({
                ...row,
                therapist: profileByUserId.get(row.terapeuta_id) || null,
            }));
        },
        enabled: !!pacienteData?.id
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

    const futureAppointments = appointments?.filter(appt => isAfter(new Date(appt.data_inicio), new Date())) || [];
    const pastAppointments = appointments?.filter(appt => !isAfter(new Date(appt.data_inicio), new Date())) || [];

    return (
        <PatientLayout>
            <div className="max-w-5xl mx-auto space-y-10">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-slate-900 italic uppercase">Meus Compromissos</h1>
                    <p className="text-slate-500 font-medium">Gerencie suas sessões agendadas e visualize seu histórico de cuidado.</p>
                </div>

                {isLoading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-white rounded-[2rem] animate-pulse shadow-sm border border-slate-100" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Próximas Consultas */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                    <Clock className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Próximas Sessões</h2>
                            </div>

                            {futureAppointments.length > 0 ? (
                                <div className="grid gap-6">
                                    {futureAppointments.slice().reverse().map((appt) => (
                                        <Card key={appt.id} className="border-none shadow-xl hover:shadow-2xl transition-all group rounded-[2.5rem] overflow-hidden">
                                            <CardContent className="p-0">
                                                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-50">
                                                    {/* Data Card */}
                                                    <div className="p-8 md:w-40 bg-indigo-600 flex flex-col items-center justify-center shrink-0 space-y-1">
                                                        <span className="text-[10px] font-black uppercase text-indigo-200 tracking-[0.2em]">{format(new Date(appt.data_inicio), "MMM", { locale: ptBR })}</span>
                                                        <span className="text-4xl font-black text-white leading-none tracking-tighter">{format(new Date(appt.data_inicio), "dd")}</span>
                                                        <span className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">{format(new Date(appt.data_inicio), "EEEE", { locale: ptBR })}</span>
                                                    </div>

                                                    {/* Main Info */}
                                                    <div className="p-8 flex-1 space-y-4">
                                                        <div className="flex items-center justify-between gap-4">
                                                            <Badge className="bg-emerald-100/50 text-emerald-700 hover:bg-emerald-100 border-none px-3 py-1 text-[10px] font-black uppercase">Confirmada</Badge>
                                                            <div className="flex items-center gap-2 text-slate-400 font-bold text-sm">
                                                                <Clock className="h-4 w-4" />
                                                                {format(new Date(appt.data_inicio), "HH:mm")} • {format(new Date(appt.data_fim), "HH:mm")}
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h3 className="font-black text-slate-900 text-2xl uppercase italic group-hover:text-indigo-600 transition-colors leading-tight">Consulta Clínica de Alto Rendimento</h3>
                                                            <div className="flex flex-wrap items-center gap-6 mt-4">
                                                                <div className="flex items-center gap-2 text-slate-600 font-bold">
                                                                    <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                                                                        <Activity className="h-4 w-4 text-indigo-600" />
                                                                    </div>
                                                                    Dr(a). {(appt as any).profiles?.nome} {(appt as any).profiles?.sobrenome}
                                                                </div>
                                                                <div className="flex items-center gap-2 text-slate-500 font-bold">
                                                                    <MapPin className="h-4 w-4 text-slate-300" />
                                                                    Studio MyHealthID
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="p-8 flex md:flex-col items-center justify-center gap-3 bg-slate-50/50">
                                                        <Button className="w-full bg-slate-900 hover:bg-black text-white font-black rounded-2xl h-12 shadow-lg transition-all active:scale-95">Detalhes</Button>
                                                        <Button
                                                            variant="ghost"
                                                            className="w-full text-rose-500 hover:bg-rose-50 font-black rounded-2xl h-12 text-sm uppercase tracking-tighter"
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
                                <div className="bg-white p-16 rounded-[3rem] border-4 border-dashed border-slate-100 text-center flex flex-col items-center gap-6">
                                    <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center shadow-inner">
                                        <CalendarIcon className="h-12 w-12 text-slate-200" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xl font-black text-slate-900 uppercase italic">Você está livre!</p>
                                        <p className="text-sm text-slate-500 font-medium max-w-sm">Nenhum compromisso agendado para os próximos dias. Que tal planejar sua próxima sessão?</p>
                                    </div>
                                    <Button onClick={() => navigate("/paciente/agendar")} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-[2rem] px-10 h-14 shadow-xl shadow-indigo-100 text-base active:scale-95 transition-all">
                                        Agendar Agora
                                    </Button>
                                </div>
                            )}
                        </section>

                        {/* Histórico */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shadow-inner">
                                    <Activity className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Histórico de Sessões</h2>
                            </div>

                            {pastAppointments.length > 0 ? (
                                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                                    {pastAppointments.map((appt) => (
                                        <div key={appt.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-all group">
                                            <div className="flex items-center gap-6">
                                                <div className="h-14 w-14 bg-indigo-50 rounded-2xl flex flex-col items-center justify-center text-indigo-600 shrink-0 border border-indigo-100/50">
                                                    <span className="text-[10px] font-black uppercase leading-tight">{format(new Date(appt.data_inicio), "MMM")}</span>
                                                    <span className="text-xl font-black leading-none">{format(new Date(appt.data_inicio), "dd")}</span>
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 text-lg uppercase italic group-hover:text-indigo-600 transition-colors">Sessão Finalizada</p>
                                                    <p className="text-xs text-slate-400 font-bold tracking-tight mt-1 flex items-center gap-2">
                                                        <User className="h-3 w-3" /> Dr(a). {(appt as any).profiles?.nome} • {format(new Date(appt.data_inicio), "HH:mm")}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <Badge className="bg-slate-100 text-slate-500 border-none font-black text-[9px] uppercase px-2 py-1">Realizada</Badge>
                                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl border-slate-100 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
                                                    <ExternalLink className="h-5 w-5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50/50 p-12 rounded-[2.5rem] text-center">
                                    <p className="text-slate-300 font-black italic uppercase tracking-widest text-sm">Seu histórico está sendo construído...</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </PatientLayout>
    );
};

export default PatientAgenda;
