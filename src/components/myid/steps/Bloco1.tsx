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
        // "Nenhuma mudança" exclui as demais (e vice-versa).
        if (checked && value === 'none') {
            updateData({ [field]: ['none'] });
        } else if (checked) {
            updateData({ [field]: [...current.filter((item: string) => item !== 'none'), value] });
        } else {
            updateData({ [field]: current.filter((item: string) => item !== value) });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-2">O que mudou nos últimos 30 dias?</h2>
                <p className="text-muted-foreground">
                    Seu corpo detecta MUDANÇAS como "ameaças potenciais".<br />
                    Seu corpo ADORA rotina. Quando algo muda, ele entra em alerta. Este bloco detecta o que disparou o problema.
                </p>
            </div>

            <div className="space-y-8">
                <div className="space-y-3">
                    <Label className="text-base font-bold text-foreground">Qual é sua queixa principal?</Label>
                    <p className="text-sm text-muted-foreground mb-2">Descreva brevemente o que te trouxe aqui:</p>
                    <Input
                        placeholder="Ex: Dor nas costas ao acordar, dor no joelho ao correr, dor de cabeça constante..."
                        value={data.bloco_1_queixa || ''}
                        onChange={(e) => updateData({ bloco_1_queixa: e.target.value })}
                        maxLength={200}
                    />
                </div>

                <div className="space-y-4">
                    <Label className="text-base font-bold text-foreground">Nas últimas 4 semanas, houve alguma destas mudanças?</Label>
                    <p className="text-sm text-muted-foreground mb-2">Marque TODAS que se aplicam:</p>
                    <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-muted">
                        <div className="flex items-start space-x-3">
                            <Checkbox id="change-equip" checked={(data.bloco_1_changes || []).includes('equipment')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'equipment', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-equip" className="font-bold cursor-pointer text-sm">Novo equipamento</Label>
                                <p className="text-xs text-muted-foreground">Tênis novo, colchão novo, travesseiro novo, cadeira de trabalho nova, mochila nova, cinto, ou qualquer coisa que sua estrutura usa diariamente</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox id="change-load" checked={(data.bloco_1_changes || []).includes('load')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'load', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-load" className="font-bold cursor-pointer text-sm">Aumento de carga física</Label>
                                <p className="text-xs text-muted-foreground">Começou novo treino, aumentou volume de exercício, novo trabalho mais pesado, competição próxima, aumento de horas na academia, ou atividade inusitada</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox id="change-posture" checked={(data.bloco_1_changes || []).includes('posture')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'posture', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-posture" className="font-bold cursor-pointer text-sm">Mudança de postura / contexto</Label>
                                <p className="text-xs text-muted-foreground">Mais tempo sentado, home office novo, viagem longa, mudança de casa, novo local de trabalho, posição diferente ao dormir</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3">
                            <Checkbox id="change-scare" checked={(data.bloco_1_changes || []).includes('scare')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'scare', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-scare" className="font-bold cursor-pointer text-sm">Susto físico / quase-lesão</Label>
                                <p className="text-xs text-muted-foreground">Quase escorregou, movimento "em falso", sensação de "travada" súbita, queda leve, torcida que não evoluiu para lesão completa</p>
                            </div>
                        </div>

                        <div className="flex items-start space-x-3 pt-2">
                            <Checkbox id="change-none" checked={(data.bloco_1_changes || []).includes('none')} onCheckedChange={(c) => handleCheckboxChange('bloco_1_changes', 'none', !!c)} />
                            <div className="space-y-1 mt-0.5">
                                <Label htmlFor="change-none" className="font-bold cursor-pointer text-sm text-muted-foreground">Nenhuma mudança que eu note</Label>
                                <p className="text-xs text-muted-foreground">Tudo estava normal e a dor apareceu "do nada"</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <Label className="text-base font-bold text-foreground">Quando exatamente começou?</Label>
                    {/* Opção fixa: é ela que entra no cálculo (dor crônica pesa mais). */}
                    <RadioGroup
                        value={data.bloco_1_duracao || ''}
                        onValueChange={(v) => updateData({ bloco_1_duracao: v })}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                        {[
                            { v: 'lt6w', l: 'Menos de 6 semanas' },
                            { v: '6_12w', l: 'Entre 6 e 12 semanas' },
                            { v: '3_12m', l: 'Entre 3 meses e 1 ano' },
                            { v: 'gt1y', l: 'Mais de 1 ano' },
                        ].map((o) => (
                            <label key={o.v} htmlFor={`dur-${o.v}`} className="flex items-center gap-3 rounded-lg border border-muted p-3 cursor-pointer has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                <RadioGroupItem value={o.v} id={`dur-${o.v}`} />
                                <span className="text-sm font-semibold">{o.l}</span>
                            </label>
                        ))}
                    </RadioGroup>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-sm font-semibold">Se quiser, detalhe (data ou tempo exato):</Label>
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
            </div>
        </div>
    );
}
