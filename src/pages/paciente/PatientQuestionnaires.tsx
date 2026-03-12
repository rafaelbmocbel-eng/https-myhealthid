import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
    ClipboardCheck,
    CheckCircle2,
    Clock,
    ArrowRight,
    Sparkles,
    FileText,
    AlertCircle,
    Inbox
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientQuestionnaires = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();

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

    const { data: assessments, isLoading } = useQuery({
        queryKey: ["patient-assessments", pacienteData?.id],
        queryFn: async () => {
            if (!pacienteData?.id) return [];

            const { data } = await supabase
                .from("myid_avaliacoes")
                .select("*")
                .eq("paciente_id", pacienteData.id)
                .order("created_at", { ascending: false });

            return data || [];
        },
        enabled: !!pacienteData?.id
    });

    const pending = assessments?.filter(a => a.status === 'pendente') || [];
    const completed = assessments?.filter(a => a.status === 'concluido') || [];

    return (
        <PatientLayout>
            <div className="max-w-5xl mx-auto space-y-10">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-slate-900 italic uppercase leading-none tracking-tight">Avaliações & Feedbacks</h1>
                    <p className="text-slate-500 font-medium">Sua voz é o guia do seu tratamento. Responda aos questionários para otimizar seus resultados.</p>
                </div>

                {isLoading ? (
                    <div className="grid gap-6">
                        {[1, 2].map(i => (
                            <div key={i} className="h-40 bg-white rounded-[2.5rem] animate-pulse shadow-sm border border-slate-100" />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-12">
                        {/* Questionários Pendentes */}
                        <section className="space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 shadow-inner">
                                        <AlertCircle className="h-6 w-6" />
                                    </div>
                                    <h2 className="text-xl font-black text-slate-900 uppercase italic">Ações Necessárias ({pending.length})</h2>
                                </div>
                                {pending.length > 0 && (
                                    <Badge className="bg-orange-500 text-white border-none py-1.5 px-4 rounded-full font-black text-[10px] uppercase tracking-widest shadow-lg shadow-orange-100 animate-pulse">
                                        Ganhe +50 Pontos
                                    </Badge>
                                )}
                            </div>

                            {pending.length > 0 ? (
                                <div className="grid gap-6">
                                    {pending.map((a) => (
                                        <Card key={a.id} className="border-none shadow-xl hover:shadow-2xl transition-all group bg-white rounded-[2.5rem] overflow-hidden border border-slate-100/50 hover:border-orange-100">
                                            <CardContent className="p-0">
                                                <div className="flex flex-col md:flex-row">
                                                    <div className="p-8 flex-1 space-y-6">
                                                        <div className="flex items-start justify-between">
                                                            <div className="space-y-2">
                                                                <h3 className="text-2xl font-black text-slate-900 group-hover:text-orange-600 transition-colors uppercase tracking-tight italic leading-tight">Avaliação Clínica MyID</h3>
                                                                <div className="flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest">
                                                                    <Inbox className="h-3.5 w-3.5" /> Recebido em {format(new Date(a.created_at), "dd 'de' MMMM", { locale: ptBR })}
                                                                </div>
                                                            </div>
                                                            <Badge className="bg-orange-100 text-orange-700 border-none px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest">Pendente</Badge>
                                                        </div>
                                                        <div className="flex items-center gap-6 text-xs font-black text-slate-400 uppercase tracking-tighter">
                                                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg"><Clock className="h-4 w-4 text-orange-400" /> 5-10 MINUTOS</div>
                                                            <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg"><FileText className="h-4 w-4 text-orange-400" /> MULTIDIMENSIONAL</div>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50/50 group-hover:bg-orange-50/30 p-8 flex items-center justify-center shrink-0 transition-colors">
                                                        <Button
                                                            onClick={() => navigate(`/myid/responder/${a.token_acesso}`)}
                                                            className="bg-orange-600 hover:bg-orange-700 text-white font-black rounded-2xl px-10 h-14 shadow-xl shadow-orange-100 active:scale-95 transition-all text-base uppercase italic"
                                                        >
                                                            Iniciar Resposta <ArrowRight className="ml-2 h-5 w-5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-white p-20 rounded-[3rem] border-4 border-dashed border-slate-100 text-center flex flex-col items-center gap-6">
                                    <div className="h-24 w-24 bg-emerald-50 rounded-full flex items-center justify-center shadow-inner">
                                        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-xl font-black text-slate-900 uppercase italic">Foco Total no Cuidado</p>
                                        <p className="text-sm text-slate-500 font-medium max-w-sm">Você completou todas as avaliações pendentes. Agora é só focar na sua evolução!</p>
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Concluídos */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 shadow-inner">
                                    <ClipboardCheck className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Histórico de Feedbacks</h2>
                            </div>

                            {completed.length > 0 ? (
                                <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                                    {completed.map((a) => (
                                        <div key={a.id} className="p-6 flex items-center justify-between hover:bg-emerald-50/30 transition-all group">
                                            <div className="flex items-center gap-6">
                                                <div className="h-14 w-14 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 border border-emerald-100/30 group-hover:scale-110 transition-transform">
                                                    <FileText className="h-7 w-7" />
                                                </div>
                                                <div>
                                                    <p className="font-black text-slate-900 text-lg uppercase italic group-hover:text-emerald-700 transition-colors leading-none mb-2">Avaliação MyID Finalizada</p>
                                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Processado em {format(new Date(a.updated_at || a.created_at), "dd/MM/yyyy")}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-xl text-slate-500 font-black text-[9px] uppercase tracking-widest">
                                                    <Sparkles className="h-3 w-3" /> +50 PTS
                                                </div>
                                                <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 transition-all">
                                                    <ArrowRight className="h-6 w-6" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50/50 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-slate-100">
                                    <p className="text-slate-300 font-black italic uppercase tracking-widest text-sm">Seu histórico de respostas aparecerá aqui.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </PatientLayout>
    );
};

export default PatientQuestionnaires;
