import React, { useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Bloco1 } from './steps/Bloco1';
import { Bloco2 } from './steps/Bloco2';
import { Bloco3 } from './steps/Bloco3';
import { Bloco4 } from './steps/Bloco4';
import { Bloco5 } from './steps/Bloco5';
import { Bloco6 } from './steps/Bloco6';
import { MyIDCalculator, MyIDResponses } from '@/utils/myid/calculator';
import { MyIDResult } from './MyIDResult';

interface MyIDWizardProps {
    onComplete?: (result: any, rawData: any) => void;
    initialData?: any;
}

export function MyIDWizard({ onComplete, initialData }: MyIDWizardProps) {
    const [step, setStep] = useState(0);
    const [data, setData] = useState<MyIDResponses>(initialData || {});
    const [result, setResult] = useState<any>(null);

    const totalSteps = 7; // 0=Intro, 1-6=Blocks, 7=Result
    const progressPercent = (step / (totalSteps - 1)) * 100;

    const handleNext = () => {
        if (step === 6) {
            // Calculate final result
            const calculator = new MyIDCalculator(data);
            const res = calculator.getFullResult();
            setResult(res);
            if (onComplete) onComplete(res, data);
        }
        setStep(s => Math.min(s + 1, totalSteps));
    };

    const handleBack = () => {
        setStep(s => Math.max(s - 1, 0));
    };

    const updateData = (newData: Partial<MyIDResponses>) => {
        setData(prev => ({ ...prev, ...newData }));
    };

    return (
        <div className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6">

            {step > 0 && step < 7 && (
                <div className="mb-8 space-y-2">
                    <div className="flex justify-between text-sm font-medium text-gray-500">
                        <span>Passo {step} de 6</span>
                        <span>{Math.round(progressPercent)}% Concluído</span>
                    </div>
                    <Progress value={progressPercent} className="h-2" />
                </div>
            )}

            <Card className="border-0 shadow-none sm:border sm:shadow-sm sm:bg-white bg-transparent">
                <CardContent className="p-0 sm:p-6 lg:p-8">

                    {step === 0 && (
                        <div className="text-center space-y-8 animate-in fade-in zoom-in-95 duration-500 py-10">
                            <div className="inline-block p-4 bg-primary/10 rounded-full mb-4">
                                <svg className="w-12 h-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            </div>
                            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">Bem-vindo ao MyID</h1>
                            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
                                Sua Impressão Digital Sistêmica Decodificada. Uma fotografia completa de como seu corpo processa dor, carga e recuperação neste exato momento.
                            </p>

                            <div className="bg-muted/30 p-6 rounded-xl text-left max-w-lg mx-auto space-y-4 shadow-sm border border-muted">
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <span className="text-xl">⏱️</span> Tempo estimado: 10-12 minutos
                                </h3>
                                <h3 className="font-bold text-lg flex items-center gap-2">
                                    <span className="text-xl">🔒</span> Privacidade garantida
                                </h3>
                                <p className="text-sm text-gray-600 mt-4 leading-relaxed">
                                    Não existem respostas "certas" ou "erradas". Apenas SUA VERDADE SINCERA. Quanto mais honesto, mais o seu resultado será preciso.
                                </p>
                            </div>

                            <div className="pt-8">
                                <Button size="lg" className="w-full sm:w-auto text-lg px-12 h-14 rounded-full" onClick={handleNext}>
                                    INICIAR QUESTIONÁRIO
                                </Button>
                            </div>
                        </div>
                    )}

                    {step === 1 && <Bloco1 data={data} updateData={updateData} />}
                    {step === 2 && <Bloco2 data={data} updateData={updateData} />}
                    {step === 3 && <Bloco3 data={data} updateData={updateData} />}
                    {step === 4 && <Bloco4 data={data} updateData={updateData} />}
                    {step === 5 && <Bloco5 data={data} updateData={updateData} />}
                    {step === 6 && <Bloco6 data={data} updateData={updateData} />}

                    {step === 7 && result && <MyIDResult result={result} />}

                </CardContent>
            </Card>

            {step > 0 && step < 7 && (
                <div className="flex justify-between items-center mt-8 px-4 sm:px-0">
                    <Button variant="outline" onClick={handleBack} className="w-28">Voltar</Button>
                    <Button onClick={handleNext} className="w-28">
                        {step === 6 ? 'Finalizar' : 'Avançar'}
                    </Button>
                </div>
            )}
        </div>
    );
}
