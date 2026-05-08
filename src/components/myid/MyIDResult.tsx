import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import MyIDFormulaDisplay from './MyIDFormulaDisplay';
import MyIDDicasPessoais from './MyIDDicasPessoais';
import { shareMyIDResults } from '@/utils/whatsapp';
import { DIMENSION_LABELS, PerdaCalculada } from '@/utils/myid/lossTable';

// Linguagem simples: o que está ruim em cada dimensão
const PROBLEMA_SIMPLES: Record<string, (score: number) => string> = {
    D: (s) => s >= 7 ? 'Sua dor está intensa e atrapalhando o dia a dia.' : 'Você sente dor com frequência.',
    EFI: (s) => s >= 7 ? 'Você está com muita dificuldade nas atividades do dia a dia.' : 'Algumas atividades estão mais difíceis do que deveriam.',
    P: (s) => s >= 5 ? 'Medo de se mexer ou pensamentos negativos sobre a dor estão te travando.' : 'Há alguma insegurança em relação ao movimento.',
    I: (s) => s >= 2 ? 'A dor já está há tempo demais sem tratamento adequado.' : 'A dor é recente — bom momento para agir.',
    R: (s) => s >= 7 ? 'Seu corpo não está recuperando: sono ruim, cansaço e estresse altos.' : 'Sono, energia ou estresse estão desregulados.',
    C: (s) => s >= 6 ? 'Pressões do trabalho, família ou dinheiro estão pesando muito.' : 'O contexto de vida está sobrecarregando você.',
    AF: (s) => s >= 6 ? 'Você está muito parado(a) — isso piora a dor.' : 'Falta movimento no seu dia.',
    HID: (s) => 'Você está bebendo pouca água.',
    NUT: (s) => 'Sua alimentação pode estar inflamando o corpo.',
    ERG: (s) => s >= 6 ? 'Sua postura/posto de trabalho está agredindo o corpo todo dia.' : 'Pequenos ajustes de postura ajudariam muito.',
    N: (s) => 'Cicatrizes, cirurgias ou questões viscerais estão somando ruído ao sistema.',
};

// Linguagem simples: o que fazer
const ACAO_SIMPLES: Record<string, string> = {
    D: 'Procure um fisioterapeuta para tratar a dor de forma ativa, sem só remédio.',
    EFI: 'Comece a se mover dentro do que dá — atividades simples já contam.',
    P: 'Converse sobre seus medos com o profissional. Movimento seguro e gradual cura.',
    I: 'Não espere mais: quanto antes começar, mais rápido melhora.',
    R: 'Priorize o sono (7-8h), reduza telas à noite e busque relaxamento ativo.',
    C: 'Identifique 1 fonte de estresse para reduzir esta semana — peça apoio se precisar.',
    AF: 'Caminhe 20-30 min por dia, 4-5x na semana. É o remédio mais barato.',
    HID: 'Beba 2-3 litros de água por dia. Coloque uma garrafa visível.',
    NUT: 'Reduza ultraprocessados, açúcar e álcool. Aumente frutas, vegetais e proteína.',
    ERG: 'Ajuste cadeira/tela do trabalho e faça pausa de 2 min a cada 45 min sentado(a).',
    N: 'Comente cirurgias e questões viscerais com seu terapeuta — pode mudar a abordagem.',
};

interface MyIDResultProps {
    result: any;
    rawData?: any;
}

const translateWorkspace = (val: string) => {
    const map: Record<string, string> = { none: 'Nenhum / Improvisado', precarious: 'Precário', acceptable: 'Aceitável', good: 'Bom', excellent: 'Excelente' };
    return map[val] || val;
};
const translateLifestyle = (val: string) => {
    const map: Record<string, string> = { very_sedentary: 'Muito sedentário', sedentary: 'Sedentário', moderate: 'Moderado', active: 'Ativo', very_active: 'Muito ativo' };
    return map[val] || val;
};
const translateIntensity = (val: string) => {
    const map: Record<string, string> = { none: 'Nenhuma', light: 'Leve', moderate: 'Moderada', intense: 'Intensa', maximum: 'Máxima' };
    return map[val] || val;
};

interface PerdaItem {
    key: string;
    label: string;
    perda: number;
    score: number;
    interpretacao: string;
    gatilho: boolean;
    isDriver: boolean;
}

function buildPerdasBreakdown(perdas: Record<string, PerdaCalculada> | undefined, driverDim?: string): PerdaItem[] {
    if (!perdas) return [];
    return Object.entries(perdas)
        .filter(([key, p]) => key !== 'MED' && (p?.perda_pontos ?? 0) > 0)
        .map(([key, p]) => ({
            key,
            label: DIMENSION_LABELS[key] || key,
            perda: p.perda_pontos,
            score: p.score_bruto,
            interpretacao: p.interpretacao || '',
            gatilho: !!p.gatilho_critico,
            isDriver: key === driverDim,
        }))
        .sort((a, b) => b.perda - a.perda);
}

export function MyIDResult({ result, rawData = {} }: MyIDResultProps) {
    if (!result) return null;

    const {
        MyID_score,
        myid_100,
        component_scores,
        perdas_calculadas,
        red_flags_detected,
        pain_pattern,
        medications,
        healing_history,
    } = result;

    const scores = component_scores || {};
    const D = scores.D ?? scores.D_pain ?? 0;
    const EFI = scores.EFI ?? scores.EFI_functionality ?? 0;
    const P = scores.P ?? scores.P_psychological ?? 0;
    const I = scores.I ?? scores.I_inertia ?? 0;
    const R = scores.R ?? scores.R_regulation ?? 0;
    const C = scores.C ?? scores.C_context ?? 0;
    const AF = scores.AF ?? scores.AF_activity ?? 0;
    const HID = scores.HID ?? scores.HID_hydration ?? 0;
    const NUT = scores.NUT ?? scores.NUT_nutrition ?? 0;
    const ERG = scores.ERG ?? scores.ERG_ergonomics ?? 0;
    const N = scores.N ?? scores.N_noise ?? 0;
    const MED = scores.MED ?? scores.MED_penalty ?? 0;

    const myidScoreValue = MyID_score ?? 0;
    const hasWomenHealth = rawData.bloco_6_cycle_regularity || rawData.bloco_6_endometriosis || rawData.bloco_6_pcos;

    // Constrói itens ordenados por impacto (mesma fonte do breakdown)
    const perdasItems = buildPerdasBreakdown(perdas_calculadas, myid_100?.driver_primario?.dimensao);
    const top3Ruim = perdasItems.slice(0, 3);
    const top3Melhorar = perdasItems.slice(0, 3);

    // Status simples
    const statusInfo = (() => {
        const v = myidScoreValue;
        if (v >= 85) return { emoji: '🟢', titulo: 'Você está bem!', cor: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/20', borda: 'border-emerald-300', frase: 'Seu corpo e estilo de vida estão em equilíbrio. Mantenha o que está fazendo.' };
        if (v >= 70) return { emoji: '🟡', titulo: 'Está bom, mas dá pra melhorar', cor: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20', borda: 'border-amber-300', frase: 'Você tem alguns pontos de atenção. Pequenos ajustes vão fazer grande diferença.' };
        if (v >= 50) return { emoji: '🟠', titulo: 'Atenção: seu sistema está sobrecarregado', cor: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/20', borda: 'border-orange-300', frase: 'Vários fatores estão somando contra você. Hora de agir com apoio profissional.' };
        return { emoji: '🔴', titulo: 'Situação crítica — busque ajuda', cor: 'text-destructive', bg: 'bg-destructive/10', borda: 'border-destructive/40', frase: 'Seu corpo está pedindo socorro. Procure acompanhamento profissional o quanto antes.' };
    })();

    return (
        <div className="space-y-6 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto pb-10">
            <div className="text-center pt-6">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Seu resultado MyID</h1>
                <p className="text-sm text-muted-foreground mt-1">Em linguagem simples — o que está bem, o que precisa melhorar.</p>
            </div>

            {/* Red Flags Warning */}
            {red_flags_detected && (
                <Card className="border-2 border-destructive bg-destructive/10">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">🚨</span>
                            <div>
                                <h3 className="text-lg font-black text-destructive">SINAIS DE ALERTA DETECTADOS</h3>
                                <p className="text-sm text-destructive/80 mt-1">
                                    Procure um profissional de saúde para avaliação complementar imediata.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ───── BIG SCORE + STATUS EM LINGUAGEM SIMPLES ───── */}
            <Card className={`border-2 ${statusInfo.borda} ${statusInfo.bg} shadow-sm`}>
                <CardContent className="p-6 sm:p-8 text-center space-y-3">
                    <div className="text-5xl">{statusInfo.emoji}</div>
                    <div>
                        <div className={`text-6xl sm:text-7xl font-black ${statusInfo.cor} leading-none`}>
                            {Math.round(myidScoreValue)}
                            <span className="text-2xl text-muted-foreground font-bold">/100</span>
                        </div>
                        <div className={`text-base sm:text-lg font-bold mt-2 ${statusInfo.cor}`}>{statusInfo.titulo}</div>
                    </div>
                    <p className="text-sm text-foreground/80 max-w-md mx-auto">{statusInfo.frase}</p>
                </CardContent>
            </Card>

            {/* ───── O QUE ESTÁ RUIM ───── */}
            {top3Ruim.length > 0 && (
                <Card className="border-l-4 border-l-destructive shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-destructive" />
                            O que está pesando contra você
                        </CardTitle>
                        <CardDescription className="text-xs">Os 3 fatores que mais estão afetando seu bem-estar agora.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {top3Ruim.map((item, idx) => {
                            const frase = PROBLEMA_SIMPLES[item.key]?.(item.score) || item.interpretacao || `${item.label} precisa de atenção.`;
                            return (
                                <div key={item.key} className="flex gap-3 items-start p-3 rounded-lg bg-destructive/5 border border-destructive/15">
                                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-destructive text-destructive-foreground font-bold text-sm flex items-center justify-center">
                                        {idx + 1}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                            <span className="font-semibold text-sm">{item.label}</span>
                                            {item.gatilho && <Badge variant="destructive" className="text-[9px] h-4">URGENTE</Badge>}
                                        </div>
                                        <p className="text-sm text-foreground/80">{frase}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* ───── O QUE FAZER PARA MELHORAR ───── */}
            {top3Melhorar.length > 0 && (
                <Card className="border-l-4 border-l-emerald-500 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                            O que fazer para melhorar
                        </CardTitle>
                        <CardDescription className="text-xs">Ações práticas, na ordem de maior impacto.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {top3Melhorar.map((item, idx) => {
                            const acao = ACAO_SIMPLES[item.key] || 'Converse com seu profissional sobre como abordar este ponto.';
                            return (
                                <div key={item.key} className="flex gap-3 items-start p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide mb-0.5">
                                            Ação {idx + 1} · {item.label}
                                        </div>
                                        <p className="text-sm text-foreground">{acao}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </CardContent>
                </Card>
            )}

            {/* ───── DETALHES TÉCNICOS (colapsável) ───── */}
            <DetalhesTecnicos
                scores={{ D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED }}
                myidScoreValue={myidScoreValue}
                perdas_calculadas={perdas_calculadas}
                myid_100={myid_100}
                red_flags_detected={red_flags_detected}
            />

            {/* Bloco técnico (breakdown, dicas detalhadas, fatores contextuais) já está dentro de DetalhesTecnicos abaixo */}
                <h3 className="font-bold text-xl text-foreground">🎊 OBRIGADO POR PARTICIPAR!</h3>
                <p className="text-muted-foreground">
                    Você acabou de criar sua "impressão digital sistêmica" COMPLETA e PRECISA.
                </p>
                <div className="pt-4 flex flex-wrap justify-center gap-3">
                    <button className="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground font-medium rounded-md text-sm transition-colors">
                        Baixar PDF
                    </button>
                    <button
                        onClick={() => shareMyIDResults(result.paciente_nome || 'Paciente', '5511999999999', result)}
                        className="px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary font-bold rounded-md text-sm transition-colors"
                    >
                        Compartilhar com Médico
                    </button>
                    <button className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 font-bold rounded-md text-sm transition-colors">
                        Agendar com Profissional
                    </button>
                </div>
                <p className="text-xs text-muted-foreground/50 font-mono mt-4">
                    Data: {new Date().toLocaleDateString()} | ID: {result.session_id || 'LOCAL'} | Versão: MyID-100 v2.0
                </p>
            </div>
        </div>
    );
}
