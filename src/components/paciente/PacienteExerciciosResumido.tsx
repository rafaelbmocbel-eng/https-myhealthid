import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Dumbbell, ChevronRight, Clock, Play, CheckCircle2
} from 'lucide-react';
import { subDays } from 'date-fns';

interface TreinoResumido {
  id: string;
  titulo: string;
  duracao_estimada: string | null;
  intensidade: string | null;
  frequencia: string | null;
  feitosEstaSemana: number;
  metaSemanal: number;
}

interface Props {
  pacienteId: string;
}

export default function PacienteExerciciosResumido({ pacienteId }: Props) {
  const navigate = useNavigate();
  const [treinos, setTreinos] = useState<TreinoResumido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const weekAgo = subDays(new Date(), 7);

      const [treinosRes, execucoesRes] = await Promise.all([
        supabase.from('studio_treinos')
          .select('id, titulo, duracao_estimada, intensidade, frequencia')
          .eq('paciente_id', pacienteId)
          .eq('publicado', true)
          .eq('ativo', true)
          .order('ordem', { ascending: true }),
        supabase.from('studio_execucoes')
          .select('treino_id')
          .eq('paciente_id', pacienteId)
          .eq('completo', true)
          .gte('data_execucao', weekAgo.toISOString()),
      ]);

      const treinosList = treinosRes.data || [];
      const execucoes = execucoesRes.data || [];

      setTreinos(treinosList.map(t => ({
        ...t,
        feitosEstaSemana: execucoes.filter(e => e.treino_id === t.id).length,
        metaSemanal: parseInt(t.frequencia?.match(/\d+/)?.[0] || '3'),
      })));
      setLoading(false);
    };

    fetch();
  }, [pacienteId]);

  if (loading || treinos.length === 0) return null;

  const totalPendentes = treinos.reduce((a, t) => a + Math.max(0, t.metaSemanal - t.feitosEstaSemana), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Exercícios para Casa</h2>
        </div>
        <button
          onClick={() => navigate('/paciente/exercicios')}
          className="text-[11px] font-semibold text-primary flex items-center gap-0.5"
        >
          Ver todos <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      {totalPendentes > 0 && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <Play className="h-3 w-3 text-blue-600" />
          <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400">
            {totalPendentes} sessão(es) pendente(s) esta semana
          </span>
        </div>
      )}

      {treinos.map(treino => {
        const concluido = treino.feitosEstaSemana >= treino.metaSemanal;
        const progresso = Math.min(100, (treino.feitosEstaSemana / treino.metaSemanal) * 100);

        return (
          <Card
            key={treino.id}
            className="cursor-pointer hover:shadow-sm transition-all"
            onClick={() => navigate('/paciente/exercicios')}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                concluido ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-primary/10'
              }`}>
                {concluido ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Dumbbell className="h-4 w-4 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${concluido ? 'text-muted-foreground' : 'text-foreground'}`}>
                  {treino.titulo}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {treino.duracao_estimada && (
                    <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {treino.duracao_estimada}
                    </span>
                  )}
                  {treino.intensidade && (
                    <Badge variant="outline" className="text-[8px] py-0 h-4">{treino.intensidade}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Progress value={progresso} className="h-1 flex-1" />
                  <span className="text-[9px] font-bold text-muted-foreground">
                    {treino.feitosEstaSemana}/{treino.metaSemanal}
                  </span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
