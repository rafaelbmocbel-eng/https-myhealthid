import { AvaliacaoIdentidade } from '@/types/identidade';
import { calcularIDFinal, getSeverityColor } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ArrowLeft, Download, Share2, Plus, MessageCircle } from 'lucide-react';

interface Props {
  avaliacao: AvaliacaoIdentidade;
  onBack: () => void;
}

export default function RelatorioIdentidade({ avaliacao, onBack }: Props) {
  const e = avaliacao.bloco6.scoreE;
  const p = avaliacao.bloco4.scoreP;
  const c = avaliacao.bloco5.scoreC;
  const f = avaliacao.bloco1.scoreF;
  const d = avaliacao.bloco2.scoreD;
  const r = avaliacao.bloco5.scoreR;

  const { idFinal, fatoresRisco, classificacao } = calcularIDFinal(e, p, c, f, d, r);

  const radarData = [
    { subject: 'Estrutural (E)', value: e * 10, fullMark: 100 },
    { subject: 'Comportamental (P)', value: p * 10, fullMark: 100 },
    { subject: 'Contextual (C)', value: c * 10, fullMark: 100 },
    { subject: 'Anamnese (F)', value: f * 10, fullMark: 100 },
    { subject: 'Dor (D)', value: d * 10, fullMark: 100 },
    { subject: 'Regulação (R)', value: r * 10, fullMark: 100 },
  ];

  const pieData = [
    { name: 'Estrutural (E)', value: 30, score: e, color: '#3b82f6' },
    { name: 'Comportamental (P)', value: 20, score: p, color: '#ef4444' },
    { name: 'Contextual (C)', value: 20, score: c, color: '#f97316' },
    { name: 'Anamnese (F)', value: 15, score: f, color: '#22c55e' },
    { name: 'Dor (D)', value: 10, score: d, color: '#a855f7' },
    { name: 'Regulação (R)', value: 5, score: r, color: '#64748b' },
  ];

  const prioridades = [
    { ordem: 1, titulo: 'Regulação Neurovegetativa', desc: 'Melhorar sono, reduzir stress, restaurar energia', urgencia: r < 4 },
    { ordem: 2, titulo: 'Redução de Kinesiophobia', desc: 'Educação em dor, graded exposure, movimentação segura', urgencia: p > 6 },
    { ordem: 3, titulo: 'Intervenção Estrutural', desc: 'Liberações estruturais, mobilizações, fortalecimento', urgencia: e > 6 },
    { ordem: 4, titulo: 'Otimização Contextual', desc: 'Gestão de stress, apoio psicológico se necessário', urgencia: c > 7 },
  ];

  const sevColor = getSeverityColor(classificacao);

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header ações */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar à avaliação
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />Compartilhar
          </Button>
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />Nova reavaliação
          </Button>
          <Button size="sm" className="gap-2 bg-gradient-primary text-white">
            <Download className="h-4 w-4" />Download PDF
          </Button>
        </div>
      </div>

      {/* Cabeçalho relatório */}
      <div className="clinical-card bg-gradient-hero text-white mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm opacity-70 mb-1">Relatório Clínico – Método Identidade</div>
            <h1 className="text-2xl font-bold">{avaliacao.pacienteNome}</h1>
            <div className="text-sm opacity-80 mt-1">{avaliacao.dataAvaliacao} · Terapeuta: {avaliacao.terapeutaNome}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-70 mb-1">IDENTIDADE DA DISFUNÇÃO</div>
            <div className="text-5xl font-bold">{idFinal.toFixed(1)}</div>
            <div className="text-sm opacity-80">/50</div>
          </div>
        </div>
      </div>

      {/* ID Score destacado */}
      <div className={`clinical-card border-2 mb-6 ${sevColor}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium opacity-70">Classificação</div>
            <div className="text-3xl font-black mt-1">{classificacao}</div>
            <div className="text-sm mt-2">
              {classificacao === 'LEVE' && 'Bom prognóstico – potencial autolimitado'}
              {classificacao === 'MODERADO' && 'Requer intervenção regular e acompanhamento'}
              {classificacao === 'SEVERO' && 'Necessário acompanhamento intensivo'}
              {classificacao === 'CRÍTICO' && 'Risco de cronicidade – considerar equipe multidisciplinar'}
              {classificacao === 'EXTREMO' && '⚠️ Estado crítico – urgência terapêutica'}
            </div>
          </div>
          <div className="text-6xl font-black opacity-20">{idFinal.toFixed(0)}</div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Radar */}
        <div className="clinical-card">
          <h3 className="font-semibold mb-4">Perfil Multidimensional</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
              <Radar name="Score" dataKey="value" stroke="hsl(187 76% 32%)" fill="hsl(187 76% 32%)" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie */}
        <div className="clinical-card">
          <h3 className="font-semibold mb-4">Contribuição por Componente</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, value }) => `${value}%`} labelLine={false}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(value, name) => [`${value}%`, name]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="grid grid-cols-2 gap-1 mt-2">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="truncate text-muted-foreground">{item.name.split('(')[0].trim()}</span>
                <span className="font-bold ml-auto">{item.score.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scores cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {pieData.map(item => (
          <div key={item.name} className="clinical-card p-3 text-center border-t-4" style={{ borderTopColor: item.color }}>
            <div className="text-xl font-bold" style={{ color: item.color }}>{item.score.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{item.name.split('(')[1]?.replace(')', '') || item.name}</div>
          </div>
        ))}
      </div>

      {/* Fatores de risco */}
      {fatoresRisco.length > 0 && (
        <div className="clinical-card border-warning bg-amber-50 mb-6">
          <h3 className="font-semibold text-amber-800 mb-3">⚠️ Fatores de Risco Identificados</h3>
          <div className="space-y-2">
            {fatoresRisco.map((f, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="font-bold">•</span>
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hierarquia terapêutica */}
      <div className="clinical-card mb-6">
        <h3 className="font-semibold mb-4">Hierarquia Terapêutica Recomendada</h3>
        <div className="space-y-3">
          {prioridades.map(p => (
            <div key={p.ordem} className={`flex items-start gap-3 p-3 rounded-xl border ${p.urgencia ? 'border-amber-200 bg-amber-50' : 'border-border bg-secondary/30'}`}>
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                p.ordem === 1 ? 'bg-yellow-400 text-white' :
                p.ordem === 2 ? 'bg-gray-400 text-white' :
                p.ordem === 3 ? 'bg-amber-600 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {p.ordem === 1 ? '🥇' : p.ordem === 2 ? '🥈' : p.ordem === 3 ? '🥉' : '4'}
              </div>
              <div>
                <div className="font-medium text-sm">{p.titulo}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.desc}</div>
              </div>
              {p.urgencia && <Badge variant="outline" className="ml-auto text-amber-600 border-amber-200 text-xs">Urgente</Badge>}
            </div>
          ))}
        </div>
      </div>

      {/* Recomendações */}
      <div className="clinical-card mb-6">
        <h3 className="font-semibold mb-3">Programa Recomendado</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Duração', value: '12 semanas' },
            { label: 'Presencial', value: '2×/semana' },
            { label: 'Home Exercise', value: '5×/semana' },
            { label: 'Reavaliação', value: 'Sem 4, 8, 12' },
          ].map(item => (
            <div key={item.label} className="text-center p-3 rounded-xl bg-secondary">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="font-bold text-primary mt-1">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="clinical-card bg-muted/50 text-center">
        <p className="text-xs text-muted-foreground">
          Este relatório é confidencial e destinado exclusivamente ao paciente e terapeuta responsável.
          Gerado por Método Identidade v8.2 – {avaliacao.dataAvaliacao}
        </p>
        <Button variant="ghost" size="sm" className="mt-3 gap-2">
          <MessageCircle className="h-4 w-4" />
          Chat com IA sobre este relatório
        </Button>
      </div>
    </div>
  );
}
