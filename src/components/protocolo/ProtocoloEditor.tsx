import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    Activity, Zap, AlertTriangle, Target, CheckCircle2,
    ChevronDown, ChevronUp, Dumbbell, Clock, RotateCcw,
    Lightbulb, TrendingUp, Brain, Info, X, Check, Loader2, ClipboardList,
    ArrowLeft, ArrowRight, Eye
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
    identificarDemandas,
    gerarProtocoloAutomatico,
    ProtocoloAnalise
} from '@/utils/demandasAnalyzer';
import { getThermalColor } from '@/utils/myidCalculations';
import { buildDiretrizResumo, createDiretrizSnapshot } from '@/lib/protocoloSnapshot';
import { readDraft, writeDraft, clearDraft } from '@/lib/draftStorage';

interface Avaliacao {
    id: string;
    paciente_id: string;
    created_at: string;
    score_e: number;
    score_p: number;
    score_c: number;
    score_f: number;
    score_d: number;
    score_r: number;
    score_efi: number;
    dor_identidade: number;
    status: string;
}

interface ProtocoloEditorProps {
    avaliacao: Avaliacao;
    pacienteNome: string;
    onSave?: (protocoloId?: string) => void;
    onCancel: () => void;
}

const DEMAND_SCORE_KEYS = ['E', 'P', 'C', 'F', 'D', 'I', 'N'];

const FASE_CORES = ['bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-red-500'];
const FASE_TEXT = ['text-indigo-700', 'text-amber-700', 'text-emerald-700', 'text-red-700'];
const FASE_BG = ['bg-indigo-50', 'bg-amber-50', 'bg-emerald-50', 'bg-red-50'];
const FASE_BORDE = ['border-indigo-200', 'border-amber-200', 'border-emerald-200', 'border-red-200'];

const STEPS = [
    { id: 1, label: 'Análise', icon: Activity, desc: 'Scores e demandas' },
    { id: 2, label: 'Personalizar', icon: Dumbbell, desc: 'Exercícios e técnicas' },
    { id: 3, label: 'Revisar', icon: Eye, desc: 'Confirmar e salvar' },
];

export default function ProtocoloEditor({ avaliacao, pacienteNome, onSave, onCancel }: ProtocoloEditorProps) {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [salvando, setSalvando] = useState(false);
    const [currentStep, setCurrentStep] = useState(1);
    const [faseEditando, setFaseEditando] = useState(0);

    const resolvedPacienteId = avaliacao.paciente_id;

    const scores = {
        E: avaliacao?.score_e || 0,
        P: avaliacao?.score_p || 0,
        C: avaliacao?.score_c || 0,
        F: avaliacao?.score_f || 0,
        D: avaliacao?.score_d || 0,
        R: avaliacao?.score_r || 0,
        EFI: avaliacao?.score_efi || 0,
        idFinal: avaliacao?.dor_identidade || 0,
        classificacao: '',
    };

    const demandas = identificarDemandas(scores);
    const analiseOriginal = gerarProtocoloAutomatico(scores, demandas);

    // Selection state
    const [selectedExercicios, setSelectedExercicios] = useState<Record<number, Set<number>>>(() => {
        const initial: Record<number, Set<number>> = {};
        analiseOriginal.fases.forEach((fase, idx) => {
            initial[idx] = new Set(fase.exercicios.map((_, i) => i));
        });
        return initial;
    });

    const [selectedTecnicas, setSelectedTecnicas] = useState<Record<number, Set<number>>>(() => {
        const initial: Record<number, Set<number>> = {};
        analiseOriginal.fases.forEach((fase, idx) => {
            initial[idx] = new Set(fase.tecnicas.map((_, i) => i));
        });
        return initial;
    });

    // ── Draft persistence ──────────────────────────────────────────
    const DRAFT_KEY = `diretriz:${resolvedPacienteId}`;
    const DRAFT_VERSION = 2;
    const draftRestoredRef = useRef(false);

    // Restore draft on mount
    useEffect(() => {
        if (draftRestoredRef.current) return;
        draftRestoredRef.current = true;
        void readDraft<{
            step: number;
            fase: number;
            exercicios: Record<number, number[]>;
            tecnicas: Record<number, number[]>;
        }>(DRAFT_KEY, DRAFT_VERSION).then(draft => {
            if (!draft) return;
            setCurrentStep(draft.step);
            setFaseEditando(draft.fase);
            const ex: Record<number, Set<number>> = {};
            Object.entries(draft.exercicios).forEach(([k, v]) => { ex[Number(k)] = new Set(v); });
            setSelectedExercicios(ex);
            const tec: Record<number, Set<number>> = {};
            Object.entries(draft.tecnicas).forEach(([k, v]) => { tec[Number(k)] = new Set(v); });
            setSelectedTecnicas(tec);
        });
    }, [DRAFT_KEY]);

    // Persist on visibility change / beforeunload
    const saveDraftNow = () => {
        const serializable = {
            step: currentStep,
            fase: faseEditando,
            exercicios: Object.fromEntries(Object.entries(selectedExercicios).map(([k, s]) => [k, [...s]])),
            tecnicas: Object.fromEntries(Object.entries(selectedTecnicas).map(([k, s]) => [k, [...s]])),
        };
        void writeDraft(DRAFT_KEY, serializable, DRAFT_VERSION);
    };

    useEffect(() => {
        const onVis = () => { if (document.visibilityState === 'hidden') saveDraftNow(); };
        const onUnload = () => saveDraftNow();
        document.addEventListener('visibilitychange', onVis);
        window.addEventListener('beforeunload', onUnload);
        return () => {
            document.removeEventListener('visibilitychange', onVis);
            window.removeEventListener('beforeunload', onUnload);
            saveDraftNow(); // persist on unmount too
        };
    });

    const toggleExercicio = (faseIdx: number, exIdx: number) => {
        setSelectedExercicios(prev => {
            const s = new Set(prev[faseIdx] || []);
            if (s.has(exIdx)) s.delete(exIdx); else s.add(exIdx);
            return { ...prev, [faseIdx]: s };
        });
    };

    const toggleTecnica = (faseIdx: number, tecIdx: number) => {
        setSelectedTecnicas(prev => {
            const s = new Set(prev[faseIdx] || []);
            if (s.has(tecIdx)) s.delete(tecIdx); else s.add(tecIdx);
            return { ...prev, [faseIdx]: s };
        });
    };

    const handleSalvar = async () => {
        if (!user) return;
        setSalvando(true);
        try {
            const analisePersonalizada: ProtocoloAnalise = {
                ...analiseOriginal,
                fases: analiseOriginal.fases.map((fase, idx) => ({
                    ...fase,
                    exercicios: fase.exercicios.filter((_, i) => selectedExercicios[idx]?.has(i)),
                    tecnicas: fase.tecnicas.filter((_, i) => selectedTecnicas[idx]?.has(i)),
                })),
            };

            const diretrizSnapshot = createDiretrizSnapshot(analisePersonalizada);

            const finalScores = {
                ...scores,
                prognose: analisePersonalizada.prognose,
                diretriz_snapshot: diretrizSnapshot,
            };

            const { data: prot, error: errProt } = await supabase
                .from('protocolos' as any)
                .insert({
                    paciente_id: resolvedPacienteId,
                    terapeuta_id: user.id,
                    avaliacao_id: avaliacao?.id || null,
                    titulo: `Diretriz Personalizada – ${pacienteNome}`,
                    objetivo_geral: analisePersonalizada.objetivoGeral,
                    descricao: buildDiretrizResumo(diretrizSnapshot),
                    duracao_total: analisePersonalizada.duracaoTotal,
                    frequencia: analisePersonalizada.frequencia,
                    perfil_dominante: analisePersonalizada.demandasIdentificadas.map(d => d.area.toUpperCase().replace(/ /g, '_')),
                    scores_avaliacao: finalScores,
                    hierarquia_terapeutica: analisePersonalizada.demandasIdentificadas.map(d => ({
                        foco: d.area,
                        severidade: d.severidade,
                        prioridade: d.prioridade,
                        motivo: d.motivo,
                    })),
                    status: 'ativo',
                    data_inicio: new Date().toISOString().split('T')[0],
                })
                .select()
                .single();

            if (errProt) throw errProt;

            for (const fase of analisePersonalizada.fases) {
                const { error: errFase } = await supabase
                    .from('protocolo_fases' as any)
                    .insert({
                        protocolo_id: (prot as any).id,
                        numero_fase: fase.numero,
                        titulo: fase.titulo,
                        semanas_inicio: fase.semanas_inicio,
                        semanas_fim: fase.semanas_fim,
                        objetivos: [fase.objetivo, ...fase.demandasAlvo.map(d => `Foco: ${d}`)],
                        sessoes_por_semana: fase.frequenciaSemanal,
                    })
                    .select()
                    .single();

                if (errFase) throw errFase;
            }

            // ── Auto-create prontuário note with technique summary ──
            try {
            const totalFases = analisePersonalizada.fases.length;
                const totalTecs = analisePersonalizada.fases.reduce((s, f) => s + f.tecnicas.length, 0);
                const totalExs = analisePersonalizada.fases.reduce((s, f) => s + f.exercicios.length, 0);
                const demandas = analisePersonalizada.demandasIdentificadas.slice(0, 3).map(d => `${d.area} (${d.severidade})`).join(', ');
                const fasesResumo = analisePersonalizada.fases.map(f => `Fase ${f.numero}: ${f.titulo}`).join(' | ');

                const notaDescricao = `Diretriz de Tratamento — ${analisePersonalizada.duracaoTotal}, ${analisePersonalizada.frequencia}.
Objetivo: ${analisePersonalizada.objetivoGeral}
Prognóstico: ${analisePersonalizada.prognose}
Demandas: ${demandas || 'N/I'}.
Estrutura: ${totalFases} fases, ${totalTecs} técnicas, ${totalExs} exercícios.
${fasesResumo}
Diretriz gerada a partir da avaliação. Detalhes completos na aba Diretrizes.`;

                await (supabase as any)
                    .from('notas_prontuario')
                    .insert({
                        paciente_id: resolvedPacienteId,
                        terapeuta_id: user.id,
                        tipo: 'conduta_diretriz',
                        titulo: `Diretriz de Tratamento — ${analisePersonalizada.duracaoTotal}`,
                        descricao: notaDescricao,
                        referencia_id: (prot as any).id,
                        dados_extras: {
                            protocolo_id: (prot as any).id,
                            total_tecnicas: totalTecSelecionados,
                            total_exercicios: totalExSelecionados,
                            demandas: analisePersonalizada.demandasIdentificadas.length,
                        },
                    });
            } catch (notaErr) {
                console.warn('Nota do prontuário não registrada:', notaErr);
            }

            qc.invalidateQueries({ queryKey: ['protocolos'] });
            qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });
            qc.invalidateQueries({ queryKey: ['avaliacoes-sem-protocolo'] });
            qc.invalidateQueries({ queryKey: ['avaliacoes-sem-protocolo-paciente'] });
            qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
            qc.invalidateQueries({ queryKey: ['evolucao-paciente'] });
            toast({ title: '✅ Diretriz salva com sucesso!', description: 'Diretriz em 4 fases criada, registrada no prontuário e pronta para uso.' });
            await clearDraft(DRAFT_KEY);
            if (onSave) onSave((prot as any).id);
        } catch (err: any) {
            console.error(err);
            toast({ title: 'Erro ao salvar diretriz', description: err.message, variant: 'destructive' });
        } finally {
            setSalvando(false);
        }
    };

    const totalExSelecionados = Object.values(selectedExercicios).reduce((sum, s) => sum + s.size, 0);
    const totalTecSelecionados = Object.values(selectedTecnicas).reduce((sum, s) => sum + s.size, 0);
    const totalEx = analiseOriginal.fases.reduce((sum, f) => sum + f.exercicios.length, 0);
    const totalTec = analiseOriginal.fases.reduce((sum, f) => sum + f.tecnicas.length, 0);

    const getThermicColor = (val: number, key: string) => {
        const isDemand = DEMAND_SCORE_KEYS.includes(key);
        return isDemand ? getThermalColor(val) : getThermalColor(10 - val);
    };

    const scoreItems = [
        { key: 'E', label: 'Estrutural', val: scores.E },
        { key: 'P', label: 'Psico-comp.', val: scores.P },
        { key: 'C', label: 'Contextual', val: scores.C },
        { key: 'F', label: 'Biológico', val: scores.F },
        { key: 'D', label: 'Dor', val: scores.D },
        { key: 'R', label: 'Regulação', val: scores.R },
        { key: 'EFI', label: 'Funcional.', val: scores.EFI },
    ];

    const fase = analiseOriginal.fases[faseEditando];

    return (
        <div className="max-w-4xl mx-auto py-4 pb-24">
            {/* Header compacto */}
            <div className="flex items-center gap-3 mb-5">
                <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                    <h2 className="text-lg font-bold text-foreground">
                        Nova Diretriz — {pacienteNome}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        ID Final: {scores.idFinal.toFixed(1)} · {demandas.length} demandas identificadas
                    </p>
                </div>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-2 mb-6 bg-muted/40 rounded-xl p-3">
                {STEPS.filter(s => !isFreeMode || s.id !== 1).map((step, i, arr) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.id;
                    const isDone = currentStep > step.id;
                    return (
                        <div key={step.id} className="flex items-center gap-2 flex-1">
                            <button
                                onClick={() => setCurrentStep(step.id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all w-full ${
                                    isActive
                                        ? 'bg-primary text-primary-foreground shadow-md'
                                        : isDone
                                            ? 'bg-primary/10 text-primary hover:bg-primary/20'
                                            : 'text-muted-foreground hover:bg-muted'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                    isActive ? 'bg-primary-foreground/20' : isDone ? 'bg-primary/20' : 'bg-muted'
                                }`}>
                                    {isDone ? <Check className="h-3 w-3" /> : i + 1}
                                </div>
                                <div className="text-left hidden sm:block">
                                    <div className="text-xs font-semibold leading-tight">{step.label}</div>
                                    <div className="text-[10px] opacity-70 leading-tight">{step.desc}</div>
                                </div>
                                <span className="text-xs font-semibold sm:hidden">{step.label}</span>
                            </button>
                            {i < arr.length - 1 && (
                                <ChevronDown className="h-3 w-3 text-muted-foreground rotate-[-90deg] shrink-0 hidden sm:block" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ═══ STEP 1: Análise ═══ */}
            {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Header card */}
                    <div className="clinical-card bg-gradient-primary text-white">
                        <div className="flex items-start justify-between">
                            <div>
                                <div className="text-xs opacity-70 uppercase tracking-widest mb-1 flex items-center gap-2">
                                    <Zap className="h-3 w-3" /> Análise Automática
                                </div>
                                <h2 className="text-lg font-bold">Diretriz Personalizada</h2>
                                <p className="text-sm opacity-80 mt-1">{analiseOriginal.duracaoTotal} · {analiseOriginal.frequencia}</p>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                                <div className="text-xs opacity-70 mb-1">ID Final</div>
                                <div className="text-3xl font-black">{scores.idFinal.toFixed(1)}</div>
                                <div className="text-sm opacity-80">{demandas.length} demandas</div>
                            </div>
                        </div>
                        <div className="mt-3 p-2.5 rounded-xl bg-white/10 text-sm">
                            <strong>Objetivo:</strong> {analiseOriginal.objetivoGeral}
                        </div>
                    </div>

                    {/* Scores + Demandas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="clinical-card">
                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                Scores da Avaliação
                            </h3>
                            <div className="space-y-2.5">
                                {scoreItems.map(item => {
                                    const pct = Math.min(100, (item.val / 10) * 100);
                                    const cor = getThermicColor(item.val, item.key);
                                    const isBad = (DEMAND_SCORE_KEYS.includes(item.key) && item.val >= 7) || (!DEMAND_SCORE_KEYS.includes(item.key) && item.val <= 4);
                                    return (
                                        <div key={item.key} className="flex items-center gap-2">
                                            <div className="w-20 text-xs text-muted-foreground shrink-0">{item.label}</div>
                                            <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                                                <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
                                            </div>
                                            <div className="w-10 text-right text-xs font-bold" style={{ color: cor }}>{item.val.toFixed(1)}</div>
                                            {isBad && <AlertTriangle className="h-3 w-3 text-destructive shrink-0" />}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="clinical-card">
                            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                <Target className="h-4 w-4 text-primary" />
                                Demandas ({demandas.length})
                            </h3>
                            {demandas.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground text-sm">
                                    <CheckCircle2 className="h-6 w-6 mx-auto mb-1 text-emerald-500" />
                                    Scores dentro dos parâmetros.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {demandas.map((d, i) => (
                                        <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: d.corBg }}>
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5" style={{ backgroundColor: d.cor }}>
                                                {d.prioridade === 0 ? '!' : i + 1}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold" style={{ color: d.cor }}>{d.area}</span>
                                                    <Badge className="text-[10px] h-4 border-0 px-1" style={{ backgroundColor: d.cor + '20', color: d.cor }}>
                                                        {d.severidade}
                                                    </Badge>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{d.descricao}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Prognose */}
                    <div className="clinical-card border-l-4 border-primary bg-primary/5">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-sm">Prognose</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{analiseOriginal.prognose}</p>
                    </div>

                    {/* Preview das 4 fases */}
                    <div className="clinical-card">
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-primary" />
                            Visão Geral — 4 Fases
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {analiseOriginal.fases.map((f, idx) => (
                                <div key={idx} className={`rounded-xl p-3 border ${FASE_BORDE[idx]} ${FASE_BG[idx]}`}>
                                    <div className={`w-7 h-7 rounded-full ${FASE_CORES[idx]} flex items-center justify-center text-white text-xs font-bold mb-2`}>
                                        {f.numero}
                                    </div>
                                    <div className={`text-xs font-semibold ${FASE_TEXT[idx]} leading-tight`}>{f.titulo}</div>
                                    <div className="text-[10px] text-muted-foreground mt-1">
                                        Sem. {f.semanas} · {f.exercicios.length} ex · {f.tecnicas.length} téc
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ STEP 2: Personalizar Fases ═══ */}
            {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Navegação entre fases */}
                    <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
                        {analiseOriginal.fases.map((f, idx) => (
                            <button
                                key={idx}
                                onClick={() => setFaseEditando(idx)}
                                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                    faseEditando === idx
                                        ? `${FASE_BG[idx]} ${FASE_TEXT[idx]} shadow-sm border ${FASE_BORDE[idx]}`
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-full ${faseEditando === idx ? FASE_CORES[idx] : 'bg-muted-foreground/20'} flex items-center justify-center text-white text-[10px] font-bold shrink-0`}>
                                    {f.numero}
                                </div>
                                <span className="hidden sm:inline truncate">{f.titulo.split(' ').slice(0, 2).join(' ')}</span>
                                <span className="sm:hidden">F{f.numero}</span>
                            </button>
                        ))}
                    </div>

                    {/* Fase ativa */}
                    {fase && (
                        <div className={`rounded-xl border-2 ${FASE_BORDE[faseEditando]} overflow-hidden`}>
                            {/* Header da fase */}
                            <div className={`p-4 ${FASE_BG[faseEditando]}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-full ${FASE_CORES[faseEditando]} flex items-center justify-center text-white font-bold shrink-0`}>
                                        {fase.numero}
                                    </div>
                                    <div className="flex-1">
                                        <div className={`font-bold ${FASE_TEXT[faseEditando]}`}>{fase.titulo}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Semanas {fase.semanas} · {fase.frequenciaSemanal}x/sem · {fase.duracaoSessao}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 p-2 rounded-lg bg-background/60 text-xs text-muted-foreground">
                                    <strong className="text-foreground">Objetivo:</strong> {fase.objetivo}
                                </div>
                            </div>

                            {/* Conteúdo: Exercícios + Técnicas */}
                            <div className="p-4 space-y-5 bg-background">
                                {/* Exercícios */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                        <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
                                        Exercícios
                                        <Badge variant="outline" className="text-[10px] h-5">
                                            {selectedExercicios[faseEditando]?.size || 0}/{fase.exercicios.length}
                                        </Badge>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {fase.exercicios.map((ex, i) => {
                                            const isSelected = selectedExercicios[faseEditando]?.has(i);
                                            return (
                                                <div
                                                    key={i}
                                                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                                        isSelected ? 'bg-card border-primary/30 shadow-sm' : 'bg-muted/20 border-dashed opacity-60'
                                                    }`}
                                                    onClick={() => toggleExercicio(faseEditando, i)}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                                            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                                                        }`}>
                                                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm">{ex.nome}</div>
                                                            <Badge variant="outline" className="text-[10px] mt-0.5">{ex.categoria}</Badge>
                                                            <p className="text-xs text-muted-foreground mt-1 leading-tight line-clamp-2">{ex.descricao}</p>
                                                            <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                                                                <span className="flex items-center gap-1"><RotateCcw className="h-2.5 w-2.5" />{ex.series}×{ex.repeticoes}</span>
                                                                <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{ex.duracao}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {fase.exercicios.length === 0 && (
                                        <p className="text-xs text-muted-foreground italic py-3">Nenhum exercício sugerido para esta fase.</p>
                                    )}
                                </div>

                                {/* Técnicas */}
                                <div>
                                    <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                                        <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                                        Técnicas Terapêuticas
                                        <Badge variant="outline" className="text-[10px] h-5">
                                            {selectedTecnicas[faseEditando]?.size || 0}/{fase.tecnicas.length}
                                        </Badge>
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {fase.tecnicas.map((tec, i) => {
                                            const isSelected = selectedTecnicas[faseEditando]?.has(i);
                                            return (
                                                <div
                                                    key={i}
                                                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                                                        isSelected ? 'bg-card border-primary/30 shadow-sm' : 'bg-muted/20 border-dashed opacity-60'
                                                    }`}
                                                    onClick={() => toggleTecnica(faseEditando, i)}
                                                >
                                                    <div className="flex items-start gap-2">
                                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                                                            isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                                                        }`}>
                                                            {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-medium text-sm">{tec.nome}</div>
                                                            <p className="text-xs text-muted-foreground mt-1 leading-tight line-clamp-2">{tec.descricao}</p>
                                                            <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                                                                <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{tec.duracao}</span>
                                                                <span>{tec.frequencia}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {fase.tecnicas.length === 0 && (
                                        <p className="text-xs text-muted-foreground italic py-3">Nenhuma técnica sugerida para esta fase.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navegação entre fases (prev/next) */}
                    <div className="flex items-center justify-between">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={faseEditando === 0}
                            onClick={() => setFaseEditando(prev => Math.max(0, prev - 1))}
                            className="gap-1"
                        >
                            <ArrowLeft className="h-3 w-3" /> Fase anterior
                        </Button>
                        <span className="text-xs text-muted-foreground font-medium">
                            Fase {faseEditando + 1} de {analiseOriginal.fases.length}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={faseEditando === analiseOriginal.fases.length - 1}
                            onClick={() => setFaseEditando(prev => Math.min(analiseOriginal.fases.length - 1, prev + 1))}
                            className="gap-1"
                        >
                            Próxima fase <ArrowRight className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            )}

            {/* ═══ STEP 3: Revisar & Salvar ═══ */}
            {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Resumo geral */}
                    <div className="clinical-card bg-gradient-primary text-white">
                        <div className="flex items-center gap-3 mb-3">
                            <CheckCircle2 className="h-5 w-5" />
                            <h2 className="text-lg font-bold">Resumo da Diretriz</h2>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white/10 rounded-lg p-3 text-center">
                                <div className="text-2xl font-black">{totalExSelecionados}</div>
                                <div className="text-xs opacity-80">Exercícios</div>
                            </div>
                            <div className="bg-white/10 rounded-lg p-3 text-center">
                                <div className="text-2xl font-black">{totalTecSelecionados}</div>
                                <div className="text-xs opacity-80">Técnicas</div>
                            </div>
                            <div className="bg-white/10 rounded-lg p-3 text-center">
                                <div className="text-2xl font-black">4</div>
                                <div className="text-xs opacity-80">Fases</div>
                            </div>
                            <div className="bg-white/10 rounded-lg p-3 text-center">
                                <div className="text-2xl font-black">{analiseOriginal.duracaoTotal.replace(' semanas', '')}</div>
                                <div className="text-xs opacity-80">Semanas</div>
                            </div>
                        </div>
                    </div>

                    {/* Detalhes por fase */}
                    {analiseOriginal.fases.map((f, idx) => {
                        const exCount = selectedExercicios[idx]?.size || 0;
                        const tecCount = selectedTecnicas[idx]?.size || 0;
                        return (
                            <div key={idx} className={`clinical-card border-l-4 ${FASE_BORDE[idx].replace('border-', 'border-l-')}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full ${FASE_CORES[idx]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                                        {f.numero}
                                    </div>
                                    <div className="flex-1">
                                        <div className={`font-semibold text-sm ${FASE_TEXT[idx]}`}>{f.titulo}</div>
                                        <div className="text-xs text-muted-foreground">Sem. {f.semanas} · {f.frequenciaSemanal}x/sem</div>
                                    </div>
                                    <div className="flex gap-2 text-xs">
                                        <Badge variant="outline" className="gap-1">
                                            <Dumbbell className="h-2.5 w-2.5" />{exCount}
                                        </Badge>
                                        <Badge variant="outline" className="gap-1">
                                            <Brain className="h-2.5 w-2.5" />{tecCount}
                                        </Badge>
                                    </div>
                                </div>
                                {exCount === 0 && tecCount === 0 && (
                                    <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Nenhum item selecionado nesta fase
                                    </p>
                                )}
                            </div>
                        );
                    })}

                    {/* Prognose */}
                    <div className="clinical-card border-l-4 border-primary bg-primary/5">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <h3 className="font-semibold text-sm">Prognose</h3>
                        </div>
                        <p className="text-sm text-muted-foreground">{analiseOriginal.prognose}</p>
                    </div>
                </div>
            )}

            {/* ═══ Barra inferior fixa ═══ */}
            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t shadow-lg z-40">
                <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                            <Dumbbell className="h-2.5 w-2.5" />{totalExSelecionados}/{totalEx}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                            <Brain className="h-2.5 w-2.5" />{totalTecSelecionados}/{totalTec}
                        </Badge>
                    </div>

                    <div className="flex items-center gap-2">
                        {currentStep > (isFreeMode ? 2 : 1) && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentStep(prev => prev - 1)}
                                className="gap-1"
                            >
                                <ArrowLeft className="h-3.5 w-3.5" />
                                <span className="hidden sm:inline">Voltar</span>
                            </Button>
                        )}

                        {currentStep < 3 ? (
                            <Button
                                size="sm"
                                onClick={() => setCurrentStep(prev => prev + 1)}
                                className="bg-gradient-primary text-white gap-1"
                            >
                                <span>{currentStep === 1 ? 'Personalizar' : 'Revisar'}</span>
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Button>
                        ) : (
                            <Button
                                size="sm"
                                onClick={handleSalvar}
                                disabled={salvando || (totalExSelecionados === 0 && totalTecSelecionados === 0)}
                                className="bg-gradient-primary text-white gap-1.5 px-5"
                            >
                                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                Salvar Diretriz
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
