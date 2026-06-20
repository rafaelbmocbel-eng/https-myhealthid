import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ClipboardList } from 'lucide-react';
import { useEventosAnatomicos, useSaveEventoAnatomico, type EventoAnatomico } from '@/hooks/useEventosAnatomicos';

interface HistoricoClinicoRevisaoProps {
  pacienteId: string;
}

const CATEGORIA_LABEL: Record<string, string> = {
  fratura: 'Fratura óssea',
  cirurgia: 'Cirurgia de grande porte',
  pequena_cirurgia: 'Pequeno procedimento',
  trauma_chicote: 'Trauma tipo chicote',
  traumatismo: 'Traumatismo',
  acidente: 'Acidente',
  malformacao: 'Malformação/condição congênita',
  doenca_sistemica: 'Doença sistêmica',
  tratamento_doenca: 'Tratamento de doença',
  medicamento: 'Medicação de uso regular',
};

export default function HistoricoClinicoRevisao({ pacienteId }: HistoricoClinicoRevisaoProps) {
  const { data: eventos = [] } = useEventosAnatomicos(pacienteId);
  const saveEvento = useSaveEventoAnatomico();
  const qc = useQueryClient();

  const pendentes = useMemo(
    () => eventos.filter((e) =>
      e.tipo_diagnostico === 'historico_relatado' && e.metadata?.revisado_profissional !== true
    ),
    [eventos],
  );

  const invalidar = () => qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });

  const confirmar = (ev: EventoAnatomico) => {
    saveEvento.mutate(
      {
        id: ev.id,
        paciente_id: pacienteId,
        regiao_id: ev.regiao_id,
        tipo_achado: ev.tipo_achado,
        tipo_diagnostico: 'achado_clinico',
        status: 'ativo',
        metadata: { ...ev.metadata, revisado_profissional: true },
      },
      { onSuccess: invalidar },
    );
  };

  const descartar = (ev: EventoAnatomico) => {
    saveEvento.mutate(
      {
        id: ev.id,
        paciente_id: pacienteId,
        regiao_id: ev.regiao_id,
        tipo_achado: ev.tipo_achado,
        metadata: { ...ev.metadata, revisado_profissional: true },
      },
      { onSuccess: invalidar },
    );
  };

  if (pendentes.length === 0) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" /> Histórico Clínico relatado pelo paciente
          <Badge variant="warning" size="sm">{pendentes.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Selecione o que entra no Avatar Clínico. Itens não confirmados não afetam nenhum score.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendentes.map((ev) => (
          <div
            key={ev.id}
            className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <span className="truncate font-medium">{ev.tipo_achado}</span>
              <span className="text-muted-foreground"> ({ev.regiao_id})</span>
              <div className="text-[11px] text-muted-foreground">
                {CATEGORIA_LABEL[ev.metadata?.categoria] || ev.metadata?.categoria}
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => confirmar(ev)}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Confirmar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => descartar(ev)}>
                <XCircle className="mr-1 h-3.5 w-3.5" /> Descartar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
