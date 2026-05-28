import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PacienteConsentimentoLGPD from '@/components/paciente/PacienteConsentimentoLGPD';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Mail, Phone, Calendar, Pencil } from 'lucide-react';

export default function PacientePerfil() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paciente, setPaciente] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pacientes')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setPaciente(data));
  }, [user]);

  const infoItems = paciente
    ? [
        { icon: User, label: 'Nome', value: `${paciente.nome} ${paciente.sobrenome}` },
        { icon: Mail, label: 'E-mail', value: paciente.email || '—' },
        { icon: Phone, label: 'Telefone', value: paciente.telefone || '—' },
        { icon: Calendar, label: 'Nascimento', value: paciente.data_nascimento ? format(parseISO(paciente.data_nascimento), 'dd/MM/yyyy') : '—' },
      ]
    : [];

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-lg font-black text-foreground">Meu Perfil</h1>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/paciente/completar-cadastro?edit=1')}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Editar cadastro
            </Button>
          </div>

          <Card>
            <CardContent className="p-4 space-y-3">
              {infoItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center">
                    <item.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                    <p className="text-sm font-medium text-foreground">{item.value}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {paciente?.id && paciente?.terapeuta_id && (
            <PacienteConsentimentoLGPD
              pacienteId={paciente.id}
              terapeutaId={paciente.terapeuta_id}
            />
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
