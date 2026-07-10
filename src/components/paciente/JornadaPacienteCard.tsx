import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';
import PacienteMetasDesafios from '@/components/paciente/PacienteMetasDesafios';

interface Props {
  pacienteId: string;
}

/**
 * Jornada do paciente (missões + conquistas), autossuficiente e IDÊNTICA nos
 * dois apps (cliente e profissional): a busca é por paciente_id (sem filtrar
 * por terapeuta), e as missões/conquistas derivam do MyID respondido pelo
 * cliente. O mesmo componente é usado no dashboard do paciente e no botão
 * "Portal" do app do profissional.
 */
export default function JornadaPacienteCard({ pacienteId }: Props) {
  // Última avaliação MyID concluída — mesma fonte das missões (por paciente_id).
  const { data: scores } = useQuery({
    queryKey: ['jornada-myid-scores', pacienteId],
    enabled: !!pacienteId,
    queryFn: async () => {
      const { data: avId } = await supabase
        .from('avaliacoes_identidade')
        .select('score_r, myid_analysis')
        .eq('paciente_id', pacienteId)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      const row = avId?.[0];
      if (!row) return null;
      const analysis = (row as any).myid_analysis as any;
      const cs = analysis?.componentScores || analysis?.component_scores || {};
      return {
        R: cs.R ?? (Number((row as any).score_r) || 0),
        HID: cs.HID ?? 5,
        AF: cs.AF ?? 5,
        P: cs.P ?? 0,
      };
    },
  });

  const badges = scores ? [
    { condition: scores.HID > 7, label: '💧 Hidratado',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300' },
    { condition: scores.R   > 7, label: '🌙 Sono em dia', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' },
    { condition: scores.AF  > 6, label: '🏃 Ativo',       cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' },
    { condition: scores.P   < 4, label: '🧘 Equilíbrio',  cls: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300' },
  ].filter(b => b.condition) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Rocket className="h-4 w-4 text-primary" />
        <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Jornada do paciente
        </h4>
      </div>

      {/* Missões / desafios da semana — o mesmo que o paciente vê no portal dele */}
      <PacienteMetasDesafios pacienteId={pacienteId} />

      {/* Conquistas (badges do MyID) */}
      <Card className="rounded-xl border-border/40 shadow-xs">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Award className="icon-sm text-primary" />
            <h4 className="h-card">Conquistas do paciente</h4>
          </div>
          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((b, i) => (
                <Badge key={i} variant="secondary" className={cn('rounded-full px-3 py-1 gap-2', b.cls)}>
                  {b.label}
                </Badge>
              ))}
              <p className="w-full text-xs text-muted-foreground mt-1">
                Conquistas desbloqueadas conforme os hábitos melhoram o MyID.
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Nenhuma conquista desbloqueada ainda. Hidratação, sono, movimento e equilíbrio
              emocional desbloqueiam badges à medida que o MyID melhora.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
