import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import MyIDFormulaDisplay from './MyIDFormulaDisplay';
import MyIDDicasPessoais from './MyIDDicasPessoais';
import { shareMyIDResults } from '@/utils/whatsapp';
import { DIMENSION_LABELS, PerdaCalculada } from '@/utils/myid/lossTable';

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

function buildFingerprintRings(scores: any): FingerprintRing[] {
    if (!scores) return [];
    const normalized: Record<string, number> = {
        D: scores.D ?? scores.D_pain ?? 0,
        EFI: scores.EFI ?? scores.EFI_functionality ?? 0,
        P: scores.P ?? scores.P_psychological ?? 0,
        I: scores.I ?? scores.I_inertia ?? 0,
        R: scores.R ?? scores.R_regulation ?? 0,
        C: scores.C ?? scores.C_context ?? 0,
        AF: scores.AF ?? scores.AF_activity ?? 0,
        HID: scores.HID ?? scores.HID_hydration ?? 0,
        NUT: scores.NUT ?? scores.NUT_nutrition ?? 0,
        ERG: scores.ERG ?? scores.ERG_ergonomics ?? 0,
        N: scores.N ?? scores.N_noise ?? 0,
    };
    return getMyIDFingerprintData(normalized);
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

    return (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500 max-w-4xl mx-auto pb-10">
            <div className="text-center space-y-4 pt-8">
                <div className="inline-block px-4 py-1.5 bg-primary/10 text-primary font-bold rounded-full mb-2 tracking-wide text-sm">
                    PROCESSAMENTO CONCLUÍDO
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight">🎯 SEU RESULTADO MyID-100</h1>
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

            {/* Fingerprint */}
            <Card className="shadow-xl border-0 bg-card/80 backdrop-blur-sm">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-xl font-bold text-foreground">🔏 Sua Impressão Digital Sistêmica</CardTitle>
                    <CardDescription>Cada crista representa uma dimensão do seu perfil de saúde</CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-8">
                    <MyIDFingerprint
                        rings={buildFingerprintRings(component_scores)}
                        myidScore={myidScoreValue}
                        className="w-full"
                        hasRedFlags={red_flags_detected}
                    />
                </CardContent>
            </Card>

            {/* Dicas Personalizadas */}
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
                </CardContent>
            </Card>

            {/* Bio-alignment tips */}
            <Card className="bg-primary/5 border-primary/20 shadow-sm border-l-4 border-l-primary pt-2">
                <CardHeader className="pb-2">
                    <CardTitle className="text-primary text-xl font-bold flex items-center gap-2">
                        <span>🚀</span> DICAS PARA SEU BIO-ALINHAMENTO
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
                    <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                        <h4 className="font-bold text-primary flex items-center gap-2 mb-2"><span className="text-lg">🏥</span> SUA SAÚDE E SISTEMA:</h4>
                        <p className="text-foreground/70 text-sm leading-relaxed">
                            Seu Score MyID-100 é de <strong>{Math.round(myidScoreValue)}/100</strong>, o que reflete um padrão de dor <strong>{pain_pattern}</strong>.
                            {red_flags_detected ? ' Identificamos sinais que precisam de atenção profissional.' : ' Sem sinais de alerta imediatos.'}
                        </p>
                    </div>

                    <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                        <h4 className="font-bold text-accent-foreground flex items-center gap-2 mb-2"><span className="text-lg">🪑</span> SEU AMBIENTE:</h4>
                        <p className="text-foreground/70 text-sm leading-relaxed">
                            Ergonomia: <strong>{ERG.toFixed(1)}/10</strong>. Setup: <strong>{translateWorkspace(rawData.bloco_5h_workspace || 'atual')}</strong>.
                            {rawData.bloco_5h_sitting_continuous ? ` Você fica ${rawData.bloco_5h_sitting_continuous} min sentado(a) sem pausa.` : ''}
                        </p>
                    </div>

                    <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                        <h4 className="font-bold text-accent-foreground flex items-center gap-2 mb-2"><span className="text-lg">💪</span> MOVIMENTO:</h4>
                        <p className="text-foreground/70 text-sm leading-relaxed">
                            Atividade física: <strong>{AF.toFixed(1)}/10</strong>. Estilo: <strong>{translateLifestyle(rawData.bloco_5e_lifestyle || 'atual')}</strong>.
                            {rawData.bloco_5e_intensity !== 'none' ? ` Intensidade: ${translateIntensity(rawData.bloco_5e_intensity)}.` : ''}
                        </p>
                    </div>

                    <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                        <h4 className="font-bold text-accent-foreground flex items-center gap-2 mb-2"><span className="text-lg">🥗</span> NUTRIÇÃO E HIDRATAÇÃO:</h4>
                        <p className="text-foreground/70 text-sm leading-relaxed">
                            Nutrição: <strong>{NUT.toFixed(1)}/10</strong>. Hidratação: <strong>{HID.toFixed(1)}/10</strong>.
                            {rawData.bloco_5f_water_liters ? ` Consumo: ${rawData.bloco_5f_water_liters}L/dia.` : ''}
                        </p>
                    </div>

                    {hasWomenHealth && (
                        <div className="bg-card p-4 rounded-lg border border-border shadow-sm">
                            <h4 className="font-bold text-accent-foreground flex items-center gap-2 mb-2"><span className="text-lg">👩</span> SAÚDE FEMININA:</h4>
                            <p className="text-foreground/70 text-sm leading-relaxed">
                                Ciclo menstrual <strong>{rawData.bloco_6_cycle_affects_pain ? 'influencia' : 'tem pouca influência'}</strong> na dor.
                                Ruído sistêmico: <strong>{N.toFixed(1)}/10</strong>.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Footer */}
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
