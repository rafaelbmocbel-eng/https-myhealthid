import React from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Bloco4Props {
    data: any;
    updateData: (data: any) => void;
}

export function Bloco4({ data, updateData }: Bloco4Props) {
    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">BLOCO 4: COMPORTAMENTO E CRENCAS</h2>
            </div>

            <div className="space-y-8">
                <div className="space-y-4">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 4.1: MEDO DO MOVIMENTO</Label>
                    <p className="text-sm font-medium text-gray-600 italic">"Tenho medo que me movimentar ou fazer exercícios piore meu problema."</p>
                    <RadioGroup
                        value={data.bloco_4_fear_movement?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_fear_movement: parseInt(v) })}
                        className="space-y-3 p-4 bg-muted/20 rounded-xl"
                    >
                        {[
                            { val: 1, label: 'Discordo Totalmente (Não tenho medo)' },
                            { val: 2, label: 'Discordo Parcialmente (Tenho pouco medo)' },
                            { val: 3, label: 'Concordo Parcialmente (Tenho algum medo)' },
                            { val: 4, label: 'Concordo Totalmente (Tenho muito medo)' },
                        ].map(opt => (
                            <div key={opt.val} className="flex items-center space-x-3">
                                <RadioGroupItem value={opt.val.toString()} id={`fear-${opt.val}`} />
                                <Label htmlFor={`fear-${opt.val}`} className="cursor-pointer text-sm font-semibold">{opt.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 4.2: CRENÇA DE DANO</Label>
                    <p className="text-sm font-medium text-gray-600 italic">"Acredito que a dor é um sinal de que algo está fisicamente estragado no meu corpo."</p>
                    <RadioGroup
                        value={data.bloco_4_belief_damage?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_belief_damage: parseInt(v) })}
                        className="space-y-3 p-4 bg-muted/20 rounded-xl"
                    >
                        {[
                            { val: 1, label: 'Discordo Totalmente (É apenas um alarme)' },
                            { val: 2, label: 'Discordo Parcialmente' },
                            { val: 3, label: 'Concordo Parcialmente' },
                            { val: 4, label: 'Concordo Totalmente (Estou quebrado/doente)' },
                        ].map(opt => (
                            <div key={opt.val} className="flex items-center space-x-3">
                                <RadioGroupItem value={opt.val.toString()} id={`belief-${opt.val}`} />
                                <Label htmlFor={`belief-${opt.val}`} className="cursor-pointer text-sm font-semibold">{opt.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 4.3: EVITAÇÃO (COMPORTAMENTO DE FUGA)</Label>
                    <p className="text-sm font-medium text-gray-600 italic">"Eu evito fazer atividades importantes hoje porque podem causar dor amanhã."</p>
                    <RadioGroup
                        value={data.bloco_4_avoidance?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_avoidance: parseInt(v) })}
                        className="space-y-3 p-4 bg-muted/20 rounded-xl"
                    >
                        {[
                            { val: 1, label: 'Discordo (Faço tudo igual, não evito nada)' },
                            { val: 2, label: 'Evito apenas coisas muito intensas' },
                            { val: 3, label: 'Evito a maioria das atividades' },
                            { val: 4, label: 'Concordo Totalmente (Parei a minha vida por precaução)' },
                        ].map(opt => (
                            <div key={opt.val} className="flex items-center space-x-3">
                                <RadioGroupItem value={opt.val.toString()} id={`avoid-${opt.val}`} />
                                <Label htmlFor={`avoid-${opt.val}`} className="cursor-pointer text-sm font-semibold">{opt.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 4.4: AUTO-EFICÁCIA (CONTROLE)</Label>
                    <p className="text-sm font-medium text-gray-600 italic">"Apesar da dor, eu consigo realizar a maioria das minhas atividades normais se eu quiser."</p>
                    <RadioGroup
                        className="flex flex-wrap gap-2 sm:gap-4 mt-2"
                        value={data.bloco_4_self_efficacy?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_self_efficacy: parseInt(v) })}
                    >
                        {[
                            { val: 0, label: '0 (Nenhum controle)' },
                            { val: 2, label: '2' },
                            { val: 5, label: '5' },
                            { val: 8, label: '8' },
                            { val: 10, label: '10 (Controle Total)' },
                        ].map(item => (
                            <div key={item.val} className="flex flex-col items-center space-y-1">
                                <RadioGroupItem value={item.val.toString()} id={`eff-${item.val}`} className="w-5 h-5 sm:w-6 sm:h-6" />
                                <Label htmlFor={`eff-${item.val}`} className="text-xs font-medium cursor-pointer text-center max-w-20">
                                    {item.label}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>
            </div>
        </div>
    );
}
