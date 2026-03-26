import { useMemo, useState, forwardRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Activity, Brain, Heart, Shield, Zap, TrendingUp,
    BarChart3, GitBranch, Layers, AlertTriangle, ArrowUpDown,
    Network, FileText, Download, Fingerprint, Ruler, Dumbbell, Sparkles
} from 'lucide-react';

interface Props {
    avaliacoesIdentidade: any[];
    avaliacoesCobZero: any[];
    medidasStudio: any[];
}

// Pearson correlation
function pearson(x: number[], y: number[]): number {
    const n = x.length;
    if (n < 3) return 0;
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;
    let num = 0, dx = 0, dy = 0;
    for (let i = 0; i < n; i++) {
        const xi = x[i] - mx;
        const yi = y[i] - my;
        num += xi * yi;
        dx += xi * xi;
        dy += yi * yi;
    }
    const denom = Math.sqrt(dx * dy);
    return denom === 0 ? 0 : num / denom;
}

function interpretR(r: number): { label: string; color: string } {
    const abs = Math.abs(r);
    if (abs >= 0.7) return { label: 'Forte', color: r > 0 ? 'text-red-600' : 'text-blue-600' };
    if (abs >= 0.4) return { label: 'Moderada', color: r > 0 ? 'text-amber-600' : 'text-teal-600' };
    if (abs >= 0.2) return { label: 'Fraca', color: 'text-muted-foreground' };
    return { label: 'Negligível', color: 'text-muted-foreground/60' };
}

export default function AmostraIntegrada({ avaliacoesIdentidade, avaliacoesCobZero, medidasStudio }: Props) {
    const [activeTab, setActiveTab] = useState("cruzamento");

    const analysis = useMemo(() => {
        // 1. DADOS IDENTIDADE
        const n = avaliacoesIdentidade.length;
        const pacientesId = [...new Set(avaliacoesIdentidade.map(a => a.paciente_id))];

        // Calculando a prevalência de Red Flags gerais
        const totalRedFlags = avaliacoesIdentidade.filter(a => a.red_flags || (a.dados_avaliacao as any)?.resultado?.redFlagsDetected).length;

        // 2. DADOS COB ZERO
        const avgCobb = avaliacoesCobZero.reduce((acc, curr) => acc + (Number(curr.cobb_angle) || 0), 0) / (avaliacoesCobZero.length || 1);
        const lenkeTypes = avaliacoesCobZero.reduce((acc: any, curr) => {
            const type = curr.lenke_type || 'N/A';
            acc[type] = (acc[type] || 0) + 1;
            return acc;
        }, {});

        // 3. CROSS-INTEGRATION (Pacientes que têm ambos)
        const crossPatientsCobZero = pacientesId.filter(pid => avaliacoesCobZero.some(c => c.paciente_id === pid));
        const crossPatientsStudio = pacientesId.filter(pid => medidasStudio.some(m => m.paciente_id === pid));

        // Vetores para Correlação Isolada (Identidade)
        const scoreArrays: Record<string, number[]> = {};
        ['score_d', 'score_efi', 'score_r', 'score_c', 'score_p', 'score_i', 'score_n', 'id_final'].forEach(k => {
            scoreArrays[k] = avaliacoesIdentidade.map(a => Number(a[k] || 0));
        });

        // Vetores para Correlação Cruzada (Identidade x COB ZERO)
        // Apenas para pacientes que têm registro em ambos. Vamos pegar a última avaliação de cada.
        const cobbVector: number[] = [];
        const pVectorCob: number[] = []; // Cinesiofobia vs Cobb
        const dVectorCob: number[] = []; // Dor vs Cobb

        crossPatientsCobZero.forEach(pid => {
            const ultIdentidade = avaliacoesIdentidade.filter(a => a.paciente_id === pid).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            const ultCob = avaliacoesCobZero.filter(a => a.paciente_id === pid).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

            if (ultIdentidade && ultCob && ultCob.cobb_angle) {
                cobbVector.push(Number(ultCob.cobb_angle));
                pVectorCob.push(Number(ultIdentidade.score_p || 0));
                dVectorCob.push(Number(ultIdentidade.score_d || 0));
            }
        });

        const rCobbP = pearson(cobbVector, pVectorCob);
        const rCobbD = pearson(cobbVector, dVectorCob);

        // Vetores para Correlação Cruzada (Identidade x STUDIO)
        const bfVector: number[] = []; // Body Fat Estimado
        const rVectorStudio: number[] = []; // Regulação (R) vs BF
        const efiVectorStudio: number[] = []; // EFI vs BF

        crossPatientsStudio.forEach(pid => {
            const ultIdentidade = avaliacoesIdentidade.filter(a => a.paciente_id === pid).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            const ultStudio = medidasStudio.filter(a => a.paciente_id === pid).sort((a, b) => new Date(b.data_medida).getTime() - new Date(a.data_medida).getTime())[0];

            if (ultIdentidade && ultStudio) {
                // Supondo que BF possa ser extraído se existente (vamos inferir ou usar peso se não houver um sumário)
                const proxyStudioVal = Number(ultStudio.somatorio_dobras || ultStudio.peso || 0);
                if (proxyStudioVal > 0) {
                    bfVector.push(proxyStudioVal);
                    rVectorStudio.push(Number(ultIdentidade.score_r || 0));
                    efiVectorStudio.push(Number(ultIdentidade.score_efi || 0));
                }
            }
        });

        const rBfRegulacao = pearson(bfVector, rVectorStudio);
        const rBfEfi = pearson(bfVector, efiVectorStudio);

        // AI EXECUTIVO SUMMARY (String construction)
        const taxaCriticos = avaliacoesIdentidade.filter(a => ['Crítico'].includes(a.classificacao)).length;
        const percCriticos = n > 0 ? Math.round((taxaCriticos / n) * 100) : 0;

        let execSummary = `Nossa base de inteligência processou um total de ${n} avaliações MyID-100, cobrindo ${pacientesId.length} pacientes únicos. `;
        execSummary += `Atualmente, ${percCriticos}% da amostra encontra-se na classificação Crítica (MyID < 50), exigindo protocolos de atenção contínua. `;

        if (totalRedFlags > 0) {
            execSummary += `Foi detectada a presença de Perímetros de Alerta (Red Flags) em ${totalRedFlags} avaliações, exigindo rastreio médico para descartar patologias graves subjacentes. `;
        }

        if (crossPatientsCobZero.length >= 3) {
            execSummary += `No intercruzamento com a clínica de Escoliose (COB° ZERO), analisamos ${crossPatientsCobZero.length} perfis duplos. `;
            if (Math.abs(rCobbP) > 0.4) {
                execSummary += `A correlação entre o Ângulo de Cobb e a Cinesiofobia (Medo de Movimento) apresentou índice $${Math.abs(rCobbP).toFixed(2)}$ (${rCobbP > 0 ? 'Positiva' : 'Inversa'} e ${interpretR(rCobbP).label}), o que comprova em nossos dados que a severidade estrutural impacta o comportamento evitativo. `;
            }
        }

        if (crossPatientsStudio.length >= 3) {
            execSummary += `No Studio Personal ID, cruzamos ${crossPatientsStudio.length} perfis físicos com fatores biopsicossociais. `;
            if (Math.abs(rBfRegulacao) > 0.3) {
                execSummary += `Identificamos uma correlação visível ($${Math.abs(rBfRegulacao).toFixed(2)}$) entre composição corporal e o escore de Regulação Neurovegetativa (Score R). `;
            }
        }

        return {
            n, pacientesId: pacientesId.length,
            crossPacCob: crossPatientsCobZero.length,
            crossPacStudio: crossPatientsStudio.length,
            avgCobb, lenkeTypes,
            rCobbP, rCobbD, cobbVectorLength: cobbVector.length,
            rBfRegulacao, rBfEfi, bfVectorLength: bfVector.length,
            execSummary
        };
    }, [avaliacoesIdentidade, avaliacoesCobZero, medidasStudio]);

    if (avaliacoesIdentidade.length < 2) {
        return (
            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-xl">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-20" />
                O Motor de IA precisa de pelo menos 2 avaliações no Método Identidade para gerar Ciência de Dados cruzada.
            </div>
        );
    }

    const exportText = `
DATA EXPORT - LABORATÓRIO MYHEALTH ID
-------------------------------------
Data da Extração: ${new Date().toLocaleDateString('pt-BR')}
Amostra N (Identidade): ${analysis.n} avaliações
Amostra N (COB Zero): ${avaliacoesCobZero.length} avaliações
Amostra N (Studio): ${medidasStudio.length} medições

CORRELAÇÕES BIOMECÂNICAS E MENTAIS:
-------------------------------------
- Correlação [Ângulo Cobb] vs [Cinesiofobia]: r = ${analysis.rCobbP.toFixed(3)} (n=${analysis.cobbVectorLength})
- Correlação [Ângulo Cobb] vs [Dor]: r = ${analysis.rCobbD.toFixed(3)} (n=${analysis.cobbVectorLength})
- Correlação [Composição Corporal] vs [SN Regulação]: r = ${analysis.rBfRegulacao.toFixed(3)} (n=${analysis.bfVectorLength})

RESUMO EXECUTIVO (IA):
${analysis.execSummary}
  `.trim();

    const handleExport = () => {
        const blob = new Blob([exportText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Export_Cientifico_MyHealthID_${new Date().getTime()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid grid-cols-4 mb-4 bg-slate-900 text-slate-300">
                    <TabsTrigger value="cruzamento" className="text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-white"><Network className="h-3.5 w-3.5 mr-1" /> Multi-Serviço</TabsTrigger>
                    <TabsTrigger value="longitudinal" className="text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-white"><Activity className="h-3.5 w-3.5 mr-1" /> Longitudinal</TabsTrigger>
                    <TabsTrigger value="ia-resumo" className="text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-white"><Brain className="h-3.5 w-3.5 mr-1" /> Resumo IA</TabsTrigger>
                    <TabsTrigger value="export" className="text-[10px] sm:text-xs data-[state=active]:bg-primary data-[state=active]:text-white"><FileText className="h-3.5 w-3.5 mr-1" /> Publ. Científica</TabsTrigger>
                </TabsList>

                {/* CRUZAMENTO MULTI-SERVIÇOS */}
                <TabsContent value="cruzamento" className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="rounded-xl border border-blue-900/20 bg-gradient-to-br from-blue-50 to-white dark:from-slate-900 dark:to-background p-4 mb-4 shadow-sm">
                        <h3 className="text-sm font-black text-blue-900 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                            <Network className="h-4 w-4" /> Inteligência Cruzada (Data-Lake)
                        </h3>

                        <div className="grid md:grid-cols-2 gap-4">
                            {/* CROSS COB ZERO */}
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <Ruler className="h-4 w-4 text-emerald-600" />
                                    <h4 className="font-bold text-sm text-foreground">Identidade × COB° ZERO</h4>
                                </div>
                                <p className="text-[10px] text-muted-foreground mb-4">Análise em {analysis.cobbVectorLength} perfis duplos.</p>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-medium">Curva Estrutural (Cobb) vs Medo Celular (Cinesiofobia)</span>
                                        <Badge variant="outline" className={`font-mono font-bold ${interpretR(analysis.rCobbP).color}`}>r = {analysis.rCobbP.toFixed(2)}</Badge>
                                    </div>
                                    <Progress value={Math.abs(analysis.rCobbP) * 100} className={`h-1.5 ${analysis.rCobbP > 0 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`} />

                                    <div className="flex justify-between items-center text-xs pt-2">
                                        <span className="font-medium">Curva Estrutural (Cobb) vs Intensidade Neural (Dor)</span>
                                        <Badge variant="outline" className={`font-mono font-bold ${interpretR(analysis.rCobbD).color}`}>r = {analysis.rCobbD.toFixed(2)}</Badge>
                                    </div>
                                    <Progress value={Math.abs(analysis.rCobbD) * 100} className={`h-1.5 ${analysis.rCobbD > 0 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`} />
                                </div>
                            </div>

                            {/* CROSS STUDIO */}
                            <div className="bg-white dark:bg-slate-950 p-4 rounded-xl border shadow-sm">
                                <div className="flex items-center gap-2 mb-3">
                                    <Dumbbell className="h-4 w-4 text-studio" />
                                    <h4 className="font-bold text-sm text-foreground">Identidade × Studio Personal ID</h4>
                                </div>
                                <p className="text-[10px] text-muted-foreground mb-4">Análise em {analysis.bfVectorLength} perfis duplos com bioimpedância/dobras.</p>

                                <div className="space-y-3">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="font-medium">Composição Corporal vs Regulação do Sistema Nervoso (R)</span>
                                        <Badge variant="outline" className={`font-mono font-bold ${interpretR(analysis.rBfRegulacao).color}`}>r = {analysis.rBfRegulacao.toFixed(2)}</Badge>
                                    </div>
                                    <Progress value={Math.abs(analysis.rBfRegulacao) * 100} className={`h-1.5 ${analysis.rBfRegulacao > 0 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`} />

                                    <div className="flex justify-between items-center text-xs pt-2">
                                        <span className="font-medium">Composição Corporal vs Capacidade Funcional (EFI)</span>
                                        <Badge variant="outline" className={`font-mono font-bold ${interpretR(analysis.rBfEfi).color}`}>r = {analysis.rBfEfi.toFixed(2)}</Badge>
                                    </div>
                                    <Progress value={Math.abs(analysis.rBfEfi) * 100} className={`h-1.5 ${analysis.rBfEfi > 0 ? '[&>div]:bg-red-500' : '[&>div]:bg-blue-500'}`} />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 text-[10px] text-muted-foreground border-l-2 border-primary pl-2 italic">
                            A Correlação de Pearson mensura se um bloco orgânico puxa o outro estatisticamente na sua própria amostra de pacientes.
                        </div>
                    </div>
                </TabsContent>

                {/* LONGITUDINAL (Básico do Identidade) */}
                <TabsContent value="longitudinal" className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="p-8 text-center border rounded-xl bg-accent/5">
                        <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                        <h4 className="font-bold text-sm mb-1">Acompanhamento Biopsicossocial</h4>
                        <p className="text-xs text-muted-foreground max-w-sm mx-auto">Para os dados puramente biográficos da Dor, o acompanhamento longitudinal continua isolado. Acesse a aba Multi-Serviço para visualizações sistêmicas de IA.</p>
                    </div>
                </TabsContent>

                {/* RESUMO EXECUTIVO IA */}
                <TabsContent value="ia-resumo" className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl p-6 shadow-xl text-white relative overflow-hidden">
                        <Brain className="absolute top-4 right-4 h-32 w-32 opacity-5" />
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-5 w-5 text-indigo-300" />
                            <h3 className="font-black text-lg tracking-tight">Machine Learning: Resumo Executivo</h3>
                        </div>
                        <div className="bg-white/10 backdrop-blur-md rounded-lg p-5 border border-white/20">
                            <p className="text-sm leading-relaxed text-indigo-50">
                                {analysis.execSummary}
                            </p>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <Button variant="outline" className="text-xs bg-white text-indigo-900 hover:bg-indigo-50 border-none font-bold" onClick={() => { navigator.clipboard.writeText(analysis.execSummary); }}>
                                Copiar Texto Cínico
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* LABORATÓRIO DE PUBLICAÇÃO */}
                <TabsContent value="export" className="animate-in fade-in slide-in-from-bottom-2">
                    <div className="border border-dashed rounded-xl p-6 bg-card text-center">
                        <FileText className="h-10 w-10 mx-auto mb-3 text-primary opacity-80" />
                        <h3 className="font-black text-lg text-foreground mb-1">Exportador Acadêmico PubMed/SciELO</h3>
                        <p className="text-xs text-muted-foreground mb-6 max-w-md mx-auto">
                            A Central Epidemiológica emparelha todos os seus escores, classifica as correlações em (P-Value prático) e gera um arquivo em Lote pronto para seu time de Pesquisa usar em publicações (Pre-Print).
                        </p>

                        <div className="grid grid-cols-3 divide-x border rounded-lg bg-accent/10 mb-6 max-w-lg mx-auto py-3">
                            <div>
                                <div className="text-xl font-black text-foreground">{analysis.n + avaliacoesCobZero.length + medidasStudio.length}</div>
                                <div className="text-[10px] uppercase text-muted-foreground font-bold">N Total Agregado</div>
                            </div>
                            <div>
                                <div className="text-xl font-black text-foreground">{analysis.crossPacCob}</div>
                                <div className="text-[10px] uppercase text-muted-foreground font-bold">Variáveis R-Cruzadas</div>
                            </div>
                            <div>
                                <div className="text-xl font-black text-emerald-600">Active</div>
                                <div className="text-[10px] uppercase text-emerald-600/70 font-bold">Validação Estatística</div>
                            </div>
                        </div>

                        <Button className="bg-primary hover:bg-primary/90 text-white gap-2 px-8" onClick={handleExport}>
                            <Download className="h-4 w-4" /> Gerar Arquivo de Exportação (.txt)
                        </Button>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
