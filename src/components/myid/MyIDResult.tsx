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

            {/* Formula Display with Score, Losses, Driver */}
            <MyIDFormulaDisplay
                scores={{ D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED }}
                myidScore={myidScoreValue}
                perdas={perdas_calculadas}
                driverPrimario={myid_100?.driver_primario}
                gatilhosCriticos={myid_100?.gatilhos_criticos_ativados || []}
                hasRedFlags={red_flags_detected}
            />

            {/* Onde você está perdendo pontos — breakdown concreto */}
            {(() => {
                const items = buildPerdasBreakdown(perdas_calculadas, myid_100?.driver_primario?.dimensao);
                if (items.length === 0) return null;
                const maxPerda = Math.max(...items.map(i => i.perda), 1);
                return (
                    <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                📉 Onde você está perdendo pontos
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Detalhamento por dimensão — quanto maior a barra, maior o impacto no seu MyID-100.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {items.map(item => (
                                <div key={item.key} className={`p-3 rounded-lg border ${item.isDriver ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}>
                                    <div className="flex items-start justify-between gap-2 mb-1.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-sm">{item.label}</span>
                                                {item.isDriver && <Badge className="text-[9px] h-4 bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">PRINCIPAL</Badge>}
                                                {item.gatilho && <Badge variant="destructive" className="text-[9px] h-4">CRÍTICO</Badge>}
                                            </div>
                                            {item.interpretacao && (
                                                <p className="text-xs text-muted-foreground mt-0.5">{item.interpretacao}</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-base font-black text-destructive">−{item.perda}</div>
                                            <div className="text-[10px] text-muted-foreground">pts</div>
                                        </div>
                                    </div>
                                    <Progress value={(item.perda / maxPerda) * 100} className="h-1.5" />
                                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                                        Score bruto: {item.score.toFixed(1)}/10
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                );
            })()}

            {/* Dicas Personalizadas (data-driven, específicas) */}
            <MyIDDicasPessoais scores={{ D, EFI, P, I, R, C, AF, HID, NUT, ERG, N, MED }} myidScore={myid_100 ?? MyID_score ?? 0} />

            {/* Hidden Factors */}
            <Card className="border-border shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                    <CardTitle className="text-foreground/80 flex items-center gap-2 text-lg">
                        <span>🔍</span> FATORES CONTEXTUAIS
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                    <div className="flex justify-between text-sm py-2 border-b border-border/50">
                        <span className="font-bold text-foreground/70">Padrão da Dor:</span>
                        <span className="font-mono bg-muted/50 px-3 py-0.5 rounded text-sm">{pain_pattern}</span>
                    </div>
                    <div className="flex justify-between text-sm py-2 border-b border-border/50">
                        <span className="font-bold text-foreground/70">Prognóstico:</span>
                        <span className="font-mono bg-muted/50 px-3 py-0.5 rounded text-sm">{healing_history?.prognosis || 'Normal'}</span>
                    </div>
                    {medications?.length > 0 && (
                        <div className="flex justify-between text-sm py-2 border-b border-border/50">
                            <span className="font-bold text-foreground/70">Medicações:</span>
                            <span className="font-mono bg-muted/50 px-3 py-0.5 rounded text-sm">{medications.join(', ')}</span>
                        </div>
                    )}
                    {rawData.bloco_5h_workspace && (
                        <div className="flex justify-between text-sm py-2 border-b border-border/50">
                            <span className="font-bold text-foreground/70">Ergonomia:</span>
                            <span className="text-sm">{translateWorkspace(rawData.bloco_5h_workspace)}{rawData.bloco_5h_sitting_continuous ? ` · ${rawData.bloco_5h_sitting_continuous}min sentado sem pausa` : ''}</span>
                        </div>
                    )}
                    {rawData.bloco_5e_lifestyle && (
                        <div className="flex justify-between text-sm py-2 border-b border-border/50">
                            <span className="font-bold text-foreground/70">Estilo de vida:</span>
                            <span className="text-sm">{translateLifestyle(rawData.bloco_5e_lifestyle)}{rawData.bloco_5e_intensity && rawData.bloco_5e_intensity !== 'none' ? ` · intensidade ${translateIntensity(rawData.bloco_5e_intensity)}` : ''}</span>
                        </div>
                    )}
                    {rawData.bloco_5f_water_liters && (
                        <div className="flex justify-between text-sm py-2 border-b border-border/50">
                            <span className="font-bold text-foreground/70">Hidratação:</span>
                            <span className="text-sm">{rawData.bloco_5f_water_liters}L/dia</span>
                        </div>
                    )}
                    {hasWomenHealth && (
                        <div className="flex justify-between text-sm py-2 border-b border-border/50">
                            <span className="font-bold text-foreground/70">Ciclo menstrual:</span>
                            <span className="text-sm">{rawData.bloco_6_cycle_affects_pain ? 'Influencia a dor' : 'Pouca influência na dor'}</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="bg-card p-6 rounded-xl border shadow-sm text-center space-y-4">
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
