import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Printer, Download, X, Activity, Fingerprint, Heart, Brain,
    Dumbbell, AlertTriangle, CheckCircle2, BookOpen, Stethoscope,
    Clock, Target, TrendingUp, Shield,
} from 'lucide-react';
import { StructuralAssessmentData, UNIT_CONFIGS, classifyScore, classifyScoreColor } from '@/types/structural';

interface TreatmentReportProps {
    pacienteNome: string;
    pacienteIdade?: number;
    terapeutaNome: string;
    dataAvaliacao: string;
    myidResult?: any;
    structuralData?: StructuralAssessmentData | null;
    diretrizTexto?: string;
    onClose: () => void;
}

export default function TreatmentReportPDF({
    pacienteNome, pacienteIdade, terapeutaNome, dataAvaliacao,
    myidResult, structuralData, diretrizTexto, onClose,
}: TreatmentReportProps) {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const content = printRef.current;
        if (!content) return;
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(`
      <!DOCTYPE html><html><head><title>Relatório de Tratamento — ${pacienteNome}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; color: #1a1a2e; background: white; }
        @page { margin: 15mm; size: A4; }
        .page { page-break-after: always; padding: 0; }
        .page:last-child { page-break-after: auto; }
        .cover { display: flex; flex-direction: column; justify-content: center; align-items: center; min-height: 90vh; text-align: center; }
        .cover-logo { font-size: 48px; font-weight: 900; color: #16697a; margin-bottom: 8px; }
        .cover-sub { font-size: 14px; color: #888; letter-spacing: 2px; text-transform: uppercase; }
        .cover-patient { margin-top: 60px; }
        .cover-patient h2 { font-size: 32px; font-weight: 800; color: #1a1a2e; }
        .cover-patient p { font-size: 14px; color: #666; margin-top: 8px; }
        .cover-footer { margin-top: auto; padding-top: 40px; font-size: 11px; color: #999; }
        h1 { font-size: 22px; font-weight: 900; color: #16697a; border-bottom: 3px solid #16697a; padding-bottom: 8px; margin-bottom: 16px; }
        h2 { font-size: 16px; font-weight: 800; color: #1a1a2e; margin: 20px 0 10px; }
        h3 { font-size: 13px; font-weight: 700; color: #444; margin: 12px 0 6px; }
        p, li { font-size: 11.5px; line-height: 1.6; color: #333; }
        ul { padding-left: 18px; }
        li { margin-bottom: 3px; }
        .section { margin-bottom: 20px; }
        .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-bottom: 12px; background: #fafbfc; }
        .card-accent { border-left: 4px solid #16697a; }
        .card-warn { border-left: 4px solid #f59e0b; background: #fffbeb; }
        .card-green { border-left: 4px solid #10b981; background: #ecfdf5; }
        .card-blue { border-left: 4px solid #3b82f6; background: #eff6ff; }
        .score-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
        .score-item { text-align: center; padding: 8px; border-radius: 8px; background: white; border: 1px solid #e5e7eb; }
        .score-label { font-size: 9px; color: #888; text-transform: uppercase; font-weight: 700; }
        .score-value { font-size: 20px; font-weight: 900; }
        .score-low { color: #10b981; }
        .score-mid { color: #f59e0b; }
        .score-high { color: #ef4444; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .badge-green { background: #d1fae5; color: #065f46; }
        .badge-amber { background: #fef3c7; color: #92400e; }
        .badge-red { background: #fee2e2; color: #991b1b; }
        .flex { display: flex; gap: 8px; align-items: center; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .tip-card { padding: 10px; border-radius: 8px; background: #f0fdf4; border: 1px solid #bbf7d0; margin-bottom: 8px; }
        .tip-card h4 { font-size: 12px; font-weight: 700; color: #166534; margin-bottom: 4px; }
        .tip-card p { font-size: 10.5px; color: #15803d; }
        .phase-header { background: #16697a; color: white; padding: 8px 14px; border-radius: 8px 8px 0 0; font-size: 13px; font-weight: 800; }
        .phase-body { border: 1px solid #e5e7eb; border-top: 0; border-radius: 0 0 8px 8px; padding: 12px; }
        .technique { padding: 6px 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 4px; border: 1px solid #e2e8f0; font-size: 10.5px; }
        .therapist-section { background: #fef3c7; border: 2px dashed #f59e0b; border-radius: 10px; padding: 16px; margin-top: 16px; }
        .therapist-section h2 { color: #92400e; }
        .watermark { position: fixed; bottom: 10px; right: 15px; font-size: 9px; color: #ccc; }
        @media print { .no-print { display: none !important; } }
      </style></head><body>
      ${content.innerHTML}
      <div class="watermark">MY HEALTH ID</div>
      </body></html>
    `);
        printWindow.document.close();
        setTimeout(() => { printWindow.print(); }, 500);
    };

    const myid = myidResult;
    const str = structuralData;
    const scoreClass = (v: number) => v >= 7 ? 'score-high' : v >= 4 ? 'score-mid' : 'score-low';
    const badgeClass = (v: number) => v >= 7 ? 'badge-red' : v >= 4 ? 'badge-amber' : 'badge-green';

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-8">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full mx-4 relative">
                {/* Toolbar */}
                <div className="sticky top-0 bg-white z-10 flex items-center justify-between p-4 border-b rounded-t-2xl no-print">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <h2 className="font-bold text-lg">Relatório de Tratamento</h2>
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handlePrint} className="gap-2 bg-primary hover:bg-primary/90 text-white">
                            <Printer className="h-4 w-4" /> Imprimir / Salvar PDF
                        </Button>
                        <Button variant="ghost" size="sm" onClick={onClose}><X className="h-4 w-4" /></Button>
                    </div>
                </div>

                {/* Printable Content */}
                <div ref={printRef} className="p-8">
                    {/* ══ PAGE 1: COVER ══ */}
                    <div className="page">
                        <div className="cover">
                            <div className="cover-logo">MY HEALTH ID</div>
                            <div className="cover-sub">Relatório de Tratamento</div>
                            <div className="cover-patient">
                                <h2>{pacienteNome}</h2>
                                <p>{pacienteIdade ? `${pacienteIdade} anos · ` : ''}Data: {dataAvaliacao}</p>
                                <p style={{ marginTop: '8px', fontSize: '12px', color: '#888' }}>
                                    Profissional: {terapeutaNome}
                                </p>
                            </div>
                            <div style={{ marginTop: '40px' }}>
                                {myid && (
                                    <div style={{ display: 'inline-block', padding: '12px 32px', borderRadius: '12px', background: '#f0f9ff', border: '2px solid #16697a' }}>
                                        <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>MyID SCORE</div>
                                        <div style={{ fontSize: '36px', fontWeight: 900, color: '#16697a' }}>{myid.myidScore?.toFixed(1) || '—'}</div>
                                        <div className={`badge ${badgeClass(myid.myidScore || 0)}`}>{myid.classificacao || myid.myidStatus || 'N/A'}</div>
                                    </div>
                                )}
                                {str && (
                                    <div style={{ display: 'inline-block', padding: '12px 32px', borderRadius: '12px', background: '#fef3c7', border: '2px solid #f59e0b', marginLeft: '16px' }}>
                                        <div style={{ fontSize: '11px', color: '#888', fontWeight: 700 }}>SCORE ESTRUTURAL</div>
                                        <div style={{ fontSize: '36px', fontWeight: 900, color: '#92400e' }}>{str.scoreStructuralGeneral?.toFixed(1) || '—'}</div>
                                        <div className={`badge ${badgeClass(str.scoreStructuralGeneral || 0)}`}>{str.classification || 'N/A'}</div>
                                    </div>
                                )}
                            </div>
                            <div className="cover-footer">
                                <p>Este relatório é confidencial e destinado exclusivamente ao paciente e profissional de saúde responsável.</p>
                            </div>
                        </div>
                    </div>

                    {/* ══ PAGE 2: MyID RESULTS ══ */}
                    {myid && (
                        <div className="page">
                            <h1>📊 Sua Impressão Digital Sistêmica (MyID)</h1>
                            <div className="card card-accent">
                                <p>O <strong>MyID</strong> é um mapeamento personalizado que analisa como seu corpo responde às demandas do dia a dia. Ele mede o equilíbrio entre seus <strong>Fatores de Demanda</strong> (o que sobrecarrega) e <strong>Fatores de Suporte</strong> (o que sustenta).</p>
                            </div>

                            <h2>Seus Scores</h2>
                            <div className="score-grid">
                                {[
                                    { key: 'D', label: 'Dor', desc: 'Intensidade' },
                                    { key: 'EFI', label: 'Funcional', desc: 'Capacidade' },
                                    { key: 'P', label: 'Psicossocial', desc: 'Crenças' },
                                    { key: 'I', label: 'Inércia', desc: 'Gatilhos' },
                                    { key: 'R', label: 'Regulação', desc: 'Neuro' },
                                    { key: 'C', label: 'Comportamento', desc: 'Hábitos' },
                                    { key: 'N', label: 'Ruído', desc: 'Sistêmico' },
                                    { key: 'AF', label: 'Ativ. Física', desc: 'Exercício' },
                                ].map(item => {
                                    const val = myid.componentScores?.[item.key] ?? myid[item.key] ?? 0;
                                    return (
                                        <div className="score-item" key={item.key}>
                                            <div className="score-label">{item.label}</div>
                                            <div className={`score-value ${scoreClass(val)}`}>{typeof val === 'number' ? val.toFixed(1) : val}</div>
                                            <div className="score-label">{item.desc}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {myid.redFlagsDetected && (
                                <div className="card card-warn">
                                    <h3>⚠️ Sinais de Alerta (Red Flags)</h3>
                                    <p>Foram detectados sinais que requerem atenção médica. Converse com seu profissional sobre:</p>
                                    <ul>
                                        {(myid.redFlagAlerts || []).map((alert: string, i: number) => <li key={i}>{alert}</li>)}
                                    </ul>
                                </div>
                            )}

                            <h2>O que isso significa?</h2>
                            <div className="two-col">
                                <div className="card">
                                    <h3>🔴 Demanda (Numerador)</h3>
                                    <p>Representa o que <strong>sobrecarrega</strong> seu sistema: dor, estresse, medo de movimento, maus hábitos. Quanto <strong>maior</strong>, mais demanda seu corpo enfrenta.</p>
                                </div>
                                <div className="card">
                                    <h3>🟢 Suporte (Denominador)</h3>
                                    <p>Representa o que <strong>sustenta</strong> seu sistema: qualidade do sono, atividade física, nutrição, ergonomia. Quanto <strong>maior</strong>, mais capacidade de recuperação.</p>
                                </div>
                            </div>

                            <div className="card card-green">
                                <h3>💡 Por que isso importa?</h3>
                                <p>Quando a demanda supera o suporte por muito tempo, o corpo perde a capacidade de se auto-regular — gerando dor crônica, fadiga e disfunções. O tratamento visa <strong>reduzir a demanda</strong> e <strong>aumentar o suporte</strong> de forma personalizada para o seu perfil.</p>
                            </div>
                        </div>
                    )}

                    {/* ══ PAGE 3: STRUCTURAL RESULTS ══ */}
                    {str && (
                        <div className="page">
                            <h1>🦴 Avaliação Estrutural — Unidades Funcionais</h1>
                            <div className="card card-accent">
                                <p>A avaliação estrutural analisa <strong>8 unidades funcionais</strong> do seu corpo para identificar áreas de comprometimento e sua interconexão. Cada unidade recebe uma nota de 0 a 10.</p>
                            </div>

                            <h2>Scores por Unidade</h2>
                            <div className="score-grid">
                                {UNIT_CONFIGS.map(cfg => {
                                    const unit = str.units?.[cfg.id];
                                    if (!unit) return null;
                                    return (
                                        <div className="score-item" key={cfg.id}>
                                            <div className="score-label">{cfg.emoji} {cfg.name}</div>
                                            <div className={`score-value ${scoreClass(unit.score)}`}>{unit.score.toFixed(1)}</div>
                                            <div className="score-label">{classifyScore(unit.score)}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {str.primaryDriver && (
                                <div className="card card-warn">
                                    <h3>⚠️ Driver Primário: {UNIT_CONFIGS.find(c => c.id === str.primaryDriver)?.name || str.primaryDriver}</h3>
                                    <p>Esta é a unidade funcional com maior comprometimento e que mais influencia as demais. O tratamento priorizará esta área.</p>
                                </div>
                            )}

                            {str.clinicalPriorities && str.clinicalPriorities.length > 0 && (
                                <div className="section">
                                    <h2>Prioridades Clínicas</h2>
                                    {str.clinicalPriorities.slice(0, 4).map((cp: any, i: number) => (
                                        <div className="technique" key={i}>
                                            <strong>{i + 1}. {UNIT_CONFIGS.find(c => c.id === cp.unitId)?.name || cp.unitId}</strong>
                                            {' — '}{cp.action} ({cp.duration})
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="card card-green">
                                <h3>💡 O que são conexões funcionais?</h3>
                                <p>Seu corpo funciona como um sistema integrado. Quando uma unidade está comprometida, ela pode afetar outras. O mapa de conexões mostra essas relações — e por isso tratamos o corpo como um <strong>todo</strong>, não apenas o local da dor.</p>
                            </div>
                        </div>
                    )}

                    {/* ══ PAGE 4: TREATMENT PLAN ══ */}
                    <div className="page">
                        <h1>📋 Seu Plano de Tratamento</h1>
                        <div className="card card-accent">
                            <p>Com base nos resultados das suas avaliações, elaboramos um programa de tratamento personalizado dividido em <strong>3 fases</strong>. Cada fase tem objetivos específicos e progride conforme sua evolução.</p>
                        </div>

                        {/* Phase 1 */}
                        <div style={{ marginBottom: '16px' }}>
                            <div className="phase-header">🔴 FASE 1 — Aguda (Semanas 1-3)</div>
                            <div className="phase-body">
                                <p><strong>Objetivo:</strong> Reduzir dor, restaurar mobilidade básica e estabilizar o sistema.</p>
                                <p><strong>Frequência:</strong> 2-3x por semana</p>
                                <h3>O que será feito:</h3>
                                <ul>
                                    <li>Técnicas manuais para alívio de dor e tensão muscular</li>
                                    <li>Mobilização articular gradual</li>
                                    <li>Exercícios respiratórios para regulação do sistema nervoso</li>
                                    <li>Educação sobre dor e movimento seguro</li>
                                </ul>
                            </div>
                        </div>

                        {/* Phase 2 */}
                        <div style={{ marginBottom: '16px' }}>
                            <div className="phase-header" style={{ background: '#f59e0b' }}>🟡 FASE 2 — Subaguda (Semanas 4-8)</div>
                            <div className="phase-body">
                                <p><strong>Objetivo:</strong> Fortalecer, recondicionar e ampliar capacidade funcional.</p>
                                <p><strong>Frequência:</strong> 2x por semana</p>
                                <h3>O que será feito:</h3>
                                <ul>
                                    <li>Exercícios de fortalecimento progressivo</li>
                                    <li>Treinamento de estabilidade e controle motor</li>
                                    <li>Reeducação postural dinâmica</li>
                                    <li>Ajuste de hábitos ergonômicos e posturais</li>
                                </ul>
                            </div>
                        </div>

                        {/* Phase 3 */}
                        <div style={{ marginBottom: '16px' }}>
                            <div className="phase-header" style={{ background: '#10b981' }}>🟢 FASE 3 — Manutenção (Semanas 9-12)</div>
                            <div className="phase-body">
                                <p><strong>Objetivo:</strong> Consolidar ganhos, prevenir recorrências e promover autonomia.</p>
                                <p><strong>Frequência:</strong> 1x por semana → reavaliação</p>
                                <h3>O que será feito:</h3>
                                <ul>
                                    <li>Progressão de exercícios para independência total</li>
                                    <li>Programa de exercícios domiciliares (HEP)</li>
                                    <li>Estratégias de autogerenciamento</li>
                                    <li>Reavaliação completa de escores</li>
                                </ul>
                            </div>
                        </div>

                        <div className="card card-green">
                            <h3>✅ Importância do tratamento contínuo</h3>
                            <p>Pesquisas mostram que pacientes que completam as 3 fases do tratamento têm <strong>80% menos recorrência</strong> de dor nos 12 meses seguintes. A constância é mais importante que a intensidade!</p>
                        </div>
                    </div>

                    {/* ══ PAGE 5: PATIENT EXERCISES & TIPS ══ */}
                    <div className="page">
                        <h1>🏋️ Exercícios, Dicas e Cuidados</h1>
                        <div className="card card-accent">
                            <p>Estas são orientações personalizadas para você seguir entre as sessões. Elas aceleram sua recuperação e aumentam seus <strong>Fatores de Suporte</strong>.</p>
                        </div>

                        <h2>🧘 Exercícios Respiratórios</h2>
                        <div className="tip-card">
                            <h4>Respiração 4-7-8</h4>
                            <p>Inspire por 4 segundos, segure por 7 segundos, expire por 8 segundos. Faça 3 ciclos, 2x ao dia. Ajuda a regular o sistema nervoso e reduzir a percepção de dor.</p>
                        </div>
                        <div className="tip-card">
                            <h4>Respiração Diafragmática</h4>
                            <p>Deite de barriga para cima, mãos no abdômen. Inspire expandindo o abdômen (não o peito). Expire lentamente. 5 minutos pela manhã e à noite.</p>
                        </div>

                        <h2>🚶 Movimento Diário</h2>
                        <div className="tip-card">
                            <h4>Caminhada Consciente</h4>
                            <p>20-30 minutos de caminhada leve diária. Mantenha postura ereta e passos regulares. Evite terrenos irregulares na fase aguda.</p>
                        </div>
                        <div className="tip-card">
                            <h4>Mobilidade Matinal</h4>
                            <p>Ao acordar: 5 min de movimentos suaves — rotação de ombros, flexão/extensão de coluna, círculos de tornozelo. Prepare o corpo para o dia.</p>
                        </div>

                        <h2>😴 Sono e Recuperação</h2>
                        <div className="tip-card">
                            <h4>Higiene do Sono</h4>
                            <p>Durma 7-9 horas. Evite telas 1h antes de dormir. Mantenha quarto escuro e fresco. O sono é quando seu corpo mais se recupera.</p>
                        </div>

                        <h2>🪑 Ergonomia</h2>
                        <div className="tip-card">
                            <h4>Regra 30-30-30</h4>
                            <p>A cada 30 minutos sentado, levante-se por 30 segundos e olhe para algo a 30 metros de distância. Previne rigidez e fadiga visual.</p>
                        </div>
                        <div className="tip-card">
                            <h4>Postura no Trabalho</h4>
                            <p>Monitor na altura dos olhos, pés apoiados no chão, cotovelos a 90°. Use apoio lombar se necessário.</p>
                        </div>

                        <h2>🥗 Nutrição Anti-inflamatória</h2>
                        <div className="tip-card">
                            <h4>Hidratação</h4>
                            <p>Beba no mínimo 2L de água/dia. A desidratação aumenta a sensibilidade à dor e reduz a elasticidade dos tecidos.</p>
                        </div>
                        <div className="tip-card">
                            <h4>Alimentos Anti-inflamatórios</h4>
                            <p>Priorize: peixes (ômega-3), frutas vermelhas, vegetais verde-escuros, gengibre, cúrcuma, azeite extra-virgem. Evite ultraprocessados e excesso de açúcar.</p>
                        </div>
                    </div>

                    {/* ══ PAGE 6: THERAPIST AREA ══ */}
                    <div className="page">
                        <div className="therapist-section">
                            <h1 style={{ color: '#92400e', borderColor: '#f59e0b' }}>🩺 Área do Profissional — Notas Técnicas</h1>
                            <p style={{ fontSize: '10px', color: '#92400e', marginBottom: '16px' }}>
                                Esta seção é destinada exclusivamente ao fisioterapeuta para referência clínica rápida.
                            </p>

                            {myid && (
                                <div style={{ marginBottom: '16px' }}>
                                    <h2 style={{ color: '#92400e' }}>MyID — Resumo Clínico</h2>
                                    <div className="score-grid">
                                        {['D', 'EFI', 'P', 'I', 'R', 'C', 'N'].map(key => {
                                            const val = myid.componentScores?.[key] ?? myid[key] ?? 0;
                                            return (
                                                <div className="score-item" key={key} style={{ background: '#fffbeb' }}>
                                                    <div className="score-label">{key}</div>
                                                    <div className={`score-value ${scoreClass(val)}`}>{typeof val === 'number' ? val.toFixed(1) : val}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p>MyID Score: <strong>{myid.myidScore?.toFixed(1)}</strong> · {myid.classificacao || myid.myidStatus}</p>
                                    {myid.redFlagsDetected && <p style={{ color: '#dc2626' }}>⚠️ Red Flags: {(myid.redFlagAlerts || []).join(', ')}</p>}
                                </div>
                            )}

                            {str && (
                                <div style={{ marginBottom: '16px' }}>
                                    <h2 style={{ color: '#92400e' }}>Estrutural — Scores</h2>
                                    <div className="score-grid">
                                        {UNIT_CONFIGS.map(cfg => {
                                            const unit = str.units?.[cfg.id];
                                            if (!unit) return null;
                                            return (
                                                <div className="score-item" key={cfg.id} style={{ background: '#fffbeb' }}>
                                                    <div className="score-label">{cfg.id}</div>
                                                    <div className={`score-value ${scoreClass(unit.score)}`}>{unit.score.toFixed(1)}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <p>Score Geral: <strong>{str.scoreStructuralGeneral?.toFixed(1)}</strong> · {str.classification}</p>
                                    {str.primaryDriver && <p>Driver: <strong>{str.primaryDriver}</strong></p>}
                                </div>
                            )}

                            {diretrizTexto && (
                                <div style={{ marginBottom: '16px' }}>
                                    <h2 style={{ color: '#92400e' }}>Diretriz de Tratamento</h2>
                                    <pre style={{ fontSize: '10px', whiteSpace: 'pre-wrap', fontFamily: 'Inter, sans-serif', background: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #fbbf24' }}>
                                        {diretrizTexto}
                                    </pre>
                                </div>
                            )}

                            <div style={{ marginTop: '20px', borderTop: '2px dashed #f59e0b', paddingTop: '16px' }}>
                                <h2 style={{ color: '#92400e' }}>Anotações Clínicas</h2>
                                <div style={{ minHeight: '120px', border: '1px dashed #d4a373', borderRadius: '8px', padding: '12px', background: '#fff' }}>
                                    <p style={{ fontSize: '10px', color: '#ccc' }}>Espaço para anotações manuais do profissional</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
