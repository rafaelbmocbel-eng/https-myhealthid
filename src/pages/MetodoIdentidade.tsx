import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Activity, User, Plus } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { MyIDWizard } from '@/components/myid/MyIDWizard';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function MetodoIdentidade() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const initialPacienteId = searchParams.get('paciente') || '';
  const [pacienteId, setPacienteId] = useState<string>(initialPacienteId);
  const [iniciado, setIniciado] = useState(false);

  // Carrega lista de pacientes para o seletor
  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes-lista', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome, telefone, email')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const pacienteSelecionado = useMemo(
    () => pacientes.find((p) => p.id === pacienteId),
    [pacientes, pacienteId]
  );

  const handleComplete = async (result: any, rawData: any) => {
    if (!pacienteId || !user?.id) return;
    try {
      await supabase.from('myid_avaliacoes').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        respostas_brutas: rawData,
        resultado_processado: result,
        status: 'concluido',
      });
      qc.invalidateQueries({ queryKey: ['myid-avaliacoes'] });
      qc.invalidateQueries({ queryKey: ['avaliacoes-identidade'] });
      toast({
        title: 'Avaliação concluída!',
        description: 'Método Identidade salvo com sucesso.',
      });
      // Volta ao perfil do paciente após salvar
      setTimeout(() => navigate(`/pacientes/${pacienteId}`), 1500);
    } catch (e: any) {
      toast({
        title: 'Erro ao salvar',
        description: e.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => (iniciado ? setIniciado(false) : navigate(-1))}
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
                Método Identidade
              </h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px]">
                Avaliação Padrão
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Avaliação clínica multidimensional · MyID v2.0
            </p>
          </div>
        </div>

        {/* Estado: Selecionar paciente */}
        {!iniciado && (
          <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h2 className="font-semibold text-foreground">Selecione o paciente</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Escolha o paciente que será avaliado pelo Método Identidade. A avaliação
                    incluirá os 6 blocos do questionário MyID.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Paciente
                </label>
                <PacienteSelect
                  pacientes={pacientes as any}
                  value={pacienteId}
                  onChange={setPacienteId}
                  placeholder="Buscar paciente..."
                />
                {pacienteSelecionado && (
                  <p className="text-xs text-muted-foreground pt-1">
                    Selecionado:{' '}
                    <span className="font-medium text-foreground">
                      {pacienteSelecionado.nome} {pacienteSelecionado.sobrenome}
                    </span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                {[
                  '1. Anamnese',
                  '2. Dor',
                  '3. Funcionalidade',
                  '4. Cinesiofobia',
                  '5. Regulação',
                  '6. Estrutural',
                ].map((b) => (
                  <div
                    key={b}
                    className="text-[11px] px-3 py-2 rounded-lg bg-card border text-muted-foreground text-center"
                  >
                    {b}
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                className="w-full gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={!pacienteId}
                onClick={() => setIniciado(true)}
              >
                <Plus className="h-4 w-4" />
                Iniciar Avaliação
              </Button>

              {!pacienteId && (
                <p className="text-[11px] text-center text-muted-foreground">
                  Selecione um paciente para habilitar o início da avaliação.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Estado: Wizard ativo */}
        {iniciado && pacienteSelecionado && (
          <div className="bg-card rounded-xl border shadow-sm p-4 sm:p-6">
            <div className="mb-4 pb-4 border-b">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Avaliando
              </p>
              <p className="font-bold text-foreground">
                {pacienteSelecionado.nome} {pacienteSelecionado.sobrenome}
              </p>
            </div>
            <MyIDWizard onComplete={handleComplete} />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
