import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";

interface MyIDResultProps {
    result: any;
}

export function MyIDResult({ result }: MyIDResultProps) {
    if (!result) return null;

    const {
        MyID_score,
        status,
        color,
        component_scores,
        red_flags,
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
                                    🚨 AÇÕES IMEDIATAS NECESSÁRIAS: Procure um médico, pare exercícios pesados, foque em 8+ horas de sono e hidratação agressiva.
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-2">
                <h3 className="text-xl font-bold bg-muted py-2 px-4 rounded-md">📋 COMPONENTES DO SEU RESULTADO</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="border-red-200 shadow-sm">
                    <CardHeader className="bg-red-50/50 pb-4">
                        <CardTitle className="text-red-700 flex items-center gap-2">
                            <span className="text-xl">⚠️</span> NUMERADOR (O QUE PREJUDICA)
                        </CardTitle>
                        <CardDescription>O que está sobrecarregando o sistema</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-4">
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🔴 Dor (D)</span>
                                <span>{D_pain}/10</span>
                            </div>
                            <Progress value={D_pain * 10} className="h-2.5 bg-red-100 [&>div]:bg-red-500" />
                            <p className="text-xs text-gray-500">Intensidade da dor percebida</p>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟠 Funcionalidade (EFI)</span>
                                <span>{EFI_functionality}/10</span>
                            </div>
                            <Progress value={EFI_functionality * 10} className="h-2.5 bg-orange-100 [&>div]:bg-orange-500" />
                            <p className="text-xs text-gray-500">Quanto a dor impede suas atividades</p>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟡 Psicológico (P)</span>
                                <span>{P_psychological}/10</span>
                            </div>
                            <Progress value={P_psychological * 10} className="h-2.5 bg-yellow-100 [&>div]:bg-yellow-500" />
                            <p className="text-xs text-gray-500">Quanto seu medo amplifica a dor</p>
                        </div>
                        <div className="space-y-1.5">
                            <div className="flex justify-between text-sm font-bold text-gray-700">
                                <span>🟠 Inércia (I)</span>
                                <span>{I_inertia}/10</span>
                            </div>
                            <Progress value={I_inertia * 10} className="h-2.5 bg-yellow-100 [&>div]:bg-yellow-500" />
                            <p className="text-xs text-gray-500">Quantas mudanças recentes ocorreram</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-green-200 shadow-sm">
                    <CardHeader className="bg-green-50/50 pb-4">
                        <CardTitle className="text-green-700 flex items-center gap-2">
                            <span className="text-xl">🟢</span> DENOMINADOR (O QUE AJUDA)
                        </CardTitle>
                        <CardDescription>O que está ajudando ou falhando na recuperação</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Regulação (R)</span><span>{R_regulation}/10</span></div>
                                <Progress value={R_regulation * 10} className={`h-1.5 bg-green-100 ${R_regulation < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                                <p className="text-[10px] text-gray-500">Sono e recuperação</p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Contexto (C)</span><span>{C_context}/10</span></div>
                                <Progress value={C_context * 10} className={`h-1.5 bg-green-100 ${C_context < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                                <p className="text-[10px] text-gray-500">Suporte social</p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🟢 Atividade (AF)</span><span>{AF_activity}/10</span></div>
                                <Progress value={AF_activity * 10} className={`h-1.5 bg-green-100 ${AF_activity < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                                <p className="text-[10px] text-gray-500">Nível de movimento</p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>💧 Hidratação (HID)</span><span>{HID_hydration}/10</span></div>
                                <Progress value={HID_hydration * 10} className={`h-1.5 bg-blue-100 ${HID_hydration < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-blue-500"}`} />
                                <p className="text-[10px] text-gray-500">Água e hidratação</p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🥗 Nutrição (NUT)</span><span>{NUT_nutrition}/10</span></div>
                                <Progress value={NUT_nutrition * 10} className={`h-1.5 bg-green-100 ${NUT_nutrition < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"}`} />
                                <p className="text-[10px] text-gray-500">Qualidade alimentar</p>
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex justify-between text-xs font-bold text-gray-700"><span>🪑 Ergonomia (ERG)</span><span>{ERG_ergonomics}/10</span></div>
                                <Progress value={ERG_ergonomics * 10} className={`h-1.5 bg-purple-100 ${ERG_ergonomics < 5 ? "[&>div]:bg-red-500" : "[&>div]:bg-purple-500"}`} />
                                <p className="text-[10px] text-gray-500">Postura e trabalho</p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-green-100 space-y-3">
                            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
                                <span className="font-bold text-gray-700 text-xs">🔵 Ruído Sistêmico (N):</span>
                                <span className="font-mono bg-gray-100 px-2 rounded">{N_noise}/10</span>
                            </div>
                            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
                                <span className="font-bold text-gray-700 text-xs">📅 Histórico (Cicatrização):</span>
                                <span className="font-mono bg-gray-100 px-2 rounded text-[10px] text-right max-w-[150px] truncate">{healing_history?.healing_speed}</span>
                            </div>
                            <div className="flex justify-between text-sm py-1 border-b border-gray-100">
                                <span className="font-bold text-gray-700 text-xs">📝 Padrão (Temporal):</span>
                                <span className="font-mono bg-gray-100 px-2 rounded text-[10px] text-right max-w-[150px] truncate">{pain_pattern}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="bg-slate-50 border-slate-200 shadow-sm border-l-4 border-l-primary pt-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-slate-800 text-xl font-bold flex items-center gap-2">
                        <span>🎯</span> ANÁLISE DETALHADA E PLANO DE AÇÃO
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div>
                        <h4 className="font-bold text-blue-700 uppercase text-xs tracking-wider mb-2">Prioridade Clínica</h4>
                        <div className="p-3 bg-white border rounded-md font-medium text-gray-800">
                            {clinical_priority}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold text-blue-700 uppercase text-xs tracking-wider mb-2">Foco e Recomendações</h4>
                        <ul className="space-y-2 bg-white p-4 border rounded-md">
                            {(focus_areas || []).map((area: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-blue-500 font-bold mt-0.5">✓</span>
                                    <span className="text-gray-800 font-medium text-sm leading-tight">{area}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {red_flags && (
                        <div className="p-4 bg-red-100 rounded-md text-red-800 border border-red-200">
                            <Label className="text-xs font-bold uppercase tracking-wider text-red-900">🚨 SINAIS DE ALERTA (RED FLAGS) DETECTADOS</Label>
                            <ul className="list-disc list-inside mt-2 text-sm font-medium">
                                {Object.entries(red_flags_details || {})
                                    .filter(([_, value]) => value === true)
                                    .map(([key, _]) => <li key={key}>{key}</li>)}
                            </ul>
                            <p className="mt-3 text-xs font-bold text-red-900">Recomendação: Avaliação médica investigar estes sinais.</p>
                        </div>
                    )}

                    {medications && medications.length > 0 && (
                        <div className="p-4 bg-yellow-50 rounded-md border border-yellow-200">
                            <Label className="text-xs font-bold uppercase tracking-wider text-yellow-800">💊 IMPACTO DE MEDICAÇÕES NA RECUPERAÇÃO</Label>
                            <ul className="list-disc list-inside mt-2 text-sm text-yellow-900 font-medium">
                                {medications.map((m: string, i: number) => <li key={i}>{m}</li>)}
                            </ul>
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
                    Data: {new Date().toLocaleDateString()} | ID: {result.session_id} | Versão: MyID v2.0
                </p>
            </div>
        </div>
    );
}
