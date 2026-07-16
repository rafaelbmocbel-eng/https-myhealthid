import React, { useEffect, useRef, useState } from 'react';
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
import { readDraft, writeDraft, clearDraft } from '@/lib/draftStorage';

const DRAFT_VERSION = 1;

// Informações de cada bloco: nome, emoji, fase (1-3) e tempo estimado em minutos
const BLOCK_INFO = [
  { name: 'Introdução',            emoji: '🔍', fase: 0, minutos: 0 },
  { name: 'O que mudou',           emoji: '🔄', fase: 1, minutos: 2 },
  { name: 'Sobre a sua dor',       emoji: '🩺', fase: 1, minutos: 2 },
  { name: 'Impacto no dia a dia',  emoji: '🏃', fase: 2, minutos: 1 },
  { name: 'Movimento e emoções',   emoji: '🧠', fase: 2, minutos: 2 },
  { name: 'Estilo de vida',        emoji: '🌿', fase: 3, minutos: 3 },
  { name: 'Histórico de saúde',    emoji: '📋', fase: 3, minutos: 2 },
];

const FASE_LABELS = ['', 'Fase 1 — Dor e contexto', 'Fase 2 — Impacto e movimento', 'Fase 3 — Estilo de vida'];

// Passo final de cada fase (onde pode pausar)
const FASE_CHECKPOINTS = new Set([2, 4]);

interface MyIDWizardProps {
    onComplete?: (result: any, rawData: any) => void;
    onSaveProgress?: (data: any, step: number) => void;
    initialData?: any;
    initialStep?: number;
    draftKey?: string;
}

export function MyIDWizard({ onComplete, onSaveProgress, initialData, initialStep, draftKey }: MyIDWizardProps) {
    const [step, setStep] = useState(initialStep || 0);
    const [data, setData] = useState<MyIDResponses>(initialData || {});
    const [result, setResult] = useState<any>(null);
    const [draftLoaded, setDraftLoaded] = useState(!draftKey);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [showPausePrompt, setShowPausePrompt] = useState(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const totalSteps = 7;
    // Progresso baseado apenas nos blocos respondidos (step 1–6)
    const progressPercent = step >= 1 && step <= 6 ? ((step - 1) / 5) * 100 : 0;
    const blockInfo = BLOCK_INFO[step] ?? BLOCK_INFO[0];
    // Minutos restantes até terminar
    const minutosRestantes = BLOCK_INFO.slice(step).reduce((acc, b) => acc + b.minutos, 0);

    // Ao trocar de bloco, volta ao TOPO. window.scrollTo não funciona no portal
    // do paciente (quem rola é um contêiner interno) — rolar o marcador do topo
    // para a vista funciona em qualquer layout.
    const topoRef = React.useRef<HTMLDivElement | null>(null);
    React.useEffect(() => {
        topoRef.current?.scrollIntoView({ block: 'start' });
        window.scrollTo({ top: 0 });
    }, [step]);

    // Restaura rascunho local (cobre celular desligado no meio de um bloco)
    useEffect(() => {
        if (!draftKey) return;
        let active = true;
        (async () => {
            const draft = await readDraft<{ data: MyIDResponses; step: number }>(draftKey, DRAFT_VERSION);
            if (active && draft) {
                setData((prev) => ({ ...prev, ...draft.data }));
                setStep((prev) => Math.max(prev, draft.step));
            }
            if (active) setDraftLoaded(true);
        })();
        return () => { active = false; };
    }, [draftKey]);

    // Save local a cada resposta (IndexedDB/localStorage)
    useEffect(() => {
        if (!draftKey || !draftLoaded) return;
        void writeDraft(draftKey, { data, step }, DRAFT_VERSION);
    }, [draftKey, draftLoaded, data, step]);

    // Save no servidor com debounce de 2,5s após cada resposta
    useEffect(() => {
        if (!draftLoaded || step < 1 || step > 6 || !onSaveProgress) return;

        setSaveStatus('saving');
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

        saveTimerRef.current = setTimeout(() => {
            onSaveProgress(data, step);
            setSaveStatus('saved');
            savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
        }, 2500);

        return () => {
            if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const handleNext = () => {
        if (step === 6) {
            if (onSaveProgress) onSaveProgress(data, step);
            const calculator = new MyIDCalculator(data);
            const res = calculator.getFullResult();
            setResult(res);
            if (onComplete) onComplete(res, data);
            if (draftKey) void clearDraft(draftKey);
        } else if (step >= 1 && step <= 5 && onSaveProgress) {
            onSaveProgress(data, step);
        }
        setShowPausePrompt(false);
        setStep(s => Math.min(s + 1, totalSteps));
    };

    const handleBack = () => {
        setShowPausePrompt(false);
        setStep(s => Math.max(s - 1, 0));
    };

    const updateData = (newData: Partial<MyIDResponses>) => {
        setData(prev => ({ ...prev, ...newData }));
    };

    // Indicador de save
    // Indicador DISCRETO: o salvamento continua automático a cada resposta,
    // mas na tela só aparece um ✓ pequeno e breve quando termina de salvar —
    // o "Salvando…" pulsando a cada toque distraía as respostas.
    const SaveIndicator = () => {
        if (saveStatus !== 'saved') return null;
        return (
            <span
                className="text-[11px] text-emerald-600/70 transition-opacity"
                title="Respostas salvas automaticamente"
                aria-label="Respostas salvas automaticamente"
            >
                ✓
            </span>
        );
    };

    return (
        <div ref={topoRef} className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6" style={{ scrollMarginTop: 16 }}>

            {/* Barra de progresso com fase e nome do bloco */}
            {step > 0 && step < 7 && (
                <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">{blockInfo.emoji}</span>
                            <div className="min-w-0">
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide leading-none">
                                    {FASE_LABELS[blockInfo.fase]}
                                </p>
                                <p className="text-sm font-bold text-foreground truncate">{blockInfo.name}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <SaveIndicator />
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {minutosRestantes > 0 ? `~${minutosRestantes} min restantes` : 'Última etapa'}
                            </span>
                        </div>
                    </div>

                    {/* Segmentos de progresso (6 blocos) */}
                    <div className="flex gap-1">
                        {[1, 2, 3, 4, 5, 6].map((s) => (
                            <div
                                key={s}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                                    s < step ? 'bg-primary' : s === step ? 'bg-primary/50' : 'bg-muted'
                                }`}
                            />
                        ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground text-right">
                        Bloco {step} de 6 · {Math.round(progressPercent)}% concluído
                    </p>
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

                            {/* Fases */}
                            <div className="bg-muted/30 p-5 rounded-xl text-left max-w-2xl mx-auto border border-muted">
                                <h3 className="font-bold text-sm text-primary mb-3 uppercase tracking-wide">3 Fases — responda no seu ritmo</h3>
                                <div className="space-y-3">
                                    {[
                                        { fase: '1', label: 'Dor e contexto', blocos: 'Blocos 1–2', tempo: '~4 min', emoji: '🩺' },
                                        { fase: '2', label: 'Impacto e movimento', blocos: 'Blocos 3–4', tempo: '~3 min', emoji: '🧠' },
                                        { fase: '3', label: 'Estilo de vida e histórico', blocos: 'Blocos 5–6', tempo: '~5 min', emoji: '🌿' },
                                    ].map(f => (
                                        <div key={f.fase} className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">{f.fase}</div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-foreground">{f.emoji} {f.label}</p>
                                                <p className="text-xs text-muted-foreground">{f.blocos} · {f.tempo}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-3 border-t border-muted flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                                    <span>✓</span>
                                    <span><strong>Salvo automaticamente.</strong> Se precisar sair, suas respostas ficam salvas. Pode continuar de onde parou.</span>
                                </div>
                            </div>

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
                                            <span className="block font-bold">TEMPO TOTAL:</span>
                                            <span className="text-sm text-gray-600">10–12 minutos · pode pausar entre as fases</span>
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

            {/* Botões de navegação */}
            {step > 0 && step < 7 && (
                <div className="mt-8 px-4 sm:px-0 space-y-3">
                    {/* Prompt de pausa nos checkpoints entre fases */}
                    {FASE_CHECKPOINTS.has(step) && showPausePrompt && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
                            <span className="text-lg">✅</span>
                            <div>
                                <p className="font-semibold">Fase {BLOCK_INFO[step].fase} concluída! Suas respostas estão salvas.</p>
                                <p className="text-xs mt-0.5 text-emerald-700">Pode fechar o app e continuar depois. Ao voltar, retoma aqui.</p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center">
                        <Button variant="outline" onClick={handleBack} className="w-28">Voltar</Button>
                        <Button
                            onClick={() => {
                                if (FASE_CHECKPOINTS.has(step) && !showPausePrompt) {
                                    setShowPausePrompt(true);
                                    if (onSaveProgress) onSaveProgress(data, step);
                                } else {
                                    handleNext();
                                }
                            }}
                            className="w-36"
                        >
                            {step === 6 ? 'Finalizar' : FASE_CHECKPOINTS.has(step) && !showPausePrompt ? 'Concluir fase' : 'Avançar'}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
