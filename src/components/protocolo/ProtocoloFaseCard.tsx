import { Badge } from '@/components/ui/badge';
import {
  Target, CheckCircle2, Dumbbell, Clock, RotateCcw,
  ChevronDown, ChevronUp, Brain, Zap, BookOpen, Shield, Check
} from 'lucide-react';

const FASE_CORES = ['bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-red-500'];
const FASE_BORDE = ['border-indigo-200', 'border-amber-200', 'border-emerald-200', 'border-red-200'];
const FASE_BG = ['bg-indigo-50', 'bg-amber-50', 'bg-emerald-50', 'bg-red-50'];
const FASE_TEXT = ['text-indigo-700', 'text-amber-700', 'text-emerald-700', 'text-red-700'];
const FASE_LABELS = ['🛡️ Controle & Proteção', '🔧 Mobilização & Proliferação', '💪 Remodelação & Força', '🎯 Funcionalidade & Retorno'];

const COMPLEXIDADE_BADGE: Record<string, { label: string; class: string }> = {
  basica: { label: 'Básica', class: 'bg-emerald-100 text-emerald-700' },
  intermediaria: { label: 'Intermediária', class: 'bg-amber-100 text-amber-700' },
  avancada: { label: 'Avançada', class: 'bg-red-100 text-red-700' },
};

const EVIDENCIA_BADGE: Record<string, { label: string; class: string }> = {
  A: { label: 'Nível A', class: 'bg-emerald-100 text-emerald-700' },
  B: { label: 'Nível B', class: 'bg-blue-100 text-blue-700' },
  C: { label: 'Nível C', class: 'bg-amber-100 text-amber-700' },
};

interface Props {
  fase: any;
  idx: number;
  prescricoes: any[];
  tecnicas: any[];
  selectedTecnicaIds?: Set<string>;
  onToggleTecnica?: (id: string, faseNum: number) => void;
  isOpen: boolean;
  onToggle: () => void;
  isAtual: boolean;
  isConcluida: boolean;
}

export default function ProtocoloFaseCard({
  fase, idx, prescricoes, tecnicas, selectedTecnicaIds, onToggleTecnica,
  isOpen, onToggle, isAtual, isConcluida
}: Props) {
  return (
    <div className={`rounded-xl border-2 ${FASE_BORDE[idx % 4]} overflow-hidden ${isAtual ? 'ring-2 ring-primary shadow-lg' : ''}`}>
      {/* Header */}
      <button
        className={`w-full flex items-center justify-between p-4 ${FASE_BG[idx % 4]} text-left`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${FASE_CORES[idx % 4]} flex items-center justify-center text-white text-sm font-bold shrink-0 relative`}>
            {isConcluida ? <CheckCircle2 className="h-5 w-5" /> : fase.numero_fase}
            {isAtual && (
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${FASE_TEXT[idx % 4]}`}>{fase.titulo}</span>
              {isAtual && <Badge className="bg-primary text-primary-foreground text-[10px] h-5">Fase Atual</Badge>}
              {isConcluida && <Badge className="bg-emerald-100 text-emerald-700 text-[10px] h-5 border-0">✓ Concluída</Badge>}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
              <span>Semanas {fase.semanas_inicio}-{fase.semanas_fim}</span>
              <span>·</span>
              <span>{fase.sessoes_por_semana}x/semana</span>
              <span>·</span>
              <span>{prescricoes.length} exercício{prescricoes.length !== 1 ? 's' : ''}</span>
              {tecnicas.length > 0 && (
                <>
                  <span>·</span>
                  <span className={tecnicas.filter(t => selectedTecnicaIds?.has(t.id)).length > 0 ? 'text-primary font-medium' : ''}>
                    {tecnicas.filter(t => selectedTecnicaIds?.has(t.id)).length}/{tecnicas.length} técnica{tecnicas.length !== 1 ? 's' : ''}
                  </span>
                </>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">{FASE_LABELS[idx % 4]}</div>
          </div>
        </div>
        {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {isOpen && (
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

          {/* Grid: Exercícios + Técnicas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Exercícios */}
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Dumbbell className="h-3 w-3 text-muted-foreground" />
                Exercícios ({prescricoes.length})
              </h4>
              {prescricoes.length > 0 ? (
                <div className="space-y-2">
                  {prescricoes.map((pres: any, i: number) => {
                    const ex = pres.exercicio;
                    return (
                      <div key={pres.id} className="bg-muted/40 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-full ${FASE_CORES[idx % 4]} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm text-foreground">{ex?.nome || 'Exercício'}</div>
                            {ex?.categoria && <Badge variant="outline" className="text-[10px] py-0 mt-0.5">{ex.categoria}</Badge>}
                          </div>
                        </div>
                        {ex?.descricao && <p className="text-xs text-muted-foreground mt-1 ml-8">{ex.descricao}</p>}
                        <div className="flex gap-3 mt-1.5 ml-8">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <RotateCcw className="h-2.5 w-2.5" />
                            {pres.series}× {pres.repeticoes}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-2.5 w-2.5" />
                            {pres.frequencia}
                          </span>
                        </div>
                        {pres.observacoes && (
                          <p className="text-xs text-amber-600 mt-1.5 ml-8 italic">💡 {pres.observacoes}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <Dumbbell className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  Sem exercícios prescritos.
                </div>
              )}
            </div>

            {/* Técnicas da fase */}
            <div>
              <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                <Brain className="h-3 w-3 text-muted-foreground" />
                Técnicas Indicadas ({tecnicas.length})
              </h4>
              {tecnicas.length > 0 ? (
                <div className="space-y-2">
                  {tecnicas.map((tec: any) => {
                    const evBadge = EVIDENCIA_BADGE[tec.nivel_evidencia] || EVIDENCIA_BADGE.B;
                    const compBadge = COMPLEXIDADE_BADGE[tec.complexidade] || COMPLEXIDADE_BADGE.basica;
                    const isSelected = selectedTecnicaIds?.has(tec.id);

                    return (
                      <div
                        key={tec.id}
                        className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected
                          ? 'bg-primary/10 border-primary/40 shadow-sm'
                          : 'bg-muted/40 hover:bg-muted/60 border-transparent'
                          }`}
                        onClick={() => onToggleTecnica?.(tec.id, fase.numero_fase)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                              }`}>
                              {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                            </div>
                            <span className="text-sm font-medium">{tec.nome}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <Badge className={`${evBadge.class} border-0 text-[8px] h-4 px-1`}>
                              <BookOpen className="h-2 w-2 mr-0.5" />
                              {evBadge.label}
                            </Badge>
                            <Badge className={`${compBadge.class} border-0 text-[8px] h-4 px-1`}>
                              {compBadge.label}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 ml-7">{tec.descricao}</p>
                        {tec.indicacoes && (
                          <p className="text-[10px] text-emerald-600 mt-1 ml-7">✓ {tec.indicacoes}</p>
                        )}
                        {tec.contraindicacoes && (
                          <p className="text-[10px] text-destructive mt-0.5 ml-7">⚠ {tec.contraindicacoes}</p>
                        )}
                        {tec.parametros && typeof tec.parametros === 'object' && (
                          <div className="flex flex-wrap gap-1 mt-1.5 ml-7">
                            {Object.entries(tec.parametros).slice(0, 3).map(([k, v]) => (
                              <Badge key={k} variant="outline" className="text-[9px] py-0 h-4">
                                {k}: {String(v)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-muted-foreground">
                  <Brain className="h-6 w-6 mx-auto mb-1 opacity-30" />
                  Sem técnicas específicas para esta fase.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
