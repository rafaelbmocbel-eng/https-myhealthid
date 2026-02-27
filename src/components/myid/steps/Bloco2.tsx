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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">BLOCO 2: CARACTERÍSTICAS DA DOR E PADRÃO TEMPORAL</h2>
                <p className="text-gray-500">Isso nos ajuda a entender a "natureza" da sua dor.</p>
            </div>

            <div className="space-y-8">
                <div className="space-y-4">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 2.1: QUAL É A INTENSIDADE DA SUA DOR AGORA?</Label>
                    <div className="px-2 pt-2">
                        <Slider
                            defaultValue={[data.bloco_2_pain_now || 0]}
                            max={10}
                            step={1}
                            onValueChange={(v) => updateData({ bloco_2_pain_now: v[0] })}
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                            <span>0 (Nenhuma)</span>
                            <span>10 (Pior possível)</span>
                        </div>
                    </div>
                    <div className="text-center font-black text-3xl text-primary mt-2">{data.bloco_2_pain_now || 0} <span className="text-xl text-gray-400 font-bold">/ 10</span></div>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 2.2: QUAL FOI A PIOR INTENSIDADE NOS ÚLTIMOS 7 DIAS?</Label>
                    <div className="px-2 pt-2">
                        <Slider
                            defaultValue={[data.bloco_2_pain_max || 0]}
                            max={10}
                            step={1}
                            onValueChange={(v) => updateData({ bloco_2_pain_max: v[0] })}
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                            <span>0 (Nenhuma)</span>
                            <span>10 (Pior possível)</span>
                        </div>
                    </div>
                    <div className="text-center font-black text-3xl text-primary mt-2">{data.bloco_2_pain_max || 0} <span className="text-xl text-gray-400 font-bold">/ 10</span></div>
                </div>

                <div className="space-y-4 pt-6 border-t border-muted">
                    <div>
                        <Label className="text-base font-bold text-gray-800 flex items-center gap-2">PERGUNTA 2.3: SINAIS DE ALERTA (RED FLAGS) <span className="text-xl">⚠️</span></Label>
                        <p className="text-sm text-gray-500 mt-1">Você apresentou algum destes SINTOMAS RECENTEMENTE junto com a dor?</p>
                    </div>

                    <div className="space-y-3 bg-red-50/40 p-5 rounded-xl border border-red-100/50">
                        {[
                            { id: 'weight_loss', label: 'Perda de peso inexplicada' },
                            { id: 'fever', label: 'Febre ou calafrios frequentes' },
                            { id: 'night_pain', label: 'Dor severa que te acorda de madrugada e não melhora mudando de posição' },
                            { id: 'incontinence', label: 'Perda de controle do xixi ou cocô (ou dormência na região íntima)' },
                            { id: 'progressive', label: 'Fraqueza grave nas pernas que piora rápido' },
                            { id: 'neuropathy', label: 'Dormência, formigamento severo e perda de força em um braço/perna inteira' },
                            { id: 'none', label: 'NENHUM DESSES SINAIS' }
                        ].map(flag => (
                            <div key={flag.id} className="flex items-start space-x-3">
                                <Checkbox
                                    id={`rf-${flag.id}`}
                                    checked={!!(data.bloco_2_red_flags?.[flag.id])}
                                    onCheckedChange={(c) => handleRedFlagChange(flag.id, !!c)}
                                />
                                <Label htmlFor={`rf-${flag.id}`} className={`font-semibold cursor-pointer text-sm leading-tight mt-0.5 ${flag.id === 'none' ? 'text-green-700' : 'text-gray-700'}`}>
                                    {flag.label}
                                </Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-muted">
                    <div>
                        <Label className="text-base font-bold text-gray-800">PERGUNTA 2.4: QUAL É SEU PADRÃO TEMPORAL?</Label>
                        <p className="text-sm text-gray-500 mt-1">Marque TODAS as situações onde a dor é pior:</p>
                    </div>
                    <div className="space-y-3 p-5 bg-muted/20 rounded-xl border border-muted/50">
                        {[
                            { id: 'nocturnal', label: 'NOTURNO', desc: 'Dói muito de madrugada / piora ao deitar' },
                            { id: 'morning_stiffness', label: 'MATINAL', desc: 'Dói pra levantar da cama e fica rígido até "aquecer" o corpo' },
                            { id: 'mechanical', label: 'MECÂNICO', desc: 'Dói SÓ quando faço movimentos específicos ou fico muito tempo na mesma posição' },
                            { id: 'post_exercise', label: 'PÓS-ESFORÇO', desc: 'Só começa a doer horas depois do exercício ou no dia seguinte' }
                        ].map(pattern => (
                            <div key={pattern.id} className="flex items-start space-x-3">
                                <Checkbox
                                    id={`pat-${pattern.id}`}
                                    checked={(data.bloco_2_temporal_pattern || []).includes(pattern.id)}
                                    onCheckedChange={(c) => handlePatternChange(pattern.id, !!c)}
                                />
                                <div className="space-y-0.5 mt-0.5">
                                    <Label htmlFor={`pat-${pattern.id}`} className="font-bold cursor-pointer text-sm">
                                        {pattern.label}
                                    </Label>
                                    <p className="text-xs text-gray-600 leading-tight">{pattern.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
