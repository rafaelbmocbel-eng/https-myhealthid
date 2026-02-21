import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvaliacaoIdentidade } from '@/types/identidade';
import {
  calcularIDFinal,
  getSeverityColor,
  getSeverityColorHex,
  calcularEquacaoDor,
  duracaoParaCronicidade,
  calcularModuladorEstiloVida,
} from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
} from 'recharts';
import {
  ArrowLeft, Download, Share2, Plus, MessageCircle, AlertTriangle,
  Target, CheckSquare, Dumbbell, Loader2, Save, Moon, Zap, Brain,
  Activity, Heart, Shield, Droplets, Cigarette, BedDouble, PersonStanding,
  Wine, Armchair, CircleAlert, TrendingUp, Footprints,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gerarProtocolo } from '@/utils/protocolGenerator';
import { toast } from '@/hooks/use-toast';
import { useAvaliacoesIdentidade } from '@/hooks/useAvaliacoesSalvas';
import { gerarPDFAvaliacao, PDFAvaliacaoData } from '@/utils/pdfAvaliacaoGenerator';
import IdFinalGauge from '@/components/identidade/IdFinalGauge';

interface Props {
  avaliacao: AvaliacaoIdentidade;
  pacienteId?: string;
  onBack: () => void;
}

/* ── Score Mini Card ─────────────────────────────────────────── */
function ScoreCard({ icon: Icon, label, value, suffix, color, barValue, barMax }: {
  icon?: any; label: string; value: string; suffix?: string; color?: string;
  barValue?: number; barMax?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        <span className="font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-black" style={{ color }}>{value}</span>
        {suffix && <span className="text-sm text-muted-foreground font-medium">{suffix}</span>}
      </div>
      {barValue !== undefined && barMax !== undefined && (
        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, (barValue / barMax) * 100)}%`,
              backgroundColor: color || 'hsl(var(--primary))',
            }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Unidade Crítica Card ────────────────────────────────────── */
function UnidadeCriticaCard({ nome, id, score, topTecido, topTecidoScore, rank }: {
  nome: string; id: string; score: number; topTecido: string; topTecidoScore: number; rank: number;
}) {
  const isFirst = rank === 1;
  const borderColor = isFirst ? 'border-red-300 bg-red-50/50' : 'border-border';
  const tecidoColor = topTecidoScore > 7 ? 'bg-red-100 text-red-700' : topTecidoScore > 4 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

  return (
    <div className={`rounded-xl border-2 p-4 ${borderColor}`}>
      <div className="font-bold text-sm">{id}</div>
      <div className="text-xs text-muted-foreground">{nome}</div>
      <div className="mt-2 text-lg font-black">ID {score.toFixed(1)}</div>
      {topTecidoScore > 0 && (
        <span className={`mt-2 inline-block text-xs px-2 py-0.5 rounded-full font-semibold ${tecidoColor}`}>
          {topTecido} {topTecidoScore.toFixed(1)}
        </span>
      )}
    </div>
  );
}

export default function RelatorioIdentidade({ avaliacao, pacienteId, onBack }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);
  const { salvar, salvando } = useAvaliacoesIdentidade();
  const [salvo, setSalvo] = useState(false);

  const handleSalvar = async () => {
    if (!pacienteId) return;
    await salvar({ avaliacao, pacienteId });
    setSalvo(true);
  };

  const e = avaliacao.bloco6.scoreE;
  const p = avaliacao.bloco4.scoreP;
  const c = avaliacao.bloco5.scoreC;
  const f = avaliacao.bloco1.scoreF;
  const d = avaliacao.bloco2.scoreD;
  const r = avaliacao.bloco5.scoreR;
  const r1 = avaliacao.bloco5.scoreR1 ?? 5;
  const r2 = avaliacao.bloco5.scoreR2 ?? 5;
  const r3 = avaliacao.bloco5.scoreR3 ?? 5;
  const efi = avaliacao.bloco3.scoreEFI;

  const { idFinal, fatoresRisco, classificacao } = calcularIDFinal(e, p, c, f, d, r);

  // Amplificadores já aplicados dentro de calcularIDFinal — exibir sem re-somar
  const amplificadores: Array<{ desc: string; pontos: number }> = [];
  if (p > 7.5) amplificadores.push({ desc: 'Cinesiofobia severa (P > 7.5)', pontos: 2 });
  if (c > 8) amplificadores.push({ desc: 'Carga contextual extrema (C > 8)', pontos: 2 });
  if (r < 2) amplificadores.push({ desc: 'Regulação neurovegetativa crítica (R < 2)', pontos: 3 });
  if (d > 8) amplificadores.push({ desc: 'Dor intensa/neuropática (D > 8)', pontos: 1 });
  const totalAmplif = amplificadores.reduce((s, a) => s + a.pontos, 0);
  const idAjustado = idFinal; // amplificadores já estão inclusos no idFinal

  // Numerador ponderado
  const numerador = (e * 0.30) + (p * 0.20) + (c * 0.20) + (f * 0.15) + (d * 0.10);

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
  const { modulador: modEstiloVida } = calcularModuladorEstiloVida(avaliacao.bloco1);
  const equacaoDor = calcularEquacaoDor(d, temIrradiacao, tipoPeso, p, r3, c, fCrono, r, modEstiloVida);

  // Unidades Críticas Top 3
  const unidadesSorted = [...avaliacao.bloco6.unidades]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const getTopTecido = (u: typeof avaliacao.bloco6.unidades[0]) => {
    const tecidos = [
      { nome: 'Muscular', score: u.scoreMuscular },
      { nome: 'Articulação', score: u.scoreArticular },
      { nome: 'Ligamento', score: u.scoreLigamentar },
      { nome: 'Nervo', score: u.scoreNervosa },
      { nome: 'Víscera', score: u.scoreVisceral },
    ];
    return tecidos.reduce((max, t) => t.score > max.score ? t : max, tecidos[0]);
  };

  // Radar data
  const radarData = [
    { subject: 'Estrutural', value: e * 10, fullMark: 100 },
    { subject: 'Comportamental', value: p * 10, fullMark: 100 },
    { subject: 'Contextual', value: c * 10, fullMark: 100 },
    { subject: 'Anamnese', value: f * 10, fullMark: 100 },
    { subject: 'Dor', value: d * 10, fullMark: 100 },
    { subject: 'Regulação', value: r * 10, fullMark: 100 },
  ];

  // Recomendações dinâmicas
  const recomendacoes: string[] = [];
  if (r < 4) recomendacoes.push('Higiene do sono', 'Técnicas de relaxamento');
  if (p > 6) recomendacoes.push('Psicoeducação em dor', 'Graded exposure');
  if (e > 5) recomendacoes.push('Intervenção estrutural manual');
  if (c > 6) recomendacoes.push('Suporte psicológico');
  if (r < 2) recomendacoes.push('Avaliação médica urgente');
  if (recomendacoes.length === 0) recomendacoes.push('Manutenção com exercícios');

  // Frequência e duração recomendadas
  const freqRecomendada = idAjustado > 30 ? '3x/semana' : idAjustado > 20 ? '2x/semana' : '1-2x/semana';
  const duracaoRecomendada = idAjustado > 30 ? '12 semanas' : idAjustado > 20 ? '8 semanas' : '6 semanas';
  const probSucesso = idAjustado > 40 ? '62%' : idAjustado > 30 ? '74%' : idAjustado > 20 ? '82%' : '91%';

  // Diagnóstico clínico dinâmico
  const diagnosticoParts: string[] = [];
  if (d > 5) diagnosticoParts.push(`Dor ${avaliacao.bloco2.regioes.length > 0 ? avaliacao.bloco2.regioes[0].nome : 'multirregional'}`);
  if (temIrradiacao) diagnosticoParts.push('com irradiação');
  if (e > 5) {
    const afetadas = avaliacao.bloco6.unidades.filter(u => u.score > 5).map(u => u.id);
    if (afetadas.length > 0) diagnosticoParts.push(`disfunção ${afetadas.join(', ')}`);
  }
  if (p > 6) diagnosticoParts.push('déficit comportamental');
  if (r < 4) diagnosticoParts.push('desregulação neurovegetativa');
  const diagnostico = diagnosticoParts.length > 0 ? diagnosticoParts.join(', ') : 'Quadro funcional preservado';

  // Alertas críticos
  const alertaCritico = classificacao === 'CRÍTICO' || classificacao === 'EXTREMO';

  // ── Gerar Protocolo ─────────────────────────────────────────
  const handleGerarProtocolo = async () => {
    if (!user) { navigate('/auth'); return; }
    setGerando(true);
    try {
      const scores = { E: e, P: p, C: c, F: f, D: d, R: r, EFI: efi, idFinal, classificacao };
      const protocolo = gerarProtocolo(scores, avaliacao.pacienteNome);

      const { data: prot, error: protErr } = await supabase
        .from('protocolos' as any)
        .insert({
          terapeuta_id: user.id,
          paciente_id: pacienteId || user.id,
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

      const { data: exerciciosDB } = await supabase.from('exercicios_biblioteca' as any).select('*');
      const exercDB = (exerciciosDB || []) as any[];

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

        const exerciciosDaFase = exercDB.filter((ex: any) => {
          const perfis = ex.perfis_indicados || [];
          const categorias = fase.categorias_exercicios;
          return categorias.some((cat: string) => ex.categoria === cat) ||
            perfis.some((perf: string) => protocolo.perfil_dominante.includes(perf));
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
          });
        }
      }

      toast({ title: '✅ Diretriz gerada com sucesso!', description: 'Acesse em Diretrizes para visualizar.' });
      navigate('/protocolos');
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar diretriz', variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  // R scores are INVERTED: high = bad (10 = worst sleep/energy/psych)
  // R (composite) is already inverted in calcularIDFinal: low R = bad regulation
  // But R1, R2, R3 sub-scores: HIGH = WORSE
  const getRColor = (val: number) => val >= 7 ? 'hsl(var(--success))' : val >= 4 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';
  const getRSubColor = (val: number) => val <= 3 ? 'hsl(var(--success))' : val <= 6 ? 'hsl(var(--warning))' : 'hsl(var(--destructive))';

  return (
    <div className="container py-8 max-w-5xl space-y-6">
      {/* ── Header / Breadcrumb ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span>Avaliação Completa</span>
          <span>›</span>
          <span className="font-semibold text-foreground">Resultado</span>
        </div>
        <div className="flex gap-2">
          {pacienteId && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSalvar} disabled={salvando || salvo}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {salvo ? 'Salvo ✓' : 'Salvar'}
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
            const getTopTecidoFn = (u: typeof avaliacao.bloco6.unidades[0]) => {
              const tecidos = [
                { nome: 'Muscular', score: u.scoreMuscular },
                { nome: 'Articulação', score: u.scoreArticular },
                { nome: 'Ligamento', score: u.scoreLigamentar },
                { nome: 'Nervo', score: u.scoreNervosa },
                { nome: 'Víscera', score: u.scoreVisceral },
              ];
              return tecidos.reduce((max, t) => t.score > max.score ? t : max, tecidos[0]);
            };
            const pdfData: PDFAvaliacaoData = {
              pacienteNome: avaliacao.pacienteNome,
              terapeutaNome: avaliacao.terapeutaNome || 'Terapeuta',
              dataAvaliacao: avaliacao.dataAvaliacao,
              idFinal: idAjustado,
              classificacao,
              scores: { E: e, P: p, C: c, F: f, D: d, R: r, EFI: efi },
              regulacao: { R1: r1, R2: r2, R3: r3 },
              equacaoDor,
              amplificadores,
              unidadesCriticas: unidadesSorted.map(u => {
                const top = getTopTecidoFn(u);
                return { id: u.id, nome: u.nome.replace(/^(UC\d|UA-[DE]|[ID]D)\s*–\s*/, ''), score: u.score, topTecido: top.nome, topTecidoScore: top.score };
              }),
              diagnostico,
              recomendacoes,
              frequencia: freqRecomendada,
              duracao: duracaoRecomendada,
              probSucesso,
              diretrizesTecnicas: avaliacao.bloco6.unidades
                .filter(u => u.score > 2)
                .sort((a, b) => b.score - a.score)
                .slice(0, 4)
                .map(u => ({
                  ucId: u.id,
                  ucNome: u.nome.replace(/^(UC\d|UA-[DE]|[ID]D)\s*–\s*/, ''),
                  score: u.score,
                  tecidos: [
                    { nome: 'Muscular', score: u.scoreMuscular, tecnica: 'Liberação miofascial / Dry needling' },
                    { nome: 'Articular', score: u.scoreArticular, tecnica: 'Mobilização grau III-IV / Mulligan' },
                    { nome: 'Ligamentar', score: u.scoreLigamentar, tecnica: 'Fortalecimento estabilizador' },
                    { nome: 'Nervosa', score: u.scoreNervosa, tecnica: 'Neurodinâmica / Dessensibilização' },
                    { nome: 'Visceral', score: u.scoreVisceral, tecnica: 'Manipulação visceral / Diafragmática' },
                  ].filter(t => t.score > 0).sort((a, b) => b.score - a.score),
                })),
            };
            gerarPDFAvaliacao(pdfData);
            toast({ title: '📄 PDF gerado!', description: 'O download do relatório iniciou.' });
          }}>
            <Download className="h-3.5 w-3.5" />
            PDF Paciente
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5"><Share2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* ── Main Grid: Gauge + Unidades Críticas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT: Gauge + Score Cards */}
        <div className="lg:col-span-3 space-y-4">
          <div className="clinical-card">
            <div className="flex flex-col items-center py-4">
              <IdFinalGauge value={idAjustado} />
              
              {alertaCritico && (
                <div className="mt-4 w-full px-3 py-2 rounded-lg bg-red-100 border border-red-300 text-red-800 text-sm font-medium text-center">
                  <AlertTriangle className="h-4 w-4 inline mr-1.5" />
                  Atenção: Índice {classificacao.toLowerCase()} detectado — encaminhar para avaliação médica
                </div>
              )}

              <div className="text-center mt-3 space-y-0.5">
                <p className="text-sm text-muted-foreground">Tempo Estimado: <strong>{duracaoRecomendada}</strong></p>
                <p className="text-sm text-muted-foreground">Taxa de Sucesso: <strong>{probSucesso}</strong></p>
              </div>
            </div>

            {/* Score cards grid */}
            <div className="grid grid-cols-2 gap-3 mt-2">
              <ScoreCard
                icon={Activity}
                label="∑ ID_modulado"
                value={numerador.toFixed(1)}
                color="hsl(var(--foreground))"
              />
              <ScoreCard
                icon={AlertTriangle}
                label="Fatores de Risco"
                value={totalAmplif > 0 ? `+${totalAmplif}` : '0'}
                color={totalAmplif > 0 ? 'hsl(var(--destructive))' : 'hsl(var(--success))'}
              />
              <ScoreCard
                icon={Heart}
                label="Demanda"
                value={equacaoDor.total.toFixed(1)}
                color={getSeverityColorHex(equacaoDor.total)}
              />
              <ScoreCard
                icon={Shield}
                label="Regulação"
                value={r.toFixed(1)}
                suffix="/10"
                color={getRColor(r)}
                barValue={r}
                barMax={10}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: Unidades Críticas + Diagnóstico */}
        <div className="lg:col-span-2 space-y-4">
          {/* Top 3 Unidades */}
          <div className="clinical-card">
            <h3 className="font-bold text-sm mb-3">Unidades Críticas – Top 3</h3>
            <div className="grid grid-cols-3 gap-2">
              {unidadesSorted.map((u, i) => {
                const top = getTopTecido(u);
                const nomeSimples = u.nome.replace(/^(UC\d|UA-[DE]|[ID]D)\s*–\s*/, '');
                return (
                  <UnidadeCriticaCard
                    key={u.id}
                    id={u.id}
                    nome={nomeSimples}
                    score={u.score}
                    topTecido={top.nome}
                    topTecidoScore={top.score}
                    rank={i + 1}
                  />
                );
              })}
            </div>
          </div>

          {/* Diagnóstico Clínico */}
          <div className="clinical-card">
            <h3 className="font-bold text-sm mb-2">Diagnóstico Clínico</h3>
            <p className="text-sm text-muted-foreground leading-relaxed capitalize">{diagnostico}</p>
          </div>

          {/* Recomendação */}
          <div className="clinical-card">
            <h3 className="font-bold text-sm mb-2">Recomendação</h3>
            <div className="space-y-1 text-sm">
              <p><strong>Frequência:</strong> {freqRecomendada}</p>
              <p><strong>Duração:</strong> {duracaoRecomendada}</p>
              <p><strong>Probabilidade de Sucesso:</strong> {probSucesso}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alertas de Estilo de Vida (ícones visuais) ── */}
      {(() => {
        const bloco1 = avaliacao.bloco1;
        const alertas: Array<{
          icon: any; label: string; status: 'critico' | 'alerta' | 'ok';
          mensagem: string; recomendacao: string;
        }> = [];

        // Atividade física
        if (bloco1.atividadeFisica === 'nenhuma') {
          alertas.push({
            icon: Footprints, label: 'Atividade Física', status: 'critico',
            mensagem: 'Sedentário — sem atividade física',
            recomendacao: 'Iniciar caminhadas de 20min, 3×/semana',
          });
        } else if (bloco1.atividadeFisica === 'leve') {
          alertas.push({
            icon: Footprints, label: 'Atividade Física', status: 'alerta',
            mensagem: 'Atividade física insuficiente',
            recomendacao: 'Aumentar para ≥3×/semana com intensidade moderada',
          });
        } else {
          alertas.push({
            icon: Footprints, label: 'Atividade Física', status: 'ok',
            mensagem: 'Nível de atividade adequado',
            recomendacao: 'Manter rotina atual',
          });
        }

        // Água
        const agua = bloco1.litrosAgua ?? 2;
        if (agua < 1) {
          alertas.push({
            icon: Droplets, label: 'Hidratação', status: 'critico',
            mensagem: `Apenas ${agua}L/dia — desidratação`,
            recomendacao: 'Meta: ≥2L/dia. Usar garrafa com marcações',
          });
        } else if (agua < 2) {
          alertas.push({
            icon: Droplets, label: 'Hidratação', status: 'alerta',
            mensagem: `${agua}L/dia — abaixo do ideal`,
            recomendacao: 'Aumentar para 2-3L/dia gradativamente',
          });
        } else {
          alertas.push({
            icon: Droplets, label: 'Hidratação', status: 'ok',
            mensagem: `${agua}L/dia — boa hidratação`,
            recomendacao: 'Manter ingestão hídrica',
          });
        }

        // Sono
        // R1/R2/R3 are INVERTED: high = bad (10 = worst)
        if (r1 > 7) {
          alertas.push({
            icon: BedDouble, label: 'Qualidade do Sono', status: 'critico',
            mensagem: `Sono gravemente comprometido (${r1.toFixed(1)}/10)`,
            recomendacao: 'Higiene do sono: horário fixo, sem telas 1h antes',
          });
        } else if (r1 > 4) {
          alertas.push({
            icon: BedDouble, label: 'Qualidade do Sono', status: 'alerta',
            mensagem: `Sono abaixo do ideal (${r1.toFixed(1)}/10)`,
            recomendacao: 'Regularizar horário e ambiente escuro/silencioso',
          });
        } else {
          alertas.push({
            icon: BedDouble, label: 'Qualidade do Sono', status: 'ok',
            mensagem: 'Sono adequado',
            recomendacao: 'Manter rotina de sono',
          });
        }

        // Tabagismo
        if (bloco1.tabagismo) {
          alertas.push({
            icon: Cigarette, label: 'Tabagismo', status: 'critico',
            mensagem: 'Fumante ativo — retarda cicatrização',
            recomendacao: 'Reduzir/cessar. Encaminhar para programa de cessação',
          });
        }

        // Álcool
        if (bloco1.alcool === 'frequente') {
          alertas.push({
            icon: Wine, label: 'Álcool', status: 'critico',
            mensagem: 'Consumo frequente — interfere na recuperação',
            recomendacao: 'Reduzir para ≤1×/semana',
          });
        } else if (bloco1.alcool === 'moderado') {
          alertas.push({
            icon: Wine, label: 'Álcool', status: 'alerta',
            mensagem: 'Consumo moderado — atenção',
            recomendacao: 'Reduzir para ocasional quando possível',
          });
        }

        // Sedentarismo (horas sentado)
        if (bloco1.horasSedentario >= 10) {
          alertas.push({
            icon: Armchair, label: 'Sedentarismo', status: 'critico',
            mensagem: `${bloco1.horasSedentario}h sentado/dia — risco alto`,
            recomendacao: 'Pausas ativas a cada 45min. Alongar 5min a cada hora',
          });
        } else if (bloco1.horasSedentario >= 6) {
          alertas.push({
            icon: Armchair, label: 'Sedentarismo', status: 'alerta',
            mensagem: `${bloco1.horasSedentario}h sentado/dia — atenção`,
            recomendacao: 'Incluir pausas de movimento a cada 1h',
          });
        }

        const criticos = alertas.filter(a => a.status === 'critico');
        const alertasList = alertas.filter(a => a.status === 'alerta');
        const oks = alertas.filter(a => a.status === 'ok');

        const getCardStyle = (status: 'critico' | 'alerta' | 'ok') => {
          switch (status) {
            case 'critico': return 'border-red-300 bg-red-50/80';
            case 'alerta': return 'border-amber-300 bg-amber-50/80';
            case 'ok': return 'border-green-300 bg-green-50/80';
          }
        };
        const getIconBg = (status: 'critico' | 'alerta' | 'ok') => {
          switch (status) {
            case 'critico': return 'bg-red-100 text-red-600';
            case 'alerta': return 'bg-amber-100 text-amber-600';
            case 'ok': return 'bg-green-100 text-green-600';
          }
        };
        const getStatusLabel = (status: 'critico' | 'alerta' | 'ok') => {
          switch (status) {
            case 'critico': return '⚠️ Necessita ação';
            case 'alerta': return '⚡ Melhorar';
            case 'ok': return '✅ Adequado';
          }
        };

        return (
          <div className="clinical-card border-2 border-primary/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Marcadores de Estilo de Vida
              </h3>
              {criticos.length > 0 && (
                <Badge className="bg-red-100 text-red-700 border border-red-300">
                  {criticos.length} ponto{criticos.length > 1 ? 's' : ''} crítico{criticos.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[...criticos, ...alertasList, ...oks].map((alerta, i) => {
                const Icon = alerta.icon;
                return (
                  <div key={i} className={`rounded-xl border-2 p-3 transition-all ${getCardStyle(alerta.status)}`}>
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${getIconBg(alerta.status)}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold">{alerta.label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{getStatusLabel(alerta.status)}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-xs font-medium">{alerta.mensagem}</div>
                    <div className="mt-1.5 text-[10px] text-muted-foreground italic leading-relaxed">
                      💡 {alerta.recomendacao}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}


      <div className="clinical-card border-2 border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">Estado Neurovegetativo</h3>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black" style={{ color: getRColor(r) }}>{r.toFixed(1)}</span>
            <span className="text-sm text-muted-foreground font-medium">/10</span>
          </div>
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${(r / 10) * 100}%`,
              backgroundColor: getRColor(r),
            }}
          />
        </div>
        
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <Moon className="h-5 w-5 mx-auto mb-1 text-blue-500" />
            <div className="text-lg font-bold" style={{ color: getRSubColor(r1) }}>{r1.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Sono (R1)</div>
          </div>
          <div className="text-center">
            <Zap className="h-5 w-5 mx-auto mb-1 text-amber-500" />
            <div className="text-lg font-bold" style={{ color: getRSubColor(r2) }}>{r2.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Energia (R2)</div>
          </div>
          <div className="text-center">
            <Brain className="h-5 w-5 mx-auto mb-1 text-purple-500" />
            <div className="text-lg font-bold" style={{ color: getRSubColor(r3) }}>{r3.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">Psicológico (R3)</div>
          </div>
        </div>

        {recomendacoes.length > 0 && (
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Recomendações:</p>
            <div className="space-y-1">
              {recomendacoes.map((rec, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className={rec.includes('urgente') ? 'text-red-600 font-bold' : 'text-muted-foreground'}>
                    {rec.includes('urgente') ? '⊕' : '•'}
                  </span>
                  <span className={rec.includes('urgente') ? 'text-red-600 font-semibold' : ''}>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Perfil Multidimensional Radar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="clinical-card">
          <h3 className="font-bold text-sm mb-3">Perfil Multidimensional</h3>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <Radar name="Score" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Breakdown dos 6 blocos */}
        <div className="clinical-card">
          <h3 className="font-bold text-sm mb-3">Breakdown dos Scores</h3>
          <div className="space-y-3">
            {[
              { label: 'E (Estrutural)', value: e, color: 'hsl(var(--score-e))' },
              { label: 'P (Comportamental)', value: p, color: 'hsl(var(--score-p))' },
              { label: 'C (Contextual)', value: c, color: 'hsl(var(--score-c))' },
              { label: 'F (Anamnese)', value: f, color: 'hsl(var(--score-f))' },
              { label: 'D (Dor)', value: d, color: 'hsl(var(--score-d))' },
              { label: 'R (Regulação)', value: r, color: 'hsl(var(--score-r))' },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-xs font-medium w-32 shrink-0">{b.label}</span>
                <div className="flex-1 h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(b.value / 10) * 100}%`, backgroundColor: b.color }}
                  />
                </div>
                <span className="text-xs font-bold w-8 text-right" style={{ color: b.color }}>{b.value.toFixed(1)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Equação da Dor Identidade ── */}
      <div className="clinical-card border border-destructive/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">Equação da Dor Identidade</h3>
          <Badge style={{
            backgroundColor: equacaoDor.total > 7 ? '#ef4444' : equacaoDor.total > 5 ? '#f97316' : '#22c55e',
            color: 'white'
          }}>
            {equacaoDor.total.toFixed(1)}/10
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: 'Sensório', value: equacaoDor.sensorio },
            { label: 'Afetiva', value: equacaoDor.afetiva },
            { label: 'Cognitiva', value: equacaoDor.cognitiva },
            { label: 'Neurovegetativa', value: equacaoDor.neurovegetativa },
            { label: 'Estilo de Vida', value: equacaoDor.estiloVida },
          ].map(dim => (
            <div key={dim.label} className="text-center p-3 rounded-xl bg-secondary/40">
              <div className="text-xs text-muted-foreground mb-1">{dim.label}</div>
              <div className="text-xl font-bold" style={{ color: getSeverityColorHex(dim.value) }}>
                {dim.value.toFixed(1)}
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-2">
                <div className="h-full rounded-full" style={{
                  width: `${Math.min(100, (dim.value / 10) * 100)}%`,
                  backgroundColor: getSeverityColorHex(dim.value),
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Fatores de Risco ── */}
      {amplificadores.length > 0 && (
        <div className="clinical-card border border-amber-200 bg-amber-50/50">
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2 text-amber-800">
            <AlertTriangle className="h-4 w-4" />
            Fatores de Risco Amplificadores
          </h3>
          <div className="space-y-2">
            {amplificadores.map((a, i) => (
              <div key={i} className="flex items-center justify-between text-sm text-amber-800">
                <span>✓ {a.desc}</span>
                <Badge variant="outline" className="border-amber-400 text-amber-800 font-bold">+{a.pontos}</Badge>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between pt-3 mt-3 border-t border-amber-200 text-sm font-bold text-amber-900">
            <span>ID base {idFinal.toFixed(1)} + amplificadores {totalAmplif}</span>
            <span className="text-lg">{idAjustado.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* ── Diretrizes de Tratamento (Desde o 1º dia) ── */}
      <div className="clinical-card border-2 border-primary/20">
        <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          Diretrizes de Tratamento — Desde o 1º Dia
        </h3>

        {/* Técnicas manuais e terapêuticas */}
        <div className="space-y-4">
          {/* Sessão tipo */}
          <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
            <div className="text-xs font-bold text-primary mb-2">SESSÃO MODELO (1ª semana)</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              <div>
                <div className="font-semibold text-xs text-muted-foreground mb-1">Terapias Manuais</div>
                <ul className="space-y-1 text-xs">
                  {e > 4 && <li>• Mobilização articular (UCs afetadas)</li>}
                  {e > 3 && <li>• Liberação miofascial</li>}
                  {e > 5 && <li>• Manipulação articular</li>}
                  {d > 5 && <li>• Tração manual</li>}
                  <li>• Técnica de tecidos moles</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-xs text-muted-foreground mb-1">Eletroterapia / Recursos</div>
                <ul className="space-y-1 text-xs">
                  {d > 6 && <li>• TENS (modulação da dor)</li>}
                  {e > 5 && <li>• Ultrassom terapêutico</li>}
                  {r < 5 && <li>• Termoterapia</li>}
                  {p > 6 && <li>• Corrente interferencial</li>}
                  <li>• Crioterapia pós-sessão</li>
                </ul>
              </div>
              <div>
                <div className="font-semibold text-xs text-muted-foreground mb-1">Exercícios Terapêuticos</div>
                <ul className="space-y-1 text-xs">
                  {r < 5 && <li>• Respiração diafragmática</li>}
                  {p > 5 && <li>• Educação em neurociência da dor</li>}
                  <li>• Mobilidade articular ativa</li>
                  <li>• Ativação de core (baixa carga)</li>
                  {efi < 6 && <li>• Exercício funcional básico</li>}
                </ul>
              </div>
            </div>
          </div>

          {/* UCs com diretrizes tecidual */}
          <div>
            <div className="text-xs font-bold text-muted-foreground mb-3">DIRETRIZES POR UNIDADE CORPORAL</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {avaliacao.bloco6.unidades
                .filter(u => u.score > 2)
                .sort((a, b) => b.score - a.score)
                .slice(0, 4)
                .map(u => {
                  const tecidos = [
                    { nome: 'Muscular', score: u.scoreMuscular, tecnicas: ['Liberação miofascial', 'Dry needling', 'Alongamento PNF'] },
                    { nome: 'Articular', score: u.scoreArticular, tecnicas: ['Mobilização grau III-IV', 'Tração articular', 'Mulligan MWM'] },
                    { nome: 'Ligamentar', score: u.scoreLigamentar, tecnicas: ['Fortalecimento estabilizador', 'Bandagem funcional', 'Propriocepção'] },
                    { nome: 'Nervosa', score: u.scoreNervosa, tecnicas: ['Neurodinâmica', 'Dessensibilização neural', 'TENS'] },
                    { nome: 'Visceral', score: u.scoreVisceral, tecnicas: ['Manipulação visceral', 'Técnica diafragmática', 'Mobilização fascial'] },
                  ].filter(t => t.score > 0).sort((a, b) => b.score - a.score);
                  
                  if (tecidos.length === 0) return null;
                  const nomeSimples = u.nome.replace(/^(UC\d|UA-[DE]|[ID]D)\s*–\s*/, '');

                  return (
                    <div key={u.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-xs">{u.id} – {nomeSimples}</span>
                        <span className="text-xs font-bold" style={{ color: getSeverityColorHex(u.score) }}>
                          {u.score.toFixed(1)}/10
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {tecidos.slice(0, 3).map(t => (
                          <div key={t.nome} className="flex items-start gap-2">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0 mt-0.5">
                              {t.nome} {t.score.toFixed(0)}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">{t.tecnicas[0]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Gerar Protocolo CTA ── */}
      <div className="clinical-card bg-gradient-hero text-white">
        <div className="flex items-center justify-between">
          <div>
             <h3 className="font-bold text-lg">Gerar Diretriz de Tratamento</h3>
             <p className="text-sm opacity-80 mt-1">Diretriz automática baseada nos scores · {freqRecomendada} · {duracaoRecomendada}</p>
          </div>
          <Button
            size="lg"
            className="bg-white/20 hover:bg-white/30 text-white border border-white/30 gap-2"
            onClick={handleGerarProtocolo}
            disabled={gerando}
          >
            {gerando ? <Loader2 className="h-5 w-5 animate-spin" /> : <Dumbbell className="h-5 w-5" />}
            {gerando ? 'Gerando...' : 'Gerar Diretriz'}
          </Button>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="text-center space-y-1 py-4">
        <p className="text-xs text-muted-foreground">
          {avaliacao.dataAvaliacao} · {avaliacao.pacienteNome}
        </p>
        <p className="text-xs text-muted-foreground">
          MÉTODO IDENTIDADE © 2026 – Avaliação Multidimensional · Diretriz v8.0
        </p>
      </div>
    </div>
  );
}
