import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PortalErrorState from '@/components/paciente/PortalErrorState';
import AvatarClinicoCard from '@/components/avatar/AvatarClinicoCard';
import { Card, CardContent } from '@/components/ui/card';
import { Activity, Info, Loader2 } from 'lucide-react';
import { usePacientePortal } from '@/hooks/usePacientePortal';

const LEGENDA = [
  { cor: '#dc2626', label: 'Condição ativa' },
  { cor: '#f97316', label: 'Em tratamento' },
  { cor: '#eab308', label: 'Condição crônica' },
  { cor: '#0d9488', label: 'Histórico confirmado' },
  { cor: '#9ca3af', label: 'Resolvido' },
];

export default function PacienteAvatar() {
  const { paciente, isLoading: loading, isError, refetch } = usePacientePortal();
  const pacienteId = paciente?.id ?? null;
  const semProfissional = !!paciente && !paciente.terapeuta_id;

  if (loading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="flex items-center justify-center min-h-[50vh]">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
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
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">

          {/* Cabeçalho */}
          <div>
            <h1 className="h-page flex items-center gap-2">
              <Activity className="icon-md text-primary" /> Meu Avatar Clínico
            </h1>
            <p className="text-caption mt-0.5">
              Os pontos coloridos mostram regiões do corpo com condições registradas pelo seu profissional.
            </p>
          </div>

          {/* Legenda */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" /> O que as cores significam?
              </p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                {LEGENDA.map(item => (
                  <div key={item.cor} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.cor }} />
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/40 pt-2">
                Apenas o que seu profissional autorizar aparece aqui. Toque em uma região para ver mais detalhes sobre a condição.
                Históricos que você informou no questionário só ficam visíveis após confirmação do profissional.
              </p>
            </CardContent>
          </Card>

          {/* Avatar ou placeholders */}
          {semProfissional ? (
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">Você ainda não está vinculado a um profissional</p>
                <p className="text-xs text-muted-foreground">
                  Quando seu profissional registrar condições e autorizar a visualização, elas aparecerão aqui.
                </p>
                <button
                  onClick={() => { window.location.href = '/paciente/profissionais'; }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold active:scale-95"
                >
                  Encontrar meu profissional →
                </button>
              </CardContent>
            </Card>
          ) : pacienteId ? (
            <AvatarClinicoCard pacienteId={pacienteId} isProfessional={false} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-xs text-muted-foreground">Perfil não encontrado.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
