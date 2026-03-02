import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO, parse } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Activity, Fingerprint, AlignCenter, Dumbbell,
    CalendarDays, TrendingUp, Sparkles, Brain, BarChart3
} from 'lucide-react';
import { getMyIDFingerprintData, getMyIDSeverityColor } from '@/utils/myidCalculations';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import type { MyIDResult as MyIDResultType } from '@/types/myid';
import {
    ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, Area
} from 'recharts';

interface PatientIntegratedDashboardProps {
    pacienteId: string;
    serviceType: 'identidade' | 'cob_zero' | 'studio';
}

export default function PatientIntegratedDashboard({
    pacienteId,
    serviceType
}: PatientIntegratedDashboardProps) {

    // ============================================
    // QUERIES - MyID (Numerador/Denominador Base)
    // ============================================
    const { data: myidAvaliacoes = [], isLoading: loadingMyID } = useQuery({
        queryKey: ['integrated-myid-avaliacoes', pacienteId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('avaliacoes_identidade') // Aqui ficavam as antigas e também MyID. Vamos buscar as que têm myid_score
                .select('*')
                .eq('paciente_id', pacienteId)
                .not('myid_score', 'is', null)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return data || [];
        },
    });

    const ultimaMyID = myidAvaliacoes[0];

    // ============================================
    // QUERIES - Avaliação Específica do Serviço
    // ============================================
    const { data: serviceData = [], isLoading: loadingService } = useQuery({
        queryKey: ['integrated-service-data', pacienteId, serviceType],
        queryFn: async () => {
            if (serviceType === 'cob_zero') {
                const { data, error } = await supabase
                    .from('avaliacoes_cob_zero')
                    .select('*')
                    .eq('paciente_id', pacienteId)
                    .order('created_at', { ascending: false });
                if (error) throw error;
                return data || [];
            }
            else if (serviceType === 'studio') {
                const { data, error } = await supabase
                    .from('studio_medidas')
                    .select('*')
                    .eq('paciente_id', pacienteId)
                    .order('data_medida', { ascending: false });
                if (error) throw error;
                return data || [];
            }
            else {
                // Se for identidade exclusivo, o MyID já é o serviço em si.
                return [];
            }
        },
    });

    const lastServiceEntry = serviceData[0];

    // ============================================
    // DADOS PARA GRÁFICO COMPARATIVO RECHARTS
    // ============================================
    const getMyIDDate = (av: any) => av.data_avaliacao || format(parseISO(av.created_at), 'dd/MM/yyyy');
    const getServiceDate = (av: any) => serviceType === 'studio' ? format(parseISO(av.data_medida), 'dd/MM/yyyy') : av.data_avaliacao;

    const allDates = Array.from(new Set([
        ...myidAvaliacoes.map(getMyIDDate),
        ...serviceData.map(getServiceDate)
    ])).sort((a: string, b: string) => {
        try {
            const dateA = parse(a, 'dd/MM/yyyy', new Date());
            const dateB = parse(b, 'dd/MM/yyyy', new Date());
            return dateA.getTime() - dateB.getTime();
        } catch (e) {
            return 0; // Fallback in case of parsing error
        }
    });

    const chartData = allDates.map(dateStr => {
        const myidMatch = myidAvaliacoes.find(m => getMyIDDate(m) === dateStr);
        const serviceMatch = serviceData.find(m => getServiceDate(m) === dateStr);

        const point: any = { date: dateStr };

        if (myidMatch) {
            point.myidScore = Number(myidMatch.myid_score) || null;
            point.scoreD = Number(myidMatch.score_d) || null;
            point.scoreR = Number(myidMatch.score_r) || null;
        }

        if (serviceMatch) {
            const sm = serviceMatch as any;
            if (serviceType === 'cob_zero') {
                point.cobb = Number(sm.cobb_angle) || null;
                point.scoreE = Number(sm.score_e) || null;
                point.risco = Number(sm.risco_percentage) || null;
            } else if (serviceType === 'studio') {
                point.gordura = Number(sm.percentual_gordura) || null;
                point.peso = Number(sm.peso) || null;
                point.imc = Number(sm.imc) || null;
            }
        }
        return point;
    });

    // ============================================
    // PLACEHOLDER: Gráfico Digital Sistêmico
    // O usuário enviará as instruções de UI reais depois
    // ============================================
    const renderMyIDPlaceholder = () => {
        if (!ultimaMyID || ultimaMyID.myid_score == null) {
            return (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl border-border bg-muted/20 text-center">
                    <Fingerprint className="h-12 w-12 text-muted-foreground opacity-30 mb-3" />
                    <h4 className="font-bold text-sm text-foreground">Aguardando MyID</h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">
                        O paciente precisa concluir o questionário MyID para gerar o Gráfico Digital Sistêmico.
                    </p>
                </div>
            );
        }

        const myidAnalysis = ultimaMyID.myid_analysis as any;
        const componentScores: MyIDResultType['componentScores'] = myidAnalysis?.componentScores || {
            D: Number(ultimaMyID.score_d) || 0,
            EFI: Number(ultimaMyID.score_efi) || 0,
            P: Number(ultimaMyID.score_p) || 0,
            I: Number(ultimaMyID.score_i) || 0,
            R: Number(ultimaMyID.score_r) || 0,
            C: Number(ultimaMyID.score_c) || 0,
            N: Number(ultimaMyID.score_n) || 0,
            AF: 5,   // Dashboards usually show defaults until specific assessment
            HID: 7,
            NUT: 7,
            ERG: 7,
        };

        const rings = getMyIDFingerprintData(componentScores);
        const classificacao = ultimaMyID.classificacao || 'LEVE';
        const severityClass = getMyIDSeverityColor(classificacao);

        return (
            <div className="flex flex-col h-full justify-between gap-4">
                {/* Este é o espaço onde entra a nova UI/SVG do Gráfico Digital */}
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-identidade/10 shrink-0">
                        <Fingerprint className="h-5 w-5 text-identidade" />
                    </div>
                    <div>
                        <h3 className="font-black text-lg text-foreground leading-none">ID Sistêmico</h3>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Gráfico em Digital</p>
                    </div>
                    <Badge className={`ml-auto border ${severityClass}`}>
                        {classificacao}
                    </Badge>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 bg-white/50 dark:bg-black/20 p-4 rounded-xl border border-white/20">
                    <div className="w-full md:w-[200px] shrink-0">
                        <MyIDFingerprint rings={rings} myidScore={Number(ultimaMyID.myid_score)} />
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="text-center md:text-left">
                            <div className="text-3xl font-black text-identidade tracking-tighter">
                                {Number(ultimaMyID.myid_score).toFixed(1)}
                            </div>
                            <div className="text-xs text-muted-foreground font-medium">MyID Score Global</div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-2 gap-y-1.5 mt-2 pt-2 border-t border-border/50">
                            {rings.map(r => (
                                <div key={r.scoreKey} className="flex items-center gap-1.5">
                                    <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                                    <span className="text-[8px] text-muted-foreground truncate uppercase font-bold">{r.label.split(' ')[0]}</span>
                                    <span className="text-[9px] font-black ml-auto">{r.value.toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ============================================
    // ESTATÍSTICA VITAL DO SERVIÇO ATUAL
    // ============================================
    const renderServiceVitalStats = () => {
        if (serviceType === 'identidade') {
            return (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <Brain className="h-12 w-12 text-identidade opacity-20 mb-3" />
                    <h4 className="font-bold text-identidade">MÉTODO IDENTIDADE</h4>
                    <p className="text-[10px] text-muted-foreground max-w-[200px] mt-2">
                        No Método Identidade, a sua Impressão Digital já é a estatística vital. O foco aqui é a regulação sistêmica autonômica.
                    </p>
                </div>
            );
        }

        if (!lastServiceEntry) {
            return (
                <div className="flex flex-col items-center justify-center h-full p-6 border-2 border-dashed border-border rounded-xl bg-muted/10 text-center">
                    <Activity className="h-10 w-10 text-muted-foreground opacity-30 mb-2" />
                    <h4 className="font-bold text-sm">Sem dados do serviço</h4>
                    <p className="text-[10px] text-muted-foreground mt-1">Realize a primeira avaliação neste serviço.</p>
                </div>
            );
        }

        if (serviceType === 'cob_zero') {
            const s = lastServiceEntry as any;
            return (
                <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-blue-600/10 shrink-0">
                            <AlignCenter className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-foreground leading-none">COB° ZERO</h3>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Sinal Vital Estrutural</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 flex-1">
                        <div className="bg-blue-50 dark:bg-blue-900/10 rounded-2xl p-4 flex flex-col justify-center items-center border border-blue-100 dark:border-blue-800/20">
                            <div className="text-4xl font-black text-blue-600 tracking-tighter">
                                {Number(s.cobb_angle || 0).toFixed(1)}°
                            </div>
                            <div className="text-[10px] uppercase font-bold text-blue-800/60 mt-1">Ângulo Cobb</div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="bg-muted/50 rounded-xl p-3 flex-1 flex flex-col justify-center items-center">
                                <div className="text-xl font-black text-foreground">
                                    {Number(s.score_e || 0).toFixed(1)}
                                </div>
                                <div className="text-[9px] uppercase font-bold text-muted-foreground">Score E</div>
                            </div>
                            <div className="bg-orange-50 dark:bg-orange-900/10 rounded-xl p-3 flex-1 flex flex-col justify-center items-center">
                                <div className="text-xl font-black text-orange-600">
                                    {Number(s.risco_percentage || 0).toFixed(1)}%
                                </div>
                                <div className="text-[9px] uppercase font-bold text-orange-800/60">Risco</div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        if (serviceType === 'studio') {
            const s = lastServiceEntry as any;
            return (
                <div className="flex flex-col h-full">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-studio/10 shrink-0">
                            <Dumbbell className="h-5 w-5 text-studio" />
                        </div>
                        <div>
                            <h3 className="font-black text-lg text-foreground leading-none">Studio Personal</h3>
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Sinal Vital Físico</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 flex-1">
                        <div className="bg-studio-light/20 dark:bg-studio/10 rounded-2xl p-4 flex flex-col justify-center items-center border border-studio/20">
                            <div className="text-4xl font-black text-studio tracking-tighter">
                                {Number(s.percentual_gordura || 0).toFixed(1)}<span className="text-xl ml-0.5">%</span>
                            </div>
                            <div className="text-[10px] uppercase font-bold text-studio/70 mt-1">% Gordura</div>
                        </div>

                        <div className="flex flex-col gap-3">
                            <div className="bg-muted/50 rounded-xl p-3 flex-1 flex flex-col justify-center items-center">
                                <div className="text-xl font-black text-foreground">
                                    {Number(s.peso || 0).toFixed(1)}<span className="text-sm">kg</span>
                                </div>
                                <div className="text-[9px] uppercase font-bold text-muted-foreground">Peso Corporal</div>
                            </div>
                            <div className="bg-muted/50 rounded-xl p-3 flex-1 flex flex-col justify-center items-center">
                                <div className="text-xl font-black text-foreground">
                                    {Number(s.imc || 0).toFixed(1)}
                                </div>
                                <div className="text-[9px] uppercase font-bold text-muted-foreground">IMC</div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return null;
    };

    return (
        <div className="space-y-6">
            {/* SEÇÃO TOPO: MyID Lado a Lado com Serviço Específico */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Lado Esquerdo: MyID Fingerprint */}
                <Card className="border-identidade/20 overflow-hidden bg-gradient-to-br from-card to-identidade/5 shadow-sm">
                    <CardContent className="p-5 h-full">
                        {renderMyIDPlaceholder()}
                    </CardContent>
                </Card>

                {/* Lado Direito: Serviço Específico */}
                <Card className="overflow-hidden shadow-sm">
                    <CardContent className="p-5 h-full">
                        {renderServiceVitalStats()}
                    </CardContent>
                </Card>
            </div>

            {/* SEÇÃO MEIO: PLACEHOLDER PARA GRÁFICOS COMPARATIVOS */}
            <Card className="shadow-sm border-border">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Evolução Clínica e Sistêmica</h3>
                            <p className="text-[10px] text-muted-foreground">Correlação entre o MyID (Eixo Direito) e o Serviço Específico (Eixo Esquerdo)</p>
                        </div>
                    </div>

                    {chartData.length >= 1 ? (
                        <div className="h-72 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />

                                    {/* Y-Axis Esquerdo: Específico do Serviço */}
                                    {serviceType === 'cob_zero' && <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} />}
                                    {serviceType === 'studio' && <YAxis yAxisId="left" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={['dataMin - 2', 'dataMax + 2']} />}
                                    {/* Y-Axis Direito: MyID (0 a 10) */}
                                    <YAxis yAxisId="right" orientation="right" domain={[0, 10]} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />

                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                        labelStyle={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px' }}
                                    />
                                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />

                                    {/* Plotting MyID Data (Area / Line) on Right Axis */}
                                    <Area yAxisId="right" type="monotone" dataKey="myidScore" name="MyID Score Global" fill="url(#colorMyID)" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} connectNulls />

                                    {/* Plotting Service Specific Data on Left Axis */}
                                    {serviceType === 'cob_zero' && (
                                        <>
                                            <Line yAxisId="left" type="monotone" dataKey="cobb" name="Ângulo Cobb (°)" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }} connectNulls />
                                            <Bar yAxisId="left" dataKey="scoreE" name="Score Estrutural" fill="#93c5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </>
                                    )}
                                    {serviceType === 'studio' && (
                                        <>
                                            <Line yAxisId="left" type="monotone" dataKey="gordura" name="% Gordura" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, fill: '#8b5cf6', strokeWidth: 2, stroke: '#fff' }} connectNulls />
                                            <Bar yAxisId="left" dataKey="peso" name="Peso (kg)" fill="#c4b5fd" radius={[4, 4, 0, 0]} maxBarSize={40} />
                                        </>
                                    )}

                                    <defs>
                                        <linearGradient id="colorMyID" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-64 flex items-center justify-center border border-dashed rounded-xl bg-muted/10">
                            <div className="text-center">
                                <BarChart3 className="h-10 w-10 text-muted-foreground opacity-30 mx-auto mb-2" />
                                <p className="text-sm font-semibold text-muted-foreground px-4">
                                    Gráficos Comparativos
                                </p>
                                <p className="text-[10px] text-muted-foreground opacity-70 mt-1 max-w-sm mx-auto">
                                    Espaço reservado para a injeção dos gráficos temporais. Responda questionários para gerar dados.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* SEÇÃO HISTÓRICO: Linha do Tempo */}
            <Card className="shadow-sm border-border">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Histórico Evolutivo (Timeline)</h3>
                            <p className="text-[10px] text-muted-foreground">Todas as avaliações no tempo.</p>
                        </div>
                    </div>

                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-muted before:to-transparent">
                        {/* Simulação rápida dos eventos (misturando MyID e Service Data) */}
                        {myidAvaliacoes.map((myid, idx) => (
                            <div key={`myid-${myid.id}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-identidade/20 text-identidade shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10">
                                    <Fingerprint className="h-4 w-4" />
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] pb-2 pl-4 md:pl-0 md:pr-4 md:group-odd:pr-0 md:group-odd:pl-4">
                                    <div className="bg-card p-3 rounded-xl border border-identidade/20 shadow-sm">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="font-bold text-xs text-identidade">MyID</span>
                                            <span className="text-[9px] text-muted-foreground">{myid.data_avaliacao || format(parseISO(myid.created_at), 'dd/MM/yyyy')}</span>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground">MyID Score: <strong className="text-foreground">{Number(myid.myid_score).toFixed(1)}</strong> — Classificação: {myid.classificacao}</p>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {serviceData.map((s: any, idx) => (
                            <div key={`serv-${s.id}`} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10 ${serviceType === 'cob_zero' ? 'bg-blue-600/20 text-blue-600' : 'bg-studio/20 text-studio'}`}>
                                    {serviceType === 'cob_zero' ? <AlignCenter className="h-4 w-4" /> : <Dumbbell className="h-4 w-4" />}
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] pb-2 pl-4 md:pl-0 md:pr-4 md:group-odd:pr-0 md:group-odd:pl-4">
                                    <div className={`bg-card p-3 rounded-xl border shadow-sm ${serviceType === 'cob_zero' ? 'border-blue-600/20' : 'border-studio/20'}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className={`font-bold text-xs ${serviceType === 'cob_zero' ? 'text-blue-600' : 'text-studio'}`}>
                                                {serviceType === 'cob_zero' ? 'COB° ZERO' : 'Studio Personal'}
                                            </span>
                                            <span className="text-[9px] text-muted-foreground">{serviceType === 'studio' ? format(parseISO(s.data_medida), 'dd/MM/yyyy') : s.data_avaliacao}</span>
                                        </div>
                                        {serviceType === 'cob_zero' ? (
                                            <p className="text-[10px] text-muted-foreground">Cobb: <strong className="text-foreground">{s.cobb_angle}°</strong> — Score E: <strong className="text-foreground">{s.score_e?.toFixed(1)}</strong></p>
                                        ) : (
                                            <p className="text-[10px] text-muted-foreground">Peso: <strong className="text-foreground">{s.peso}kg</strong> — % Gordura: <strong className="text-foreground">{s.percentual_gordura}%</strong></p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {(myidAvaliacoes.length === 0 && serviceData.length === 0) && (
                            <div className="text-center py-6 text-muted-foreground text-xs italic">
                                Sem registros no histórico.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

        </div>
    );
}
