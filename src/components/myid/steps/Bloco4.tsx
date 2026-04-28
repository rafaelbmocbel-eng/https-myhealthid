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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Como você se sente em movimento</h2>
                <p className="text-gray-500">
                    O que você "pensa" que a dor significa altera até 30% a intensidade que ela chega no seu cérebro.
                </p>
            </div>

            <div className="space-y-8">
                <div className="space-y-4">
                    <Label className="text-base font-bold text-gray-800">Como você se sente ao se movimentar?</Label>
                    <p className="text-sm font-medium text-gray-600 italic">"Tenho muito medo que me movimentar da forma errada, abaixar para pegar um peso ou fazer exercícios piore muito meu problema."</p>
                    <RadioGroup
                        value={data.bloco_4_fear_movement?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_fear_movement: parseInt(v) })}
                        className="space-y-3 p-4 bg-muted/20 rounded-xl"
                    >
                        {[
                            { val: 1, label: 'Discordo Totalmente (Não tenho medo nenhum de me mexer, sei que não piora a lesão)' },
                            { val: 2, label: 'Discordo Parcialmente (Tenho pouco medo, só não abuso)' },
                            { val: 3, label: 'Concordo Parcialmente (Tenho algum medo considerável, evito bastante movimento)' },
                            { val: 4, label: 'Concordo Totalmente (Tenho verdadeiro pavor de me mover porque sei que vou travar)' },
                        ].map(opt => (
                            <div key={opt.val} className="flex items-center space-x-3">
                                <RadioGroupItem value={opt.val.toString()} id={`fear-${opt.val}`} />
                                <Label htmlFor={`fear-${opt.val}`} className="cursor-pointer text-sm font-semibold">{opt.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 4.2: CRENÇA DE DANO (KNOWLEDGE)</Label>
                    <p className="text-sm font-medium text-gray-600 italic">"Tenho certeza absoluta de que a minha dor acontece porque algo está 'rasgado', 'gastado', 'fora do lugar' ou 'estragado' e que só consertando a parte física a dor some."</p>
                    <RadioGroup
                        value={data.bloco_4_belief_damage?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_belief_damage: parseInt(v) })}
                        className="space-y-3 p-4 bg-muted/20 rounded-xl"
                    >
                        {[
                            { val: 1, label: 'Discordo Totalmente (Acho que minha dor muscular ou nervosa é só um alarme supersensível)' },
                            { val: 2, label: 'Discordo Parcialmente (Acredito que pode haver lesão física, mas o estresse e cansaço pioram)' },
                            { val: 3, label: 'Concordo Parcialmente (Acredito bastante que meu disco/tendão está machucado mesmo)' },
                            { val: 4, label: 'Concordo Totalmente (Sei por exames que estou "desgastado" ou "roto" e é exatamente por isso que dói)' },
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
                    <p className="text-sm font-medium text-gray-600 italic">"Mesmo que não doa muito AGORA, eu prefiro não fazer atividades importantes hoje só por garantia, de tanto medo de 'pagar a conta' e ter muita dor amanhã."</p>
                    <RadioGroup
                        value={data.bloco_4_avoidance?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_avoidance: parseInt(v) })}
                        className="space-y-3 p-4 bg-muted/20 rounded-xl"
                    >
                        {[
                            { val: 1, label: 'Discordo Totalmente (Faço o que preciso e não evito nada preventivamente)' },
                            { val: 2, label: 'Evito apenas coisas muito muito pesadas ou arriscadas' },
                            { val: 3, label: 'Evito muitas coisas e saídas de casa porque já imagino o que possa acontecer' },
                            { val: 4, label: 'Concordo Totalmente (Praticamente parei de agir e viver normalmente só por tentar prevenir a dor)' },
                        ].map(opt => (
                            <div key={opt.val} className="flex items-center space-x-3">
                                <RadioGroupItem value={opt.val.toString()} id={`avoid-${opt.val}`} />
                                <Label htmlFor={`avoid-${opt.val}`} className="cursor-pointer text-sm font-semibold">{opt.label}</Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 4.4: AUTO-EFICÁCIA (NÍVEL DE CONTROLE INTERNO)</Label>
                    <p className="text-sm font-medium text-gray-600 italic">"Se eu realmente me concentrar e usar minhas próprias ferramentas (descanso, atividade moderada, respirar, pensar diferente), eu sinto que EU MESMO consigo diminuir minha dor sem depender de remédio ou médico toda vez."</p>
                    <RadioGroup
                        className="flex flex-wrap gap-2 sm:gap-4 mt-2"
                        value={data.bloco_4_self_efficacy?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_self_efficacy: parseInt(v) })}
                    >
                        {[
                            { val: 0, label: '0 (Nenhum controle. Só com remédio ou médico eu melhoro)' },
                            { val: 2, label: '2' },
                            { val: 5, label: '5 (Confio moderadamente nas minhas ferramentas)' },
                            { val: 8, label: '8' },
                            { val: 10, label: '10 (Total controle. Eu sei administrar minha exata dor muito bem)' },
                        ].map(item => (
                            <div key={item.val} className="flex flex-col items-center space-y-1">
                                <RadioGroupItem value={item.val.toString()} id={`eff-${item.val}`} className="w-5 h-5 sm:w-6 sm:h-6" />
                                <Label htmlFor={`eff-${item.val}`} className="text-xs font-medium cursor-pointer text-center max-w-28">
                                    {item.label}
                                </Label>
                            </div>
                        ))}
                    </RadioGroup>
                </div>

                <div className="space-y-4 pt-6 border-t border-muted">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 4.5: EXPECTATIVA DE MELHORA</Label>
                    <p className="text-sm font-medium text-gray-600 italic">"Quanto você acredita que consegue melhorar do seu problema atual?"</p>
                    <RadioGroup
                        className="flex flex-wrap gap-2 sm:gap-4 mt-2"
                        value={data.bloco_4_expectation?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_4_expectation: parseInt(v) })}
                    >
                        {[
                            { val: 0, label: '0 (Acho que não vou melhorar nada, meu caso não tem solução)' },
                            { val: 2, label: '2' },
                            { val: 5, label: '5 (Tenho esperança de melhorar parcialmente)' },
                            { val: 8, label: '8' },
                            { val: 10, label: '10 (Acredito que vou me recuperar 100% e voltar ao normal)' },
                        ].map(item => (
                            <div key={item.val} className="flex flex-col items-center space-y-1">
                                <RadioGroupItem value={item.val.toString()} id={`exp-${item.val}`} className="w-5 h-5 sm:w-6 sm:h-6" />
                                <Label htmlFor={`exp-${item.val}`} className="text-xs font-medium cursor-pointer text-center max-w-28">
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
