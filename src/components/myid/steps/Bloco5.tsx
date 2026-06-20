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
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Seu estilo de vida</h2>
                <p className="text-gray-500">Sono, Nutrição, Hidratação e Ergonomia (Pilares de Recuperação)</p>
            </div>

            {/* 5A: Sono */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5A. Sono (Quality Factor)</h3>

                <div className="space-y-4">
                    <Label className="font-semibold">5A.1 Quantas horas você dorme por noite? (Ideal 7-9h)</Label>
                    <Input
                        type="number"
                        inputMode="decimal"
                        min="0" max="24"
                        placeholder="Ex: 7"
                        value={data.bloco_5a_hours ?? ''}
                        onChange={(e) => updateData({ bloco_5a_hours: e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0) })}
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

                <div className="space-y-4 pt-4">
                    <Label className="font-semibold">5A.4 Você tem algum distúrbio de sono diagnosticado ou suspeito?</Label>
                    <p className="text-sm text-gray-500">Marque se você sofre frequentemente de algum destes problemas:</p>
                    <div className="space-y-2">
                        {[
                            { id: 'insomnia', label: 'Insônia (dificuldade de pegar no sono ou se manter dormindo)' },
                            { id: 'apnea', label: 'Apneia do Sono (ronco forte, falta de ar dormindo)' },
                            { id: 'bruxism', label: 'Bruxismo (aperta ou range os dentes)' },
                            { id: 'restless_legs', label: 'Síndrome das Pernas Inquietas' },
                        ].map(dis => (
                            <div key={dis.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`sd-${dis.id}`}
                                    checked={(data.bloco_5a_disorders || []).includes(dis.id)}
                                    onCheckedChange={(c) => handleCheckboxChange('bloco_5a_disorders', dis.id, !!c)}
                                />
                                <Label htmlFor={`sd-${dis.id}`}>{dis.label}</Label>
                            </div>
                        ))}
                    </div>
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

            {/* 5C: Fatores Psicológicos */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5C. Fatores Psicológicos (Regulação Mental)</h3>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Qual seu nível de estresse?</Label>
                    <p className="text-sm text-gray-500">No seu dia a dia (trabalho, família, vida geral), quão estressado você se sente?</p>
                    <div className="px-2 pt-2">
                        <Input
                            type="range"
                            min="0" max="10" step="1"
                            value={data.bloco_5c_stress || 0}
                            onChange={(e) => updateData({ bloco_5c_stress: parseInt(e.target.value) })}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                            <span>0 (Totalmente Calmo)</span>
                            <span>10 (Estresse Máximo)</span>
                        </div>
                        <div className="text-center font-black text-2xl text-primary mt-2">{data.bloco_5c_stress || 0} <span className="text-lg text-gray-400 font-bold">/ 10</span></div>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted border-dashed">
                    <Label className="font-semibold text-base">Qual é o seu nível de ansiedade?</Label>
                    <p className="text-sm text-gray-500">O quanto a ansiedade (preocupações com o futuro, agitação constante) afeta você?</p>
                    <div className="px-2 pt-2">
                        <Input
                            type="range"
                            min="0" max="10" step="1"
                            value={data.bloco_5c_anxiety || 0}
                            onChange={(e) => updateData({ bloco_5c_anxiety: parseInt(e.target.value) })}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                            <span>0 (Nenhuma)</span>
                            <span>10 (Ansiedade Extrema)</span>
                        </div>
                        <div className="text-center font-black text-2xl text-primary mt-2">{data.bloco_5c_anxiety || 0} <span className="text-lg text-gray-400 font-bold">/ 10</span></div>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted border-dashed">
                    <Label className="font-semibold text-base">Sensação de controle</Label>
                    <p className="text-sm text-gray-500">Você sente que tem controle sobre o estresse e as pressões da sua vida diária?</p>
                    <RadioGroup
                        value={data.bloco_5c_control || ''}
                        onValueChange={(v) => updateData({ bloco_5c_control: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="very" id="ctrl-very" /><Label htmlFor="ctrl-very">Muito controle (Lido muito bem com a pressão)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="moderate" id="ctrl-mod" /><Label htmlFor="ctrl-mod">Controle Moderado (Lido razoavelmente bem)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="little" id="ctrl-lit" /><Label htmlFor="ctrl-lit">Pouco controle (Me sinto frequentemente sobrecarregado)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="ctrl-none" /><Label htmlFor="ctrl-none">Nenhum controle (Sensação de que vou explodir)</Label></div>
                    </RadioGroup>
                </div>
            </section>

            {/* 5D: Contexto Social */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">5D. Contexto Social</h3>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Estresse no trabalho</Label>
                    <p className="text-sm text-gray-500">O quanto seu ambiente de trabalho é estressante?</p>
                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="work-stress-na"
                            checked={data.bloco_5d_work_stress === 'na'}
                            onCheckedChange={(c) => updateData({ bloco_5d_work_stress: c ? 'na' : 0 })}
                        />
                        <Label htmlFor="work-stress-na" className="font-normal text-sm">Não trabalho atualmente</Label>
                    </div>
                    {data.bloco_5d_work_stress !== 'na' && (
                        <div className="px-2 pt-2">
                            <Input
                                type="range"
                                min="0" max="10" step="1"
                                value={data.bloco_5d_work_stress || 0}
                                onChange={(e) => updateData({ bloco_5d_work_stress: parseInt(e.target.value) })}
                                className="w-full"
                            />
                            <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                                <span>0 (Nenhum estresse)</span>
                                <span>10 (Estresse extremo)</span>
                            </div>
                            <div className="text-center font-black text-2xl text-primary mt-2">{data.bloco_5d_work_stress || 0} <span className="text-lg text-gray-400 font-bold">/ 10</span></div>
                        </div>
                    )}
                </div>

                <div className="space-y-4 pt-4 border-t border-muted border-dashed">
                    <Label className="font-semibold text-base">Conflitos familiares / pessoais</Label>
                    <p className="text-sm text-gray-500">Tem tido conflitos familiares ou pessoais recentes?</p>
                    <div className="px-2 pt-2">
                        <Input
                            type="range"
                            min="0" max="10" step="1"
                            value={data.bloco_5d_family_conflict || 0}
                            onChange={(e) => updateData({ bloco_5d_family_conflict: parseInt(e.target.value) })}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                            <span>0 (Nenhum conflito)</span>
                            <span>10 (Conflitos intensos)</span>
                        </div>
                        <div className="text-center font-black text-2xl text-primary mt-2">{data.bloco_5d_family_conflict || 0} <span className="text-lg text-gray-400 font-bold">/ 10</span></div>
                    </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-muted border-dashed">
                    <Label className="font-semibold text-base">Preocupação financeira</Label>
                    <p className="text-sm text-gray-500">Sua situação financeira te gera preocupação?</p>
                    <div className="px-2 pt-2">
                        <Input
                            type="range"
                            min="0" max="10" step="1"
                            value={data.bloco_5d_financial_worry || 0}
                            onChange={(e) => updateData({ bloco_5d_financial_worry: parseInt(e.target.value) })}
                            className="w-full"
                        />
                        <div className="flex justify-between text-xs font-bold text-gray-400 mt-2 uppercase tracking-wider">
                            <span>0 (Nenhuma preocupação)</span>
                            <span>10 (Preocupação extrema)</span>
                        </div>
                        <div className="text-center font-black text-2xl text-primary mt-2">{data.bloco_5d_financial_worry || 0} <span className="text-lg text-gray-400 font-bold">/ 10</span></div>
                    </div>
                </div>
            </section>

            {/* 5E: Atividade Física */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">Atividade física e tensão diária</h3>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Tempo sentado contínuo</Label>
                    <p className="text-sm text-gray-500">Quantas horas por dia fica sentado direto?</p>
                    <Input
                        type="number"
                        inputMode="decimal"
                        min="0" max="24"
                        placeholder="Ex: 8"
                        value={data.bloco_5e_sitting_hours ?? ''}
                        onChange={(e) => updateData({ bloco_5e_sitting_hours: e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0) })}
                        className="w-32"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Estilo de vida geral</Label>
                    <p className="text-sm text-gray-500">Qual o seu nível de estilo de vida atual?</p>
                    <RadioGroup
                        value={data.bloco_5e_lifestyle || ''}
                        onValueChange={(v) => updateData({ bloco_5e_lifestyle: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="very_sedentary" id="ls-vs" /><Label htmlFor="ls-vs">Muito sedentário (apenas cama/sofá)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="sedentary" id="ls-s" /><Label htmlFor="ls-s">Sedentário (apenas passos do dia a dia, em casa ou fora)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="moderate" id="ls-m" /><Label htmlFor="ls-m">Moderado (alguma caminhada, tarefas ativas)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="active" id="ls-a" /><Label htmlFor="ls-a">Ativo (exercícios regulares 3+ vezes/semana)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="very_active" id="ls-va" /><Label htmlFor="ls-va">Muito ativo (treinos intensos quase diariamente)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Tipo de exercício que faz</Label>
                    <p className="text-sm text-gray-500">Que tipo de exercício você pratica REGULARMENTE? (Marque TODOS que se aplicam)</p>
                    <div className="space-y-2">
                        {[
                            { id: 'none', label: 'NENHUM / SEM EXERCÍCIO' },
                            { id: 'cardio', label: 'CARDIO (Corrida, bicicleta, natação, dança)' },
                            { id: 'strength', label: 'FORÇA / MUSCULAÇÃO' },
                            { id: 'yoga', label: 'YOGA / PILATES / ALONGAMENTO' },
                            { id: 'sports', label: 'ESPORTE (Futebol, vôlei, tênis, etc.)' },
                            { id: 'daily', label: 'ATIVIDADE DIÁRIA (Caminhada, subir escadas, tarefas)' }
                        ].map(ex => (
                            <div key={ex.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`ex-${ex.id}`}
                                    checked={(data.bloco_5e_exercise_types || []).includes(ex.id)}
                                    onCheckedChange={(c) => handleCheckboxChange('bloco_5e_exercise_types', ex.id, !!c)}
                                />
                                <Label htmlFor={`ex-${ex.id}`}>{ex.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Intensidade do exercício</Label>
                    <p className="text-sm text-gray-500">Quando você se exercita, qual é a INTENSIDADE?</p>
                    <RadioGroup
                        value={data.bloco_5e_intensity || ''}
                        onValueChange={(v) => updateData({ bloco_5e_intensity: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="int-none" /><Label htmlFor="int-none">Não faço exercício</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="light" id="int-light" /><Label htmlFor="int-light">LEVE (Consigo falar durante, ex: caminhada tranquila)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="moderate" id="int-mod" /><Label htmlFor="int-mod">MODERADA (Consigo conversar com dificuldade)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="intense" id="int-int" /><Label htmlFor="int-int">INTENSA (Falar é difícil, respirando pesado)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="maximum" id="int-max" /><Label htmlFor="int-max">MÁXIMA (Estou no limite, não consigo falar)</Label></div>
                    </RadioGroup>
                </div>
            </section>

            {/* 5F: Hidratação */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">Hidratação</h3>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Ingestão de água diária</Label>
                    <p className="text-sm text-gray-500">Quantos LITROS DE ÁGUA você bebe por dia? (Apenas água pura)</p>
                    <Input
                        type="number"
                        inputMode="decimal"
                        min="0" max="10" step="0.1"
                        placeholder="Ex: 2.5"
                        value={data.bloco_5f_water_liters ?? ''}
                        onChange={(e) => updateData({ bloco_5f_water_liters: e.target.value === '' ? undefined : (parseFloat(e.target.value) || 0) })}
                        className="w-32"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Cor da urina</Label>
                    <p className="text-sm text-gray-500">Qual é a COR da sua URINA na maior parte do dia?</p>
                    <RadioGroup
                        value={data.bloco_5f_urine_color || ''}
                        onValueChange={(v) => updateData({ bloco_5f_urine_color: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="very_dark" id="uc-1" /><Label htmlFor="uc-1">MUITO ESCURA (Marrom/Âmbar escuro) - "Estou desidratado"</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="dark" id="uc-2" /><Label htmlFor="uc-2">ESCURA (Âmbar) - "Preciso beber mais"</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="yellow_clear" id="uc-3" /><Label htmlFor="uc-3">AMARELA CLARA (Amarelo pálido) - "Aceitável"</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="clear" id="uc-4" /><Label htmlFor="uc-4">QUASE INCOLOR (Transparente) - "Perfeito!"</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Frequência de micção</Label>
                    <p className="text-sm text-gray-500">Quantas vezes você URINA por dia? (Normal: 6-8 vezes)</p>
                    <Input
                        type="number"
                        inputMode="numeric"
                        min="0" max="30"
                        placeholder="Ex: 6"
                        value={data.bloco_5f_micturition ?? ''}
                        onChange={(e) => updateData({ bloco_5f_micturition: e.target.value === '' ? undefined : (parseInt(e.target.value) || 0) })}
                        className="w-32"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Sintomas de desidratação</Label>
                    <p className="text-sm text-gray-500">Você sente com frequência algum disto?</p>
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
                                id="hid-skin"
                                checked={!!data.bloco_5f_dehydration_symptoms?.dry_skin_frequent}
                                onCheckedChange={(c) => handleObjCheckboxChange('bloco_5f_dehydration_symptoms', 'dry_skin_frequent', !!c)}
                            />
                            <Label htmlFor="hid-skin">Pele seca frequentemente</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="hid-2"
                                checked={!!data.bloco_5f_dehydration_symptoms?.fatigue_water_helps}
                                onCheckedChange={(c) => handleObjCheckboxChange('bloco_5f_dehydration_symptoms', 'fatigue_water_helps', !!c)}
                            />
                            <Label htmlFor="hid-2">Letargia / Fadiga (que melhora muito ao beber água)</Label>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5G: Nutrição */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">Nutrição geral</h3>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Qualidade nutricional geral</Label>
                    <p className="text-sm text-gray-500">Como você avalia a QUALIDADE da sua alimentação?</p>
                    <RadioGroup
                        value={data.bloco_5g_quality || ''}
                        onValueChange={(v) => updateData({ bloco_5g_quality: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="very_poor" id="q-vp" /><Label htmlFor="q-vp">MUITO POBRE (Ultraprocessados, fast food)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="poor" id="q-p" /><Label htmlFor="q-p">POBRE (Poucas frutas, muitos carboidratos simples)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="acceptable" id="q-a" /><Label htmlFor="q-a">ACEITÁVEL (Mistura de saudáveis e menos saudáveis)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="good" id="q-g" /><Label htmlFor="q-g">BOA (Frutas, verduras, proteína, pouco processado)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="excellent" id="q-e" /><Label htmlFor="q-e">EXCELENTE (Balanceada, orgânico, sem processados)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Frequência de frutas e verduras</Label>
                    <p className="text-sm text-gray-500">Quantas PORÇÕES de frutas/verduras você come por dia?</p>
                    <Input
                        type="number"
                        inputMode="numeric"
                        min="0" max="20"
                        placeholder="Ex: 3"
                        value={data.bloco_5g_fruits_portions ?? ''}
                        onChange={(e) => updateData({ bloco_5g_fruits_portions: e.target.value === '' ? undefined : (parseInt(e.target.value) || 0) })}
                        className="w-32"
                    />
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Ingestão de proteína</Label>
                    <p className="text-sm text-gray-500">Você consome PROTEÍNA em TODAS as refeições?</p>
                    <RadioGroup
                        value={data.bloco_5g_protein || ''}
                        onValueChange={(v) => updateData({ bloco_5g_protein: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="rarely" id="pt-1" /><Label htmlFor="pt-1">NÃO, raramente como proteína</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="sometimes" id="pt-2" /><Label htmlFor="pt-2">ÀS VEZES, em algumas refeições</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="almost_all" id="pt-3" /><Label htmlFor="pt-3">SIM, em quase todas as refeições</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="all" id="pt-4" /><Label htmlFor="pt-4">SIM, em todas as refeições</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Alimentos inflamatórios</Label>
                    <p className="text-sm text-gray-500">Com que frequência você consome alimentos altamente inflamatórios? (Açúcar, fritura, álcool)</p>
                    <RadioGroup
                        value={data.bloco_5g_inflammatory || ''}
                        onValueChange={(v) => updateData({ bloco_5g_inflammatory: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="daily" id="inf-1" /><Label htmlFor="inf-1">DIARIAMENTE ou quase todos os dias</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="several_week" id="inf-2" /><Label htmlFor="inf-2">Vários dias por semana</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="1_2_week" id="inf-3" /><Label htmlFor="inf-3">1-2 dias por semana</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="rarely" id="inf-4" /><Label htmlFor="inf-4">RARAMENTE (1x ao mês)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="never" id="inf-5" /><Label htmlFor="inf-5">Nunca</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Deficiências nutricionais conhecidas</Label>
                    <p className="text-sm text-gray-500">Você tem diagnóstico de alguma deficiência nutricional?</p>
                    <RadioGroup
                        value={data.bloco_5g_deficiency || ''}
                        onValueChange={(v) => updateData({ bloco_5g_deficiency: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="multiple" id="def-1" /><Label htmlFor="def-1">SIM, múltiplas deficiências</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="one_significant" id="def-2" /><Label htmlFor="def-2">SIM, uma deficiência significativa (Vit D, B12, Ferro...)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="possible" id="def-3" /><Label htmlFor="def-3">POSSÍVEL (Nunca fiz teste)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="def-4" /><Label htmlFor="def-4">NÃO, fiz teste e está tudo bem</Label></div>
                    </RadioGroup>
                </div>
            </section>

            {/* 5H: Ergonomia */}
            <section className="space-y-6">
                <h3 className="text-lg font-semibold border-b pb-2 text-primary">Postura e ergonomia </h3>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Ergonomia no trabalho</Label>
                    <p className="text-sm text-gray-500">Como é seu AMBIENTE DE TRABALHO? (Se trabalha em escritório)</p>
                    <RadioGroup
                        value={data.bloco_5h_workspace || ''}
                        onValueChange={(v) => updateData({ bloco_5h_workspace: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="no_office" id="ws-no-office" /><Label htmlFor="ws-no-office">NÃO TRABALHO / não trabalho em escritório (ex: trabalho manual, ao ar livre, aposentado)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="ws-none" /><Label htmlFor="ws-none">SEM LUGAR ADEQUADO (cama, sofá, improvisado)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="precarious" id="ws-prec" /><Label htmlFor="ws-prec">PRECÁRIO (cadeira ruim, mesa baixa, sem suporte)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="acceptable" id="ws-acc" /><Label htmlFor="ws-acc">ACEITÁVEL (tem cadeira/mesa, pouco ajuste)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="good" id="ws-good" /><Label htmlFor="ws-good">BOM (cadeira ergonômica, monitor alinhado)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="excellent" id="ws-exc" /><Label htmlFor="ws-exc">EXCELENTE (setup profissional, suportes corretos)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Tempo sentado contínuo</Label>
                    <p className="text-sm text-gray-500">Qual é o MÁXIMO DE TEMPO que você fica sentado sem pausar?</p>
                    <div className="flex items-center gap-2">
                        <Input
                            type="number"
                            inputMode="numeric"
                            min="0" max="600"
                            placeholder="Ex: 120"
                            value={data.bloco_5h_sitting_continuous ?? ''}
                            onChange={(e) => updateData({ bloco_5h_sitting_continuous: e.target.value === '' ? undefined : (parseInt(e.target.value) || 0) })}
                            className="w-32"
                        />
                        <span className="text-sm text-slate-500">minutos (sem pausar)</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Posição de dormir</Label>
                    <p className="text-sm text-gray-500">Como você DORME (posição habitual)?</p>
                    <RadioGroup
                        value={data.bloco_5h_sleep_position || ''}
                        onValueChange={(v) => updateData({ bloco_5h_sleep_position: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="back" id="sl-1" /><Label htmlFor="sl-1">COSTAS (deitado de costas)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="side" id="sl-2" /><Label htmlFor="sl-2">LADO (Fetal)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="stomach" id="sl-3" /><Label htmlFor="sl-3">BARRIGA (de barriga para baixo)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="mixed" id="sl-4" /><Label htmlFor="sl-4">MISTO (mudo de posição bastante)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Qualidade do colchão e travesseiro </Label>
                    <p className="text-sm text-gray-500">Como está a QUALIDADE do seu colchão?</p>
                    <RadioGroup
                        value={data.bloco_5h_mattress || ''}
                        onValueChange={(v) => updateData({ bloco_5h_mattress: v })}
                        className="space-y-2"
                    >
                        <div className="flex items-center space-x-2"><RadioGroupItem value="old" id="mat-old" /><Label htmlFor="mat-old">VELHO / DESGASTADO (mais de 10 anos)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="bad" id="mat-bad" /><Label htmlFor="mat-bad">RUIM (muito mole ou causa firmeza excessiva/desconforto)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="acceptable" id="mat-acc" /><Label htmlFor="mat-acc">ACEITÁVEL (suporta, mas não ideal)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="good" id="mat-good" /><Label htmlFor="mat-good">BOM (firme, oferece suporte, confortável)</Label></div>
                        <div className="flex items-center space-x-2"><RadioGroupItem value="excellent" id="mat-exc" /><Label htmlFor="mat-exc">EXCELENTE (novo, ortopédico, adaptável)</Label></div>
                    </RadioGroup>
                </div>

                <div className="space-y-4">
                    <Label className="font-semibold text-base">Hábitos posturais prejudiciais </Label>
                    <p className="text-sm text-gray-500">Você faz algum destes hábitos que PREJUDICAM postura?</p>
                    <div className="space-y-2">
                        {[
                            { id: 'phone', label: 'MEXE NO TELEFONE (com pescoço inclinado para baixo)' },
                            { id: 'bag', label: 'CARREGAR BOLSA PESADA de um lado só' },
                            { id: 'crossed_legs', label: 'SENTA DE PERNA CRUZADA frequentemente' },
                            { id: 'keyboard_high', label: 'TECLADO / MOUSE ALTO causando dor/tensão' },
                        ].map(hb => (
                            <div key={hb.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`hab-${hb.id}`}
                                    checked={(data.bloco_5h_bad_habits || []).includes(hb.id)}
                                    onCheckedChange={(c) => handleCheckboxChange('bloco_5h_bad_habits', hb.id, !!c)}
                                />
                                <Label htmlFor={`hab-${hb.id}`}>{hb.label}</Label>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

        </div>
    );
}
