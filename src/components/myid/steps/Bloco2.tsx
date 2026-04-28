import React from 'react';
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Sobre a sua dor</h2>
                <p className="text-gray-500">Isso nos ajuda a entender a "natureza" da sua dor.</p>
            </div>

            <div className="space-y-8">
                <div className="space-y-4">
                    <Label className="text-base font-bold text-gray-800">Qual é a intensidade da sua dor agora (neste exato momento)?</Label>
                    <div className="px-2 pt-2">
                        <Slider
                            defaultValue={[data.bloco_2_pain_now || 0]}
                            max={10}
                            step={1}
                            onValueChange={(v) => updateData({ bloco_2_pain_now: v[0] })}
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                            <span>0 (Nenhuma Dor)</span>
                            <span>10 (Pior dor imaginável)</span>
                        </div>
                    </div>
                    <div className="text-center font-black text-3xl text-primary mt-2">{data.bloco_2_pain_now || 0} <span className="text-xl text-gray-400 font-bold">/ 10</span></div>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted">
                    <Label className="text-base font-bold text-gray-800">Qual foi a pior intensidade da dor nos últimos 7 dias?</Label>
                    <div className="px-2 pt-2">
                        <Slider
                            defaultValue={[data.bloco_2_pain_max || 0]}
                            max={10}
                            step={1}
                            onValueChange={(v) => updateData({ bloco_2_pain_max: v[0] })}
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                            <span>0 (Nenhuma Dor)</span>
                            <span>10 (Pior dor imaginável)</span>
                        </div>
                    </div>
                    <div className="text-center font-black text-3xl text-primary mt-2">{data.bloco_2_pain_max || 0} <span className="text-xl text-gray-400 font-bold">/ 10</span></div>
                </div>

                <div className="space-y-4 pt-6 border-t border-muted">
                    <div>
                        <Label className="text-base font-bold text-gray-800 flex items-center gap-2">Outros sintomas</Label>
                        <p className="text-sm font-medium text-gray-700 mt-1">Por favor, responda com atenção.</p>
                        <p className="text-sm text-gray-500 mt-1">Você apresentou algum destes sintomas nas últimas semanas, junto com a sua dor atual?</p>
                    </div>

                    <div className="space-y-3 bg-red-50/40 p-5 rounded-xl border border-red-100/50">
                        {[
                            { id: 'weight_loss', label: 'Perda de peso inexplicada e rápida (sem fazer dieta)' },
                            { id: 'fever', label: 'Febre inexplicada, calafrios ou suores noturnos frequentes' },
                            { id: 'night_pain', label: 'Dor severa que te acorda de madrugada e NÃO MELHORA nada quando você muda de posição na cama' },
                            { id: 'incontinence', label: 'Perda recente do controle da urina/fezes (ou dormência na região genital/ânus tipo "sela de cavalo")' },
                            { id: 'progressive', label: 'Fraqueza grave nas pernas/braços que está piorando nos últimos dias (ex: tropeçando por fraqueza)' },
                            { id: 'neuropathy', label: 'Dormência, formigamento severo ("choque") descendo por um braço ou perna inteira' },
                            { id: 'none', label: 'NENHUM DESSES SINAIS SE APLICA (Marque aqui apenas se a resposta for "Não" para todas acima)' }
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
                        <Label className="text-base font-bold text-gray-800">Com que frequência você sente dor?</Label>
                        <p className="text-sm text-gray-500 mt-1">Qual a frequência com que a dor aparece?</p>
                    </div>
                    <RadioGroup
                        value={data.bloco_2_pain_frequency || ''}
                        onValueChange={(v) => updateData({ bloco_2_pain_frequency: v })}
                        className="space-y-3 p-5 bg-muted/20 rounded-xl border border-muted/50"
                    >
                        <div className="flex items-center space-x-3">
                            <RadioGroupItem value="constant" id="freq-1" />
                            <Label htmlFor="freq-1" className="cursor-pointer text-sm font-semibold">Constantemente (O tempo todo ou quase todo o tempo)</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                            <RadioGroupItem value="daily" id="freq-2" />
                            <Label htmlFor="freq-2" className="cursor-pointer text-sm font-semibold">Diariamente (Todos os dias, mas em momentos específicos)</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                            <RadioGroupItem value="weekly" id="freq-3" />
                            <Label htmlFor="freq-3" className="cursor-pointer text-sm font-semibold">Semanalmente (Alguns dias na semana)</Label>
                        </div>
                        <div className="flex items-center space-x-3">
                            <RadioGroupItem value="monthly" id="freq-4" />
                            <Label htmlFor="freq-4" className="cursor-pointer text-sm font-semibold">Mensalmente ou Raramente (Episódios isolados)</Label>
                        </div>
                    </RadioGroup>
                </div>

                <div className="space-y-4 pt-6 border-t border-muted">
                    <div>
                        <Label className="text-base font-bold text-gray-800">Quando a dor é pior?</Label>
                        <p className="text-sm text-gray-500 mt-1">Em qual período do dia a dor costuma ser mais forte?</p>
                    </div>
                    <RadioGroup
                        value={data.bloco_2_worst_time || ''}
                        onValueChange={(v) => updateData({ bloco_2_worst_time: v })}
                        className="space-y-3 p-5 bg-muted/20 rounded-xl border border-muted/50"
                    >
                        <div className="flex items-center space-x-3"><RadioGroupItem value="morning" id="wt-1" /><Label htmlFor="wt-1" className="cursor-pointer text-sm font-semibold">Manhã (Ao acordar ou logo nas primeiras horas)</Label></div>
                        <div className="flex items-center space-x-3"><RadioGroupItem value="afternoon" id="wt-2" /><Label htmlFor="wt-2" className="cursor-pointer text-sm font-semibold">Tarde (Durante as atividades do dia)</Label></div>
                        <div className="flex items-center space-x-3"><RadioGroupItem value="night" id="wt-3" /><Label htmlFor="wt-3" className="cursor-pointer text-sm font-semibold">Noite (Fim do dia, após a jornada)</Label></div>
                        <div className="flex items-center space-x-3"><RadioGroupItem value="dawn" id="wt-4" /><Label htmlFor="wt-4" className="cursor-pointer text-sm font-semibold">Madrugada (Acorda por causa da dor)</Label></div>
                        <div className="flex items-center space-x-3"><RadioGroupItem value="random" id="wt-5" /><Label htmlFor="wt-5" className="cursor-pointer text-sm font-semibold">Aleatório (Não tem hora certa)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4 pt-6 border-t border-muted">
                    <div>
                        <Label className="text-base font-bold text-gray-800">Qual é seu padrão temporal e mecânico?</Label>
                        <p className="text-sm text-gray-500 mt-1">Como o seu corpo se comporta perante a dor? (Marque as aplicáveis)</p>
                    </div>
                    <div className="space-y-3 p-5 bg-muted/20 rounded-xl border border-muted/50">
                        {[
                            { id: 'nocturnal', label: 'NOTURNA', desc: 'Dói muito PARADO durante a madrugada, e costuma me acordar. Andar/movimentar de noite muitas vezes alivia um pouco.' },
                            { id: 'morning_stiffness', label: 'RIGIDEZ MATINAL', desc: 'Acorda "travado", parecendo um robô. Leva mais de 30-40 min depois que acordo para "destravar" e soltar o corpo.' },
                            { id: 'mechanical', label: 'MECÂNICO', desc: 'Piora claramente DEPOIS ou DURANTE movimento longo (ex: muito tempo sentado, andando muito, levantando peso). Costuma melhorar deitando em repouso.' },
                            { id: 'post_exercise', label: 'PÓS-ESFORÇO', desc: 'Durante o treino tá "tudo bem" mas a dor chega com força no FINAL do dia ou no DIA SEGUINTE com sensação pesada.' }
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
