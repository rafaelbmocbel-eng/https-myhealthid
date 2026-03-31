import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Download, Activity, Target, CheckCircle2,
  Loader2, Zap, Shield, Beaker, TrendingUp, Layers, FileText
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ProtocoloScores from './ProtocoloScores';
import ProtocoloTratamento from './ProtocoloTratamento';
import ProtocoloProgressao from './ProtocoloProgressao';
import ProtocoloDiretrizResumo from './ProtocoloDiretrizResumo';
import { createLegacyDiretrizSnapshot, getDiretrizSnapshotFromScores } from '@/lib/protocoloSnapshot';

interface Props {
  protocoloId: string;
  onBack: () => void;
  onExportPDF: () => void;
  onNewDiretriz?: () => void;
}

export default function ProtocoloViewer({ protocoloId, onBack, onExportPDF, onNewDiretriz }: Props) {
  const [tabAtiva, setTabAtiva] = useState<'fases' | 'tecnicas' | 'tratamento' | 'progressao'>('fases');

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
  const diretrizSnapshot =
    getDiretrizSnapshotFromScores(protocolo.scores_avaliacao) ??
    createLegacyDiretrizSnapshot({ fases, prescricoes, tratamentos });

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
          <Button onClick={onExportPDF} className="bg-gradient-primary text-white gap-2" size="sm">
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
              Diretriz de Tratamento Baseada em Evidências
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
      </div>

      {protocolo.descricao && (
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
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="sm:hidden">{tab.label}</span>
              <span className="hidden sm:inline">{tab.fullLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {tabAtiva === 'fases' && (
        <ProtocoloDiretrizResumo fases={diretrizSnapshot?.fases || []} faseAtual={faseAtual} />
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
    </div>
  );
}
