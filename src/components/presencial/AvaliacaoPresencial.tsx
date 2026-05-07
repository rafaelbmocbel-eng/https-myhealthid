import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Sparkles } from 'lucide-react';
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import Body3DAvatar, { painMapToText, REGIONS, STRUCTURES } from './Body3DAvatar';

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
  const [structState, setStructState] = useState<Record<string, string[]>>({});
  const painText = painMapToText(painMap);

  const painRegionsCatalog = useMemo(() => ({
    regions: REGIONS.map(r => ({ id: r.id, label: `${r.label} (${r.view === 'back' ? 'posterior' : 'anterior'})` })),
    catalog: Object.fromEntries(
      Object.entries(STRUCTURES).map(([rid, cats]) => [
        rid,
        { categories: cats as Record<string, string[]> },
      ])
    ),
  }), []);

  const handlePainExtracted = (
    findings: Array<{ region_id: string; intensity: number; structures: string[] }>
  ) => {
    setPainMap(prev => {
      const next = { ...prev };
      findings.forEach(f => { next[f.region_id] = f.intensity; });
      return next;
    });
    setStructState(prev => {
      const next = { ...prev };
      findings.forEach(f => {
        const existing = next[f.region_id] ?? [];
        const merged = Array.from(new Set([...existing, ...(f.structures ?? [])]));
        if (merged.length) next[f.region_id] = merged;
      });
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {/* MyID — link minimalista */}
      <button
        onClick={() => navigate(`/metodo-identidade?paciente=${pacienteId}&iniciar=1`)}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ClipboardList className="h-3 w-3" />
        <span>MyID Presencial</span>
      </button>

      {/* Voz / Áudio / Escrita — sem moldura */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          A IA estrutura a avaliação e marca o avatar a partir da sua fala.
        </p>
        <VoiceAssessment
          mode="voice"
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          contextPrefix={painText || undefined}
          onAssessmentComplete={onAssessmentComplete}
          onPainExtracted={handlePainExtracted}
          painRegionsCatalog={painRegionsCatalog}
        />
      </div>

      {/* Avatar — recebe marcações automáticas da voz */}
      <Body3DAvatar
        value={painMap}
        onChange={setPainMap}
        structures={structState}
        onStructuresChange={setStructState}
      />
    </div>
  );
}
