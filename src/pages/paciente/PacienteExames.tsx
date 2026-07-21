import { Loader2, ClipboardList } from 'lucide-react';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PortalErrorState from '@/components/paciente/PortalErrorState';
import ExamesPresenciaisCard from '@/components/presencial/ExamesPresenciaisCard';
import { usePacientePortal } from '@/hooks/usePacientePortal';

// Portal do cliente — aba "Exames": mostra (só leitura) os exames presenciais
// registrados pelo profissional (bioimpedância, dinamometria, baropodometria,
// teste de pisada).
export default function PacienteExames() {
  const { paciente, isLoading, isError, refetch } = usePacientePortal();

  if (isLoading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  if (isError) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <PortalErrorState onRetry={() => refetch()} />
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="max-w-2xl mx-auto p-3 sm:p-4 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-teal-600" />
            <div>
              <h1 className="text-lg font-black text-foreground">Exames</h1>
              <p className="text-[11px] text-muted-foreground">Resultados dos exames feitos com o seu profissional.</p>
            </div>
          </div>
          {paciente && <ExamesPresenciaisCard pacienteId={paciente.id} soLeitura defaultAberto />}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
