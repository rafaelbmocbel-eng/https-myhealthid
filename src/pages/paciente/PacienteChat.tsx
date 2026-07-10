import { useNavigate } from 'react-router-dom';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PortalErrorState from '@/components/paciente/PortalErrorState';
import ChatWindow from '@/components/chat/ChatWindow';
import { MessageSquare, Loader2, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';
import { usePacientePortal } from '@/hooks/usePacientePortal';

export default function PacienteChat() {
  const navigate = useNavigate();
  const { hasFeature, isFree } = useWellnessAccess();
  const { paciente, isLoading: loading, isError, refetch } = usePacientePortal();

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="flex flex-col h-[calc(100dvh-8rem)]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="h-page">Mensagens</h1>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <PortalErrorState onRetry={() => refetch()} />
          ) : isFree && !hasFeature('chat') ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="icon-md text-primary" />
              </div>
              <div>
                <p className="text-base font-bold text-foreground">Chat com profissional</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  Disponível para assinantes do plano Wellness Premium.
                </p>
              </div>
              <Button onClick={() => navigate('/paciente/plano')} size="sm" className="gap-1">
                <Sparkles className="icon-sm" /> Conhecer plano
              </Button>
            </div>
          ) : paciente?.terapeuta_id ? (
            <ChatWindow
              pacienteId={paciente.id}
              terapeutaId={paciente.terapeuta_id}
              remetente="paciente"
              className="flex-1 min-h-0"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              {paciente ? 'Você ainda não está vinculado a um profissional' : 'Perfil não encontrado'}
            </div>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
