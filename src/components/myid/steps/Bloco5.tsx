import React from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface Bloco5Props {
    data: any;
    updateData: (data: any) => void;
}

export function Bloco5({ data, updateData }: Bloco5Props) {
    const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
        const current = data[field] || [];
        if (checked) {
            updateData({ [field]: [...current, value] });
        } else {
            updateData({ [field]: current.filter((item: string) => item !== value) });
        }
    };

    const handleObjCheckboxChange = (field: string, key: string, checked: boolean) => {
        const current = data[field] || {};
        updateData({ [field]: { ...current, [key]: checked } });
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Bloco 5: Estilo de Vida</h2>
                <p className="text-gray-500">Sono, Nutrição, Hidratação e Ergonomia (Pilares de Recuperação)</p>
            </div>

            {/* 5A: Sono */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5A. Sono (Quality Factor)</h3>

                <div className="space-y-4">
                    <Label className="font-semibold">5A.1 Quantas horas você dorme por noite? (Ideal 7-9h)</Label>
                    <Input
                        type="number"
                        min="0" max="24"
                        placeholder="Ex: 7"
                        value={data.bloco_5a_hours || ''}
                        onChange={(e) => updateData({ bloco_5a_hours: parseFloat(e.target.value) })}
                        className="w-32"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold">5A.2 Qual a qualidade do seu sono?</Label>
                    <RadioGroup
                        value={data.bloco_5a_quality?.toString() || ''}
                        onValueChange={(v) => updateData({ bloco_5a_quality: parseInt(v) })}
                        className="flex flex-wrap gap-4"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="0" id="sq-0" /><Label htmlFor="sq-0">Péssimo (0)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="3" id="sq-3" /><Label htmlFor="sq-3">Ruim (3)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="5" id="sq-5" /><Label htmlFor="sq-5">Regular (5)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="8" id="sq-8" /><Label htmlFor="sq-8">Bom (8)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="10" id="sq-10" /><Label htmlFor="sq-10">Excelente (10)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold">5A.3 Com que frequência acorda na calada da noite e não consegue voltar a dormir?</Label>
                    <RadioGroup
                        value={data.bloco_5a_awake || ''}
                        onValueChange={(v) => updateData({ bloco_5a_awake: v })}
                        className="flex flex-wrap gap-4"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="never" id="sa-never" /><Label htmlFor="sa-never">Nunca</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="rarely" id="sa-rarely" /><Label htmlFor="sa-rarely">Raramente</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="frequently" id="sa-freq" /><Label htmlFor="sa-freq">Frequentemente</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="always" id="sa-always" /><Label htmlFor="sa-always">Sempre</Label></div>
                    </RadioGroup>
                </div>
            </section>

            {/* 5B: Energia */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5B. Energia</h3>

                <div className="space-y-4">
                    <Label className="font-semibold">5B.1 Acorda se sentindo cansado (sem energia) mesmo tendo dormido o suficiente?</Label>
                    <RadioGroup
                        value={data.bloco_5b_tired_awake || ''}
                        onValueChange={(v) => updateData({ bloco_5b_tired_awake: v })}
                        className="flex flex-wrap gap-4"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="never" id="en-never" /><Label htmlFor="en-never">Nunca</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="sometimes" id="en-some" /><Label htmlFor="en-some">Às vezes</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="frequently" id="en-freq" /><Label htmlFor="en-freq">Frequentemente</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="always" id="en-always" /><Label htmlFor="en-always">Sempre</Label></div>
                    </RadioGroup>
                </div>
            </section>

            {/* 5E: Atividade Física */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5E. Atividade Física</h3>

                <div className="space-y-4">
                    <Label className="font-semibold">Quantas horas por dia fica sentado direto?</Label>
                    <Input
                        type="number"
                        min="0" max="24"
                        placeholder="Ex: 8"
                        value={data.bloco_5e_sitting_hours || ''}
                        onChange={(e) => updateData({ bloco_5e_sitting_hours: parseFloat(e.target.value) })}
                        className="w-32"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold">Nível de estilo de vida atual?</Label>
                    <RadioGroup
                        value={data.bloco_5e_lifestyle || ''}
                        onValueChange={(v) => updateData({ bloco_5e_lifestyle: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="very_sedentary" id="ls-vs" /><Label htmlFor="ls-vs">Muito sedentário (apenas cama/sofá)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="sedentary" id="ls-s" /><Label htmlFor="ls-s">Sedentário (passos em casa/trabalho apenas)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="moderate" id="ls-m" /><Label htmlFor="ls-m">Moderado (alguma caminhada, tarefas ativas)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="active" id="ls-a" /><Label htmlFor="ls-a">Ativo (exercícios regulares 3+ vezes/semana)</Label></div>
                    </RadioGroup>
                </div>
            </section>

            {/* 5F: Hidratação */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5F. Hidratação</h3>

                <div className="space-y-4">
                    <Label className="font-semibold">Quantos litros de água bebe por dia? (Ideal: 3-4L)</Label>
                    <Input
                        type="number"
                        min="0" max="10" step="0.1"
                        placeholder="Ex: 2.5"
                        value={data.bloco_5f_water_liters || ''}
                        onChange={(e) => updateData({ bloco_5f_water_liters: parseFloat(e.target.value) })}
                        className="w-32"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold">Sintomas comuns?</Label>
                    <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="hid-1"
                                checked={!!data.bloco_5f_dehydration_symptoms?.dry_mouth_frequent}
                                onCheckedChange={(c) => handleObjCheckboxChange('bloco_5f_dehydration_symptoms', 'dry_mouth_frequent', !!c)}
                            />
                            <Label htmlFor="hid-1">Boca seca frequentemente</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="hid-2"
                                checked={!!data.bloco_5f_dehydration_symptoms?.fatigue_water_helps}
                                onCheckedChange={(c) => handleObjCheckboxChange('bloco_5f_dehydration_symptoms', 'fatigue_water_helps', !!c)}
                            />
                            <Label htmlFor="hid-2">Sente cansaço e melhora muito quando bebe água</Label>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5G: Nutrição */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5G. Nutrição</h3>

                <div className="space-y-4">
                    <Label className="font-semibold">Consumo de proteína (carne, peixe, frango, ovos)?</Label>
                    <RadioGroup
                        value={data.bloco_5g_protein || ''}
                        onValueChange={(v) => updateData({ bloco_5g_protein: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="rarely" id="pt-1" /><Label htmlFor="pt-1">Raramente</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="sometimes" id="pt-2" /><Label htmlFor="pt-2">Às vezes (1 refeição/dia)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="almost_all" id="pt-3" /><Label htmlFor="pt-3">Quase todas as refeições</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="pt-4" /><Label htmlFor="pt-4">Todas (ideal)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold">Porções de frutas/vegetais por dia?</Label>
                    <Input
                        type="number"
                        min="0" max="20"
                        placeholder="Ex: 3"
                        value={data.bloco_5g_fruits_portions || ''}
                        onChange={(e) => updateData({ bloco_5g_fruits_portions: parseInt(e.target.value) })}
                        className="w-32"
                    />
                </div>
            </section>

            {/* 5H: Ergonomia */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5H. Postura e Ergonomia</h3>

                <div className="space-y-4">
                    <Label className="font-semibold">Ambiente de trabalho?</Label>
                    <RadioGroup
                        value={data.bloco_5h_workspace || ''}
                        onValueChange={(v) => updateData({ bloco_5h_workspace: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="ws-none" /><Label htmlFor="ws-none">Nenhum (cama/sofá improvisado)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="precarious" id="ws-prec" /><Label htmlFor="ws-prec">Precário (mesa de jantar, sem apoio)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="acceptable" id="ws-acc" /><Label htmlFor="ws-acc">Aceitável (cadeira simples, alguma adaptação)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="good" id="ws-good" /><Label htmlFor="ws-good">Bom (cadeira escritório, monitor ajustado)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="excellent" id="ws-exc" /><Label htmlFor="ws-exc">Excelente (setup ergonômico completo, apoio braço/pé)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold">Qualidade do Colchão?</Label>
                    <RadioGroup
                        value={data.bloco_5h_mattress || ''}
                        onValueChange={(v) => updateData({ bloco_5h_mattress: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="old" id="mat-old" /><Label htmlFor="mat-old">Muito Velho/Afundando</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="bad" id="mat-bad" /><Label htmlFor="mat-bad">Ruim (muito mole ou muito duro, dá dor)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="acceptable" id="mat-acc" /><Label htmlFor="mat-acc">Aceitável</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="good" id="mat-good" /><Label htmlFor="mat-good">Bom e firme</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="excellent" id="mat-exc" /><Label htmlFor="mat-exc">Excelente / Específico</Label></div>
                    </RadioGroup>
                </div>
            </section>

        </div>
    );
}
