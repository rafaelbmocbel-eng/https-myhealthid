import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import MyIDFingerprint from './MyIDFingerprint';
import type { FingerprintRing } from '@/types/myid';

interface MyIDResultProps {
    result: any;
    rawData?: any;
}

const translateWorkspace = (val: string) => {
    const map: Record<string, string> = {
        none: 'Nenhum / Improvisado',
        precarious: 'Precário',
        acceptable: 'Aceitável',
        good: 'Bom',
        excellent: 'Excelente'
    };
    return map[val] || val;
};

const translateLifestyle = (val: string) => {
    const map: Record<string, string> = {
        very_sedentary: 'Muito sedentário',
        sedentary: 'Sedentário',
        moderate: 'Moderado',
        active: 'Ativo',
        very_active: 'Muito ativo'
    };
    return map[val] || val;
};

const translateIntensity = (val: string) => {
    const map: Record<string, string> = {
        none: 'Nenhuma',
        light: 'Leve',
        moderate: 'Moderada',
        intense: 'Intensa',
        maximum: 'Máxima'
    };
    return map[val] || val;
};

const translateInflammatory = (val: string) => {
    const map: Record<string, string> = {
        daily: 'Diariamente',
        several_week: 'Vários dias p/ semana',
        '1_2_week': '1-2 dias p/ semana',
        rarely: 'Raramente',
        never: 'Nunca'
    };
    return map[val] || val;
};

const translateHormonal = (val: string) => {
    const map: Record<string, string> = {
        none: 'Não utiliza',
        oral: 'Anticoncepcional',
        iud: 'DIU Hormonal',
        other: 'Outro (implante, etc)'
    };
    return map[val] || val;
};

function buildFingerprintRings(scores: any): FingerprintRing[] {
    if (!scores) return [];
    return [
        // Inner (warm) — Demand / Numerator
        { label: 'Dor', value: scores.D_pain ?? 0, type: 'inner', color: '#dc2626', scoreKey: 'D' },
        { label: 'Funcionalidade', value: scores.EFI_functionality ?? 0, type: 'inner', color: '#f97316', scoreKey: 'EFI' },
        { label: 'Psicológico', value: scores.P_psychological ?? 0, type: 'inner', color: '#eab308', scoreKey: 'P' },
        { label: 'Inércia', value: scores.I_inertia ?? 0, type: 'inner', color: '#f59e0b', scoreKey: 'I' },
        // Outer (cool) — Capacity / Denominator
        { label: 'Regulação', value: scores.R_regulation ?? 0, type: 'outer', color: '#22c55e', scoreKey: 'R' },
        { label: 'Contexto', value: scores.C_context ?? 0, type: 'outer', color: '#14b8a6', scoreKey: 'C' },
        { label: 'Atividade', value: scores.AF_activity ?? 0, type: 'outer', color: '#06b6d4', scoreKey: 'AF' },
        { label: 'Hidratação', value: scores.HID_hydration ?? 0, type: 'outer', color: '#38bdf8', scoreKey: 'HID' },
        { label: 'Nutrição', value: scores.NUT_nutrition ?? 0, type: 'outer', color: '#818cf8', scoreKey: 'NUT' },
        { label: 'Ergonomia', value: scores.ERG_ergonomics ?? 0, type: 'outer', color: '#a78bfa', scoreKey: 'ERG' },
        { label: 'Ruído', value: scores.N_noise ?? 0, type: 'outer', color: '#c084fc', scoreKey: 'N' },
    ];
}

export function MyIDResult({ result, rawData = {} }: MyIDResultProps) {
    if (!result) return null;

    const {
        MyID_score,
        status,
        color,
        component_scores,
        red_flags_detected,
        red_flags_details,
        pain_pattern,
        clinical_priority,
        focus_areas,
        healing_history,
        medications,
        recommendation
    } = result;

    const {
        D_pain, EFI_functionality, P_psychological, I_inertia,
        R_regulation, C_context, AF_activity, HID_hydration,
        NUT_nutrition, ERG_ergonomics, N_noise
    } = component_scores || {};

    const hasWomenHealth = rawData.bloco_6_cycle_regularity || rawData.bloco_6_endometriosis || rawData.bloco_6_pcos;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto pb-10">
            <div className="text-center space-y-4 pt-8">
                <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary font-bold rounded-full mb-2 tracking-wide text-sm">
                    PROCESSAMENTO CONCLUÍDO
                </div>
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">🎯 SEU RESULTADO MyID</h1>
            </div>

            <Card className="border-4 bg-white/50 backdrop-blur-sm overflow-hidden shadow-xl" style={{ borderColor: status === 'EMERGENCY' ? '#ef4444' : status === 'ALERT' ? '#f59e0b' : '#10b981' }}>
                <CardContent className="p-8 text-center space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500">ÍNDICE MyID</h2>
                        <div className="flex justify-center items-center gap-4">
                            <span className="text-6xl sm:text-8xl font-black">{MyID_score?.toFixed(1)}</span>
                            <span className="text-3xl sm:text-5xl text-gray-400">/ 10</span>
                        </div>
                        <div className="inline-block mt-4 px-6 py-2 rounded-full font-bold text-lg"
                            style={{
                                backgroundColor: status === 'EMERGENCY' ? '#fee2e2' : status === 'ALERT' ? '#fef3c7' : '#d1fae5',
                                color: status === 'EMERGENCY' ? '#b91c1c' : status === 'ALERT' ? '#b45309' : '#047857'
                            }}>
                            {color} {status}
                        </div>
                        <div className="bg-white p-6 rounded-xl border mt-6 shadow-sm text-left">
                            <h3 className="font-bold text-lg mb-2">🎯 INTERPRETAÇÃO GERAL:</h3>
                            <p className="text-lg font-medium text-gray-800 leading-relaxed whitespace-pre-wrap">{recommendation}</p>
                            {status === 'EMERGENCY' && (
                                <div className="mt-4 p-4 bg-red-50 text-red-900 border border-red-200 rounded-lg text-sm font-medium">
                                    🚨 AÇÕES IMEDIATAS NECESSÁRIAS: Procure um médico urgentemente para descartar Red Flags, pare exercícios pesados, foque em sono e hidratação.
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ── FINGERPRINT VISUALIZATION ── */}
            <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl font-bold text-foreground">🔏 Sua Impressão Digital Sistêmica</CardTitle>
                    <CardDescription>Cada crista representa uma dimensão do seu perfil de saúde</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8">
                    <MyIDFingerprint
                        rings={buildFingerprintRings(component_scores)}
                        myidScore={MyID_score ?? 0}
                        className="w-full max-w-sm"
                    />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-red-200 shadow-sm flex flex-col">
                    <CardHeader className="bg-red-50/50 pb-4">
                        <CardTitle className="text-red-700 flex items-center gap-2 text-lg">
                            <span className="text-xl">⚠️</span> O QUE ESTÁ SOBRECARREGANDO (Numerador)
                        </CardTitle>
                        <CardDescription>Fatores que aumentam sua dor</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-4 flex-1">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🔴 Dor (D)</span><span>{typeof D_pain === 'number' ? D_pain.toFixed(1) : 0}/10</span>
                            </div>
                            <Progress value={D_pain * 10} className="h-2.5 bg-red-100 [&>div]:bg-red-500" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟠 Funcionalidade (EFI)</span><span>{typeof EFI_functionality === 'number' ? EFI_functionality.toFixed(1) : 0}/10</span>
                            </div>
                            <Progress value={EFI_functionality * 10} className="h-2.5 bg-orange-100 [&>div]:bg-orange-500" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟡 Psicológico (P)</span><span>{typeof P_psychological === 'number' ? P_psychological.toFixed(1) : 0}/10</span>
                            </div>
                            <Progress value={P_psychological * 10} className="h-2.5 bg-yellow-100 [&>div]:bg-yellow-500" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟠 Inércia (I)</span><span>{typeof I_inertia === 'number' ? I_inertia.toFixed(1) : 0}/10</span>
                            </div>
                            <Progress value={I_inertia * 10} className="h-2.5 bg-yellow-100 [&>div]:bg-yellow-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-200 shadow-sm flex flex-col">
                    <CardHeader className="bg-green-50/50 pb-4">
                        <CardTitle className="text-green-700 flex items-center gap-2 text-lg">
                            <span className="text-xl">🟢</span> O QUE ESTÁ AJUDANDO (Denominador)
                        </CardTitle>
                        <CardDescription>Fatores de recuperação do seu sistema</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-4 flex-1">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Regulação (R)</span><span>{typeof R_regulation === 'number' ? R_regulation.toFixed(1) : 0}/10</span></div>
                                <Progress value={R_regulation * 10} className={`h-1.5 bg-green-100 ${R_regulation < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Contexto (C)</span><span>{typeof C_context === 'number' ? C_context.toFixed(1) : 0}/10</span></div>
                                <Progress value={C_context * 10} className={`h-1.5 bg-green-100 ${C_context < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Atividade (AF)</span><span>{typeof AF_activity === 'number' ? AF_activity.toFixed(1) : 0}/10</span></div>
                                <Progress value={AF_activity * 10} className={`h-1.5 bg-green-100 ${AF_activity < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>💧 Hidratação (HID)</span><span>{typeof HID_hydration === 'number' ? HID_hydration.toFixed(1) : 0}/10</span></div>
                                <Progress value={HID_hydration * 10} className={`h-1.5 bg-blue-100 ${HID_hydration < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🥗 Nutrição (NUT)</span><span>{typeof NUT_nutrition === 'number' ? NUT_nutrition.toFixed(1) : 0}/10</span></div>
                                <Progress value={NUT_nutrition * 10} className={`h-1.5 bg-green-100 ${NUT_nutrition < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🪑 Ergonomia (ERG)</span><span>{typeof ERG_ergonomics === 'number' ? ERG_ergonomics.toFixed(1) : 0}/10</span></div>
                                <Progress value={ERG_ergonomics * 10} className={`h-1.5 bg-purple-100 ${ERG_ergonomics < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-purple-500"}`} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/50 pb-4">
                    <CardTitle className="text-slate-700 flex items-center gap-2 text-lg">
                        <span>🔍</span> FATORES OCULTOS
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                    <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                        <span className="font-bold text-gray-700">Ruído Sistêmico (N):</span>
                        <span className="font-mono bg-gray-100 px-3 py-0.5 rounded text-sm">{typeof N_noise === 'number' ? N_noise.toFixed(1) : 0}/10</span>
                    </div>
                    <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                        <span className="font-bold text-gray-700">Histórico / Cicatrização:</span>
                        <span className="font-mono bg-gray-100 px-3 py-0.5 rounded text-sm text-right">{healing_history?.healing_speed || 'Normal'}</span>
                    </div>
                    <div className="flex justify-between text-sm py-2 border-b border-gray-100">
                        <span className="font-bold text-gray-700">Padrão Temporal da Dor:</span>
                        <span className="font-mono bg-gray-100 px-3 py-0.5 rounded text-sm text-right">{pain_pattern}</span>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200 shadow-sm border-l-4 border-l-blue-500 pt-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-blue-900 text-xl font-bold flex items-center gap-2">
                        <span>🚀</span> PLANO DE AÇÃO MULTIDISCIPLINAR
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">

                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                        <h4 className="font-bold text-blue-700 flex items-center gap-2 mb-2"><span className="text-lg">🏥</span> PARA O MÉDICO:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            Paciente apresenta Score MyID de <strong>{typeof MyID_score === 'number' ? MyID_score.toFixed(1) : 0}</strong>, com predomínio de dor <strong>{pain_pattern}</strong>.
                            Sinal de Alerta (Red Flags) <strong>{red_flags_detected ? 'PRESENTE' : 'AUSENTE'}</strong>.
                            Medicações em uso: <strong>{medications?.length > 0 ? medications.join(', ') : 'Nenhuma contínua relatada'}</strong>.
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-purple-100 shadow-sm">
                        <h4 className="font-bold text-purple-700 flex items-center gap-2 mb-2"><span className="text-lg">🪑</span> PARA O ERGONOMISTA:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            Score ERG de <strong>{typeof ERG_ergonomics === 'number' ? ERG_ergonomics.toFixed(1) : 0}/10</strong>. Usa setup <strong>{translateWorkspace(rawData.bloco_5h_workspace || 'não informado')}</strong>,
                            passa <strong>{rawData.bloco_5h_sitting_continuous || 0} minutos</strong> sentado continuamente.
                            Hábitos prejudiciais: <strong>{rawData.bloco_5h_bad_habits?.length > 0 ? rawData.bloco_5h_bad_habits.join(', ') : 'Nenhum relatado'}</strong>.
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-orange-100 shadow-sm">
                        <h4 className="font-bold text-orange-700 flex items-center gap-2 mb-2"><span className="text-lg">💪</span> PARA O PERSONAL TRAINER:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            Score AF de <strong>{typeof AF_activity === 'number' ? AF_activity.toFixed(1) : 0}/10</strong>. Nível de vida <strong>{translateLifestyle(rawData.bloco_5e_lifestyle || 'não informado')}</strong>,
                            intensidade habitual <strong>{translateIntensity(rawData.bloco_5e_intensity || 'nenhuma')}</strong>.
                            Dor padrão: <strong>{pain_pattern}</strong>.
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
                        <h4 className="font-bold text-green-700 flex items-center gap-2 mb-2"><span className="text-lg">🥗</span> PARA O NUTRICIONISTA:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            Score NUT de <strong>{typeof NUT_nutrition === 'number' ? NUT_nutrition.toFixed(1) : 0}/10</strong>. Consumo de água: <strong>{rawData.bloco_5f_water_liters || 0}L</strong>.
                            Score Hidratação: <strong>{typeof HID_hydration === 'number' ? HID_hydration.toFixed(1) : 0}/10</strong>.
                            Frequência de inflamatórios: <strong>{translateInflammatory(rawData.bloco_5g_inflammatory || 'não informado')}</strong>.
                        </p>
                    </div>

                    {hasWomenHealth && (
                        <div className="bg-pink-50 p-4 rounded-lg border border-pink-200 shadow-sm">
                            <h4 className="font-bold text-pink-700 flex items-center gap-2 mb-2"><span className="text-lg">👩</span> PARA O GINECOLOGISTA:</h4>
                            <p className="text-gray-700 text-sm leading-relaxed">
                                Score de Ruído Sistêmico: <strong>{typeof N_noise === 'number' ? N_noise.toFixed(1) : 0}/10</strong>.
                                Piora a dor no ciclo? <strong>{rawData.bloco_6_cycle_affects_pain ? 'SIM' : 'NÃO'}</strong>.
                                Uso hormonal: <strong>{translateHormonal(rawData.bloco_6_hormonal_use || 'none')}</strong>.
                            </p>
                        </div>
                    )}

                </CardContent>
            </Card>

            <div className="bg-white p-6 rounded-xl border shadow-sm text-center space-y-4">
                <h3 className="font-bold text-xl text-gray-800">🎊 OBRIGADO POR PARTICIPAR!</h3>
                <p className="text-gray-600">
                    Você acabou de criar sua "impressão digital sistêmica" COMPLETA e PRECISA.<br />
                    Este é o primeiro passo para uma recuperação VERDADEIRAMENTE PERSONALIZADA e efetiva.
                </p>
                <div className="pt-4 flex flex-wrap justify-center gap-3">
                    <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium rounded-md text-sm transition-colors">
                        Baixar PDF
                    </button>
                    <button className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-md text-sm transition-colors">
                        Compartilhar com Médico
                    </button>
                    <button className="px-4 py-2 bg-primary text-white hover:bg-primary/90 font-bold rounded-md text-sm transition-colors">
                        Agendar com Profissional
                    </button>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-4">
                    Data: {new Date().toLocaleDateString()} | ID: {result.session_id || 'LOCAL'} | Versão: MyID v2.0
                </p>
            </div>
        </div>
    );
}
