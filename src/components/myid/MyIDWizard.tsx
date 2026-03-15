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
    onSaveProgress?: (data: any, step: number) => void;
    initialData?: any;
    initialStep?: number;
}

export function MyIDWizard({ onComplete, initialData }: MyIDWizardProps) {
    const [step, setStep] = useState(0);
    const [data, setData] = useState<MyIDResponses>(initialData || {});
    const [result, setResult] = useState<any>(null);

    const totalSteps = 7; // 0=Intro, 1-6=Blocks, 7=Result
    const progressPercent = (step / (totalSteps - 1)) * 100;

    React.useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [step]);

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
                            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">🔍 BEM-VINDO AO MyID</h1>
                            <p className="text-2xl font-semibold text-primary max-w-2xl mx-auto">
                                Sua Impressão Digital Sistêmica Decodificada
                            </p>
                            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
                                Olá! Você está iniciando uma jornada de autoconhecimento profundo. <br /><br />
                                O MyID é uma <strong className="text-gray-900">FOTOGRAFIA COMPLETA</strong> de como seu corpo processa carga, dor e recuperação NESTE EXATO MOMENTO.
                            </p>

                            <div className="bg-muted/30 p-6 rounded-xl text-left max-w-2xl mx-auto space-y-6 shadow-sm border border-muted">
                                <div>
                                    <h3 className="font-bold text-lg text-primary mb-3">📌 O QUE VOCÊ VAI DESCOBRIR:</h3>
                                    <ul className="space-y-2 text-sm text-gray-700 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Quanto de "demanda" seu corpo está recebendo</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Quanto de "capacidade de suporte" você tem</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Como suas EMOÇÕES amplificam (ou reduzem) a dor</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Qual é seu nível de MOVIMENTO e ATIVIDADE</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Se você está HIDRATADO o suficiente para recuperar</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Se sua ALIMENTAÇÃO está alimentando a recuperação</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Quais "fantasmas" do passado ainda assombram seu sistema</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Se seu ambiente está ajudando ou prejudicando</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Sua postura e ergonomia estão corretas</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Qual é o padrão da sua dor</li>
                                        <li className="flex items-start gap-2"><span className="text-primary font-bold">✓</span> Se há medicações afetando sua recuperação</li>
                                    </ul>
                                </div>

                                <div className="space-y-4 pt-4 border-t border-muted-foreground/20">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">⏱️</span>
                                        <div>
                                            <span className="block font-bold">TEMPO:</span>
                                            <span className="text-sm text-gray-600">10-12 minutos (completo e preciso)</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">🔒</span>
                                        <div>
                                            <span className="block font-bold">PRIVACIDADE:</span>
                                            <span className="text-sm text-gray-600">Seus dados são confidenciais e criptografados</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">📊</span>
                                        <div>
                                            <span className="block font-bold">RESULTADO:</span>
                                            <span className="text-sm text-gray-600">Um número que fala TUDO sobre você</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 p-6 rounded-xl text-left max-w-2xl mx-auto space-y-4 border border-amber-200">
                                <h3 className="font-bold text-lg text-amber-800 flex items-center gap-2">
                                    <span>❗</span> IMPORTANTE:
                                </h3>
                                <p className="text-amber-900 text-sm">
                                    Não existem respostas "certas" ou "erradas". Apenas SUA VERDADE SINCERA.<br /><br />
                                    Quanto mais honesto você for, mais personalizado será seu plano de recuperação.
                                </p>
                                <div className="bg-red-50 p-3 rounded text-red-800 text-sm font-medium border border-red-100 flex items-start gap-3 mt-4">
                                    <span className="text-xl">⚠️</span>
                                    <span>Se você estiver em crise, dor extrema, ou febre: <strong>PROCURE UM MÉDICO</strong>. Este questionário não substitui atendimento profissional urgênte.</span>
                                </div>
                            </div>

                            <div className="pt-8 space-y-4">
                                <h3 className="text-xl font-bold text-gray-800">🚀 VAMOS COMEÇAR?</h3>
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

                    {step === 7 && result && <MyIDResult result={result} rawData={data} />}

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
