import React from 'react';
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";

interface Bloco2Props {
    data: any;
    updateData: (data: any) => void;
}

export function Bloco2({ data, updateData }: Bloco2Props) {
    const handleRedFlagChange = (field: string, checked: boolean) => {
        const current = data.bloco_2_red_flags || {};
        updateData({ bloco_2_red_flags: { ...current, [field]: checked } });
    };

    const handlePatternChange = (value: string, checked: boolean) => {
        const current = data.bloco_2_temporal_pattern || [];
        if (checked) {
            updateData({ bloco_2_temporal_pattern: [...current, value] });
        } else {
            updateData({ bloco_2_temporal_pattern: current.filter((item: string) => item !== value) });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Bloco 2: Dor e Padrão Temporal</h2>
                <p className="text-gray-500">Como é a sua dor agora e no pior momento?</p>
            </div>

            <div className="space-y-6">
                <div className="space-y-4">
                    <Label className="text-base font-semibold">2.1 Qual é a intensidade da dor AGORA?</Label>
                    <div className="px-2">
                        <Slider
                            defaultValue={[data.bloco_2_pain_now || 0]}
                            max={10}
                            step={1}
                            onValueChange={(v) => updateData({ bloco_2_pain_now: v[0] })}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>0 (Nenhuma)</span>
                            <span>10 (Pior possível)</span>
                        </div>
                    </div>
                    <div className="text-center font-bold text-lg text-primary">{data.bloco_2_pain_now || 0} / 10</div>
                </div>

                <div className="space-y-4">
                    <Label className="text-base font-semibold">2.2 Qual é a intensidade no PIOR MOMENTO (últimos 7 dias)?</Label>
                    <div className="px-2">
                        <Slider
                            defaultValue={[data.bloco_2_pain_max || 0]}
                            max={10}
                            step={1}
                            onValueChange={(v) => updateData({ bloco_2_pain_max: v[0] })}
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-2">
                            <span>0 (Nenhuma)</span>
                            <span>10 (Pior possível)</span>
                        </div>
                    </div>
                    <div className="text-center font-bold text-lg text-primary">{data.bloco_2_pain_max || 0} / 10</div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                    <Label className="text-base font-semibold text-red-600">2.3 SINAIS DE ALERTA (Red Flags)</Label>
                    <p className="text-sm text-gray-600">Você tem apresentado algum destes SINTOMAS RECENTEMENTE junto com a dor?</p>
                    <div className="space-y-3 bg-red-50/50 p-4 rounded-lg border border-red-100">
                        {[
                            { id: 'weight_loss', label: 'Perda de peso inexplicada recentamente' },
                            { id: 'fever', label: 'Febre ou calafrios' },
                            { id: 'night_pain', label: 'Dor severa à noite (que acorda do sono e não melhora mudando de posição)' },
                            { id: 'incontinence', label: 'Perda de controle do xixi ou cocô (ou dormência na região íntima)' },
                            { id: 'progressive', label: 'Fraqueza grave e progressiva nas pernas que piora rápido' },
                            { id: 'neuropathy', label: 'Dormência, formigamento severo e perda de força em um braço/perna' }
                        ].map(flag => (
                            <div key={flag.id} className="flex items-start space-x-3">
                                <Checkbox
                                    id={`rf-${flag.id}`}
                                    checked={!!(data.bloco_2_red_flags?.[flag.id])}
                                    onCheckedChange={(c) => handleRedFlagChange(flag.id, !!c)}
                                />
                                <Label htmlFor={`rf-${flag.id}`} className="font-medium cursor-pointer text-sm leading-tight">
                                    {flag.label}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                    <Label className="text-base font-semibold">2.4 Qual é o PADRÃO TEMPORAL da sua dor?</Label>
                    <p className="text-sm text-gray-600">Marque TODAS as situações onde a dor é pior ou mais frequente:</p>
                    <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                        {[
                            { id: 'nocturnal', label: 'Noturno: Dói muito de madrugada / acordando do sono' },
                            { id: 'morning_stiffness', label: 'Travamento Matinal: Dói muito pra levantar e fica rígido até "aquecer"' },
                            { id: 'mechanical', label: 'Mecânico / Movimento: Dói SÓ quando faço movimentos específicos ou em posições mantidas' },
                            { id: 'post_exercise', label: 'Pós-Exercício: Dor pior no dia seguinte ou horas após a atividade' }
                        ].map(pattern => (
                            <div key={pattern.id} className="flex items-start space-x-3">
                                <Checkbox
                                    id={`pat-${pattern.id}`}
                                    checked={(data.bloco_2_temporal_pattern || []).includes(pattern.id)}
                                    onCheckedChange={(c) => handlePatternChange(pattern.id, !!c)}
                                />
                                <Label htmlFor={`pat-${pattern.id}`} className="font-medium cursor-pointer text-sm leading-tight">
                                    {pattern.label}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
