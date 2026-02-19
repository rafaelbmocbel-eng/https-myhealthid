import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, Download, Activity, Target, CheckCircle2,
  Dumbbell, Clock, RotateCcw, ChevronDown, ChevronUp, Loader2
} from 'lucide-react';
import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  protocoloId: string;
  onBack: () => void;
  onExportPDF: () => void;
}

const FASE_CORES = ['bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-red-500'];
const FASE_BORDE = ['border-indigo-200', 'border-amber-200', 'border-emerald-200', 'border-red-200'];
const FASE_BG = ['bg-indigo-50', 'bg-amber-50', 'bg-emerald-50', 'bg-red-50'];
const FASE_TEXT = ['text-indigo-700', 'text-amber-700', 'text-emerald-700', 'text-red-700'];

export default function ProtocoloViewer({ protocoloId, onBack, onExportPDF }: Props) {
  const [fasesAbertas, setFasesAbertas] = useState<Set<number>>(new Set([0]));

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

  const toggleFase = (idx: number) => {
    setFasesAbertas(prev => {
      const s = new Set(prev);
      if (s.has(idx)) s.delete(idx); else s.add(idx);
      return s;
    });
  };

  if (loadingProt || loadingFases || loadingPres) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!protocolo) return null;

  const scores = protocolo.scores_avaliacao || {};
  const scoreItems = [
    { key: 'E', label: 'Estrutural', color: 'bg-blue-500' },
    { key: 'P', label: 'Psico-Comp.', color: 'bg-red-500' },
    { key: 'C', label: 'Contextual', color: 'bg-orange-500' },
    { key: 'F', label: 'Biológico', color: 'bg-green-500' },
    { key: 'D', label: 'Dor', color: 'bg-purple-500' },
    { key: 'R', label: 'Regulação', color: 'bg-slate-500' },
    { key: 'EFI', label: 'Funcional.', color: 'bg-teal-500' },
  ];

  return (
    <div className="container py-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onExportPDF} className="bg-gradient-primary text-white gap-2">
          <Download className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Cabeçalho protocolo */}
      <div className="clinical-card bg-gradient-hero text-white mb-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-70 uppercase tracking-widest mb-1">Protocolo de Tratamento Personalizado</div>
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

      {/* Scores da Avaliação */}
      {Object.keys(scores).length > 0 && (
        <div className="clinical-card mb-6">
          <h3 className="font-semibold mb-4">📊 Scores da Avaliação Base</h3>
          <div className="space-y-3">
            {scoreItems.map(item => {
              const val = (scores[item.key] as number) || 0;
              const pct = Math.min(100, (val / 10) * 100);
              return (
                <div key={item.key} className="flex items-center gap-3">
                  <div className="w-24 text-xs text-muted-foreground shrink-0">{item.label}</div>
                  <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`h-3 rounded-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-12 text-right text-xs font-bold text-foreground">{val.toFixed(1)}/10</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

      {/* 4 Fases */}
      <div className="space-y-4 mb-6">
        <h3 className="font-semibold text-lg">📋 Protocolo por Fases</h3>
        {fases.map((fase: any, idx: number) => {
          const exerciciosDaFase = prescricoes.filter((p: any) => p.fase_id === fase.id);
          const aberta = fasesAbertas.has(idx);

          return (
            <div key={fase.id} className={`rounded-xl border-2 ${FASE_BORDE[idx % 4]} overflow-hidden`}>
              {/* Cabeçalho da fase */}
              <button
                className={`w-full flex items-center justify-between p-4 ${FASE_BG[idx % 4]} text-left`}
                onClick={() => toggleFase(idx)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full ${FASE_CORES[idx % 4]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                    {fase.numero_fase}
                  </div>
                  <div>
                    <div className={`font-semibold ${FASE_TEXT[idx % 4]}`}>{fase.titulo}</div>
                    <div className="text-xs text-muted-foreground">
                      Semanas {fase.semanas_inicio}-{fase.semanas_fim} · {fase.sessoes_por_semana}x por semana · {exerciciosDaFase.length} exercício{exerciciosDaFase.length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {aberta ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {aberta && (
                <div className="p-4 space-y-4">
                  {/* Objetivos */}
                  {fase.objetivos?.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        Objetivos da Fase
                      </h4>
                      <ul className="space-y-1">
                        {fase.objetivos.map((obj: string, i: number) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                            {obj}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Exercícios */}
                  {exerciciosDaFase.length > 0 ? (
                    <div>
                      <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                        <Dumbbell className="h-3 w-3 text-muted-foreground" />
                        Exercícios Prescritos ({exerciciosDaFase.length})
                      </h4>
                      <div className="space-y-3">
                        {exerciciosDaFase.map((pres: any, i: number) => {
                          const ex = pres.exercicio;
                          return (
                            <div key={pres.id} className="bg-muted/40 rounded-lg p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <div className={`w-6 h-6 rounded-full ${FASE_CORES[idx % 4]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                                    {i + 1}
                                  </div>
                                  <div>
                                    <div className="font-medium text-sm text-foreground">{ex?.nome || 'Exercício'}</div>
                                    {ex?.categoria && (
                                      <Badge variant="outline" className="text-xs py-0 mt-0.5">{ex.categoria}</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {ex?.descricao && (
                                <p className="text-xs text-muted-foreground mt-2 ml-8">{ex.descricao}</p>
                              )}

                              {/* Prescrição */}
                              <div className="flex gap-4 mt-2 ml-8">
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <RotateCcw className="h-3 w-3" />
                                  {pres.series} séries × {pres.repeticoes} rep
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {pres.frequencia}
                                </div>
                                {pres.tempo_descanso && (
                                  <div className="text-xs text-muted-foreground">
                                    Descanso: {pres.tempo_descanso}
                                  </div>
                                )}
                              </div>

                              {pres.observacoes && (
                                <p className="text-xs text-amber-600 mt-2 ml-8 italic">💡 {pres.observacoes}</p>
                              )}

                              {/* Instruções */}
                              {ex?.instrucoes?.length > 0 && (
                                <div className="mt-2 ml-8">
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Como fazer:</p>
                                  <ol className="space-y-0.5">
                                    {ex.instrucoes.map((inst: string, j: number) => (
                                      <li key={j} className="text-xs text-muted-foreground">
                                        {j + 1}. {inst}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {/* Precauções */}
                              {ex?.precaucoes?.length > 0 && (
                                <div className="mt-2 ml-8 p-2 bg-red-50 rounded-md">
                                  <p className="text-xs font-medium text-red-600 mb-0.5">⚠ Precauções:</p>
                                  {ex.precaucoes.map((p: string, j: number) => (
                                    <p key={j} className="text-xs text-red-500">• {p}</p>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 text-sm text-muted-foreground">
                      <Dumbbell className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      Nenhum exercício prescrito para esta fase ainda.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Instruções de segurança */}
      <div className="clinical-card border-l-4 border-destructive">
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
