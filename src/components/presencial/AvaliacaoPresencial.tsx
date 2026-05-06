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
    <div className="space-y-4">
      {/* MyID — discreto no topo */}
      <button
        onClick={() => navigate(`/metodo-identidade?paciente=${pacienteId}`)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
      >
        <ClipboardList className="h-4 w-4 text-violet-600 shrink-0" />
        <span className="text-xs font-medium flex-1">MyID Presencial</span>
        <span className="text-[10px] text-muted-foreground">Aplicar →</span>
      </button>

      {/* Voz / Áudio / Escrita */}
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shrink-0">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">Avaliação Clínica</h3>
            <p className="text-xs text-muted-foreground">
              Grave por voz, envie áudio (até 25MB) ou descreva o caso.
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

      {/* Avatar 3D */}
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shrink-0">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm">Avatar 3D — Mapa de Dor</h3>
            <p className="text-xs text-muted-foreground">
              Clique nas regiões para registrar a dor (0–10).
            </p>
          </div>
        </div>
        <Body3DAvatar value={painMap} onChange={setPainMap} />
      </div>
    </div>
  );
}

