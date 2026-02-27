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
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto">
            <div className="text-center space-y-4">
                <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">SEU RESULTADO MyID</h1>
                <p className="text-xl text-gray-500">Impressão Digital Sistêmica Decodificada</p>
            </div>

            <Card className="border-4 bg-white/50 backdrop-blur-sm overflow-hidden shadow-xl" style={{ borderColor: status === 'EMERGENCY' ? '#ef4444' : status === 'ALERT' ? '#f59e0b' : '#10b981' }}>
                <CardContent className="p-8 text-center space-y-6">
                    <div className="space-y-2">
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
                        <p className="text-lg font-medium text-gray-700 mt-4">{recommendation}</p>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-red-600 flex items-center gap-2">
                            <span className="text-xl">⚠️</span> Foco no Numerador (Demanda)
                        </CardTitle>
                        <CardDescription>O que está sobrecarregando o sistema</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Dor (D)</span>
                                <span>{D_pain}/10</span>
                            </div>
                            <Progress value={D_pain * 10} className="h-2 bg-red-100" indicatorClassName="bg-red-500" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Incapacidade (EFI)</span>
                                <span>{EFI_functionality}/10</span>
                            </div>
                            <Progress value={EFI_functionality * 10} className="h-2 bg-orange-100" indicatorClassName="bg-orange-500" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Psicológico/Medo (P)</span>
                                <span>{P_psychological}/10</span>
                            </div>
                            <Progress value={P_psychological * 10} className="h-2 bg-yellow-100" indicatorClassName="bg-yellow-500" />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm font-medium">
                                <span>Inércia/Gatilhos (I)</span>
                                <span>{I_inertia}/10</span>
                            </div>
                            <Progress value={I_inertia * 10} className="h-2 bg-yellow-100" indicatorClassName="bg-yellow-500" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-green-600 flex items-center gap-2">
                            <span className="text-xl">🟢</span> Foco no Denominador (Suporte)
                        </CardTitle>
                        <CardDescription>O que está ajudando ou falhando na recuperação</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold"><span>Regulação (Sono)</span><span>{R_regulation}/10</span></div>
                                <Progress value={R_regulation * 10} className="h-1.5 bg-green-100" indicatorClassName="bg-green-500" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold"><span>Hidratação</span><span>{HID_hydration}/10</span></div>
                                <Progress value={HID_hydration * 10} className="h-1.5 bg-blue-100" indicatorClassName={HID_hydration < 5 ? "bg-red-500" : "bg-blue-500"} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold"><span>Nutrição</span><span>{NUT_nutrition}/10</span></div>
                                <Progress value={NUT_nutrition * 10} className="h-1.5 bg-green-100" indicatorClassName={NUT_nutrition < 5 ? "bg-red-500" : "bg-green-500"} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold"><span>Ergonomia</span><span>{ERG_ergonomics}/10</span></div>
                                <Progress value={ERG_ergonomics * 10} className="h-1.5 bg-purple-100" indicatorClassName="bg-purple-500" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold"><span>Atividade</span><span>{AF_activity}/10</span></div>
                                <Progress value={AF_activity * 10} className="h-1.5 bg-green-100" indicatorClassName="bg-green-500" />
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-semibold"><span>Ruído (-N)</span><span>{N_noise}/10</span></div>
                                <Progress value={N_noise * 10} className="h-1.5 bg-gray-200" indicatorClassName="bg-gray-700" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="bg-slate-50 border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-slate-800 text-lg">Padrão & Histórico</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Padrão Temporal da Dor</Label>
                            <p className="font-semibold text-slate-800 mt-1">{pain_pattern}</p>
                        </div>
                        <div>
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Prognóstico Clínico</Label>
                            <p className="font-semibold text-slate-800 mt-1">{healing_history?.prognosis}</p>
                        </div>
                        {red_flags && (
                            <div className="p-3 bg-red-100 rounded-md text-red-800 border border-red-200">
                                <Label className="text-xs font-bold uppercase tracking-wider">🚨 RED FLAGS DETECTADAS</Label>
                                <ul className="list-disc list-inside mt-2 text-sm">
                                    {Object.entries(red_flags_details || {})
                                        .filter(([_, value]) => value === true)
                                        .map(([key, _]) => <li key={key}>{key}</li>)}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader>
                        <CardTitle className="text-blue-800 text-lg">Plano de Ação</CardTitle>
                        <CardDescription className="text-blue-600/80">Prioridade: {clinical_priority}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-3">
                            {(focus_areas || []).map((area: string, i: number) => (
                                <li key={i} className="flex items-start gap-2">
                                    <span className="text-blue-500 font-bold mt-0.5">✓</span>
                                    <span className="text-blue-900 font-medium text-sm leading-tight">{area}</span>
                                </li>
                            ))}
                        </ul>
                        {medications && medications.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-blue-200/50">
                                <Label className="text-xs font-bold text-blue-700 uppercase">Atenção a Medicações:</Label>
                                <ul className="list-disc list-inside mt-1 text-sm text-blue-900">
                                    {medications.map((m: string, i: number) => <li key={i}>{m}</li>)}
                                </ul>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
