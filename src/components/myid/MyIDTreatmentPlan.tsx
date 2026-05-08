import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wind, Brain, Activity, Sparkles, Calendar } from 'lucide-react';

interface PerdaItem {
    key: string;
    label: string;
    perda: number;
    score: number;
    isDriver: boolean;
    gatilho: boolean;
}

interface MyIDTreatmentPlanProps {
    drivers: PerdaItem[]; // top 3 perdas
    myidScore: number;
    redFlags: boolean;
}

// ─── Recomendações específicas por driver ───
const DRIVER_FOCUS: Record<string, { titulo: string; intervencoes: string[] }> = {
    D: {
        titulo: 'Modulação da dor',
        intervencoes: [
            'Fisioterapia ativa 2x/semana com terapia manual e exercício terapêutico',
            'Respiração 4-7-8 nos picos de dor (modula percepção dolorosa)',
            'Mindfulness para dor crônica: 10 min de body scan diário',
        ],
    },
    EFI: {
        titulo: 'Recuperação funcional',
        intervencoes: [
            'Exercícios graduais de força e mobilidade orientados',
            'Reintrodução progressiva de atividades do dia a dia',
            'Caminhada mindful 20 min/dia (movimento + atenção plena)',
        ],
    },
    P: {
        titulo: 'Reeducação do medo do movimento',
        intervencoes: [
            'Exposição gradual a movimentos temidos com segurança profissional',
            'Mindfulness de aceitação: observar a dor sem reagir com pânico',
            'Respiração coerente 5/5 antes de atividades que geram receio',
        ],
    },
    I: {
        titulo: 'Início imediato do tratamento',
        intervencoes: [
            'Agendar avaliação presencial nesta semana',
            'Estabelecer rotina de respiração diária (5 min, 2x ao dia)',
            'Registrar dor e gatilhos por 7 dias para o profissional',
        ],
    },
    R: {
        titulo: 'Regulação do sistema autônomo (sono + estresse)',
        intervencoes: [
            'Coerência cardíaca 5/5: 5 min ao acordar, 5 min antes de dormir',
            'Body scan guiado de 15 min antes de dormir (acalma o sistema nervoso)',
            'Higiene do sono: sem telas 1h antes de dormir, quarto escuro e fresco',
        ],
    },
    C: {
        titulo: 'Manejo do contexto e estresse',
        intervencoes: [
            'Respiração quadrada (box) 4-4-4-4 antes de situações estressantes',
            'Pausa mindful de 1 min a cada 2h (timer no celular)',
            'Identificar 1 fonte de estresse/semana para reduzir ou pedir apoio',
        ],
    },
    AF: {
        titulo: 'Movimento como remédio',
        intervencoes: [
            'Caminhada 20-30 min, 4-5x/semana (intensidade leve a moderada)',
            'Caminhada mindful 1x/semana (foco em respiração e passos)',
            'Quebra de sedentarismo: levantar e movimentar a cada 45 min',
        ],
    },
    HID: {
        titulo: 'Hidratação',
        intervencoes: [
            'Meta diária: 2-3 L de água (deixe garrafa visível)',
            'Lembretes a cada 1-2h via celular',
            'Reduzir álcool e bebidas açucaradas',
        ],
    },
    NUT: {
        titulo: 'Alimentação anti-inflamatória',
        intervencoes: [
            'Reduzir ultraprocessados, açúcar refinado e álcool',
            'Aumentar frutas, vegetais coloridos, proteína magra e ômega-3',
            'Comer com atenção plena (mindful eating): sem celular, devagar',
        ],
    },
    ERG: {
        titulo: 'Ergonomia e postura',
        intervencoes: [
            'Ajustar cadeira, mesa e altura da tela do trabalho',
            'Pausa de 2 min a cada 45 min sentado(a)',
            'Avaliar colchão e travesseiro se sono não é restaurador',
        ],
    },
    N: {
        titulo: 'Investigar ruído sistêmico',
        intervencoes: [
            'Comentar cirurgias prévias e questões viscerais com o terapeuta',
            'Considerar avaliação visceral/cicatricial complementar',
            'Respiração diafragmática profunda 5 min/dia (estimula vago)',
        ],
    },
};

export default function MyIDTreatmentPlan({ drivers, myidScore, redFlags }: MyIDTreatmentPlanProps) {
    if (redFlags) {
        return (
            <Card className="border-2 border-destructive/40 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="text-base font-bold text-destructive">Plano de tratamento suspenso</CardTitle>
                    <CardDescription className="text-xs">
                        Antes de iniciar qualquer plano, é necessária avaliação médica presencial pelos sinais de alerta detectados.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    // Foco baseado nos top 3 drivers
    const focusItems = drivers
        .map(d => ({ key: d.key, label: d.label, ...(DRIVER_FOCUS[d.key] || { titulo: d.label, intervencoes: [] }) }))
        .filter(f => f.intervencoes.length > 0);

    // Determina intensidade do plano
    const intensidade = myidScore < 50 ? 'alta' : myidScore < 70 ? 'moderada' : 'leve';
    const fases = [
        {
            num: 1,
            titulo: 'Estabilização',
            duracao: 'Semanas 1–2',
            descricao: 'Reduzir dor, ativar respiração diária e iniciar acompanhamento profissional.',
            cor: 'border-l-rose-400 bg-rose-50/50 dark:bg-rose-950/10',
            acoes: [
                'Iniciar fisioterapia/avaliação presencial',
                'Coerência cardíaca 5/5 — 5 min ao acordar e antes de dormir',
                'Diário simples de dor (0-10) e sono por 14 dias',
            ],
        },
        {
            num: 2,
            titulo: 'Ativação',
            duracao: 'Semanas 3–6',
            descricao: 'Reintroduzir movimento, somar mindfulness e ajustar hábitos críticos.',
            cor: 'border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/10',
            acoes: [
                'Exercícios prescritos pelo fisioterapeuta',
                'Body scan 10-15 min, 3-5x/semana',
                'Caminhada 20-30 min, 4x/semana',
                'Aplicar correções dos drivers principais (sono, hidratação, ergonomia, etc.)',
            ],
        },
        {
            num: 3,
            titulo: 'Consolidação',
            duracao: 'Semanas 7+',
            descricao: 'Manter ganhos, prevenir recaídas e refazer o MyID para medir evolução.',
            cor: 'border-l-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10',
            acoes: [
                'Treino de força e mobilidade 2-3x/semana',
                'Mindfulness/respiração integrados à rotina (mínimo 5 min/dia)',
                'Refazer MyID a cada 4-6 semanas para acompanhar evolução',
            ],
        },
    ];

    return (
        <Card className="border-l-4 border-l-primary shadow-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Plano de tratamento personalizado
                </CardTitle>
                <CardDescription className="text-xs">
                    Combina <span className="font-semibold">atividades, mindfulness e respiração</span> direcionados aos seus pontos críticos.
                    Intensidade sugerida: <Badge variant="outline" className="ml-1 text-[10px] h-4">{intensidade}</Badge>
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5">
                {/* ─── BLOCO 1: REGULAÇÃO AUTONÔMICA (sempre presente) ─── */}
                <div className="rounded-lg border border-sky-200 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/10 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Wind className="h-4 w-4 text-sky-600" />
                        <h4 className="font-semibold text-sm">Respiração — controle do sistema autônomo</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        O ritmo respiratório é a forma mais direta de regular o sistema nervoso autônomo. Reduz dor crônica, ansiedade e melhora o sono.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-2">
                        <div className="rounded-md bg-background border border-border/40 p-2.5">
                            <div className="text-xs font-semibold mb-0.5">Coerência cardíaca 5/5</div>
                            <p className="text-[11px] text-muted-foreground">Inspire 5s, expire 5s, por 5 min. <strong>3x ao dia</strong> (manhã, meio-dia, noite).</p>
                        </div>
                        <div className="rounded-md bg-background border border-border/40 p-2.5">
                            <div className="text-xs font-semibold mb-0.5">Respiração 4-7-8</div>
                            <p className="text-[11px] text-muted-foreground">Inspire 4s, segure 7s, expire 8s. Use em <strong>picos de dor ou ansiedade</strong>.</p>
                        </div>
                        <div className="rounded-md bg-background border border-border/40 p-2.5">
                            <div className="text-xs font-semibold mb-0.5">Box 4-4-4-4</div>
                            <p className="text-[11px] text-muted-foreground">Inspire/segure/expire/segure por 4s cada. Use <strong>antes de situações estressantes</strong>.</p>
                        </div>
                    </div>
                </div>

                {/* ─── BLOCO 2: MINDFULNESS ─── */}
                <div className="rounded-lg border border-violet-200 dark:border-violet-900/40 bg-violet-50/50 dark:bg-violet-950/10 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <Brain className="h-4 w-4 text-violet-600" />
                        <h4 className="font-semibold text-sm">Mindfulness — atenção plena para dor crônica</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Mindfulness ensina o cérebro a se relacionar com a dor sem amplificá-la. Evidência sólida para dor persistente, ansiedade e estresse.
                    </p>
                    <div className="grid sm:grid-cols-3 gap-2">
                        <div className="rounded-md bg-background border border-border/40 p-2.5">
                            <div className="text-xs font-semibold mb-0.5">Body scan</div>
                            <p className="text-[11px] text-muted-foreground">Escaneamento do corpo, 10-20 min, deitado(a). <strong>3-5x por semana</strong>.</p>
                        </div>
                        <div className="rounded-md bg-background border border-border/40 p-2.5">
                            <div className="text-xs font-semibold mb-0.5">Pausa consciente</div>
                            <p className="text-[11px] text-muted-foreground">A cada 2h: pare 1 min, respire e observe sensações <strong>sem julgar</strong>.</p>
                        </div>
                        <div className="rounded-md bg-background border border-border/40 p-2.5">
                            <div className="text-xs font-semibold mb-0.5">Caminhada mindful</div>
                            <p className="text-[11px] text-muted-foreground">10 min focando nos passos e respiração. Combina <strong>movimento + regulação</strong>.</p>
                        </div>
                    </div>
                </div>

                {/* ─── BLOCO 3: FOCO PERSONALIZADO ─── */}
                {focusItems.length > 0 && (
                    <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/10 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Activity className="h-4 w-4 text-emerald-600" />
                            <h4 className="font-semibold text-sm">Intervenções específicas para o seu caso</h4>
                        </div>
                        <div className="space-y-2.5">
                            {focusItems.map((f, idx) => (
                                <div key={f.key} className="rounded-md bg-background border border-border/40 p-3">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <Badge className="text-[10px] h-4 bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
                                            #{idx + 1} · {f.label}
                                        </Badge>
                                        <span className="text-xs font-semibold">{f.titulo}</span>
                                    </div>
                                    <ul className="space-y-1 ml-1">
                                        {f.intervencoes.map((act, i) => (
                                            <li key={i} className="text-[12px] text-foreground/80 flex gap-2">
                                                <span className="text-emerald-600 mt-0.5">•</span>
                                                <span>{act}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ─── BLOCO 4: FASES TEMPORAIS ─── */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Calendar className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold text-sm">Plano em 3 fases</h4>
                    </div>
                    {fases.map(fase => (
                        <div key={fase.num} className={`border-l-4 ${fase.cor} rounded-r-md p-3`}>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="font-bold text-sm">Fase {fase.num} · {fase.titulo}</span>
                                <Badge variant="outline" className="text-[10px] h-4">{fase.duracao}</Badge>
                            </div>
                            <p className="text-[12px] text-muted-foreground mb-2">{fase.descricao}</p>
                            <ul className="space-y-1">
                                {fase.acoes.map((a, i) => (
                                    <li key={i} className="text-[12px] text-foreground/80 flex gap-2">
                                        <span className="text-primary mt-0.5">→</span>
                                        <span>{a}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <p className="text-[11px] text-muted-foreground italic pt-1">
                    Este plano é uma sugestão baseada nos seus dados. Ajustes finais devem ser feitos com seu profissional de saúde.
                </p>
            </CardContent>
        </Card>
    );
}
