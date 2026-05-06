import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Sparkles } from 'lucide-react';
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import Body3DAvatar, { painMapToText } from './Body3DAvatar';

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
  const navigate = useNavigate();
  const [painMap, setPainMap] = useState<Record<string, number>>({});
  const painText = painMapToText(painMap);

  return (
    <div className="space-y-3">
      {/* MyID — link minimalista */}
      <button
        onClick={() => navigate(`/metodo-identidade?paciente=${pacienteId}`)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ClipboardList className="h-3 w-3" />
        <span>MyID Presencial</span>
      </button>

      {/* Voz / Áudio / Escrita — sem moldura */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          A IA estrutura a avaliação automaticamente a partir da sua fala, áudio ou texto.
        </p>
        <VoiceAssessment
          mode="voice"
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          contextPrefix={painText || undefined}
          onAssessmentComplete={onAssessmentComplete}
        />
      </div>

      {/* Avatar 3D — sem moldura */}
      <Body3DAvatar value={painMap} onChange={setPainMap} />
    </div>
  );
}
