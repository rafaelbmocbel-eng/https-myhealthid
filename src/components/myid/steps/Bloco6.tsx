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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Bloco 6: Ruído Sistêmico</h2>
                <p className="text-gray-500">Traumas, Cirurgias, Hormônios e medicações que impactam a dor</p>
            </div>

            {/* Traumas e Cirurgias */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">6A. Traumas & Cirurgias</h3>

                <div className="space-y-4">
                    <Label className="font-semibold">6.1 Você JÁ SOFREU alguma QUEDA FORTE SENTADO (impacto no cóccix/bumbum)?</Label>
                    <RadioGroup
                        value={data.bloco_6_axial_trauma === undefined ? '' : (data.bloco_6_axial_trauma ? 'yes' : 'no')}
                        onValueChange={(v) => updateData({ bloco_6_axial_trauma: v === 'yes' })}
                        className="flex gap-4"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="ax-no" /><Label htmlFor="ax-no">Não</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="ax-yes" /><Label htmlFor="ax-yes">Sim</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold">6.2 Você POSSUI CICATRIZ de CIRURGIA ABDOMINAL?</Label>
                    <div className="space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                            { id: 'cesarea', label: 'Cesárea (parto cirúrgico)' },
                            { id: 'abdominoplastia', label: 'Abdominoplastia' },
                            { id: 'apendicectomia', label: 'Apêndice' },
                            { id: 'colecistectomia', label: 'Vesícula' },
                            { id: 'histerectomia', label: 'Histerectomia' },
                            { id: 'hernia', label: 'Hérnia' }
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
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">6B. Saúde Visceral</h3>
                <p className="text-sm text-gray-600">Sente algum destes frequentemente?</p>

                <div className="space-y-2">
                    {[
                        { id: 'bloating', label: 'Estufamento / Inchaço abdominal constante' },
                        { id: 'reflux', label: 'Refluxo / Azia / Queimação no peito' },
                        { id: 'gastritis', label: 'Gastrite / Dor de estômago' },
                        { id: 'tired_after_eat', label: 'Cansaço excessivo logo após comer' },
                        { id: 'constipation', label: 'Intestino preso / Constipação' },
                        { id: 'diarrhea', label: 'Diarreia frequente / Intestino solto' }
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
            </section>

            {/* Hormônios Mulheres (Opcional) */}
            <section className="space-y-6 bg-pink-50/30 p-4 rounded-lg border border-pink-100">
                <h3 className="text-lg font-semibold border-b pb-2 text-pink-700">6C. Ciclo e Hormônios (Se aplicável)</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <Label className="font-semibold">Diagnósticos</Label>
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
                                <Label htmlFor="diag-pcos">SOP (Ovário Policístico)</Label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="font-semibold">A dor piora no ciclo?</Label>
                        <RadioGroup
                            value={data.bloco_6_cycle_affects_pain === undefined ? '' : (data.bloco_6_cycle_affects_pain ? 'yes' : 'no')}
                            onValueChange={(v) => updateData({ bloco_6_cycle_affects_pain: v === 'yes' })}
                            className="space-y-2"
                        >
                            <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="cyc-no" /><Label htmlFor="cyc-no">Não muda com ciclo</Label></div>
                            <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="cyc-yes" /><Label htmlFor="cyc-yes">Sim, há piora</Label></div>
                        </RadioGroup>
                    </div>
                </div>

                {data.bloco_6_cycle_affects_pain && (
                    <div className="space-y-4 pt-4">
                        <Label className="font-semibold">Em qual fase a dor é pior?</Label>
                        <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="ph-lut"
                                    checked={(data.bloco_6_cycle_pain_phase || []).includes('luteal')}
                                    onCheckedChange={(c) => handleCheckboxChange('bloco_6_cycle_pain_phase', 'luteal', !!c)}
                                />
                                <Label htmlFor="ph-lut">Antes da menstruação (TPM / Lútea)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="ph-men"
                                    checked={(data.bloco_6_cycle_pain_phase || []).includes('menstruation')}
                                    onCheckedChange={(c) => handleCheckboxChange('bloco_6_cycle_pain_phase', 'menstruation', !!c)}
                                />
                                <Label htmlFor="ph-men">Durante a Menstruação</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="ph-ovu"
                                    checked={(data.bloco_6_cycle_pain_phase || []).includes('ovulation')}
                                    onCheckedChange={(c) => handleCheckboxChange('bloco_6_cycle_pain_phase', 'ovulation', !!c)}
                                />
                                <Label htmlFor="ph-ovu">Na Ovulação (meio do ciclo)</Label>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Medicações */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">6D. Medicações</h3>
                <p className="text-sm text-gray-600">Toma algum medicamento de uso contínuo/frequente?</p>

                <div className="space-y-4 bg-muted/20 p-4 rounded-lg border border-muted">
                    <div className="flex items-center space-x-2 justify-between">
                        <Label htmlFor="med-nsaid" className="font-medium">Anti-inflamatório DIÁRIO (Ibuprofeno, etc)</Label>
                        <Checkbox id="med-nsaid" checked={!!data.bloco_6_daily_nsaid} onCheckedChange={(c) => updateData({ bloco_6_daily_nsaid: !!c })} />
                    </div>
                    <div className="flex items-center space-x-2 justify-between">
                        <Label htmlFor="med-anti" className="font-medium">Antidepressivo / Ansiolítico</Label>
                        <Checkbox id="med-anti" checked={!!data.bloco_6_antidepressant} onCheckedChange={(c) => updateData({ bloco_6_antidepressant: !!c })} />
                    </div>
                    <div className="flex items-center space-x-2 justify-between">
                        <Label htmlFor="med-relax" className="font-medium">Relaxante Muscular regular</Label>
                        <Checkbox id="med-relax" checked={!!data.bloco_6_muscle_relaxant} onCheckedChange={(c) => updateData({ bloco_6_muscle_relaxant: !!c })} />
                    </div>
                    <div className="flex items-center space-x-2 justify-between">
                        <Label htmlFor="med-sup" className="font-medium">Suplementação Vitamínica</Label>
                        <Checkbox id="med-sup" checked={!!data.bloco_6_supplementation} onCheckedChange={(c) => updateData({ bloco_6_supplementation: !!c })} />
                    </div>
                    <div className="flex items-center space-x-2 justify-between bg-red-50 p-2 rounded border border-red-100">
                        <Label htmlFor="med-cort" className="font-medium text-red-700">Corticoide sistêmico (Injeção/Comprimido)</Label>
                        <Checkbox id="med-cort" checked={!!data.bloco_6_corticoid} onCheckedChange={(c) => updateData({ bloco_6_corticoid: !!c })} />
                    </div>
                </div>
            </section>
        </div>
    );
}
