import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Dumbbell,
  Target,
} from 'lucide-react';
import type { DiretrizSnapshotPhase } from '@/lib/protocoloSnapshot';

interface Props {
  fases: DiretrizSnapshotPhase[];
  faseAtual: number;
}

export default function ProtocoloDiretrizResumo({ fases, faseAtual }: Props) {
  const [fasesAbertas, setFasesAbertas] = useState<Set<number>>(
    () => new Set([Math.min(Math.max(faseAtual - 1, 0), Math.max(fases.length - 1, 0))]),
  );

  const toggleFase = (index: number) => {
    setFasesAbertas((previous) => {
      const next = new Set(previous);

      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }

      return next;
    });
  };

  if (fases.length === 0) {
    return (
      <div className="clinical-card text-sm text-muted-foreground">
        Esta diretriz ainda não possui um resumo clínico salvo.
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {fases.map((fase, index) => {
        const isOpen = fasesAbertas.has(index);
        const isAtual = faseAtual === fase.numero;

        return (
          <div
            key={`${fase.numero}-${fase.titulo}`}
            className={`rounded-xl border border-border bg-card overflow-hidden ${
              isAtual ? 'ring-2 ring-primary/20' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => toggleFase(index)}
              className={`w-full flex items-center justify-between gap-4 p-4 text-left transition-colors ${
                isAtual ? 'bg-primary/5' : 'bg-muted/30 hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                    isAtual
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground'
                  }`}
                >
                  {fase.numero}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{fase.titulo}</span>
                    {isAtual && <Badge>Fase atual</Badge>}
                  </div>

                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2 mt-1">
                    <span>Semanas {fase.semanas}</span>
                    {fase.frequenciaSemanal > 0 && <span>{fase.frequenciaSemanal}x/semana</span>}
                    <span>{fase.exercicios.length} exercício{fase.exercicios.length !== 1 ? 's' : ''}</span>
                    <span>{fase.tecnicas.length} técnica{fase.tecnicas.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              </div>

              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>

            {isOpen && (
              <div className="p-4 space-y-4">
                <div className="rounded-xl border border-border bg-muted/20 p-4">
                  <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-foreground">
                    <Target className="h-4 w-4 text-primary" />
                    Objetivo da fase
                  </div>
                  <p className="text-sm text-muted-foreground">{fase.objetivo}</p>

                  {(fase.demandasAlvo?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(fase.demandasAlvo ?? []).map((demanda) => (
                        <Badge key={demanda} variant="secondary" className="text-xs">
                          {demanda}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Dumbbell className="h-4 w-4 text-primary" />
                      Exercícios selecionados
                    </div>

                    {fase.exercicios.length > 0 ? (
                      fase.exercicios.map((exercicio) => (
                        <div key={`${fase.numero}-${exercicio.nome}`} className="rounded-xl border border-border bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-foreground">{exercicio.nome}</div>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                <Badge variant="outline" className="text-[10px]">
                                  {exercicio.categoria}
                                </Badge>
                                <span>{exercicio.series}×{exercicio.repeticoes}</span>
                                {exercicio.duracao && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {exercicio.duracao}
                                  </span>
                                )}
                              </div>
                            </div>
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          </div>

                          {exercicio.descricao && (
                            <p className="text-xs text-muted-foreground mt-2">{exercicio.descricao}</p>
                          )}

                          {exercicio.motivo && (
                            <p className="text-xs text-primary mt-2">↳ {exercicio.motivo}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                        Nenhum exercício foi selecionado nesta fase.
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Brain className="h-4 w-4 text-primary" />
                      Técnicas selecionadas
                    </div>

                    {fase.tecnicas.length > 0 ? (
                      fase.tecnicas.map((tecnica) => (
                        <div key={`${fase.numero}-${tecnica.nome}`} className="rounded-xl border border-border bg-background p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium text-sm text-foreground">{tecnica.nome}</div>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                                {tecnica.duracao && (
                                  <span className="inline-flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {tecnica.duracao}
                                  </span>
                                )}
                                {tecnica.frequencia && <span>{tecnica.frequencia}</span>}
                              </div>
                            </div>
                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          </div>

                          {tecnica.descricao && (
                            <p className="text-xs text-muted-foreground mt-2">{tecnica.descricao}</p>
                          )}

                          {tecnica.motivo && (
                            <p className="text-xs text-primary mt-2">↳ {tecnica.motivo}</p>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                        Nenhuma técnica foi selecionada nesta fase.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}