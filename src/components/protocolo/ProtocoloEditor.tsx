import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Activity, Zap, AlertTriangle, Target, CheckCircle2,
    ChevronDown, ChevronUp, Dumbbell, Clock, RotateCcw,
    Lightbulb, TrendingUp, Brain, Info, X, Check, Loader2, ClipboardList
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import {
    identificarDemandas,
    gerarProtocoloAutomatico,
    ProtocoloAnalise
} from '@/utils/demandasAnalyzer';
import { getThermalColor } from '@/utils/myidCalculations';

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
    onSave?: () => void;
    onCancel: () => void;
}

const DEMAND_SCORE_KEYS = ['E', 'P', 'C', 'F', 'D', 'I', 'N'];

const FASE_CORES = ['bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-red-500'];
const FASE_TEXT = ['text-indigo-700', 'text-amber-700', 'text-emerald-700', 'text-red-700'];
const FASE_BG = ['bg-indigo-50', 'bg-amber-50', 'bg-emerald-50', 'bg-red-50'];
const FASE_BORDE = ['border-indigo-200', 'border-amber-200', 'border-emerald-200', 'border-red-200'];

export default function ProtocoloEditor({ avaliacao, pacienteNome, onSave, onCancel }: ProtocoloEditorProps) {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [salvando, setSalvando] = useState(false);

    const scores = {
        E: avaliacao.score_e || 0,
        P: avaliacao.score_p || 0,
        C: avaliacao.score_c || 0,
        F: avaliacao.score_f || 0,
        D: avaliacao.score_d || 0,
        R: avaliacao.score_r || 0,
        EFI: avaliacao.score_efi || 0,
        idFinal: avaliacao.dor_identidade || 0,
        classificacao: '',
    };

    const demandas = identificarDemandas(scores);
    const analiseOriginal = gerarProtocoloAutomatico(scores, demandas);

    const [fasesAbertas, setFasesAbertas] = useState<Set<number>>(new Set([0]));

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

    const toggleFase = (i: number) => {
        setFasesAbertas(prev => {
            const s = new Set(prev);
            if (s.has(i)) s.delete(i); else s.add(i);
            return s;
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

            const finalScores = {
                ...scores,
                prognose: analisePersonalizada.prognose,
            };

            // 1. Criar protocolo
            const { data: prot, error: errProt } = await supabase
                .from('protocolos' as any)
                .insert({
                    paciente_id: avaliacao.paciente_id,
                    terapeuta_id: user.id,
                    avaliacao_id: avaliacao.id,
                    titulo: `Diretriz Personalizada – ${pacienteNome}`,
                    objetivo_geral: analisePersonalizada.objetivoGeral,
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

            // 2. Criar fases e suas prescrições
            for (const fase of analisePersonalizada.fases) {
                const { data: faseObj, error: errFase } = await supabase
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

                // Se houver lógica de inserir exercícios/técnicas individuais nas tabelas, faria aqui. 
                // No esquema atual, parece que o ProtocoloViewer lê isso. 
                // Mas o renderizador padrão de Protocolos.tsx espera que os exercícios existam para PDF.
                // O handleSalvarAnalise original em Protocolos.tsx só inseria as fases.
            }

            qc.invalidateQueries({ queryKey: ['protocolos'] });
            qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });
            qc.invalidateQueries({ queryKey: ['avaliacoes-sem-protocolo'] });
            qc.invalidateQueries({ queryKey: ['avaliacoes-sem-protocolo-paciente'] });
            toast({ title: '✅ Diretriz salva com sucesso!', description: 'Diretriz em 4 fases criada e pronta para uso.' });
            if (onSave) onSave();
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

    return (
        <div className="space-y-6 max-w-4xl mx-auto py-4">
            <div className="flex items-center gap-3 mb-2">
                <Button variant="outline" size="sm" onClick={onCancel} className="gap-2">
                    <ChevronUp className="h-4 w-4 rotate-270" />
                    Voltar para Lista
                </Button>
                <h2 className="text-lg font-bold">Análise e Montagem de Diretriz</h2>
            </div>

            {/* Header de análise */}
            <div className="clinical-card bg-gradient-primary text-white">
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-xs opacity-70 uppercase tracking-widest mb-1 flex items-center gap-2">
                            <Zap className="h-3 w-3" /> Análise Automática Gerada
                        </div>
                        <h2 className="text-xl font-bold">Diretriz Personalizada – {pacienteNome}</h2>
                        <p className="text-sm opacity-80 mt-1">{analiseOriginal.duracaoTotal} · {analiseOriginal.frequencia}</p>
                    </div>
                    <div className="text-right shrink-0 ml-4">
                        <div className="text-xs opacity-70 mb-1">ID Final</div>
                        <div className="text-4xl font-black">{scores.idFinal.toFixed(1)}</div>
                        <div className="text-sm opacity-80">{demandas.length} demandas</div>
                    </div>
                </div>
                <div className="mt-4 p-3 rounded-xl bg-white/10 text-sm">
                    <strong>Objetivo:</strong> {analiseOriginal.objetivoGeral}
                </div>
            </div>

            {/* Scores + Demandas - grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Scores */}
                <div className="clinical-card">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <Activity className="h-4 w-4 text-primary" />
                        Scores da Avaliação
                    </h3>
                    <div className="space-y-3">
                        {scoreItems.map(item => {
                            const pct = Math.min(100, (item.val / 10) * 100);
                            const cor = getThermicColor(item.val, item.key);
                            const isBad = (DEMAND_SCORE_KEYS.includes(item.key) && item.val >= 7) || (!DEMAND_SCORE_KEYS.includes(item.key) && item.val <= 4);
                            return (
                                <div key={item.key} className="flex items-center gap-2">
                                    <div className="w-20 text-xs text-muted-foreground shrink-0">{item.label}</div>
                                    <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                                        <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
                                    </div>
                                    <div className="w-12 text-right text-xs font-bold" style={{ color: cor }}>{item.val.toFixed(1)}</div>
                                    {isBad && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Demandas */}
                <div className="clinical-card">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Demandas de Melhoria ({demandas.length})
                    </h3>
                    {demandas.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                            Scores dentro dos parâmetros normais.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {demandas.map((d, i) => (
                                <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: d.corBg }}>
                                    <div className="mt-0.5 shrink-0">
                                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: d.cor }}>
                                            {d.prioridade === 0 ? '!' : i + 1}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-xs font-bold" style={{ color: d.cor }}>{d.area}</span>
                                            <Badge className="text-[10px] h-4 border-0 px-1" style={{ backgroundColor: d.cor + '20', color: d.cor }}>
                                                {d.severidade}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground">{d.score.toFixed(1)}</span>
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

            {/* 4 Fases */}
            <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                    <ClipboardList className="h-5 w-5 text-primary" />
                    Diretriz em 4 Fases
                </h3>
                {analiseOriginal.fases.map((fase, idx) => {
                    const aberta = fasesAbertas.has(idx);
                    return (
                        <div key={idx} className={`rounded-xl border-2 ${FASE_BORDE[idx]} overflow-hidden`}>
                            <button
                                className={`w-full flex items-center justify-between p-4 ${FASE_BG[idx]} text-left`}
                                onClick={() => toggleFase(idx)}
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full ${FASE_CORES[idx]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                                        {fase.numero}
                                    </div>
                                    <div>
                                        <div className={`font-semibold ${FASE_TEXT[idx]}`}>{fase.titulo}</div>
                                        <div className="text-xs text-muted-foreground">
                                            Semanas {fase.semanas} · {fase.frequenciaSemanal}x/sem · {fase.duracaoSessao}
                                        </div>
                                    </div>
                                </div>
                                {aberta ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            </button>

                            {aberta && (
                                <div className="p-4 space-y-4 bg-background">
                                    <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                                        <strong className="text-foreground">Objetivo:</strong> {fase.objetivo}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                                <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
                                                Exercícios ({selectedExercicios[idx]?.size || 0}/{fase.exercicios.length})
                                            </h4>
                                            <div className="space-y-2">
                                                {fase.exercicios.map((ex, i) => {
                                                    const isSelected = selectedExercicios[idx]?.has(i);
                                                    return (
                                                        <div key={i} className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-card border-primary/30' : 'bg-muted/30 border-dashed opacity-50'}`} onClick={() => toggleExercicio(idx, i)}>
                                                            <div className="flex items-start gap-2">
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                                                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-sm">{ex.nome}</div>
                                                                    <Badge variant="outline" className="text-[10px] mt-0.5">{ex.categoria}</Badge>
                                                                    <p className="text-xs text-muted-foreground mt-1 leading-tight">{ex.descricao}</p>
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
                                        </div>

                                        <div>
                                            <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                                <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                                                Técnicas ({selectedTecnicas[idx]?.size || 0}/{fase.tecnicas.length})
                                            </h4>
                                            <div className="space-y-2">
                                                {fase.tecnicas.map((tec, i) => {
                                                    const isSelected = selectedTecnicas[idx]?.has(i);
                                                    return (
                                                        <div key={i} className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-card border-primary/30' : 'bg-muted/30 border-dashed opacity-50'}`} onClick={() => toggleTecnica(idx, i)}>
                                                            <div className="flex items-start gap-2">
                                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                                                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <div className="font-medium text-sm">{tec.nome}</div>
                                                                    <p className="text-xs text-muted-foreground mt-1 leading-tight">{tec.descricao}</p>
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
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Ações */}
            <div className="clinical-card mt-8">
                <h3 className="font-semibold text-sm mb-3">Salvar Diretriz</h3>
                <p className="text-xs text-muted-foreground mb-4">
                    Revise os itens selecionados acima. Apenas os exercícios e técnicas marcados com o "check" verde serão incluídos no plano de tratamento final do paciente.
                </p>
                <div className="flex flex-wrap gap-3">
                    <Button
                        className="bg-gradient-primary text-white gap-2"
                        onClick={handleSalvar}
                        disabled={salvando || (totalExSelecionados === 0 && totalTecSelecionados === 0)}
                    >
                        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Aceitar e Salvar Diretriz ({totalExSelecionados + totalTecSelecionados} itens)
                    </Button>
                    <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
                        Descartar
                    </Button>
                </div>
            </div>
        </div>
    );
}
