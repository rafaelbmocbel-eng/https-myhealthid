import { useState } from 'react';
import { AvaliacaoCobZero } from '@/types/cobzero';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Save, Loader2, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Sub-etapas
import CobEtapaBasica from './CobEtapaBasica';
import CobEtapaAntropometrica from './CobEtapaAntropometrica';
import CobEtapaLenke from './CobEtapaLenke';
import CobEtapaUnidades from './CobEtapaUnidades';
import CobEtapaPrograma from './CobEtapaPrograma';

const etapas = [
    { id: 1, label: 'Dados Básicos', icon: ArrowRight },
    { id: 2, label: 'Antropometria', icon: ArrowRight },
    { id: 3, label: 'Radiografia & Lenke', icon: ArrowRight },
    { id: 4, label: 'Unidades Corporais', icon: ArrowRight },
    { id: 5, label: 'Plano Terapêutico', icon: ArrowRight },
];

interface Props {
    pacienteNome: string;
    pacienteId: string;
    onComplete: (avaliacao: AvaliacaoCobZero) => void;
    onCancel: () => void;
}

const defaultAvaliacao: AvaliacaoCobZero = {
    pacienteNome: '',
    pacienteIdade: 15,
    pacienteSexo: 'F',
    terapeutaNome: '',
    dataAvaliacao: new Date().toLocaleDateString('pt-BR'),
    etapaBasica: {
        queixaPrincipal: '', duracaoMeses: 0, aindaCrescendo: true,
        tannerStage: 3, metasTerapeuticas: ['', '', ''], atividadeFisica: 'moderada',
        historicEscoliose: false,
    },
    etapaAntropometrica: {
        altura: 165, peso: 55, circumferenceCintura: 68, testeAdam: 8,
        atr: 12, romCervical: 80, romToracica: 70, romLombar: 75, fotosUrls: [],
    },
    etapaLenke: {
        cobbAngle: 32, lenkeType: '1', lumbarModifier: 'B',
        sagittalModifier: 'N', risserStage: 2, verticalRotation: 15,
        radiographDate: '', aguardandoRadiografia: false,
    },
    etapaRisco: { riskPercentage: 0, riskLevel: 'MODERADO', risserAdjustment: 0 },
    unidades: [],
    scoreE: 0,
    etapaSRS: {
        funcaoAtividade: [3, 3, 3, 3, 3], aparencia: [3, 3, 3, 3, 3],
        dor: [3, 3, 3, 3, 3], saudeMental: [3, 3, 3, 3, 3],
        satisfacaoTratamento: [3, 3], scoreSRS22r: 65,
    },
    redFlags: {
        dorNoturna: false, progressaoRapida: false, deficitNeurologico: false,
        sintomasSistemicos: false, coletePrevio: false, cirurgiaPrevia: false, terapiaAnterior: false,
    },
    diagnosticoIA: '',
    metodoRecomendado: '',
    prognostico: '',
    faseAtual: 1,
    etapaAtual: 1,
    concluido: false,
};

export function CobZeroWizard({ pacienteNome, pacienteId, onComplete, onCancel }: Props) {
    const [etapaAtual, setEtapaAtual] = useState(1);
    const [avaliacao, setAvaliacao] = useState<AvaliacaoCobZero>({
        ...defaultAvaliacao,
        pacienteNome,
    });
    const [etapasConcluidas, setEtapasConcluidas] = useState<Set<number>>(new Set());

    const updateEtapa = (key: keyof AvaliacaoCobZero, data: any) => {
        setAvaliacao(prev => ({ ...prev, [key]: data }));
    };

    const next = () => {
        setEtapasConcluidas(prev => new Set([...prev, etapaAtual]));
        if (etapaAtual < 5) {
            setEtapaAtual(etapaAtual + 1);
        } else {
            const finalAv = { ...avaliacao, concluido: true };
            onComplete(finalAv);
        }
    };

    const back = () => {
        setEtapaAtual(Math.max(1, etapaAtual - 1));
    };

    const progresso = (etapasConcluidas.size / 5) * 100;

    return (
        <div className="space-y-6">
            {/* Header Wizard */}
            <div className="flex items-center justify-between mb-4">
                <Button variant="ghost" size="sm" onClick={onCancel} className="gap-2">
                    <ArrowLeft className="h-4 w-4" /> Cancelar
                </Button>
                <div className="flex-1 px-8">
                    <div className="flex justify-between text-[10px] items-end mb-1.5 uppercase font-bold tracking-wider text-muted-foreground/80">
                        <span>Progresso da Avaliação</span>
                        <span>Etapa {etapaAtual} de 5</span>
                    </div>
                    <Progress value={progresso} className="h-2 bg-muted shadow-inner" />
                </div>
                <div className="w-24 text-right">
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {Math.round(progresso)}%
                    </Badge>
                </div>
            </div>

            {/* Navegação de Etapas (Compacta) */}
            <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-2 scrollbar-none">
                {etapas.map(e => {
                    const isActive = etapaAtual === e.id;
                    const isDone = etapasConcluidas.has(e.id);
                    return (
                        <div
                            key={e.id}
                            className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg border transition-all shrink-0",
                                isActive ? "bg-primary text-white border-primary shadow-md scale-105" :
                                    isDone ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                        "bg-muted/50 text-muted-foreground border-transparent"
                            )}
                        >
                            {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full bg-current/10">{e.id}</span>}
                            <span className="text-xs font-semibold whitespace-nowrap">{e.label}</span>
                        </div>
                    );
                })}
            </div>

            {/* Conteúdo das Etapas */}
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                {etapaAtual === 1 && (
                    <CobEtapaBasica
                        data={avaliacao.etapaBasica}
                        onChange={(d) => updateEtapa('etapaBasica', d)}
                        onNext={next}
                    />
                )}
                {etapaAtual === 2 && (
                    <CobEtapaAntropometrica
                        data={avaliacao.etapaAntropometrica}
                        onChange={(d) => updateEtapa('etapaAntropometrica', d)}
                        onNext={next}
                        onBack={back}
                    />
                )}
                {etapaAtual === 3 && (
                    <CobEtapaLenke
                        data={avaliacao.etapaLenke}
                        pacienteSexo={avaliacao.pacienteSexo}
                        onChange={(d) => updateEtapa('etapaLenke', d)}
                        onRiscoChange={(d) => updateEtapa('etapaRisco', d)}
                        onNext={next}
                        onBack={back}
                    />
                )}
                {etapaAtual === 4 && (
                    <CobEtapaUnidades
                        unidades={avaliacao.unidades}
                        onChange={(u, scoreE) => {
                            updateEtapa('unidades', u);
                            updateEtapa('scoreE', scoreE);
                        }}
                        onNext={next}
                        onBack={back}
                    />
                )}
                {etapaAtual === 5 && (
                    <CobEtapaPrograma
                        data={{ faseAtual: avaliacao.faseAtual as any }}
                        onChange={(d) => updateEtapa('faseAtual', d.faseAtual)}
                        onNext={next}
                        onBack={back}
                    />
                )}
            </div>
        </div>
    );
}
