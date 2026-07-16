import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, AlertTriangle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { INSTRUMENTOS, CLASSIFICACAO_LABEL, type InstrumentoId } from '@/lib/instrumentosClinicos';

// Visão do PROFISSIONAL: últimos escores dos questionários clínicos do
// paciente, com destaque para o que exige atenção (PAR-Q+ positivo, alto
// risco no START Back, PHQ-4/ISI graves).
const ATENCAO = new Set(['requer_atencao', 'alto_risco', 'insonia_grave', 'insonia_moderada', 'moderado', 'grave', 'funcao_reduzida']);

export default function QuestionariosClinicosCard({ pacienteId }: { pacienteId: string }) {
  const { data: itens = [] } = useQuery({
    queryKey: ['questionarios-clinicos-pro', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('questionarios_clinicos')
        .select('instrumento, escore, classificacao, respostas, created_at')
        .eq('paciente_id', pacienteId).order('created_at', { ascending: false }).limit(40);
      const ultimos = new Map<string, any>();
      (data || []).forEach((r: any) => { if (!ultimos.has(r.instrumento)) ultimos.set(r.instrumento, r); });
      return [...ultimos.values()];
    },
  });

  if (itens.length === 0) return null;

  return (
    <Card className="border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="icon-sm text-violet-600 shrink-0" />
          Questionários clínicos
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {itens.map((r: any) => {
          const inst = INSTRUMENTOS[r.instrumento as InstrumentoId];
          const atencao = ATENCAO.has(r.classificacao);
          const metas = r.respostas?.atividades as { nome: string; nota: number }[] | undefined;
          return (
            <div key={r.instrumento} className="p-2.5 rounded-lg border border-border/40 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium flex-1 min-w-0">
                  {inst?.sigla || r.instrumento}
                  <span className="text-xs text-muted-foreground font-normal"> · {format(parseISO(r.created_at), 'dd/MM/yyyy')}</span>
                </p>
                <span className="text-xs font-bold tabular-nums">{Number(r.escore).toLocaleString('pt-BR')}</span>
                <Badge variant={atencao ? 'destructive' : 'secondary'} className="text-[10px] gap-1">
                  {atencao && <AlertTriangle className="h-3 w-3" />}
                  {CLASSIFICACAO_LABEL[r.classificacao] || r.classificacao}
                </Badge>
              </div>
              {metas && (
                <p className="text-[11px] text-muted-foreground">
                  Metas do paciente: {metas.map(a => `${a.nome} (${a.nota}/10)`).join(' · ')}
                </p>
              )}
            </div>
          );
        })}
        <p className="text-[10px] text-muted-foreground">
          Instrumentos validados respondidos no portal. PAR-Q+ com atenção = avaliar antes de liberar treino.
        </p>
      </CardContent>
    </Card>
  );
}
