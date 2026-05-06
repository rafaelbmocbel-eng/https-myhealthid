import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Activity, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    <div className="space-y-6">
      {/* MyID — opcional */}
      <div className="clinical-card flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0">
          <ClipboardList className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm">MyID v2.0</p>
          <p className="text-xs text-muted-foreground">Aplique o questionário se necessário.</p>
        </div>
        <Button size="sm" onClick={() => navigate(`/metodo-identidade?paciente=${pacienteId}`)}>
          Abrir MyID
        </Button>
      </div>

      {/* Avatar 3D */}
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Avatar 3D — Mapa de Dor</h3>
            <p className="text-xs text-muted-foreground">
              Clique nas regiões para registrar a dor (0–10).
            </p>
          </div>
        </div>
        <Body3DAvatar value={painMap} onChange={setPainMap} />
      </div>

      {/* Voz / Áudio / Escrita */}
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Avaliação Clínica</h3>
            <p className="text-xs text-muted-foreground">
              Grave por voz, envie um áudio (até 25MB) ou descreva o caso por escrito.
            </p>
          </div>
        </div>

        <VoiceAssessment
          mode="voice"
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          contextPrefix={painText || undefined}
          onAssessmentComplete={onAssessmentComplete}
        />
      </div>
    </div>
  );
}
