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

    // Opções em LISTA VERTICAL (linha inteira tocável) com rótulos sem
    // ambiguidade — antes "8 (Muito difícil/Pouco)" confundia e o círculo
    // ficava longe do texto.
    const OPCOES: { valor: string; numero: string; rotulo: string }[] = [
        { valor: '0', numero: '0', rotulo: 'Não atrapalha nada — faço tudo normal' },
        { valor: '2', numero: '2', rotulo: 'Incomoda um pouco, mas faço tudo' },
        { valor: '5', numero: '5', rotulo: 'Atrapalha bastante — faço só a metade' },
        { valor: '8', numero: '8', rotulo: 'Muito difícil — faço muito pouco' },
        { valor: '10', numero: '10', rotulo: 'Impossível — não consigo fazer' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Como isso afeta o seu dia a dia</h2>
                <p className="text-gray-500">
                    Sua dor é apenas um número de dor, mas o quanto ela IMPEDE você de viver é o mais importante.
                </p>
            </div>

            <div className="space-y-8">
                {functionalityQuestions.map((q) => {
                    const selecionado = data[q.id]?.toString() || '';
                    const opcoes = q.allowNotApplicable
                        ? [...OPCOES, { valor: 'na', numero: '—', rotulo: 'Não trabalho / não estudo' }]
                        : OPCOES;
                    return (
                        <div key={q.id} className="space-y-3 p-4 bg-muted/20 rounded-lg border border-muted">
                            <Label className="text-base font-semibold">{q.label}</Label>
                            <p className="text-sm text-gray-600 mb-2">{q.desc}</p>

                            <RadioGroup
                                className="flex flex-col gap-2"
                                value={selecionado}
                                onValueChange={(v) => updateData({ [q.id]: v === 'na' ? 'na' : parseInt(v) })}
                            >
                                {opcoes.map((op) => {
                                    const ativo = selecionado === op.valor;
                                    return (
                                        <label
                                            key={op.valor}
                                            htmlFor={`${q.id}-${op.valor}`}
                                            className={`flex items-center gap-3 w-full p-3 rounded-xl border cursor-pointer transition-colors ${
                                                ativo
                                                    ? 'border-primary bg-primary/10'
                                                    : 'border-border/60 bg-background hover:bg-muted/40'
                                            }`}
                                        >
                                            <RadioGroupItem value={op.valor} id={`${q.id}-${op.valor}`} className="shrink-0" />
                                            <span className={`w-8 text-center text-base font-bold tabular-nums shrink-0 ${ativo ? 'text-primary' : 'text-muted-foreground'}`}>
                                                {op.numero}
                                            </span>
                                            <span className={`text-sm flex-1 ${ativo ? 'font-semibold text-foreground' : 'text-foreground/90'}`}>
                                                {op.rotulo}
                                            </span>
                                        </label>
                                    );
                                })}
                            </RadioGroup>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
