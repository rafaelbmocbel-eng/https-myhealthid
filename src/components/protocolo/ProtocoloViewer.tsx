import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Download, Activity, Target, CheckCircle2,
  Loader2, Zap, Shield, Beaker, TrendingUp, Layers, FileText,
  Clock, ListChecks, Pencil,
} from 'lucide-react';
import { useState } from 'react';
import { format } from '@/lib/dateSafe';
import { ptBR } from 'date-fns/locale';
import ProtocoloScores from './ProtocoloScores';
import ProtocoloTratamento from './ProtocoloTratamento';
import ProtocoloProgressao from './ProtocoloProgressao';
import ProtocoloDiretrizEditor from './ProtocoloDiretrizEditor';
import { createDiretrizSnapshotFromVoz, getDiretrizSnapshotFromScores } from '@/lib/protocoloSnapshot';
import type { DiretrizSnapshot, DiretrizSnapshotPhase } from '@/lib/protocoloSnapshot';
import { cn } from '@/lib/utils';

/* ─── Compact phase-card view (same style as assessment DiretrizCompact) ─── */
const FASE_COLORS = [
  { chip: 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400', num: 'bg-red-500/10 text-red-600 dark:text-red-400', ring: 'from-red-400/60 to-red-500/10' },
  { chip: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400', num: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', ring: 'from-amber-400/60 to-amber-500/10' },
  { chip: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400', num: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', ring: 'from-emerald-400/60 to-emerald-500/10' },
  { chip: 'bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400', num: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', ring: 'from-blue-400/60 to-blue-500/10' },
];

function DiretrizSnapshotCompact({ snapshot }: { snapshot: DiretrizSnapshot }) {
  if (!snapshot?.fases?.length) return null;

  const manut = snapshot.manutencao && typeof snapshot.manutencao === 'object' ? snapshot.manutencao : null;

  return (
    <div className="space-y-3">
      {snapshot.fases.map((fase: DiretrizSnapshotPhase, idx: number) => {
        const colors = FASE_COLORS[idx % FASE_COLORS.length];
        const objs = [fase.objetivo, ...(fase.demandasAlvo || [])].filter(Boolean);
        const tecnicas = fase.tecnicas || [];
        const criterios = fase.criteriosProgressao || [];

        return (
          <div key={fase.numero} className="relative rounded-xl border border-border bg-card overflow-hidden">
            <div className={cn('absolute inset-y-0 left-0 w-1 bg-gradient-to-b', colors.ring)} />

            <div className="pl-4 pr-4 pt-3 pb-3 space-y-2">
              {/* Header */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0', colors.num)}>
                    {fase.numero}
                  </span>
                  <span className="font-semibold text-[13px] text-foreground truncate">{fase.titulo}</span>
                </div>
                <span className={cn('inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold', colors.chip)}>
                  Fase {fase.numero}
                </span>
              </div>

              {/* Duration */}
              {fase.semanas && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  Semanas {fase.semanas}
                  {fase.frequenciaSemanal ? ` · ${fase.frequenciaSemanal}x/sem` : ''}
                  {fase.duracaoSessao ? ` · ${fase.duracaoSessao}` : ''}
                </p>
              )}

              {/* Objectives — até 4 linhas */}
              {objs.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">🎯 Objetivos</p>
                  {objs.slice(0, 4).map((obj, i) => (
                    <p key={i} className="text-[12px] text-foreground/80 leading-snug line-clamp-1 pl-1">• {obj}</p>
                  ))}
                  {objs.length > 4 && (
                    <p className="text-[11px] text-muted-foreground/60 pl-1">+{objs.length - 4} objetivos</p>
                  )}
                </div>
              )}

              {/* Technique chips — até 5 */}
              {tecnicas.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">🔧 Técnicas</p>
                  <div className="flex flex-wrap gap-1">
                    {tecnicas.slice(0, 5).map((t, i) => (
                      <span key={i} className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-foreground/70">
                        {t.nome}
                      </span>
                    ))}
                    {tecnicas.length > 5 && (
                      <span className="inline-flex items-center rounded-md border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground/60">
                        +{tecnicas.length - 5}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Criteria — até 2 linhas */}
              {criterios.length > 0 && (
                <div className="space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-1">
                    <ListChecks className="h-3 w-3" /> Progressão
                  </p>
                  {criterios.slice(0, 2).map((c, i) => (
                    <p key={i} className="text-[11px] text-foreground/75 line-clamp-1 pl-1">• {c}</p>
                  ))}
                  {criterios.length > 2 && (
                    <p className="text-[11px] text-muted-foreground/60 pl-1">+{criterios.length - 2} critérios</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Card Manutenção / Pós-reabilitação */}
      {manut && (
        <div className="relative rounded-xl border border-border bg-card overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-violet-400/60 to-violet-500/10" />
          <div className="pl-4 pr-4 pt-3 pb-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shrink-0 bg-violet-500/10 text-violet-600 dark:text-violet-400">
                  {snapshot.fases.length + 1}
                </span>
                <span className="font-semibold text-[13px] text-foreground truncate">Pós-Reabilitação & Manutenção</span>
              </div>
              <span className="inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-400">
                Manutenção
              </span>
            </div>

            {manut.frequencia_reavaliacao && (
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3 shrink-0" /> {String(manut.frequencia_reavaliacao)}
              </p>
            )}

            {manut.mensagem_paciente && (
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">🎯 Orientação</p>
                <p className="text-[12px] text-foreground/80 line-clamp-2 pl-1">{String(manut.mensagem_paciente)}</p>
              </div>
            )}

            {Array.isArray(manut.rotina_minima) && (manut.rotina_minima as string[]).length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">🔧 Rotina mínima</p>
                <div className="flex flex-wrap gap-1">
                  {(manut.rotina_minima as string[]).slice(0, 4).map((r: string, i: number) => (
                    <span key={i} className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-foreground/70 max-w-[200px] truncate">
                      {r}
                    </span>
                  ))}
                  {(manut.rotina_minima as string[]).length > 4 && (
                    <span className="inline-flex items-center rounded-md border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] text-muted-foreground/60">
                      +{(manut.rotina_minima as string[]).length - 4}
                    </span>
                  )}
                </div>
              </div>
            )}

            {Array.isArray(manut.sinais_para_retornar) && (manut.sinais_para_retornar as string[]).length > 0 && (
              <div className="space-y-0.5">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">⚠️ Retornar ao profissional</p>
                {(manut.sinais_para_retornar as string[]).slice(0, 2).map((s: string, i: number) => (
                  <p key={i} className="text-[11px] text-foreground/75 line-clamp-1 pl-1">• {s}</p>
                ))}
                {(manut.sinais_para_retornar as string[]).length > 2 && (
                  <p className="text-[11px] text-muted-foreground/60 pl-1">+{(manut.sinais_para_retornar as string[]).length - 2} sinais</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Frequency + Prognosis */}
      <div className="flex flex-wrap gap-2 pt-1">
        {snapshot.frequenciaSugerida && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-[12px] text-foreground/80">{snapshot.frequenciaSugerida}</span>
          </div>
        )}
        {snapshot.prognostico && (
          <div className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5">
            <span className="text-[11px] text-muted-foreground">Prognóstico:</span>
            <span className="text-[12px] text-foreground/80">{snapshot.prognostico}</span>
          </div>
        )}
      </div>
    </div>
  );
}

const parseResultado = (value: unknown) => {
  if (typeof value !== 'string') return value as any;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

interface Props {
  protocoloId: string;
  onBack: () => void;
  onExportPDF: () => void;
  onNewDiretriz?: () => void;
  embedded?: boolean;
}

export default function ProtocoloViewer({ protocoloId, onBack, onExportPDF, onNewDiretriz, embedded = false }: Props) {
  const [tabAtiva, setTabAtiva] = useState<'fases' | 'tecnicas' | 'tratamento' | 'progressao'>('fases');
  const [showEditor, setShowEditor] = useState(false);

  const { data: protocolo, isLoading: loadingProt } = useQuery({
    queryKey: ['protocolo', protocoloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos' as any)
        .select('*')
        .eq('id', protocoloId)
        .single();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: fases = [], isLoading: loadingFases } = useQuery({
    queryKey: ['protocolo-fases', protocoloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolo_fases' as any)
        .select('*')
        .eq('protocolo_id', protocoloId)
        .order('numero_fase');
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: prescricoes = [], isLoading: loadingPres } = useQuery({
    queryKey: ['prescricoes', protocoloId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescricoes_exercicios' as any)
        .select('*, exercicio:exercicio_id(*)')
        .eq('protocolo_id', protocoloId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: progressao } = useQuery({
    queryKey: ['protocolo-progressao', protocoloId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('protocolo_progressao')
        .select('*')
        .eq('protocolo_id', protocoloId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: tratamentos = [] } = useQuery({
    queryKey: ['protocolo-tratamentos', protocoloId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('protocolo_tratamentos')
        .select('*, tecnica:tecnica_id(*)')
        .eq('protocolo_id', protocoloId);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const { data: avaliacaoDiretriz } = useQuery({
    queryKey: ['avaliacao-voz-diretriz-protocolo', protocoloId, protocolo?.paciente_id, protocolo?.terapeuta_id],
    queryFn: async () => {
      if (!protocolo?.paciente_id || !protocolo?.terapeuta_id) return null;
      const { data, error } = await (supabase as any)
        .from('avaliacoes_voz')
        .select('resultado, created_at')
        .eq('paciente_id', protocolo.paciente_id)
        .eq('terapeuta_id', protocolo.terapeuta_id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return ((data || []) as any[]).find((avaliacao) => {
        const resultado = parseResultado(avaliacao.resultado);
        return resultado?._secoes?.diretriz_protocolo_id === protocoloId;
      }) || null;
    },
    enabled: !!protocolo?.paciente_id && !!protocolo?.terapeuta_id,
  });

  if (loadingProt || loadingFases || loadingPres) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!protocolo) return null;

  const scores = protocolo.scores_avaliacao || {};
  const faseAtual = progressao?.fase_atual || 1;
  const semanaAtual = progressao?.semana_atual || 1;
  const resultadoAvaliacao = parseResultado(avaliacaoDiretriz?.resultado);
  const diretrizSnapshotAvaliacao = createDiretrizSnapshotFromVoz(resultadoAvaliacao?.diretriz_tratamento, {
    origem: 'ia_voz',
    createdAt: avaliacaoDiretriz?.created_at,
    textoConfirmado: resultadoAvaliacao?._secoes?.editadas?.diretriz,
  });
  const diretrizSnapshot = diretrizSnapshotAvaliacao ?? getDiretrizSnapshotFromScores(protocolo.scores_avaliacao);
  const origemDiretriz = String(protocolo.origem || scores.origem || diretrizSnapshot?.origem || '');
  const isDiretrizConfirmadaAvaliacao = !!diretrizSnapshot && ['ia_voz', 'ia_escrita', 'avaliacao_voz'].includes(origemDiretriz);

  if (embedded && isDiretrizConfirmadaAvaliacao) {
    return (
      <div className="space-y-4">
        {diretrizSnapshot ? (
          <>
            {!showEditor ? (
              <>
                <DiretrizSnapshotCompact snapshot={diretrizSnapshot} />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 text-muted-foreground"
                  onClick={() => setShowEditor(true)}
                >
                  <Pencil className="h-3.5 w-3.5" /> Editar / detalhar diretriz
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-muted-foreground"
                  onClick={() => setShowEditor(false)}
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao resumo
                </Button>
                <ProtocoloDiretrizEditor
                  protocoloId={protocoloId}
                  snapshot={diretrizSnapshot}
                  faseAtual={faseAtual}
                  queixa={protocolo.titulo}
                />
              </>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-border/40 bg-card p-4 text-sm text-muted-foreground">
            Esta diretriz ainda não possui o conteúdo confirmado salvo.
          </div>
        )}
      </div>
    );
  }

  const FASE_LABELS = ['Inflamatória', 'Proliferação', 'Remodelação', 'Funcional'];
  const FASE_ICONS = [Shield, Beaker, Layers, TrendingUp];

  return (
    <div className="container py-4 sm:py-8 max-w-5xl px-3 sm:px-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
        <Button variant="outline" onClick={onBack} className="gap-2" size="sm">
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Voltar</span>
        </Button>
        <div className="flex items-center gap-2">
          {onNewDiretriz && (
            <Button variant="outline" onClick={onNewDiretriz} className="gap-2" size="sm">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Diretriz</span>
            </Button>
          )}
          <Button onClick={onExportPDF} className="bg-primary text-primary-foreground gap-2" size="sm">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Exportar PDF</span>
          </Button>
        </div>
      </div>

      {/* Cabeçalho protocolo */}
      <div className="clinical-card bg-gradient-hero text-white mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-70 uppercase tracking-widest mb-1">
              Plano de Reabilitação Cinético-Funcional
            </div>
            <h1 className="text-xl font-bold">{protocolo.titulo}</h1>
            <p className="text-sm opacity-80 mt-1">{protocolo.duracao_total} · {protocolo.frequencia}</p>
            {protocolo.created_at && (
              <p className="text-xs opacity-60 mt-1">
                Gerado em {format(new Date(protocolo.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            )}
          </div>
          {scores.idFinal && (
            <div className="text-right shrink-0 ml-4">
              <div className="text-xs opacity-70 mb-1">ID Final</div>
              <div className="text-4xl font-black">{(scores.idFinal as number).toFixed(1)}</div>
              <div className="text-sm opacity-80">{scores.classificacao || ''}</div>
            </div>
          )}
        </div>

        {/* Timeline de fases */}
        <div className="mt-6 flex items-center gap-1">
          {FASE_LABELS.map((label, i) => {
            const Icon = FASE_ICONS[i];
            const isAtual = faseAtual === i + 1;
            const isConcluida = faseAtual > i + 1;
            return (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-1 transition-all ${isAtual ? 'bg-white text-primary ring-2 ring-white/50 scale-110' :
                  isConcluida ? 'bg-white/30 text-white' : 'bg-white/10 text-white/50'
                  }`}>
                  {isConcluida ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                </div>
                <span className={`text-[10px] text-center leading-tight ${isAtual ? 'font-bold text-white' : 'text-white/60'}`}>
                  {label}
                </span>
                {i < 3 && (
                  <div className={`absolute h-0.5 w-full top-5 ${isConcluida ? 'bg-white/40' : 'bg-white/10'}`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-3 text-xs text-white/70 text-center">
          Fase {faseAtual} · Semana {semanaAtual}
        </div>
      </div>

      {/* Objetivo e Prognose */}
      {!isDiretrizConfirmadaAvaliacao && <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="clinical-card">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Objetivo Geral</h3>
          </div>
          <p className="text-sm text-muted-foreground">{protocolo.objetivo_geral}</p>
        </div>
        <div className="clinical-card">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <h3 className="font-semibold text-sm">Prognose</h3>
          </div>
          <p className="text-sm text-muted-foreground">{scores.prognose || 'Moderado – com aderência ao tratamento.'}</p>
        </div>
      </div>}

      {!isDiretrizConfirmadaAvaliacao && protocolo.descricao && (
        <div className="clinical-card border-l-4 border-primary/40 bg-primary/5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-primary" />
            <h3 className="font-semibold text-sm">Resumo e Insights</h3>
          </div>
          <pre className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
            {protocolo.descricao}
          </pre>
        </div>
      )}

      {isDiretrizConfirmadaAvaliacao && diretrizSnapshot && (
        <ProtocoloDiretrizEditor
          protocoloId={protocoloId}
          snapshot={diretrizSnapshot}
          faseAtual={faseAtual}
          queixa={protocolo.titulo}
        />
      )}

      {isDiretrizConfirmadaAvaliacao && !diretrizSnapshot && (
        <div className="clinical-card text-sm text-muted-foreground">Esta diretriz ainda não possui o conteúdo confirmado salvo.</div>
      )}

      {isDiretrizConfirmadaAvaliacao && (
        <div className="clinical-card border-l-4 border-destructive mt-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-destructive">
            ⚠️ Instruções de Segurança
          </h3>
          <p className="text-sm font-medium text-foreground mb-2">Interrompa o exercício imediatamente se sentir:</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {['Dor aguda ou súbita', 'Tontura ou falta de ar', 'Formigamento ou dormência nos membros', 'Qualquer sensação anormal ou preocupante'].map(a => (
              <li key={a} className="flex items-center gap-2">
                <span className="text-destructive">•</span> {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {isDiretrizConfirmadaAvaliacao && null}

      {!isDiretrizConfirmadaAvaliacao && (
        <>

      {/* Scores */}
      <ProtocoloScores scores={scores} />

      {/* Perfil dominante */}
      {protocolo.perfil_dominante?.length > 0 && (
        <div className="clinical-card mb-6">
          <h3 className="font-semibold mb-3">🎯 Perfil Clínico Dominante</h3>
          <div className="flex flex-wrap gap-2">
            {protocolo.perfil_dominante.map((p: string) => (
              <Badge key={p} className="bg-primary/10 text-primary border-0">
                {p.replace(/_/g, ' ')}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 mb-4 sm:mb-6 bg-muted rounded-xl p-1">
        {[
          { key: 'fases' as const, label: 'Diretriz', fullLabel: 'Montagem da Diretriz', icon: Layers },
          { key: 'tratamento' as const, label: 'Trat.', fullLabel: 'Tratamento Atual', icon: CheckCircle2 },
          { key: 'progressao' as const, label: 'Prog.', fullLabel: 'Progressão', icon: TrendingUp },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setTabAtiva(tab.key)}
              className={`flex items-center justify-center gap-1 sm:gap-2 py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg text-[10px] sm:text-sm font-medium transition-all ${tabAtiva === tab.key
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              <Icon className="icon-sm sm:h-4 sm:w-4 shrink-0" />
              <span className="sm:hidden">{tab.label}</span>
              <span className="hidden sm:inline">{tab.fullLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tabAtiva === 'fases' && diretrizSnapshot && (
        <ProtocoloDiretrizEditor
          protocoloId={protocoloId}
          snapshot={diretrizSnapshot}
          faseAtual={faseAtual}
          queixa={protocolo.titulo}
        />
      )}
      {tabAtiva === 'fases' && !diretrizSnapshot && (
        <div className="clinical-card text-sm text-muted-foreground">Esta diretriz ainda não possui um resumo clínico salvo.</div>
      )}



      {tabAtiva === 'tratamento' && (
        <ProtocoloTratamento protocoloId={protocoloId} faseAtual={faseAtual} />
      )}

      {tabAtiva === 'progressao' && (
        <ProtocoloProgressao
          protocoloId={protocoloId}
          progressao={progressao}
          fases={fases}
          faseAtual={faseAtual}
        />
      )}

      {/* Instruções de segurança */}
      <div className="clinical-card border-l-4 border-destructive mt-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-destructive">
          ⚠️ Instruções de Segurança
        </h3>
        <p className="text-sm font-medium text-foreground mb-2">Interrompa o exercício imediatamente se sentir:</p>
        <ul className="space-y-1 text-sm text-muted-foreground">
          {['Dor aguda ou súbita', 'Tontura ou falta de ar', 'Formigamento ou dormência nos membros', 'Qualquer sensação anormal ou preocupante'].map(a => (
            <li key={a} className="flex items-center gap-2">
              <span className="text-destructive">•</span> {a}
            </li>
          ))}
        </ul>
      </div>
        </>
      )}
    </div>
  );
}
