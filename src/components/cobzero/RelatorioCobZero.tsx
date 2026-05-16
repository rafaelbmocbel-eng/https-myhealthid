import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvaliacaoCobZero } from '@/types/cobzero';
import { getCobbClassification } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Share2, Plus, Save, Loader2, Sparkles } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAvaliacoesCobZero } from '@/hooks/useAvaliacoesSalvas';

interface Props {
  avaliacao: AvaliacaoCobZero;
  pacienteId?: string;
  onBack: () => void;
}

export default function RelatorioCobZero({ avaliacao, pacienteId, onBack }: Props) {
  const navigate = useNavigate();
  const { etapaLenke, etapaRisco, unidades, scoreE } = avaliacao;
  const cobbClass = getCobbClassification(etapaLenke.cobbAngle);
  const { salvar, salvando } = useAvaliacoesCobZero();
  const [salvo, setSalvo] = useState(false);

  const handleSalvar = async () => {
    if (!pacienteId) return;
    await salvar({ avaliacao, pacienteId });
    setSalvo(true);
  };

  const unidadeData = unidades.map(u => ({ name: u.id, score: Number(u.score.toFixed(1)) }));

  const metas = [
    { label: 'Cobb Atual', baseline: etapaLenke.cobbAngle, meta: Math.max(etapaLenke.cobbAngle - 4, 10), unit: '°' },
    { label: 'ATR', baseline: avaliacao.etapaAntropometrica.atr, meta: Math.max(avaliacao.etapaAntropometrica.atr - 5, 3), unit: '°' },
    { label: 'Score E', baseline: Number(scoreE.toFixed(1)), meta: Math.max(scoreE - 2, 0), unit: '/10' },
  ];

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />Voltar
        </Button>
        <div className="flex gap-2">
          {pacienteId && (
            <Button variant="outline" size="sm" className="gap-2" onClick={handleSalvar} disabled={salvando || salvo}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {salvo ? 'Salvo ✓' : 'Salvar avaliação'}
            </Button>
          )}
          {pacienteId && (
            <Button className="bg-primary text-primary-foreground gap-2" size="sm" onClick={() => navigate(`/pacientes/${pacienteId}?tab=protocolos`)}>
              <Sparkles className="h-4 w-4" />
              Gerar Diretriz
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-2"><Share2 className="h-4 w-4" />Compartilhar</Button>
          <Button variant="outline" size="sm" className="gap-2"><Plus className="h-4 w-4" />Reavaliação</Button>
          <Button size="sm" className="gap-2 bg-primary text-primary-foreground"><Download className="h-4 w-4" />Download PDF</Button>
        </div>
      </div>

      {/* Header */}
      <div className="clinical-card mb-6" style={{ background: 'linear-gradient(135deg, hsl(213 55% 16%), hsl(213 55% 10%))', color: 'white' }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm opacity-70 mb-1">Relatório COB° ZERO – Protocolo Integrado de Escoliose</div>
            <h1 className="text-2xl font-bold">{avaliacao.pacienteNome}</h1>
            <div className="text-sm opacity-80 mt-1">{avaliacao.dataAvaliacao} · {avaliacao.terapeutaNome}</div>
            <div className="mt-3 flex gap-2">
              <Badge style={{ backgroundColor: 'hsl(40 95% 52%)', color: 'hsl(213 55% 14%)' }}>
                Lenke {etapaLenke.lenkeType}{etapaLenke.lumbarModifier} {etapaLenke.sagittalModifier}
              </Badge>
              <Badge style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                Risser {etapaLenke.risserStage}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-70">COBB ANGLE</div>
            <div className="text-5xl font-bold">{etapaLenke.cobbAngle}°</div>
            <span className={`text-sm px-2 py-0.5 rounded-full mt-1 inline-block ${cobbClass.color}`}>
              {cobbClass.label}
            </span>
          </div>
        </div>
      </div>

      {/* Risco */}
      <div className={`clinical-card border-2 mb-6 ${etapaRisco.riskLevel === 'ALTO' ? 'border-destructive bg-red-50' :
        etapaRisco.riskLevel === 'MODERADO' ? 'border-warning bg-amber-50' : 'border-success bg-green-50'
        }`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold">Risco de Progressão (Lonstein & Carlson)</div>
            <div className="text-sm text-muted-foreground mt-1">
              Sexo: {avaliacao.pacienteSexo} · Cobb: {etapaLenke.cobbAngle}° · Risser: {etapaLenke.risserStage}
            </div>
            <div className="text-sm mt-2">
              {etapaLenke.risserStage <= 2 ? '⚠️ Paciente em crescimento – risco aumentado' :
                etapaLenke.risserStage >= 4 ? '✅ Maturidade esquelética – estabilização esperada' :
                  '⚠️ Quasi-maturidade – monitorar progressão'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-black">{etapaRisco.riskPercentage}%</div>
            <Badge className={`mt-1 ${etapaRisco.riskLevel === 'ALTO' ? 'bg-destructive text-white' : etapaRisco.riskLevel === 'MODERADO' ? 'bg-warning text-white' : 'bg-success text-white'}`}>
              {etapaRisco.riskLevel}
            </Badge>
          </div>
        </div>
      </div>

      {/* Score E gráfico */}
      {unidades.length > 0 && (
        <div className="clinical-card mb-6">
          <h3 className="font-semibold mb-4">Score E – Unidades Corporais</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={unidadeData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', background: 'hsl(var(--card))' }} />
              <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 text-right text-sm text-muted-foreground">Score E médio: <strong className="text-primary">{scoreE.toFixed(1)}/10</strong></div>
        </div>
      )}

      {/* Metas */}
      <div className="clinical-card mb-6">
        <h3 className="font-semibold mb-4">Metas Quantificáveis (12 semanas)</h3>
        <div className="space-y-4">
          {metas.map(m => (
            <div key={m.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{m.label}</span>
                <span><span className="text-muted-foreground">{m.baseline}{m.unit}</span> → <span className="font-bold text-success">≤{m.meta}{m.unit}</span></span>
              </div>
              <div className="h-2 bg-muted rounded-full">
                <div className="h-2 bg-primary rounded-full" style={{ width: '10%' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plano 4 fases */}
      <div className="clinical-card mb-6">
        <h3 className="font-semibold mb-4">Diretriz de 4 Fases COB° ZERO</h3>
        <div className="space-y-2">
          {[
            { f: '0', label: 'Preparação & Liberação', dur: 'Meses 1-6', meta: 'ATR ↓≥15%, ROM ↑≥20%', color: 'bg-blue-50 border-blue-200' },
            { f: '1', label: 'Educação & 7 Princípios Schroth', dur: 'Sem 1-4', meta: 'ATR ↓≥20%, EVA <5/10', color: 'bg-green-50 border-green-200' },
            { f: '2', label: 'Força & Estabilidade', dur: 'Sem 5-8', meta: 'Força +30%, Cobb ↓2-3°', color: 'bg-amber-50 border-amber-200' },
            { f: '3', label: 'Integração Funcional', dur: 'Sem 9-12', meta: 'Cobb ↓≥4°, SRS-22r ↑15pts', color: 'bg-purple-50 border-purple-200' },
          ].map(item => (
            <div key={item.f} className={`flex items-center gap-3 p-3 rounded-xl border ${item.color}`}>
              <div className="h-8 w-8 rounded-full bg-white border-2 border-current flex items-center justify-center text-sm font-black">{item.f}</div>
              <div className="flex-1">
                <div className="font-medium text-sm">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.dur} · Meta: {item.meta}</div>
              </div>
              {item.f === String(avaliacao.faseAtual) && <Badge className="bg-primary text-primary-foreground text-xs">Ativa</Badge>}
            </div>
          ))}
        </div>
      </div>

      <div className="clinical-card bg-muted/50 text-center">
        <p className="text-xs text-muted-foreground">
          Baseado em evidências científicas (Schroth 2009, SEAS 2012, Negrini 2018, Alves 2024)
          · COB° ZERO v8.2 · {avaliacao.dataAvaliacao}
        </p>
      </div>
    </div>
  );
}
