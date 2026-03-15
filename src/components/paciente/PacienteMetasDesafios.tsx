import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Target, Trophy, Heart, Dumbbell, BookOpen,
  CheckCircle2, Circle, Flame, Zap
} from 'lucide-react';
import { subDays } from 'date-fns';

interface Meta {
  id: string;
  titulo: string;
  descricao: string;
  progresso: number; // 0-100
  meta: number;
  atual: number;
  unidade: string;
  icon: any;
  cor: string;
  concluida: boolean;
  xpRecompensa: number;
}

interface Props {
  pacienteId: string;
}

export default function PacienteMetasDesafios({ pacienteId }: Props) {
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const fetchMetas = async () => {
      const now = new Date();
      const weekAgo = subDays(now, 7);
      const metasList: Meta[] = [];

      // Fetch all data in parallel
      const [diarioRes, treinosRes, execucoesRes, streakRes] = await Promise.all([
        supabase.from('daily_logs')
          .select('id, created_at')
          .eq('paciente_id', pacienteId)
          .gte('created_at', weekAgo.toISOString()),
        supabase.from('studio_treinos')
          .select('id, titulo, frequencia')
          .eq('paciente_id', pacienteId)
          .eq('publicado', true)
          .eq('ativo', true),
        supabase.from('studio_execucoes')
          .select('treino_id, data_execucao')
          .eq('paciente_id', pacienteId)
          .eq('completo', true)
          .gte('data_execucao', weekAgo.toISOString()),
        // Streak: count consecutive days with diary entries
        supabase.from('daily_logs')
          .select('created_at')
          .eq('paciente_id', pacienteId)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      const diarios = diarioRes.data || [];
      const treinos = treinosRes.data || [];
      const execucoes = execucoesRes.data || [];

      // Calculate diary streak
      let streakCount = 0;
      const streakLogs = streakRes.data || [];
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const checkDate = subDays(today, i);
        const dateStr = checkDate.toISOString().split('T')[0];
        const hasEntry = streakLogs.some(l =>
          l.created_at.startsWith(dateStr)
        );
        if (hasEntry) {
          streakCount++;
        } else if (i > 0) {
          break; // streak broken
        }
      }
      setStreak(streakCount);

      // Meta 1: Diário de Saúde - 7 dias na semana
      const diasDiario = new Set(diarios.map(d => d.created_at.split('T')[0])).size;
      metasList.push({
        id: 'diario-semanal',
        titulo: 'Diário Consistente',
        descricao: 'Preencha o diário de saúde todos os dias esta semana',
        progresso: Math.min(100, (diasDiario / 7) * 100),
        meta: 7,
        atual: diasDiario,
        unidade: 'dias',
        icon: Heart,
        cor: 'text-rose-600',
        concluida: diasDiario >= 7,
        xpRecompensa: 50,
      });

      // Meta 2: Treinos da semana
      const totalTreinosMeta = treinos.reduce((acc, t) => {
        return acc + parseInt(t.frequencia?.match(/\d+/)?.[0] || '3');
      }, 0);
      const totalTreinosFeitos = execucoes.length;
      metasList.push({
        id: 'treinos-semanal',
        titulo: 'Plano de Treino',
        descricao: 'Complete todos os treinos prescritos esta semana',
        progresso: totalTreinosMeta > 0 ? Math.min(100, (totalTreinosFeitos / totalTreinosMeta) * 100) : 0,
        meta: totalTreinosMeta || 3,
        atual: totalTreinosFeitos,
        unidade: 'treinos',
        icon: Dumbbell,
        cor: 'text-blue-600',
        concluida: totalTreinosFeitos >= totalTreinosMeta && totalTreinosMeta > 0,
        xpRecompensa: 75,
      });

      // Meta 3: Streak challenge
      metasList.push({
        id: 'streak-5',
        titulo: 'Sequência de 5 Dias',
        descricao: 'Mantenha 5 dias consecutivos de diário preenchido',
        progresso: Math.min(100, (streakCount / 5) * 100),
        meta: 5,
        atual: streakCount,
        unidade: 'dias seguidos',
        icon: Flame,
        cor: 'text-orange-600',
        concluida: streakCount >= 5,
        xpRecompensa: 100,
      });

      setMetas(metasList);
      setLoading(false);
    };

    fetchMetas();
  }, [pacienteId]);

  if (loading) return null;

  const concluidas = metas.filter(m => m.concluida).length;
  const progressoGeral = metas.length > 0 
    ? metas.reduce((acc, m) => acc + m.progresso, 0) / metas.length 
    : 0;

  return (
    <div className="space-y-3">
      {/* Header com streak */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Metas da Semana</h2>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-900/30">
            <Flame className="h-3 w-3 text-orange-600" />
            <span className="text-[10px] font-black text-orange-600">{streak} dias</span>
          </div>
        )}
      </div>

      {/* Progresso geral */}
      <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/15">
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-foreground">
              {concluidas}/{metas.length} metas concluídas
            </span>
            <span className="text-[10px] font-bold text-primary">{progressoGeral.toFixed(0)}%</span>
          </div>
          <Progress value={progressoGeral} className="h-2" />
          {concluidas === metas.length && metas.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Trophy className="h-3.5 w-3.5 text-yellow-600" />
              <span className="text-[10px] font-bold text-yellow-700">
                Todas as metas concluídas! 🎉 +{metas.reduce((a, m) => a + m.xpRecompensa, 0)} XP
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de metas */}
      {metas.map(meta => (
        <Card key={meta.id} className={meta.concluida ? 'opacity-75' : ''}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                meta.concluida ? 'bg-emerald-100 dark:bg-emerald-900/30' : 'bg-muted'
              }`}>
                {meta.concluida ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <meta.icon className={`h-4 w-4 ${meta.cor}`} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className={`text-xs font-bold ${meta.concluida ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {meta.titulo}
                  </p>
                  <Badge variant="outline" className="text-[8px] py-0 h-3.5 gap-0.5">
                    <Zap className="h-2 w-2" /> +{meta.xpRecompensa} XP
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground mb-1.5">{meta.descricao}</p>
                <div className="flex items-center gap-2">
                  <Progress value={meta.progresso} className="h-1.5 flex-1" />
                  <span className="text-[10px] font-bold text-muted-foreground shrink-0">
                    {meta.atual}/{meta.meta} {meta.unidade}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
