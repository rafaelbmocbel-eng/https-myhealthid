import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import MyIDFingerprint from './MyIDFingerprint';
import MyIDFormulaDisplay from './MyIDFormulaDisplay';
import { MyIDResult as MyIDResultType, FingerprintRing } from '@/types/myid';
import { getMyIDFingerprintData, getMyIDInterpretation } from '@/utils/myidCalculations';
import { shareMyIDResults } from '@/utils/whatsapp';

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

    // Normalize keys (long to short)
    const normalized: Record<string, number> = {
        D: scores.D ?? scores.D_pain ?? 0,
        EFI: scores.EFI ?? scores.EFI_functionality ?? 0,
        P: scores.P ?? scores.P_psychological ?? 0,
        I: scores.I ?? scores.I_inertia ?? 0,
        R: scores.R ?? scores.R_regulation ?? 0,
        C: scores.C ?? scores.C_context ?? 0,
        AF: scores.AF ?? scores.AF_activity ?? 0,
        HID: scores.HID ?? scores.HID_hydration ?? 0,
        NUT: scores.NUT ?? scores.NUT_nutrition ?? 0,
        ERG: scores.ERG ?? scores.ERG_ergonomics ?? 0,
        N: scores.N ?? scores.N_noise ?? 0
    };

    return getMyIDFingerprintData(normalized);
}

export function MyIDResult({ result, rawData = {} }: MyIDResultProps) {
    if (!result) return null;

    const {
        MyID_score,
        status: _status,
        color: _color,
        component_scores,
        red_flags_detected,
        red_flags_details,
        pain_pattern,
        clinical_priority,
        focus_areas,
        healing_history,
        medications,
        recommendation: _recommendation // captured but overridden
    } = result;

    const scores = component_scores || {};
    const D = scores.D ?? scores.D_pain ?? 0;
    const EFI = scores.EFI ?? scores.EFI_functionality ?? 0;
    const P = scores.P ?? scores.P_psychological ?? 0;
    const I = scores.I ?? scores.I_inertia ?? 0;
    const R = scores.R ?? scores.R_regulation ?? 0;
    const C = scores.C ?? scores.C_context ?? 0;
    const AF = scores.AF ?? scores.AF_activity ?? 0;
    const HID = scores.HID ?? scores.HID_hydration ?? 0;
    const NUT = scores.NUT ?? scores.NUT_nutrition ?? 0;
    const ERG = scores.ERG ?? scores.ERG_ergonomics ?? 0;
    const N = scores.N ?? scores.N_noise ?? 0;
    const MED = scores.MED ?? scores.MED_penalty ?? 0;

    const dimScores = { D, EFI, P, I, N };
    const interp = getMyIDInterpretation(MyID_score ?? 0, red_flags_detected, dimScores);
    const status = interp.label;
    const color = interp.color;
    const recommendation = interp.recommendation;
    const dimensionAlerts = interp.dimensionAlerts || result.dimension_alerts || [];

    const hasWomenHealth = rawData.bloco_6_cycle_regularity || rawData.bloco_6_endometriosis || rawData.bloco_6_pcos;

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto pb-10">
            <div className="text-center space-y-4 pt-8">
                <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary font-bold rounded-full mb-2 tracking-wide text-sm">
                    PROCESSAMENTO CONCLUÍDO
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight">🎯 SEU RESULTADO MyID</h1>
            </div>

            {/* Score principal com gauge de severidade */}
            <Card className="border-2 bg-card/80 backdrop-blur-sm overflow-hidden shadow-xl" style={{ borderColor: color || '#10b981' }}>
                <CardContent className="p-8 text-center space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">ÍNDICE MyID</h2>
                        {/* Old visual representation removed - now using MyIDFormulaDisplay below */}

                        <div className="bg-muted/30 p-6 rounded-xl border mt-6 shadow-sm text-left">
                            <h3 className="font-bold text-lg mb-2">🎯 INTERPRETAÇÃO GERAL:</h3>
                            <p className="text-lg font-medium leading-relaxed whitespace-pre-wrap">{recommendation}</p>
                            {status === 'EXTREMO' && (
                                <div className="mt-4 p-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg text-sm font-medium">
                                    🚨 AÇÕES IMEDIATAS NECESSÁRIAS: Procure um médico urgentemente para descartar Red Flags, pare exercícios pesados, foque em sono e hidratação.
                                </div>
                            )}
                        </div>
                        {/* Dimension Alerts */}
                        {dimensionAlerts.length > 0 && (
                            <div className="mt-4 space-y-2">
                                {dimensionAlerts.map((alert: any) => (
                                    <div key={alert.dimension} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                                        <span className="text-lg">🔴</span>
                                        <div>
                                            <span className="font-bold text-amber-900">
                                                Atenção: {alert.label} Elevado(a) ({alert.dimension} = {alert.value.toFixed(1)})
                                            </span>
                                            <p className="text-amber-800/80 text-xs mt-0.5">
                                                Esta dimensão isolada elevou sua classificação para {alert.severity}, mesmo com score geral mais baixo.
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ── FORMULA DISPLAY ── */}
            <MyIDFormulaDisplay
                scores={{ D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED }}
                myidScore={MyID_score ?? 0}
                hasRedFlags={red_flags_detected}
            />

            {/* ── FINGERPRINT VISUALIZATION ── */}
            <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl font-bold text-foreground">🔏 Sua Impressão Digital Sistêmica</CardTitle>
                    <CardDescription>Cada crista representa uma dimensão do seu perfil de saúde — toque para explorar</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8">
                    <MyIDFingerprint
                        rings={buildFingerprintRings(component_scores)}
                        myidScore={MyID_score ?? 0}
                        className="w-full max-w-2xl"
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
                                <span>🔴 Dor (D)</span><span>{D.toFixed(1)}/10</span>
                            </div>
                            <Progress value={D * 10} className="h-2.5 bg-red-100 [&>div]:bg-red-500" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟠 Funcionalidade (EFI)</span><span>{EFI.toFixed(1)}/10</span>
                            </div>
                            <Progress value={EFI * 10} className="h-2.5 bg-orange-100 [&>div]:bg-orange-500" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟡 Psicológico (P)</span><span>{P.toFixed(1)}/10</span>
                            </div>
                            <Progress value={P * 10} className="h-2.5 bg-yellow-100 [&>div]:bg-yellow-500" />
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟠 Inércia (I)</span><span>{I.toFixed(1)}/10</span>
                            </div>
                            <Progress value={I * 10} className="h-2.5 bg-yellow-100 [&>div]:bg-yellow-500" />
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
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Regulação (R)</span><span>{R.toFixed(1)}/10</span></div>
                                <Progress value={R * 10} className={`h-1.5 bg-green-100 ${R < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Contexto (C)</span><span>{C.toFixed(1)}/10</span></div>
                                <Progress value={C * 10} className={`h-1.5 bg-green-100 ${C < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Atividade (AF)</span><span>{AF.toFixed(1)}/10</span></div>
                                <Progress value={AF * 10} className={`h-1.5 bg-green-100 ${AF < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>💧 Hidratação (HID)</span><span>{HID.toFixed(1)}/10</span></div>
                                <Progress value={HID * 10} className={`h-1.5 bg-blue-100 ${HID < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🥗 Nutrição (NUT)</span><span>{NUT.toFixed(1)}/10</span></div>
                                <Progress value={NUT * 10} className={`h-1.5 bg-green-100 ${NUT < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🪑 Ergonomia (ERG)</span><span>{ERG.toFixed(1)}/10</span></div>
                                <Progress value={ERG * 10} className={`h-1.5 bg-purple-100 ${ERG < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-purple-500"}`} />
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
                        <span className="font-mono bg-gray-100 px-3 py-0.5 rounded text-sm">{N.toFixed(1)}/10</span>
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
                        <span>🚀</span> DICAS PARA SEU BIO-ALINHAMENTO
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 pt-2">

                    <div className="bg-white p-4 rounded-lg border border-blue-100 shadow-sm">
                        <h4 className="font-bold text-blue-700 flex items-center gap-2 mb-2"><span className="text-lg">🏥</span> SUA SAÚDE E SISTEMA:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            Seu Score MyID é de <strong>{MyID_score.toFixed(1)}</strong>, o que reflete um padrão de dor <strong>{pain_pattern}</strong>.
                            {red_flags_detected ? ' Identificamos sinais que precisam de uma conversa cuidadosa com seu profissional de saúde.' : ' Seu sistema não apresenta sinais de alerta imediatos.'}
                            Continue observando como seu corpo reage às medicações {medications?.length > 0 ? `que você já utiliza (${medications.join(', ')})` : 'caso venha a utilizar alguma'}.
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-purple-100 shadow-sm">
                        <h4 className="font-bold text-purple-700 flex items-center gap-2 mb-2"><span className="text-lg">🪑</span> SEU AMBIENTE E POSTURA:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            Com um score de ergonomia de <strong>{ERG.toFixed(1)}/10</strong>, vale olhar para o seu setup <strong>{translateWorkspace(rawData.bloco_5h_workspace || 'atual')}</strong>.
                            Como você costuma passar <strong>{rawData.bloco_5h_sitting_continuous || 0} minutos</strong> sentado(a) sem interrupção, tente fazer micro-pausas a cada 50 minutos para "resetar" sua postura.
                            {rawData.bloco_5h_bad_habits?.length > 0 ? ` Atenção especial aos hábitos de ${rawData.bloco_5h_bad_habits.join(', ')}.` : ''}
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-orange-100 shadow-sm">
                        <h4 className="font-bold text-orange-700 flex items-center gap-2 mb-2"><span className="text-lg">💪</span> SEU CORPO E MOVIMENTO:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            Sua atividade física recebeu um score de <strong>{AF.toFixed(1)}/10</strong>. Para alguém com estilo de vida <strong>{translateLifestyle(rawData.bloco_5e_lifestyle || 'atual')}</strong>,
                            o foco deve ser manter a constância {rawData.bloco_5e_intensity !== 'none' ? `na intensidade ${translateIntensity(rawData.bloco_5e_intensity)}` : ''} sem ultrapassar o limite da sua dor <strong>{pain_pattern}</strong>.
                            O movimento é seu melhor aliado na regulação da dor.
                        </p>
                    </div>

                    <div className="bg-white p-4 rounded-lg border border-green-100 shadow-sm">
                        <h4 className="font-bold text-green-700 flex items-center gap-2 mb-2"><span className="text-lg">🥗</span> SUA NUTRIÇÃO E HIDRATAÇÃO:</h4>
                        <p className="text-gray-700 text-sm leading-relaxed">
                            Sua nota de nutrição foi <strong>{NUT.toFixed(1)}/10</strong>. Você relatou beber cerca de <strong>{rawData.bloco_5f_water_liters || 0}L</strong> de água por dia.
                            Manter sua hidratação (Score: <strong>{HID.toFixed(1)}/10</strong>) é fundamental para a saúde dos seus tecidos e para reduzir o ruído inflamatório no seu sistema.
                        </p>
                    </div>

                    {hasWomenHealth && (
                        <div className="bg-pink-50 p-4 rounded-lg border border-pink-200 shadow-sm">
                            <h4 className="font-bold text-pink-700 flex items-center gap-2 mb-2"><span className="text-lg">👩</span> SAÚDE FEMININA E CICLO:</h4>
                            <p className="text-gray-700 text-sm leading-relaxed">
                                Percebemos que seu ciclo menstrual <strong>{rawData.bloco_6_cycle_affects_pain ? 'influencia' : 'tem pouca influência'}</strong> na sua percepção de dor.
                                Esse "ruído" sistêmico (Score: <strong>{N.toFixed(1)}/10</strong>) é um fator importante para ajustarmos suas atividades em diferentes fases do mês.
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
                    <button
                        onClick={() => shareMyIDResults(result.paciente_nome || 'Paciente', '5511999999999', result)}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-md text-sm transition-colors"
                    >
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
