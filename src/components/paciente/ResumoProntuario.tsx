import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getMyIDInterpretation } from "@/utils/myidCalculations";
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, differenceInYears } from 'date-fns';
import { FileText, Activity, Zap, Award } from 'lucide-react';

interface Props {
    pacienteId: string;
}

export default function ResumoProntuario({ pacienteId }: Props) {
    const { profile } = useAuth();

    const { data: paciente, isLoading: loadingPac } = useQuery({
        queryKey: ['resumo-paciente', pacienteId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('pacientes')
                .select('*')
                .eq('id', pacienteId)
                .single();
            if (error) throw error;
            return data;
        },
    });

    const { data: protocolos = [], isLoading: loadingProt } = useQuery({
        queryKey: ['resumo-protocolos', pacienteId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('protocolos')
                .select('*')
                .eq('paciente_id', pacienteId)
                .order('created_at', { ascending: false })
                .limit(2);
            if (error) throw error;
            return data || [];
        },
    });

    const { data: execucoes = [], isLoading: loadingExec } = useQuery({
        queryKey: ['resumo-execucoes', pacienteId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('studio_execucoes')
                .select(`
                    *,
                    studio_treinos (
                        titulo
                    )
                `)
                .eq('paciente_id', pacienteId)
                .order('data_execucao', { ascending: false })
                .limit(3);
            if (error) throw error;
            return data || [];
        },
    });

    const { data: myidResult } = useQuery({
        queryKey: ["myid-latest", pacienteId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("avaliacoes_identidade")
                .select("*")
                .eq("paciente_id", pacienteId)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        }
    });

    const myidDimScores = myidResult?.myid_score !== undefined ? {
        D: Number((myidResult.dados_avaliacao as any)?.resultado?.componentScores?.D ?? myidResult.score_d ?? 0),
        EFI: Number((myidResult.dados_avaliacao as any)?.resultado?.componentScores?.EFI ?? myidResult.score_efi ?? 0),
        P: Number((myidResult.dados_avaliacao as any)?.resultado?.componentScores?.P ?? myidResult.score_p ?? 0),
        I: Number((myidResult.dados_avaliacao as any)?.resultado?.componentScores?.I ?? myidResult.score_i ?? 0),
        N: Number((myidResult.dados_avaliacao as any)?.resultado?.componentScores?.N ?? myidResult.score_n ?? 0),
    } : undefined;
    const myidInterp = myidResult?.myid_score !== undefined
        ? getMyIDInterpretation(myidResult.myid_score, !!myidResult.red_flags || (myidResult.dados_avaliacao as any)?.resultado?.redFlagsDetected, myidDimScores)
        : null;

    if (loadingPac || loadingProt || loadingExec) {
        return <Skeleton className="h-[300px] w-full rounded-xl" />;
    }

    const p1 = protocolos[0];
    const p2 = protocolos[1];

    const temMudanca = p1 && p2 && (
        p1.objetivo_geral !== p2.objetivo_geral ||
        p1.frequencia !== p2.frequencia ||
        JSON.stringify(p1.scores_avaliacao) !== JSON.stringify(p2.scores_avaliacao)
    );

    const idade = paciente?.data_nascimento
        ? differenceInYears(new Date(), parseISO(paciente.data_nascimento))
        : null;

    return (
        <Card className="border-2 border-primary/10 shadow-sm bg-slate-50/50 overflow-hidden">
            <div className="bg-primary/5 px-4 py-2 border-b border-primary/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-primary">Resumo de Prontuário Automático</h3>
                </div>
                <Badge variant="outline" className="bg-white text-[10px] font-bold">
                    {format(new Date(), "dd/MM/yyyy")}
                </Badge>
            </div>

            <CardContent className="p-4 space-y-4">
                {/* Identificação */}
                <div className="grid grid-cols-2 gap-4 border-b border-dashed pb-3">
                    <div>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Paciente</span>
                        <p className="text-sm font-bold text-foreground truncate ">{paciente?.nome} {paciente?.sobrenome}</p>
                    </div>
                    <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Idade / Gênero</span>
                        <p className="text-sm font-medium text-foreground">
                            {idade ? `${idade} anos` : '—'} / {paciente?.genero || '—'}
                        </p>
                    </div>
                </div>

                {/* --- MyID Highlights --- */}
                {myidInterp && (
                    <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-bold text-primary flex items-center gap-1.5">
                                🎯 Análise MyID: {myidInterp.status}
                            </span>
                            <Badge className="text-[9px] uppercase tracking-wider bg-primary/10 text-primary border-none">
                                {myidInterp.label}
                            </Badge>
                        </div>
                        <p className="text-[11px] leading-relaxed text-slate-600 italic">
                            {myidInterp.recommendation}
                        </p>
                    </div>
                )}

                {/* Evolução e Diretrizes */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-xs font-bold text-muted-foreground uppercase">Status das Diretrizes</span>
                        </div>
                        {temMudanca || (p1 && !p2) ? (
                            <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0 text-[10px]">Mudanças Detectadas</Badge>
                        ) : (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px]">Conduta Mantida</Badge>
                        )}
                    </div>

                    <div className="pl-5 border-l-2 border-amber-200 py-1">
                        {temMudanca ? (
                            <p className="text-xs text-foreground leading-relaxed">
                                <strong className="text-amber-700">Atualização em {format(parseISO(p1.created_at), 'dd/MM')}:</strong> {p1.objetivo_geral || 'Novos objetivos terapêuticos definidos.'}
                            </p>
                        ) : p1 ? (
                            <p className="text-xs text-muted-foreground italic">
                                Planejamento terapêutico inalterado desde a última avaliação. Foco atual: {p1.objetivo_geral || 'Manutenção da conduta.'}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground italic">Nenhuma diretriz de tratamento registrada.</p>
                        )}
                    </div>
                </div>

                {/* Evoluções Diárias */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-xs font-bold text-muted-foreground uppercase">Evoluções Recentes</span>
                    </div>
                    <div className="space-y-1.5 ml-5">
                        {execucoes.length > 0 ? execucoes.map((ex: any) => (
                            <div key={ex.id} className="flex items-center justify-between group">
                                <span className="text-[11px] text-foreground font-medium">• {ex.studio_treinos?.titulo || 'Sessão de Treino'}</span>
                                <span className="text-[10px] text-muted-foreground">{format(parseISO(ex.data_execucao), 'dd/MM/yy')}</span>
                            </div>
                        )) : (
                            <p className="text-xs text-muted-foreground italic">Nenhuma execução de treino registrada.</p>
                        )}
                    </div>
                </div>

                {/* Assinatura e Carimbo */}
                <div className="mt-8 pt-6 border-t border-dashed relative">
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-50 px-2">
                        <Award className="h-5 w-5 text-muted-foreground/30" />
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                        <div className="space-y-1">
                            <div className="h-px bg-muted-foreground/20 w-full mt-6" />
                            <p className="text-[10px] text-center font-bold text-muted-foreground uppercase tracking-widest">Assinatura do Profissional</p>
                        </div>
                        <div className="text-center flex flex-col items-center justify-end">
                            <div className="border-2 border-muted-foreground/10 rounded p-1 w-24 h-12 flex flex-col items-center justify-center opacity-40 grayscale group-hover:opacity-100 transition-opacity">
                                <p className="text-[8px] font-black leading-tight uppercase">Carimbo</p>
                                <p className="text-[7px] font-bold leading-tight uppercase">Profissional</p>
                            </div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                                {profile?.nome} {profile?.sobrenome}
                            </p>
                            {profile?.crefito && <p className="text-[8px] text-muted-foreground">CREFITO: {profile.crefito}</p>}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
