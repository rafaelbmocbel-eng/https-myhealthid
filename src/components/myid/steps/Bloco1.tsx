import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Bloco1Props {
    data: any;
    updateData: (data: any) => void;
}

export function Bloco1({ data, updateData }: Bloco1Props) {
    const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
        const current = data[field] || [];
        if (checked) {
            updateData({ [field]: [...current, value] });
        } else {
            updateData({ [field]: current.filter((item: string) => item !== value) });
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Bloco 1: Identificação e Gatilhos</h2>
                <p className="text-gray-500">O que mudou nos últimos 30 dias?</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-base font-semibold">1.1 Qual é a sua queixa principal?</Label>
                    <Input
                        placeholder="Ex: Dor nas costas ao acordar..."
                        value={data.bloco_1_queixa || ''}
                        onChange={(e) => updateData({ bloco_1_queixa: e.target.value })}
                        maxLength={200}
                    />
                </div>

                <div className="space-y-3">
                    <Label className="text-base font-semibold">1.2 Nas últimas 4 semanas, houve alguma mudança?</Label>
                    <p className="text-sm text-gray-500">Marque TODAS que se aplicam:</p>
                    <div className="space-y-2">
                        <div className="flex items-start space-x-3">
                            <Checkbox
                                id="change-equip"
                                checked={(data.bloco_1_changes || []).includes('equipment')}
                                onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'equipment', !!c)}
                            />
                            <div className="space-y-1 leading-none">
                                <Label htmlFor="change-equip" className="font-medium cursor-pointer">Novo Equipamento</Label>
                                <p className="text-sm text-gray-500">Tênis, colchão, cadeira nova, etc.</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox
                                id="change-load"
                                checked={(data.bloco_1_changes || []).includes('load')}
                                onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'load', !!c)}
                            />
                            <div className="space-y-1 leading-none">
                                <Label htmlFor="change-load" className="font-medium cursor-pointer">Aumento de Carga</Label>
                                <p className="text-sm text-gray-500">Novo treino, mais volume, trabalho mais pesado</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox
                                id="change-posture"
                                checked={(data.bloco_1_changes || []).includes('posture')}
                                onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'posture', !!c)}
                            />
                            <div className="space-y-1 leading-none">
                                <Label htmlFor="change-posture" className="font-medium cursor-pointer">Mudança de Postura/Contexto</Label>
                                <p className="text-sm text-gray-500">Home office, viagem, mudança de local</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox
                                id="change-scare"
                                checked={(data.bloco_1_changes || []).includes('scare')}
                                onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'scare', !!c)}
                            />
                            <div className="space-y-1 leading-none">
                                <Label htmlFor="change-scare" className="font-medium cursor-pointer">Susto Físico / Quase Lesão</Label>
                                <p className="text-sm text-gray-500">Movimento em falso, quase escorregou</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-base font-semibold">1.4 Você já teve lesão/dor parecida antes?</Label>
                    <RadioGroup
                        value={data.bloco_1_similar_injury === undefined ? '' : (data.bloco_1_similar_injury ? 'yes' : 'no')}
                        onValueChange={(v) => updateData({ bloco_1_similar_injury: v === 'yes' })}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="sim-inj-no" />
                            <Label htmlFor="sim-inj-no">Não, primeira vez</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="sim-inj-yes" />
                            <Label htmlFor="sim-inj-yes">Sim, já tive dor parecida</Label>
                        </div>
                    </RadioGroup>

                    {data.bloco_1_similar_injury && (
                        <div className="ml-6 mt-3 space-y-3 p-4 bg-muted/30 rounded-md">
                            <Label className="text-sm font-semibold">Como foi a cicatrização na época?</Label>
                            <RadioGroup
                                value={data.bloco_1_healing_speed || ''}
                                onValueChange={(v) => updateData({ bloco_1_healing_speed: v })}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="fast" id="heal-fast" />
                                    <Label htmlFor="heal-fast">Rápida (menos de 4 semanas)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="moderate" id="heal-mod" />
                                    <Label htmlFor="heal-mod">Moderada (4-12 semanas)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="slow" id="heal-slow" />
                                    <Label htmlFor="heal-slow">Lenta (mais de 12 semanas)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="with_sequela" id="heal-seq" />
                                    <Label htmlFor="heal-seq">Ficou com sequela/dor frequente</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}
                </div>

                <div className="space-y-3 border-t pt-4">
                    <Label className="text-base font-semibold">1.5 Fez fisioterapia para esse problema antes?</Label>
                    <RadioGroup
                        value={data.bloco_1_did_physio === undefined ? '' : (data.bloco_1_did_physio ? 'yes' : 'no')}
                        onValueChange={(v) => updateData({ bloco_1_did_physio: v === 'yes' })}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="physio-no" />
                            <Label htmlFor="physio-no">Não</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="physio-yes" />
                            <Label htmlFor="physio-yes">Sim</Label>
                        </div>
                    </RadioGroup>

                    {data.bloco_1_did_physio && (
                        <div className="ml-6 mt-3 space-y-3 p-4 bg-muted/30 rounded-md">
                            <Label className="text-sm font-semibold">Qual foi o resultado?</Label>
                            <RadioGroup
                                value={data.bloco_1_physio_result || ''}
                                onValueChange={(v) => updateData({ bloco_1_physio_result: v })}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="excellent" id="physres-exc" />
                                    <Label htmlFor="physres-exc">Excelente (80-100% melhora)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="good" id="physres-good" />
                                    <Label htmlFor="physres-good">Bom (50-80% melhora)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="moderate" id="physres-mod" />
                                    <Label htmlFor="physres-mod">Moderado (20-50% melhora)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="bad" id="physres-bad" />
                                    <Label htmlFor="physres-bad">Ruim (&lt; 20% melhora)</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
