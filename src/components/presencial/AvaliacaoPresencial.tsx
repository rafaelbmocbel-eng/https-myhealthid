import { Activity } from 'lucide-react';
import VoiceAssessment from '@/components/voice/VoiceAssessment';

interface Props {
  pacienteId: string;
  patientName: string;
  serviceType?: 'identidade' | 'cobzero' | 'studio';
  onAssessmentComplete?: () => void;
}

export default function AvaliacaoPresencial({
  pacienteId,
  patientName,
  serviceType = 'identidade',
  onAssessmentComplete,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Avaliação Clínica</h3>
            <p className="text-xs text-muted-foreground">
              Grave por voz, envie um áudio (até 25MB) ou descreva o caso por escrito.
              A IA monta a avaliação com base nas melhores revisões sistemáticas da PubMed.
            </p>
          </div>
        </div>

        <VoiceAssessment
          mode="voice"
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          onAssessmentComplete={onAssessmentComplete}
        />
      </div>
    </div>
  );
}
