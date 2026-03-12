import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
    CreditCard,
    Receipt,
    Wallet,
    CheckCircle2,
    CalendarDays,
    Clock,
    DollarSign,
    TrendingUp,
    ShieldCheck
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import PatientLayout from "@/components/paciente/PatientLayout";

const PatientFinanceiro = () => {
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

    const { data: sessoes, isLoading } = useQuery({
        queryKey: ["patient-financial-sessions", pacienteData?.id],
        queryFn: async () => {
            if (!pacienteData?.id) return [];

            const { data } = await supabase
                .from("controle_sessoes")
                .select("*")
                .eq("paciente_id", pacienteData.id)
                .order("data_sessao", { ascending: false });

            return data || [];
        },
        enabled: !!pacienteData?.id
    });

    const totalInvestido = sessoes?.reduce((acc, sessao) => acc + (sessao.valor_cobrado || 0), 0) || 0;
    const sessoesRealizadas = sessoes?.length || 0;

    return (
        <PatientLayout>
            <div className="max-w-5xl mx-auto space-y-10">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-black text-slate-900 italic uppercase leading-none tracking-tight">Meu Financeiro</h1>
                    <p className="text-slate-500 font-medium">Controle total e transparência absoluta sobre seu investimento em saúde.</p>
                </div>

                {/* Resumo Financeiro */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="border-none shadow-2xl bg-indigo-600 text-white overflow-hidden rounded-[2.5rem] relative group">
                        <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-700">
                            <Wallet size={120} />
                        </div>
                        <CardContent className="p-10 relative z-10">
                            <p className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em] mb-2">Investimento Total Acumulado</p>
                            <h2 className="text-4xl font-black tracking-tighter">R$ {totalInvestido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                            <div className="mt-6 flex items-center gap-3">
                                <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                                    <div className="h-full bg-white rounded-full w-full opacity-80" />
                                </div>
                                <span className="text-xs font-black whitespace-nowrap">{sessoesRealizadas} Sessões</span>
                            </div>
                            <p className="mt-4 text-indigo-100/60 text-[10px] font-bold uppercase flex items-center gap-2">
                                <ShieldCheck className="h-3 w-3" /> Transações Protegidas e Auditadas
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl bg-white overflow-hidden rounded-[2.5rem] group border border-slate-100">
                        <CardContent className="p-10 flex flex-col justify-center h-full">
                            <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">Último Lançamento Clínico</p>
                            <div className="flex items-center gap-5">
                                <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-[1.5rem] flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform">
                                    <DollarSign className="h-8 w-8" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                                        {sessoes?.[0]?.valor_cobrado ? `R$ ${sessoes[0].valor_cobrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '---'}
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-emerald-100/50 text-emerald-700 border-none text-[9px] font-black uppercase px-2 py-0.5">Sessão Finalizada</Badge>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase font-black">{sessoes?.[0]?.data_sessao ? format(new Date(sessoes[0].data_sessao), "dd 'de' MMM", { locale: ptBR }) : ''}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Histórico Detalhado */}
                <section className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-inner">
                                <CalendarDays className="h-6 w-6" />
                            </div>
                            <h2 className="text-xl font-black text-slate-900 uppercase italic">Histórico de Movimentações</h2>
                        </div>
                        <Button variant="ghost" size="sm" className="text-indigo-600 font-black text-xs hover:bg-indigo-50 rounded-xl gap-2">Exportar Extrato <TrendingUp className="h-4 w-4" /></Button>
                    </div>

                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-24 bg-white rounded-[2rem] animate-pulse shadow-sm border border-slate-100" />
                            ))}
                        </div>
                    ) : sessoes && sessoes.length > 0 ? (
                        <div className="grid gap-4">
                            {sessoes.map((sessao) => (
                                <Card key={sessao.id} className="border-none shadow-sm hover:shadow-md transition-all group rounded-[2rem] overflow-hidden border border-slate-100/50 hover:border-indigo-100">
                                    <CardContent className="p-6 flex items-center justify-between">
                                        <div className="flex items-center gap-6">
                                            <div className="h-14 w-14 bg-slate-50 group-hover:bg-indigo-50 rounded-2xl flex flex-col items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors border border-slate-100/50">
                                                <span className="text-[10px] font-black uppercase leading-tight">{format(new Date(sessao.data_sessao), "MMM")}</span>
                                                <span className="text-xl font-black leading-none">{format(new Date(sessao.data_sessao), "dd")}</span>
                                            </div>
                                            <div>
                                                <h4 className="font-black text-slate-900 text-lg italic uppercase leading-none group-hover:text-indigo-600 transition-colors">Sessão Individual #{sessao.numero_sessao}</h4>
                                                <div className="flex items-center gap-4 mt-2">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase flex items-center gap-1.5">
                                                        <Clock className="h-3.5 w-3.5 opacity-40" /> {sessao.duracao_minutos || 45} MINUTOS
                                                    </span>
                                                    <Badge variant="outline" className="text-[8px] font-black uppercase text-indigo-500 border-indigo-100 bg-indigo-50/50 px-2 py-0.5 rounded-lg">
                                                        {sessao.tipo_atendimento || 'PRESENCIAL'}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right space-y-1">
                                            <div className="font-black text-slate-900 text-xl tracking-tighter">R$ {(sessao.valor_cobrado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                                            <div className="flex items-center justify-end gap-1.5">
                                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                <span className="text-[9px] text-emerald-600 font-black uppercase tracking-widest">{sessao.status || 'CONCLUÍDA'}</span>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white p-20 rounded-[3rem] border-4 border-dashed border-slate-100 text-center flex flex-col items-center gap-6">
                            <div className="h-24 w-24 bg-slate-50 rounded-full flex items-center justify-center shadow-inner">
                                <Receipt className="h-12 w-12 text-slate-200" />
                            </div>
                            <div className="space-y-2">
                                <p className="text-xl font-black text-slate-900 italic uppercase tracking-tight">Transparência MyHealthID</p>
                                <p className="text-sm text-slate-500 font-medium max-w-sm">Nenhum registro financeiro disponível no momento. Seus investimentos aparecerão aqui assim que forem validados pelo seu profissional.</p>
                            </div>
                        </div>
                    )}
                </section>

                <div className="bg-indigo-50 border border-indigo-100 rounded-[2.5rem] p-8 text-center shadow-inner">
                    <p className="text-indigo-800 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed max-w-2xl mx-auto opacity-70">
                        Ambiente de Controle Clínico MyHealthID • Todos os valores, planos e parcelas exibidos são geridos exclusivamente pelo seu profissional de saúde responsável por este portal.
                    </p>
                </div>
            </div>
        </PatientLayout>
    );
};

export default PatientFinanceiro;
