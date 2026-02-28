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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">BLOCO 1: O QUE MUDOU NOS ÚLTIMOS 30 DIAS?</h2>
                <p className="text-gray-500">
                    Seu corpo detecta MUDANÇAS como "ameaças potenciais".<br />
                    Seu corpo ADORA rotina. Quando algo muda, ele entra em alerta. Este bloco detecta o que disparou o problema.
                </p>
            </div>

            <div className="space-y-8">
                <div className="space-y-3">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 1.1: QUAL É SUA QUEIXA PRINCIPAL?</Label>
                    <p className="text-sm text-gray-500 mb-2">Descreva brevemente o que te trouxe aqui:</p>
                    <Input
                        placeholder="Ex: Dor nas costas ao acordar, dor no joelho ao correr, dor de cabeça constante..."
                        value={data.bloco_1_queixa || ''}
                        onChange={(e) => updateData({ bloco_1_queixa: e.target.value })}
                        maxLength={200}
                    />
                </div>

                <div className="space-y-4">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 1.2: NAS ÚLTIMAS 4 SEMANAS, HOUVE ALGUMA DESTAS MUDANÇAS?</Label>
                    <p className="text-sm text-gray-500 mb-2">Marque TODAS que se aplicam:</p>
                    <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-muted">
                        <div className="flex items-start space-x-3">
                            <Checkbox id="change-equip" checked={(data.bloco_1_changes || []).includes('equipment')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'equipment', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-equip" className="font-bold cursor-pointer text-sm">NOVO EQUIPAMENTO</Label>
                                <p className="text-xs text-gray-500">Tênis novo, colchão novo, travesseiro novo, cadeira de trabalho nova, mochila nova, cinto, ou qualquer coisa que sua estrutura usa diariamente</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox id="change-load" checked={(data.bloco_1_changes || []).includes('load')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'load', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-load" className="font-bold cursor-pointer text-sm">AUMENTO DE CARGA FÍSICA</Label>
                                <p className="text-xs text-gray-500">Começou novo treino, aumentou volume de exercício, novo trabalho mais pesado, competição próxima, aumento de horas na academia, ou atividade inusitada</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox id="change-posture" checked={(data.bloco_1_changes || []).includes('posture')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'posture', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-posture" className="font-bold cursor-pointer text-sm">MUDANÇA DE POSTURA / CONTEXTO</Label>
                                <p className="text-xs text-gray-500">Mais tempo sentado, home office novo, viagem longa, mudança de casa, novo local de trabalho, posição diferente ao dormir</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox id="change-scare" checked={(data.bloco_1_changes || []).includes('scare')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'scare', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-scare" className="font-bold cursor-pointer text-sm">SUSTO FÍSICO / QUASE-LESÃO</Label>
                                <p className="text-xs text-gray-500">Quase escorregou, movimento "em falso", sensação de "travada" súbita, queda leve, torcida que não evoluiu para lesão completa</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 pt-2">
                            <Checkbox id="change-none" checked={(data.bloco_1_changes || []).includes('none')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'none', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-none" className="font-bold cursor-pointer text-sm text-gray-500">NENHUMA MUDANÇA QUE EU NOTE</Label>
                                <p className="text-xs text-gray-400">Tudo estava normal e a dor apareceu "do nada"</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 1.3: QUANDO EXATAMENTE COMEÇOU?</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Tempo aproximado ou Data:</Label>
                            <Input
                                placeholder="Ex: Há 3 dias, 1 mês, 5 anos..."
                                value={data.bloco_1_quando_data || ''}
                                onChange={(e) => updateData({ bloco_1_quando_data: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">O que estava fazendo quando notou:</Label>
                            <Input
                                placeholder="Ex: Acordei com dor, não sei por quê"
                                value={data.bloco_1_quando_desc || ''}
                                onChange={(e) => updateData({ bloco_1_quando_desc: e.target.value })}
                            />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 1.4: VOCÊ JÁ TEVE LESÃO PARECIDA ANTES?</Label>
                    <p className="text-sm text-gray-500 mb-2">Na mesma região ou lado oposto?</p>
                    <RadioGroup
                        className="space-y-2"
                        value={data.bloco_1_similar_injury === undefined ? '' : (data.bloco_1_similar_injury ? 'yes' : 'no')}
                        onValueChange={(v) => updateData({ bloco_1_similar_injury: v === 'yes' })}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="sim-inj-no" />
                            <Label htmlFor="sim-inj-no" className="font-medium cursor-pointer">NÃO, nunca tive problema assim</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="sim-inj-yes" />
                            <Label htmlFor="sim-inj-yes" className="font-medium cursor-pointer text-primary">SIM, já tive lesão/dor parecida</Label>
                        </div>
                    </RadioGroup>

                    {data.bloco_1_similar_injury && (
                        <div className="ml-6 space-y-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Quando foi a outra vez?</Label>
                                <Input
                                    placeholder="Ex: Há 6 meses, há 2 anos..."
                                    value={data.bloco_1_similar_quando || ''}
                                    onChange={(e) => updateData({ bloco_1_similar_quando: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2 pt-2">
                                <Label className="text-sm font-semibold text-primary">Cicatrizou 100% ou ficou com sequela?</Label>
                                <RadioGroup
                                    className="space-y-2 mt-2"
                                    value={data.bloco_1_healing_speed || ''}
                                    onValueChange={(v) => updateData({ bloco_1_healing_speed: v })}
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="fast" id="heal-fast" />
                                        <Label htmlFor="heal-fast" className="cursor-pointer text-sm">Cicatrizou completamente (fiquei 100% sem dor)</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="moderate" id="heal-mod" />
                                        <Label htmlFor="heal-mod" className="cursor-pointer text-sm">Ficou com dor ocasional "escondidinha" / incômodo de vez em quando</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="slow" id="heal-slow" />
                                        <Label htmlFor="heal-slow" className="cursor-pointer text-sm">Ficou com dor constante e sensível / Nunca melhorou 100%</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="with_sequela" id="heal-seq" />
                                        <Label htmlFor="heal-seq" className="cursor-pointer text-sm font-bold text-red-600">Ficou com limitação importante (perdi força ou amplitude)</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                        </div>
                    )}
                </div>

                <div className="space-y-4 border-t border-muted pt-6">
                    <Label className="text-base font-bold text-gray-800">PERGUNTA 1.5: VOCÊ JÁ FEZ REABILITAÇÃO/FISIOTERAPIA ANTES?</Label>
                    <p className="text-sm text-gray-500 mb-2">Para este problema ou problemas antigos?</p>
                    <RadioGroup
                        className="space-y-2"
                        value={data.bloco_1_did_physio === undefined ? '' : (data.bloco_1_did_physio ? 'yes' : 'no')}
                        onValueChange={(v) => updateData({ bloco_1_did_physio: v === 'yes' })}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="physio-no" />
                            <Label htmlFor="physio-no" className="font-medium cursor-pointer">NÃO, nunca fiz fisioterapia a sério</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="physio-yes" />
                            <Label htmlFor="physio-yes" className="font-medium cursor-pointer text-primary">SIM, já fiz fisioterapia</Label>
                        </div>
                    </RadioGroup>

                    {data.bloco_1_did_physio && (
                        <div className="ml-6 space-y-3 p-4 bg-primary/5 rounded-xl border border-primary/10 mt-2">
                            <Label className="text-sm font-semibold">Como foi o resultado nas sessões anteriores?</Label>
                            <RadioGroup
                                className="space-y-2"
                                value={data.bloco_1_physio_result || ''}
                                onValueChange={(v) => updateData({ bloco_1_physio_result: v })}
                            >
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="excellent" id="physres-exc" />
                                    <Label htmlFor="physres-exc" className="cursor-pointer text-sm">Excelente (Resolviam meu problema rápido, 80-100% melhora)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="good" id="physres-good" />
                                    <Label htmlFor="physres-good" className="cursor-pointer text-sm">Bom (Melhorava, mas o problema voltava depois de um tempo)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="moderate" id="physres-mod" />
                                    <Label htmlFor="physres-mod" className="cursor-pointer text-sm">Moderado/Estacionado (Ficava em "manutenção" mas nunca zerava a dor)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="bad" id="physres-bad" />
                                    <Label htmlFor="physres-bad" className="cursor-pointer text-sm">Ruim (Fiz várias sessões, usar "choquinho", calor, e não vi resultado real)</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
