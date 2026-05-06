import { useState } from 'react';
import { User, Activity } from 'lucide-react';
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
  const [painMap, setPainMap] = useState<Record<string, number>>({});
  const [includePainInPrompt, setIncludePainInPrompt] = useState(true);

  const painText = painMapToText(painMap);
  const assessmentKey = `unified-${Object.keys(painMap).length}-${serviceType}`;

  return (
    <div className="space-y-6">
      {/* ── Avatar 3D ── */}
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center">
            <User className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Avatar 3D — Mapa de Dor</h3>
            <p className="text-xs text-muted-foreground">
              Clique nas regiões para registrar a dor (0–10). O mapa entra automaticamente na avaliação.
            </p>
          </div>
        </div>
        <Body3DAvatar value={painMap} onChange={setPainMap} />
        {painText && (
          <div className="mt-3 flex items-center gap-2">
            <input
              id="include-pain"
              type="checkbox"
              checked={includePainInPrompt}
              onChange={(e) => setIncludePainInPrompt(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <label htmlFor="include-pain" className="text-xs text-muted-foreground cursor-pointer">
              Incluir mapa de dor na avaliação por IA
            </label>
          </div>
        )}
      </div>

      {/* ── Avaliação unificada: voz, áudio ou texto ── */}
      <div className="clinical-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-sm">Avaliação Clínica</h3>
            <p className="text-xs text-muted-foreground">
              Grave por voz, envie um áudio (até 25MB) ou descreva o caso por escrito — tudo em um só lugar.
            </p>
          </div>
        </div>

        <VoiceAssessment
          key={assessmentKey}
          mode="voice"
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          contextPrefix={includePainInPrompt && painText ? painText : undefined}
          onAssessmentComplete={onAssessmentComplete}
        />
      </div>
    </div>
  );
}
