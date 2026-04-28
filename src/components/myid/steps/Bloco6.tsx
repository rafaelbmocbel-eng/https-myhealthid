import React from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

interface Bloco6Props {
    data: any;
    updateData: (data: any) => void;
}

export function Bloco6({ data, updateData }: Bloco6Props) {
    const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
        const current = data[field] || [];
        if (checked) {
            updateData({ [field]: [...current, value] });
        } else {
            updateData({ [field]: current.filter((item: string) => item !== value) });
        }
    };

    return (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Histórico de saúde</h2>
                <p className="text-gray-500">Traumas, cicatrizes e disfunções viscerais invisíveis</p>
            </div>

            {/* Traumas e Cirurgias */}
            <section className="space-y-6">
                <div className="space-y-4">
                    <Label className="font-semibold text-base">Traumas axiais</Label>
                    <p className="text-sm text-gray-500">Você JÁ SOFREU alguma QUEDA FORTE SENTADO? (Impacto direto no bumbum, cóccix ou base da coluna)</p>
                    <RadioGroup
                        value={data.bloco_6_axial_trauma === undefined ? '' : (data.bloco_6_axial_trauma ? 'yes' : 'no')}
                        onValueChange={(v) => updateData({ bloco_6_axial_trauma: v === 'yes' })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="ax-no" /><Label htmlFor="ax-no">NÃO, nunca sofri queda assim</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="ax-yes" /><Label htmlFor="ax-yes">SIM, sofri queda forte</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Cicatrizes abdominais</Label>
                    <p className="text-sm text-gray-500">Você POSSUI CICATRIZ de CIRURGIA ABDOMINAL? (Marque todas que se aplicam ou deixe em branco se não)</p>
                    <div className="space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                        {[
                            { id: 'cesarea', label: 'Cesárea (parto cirúrgico)' },
                            { id: 'abdominoplastia', label: 'Abdominoplastia (cirurgia estética)' },
                            { id: 'apendicectomia', label: 'Apendicectomia (remoção do apêndice)' },
                            { id: 'colecistectomia', label: 'Colecistectomia (remoção da vesícula)' },
                            { id: 'histerectomia', label: 'Histerectomia (remoção do útero)' },
                            { id: 'hernia', label: 'Cirurgia de hérnia' }
                        ].map(surg => (
                            <div key={surg.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`surg-${surg.id}`}
                                    checked={(data.bloco_6_abdominal_surgeries || []).includes(surg.id)}
                                    onCheckedChange={(c) => handleCheckboxChange('bloco_6_abdominal_surgeries', surg.id, !!c)}
                                />
                                <Label htmlFor={`surg-${surg.id}`}>{surg.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Saúde Visceral */}
            <section className="space-y-6">
                <div className="space-y-4">
                    <Label className="font-semibold text-base">Saúde visceral - sinais autonômicos</Label>
                    <p className="text-sm text-gray-500">Você SENTE FREQUENTEMENTE algum destes sintomas? (Marque TODOS que se aplicam)</p>
                    <div className="space-y-3">
                        {[
                            { id: 'bloating', label: 'ESTUFAMENTO / INCHAÇO ABDOMINAL (Gases, sensação de plenitude)' },
                            { id: 'reflux', label: 'REFLUXO / AZIA (Ácido sobe, queimação, gosto amargo)' },
                            { id: 'gastritis', label: 'GASTRITE / DOR ABDOMINAL (Queimação, desconforto pós-refeição)' },
                            { id: 'tired_after_eat', label: 'CANSAÇO EXCESSIVO LOGO APÓS COMER (Cai energia, pernas pesadas)' },
                            { id: 'sleep_after_eat', label: 'SONO LOGO APÓS REFEIÇÕES (Adormece muito facilmente após comer)' },
                            { id: 'constipation', label: 'CONSTIPAÇÃO / INTESTINO PRESO (Dificuldade para evacuar, fezes duras)' },
                            { id: 'diarrhea', label: 'DIARREIA FREQUENTE (Evacuações soltas, sem controle)' }
                        ].map(vis => (
                            <div key={vis.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`vis-${vis.id}`}
                                    checked={(data.bloco_6_visceral_issues || []).includes(vis.id)}
                                    onCheckedChange={(c) => handleCheckboxChange('bloco_6_visceral_issues', vis.id, !!c)}
                                />
                                <Label htmlFor={`vis-${vis.id}`}>{vis.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Hormônios Mulheres */}
            <section className="space-y-6 border-t pt-6 bg-pink-50/40 p-5 rounded-xl border border-pink-100">
                <h3 className="text-lg font-semibold text-pink-800">Perguntas para mulheres (opcional)</h3>
                <div className="space-y-6 pt-2">
                    <div className="space-y-4">
                        <Label className="font-semibold text-base">Histórico específico</Label>
                        <p className="text-sm text-gray-500">Você tem DIAGNÓSTICO de alguma condição hormonal/reprodutiva?</p>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="diag-endo"
                                    checked={!!data.bloco_6_endometriosis}
                                    onCheckedChange={(c) => updateData({ bloco_6_endometriosis: !!c })}
                                />
                                <Label htmlFor="diag-endo">Endometriose</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="diag-pcos"
                                    checked={!!data.bloco_6_pcos}
                                    onCheckedChange={(c) => updateData({ bloco_6_pcos: !!c })}
                                />
                                <Label htmlFor="diag-pcos">Síndrome do ovário policístico (pcos)</Label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-pink-200">
                        <Label className="font-semibold text-base">Ciclo menstrual e hormônios </Label>

                        <div className="space-y-2">
                            <Label className="text-sm font-semibold text-pink-900">6.5A Seu ciclo menstrual é REGULAR?</Label>
                            <RadioGroup
                                value={data.bloco_6_cycle_regularity || 'regular'}
                                onValueChange={(v) => updateData({ bloco_6_cycle_regularity: v })}
                                className="space-y-2"
                            >
                                <div className="flex items-center space-x-2"><RadioGroupItem value="regular" id="cyc-1" /><Label htmlFor="cyc-1">Muito regular / Relativamente regular</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="irregular" id="cyc-2" /><Label htmlFor="cyc-2">Irregular (varia muito)</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="no_cycle" id="cyc-3" /><Label htmlFor="cyc-3">Sem ciclo (menopausa ou amenorreia)</Label></div>
                            </RadioGroup>
                        </div>

                        <div className="space-y-2 pt-4">
                            <Label className="text-sm font-semibold text-pink-900">6.5b a dor piora em determinada fase do ciclo?</Label>
                            <RadioGroup
                                value={data.bloco_6_cycle_affects_pain === undefined ? '' : (data.bloco_6_cycle_affects_pain ? 'yes' : 'no')}
                                onValueChange={(v) => updateData({ bloco_6_cycle_affects_pain: v === 'yes' })}
                                className="space-y-2"
                            >
                                <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="cyp-no" /><Label htmlFor="cyp-no">NÃO, dor é igual o mês todo</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="cyp-yes" /><Label htmlFor="cyp-yes">SIM, piora em alguma fase</Label></div>
                            </RadioGroup>
                            {data.bloco_6_cycle_affects_pain && (
                                <div className="ml-6 mt-2 space-y-2 border-l-2 border-pink-200 pl-4 py-2">
                                    <Label className="text-sm text-pink-800">Em qual fase?</Label>
                                    <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="ph-lut" checked={(data.bloco_6_cycle_pain_phase || []).includes('luteal')}
                                                onCheckedChange={(c) => handleCheckboxChange('bloco_6_cycle_pain_phase', 'luteal', !!c)} />
                                            <Label htmlFor="ph-lut" className="text-sm">Antes da Menstruação (Lútea / TPM)</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="ph-men" checked={(data.bloco_6_cycle_pain_phase || []).includes('menstruation')}
                                                onCheckedChange={(c) => handleCheckboxChange('bloco_6_cycle_pain_phase', 'menstruation', !!c)} />
                                            <Label htmlFor="ph-men" className="text-sm">Durante a Menstruação</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <Checkbox id="ph-ovu" checked={(data.bloco_6_cycle_pain_phase || []).includes('ovulation')}
                                                onCheckedChange={(c) => handleCheckboxChange('bloco_6_cycle_pain_phase', 'ovulation', !!c)} />
                                            <Label htmlFor="ph-ovu" className="text-sm">Na Ovulação (meio do ciclo)</Label>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2 pt-4">
                            <Label className="text-sm font-semibold text-pink-900">6.5c você usa hormonal?</Label>
                            <RadioGroup
                                value={data.bloco_6_hormonal_use || 'none'}
                                onValueChange={(v) => updateData({ bloco_6_hormonal_use: v })}
                                className="space-y-2"
                            >
                                <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="hu-none" /><Label htmlFor="hu-none">NÃO, sem hormonal</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="oral" id="hu-oral" /><Label htmlFor="hu-oral">SIM, anticoncepcional (pílula, anel, adesivo)</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="iud" id="hu-iud" /><Label htmlFor="hu-iud">SIM, DIU hormonal</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="other" id="hu-other" /><Label htmlFor="hu-other">SIM, outra forma hormonal</Label></div>
                            </RadioGroup>

                            {data.bloco_6_hormonal_use && data.bloco_6_hormonal_use !== 'none' && (
                                <div className="ml-6 mt-2 space-y-2 border-l-2 border-pink-200 pl-4 py-2">
                                    <Label className="text-sm text-pink-800">A dor melhorou após iniciar o uso?</Label>
                                    <RadioGroup
                                        value={data.bloco_6_hormonal_improved === undefined ? '' : (data.bloco_6_hormonal_improved ? 'yes' : 'no')}
                                        onValueChange={(v) => updateData({ bloco_6_hormonal_improved: v === 'yes' })}
                                        className="flex gap-4"
                                    >
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="hi-no" /><Label htmlFor="hi-no">Não / Piorou</Label></div>
                                        <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="hi-yes" /><Label htmlFor="hi-yes">Sim, Melhorou</Label></div>
                                    </RadioGroup>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* Medicações */}
            <section className="space-y-6 border-t pt-6">
                <div className="space-y-4">
                    <Label className="font-semibold text-base">Medicações </Label>
                    <p className="text-sm text-gray-500">Você toma alguma medicação regularmente?</p>

                    <div className="space-y-4 bg-muted/20 p-5 rounded-xl border border-muted mt-2">
                        <div className="flex items-center space-x-2 justify-between">
                            <Label htmlFor="med-nsaid" className="font-medium">6.6A Anti-inflamatório diário? (Ibuprofeno/AINE)</Label>
                            <Checkbox id="med-nsaid" checked={!!data.bloco_6_daily_nsaid} onCheckedChange={(c) => updateData({ bloco_6_daily_nsaid: !!c })} />
                        </div>
                        <div className="flex items-center space-x-2 justify-between border-t border-muted pt-3">
                            <div className="flex flex-col flex-1">
                                <Label htmlFor="med-anti" className="font-medium">6.6B Antidepressivo ou ansiolítico?</Label>
                                {data.bloco_6_antidepressant && (
                                    <RadioGroup
                                        className="flex gap-4 mt-2"
                                        value={data.bloco_6_antidepressant_type || 'ssri'}
                                        onValueChange={(v) => updateData({ bloco_6_antidepressant_type: v })}
                                    >
                                        <div className="flex items-center space-x-1"><RadioGroupItem value="ssri" id="mt-ssri" /><Label htmlFor="mt-ssri" className="text-xs">Ssri/snri</Label></div>
                                        <div className="flex items-center space-x-1"><RadioGroupItem value="tricyclic" id="mt-tri" /><Label htmlFor="mt-tri" className="text-xs">Tricíclico</Label></div>
                                        <div className="flex items-center space-x-1"><RadioGroupItem value="other" id="mt-oth" /><Label htmlFor="mt-oth" className="text-xs">Outro</Label></div>
                                    </RadioGroup>
                                )}
                            </div>
                            <Checkbox id="med-anti" checked={!!data.bloco_6_antidepressant} onCheckedChange={(c) => updateData({ bloco_6_antidepressant: !!c })} />
                        </div>
                        <div className="flex items-center space-x-2 justify-between border-t border-muted pt-3">
                            <Label htmlFor="med-relax" className="font-medium">6.6C Relaxante muscular?</Label>
                            <Checkbox id="med-relax" checked={!!data.bloco_6_muscle_relaxant} onCheckedChange={(c) => updateData({ bloco_6_muscle_relaxant: !!c })} />
                        </div>
                        <div className="flex items-center space-x-2 justify-between border-t border-muted pt-3">
                            <Label htmlFor="med-sup" className="font-medium">6.6D Suplemento de vitaminas/minerais?</Label>
                            <Checkbox id="med-sup" checked={!!data.bloco_6_supplementation} onCheckedChange={(c) => updateData({ bloco_6_supplementation: !!c })} />
                        </div>
                        <div className="flex items-center space-x-2 justify-between border-t border-muted pt-3 pb-1">
                            <Label htmlFor="med-cort" className="font-medium text-red-700">6.6E Corticoide sistêmico? (Injeções, Prednisona)</Label>
                            <Checkbox id="med-cort" checked={!!data.bloco_6_corticoid} onCheckedChange={(c) => updateData({ bloco_6_corticoid: !!c })} className="border-red-300 data-[state=checked]:bg-red-600" />
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}
