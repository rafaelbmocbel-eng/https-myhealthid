import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    Calendar,
    ArrowRight,
    TrendingUp,
    CheckCircle2,
    Clock,
    Award
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientTests = () => {
    const { user } = useAuth();
    const navigate = useNavigate();

    // 1. Buscar registro do paciente
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

    // 2. Buscar histórico de avaliações concluídas (MyID)
    const { data: myidTests, isLoading: loadingMyid } = useQuery({
        queryKey: ["patient-myid-tests", pacienteData?.id],
        queryFn: async () => {
            if (!pacienteData?.id) return [];
            const { data } = await supabase
                .from("myid_avaliacoes")
                .select("*")
                .eq("paciente_id", pacienteData.id)
                .eq("status", "concluido")
                .order("created_at", { ascending: false });
            return data || [];
        },
        enabled: !!pacienteData?.id
    });

    // 3. Buscar avaliações COB Zero
    const { data: cobTests, isLoading: loadingCob } = useQuery({
        queryKey: ["patient-cob-tests", pacienteData?.id],
        queryFn: async () => {
            if (!pacienteData?.id) return [];
            const { data } = await supabase
                .from("avaliacoes_cob_zero")
                .select("*")
                .eq("paciente_id", pacienteData.id)
                .order("created_at", { ascending: false });
            return data || [];
        },
        enabled: !!pacienteData?.id
    });

    const isLoading = loadingMyid || loadingCob;

    return (
        <PatientLayout>
            <div className="max-w-5xl mx-auto space-y-10 pb-20">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-slate-900 italic uppercase">Meus Testes & Avaliações</h1>
                    <p className="text-slate-500 font-medium">Acompanhe seu histórico de desempenho clínico e sua evolução cronológica.</p>
                </div>

                {isLoading ? (
                    <div className="space-y-6">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-white rounded-[2.5rem] animate-pulse shadow-sm border border-slate-100" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-12">
                        {/* Avaliações MyID */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                    <Activity className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Avaliações MyID Fingerprint</h2>
                            </div>

                            {myidTests && myidTests.length > 0 ? (
                                <div className="grid gap-4">
                                    {myidTests.map((test) => (
                                        <div key={test.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:translate-x-2 transition-all group flex flex-col sm:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-indigo-100 group-hover:rotate-6 transition-transform">
                                                    <Award className="h-7 w-7" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="text-lg font-black text-slate-900 uppercase italic leading-none">Avaliação MyID</h3>
                                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(test.created_at), "dd/MM/yyyy")}</span>
                                                        <span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Concluído</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <Button variant="ghost" className="flex-1 sm:flex-none h-12 rounded-2xl font-black text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 gap-2">
                                                    Ver Relatório <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50/50 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-slate-100">
                                    <p className="text-slate-300 font-black italic uppercase tracking-widest text-sm">Nenhuma avaliação MyID concluída ainda.</p>
                                </div>
                            )}
                        </section>

                        {/* Avaliações COB Zero */}
                        <section className="space-y-6">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 shadow-inner">
                                    <TrendingUp className="h-6 w-6" />
                                </div>
                                <h2 className="text-xl font-black text-slate-900 uppercase italic">Testes Funcionais COB Zero</h2>
                            </div>

                            {cobTests && cobTests.length > 0 ? (
                                <div className="grid gap-4">
                                    {cobTests.map((test) => (
                                        <div key={test.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:translate-x-2 transition-all group flex flex-col sm:flex-row items-center justify-between gap-6">
                                            <div className="flex items-center gap-6">
                                                <div className="h-14 w-14 bg-emerald-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-emerald-100 group-hover:rotate-6 transition-transform">
                                                    <Activity className="h-7 w-7" />
                                                </div>
                                                <div className="space-y-1">
                                                    <h3 className="text-lg font-black text-slate-900 uppercase italic leading-none">Avaliação COB Zero</h3>
                                                    <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-widest">
                                                        <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {format(new Date(test.created_at), "dd/MM/yyyy")}</span>
                                                        <span className="flex items-center gap-1 text-emerald-600 font-black"><span className="text-[10px] text-slate-300 mr-2">VALOR:</span> {test.score_final?.toFixed(1) || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4 w-full sm:w-auto">
                                                <Button variant="ghost" className="flex-1 sm:flex-none h-12 rounded-2xl font-black text-emerald-600 hover:bg-emerald-50 border border-transparent hover:border-emerald-100 gap-2">
                                                    Detalhes <ArrowRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-slate-50/50 p-12 rounded-[2.5rem] text-center border-2 border-dashed border-slate-100">
                                    <p className="text-slate-300 font-black italic uppercase tracking-widest text-sm">Nenhuma avaliação COB Zero registrada.</p>
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </PatientLayout>
    );
};

export default PatientTests;
