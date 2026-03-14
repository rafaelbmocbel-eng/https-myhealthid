import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarDays, TrendingUp, Activity, ChevronRight } from 'lucide-react';
import { format, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';

interface PacienteInfo {
  id: string;
  nome: string;
  sobrenome: string;
}

interface Agendamento {
  id: string;
  data_inicio: string;
  data_fim: string;
  titulo: string | null;
  status: string;
  tipo_atendimento: string | null;
}

export default function PacienteDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paciente, setPaciente] = useState<PacienteInfo | null>(null);
  const [proximasConsultas, setProximasConsultas] = useState<Agendamento[]>([]);
  const [totalAvaliacoes, setTotalAvaliacoes] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      // Get patient record
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!pac) {
        setLoading(false);
        return;
      }
      setPaciente(pac);

      // Get upcoming appointments
      const now = new Date().toISOString();
      const { data: agendas } = await supabase
        .from('agendamentos')
        .select('id, data_inicio, data_fim, titulo, status, tipo_atendimento')
        .eq('paciente_id', pac.id)
        .gte('data_inicio', now)
        .in('status', ['confirmado', 'pendente'])
        .order('data_inicio', { ascending: true })
        .limit(3);

      setProximasConsultas(agendas || []);

      // Count evaluations
      const { count } = await supabase
        .from('avaliacoes_identidade')
        .select('id', { count: 'exact', head: true })
        .eq('paciente_id', pac.id);

      setTotalAvaliacoes(count || 0);
      setLoading(false);
    };

    fetchData();
  }, [user]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bom dia';
    if (hour < 18) return 'Boa tarde';
    return 'Boa noite';
  };

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
          {/* Greeting */}
          <div>
            <h1 className="text-lg font-black text-foreground">
              {getGreeting()}, {paciente?.nome || '...'} 👋
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Acompanhe sua evolução e próximas consultas.
            </p>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-primary/5 border-primary/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-medium text-muted-foreground">Próximas consultas</span>
                </div>
                <span className="text-2xl font-black text-foreground">{proximasConsultas.length}</span>
              </CardContent>
            </Card>
            <Card className="bg-accent/5 border-accent/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4" style={{ color: 'hsl(40 95% 52%)' }} />
                  <span className="text-[11px] font-medium text-muted-foreground">Avaliações</span>
                </div>
                <span className="text-2xl font-black text-foreground">{totalAvaliacoes}</span>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming appointments */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-foreground">Próximas consultas</h2>
              <button
                onClick={() => navigate('/paciente/agenda')}
                className="text-[11px] font-semibold text-primary flex items-center gap-0.5"
              >
                Ver agenda <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            {proximasConsultas.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma consulta agendada</p>
                  <button
                    onClick={() => navigate('/paciente/agenda')}
                    className="text-xs font-semibold text-primary mt-2"
                  >
                    Agendar agora
                  </button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {proximasConsultas.map((ag) => (
                  <Card key={ag.id} className="hover:shadow-sm transition-shadow">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'hsl(213 55% 22% / 0.08)' }}
                      >
                        <CalendarDays className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {ag.titulo || ag.tipo_atendimento || 'Consulta'}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(parseISO(ag.data_inicio), "EEEE, d 'de' MMM · HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          ag.status === 'confirmado'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {ag.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Health evolution teaser */}
          <Card className="border-primary/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">Sua evolução</p>
                  <p className="text-[11px] text-muted-foreground">
                    {totalAvaliacoes > 0
                      ? `${totalAvaliacoes} avaliação(ões) registrada(s)`
                      : 'Responda o questionário para começar'}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
