import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Sparkles, Stethoscope } from 'lucide-react';
import AvaliacaoVozHub from '@/components/voice/AvaliacaoVozHub';
import Body3DAvatar, { painMapToText, REGIONS, STRUCTURES } from './Body3DAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useLenteAtiva, temBloco } from '@/hooks/useLenteAtiva';

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
  const { data: lente } = useLenteAtiva();
  const [painMap, setPainMap] = useState<Record<string, number>>({});
  const [structState, setStructState] = useState<Record<string, string[]>>({});
  const painText = painMapToText(painMap);

  const mostraAvatar = temBloco(lente, 'avatar');

  // Carrega o último mapa de dor salvo desse paciente para que a marcação persista entre sessões
  useEffect(() => {
    if (!pacienteId || !mostraAvatar) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('avaliacoes_voz')
        .select('resultado')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const meta = (data.resultado as any)?._meta;
      if (meta?.mapa_dor && typeof meta.mapa_dor === 'object') {
        setPainMap((prev) => (Object.keys(prev).length ? prev : meta.mapa_dor));
      }
    })();
    return () => { cancelled = true; };
  }, [pacienteId, mostraAvatar]);

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
      {/* Topo: MyID + chip da lente ativa */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => navigate(`/metodo-identidade?paciente=${pacienteId}&iniciar=1`)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ClipboardList className="h-3 w-3" />
          <span>MyID Presencial</span>
        </button>
        {lente && (
          <button
            onClick={() => navigate('/configuracoes')}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded-full border border-border/40 px-2 py-0.5"
            title="Trocar profissão em Configurações"
          >
            <Stethoscope className="h-3 w-3" />
            <span>Lente: {lente.nome_exibicao}</span>
          </button>
        )}
      </div>

      {/* Voz / Áudio / Escrita — sem moldura */}
      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          A IA estrutura a avaliação{mostraAvatar ? ' e marca o avatar' : ''} a partir da sua fala.
        </p>
        <AvaliacaoVozHub
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          contextPrefix={painText || undefined}
          onAssessmentComplete={onAssessmentComplete}
          onPainExtracted={mostraAvatar ? handlePainExtracted : undefined}
          painRegionsCatalog={mostraAvatar ? painRegionsCatalog : undefined}
          painMap={mostraAvatar ? painMap : undefined}
          perfilProfissional={lente?.id}
        />
      </div>

      {/* Avatar — só para lentes que têm o bloco 'avatar' (fisio, T.O.) */}
      {mostraAvatar && (
        <Body3DAvatar
          value={painMap}
          onChange={setPainMap}
          structures={structState}
          onStructuresChange={setStructState}
        />
      )}
    </div>
  );
}
