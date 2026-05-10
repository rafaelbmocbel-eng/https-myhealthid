import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import ChatWindow from '@/components/chat/ChatWindow';
import { MessageSquare, Loader2, Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useWellnessAccess } from '@/hooks/useWellnessAccess';

export default function PacienteChat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { hasFeature, isFree } = useWellnessAccess();
  const [paciente, setPaciente] = useState<{ id: string; terapeuta_id: string; nome: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pacientes')
      .select('id, terapeuta_id, nome')
      .eq('user_id', user.id)
      .eq('ativo', true)
      .limit(1)
      .single()
      .then(({ data }) => {
        setPaciente(data);
        setLoading(false);
      });
  }, [user]);

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="flex flex-col h-[calc(100dvh-8rem)]">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold">Mensagens</h1>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
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
          ) : paciente ? (
            <ChatWindow
              pacienteId={paciente.id}
              terapeutaId={paciente.terapeuta_id}
              remetente="paciente"
              className="flex-1 min-h-0"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
              Perfil não encontrado
            </div>
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
