import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvaliacaoIdentidade } from '@/types/identidade';
import {
  calcularIDFinal,
  getSeverityColor,
  calcularEquacaoDor,
  duracaoParaCronicidade,
} from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  PieChart, Pie, Cell, Tooltip, Legend,
} from 'recharts';
import { ArrowLeft, Download, Share2, Plus, MessageCircle, AlertTriangle, Target, CheckSquare, Dumbbell, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gerarProtocolo, EXERCICIOS_SEED } from '@/utils/protocolGenerator';
import { toast } from '@/hooks/use-toast';

interface Props {
  avaliacao: AvaliacaoIdentidade;
  onBack: () => void;
}

function BarraScore({ value, color, label }: { value: number; color: string; label: string }) {
  const pct = Math.min(100, (value / 10) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 text-xs text-muted-foreground shrink-0">{label}</div>
      <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
        <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="w-12 text-right text-xs font-bold" style={{ color }}>{value.toFixed(1)}/10</div>
    </div>
  );
}

function DimensaoDor({ label, value, descricao }: { label: string; value: number; descricao: string }) {
  const pct = Math.min(100, (value / 10) * 100);
  const color = value <= 3 ? '#22c55e' : value <= 6 ? '#f97316' : '#ef4444';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="font-bold" style={{ color }}>{value.toFixed(1)}/10</span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <div className="text-xs text-muted-foreground">{descricao}</div>
    </div>
  );
}

export default function RelatorioIdentidade({ avaliacao, onBack }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);

  const e = avaliacao.bloco6.scoreE;
  const p = avaliacao.bloco4.scoreP;
  const c = avaliacao.bloco5.scoreC;
  const f = avaliacao.bloco1.scoreF;
  const d = avaliacao.bloco2.scoreD;
  const r = avaliacao.bloco5.scoreR;
  const r3 = avaliacao.bloco5.scoreR3 ?? 5;
  const efi = avaliacao.bloco3.scoreEFI;

  const { idFinal, fatoresRisco, classificacao } = calcularIDFinal(e, p, c, f, d, r);

  // Calcular amplificadores com total
  const amplificadores: Array<{ desc: string; pontos: number }> = [];
  if (p > 7.5) amplificadores.push({ desc: 'Kinesiophobia severa (P > 7.5)', pontos: 2 });
  if (c > 8) amplificadores.push({ desc: 'Carga contextual extrema (C > 8)', pontos: 2 });
  if (r < 2) amplificadores.push({ desc: 'Regulação neurovegetativa crítica (R < 2)', pontos: 3 });
  else if (r < 3) amplificadores.push({ desc: 'Regulação neurovegetativa crítica (R < 3)', pontos: 3 });
  if (d > 8) amplificadores.push({ desc: 'Dor radicular/neuropática (D > 8 + irradiação)', pontos: 1 });
  const totalAmplif = amplificadores.reduce((s, a) => s + a.pontos, 0);
  const idAjustado = Math.round((idFinal + totalAmplif) * 10) / 10;

  // Equação da dor
  const fCrono = duracaoParaCronicidade(avaliacao.bloco1.duracao);
  const temIrradiacao = avaliacao.bloco2.regioes.some(r => r.irradiacao);
  const tipoPeso = avaliacao.bloco2.regioes.length > 0
    ? Math.max(...avaliacao.bloco2.regioes.flatMap(reg =>
        reg.tipos.map(t => {
          if (['Ardor', 'Queimação', 'Dormência'].includes(t)) return 1.0;
          if (['Pontada', 'Dor profunda'].includes(t)) return 0.75;
          return 0.5;
        })
      ), 0.5)
    : 0.5;

  const equacaoDor = calcularEquacaoDor(d, temIrradiacao, tipoPeso, p, r3, c, fCrono, r);

  // Radar data
  const radarData = [
    { subject: 'Estrutural', value: e * 10, fullMark: 100 },
    { subject: 'Comportamental', value: p * 10, fullMark: 100 },
    { subject: 'Contextual', value: c * 10, fullMark: 100 },
    { subject: 'Anamnese', value: f * 10, fullMark: 100 },
    { subject: 'Dor', value: d * 10, fullMark: 100 },
    { subject: 'Regulação', value: r * 10, fullMark: 100 },
  ];

  // Numerador para contribuição %
  const numerador = (e * 0.30) + (p * 0.20) + (c * 0.20) + (f * 0.15) + (d * 0.10);

  const pieData = [
    { name: 'Estrutural (E)', peso: 0.30, score: e, color: '#3b82f6' },
    { name: 'Comportamental (P)', peso: 0.20, score: p, color: '#ef4444' },
    { name: 'Contextual (C)', peso: 0.20, score: c, color: '#f97316' },
    { name: 'Anamnese (F)', peso: 0.15, score: f, color: '#22c55e' },
    { name: 'Dor (D)', peso: 0.10, score: d, color: '#a855f7' },
  ].map(item => ({
    ...item,
    contribuicao: numerador > 0
      ? Math.round((item.score * item.peso / numerador) * 1000) / 10
      : item.peso * 100,
  }));

  const blocos = [
    { label: 'E (Estrutural)', value: e, color: '#3b82f6', tag: e <= 3 ? 'Normal' : e <= 6 ? 'Moderado' : 'Severo ⚠️' },
    { label: 'P (Kinesiophobia)', value: p, color: '#ef4444', tag: p <= 3 ? 'Baixa' : p <= 6 ? 'Moderada' : 'Severa ⚠️' },
    { label: 'C (Carga Contextual)', value: c, color: '#f97316', tag: c <= 3 ? 'Baixa' : c <= 6 ? 'Moderada' : 'Alta' },
    { label: 'F (Anamnese)', value: f, color: '#22c55e', tag: f <= 3 ? 'Leve' : f <= 6 ? 'Moderado' : 'Crônico' },
    { label: 'D (Dor Multidim.)', value: d, color: '#a855f7', tag: d <= 3 ? 'Leve' : d <= 6 ? 'Moderada' : 'Severa' },
    { label: 'R (Regulação Neurov.)', value: r, color: '#64748b', tag: r >= 7 ? 'Boa' : r >= 4 ? 'Moderada' : 'Crítica 🚨' },
  ];

  const prioridades = [
    {
      ordem: 1, emoji: '🥇', titulo: 'Regulação Neurovegetativa',
      urgencia: r < 4,
      items: ['Higiene do sono (protocolo 4 semanas)', 'Técnicas de relaxamento (respiração, meditação)', 'Avaliação psiquiátrica (depressão? medicação?)'],
    },
    {
      ordem: 2, emoji: '🥈', titulo: 'Redução de Kinesiophobia',
      urgencia: p > 6,
      items: ['Psicoeducação em dor (neurofisiologia)', 'Graded exposure exercises (movimentos seguros, progressivos)', 'Terapia cognitivo-comportamental'],
    },
    {
      ordem: 3, emoji: '🥉', titulo: 'Intervenção Estrutural',
      urgencia: e > 6,
      items: ['Avaliação clínica (UC2, UC3, UC4 prioritárias)', 'Liberações manuais (fáscia, articulação, nervo)', 'Fortalecimento progressivo (estabilização)'],
    },
    {
      ordem: 4, emoji: '4️⃣', titulo: 'Gestão Contextual',
      urgencia: c > 7,
      items: ['Suporte psicológico (stress, relacionamentos)', 'Orientação ocupacional/lifestyle', 'Suporte social (grupos, comunidade)'],
    },
  ];

  const metas = [
    { label: 'Reduzir ID_final', atual: idAjustado.toFixed(1), meta: '<20 (SEVERO)', ganho: `-${Math.round(((idAjustado - 20) / idAjustado) * 100)}%` },
    { label: 'Kinesiophobia (P)', atual: p.toFixed(1), meta: '<5 (leve)', ganho: '' },
    { label: 'Regulação (R)', atual: r.toFixed(1), meta: '>6 (boa)', ganho: '' },
    { label: 'Dor_ID', atual: equacaoDor.total.toFixed(1), meta: '<6/10', ganho: '' },
    { label: 'Funcionalidade EFI', atual: avaliacao.bloco3.scoreEFI.toFixed(1), meta: `↑30%`, ganho: '' },
  ];

  const proximosPassos = [
    'Agendamento sessão 1 (anamnese + palpação estrutural)',
    'Prescrição protocolo higiene do sono (enviar via app)',
    'Encaminhamento psicólogo (avaliação depressão/ansiedade)',
    'Prescrição home exercises iniciais (5 exercícios simples)',
    'Videoconferência semanal (telehealth) primeiras 4 semanas',
    'Reavaliação completa semana 4 (check progresso)',
  ];

  const sevColor = getSeverityColor(classificacao);

  const dorSeveridade = (v: number) => v <= 3 ? 'leve' : v <= 6 ? 'moderada' : 'severa';

  // ── Gerar Protocolo Automático ─────────────────────────────────────────────
  const handleGerarProtocolo = async () => {
    if (!user) { navigate('/auth'); return; }
    setGerando(true);
    try {
      const scores = { E: e, P: p, C: c, F: f, D: d, R: r, EFI: efi, idFinal, classificacao };
      const protocolo = gerarProtocolo(scores, avaliacao.pacienteNome);

      // 1. Criar protocolo no banco
      const { data: prot, error: protErr } = await supabase
        .from('protocolos' as any)
        .insert({
          terapeuta_id: user.id,
          paciente_id: user.id, // sem vínculo real – usamos terapeuta_id como placeholder
          titulo: protocolo.titulo,
          objetivo_geral: protocolo.objetivo_geral,
          perfil_dominante: protocolo.perfil_dominante,
          duracao_total: protocolo.duracao_total,
          frequencia: protocolo.frequencia,
          hierarquia_terapeutica: protocolo.hierarquia,
          status: 'ativo',
          data_inicio: new Date().toISOString().split('T')[0],
          scores_avaliacao: { E: e, P: p, C: c, F: f, D: d, R: r, EFI: efi, idFinal, classificacao, prognose: protocolo.prognose },
        })
        .select()
        .single();

      if (protErr || !prot) throw protErr || new Error('Erro ao criar protocolo');

      // 2. Buscar exercícios do banco
      const { data: exerciciosDB } = await supabase
        .from('exercicios_biblioteca' as any)
        .select('*');
      const exercDB = (exerciciosDB || []) as any[];

      // 3. Criar fases e prescrições
      for (const fase of protocolo.fases) {
        const { data: faseDB, error: faseErr } = await supabase
          .from('protocolo_fases' as any)
          .insert({
            protocolo_id: (prot as any).id,
            numero_fase: fase.fase,
            titulo: fase.titulo,
            semanas_inicio: fase.semanas_inicio,
            semanas_fim: fase.semanas_fim,
            objetivos: fase.objetivos,
            sessoes_por_semana: fase.sessoes_por_semana,
          })
          .select()
          .single();

        if (faseErr || !faseDB) continue;

        // Selecionar exercícios para esta fase
        const exerciciosDaFase = exercDB.filter((ex: any) => {
          const perfis = ex.perfis_indicados || [];
          const categorias = fase.categorias_exercicios;
          return categorias.some((c: string) => ex.categoria === c) ||
            perfis.some((p: string) => protocolo.perfil_dominante.includes(p));
        }).slice(0, 4);

        for (const ex of exerciciosDaFase) {
          await supabase.from('prescricoes_exercicios' as any).insert({
            protocolo_id: (prot as any).id,
            fase_id: (faseDB as any).id,
            exercicio_id: ex.id,
            series: 3,
            repeticoes: ex.categoria === 'Relaxamento' ? 1 : 12,
            tempo_descanso: '60 segundos',
            frequencia: `${fase.sessoes_por_semana}x por semana`,
            observacoes: fase.fase === 1 ? 'Iniciar com baixa intensidade. Observar resposta à dor.' : undefined,
          });
        }
      }

      toast({ title: '✅ Protocolo gerado com sucesso!', description: 'Acesse em Protocolos para visualizar e exportar o PDF.' });
      navigate('/protocolos');
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar protocolo', variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="container py-8 max-w-4xl space-y-6">
      {/* Header ações */}
      <div className="flex items-center justify-between">
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
          <Button
            size="sm"
            className="gap-2 bg-gradient-primary text-white"
            onClick={handleGerarProtocolo}
            disabled={gerando}
          >
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Dumbbell className="h-4 w-4" />}
            {gerando ? 'Gerando...' : 'Gerar Protocolo'}
          </Button>
        </div>
      </div>

      {/* Cabeçalho relatório */}
      <div className="clinical-card bg-gradient-hero text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-70 uppercase tracking-widest mb-1">Relatório Clínico · Método Identidade v8.0</div>
            <h1 className="text-2xl font-bold">{avaliacao.pacienteNome}</h1>
            <div className="text-sm opacity-80 mt-1">{avaliacao.dataAvaliacao} · Terapeuta: {avaliacao.terapeutaNome}</div>
          </div>
          <div className="text-right">
            <div className="text-xs opacity-70 mb-1">IDENTIDADE DA DISFUNÇÃO</div>
            <div className="text-5xl font-black">{idFinal.toFixed(1)}</div>
            <div className="text-sm opacity-80">/50</div>
          </div>
        </div>
      </div>

      {/* ID Score + Classificação */}
      <div className={`clinical-card border-2 ${sevColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="text-xs font-medium opacity-60 uppercase tracking-wider">Classificação Final</div>
            <div className="text-4xl font-black mt-1">{classificacao}</div>
            <div className="text-sm mt-2 font-medium">
              {classificacao === 'LEVE' && 'Bom prognóstico – potencial autolimitado.'}
              {classificacao === 'MODERADO' && 'Requer intervenção regular e acompanhamento.'}
              {classificacao === 'SEVERO' && 'Necessário acompanhamento intensivo multidisciplinar.'}
              {classificacao === 'CRÍTICO' && 'Alto risco de cronicidade – equipe multidisciplinar recomendada.'}
              {classificacao === 'EXTREMO' && '⚠️ Estado crítico – urgência terapêutica imediata.'}
            </div>
            {totalAmplif > 0 && (
              <div className="text-xs mt-2 opacity-70">
                ID base: {idFinal.toFixed(1)} → ID ajustado: <strong>{idAjustado.toFixed(1)}</strong> (amplificadores: +{totalAmplif})
              </div>
            )}
          </div>
          <div className="text-7xl font-black opacity-10 ml-4">{idAjustado.toFixed(0)}</div>
        </div>
      </div>

      {/* Breakdown 6 blocos */}
      <div className="clinical-card">
        <h3 className="font-semibold mb-4">📈 Breakdown dos 6 Blocos</h3>
        <div className="space-y-3">
          {blocos.map(b => (
            <div key={b.label} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground w-44 shrink-0">{b.label}</span>
                <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden mx-3">
                  <div
                    className="h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (b.value / 10) * 100)}%`, backgroundColor: b.color }}
                  />
                </div>
                <span className="font-bold w-12 text-right" style={{ color: b.color }}>{b.value.toFixed(1)}</span>
                <span className="w-20 text-right text-muted-foreground">{b.tag}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gráfico Radar + Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="clinical-card">
          <h3 className="font-semibold mb-3">📊 Perfil Multidimensional (Radar)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="clinical-card">
          <h3 className="font-semibold mb-3">🥧 Contribuição por Componente</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%" cy="50%"
                outerRadius={75}
                dataKey="contribuicao"
                label={({ name, contribuicao }) => `${contribuicao.toFixed(0)}%`}
                labelLine={false}
              >
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-1">
            {pieData.map(item => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-muted-foreground flex-1">{item.name}</span>
                <span className="font-bold" style={{ color: item.color }}>{item.contribuicao.toFixed(1)}%</span>
                <span className="text-muted-foreground">({item.score.toFixed(1)}/10)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Equação da Dor Identidade */}
      <div className="clinical-card border border-destructive/30 bg-destructive/5">
        <h3 className="font-semibold mb-1 flex items-center gap-2">
          <span>❤️‍🔥 Equação da Dor Identidade</span>
          <Badge className="ml-auto text-sm px-3 py-1" style={{
            backgroundColor: equacaoDor.total > 7 ? '#ef4444' : equacaoDor.total > 5 ? '#f97316' : '#22c55e',
            color: 'white'
          }}>
            {equacaoDor.total.toFixed(1)}/10 – {equacaoDor.total > 7 ? 'SEVERA' : equacaoDor.total > 5 ? 'MODERADA' : 'LEVE'}
          </Badge>
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Dor<sub>Identidade</sub> = D<sub>sensório</sub> + D<sub>afetiva</sub> + D<sub>cognitiva</sub> + D<sub>neurovegetativa</sub>
        </p>
        <div className="space-y-4">
          <DimensaoDor
            label="Sensório-Discriminativa"
            value={equacaoDor.sensorio}
            descricao={`Intensidade ${d.toFixed(1)}/10${temIrradiacao ? ', com irradiação (+2)' : ''} · tipo ${dorSeveridade(tipoPeso * 10)}`}
          />
          <DimensaoDor
            label="Afetiva-Motivacional"
            value={equacaoDor.afetiva}
            descricao={`Kinesiophobia ${p.toFixed(1)}/10 · Psicológico ${r3.toFixed(1)}/10 (invertido)`}
          />
          <DimensaoDor
            label="Cognitiva-Avaliativa"
            value={equacaoDor.cognitiva}
            descricao={`Carga contextual ${c.toFixed(1)}/10 · Cronicidade fator ${fCrono}/10`}
          />
          <DimensaoDor
            label="Neurovegetativa"
            value={equacaoDor.neurovegetativa}
            descricao={`Regulação ${r.toFixed(1)}/10 → (10-R)×0.8 = ${equacaoDor.neurovegetativa.toFixed(1)}`}
          />
        </div>
        <div className="mt-4 p-3 rounded-xl bg-muted/60 text-xs text-muted-foreground">
          <strong>Fórmula:</strong> Dor<sub>ID</sub>(raw) = {equacaoDor.sensorio.toFixed(1)} + {equacaoDor.afetiva.toFixed(1)} + {equacaoDor.cognitiva.toFixed(1)} + {equacaoDor.neurovegetativa.toFixed(1)} = {(equacaoDor.sensorio + equacaoDor.afetiva + equacaoDor.cognitiva + equacaoDor.neurovegetativa).toFixed(1)} → normalizado: <strong>{equacaoDor.total.toFixed(1)}/10</strong>
        </div>
      </div>

      {/* Fatores de risco amplificadores */}
      {amplificadores.length > 0 && (
        <div className="clinical-card border-warning bg-amber-50">
          <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            ⚠️ Fatores de Risco Amplificadores
          </h3>
          <div className="space-y-2 mb-3">
            {amplificadores.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm text-amber-800">
                <span>✓ {a.desc}</span>
                <Badge variant="outline" className="border-amber-400 text-amber-800 font-bold">+{a.pontos} pts</Badge>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 border-t border-amber-200 text-sm font-bold text-amber-900">
            <span>Total amplificadores</span>
            <span>+{totalAmplif} pontos</span>
          </div>
          <div className="flex items-center justify-between text-sm font-black text-amber-900 mt-1">
            <span>ID_ajustado = {idFinal.toFixed(1)} + {totalAmplif}</span>
            <span className="text-lg">{idAjustado.toFixed(1)} → <Badge className="bg-amber-600 text-white">{idAjustado > 30 ? 'CRÍTICO' : classificacao}</Badge></span>
          </div>
        </div>
      )}

      {/* Classificação Geral */}
      <div className={`clinical-card border-2 ${sevColor}`}>
        <h3 className="font-semibold mb-2">🏥 Classificação Geral</h3>
        <div className="text-2xl font-black mb-2">{idAjustado > 30 ? 'CRÍTICO' : classificacao}</div>
        <p className="text-sm text-muted-foreground mb-3">
          {idAjustado > 30
            ? 'Alto risco de cronicidade. Paciente apresenta disfunção complexa com múltiplos fatores amplificadores.'
            : 'Paciente apresenta disfunção estabelecida. Intervenção integrada recomendada.'}
        </p>
        <div className="space-y-1 text-sm">
          {e > 5 && <div>• Estrutura comprometida ({avaliacao.bloco6.unidades.filter(u => u.score > 5).length} de 8 unidades afetadas)</div>}
          {p > 6 && <div>• Medo de movimento elevado (evitação ativa)</div>}
          {c > 5 && <div>• Carga emocional/social excessiva</div>}
          {r < 4 && <div>• Regulação neurovegetativa comprometida (sono e energia)</div>}
          {fCrono >= 5 && <div>• Sintomas cronificados ({'>'} 3 meses)</div>}
        </div>
        <div className="mt-3 text-sm font-medium text-muted-foreground">
          Prognóstico: <strong>{idAjustado > 30 ? 'RESERVADO sem intervenção multidisciplinar' : idAjustado > 20 ? 'MODERADO com intervenção integrada' : 'BOM com tratamento regular'}</strong>
        </div>
      </div>

      {/* Hierarquia Terapêutica */}
      <div className="clinical-card">
        <h3 className="font-semibold mb-4">📋 Recomendações Hierarquizadas</h3>
        <div className="space-y-4">
          {prioridades.map(pri => (
            <div key={pri.ordem} className={`rounded-xl border p-4 ${pri.urgencia ? 'border-amber-200 bg-amber-50' : 'border-border bg-secondary/20'}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{pri.emoji}</span>
                <span className="font-semibold text-sm">{pri.titulo}</span>
                {pri.urgencia && <Badge variant="outline" className="ml-auto text-amber-600 border-amber-300 text-xs">Urgente</Badge>}
              </div>
              <ul className="space-y-1">
                {pri.items.map((item, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <span className="text-primary mt-0.5">└─</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Programa Recomendado + Metas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="clinical-card">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4" />Programa Recomendado</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Duração', value: '12 semanas' },
              { label: 'Presencial', value: '2×/semana' },
              { label: 'Home Exercise', value: '5×/semana' },
              { label: 'Reavaliação', value: 'Sem 4, 8, 12' },
            ].map(item => (
              <div key={item.label} className="text-center p-3 rounded-xl bg-secondary">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="font-bold text-primary mt-1 text-sm">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="clinical-card">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Target className="h-4 w-4" />🎯 Metas Terapêuticas (12 sem)</h3>
          <div className="space-y-2">
            {metas.map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground w-36 shrink-0">{m.label}</span>
                <span className="font-bold text-foreground">{m.atual}</span>
                <span className="text-muted-foreground">→</span>
                <span className="font-bold text-primary text-right">{m.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Próximos Passos */}
      <div className="clinical-card">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <CheckSquare className="h-4 w-4" />✅ Próximos Passos
        </h3>
        <div className="space-y-2">
          {proximosPassos.map((passo, i) => (
            <div key={i} className="flex items-start gap-3 text-sm">
              <div className="h-5 w-5 rounded border border-border shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{passo}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer legal */}
      <div className="clinical-card bg-muted/40 text-center space-y-2">
        <p className="text-xs text-muted-foreground font-medium">
          Data: {avaliacao.dataAvaliacao} · Terapeuta: {avaliacao.terapeutaNome} | CREFITO [nº]
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-xl mx-auto">
          "Este relatório é confidencial e baseado em avaliação clínica estruturada. Não substitui diagnóstico médico.
          Recomenda-se avaliação complementar (ressonância, eletromiongrafia) conforme necessário."
        </p>
        <div className="text-xs text-muted-foreground font-bold pt-1">
          MÉTODO IDENTIDADE © 2026 – Avaliação Multidimensional · Protocolo v8.0 – Baseado em Evidências
        </div>
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <MessageCircle className="h-3 w-3" />Chat com IA
          </Button>
          <Button variant="ghost" size="sm" className="gap-2 text-xs">
            <Share2 className="h-3 w-3" />Compartilhar com paciente
          </Button>
        </div>
      </div>
    </div>
  );
}
