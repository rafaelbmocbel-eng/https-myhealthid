import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Sparkles, Stethoscope, Save } from 'lucide-react';
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import Body3DAvatar, { painMapToText, REGIONS, STRUCTURES } from './Body3DAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLenteAtiva, temBloco } from '@/hooks/useLenteAtiva';
import MyIDResumoInline from './MyIDResumoInline';
import { useSaveEventoAnatomico } from '@/hooks/useEventosAnatomicos';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';


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
  const { user } = useAuth();
  const { data: lente } = useLenteAtiva();
  const [painMap, setPainMap] = useState<Record<string, number>>({});
  const [structState, setStructState] = useState<Record<string, string[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const saveEvento = useSaveEventoAnatomico();
  const painText = painMapToText(painMap);

  const mostraAvatar = temBloco(lente, 'avatar');

  // Usa a mesma query key da AvaliacaoVozAtual para que invalidations sincronizem o avatar
  const { data: latestAval } = useQuery({
    queryKey: ['avaliacao-voz-latest', pacienteId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_voz')
        .select('id, resultado')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId && !!user && mostraAvatar,
  });

  useEffect(() => {
    const meta = (latestAval?.resultado as any)?._meta;
    if (meta?.mapa_dor && typeof meta.mapa_dor === 'object' && Object.keys(meta.mapa_dor).length) {
      setPainMap(meta.mapa_dor);
    }
  }, [latestAval?.id, latestAval?.resultado]);

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

  const handleSaveToAvatar = async () => {
    const entries = Object.entries(painMap).filter(([_, intensity]) => intensity > 0);
    if (entries.length === 0) {
      toast({ title: "Nenhum achado para salvar", description: "Marque as regiões no avatar primeiro." });
      return;
    }

    setIsSaving(true);
    try {
      const promises = entries.map(([regiao_id, intensity]) => {
        const structures = structState[regiao_id] || [];
        return saveEvento.mutateAsync({
          paciente_id: pacienteId,
          regiao_id,
          sistema: 'musculoesqueletico',
          origem: 'exame_clinico',
          tipo_achado: 'Achado em Avaliação Presencial',
          estrutura: structures.join(', ') || null,
          severidade: intensity >= 7 ? 3 : intensity >= 4 ? 2 : 1,
          status: 'ativo',
          visivel_paciente: true,
          data_inicio: new Date().toISOString().slice(0, 10),
          notas_clinicas: `Sincronizado automaticamente da Avaliação Presencial. Intensidade: ${intensity}/10. Estruturas: ${structures.join(', ')}`,
        });
      });

      await Promise.all(promises);
      toast({ title: "Avatar Sincronizado", description: `${entries.length} achados foram salvos no Avatar Clínico.` });
    } catch (error) {
      console.error("Erro ao sincronizar avatar:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Resumo MyID do paciente — base para montar exercícios */}
      <MyIDResumoInline pacienteId={pacienteId} />

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
        <VoiceAssessment
          mode="voice"
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
        <div className="space-y-4">
          <div className="flex items-center justify-between border-t border-border/40 pt-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              Mapeamento de Achados
            </h3>
            <Button 
              size="sm" 
              className="h-8 gap-1.5" 
              onClick={handleSaveToAvatar}
              disabled={isSaving || Object.keys(painMap).length === 0}
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Salvando..." : "Salvar no Avatar Clínico"}
            </Button>
          </div>
          
          <Body3DAvatar
            value={painMap}
            onChange={setPainMap}
            structures={structState}
            onStructuresChange={setStructState}
          />
        </div>
      )}
    </div>
  );
}
