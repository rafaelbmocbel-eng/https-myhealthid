import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarDays, Heart, Bell, ChevronRight,
} from 'lucide-react';
import { format, parseISO, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Alerta {
  id: string;
  tipo: 'consulta' | 'diario' | 'questionario';
  titulo: string;
  descricao: string;
  urgencia: 'alta' | 'media' | 'baixa';
  acao?: string;
  rota?: string;
}

interface Props {
  pacienteId: string;
}

export default function PacienteAlertasLembretes({ pacienteId }: Props) {
  const navigate = useNavigate();
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlertas = async () => {
      const now = new Date();
      const alerts: Alerta[] = [];

      // 1. Próxima consulta nas próximas 48h
      const { data: proxConsultas } = await supabase
        .from('agendamentos')
        .select('id, data_inicio, titulo, tipo_atendimento, status')
        .eq('paciente_id', pacienteId)
        .gte('data_inicio', now.toISOString())
        .in('status', ['confirmado', 'pendente'])
        .order('data_inicio', { ascending: true })
        .limit(3);

      proxConsultas?.forEach(c => {
        const horasAte = differenceInHours(parseISO(c.data_inicio), now);
        if (horasAte <= 48) {
          alerts.push({
            id: `consulta-${c.id}`,
            tipo: 'consulta',
            titulo: horasAte <= 2 ? '⏰ Consulta em breve!' : '📅 Consulta próxima',
            descricao: `${c.titulo || c.tipo_atendimento || 'Consulta'} — ${format(parseISO(c.data_inicio), "EEEE, HH:mm", { locale: ptBR })}`,
            urgencia: horasAte <= 2 ? 'alta' : horasAte <= 24 ? 'media' : 'baixa',
            acao: 'Ver agenda',
            rota: '/paciente/agenda',
          });
        }
      });

      // 2. Diário não preenchido hoje
      const { count: diarioHoje } = await supabase
        .from('daily_logs')
        .select('id', { count: 'exact', head: true })
        .eq('paciente_id', pacienteId)
        .gte('created_at', new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString());

      if (!diarioHoje || diarioHoje === 0) {
        alerts.push({
          id: 'diario-hoje',
          tipo: 'diario',
          titulo: '💊 Registre seu dia',
          descricao: 'Seu diário de saúde ainda não foi preenchido hoje. Leva menos de 1 minuto!',
          urgencia: now.getHours() >= 18 ? 'media' : 'baixa',
          acao: 'Preencher agora',
          rota: '/paciente/diario',
        });
      }

      // 3. Questionários pendentes
      const { count: pendentes } = await supabase
        .from('myid_avaliacoes')
        .select('id', { count: 'exact', head: true })
        .eq('paciente_id', pacienteId)
        .neq('status', 'concluido');

      if (pendentes && pendentes > 0) {
        alerts.push({
          id: 'quest-pendente',
          tipo: 'questionario',
          titulo: '📋 Questionário pendente',
          descricao: `Você tem ${pendentes} questionário(s) aguardando resposta`,
          urgencia: 'media',
          acao: 'Responder',
          rota: '/paciente/questionarios',
        });
      }

      // Sort by urgency
      const urgOrder = { alta: 0, media: 1, baixa: 2 };
      alerts.sort((a, b) => urgOrder[a.urgencia] - urgOrder[b.urgencia]);

      setAlertas(alerts);
      setLoading(false);
    };

    fetchAlertas();
  }, [pacienteId]);

  if (loading || alertas.length === 0) return null;

  const iconMap = {
    consulta: CalendarDays,
    diario: Heart,
    questionario: Bell,
  };

  const urgColorMap = {
    alta: 'border-red-300 bg-red-50 dark:bg-red-950/20',
    media: 'border-amber-300 bg-amber-50 dark:bg-amber-950/20',
    baixa: 'border-primary/20 bg-primary/5',
  };

  const urgBadgeMap = {
    alta: 'bg-red-100 text-red-700 border-red-200',
    media: 'bg-amber-100 text-amber-700 border-amber-200',
    baixa: 'bg-primary/10 text-primary border-primary/20',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-1">
        <Bell className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold text-foreground">Lembretes & Alertas</h2>
      </div>

      {alertas.slice(0, 4).map(alerta => {
        const Icon = iconMap[alerta.tipo];
        return (
          <Card
            key={alerta.id}
            className={`cursor-pointer hover:shadow-sm transition-all ${urgColorMap[alerta.urgencia]}`}
            onClick={() => alerta.rota && navigate(alerta.rota)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-background/60 flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{alerta.titulo}</p>
                <p className="text-[10px] text-muted-foreground truncate">{alerta.descricao}</p>
              </div>
              {alerta.acao && (
                <span className="text-[10px] font-semibold text-primary flex items-center gap-0.5 shrink-0">
                  {alerta.acao} <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
