import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { ClipboardList } from 'lucide-react';

export default function PacienteQuestionarios() {
  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto">
          <h1 className="text-lg font-black text-foreground mb-4">Questionários</h1>
          <Card>
            <CardContent className="p-8 text-center">
              <ClipboardList className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Em breve</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Seus questionários aparecerão aqui para responder em etapas.
              </p>
            </CardContent>
          </Card>
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
