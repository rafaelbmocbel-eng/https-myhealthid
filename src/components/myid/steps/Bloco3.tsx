import React from 'react';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Bloco3Props {
    data: any;
    updateData: (data: any) => void;
}

export function Bloco3({ data, updateData }: Bloco3Props) {
    const functionalityQuestions = [
        {
            id: "bloco_3_work",
            label: "3.1 TRABALHO E ESTUDO",
            desc: "O quanto a dor atrapalha seu trabalho, estudo ou obrigações financeiras?",
            allowNotApplicable: true,
        },
        {
            id: "bloco_3_home",
            label: "3.2 TAREFAS DE CASA",
            desc: "O quanto atrapalha cuidar da casa (limpar, cozinhar, lavar, pegar compras)?"
        },
        {
            id: "bloco_3_exercise",
            label: "3.3 EXERCÍCIO / ESPORTE",
            desc: "O quanto atrapalha você de fazer exercícios, musculação ou praticar seu esporte na intensidade desejada?"
        },
        {
            id: "bloco_3_independence",
            label: "3.4 INDEPENDÊNCIA FÍSICA PESSOAL",
            desc: "O quanto atrapalha seus cuidados de higiene (ex: entrar/sair do banho, vestir roupa, virar na cama à noite, levantar/sentar na cadeira/sanita)?"
        },
        {
            id: "bloco_3_social",
            label: "3.5 VIDA SOCIAL / LAZER / FAMÍLIA",
            desc: "O quanto atrapalha sair com amigos, ir ao parque/restaurante com a família, pegar filhos pequenos ou brincar com eles no chão?"
        }
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Como isso afeta o seu dia a dia</h2>
                <p className="text-gray-500">
                    Sua dor é apenas um número de dor, mas o quanto ela IMPEDE você de viver é o mais importante.<br />
                    Escolha de 0 a 10 para cada uma (0 = Não atrapalha nada / 10 = Não consigo fazer de jeito nenhum).
                </p>
            </div>

            <div className="space-y-8">
                {functionalityQuestions.map((q) => (
                    <div key={q.id} className="space-y-3 p-4 bg-muted/20 rounded-lg border border-muted">
                        <Label className="text-base font-semibold">{q.label}</Label>
                        <p className="text-sm text-gray-600 mb-4">{q.desc}</p>

                        <RadioGroup
                            className="flex flex-wrap gap-2 sm:gap-4"
                            value={data[q.id]?.toString() || ''}
                            onValueChange={(v) => updateData({ [q.id]: v === 'na' ? 'na' : parseInt(v) })}
                        >
                            {[0, 2, 5, 8, 10].map(val => (
                                <div key={val} className="flex flex-col items-center space-y-1">
                                    <RadioGroupItem value={val.toString()} id={`${q.id}-${val}`} className="w-6 h-6" />
                                    <Label
                                        htmlFor={`${q.id}-${val}`}
                                        className="text-xs font-medium cursor-pointer"
                                    >
                                        {val === 0 ? '0 (Tudo Normal)' :
                                            val === 2 ? '2 (Incomoda mas faço)' :
                                                val === 5 ? '5 (Faço pela metade)' :
                                                    val === 8 ? '8 (Muito difícil/Pouco)' :
                                                        '10 (Impossível)'}
                                    </Label>
                                </div>
                            ))}
                            {q.allowNotApplicable && (
                                <div className="flex flex-col items-center space-y-1">
                                    <RadioGroupItem value="na" id={`${q.id}-na`} className="w-6 h-6" />
                                    <Label
                                        htmlFor={`${q.id}-na`}
                                        className="text-xs font-medium cursor-pointer"
                                    >
                                        Não trabalho / não estudo
                                    </Label>
                                </div>
                            )}
                        </RadioGroup>
                    </div>
                ))}
            </div>
        </div>
    );
}
