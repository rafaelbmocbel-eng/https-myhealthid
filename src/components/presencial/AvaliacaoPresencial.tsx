import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Sparkles, Stethoscope, Save, Brain, Mic, Hand, Target, Wand2, AlertCircle } from 'lucide-react';
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import Body3DAvatar, { painMapToText, REGIONS, STRUCTURES } from './Body3DAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLenteAtiva, temBloco } from '@/hooks/useLenteAtiva';
import MyIDResumoInline from './MyIDResumoInline';
import { useSaveEventoAnatomico } from '@/hooks/useEventosAnatomicos';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { inferirAchadosDoMyID, type AchadoUnificado, type AvatarFonte } from '@/utils/anatomia/myidToAvatar';
import { extrairTextoDeObjeto } from '@/utils/anatomia/mapeamentoSintomas';

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

  // Estado unificado: cada região traz fontes + metadata
  const [painMap, setPainMap] = useState<Record<string, number>>({});
  const [structState, setStructState] = useState<Record<string, string[]>>({});
  const [origemPorRegiao, setOrigemPorRegiao] = useState<Record<string, AchadoUnificado>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [myidSyncDone, setMyidSyncDone] = useState(false);
  const saveEvento = useSaveEventoAnatomico();
  const qc = useQueryClient();
  const painText = painMapToText(painMap);

  const mostraAvatar = temBloco(lente, 'avatar');

  // 1) Última avaliação de voz (regions extraídas pela IA ficam em _meta.mapa_dor)
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

  // 2) Última avaliação presencial ou MyID — sem filtro de myid_score para incluir
  //    avaliações presenciais antigas que não geraram score digital
  const { data: lastMyID } = useQuery({
    queryKey: ['myid-latest-sync', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId && mostraAvatar,
  });

  // Contagem de eventos já salvos para este paciente (evita duplicar ao auto-processar)
  const { data: eventosExistentes = [] } = useQuery({
    queryKey: ['eventos-anatomicos-count', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('eventos_clinicos_anatomicos' as any)
        .select('id, regiao_id')
        .eq('paciente_id', pacienteId);
      return (data || []) as { id: string; regiao_id: string }[];
    },
    enabled: !!pacienteId && mostraAvatar,
  });

  // Refletir voz no painMap ao chegar
  useEffect(() => {
    const meta = (latestAval?.resultado as any)?._meta;
    if (meta?.mapa_dor && typeof meta.mapa_dor === 'object' && Object.keys(meta.mapa_dor).length) {
      mergeFromSource('voz_ia', meta.mapa_dor as Record<string, number>);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAval?.id]);

  // Unifica fontes e atualiza painMap + origemPorRegiao
  const mergeFromSource = (
    fonte: AvatarFonte,
    regioes: Record<string, number>,
    extra?: { myid_dimensao?: string; myid_score?: number; termos?: string[] },
  ) => {
    setPainMap(prevMap => {
      const nextMap = { ...prevMap };
      setOrigemPorRegiao(prevOrigem => {
        const nextOrigem = { ...prevOrigem };
        Object.entries(regioes).forEach(([rid, intensity]) => {
          if (intensity <= 0) return;
          const existing = nextOrigem[rid];
          if (!existing) {
            nextOrigem[rid] = {
              regiao_id: rid,
              intensidade: intensity,
              fontes: [fonte],
              triangulado: false,
              origem_principal: fonte,
              metadata: {
                fontes: [fonte],
                confianca: 'baixa',
                myid_dimensao_origem: extra?.myid_dimensao,
                myid_score_origem: extra?.myid_score,
                termos_voz: extra?.termos,
              },
            };
          } else {
            if (!existing.fontes.includes(fonte)) {
              existing.fontes.push(fonte);
              existing.metadata.fontes.push(fonte);
            }
            existing.intensidade = Math.max(existing.intensidade, intensity);
            if (existing.fontes.length >= 2) {
              existing.triangulado = true;
              existing.intensidade = Math.min(10, existing.intensidade + 1);
            }
            existing.metadata.confianca =
              existing.fontes.length >= 3 ? 'alta' :
              existing.fontes.length === 2 ? 'media' : 'baixa';
            if (fonte === 'manual') existing.origem_principal = 'manual';
          }
          nextMap[rid] = nextOrigem[rid].intensidade;
        });
        return nextOrigem;
      });
      return nextMap;
    });
  };

  // Botão Sincronizar — tenta painMap salvo primeiro, depois inferência por scores
  const handleSyncMyID = () => {
    if (!lastMyID) return;

    const dados = (lastMyID as any).dados_avaliacao || {};
    const painMapSalvo: Record<string, number> | null =
      dados?.painMap || dados?.mapa_dor || dados?.resultado?.painMap || null;

    if (painMapSalvo && Object.keys(painMapSalvo).length > 0) {
      let count = 0;
      Object.entries(painMapSalvo).forEach(([rid, intensity]) => {
        const val = Number(intensity);
        if (val > 0) {
          mergeFromSource('myid', { [rid]: val }, { myid_dimensao: 'mapa_dor' });
          count++;
        }
      });
      setMyidSyncDone(true);
      toast({ title: 'Mapa de dor sincronizado', description: `${count} regiões carregadas da avaliação presencial.` });
      return;
    }

    // Fallback: inferência a partir dos scores dimensionais
    const achados = inferirAchadosDoMyID({
      scores: {
        D: Number(lastMyID.score_d || 0),
        EFI: Number(lastMyID.score_efi || 0),
        P: Number(lastMyID.score_p || 0),
        I: Number(lastMyID.score_i || 0),
        R: Number(lastMyID.score_r || 0),
        C: Number(lastMyID.score_c || 0),
        N: Number(lastMyID.score_n || 0),
      },
      textoRelato: [
        (lastMyID as any).queixa_principal,
        (lastMyID as any).observacoes,
        JSON.stringify(dados),
      ].filter(Boolean).join(' '),
    });

    if (achados.length === 0) {
      toast({ title: 'Sem regiões mapeáveis', description: 'Esta avaliação não gerou regiões específicas para o avatar.' });
      return;
    }

    achados.forEach(a => {
      mergeFromSource('myid', { [a.regiao_id]: a.intensidade }, {
        myid_dimensao: a.myid_dimensao_origem,
        myid_score: a.myid_score_origem,
        termos: a.termos_voz,
      });
    });

    setMyidSyncDone(true);
    toast({
      title: 'Avaliação sincronizada ao Avatar',
      description: `${achados.length} regiões pré-marcadas com base nos scores.`,
    });
  };

  // Processa toda a avaliação e salva automaticamente no avatar clínico
  const handleAutoProcessar = async () => {
    if (!lastMyID || !user?.id) return;

    setIsAutoProcessing(true);
    try {
      const dados = (lastMyID as any).dados_avaliacao || {};
      const painMapSalvo: Record<string, number> | null =
        dados?.painMap || dados?.mapa_dor || dados?.resultado?.painMap || null;

      let regioesPorId: Record<string, number> = {};

      if (painMapSalvo && Object.keys(painMapSalvo).length > 0) {
        // Usa mapa de dor salvo diretamente
        Object.entries(painMapSalvo).forEach(([rid, v]) => {
          if (Number(v) > 0) regioesPorId[rid] = Number(v);
        });
      } else {
        // Fallback: inferência por scores dimensionais + texto
        const achados = inferirAchadosDoMyID({
          scores: {
            D: Number(lastMyID.score_d || 0),
            EFI: Number(lastMyID.score_efi || 0),
            P: Number(lastMyID.score_p || 0),
            I: Number(lastMyID.score_i || 0),
            R: Number(lastMyID.score_r || 0),
            C: Number(lastMyID.score_c || 0),
            N: Number(lastMyID.score_n || 0),
            AF: Number((lastMyID as any).score_af || 0),
            ERG: Number((lastMyID as any).score_erg || 0),
            HID: Number((lastMyID as any).score_hid || 0),
          },
          textoRelato: extrairTextoDeObjeto(dados),
        });
        achados.forEach(a => { regioesPorId[a.regiao_id] = a.intensidade; });
      }

      if (Object.keys(regioesPorId).length === 0) {
        toast({ title: 'Sem dados suficientes', description: 'A avaliação não gerou regiões mapeáveis. Marque manualmente no avatar.' });
        return;
      }

      // Filtra regiões que já existem (evita duplicatas)
      const regioesExistentes = new Set(eventosExistentes.map(e => e.regiao_id));
      const regioesNovas = Object.entries(regioesPorId).filter(([rid]) => !regioesExistentes.has(rid));

      if (regioesNovas.length === 0) {
        toast({ title: 'Avatar já atualizado', description: 'Todas as regiões desta avaliação já estão no avatar clínico.' });
        return;
      }

      await Promise.all(regioesNovas.map(([regiao_id, intensity]) =>
        saveEvento.mutateAsync({
          paciente_id: pacienteId,
          regiao_id,
          sistema: 'musculoesqueletico',
          origem: 'subjetivo_myid',
          tipo_achado: painMapSalvo ? 'Achado da avaliação presencial (mapa de dor)' : 'Achado inferido da avaliação (scores MyID)',
          estrutura: null,
          severidade: intensity >= 7 ? 3 : intensity >= 4 ? 2 : 1,
          status: 'ativo',
          visivel_paciente: true,
          data_inicio: new Date().toISOString().slice(0, 10),
          notas_clinicas: `Processado automaticamente da avaliação. Intensidade ${intensity}/10.`,
          metadata: {
            fontes: ['myid'],
            confianca: painMapSalvo ? 'media' : 'baixa',
            auto_processado: true,
          } as any,
        } as any)
      ));

      qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });
      qc.invalidateQueries({ queryKey: ['eventos-anatomicos-count', pacienteId] });
      toast({
        title: '✅ Avatar atualizado!',
        description: `${regioesNovas.length} região${regioesNovas.length > 1 ? 'ões geradas' : ' gerada'} automaticamente da avaliação.`,
      });
      onAssessmentComplete?.();
    } catch (err) {
      console.error('Erro ao auto-processar:', err);
      toast({ title: 'Erro ao processar', variant: 'destructive' });
    } finally {
      setIsAutoProcessing(false);
    }
  };

  const painRegionsCatalog = useMemo(() => ({
    regions: REGIONS.map(r => ({ id: r.id, label: `${r.label} (${r.view === 'back' ? 'posterior' : 'anterior'})` })),
    catalog: Object.fromEntries(
      Object.entries(STRUCTURES).map(([rid, cats]) => [rid, { categories: cats as Record<string, string[]> }])
    ),
  }), []);

  const handlePainExtracted = (
    findings: Array<{ region_id: string; intensity: number; structures: string[] }>,
  ) => {
    const regioes: Record<string, number> = {};
    findings.forEach(f => { regioes[f.region_id] = f.intensity; });
    mergeFromSource('voz_ia', regioes);

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

  // Quando o terapeuta clica direto no avatar (manual)
  const handlePainMapManual = (next: Record<string, number>) => {
    const diffs: Record<string, number> = {};
    Object.entries(next).forEach(([rid, intensity]) => {
      if ((painMap[rid] ?? 0) !== intensity && intensity > 0) {
        diffs[rid] = intensity;
      }
    });
    if (Object.keys(diffs).length > 0) mergeFromSource('manual', diffs);

    // Remoções manuais (clicou pra zerar)
    Object.keys(painMap).forEach(rid => {
      if (!(rid in next)) {
        setOrigemPorRegiao(prev => {
          const n = { ...prev };
          delete n[rid];
          return n;
        });
      }
    });
    setPainMap(next);
  };

  // ── Contadores para o header "Inteligência Cruzada"
  const stats = useMemo(() => {
    const fonteCount = { myid: 0, voz_ia: 0, manual: 0 };
    let trianguladas = 0;
    Object.values(origemPorRegiao).forEach(a => {
      a.fontes.forEach(f => { fonteCount[f]++; });
      if (a.triangulado) trianguladas++;
    });
    return { ...fonteCount, trianguladas, total: Object.keys(origemPorRegiao).length };
  }, [origemPorRegiao]);

  const handleSaveToAvatar = async () => {
    const entries = Object.entries(painMap).filter(([_, intensity]) => intensity > 0);
    if (entries.length === 0) {
      toast({ title: 'Nenhum achado para salvar', description: 'Marque ao menos uma região no avatar.' });
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all(entries.map(([regiao_id, intensity]) => {
        const origem = origemPorRegiao[regiao_id];
        const fonteAtiva: AvatarFonte = origem?.origem_principal ?? 'manual';
        const sistema = (origem?.metadata as any)?.sistema ?? 'musculoesqueletico';
        const structures = structState[regiao_id] || [];

        const fonteParaOrigemDB = (f: AvatarFonte): 'subjetivo_myid' | 'voz_ia' | 'exame_clinico' =>
          f === 'myid' ? 'subjetivo_myid' : f === 'voz_ia' ? 'voz_ia' : 'exame_clinico';

        return saveEvento.mutateAsync({
          paciente_id: pacienteId,
          regiao_id,
          sistema,
          origem: fonteParaOrigemDB(fonteAtiva),
          tipo_achado: origem?.triangulado
            ? '🎯 Achado triangulado (MyID + Voz + Exame)'
            : `Achado em Avaliação Presencial (${fonteAtiva})`,
          estrutura: structures.join(', ') || null,
          severidade: intensity >= 7 ? 3 : intensity >= 4 ? 2 : 1,
          status: 'ativo',
          visivel_paciente: true,
          data_inicio: new Date().toISOString().slice(0, 10),
          notas_clinicas: `Intensidade ${intensity}/10. Fontes: ${origem?.fontes.join(', ') ?? 'manual'}. ${origem?.metadata.myid_dimensao_origem ? `MyID origem: ${origem.metadata.myid_dimensao_origem} (${origem.metadata.myid_score_origem ?? '—'}/10). ` : ''}${origem?.metadata.termos_voz?.length ? `Termos: ${origem.metadata.termos_voz.join(', ')}. ` : ''}Estruturas: ${structures.join(', ') || '—'}`,
          metadata: {
            fontes: origem?.fontes ?? [fonteAtiva],
            confianca: origem?.metadata.confianca ?? 'baixa',
            myid_dimensao_origem: origem?.metadata.myid_dimensao_origem,
            myid_score_origem: origem?.metadata.myid_score_origem,
            termos_voz: origem?.metadata.termos_voz,
            triangulado: origem?.triangulado ?? false,
          } as any,
        } as any);
      }));

      toast({
        title: 'Avatar Clínico atualizado',
        description: `${entries.length} achados salvos (${stats.trianguladas} triangulados).`,
      });
    } catch (error) {
      console.error('Erro ao sincronizar avatar:', error);
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const mostrarBannerAutoProcessar =
    mostraAvatar &&
    !!lastMyID &&
    eventosExistentes.length === 0 &&
    !isAutoProcessing;

  return (
    <div className="space-y-3">
      <MyIDResumoInline pacienteId={pacienteId} />

      {/* Banner: avaliação sem avatar — oferece auto-processamento */}
      {mostrarBannerAutoProcessar && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Avatar clínico vazio
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
              Existe uma avaliação registrada mas o avatar ainda não foi gerado.
              Clique para processar automaticamente.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
            onClick={handleAutoProcessar}
            disabled={isAutoProcessing}
          >
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            {isAutoProcessing ? 'Processando...' : 'Gerar Avatar'}
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <button
          onClick={() => navigate(`/metodo-identidade?paciente=${pacienteId}&iniciar=1`)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ClipboardList className="icon-xs shrink-0" />
          <span>MyID Presencial</span>
        </button>
        {lente && (
          <button
            onClick={() => navigate('/configuracoes')}
            className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors rounded-full border border-border/40 px-2 py-0.5"
            title="Trocar profissão em Configurações"
          >
            <Stethoscope className="icon-xs shrink-0" />
            <span>Lente: {lente.nome_exibicao}</span>
          </button>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
          <Sparkles className="icon-xs shrink-0" />
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

      {mostraAvatar && (
        <div className="space-y-4">
          {/* ───── HEADER: INTELIGÊNCIA CRUZADA ───── */}
          <div className="rounded-xl border border-border/40 bg-gradient-to-br from-primary/5 to-transparent p-3 sm:p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Target className="icon-sm text-primary shrink-0" />
                  Inteligência Cruzada
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  3 fontes convergem no avatar: questionário, fala e exame.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {lastMyID && !myidSyncDone && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleSyncMyID}
                  >
                    <Brain className="icon-xs shrink-0" />
                    Sincronizar MyID
                  </Button>
                )}
                {lastMyID && eventosExistentes.length === 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/5"
                    onClick={handleAutoProcessar}
                    disabled={isAutoProcessing}
                  >
                    <Wand2 className="icon-xs shrink-0" />
                    {isAutoProcessing ? 'Processando...' : 'Auto-gerar'}
                  </Button>
                )}
                <Button
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={handleSaveToAvatar}
                  disabled={isSaving || stats.total === 0}
                >
                  <Save className="icon-xs shrink-0" />
                  {isSaving ? 'Salvando...' : 'Salvar Avatar'}
                </Button>
              </div>
            </div>

            {/* Chips de fontes ativas */}
            <div className="flex flex-wrap items-center gap-1.5">
              <FonteChip
                ativo={stats.myid > 0}
                icon={<Brain className="icon-xs shrink-0" />}
                label="MyID"
                count={stats.myid}
                color="indigo"
              />
              <FonteChip
                ativo={stats.voz_ia > 0}
                icon={<Mic className="icon-xs shrink-0" />}
                label="Voz/IA"
                count={stats.voz_ia}
                color="sky"
              />
              <FonteChip
                ativo={stats.manual > 0}
                icon={<Hand className="icon-xs shrink-0" />}
                label="Manual"
                count={stats.manual}
                color="amber"
              />
              {stats.trianguladas > 0 && (
                <Badge className="h-6 gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                  <Target className="icon-xs shrink-0" />
                  {stats.trianguladas} triangulada{stats.trianguladas > 1 ? 's' : ''}
                </Badge>
              )}
            </div>

            {/* Lista das regiões triangulachadas (alta confiança) */}
            {stats.trianguladas > 0 && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
                <p className="text-[11px] font-semibold text-emerald-800 mb-0.5">
                  🎯 Achados de alta confiança clínica
                </p>
                <p className="text-[10px] text-emerald-700/80">
                  {Object.values(origemPorRegiao)
                    .filter(a => a.triangulado)
                    .map(a => {
                      const reg = REGIONS.find(r => r.id === a.regiao_id);
                      return reg?.label ?? a.regiao_id;
                    })
                    .join(', ')}
                </p>
              </div>
            )}
          </div>

          <Body3DAvatar
            value={painMap}
            onChange={handlePainMapManual}
            structures={structState}
            onStructuresChange={setStructState}
          />
        </div>
      )}
    </div>
  );
}

function FonteChip({
  ativo, icon, label, count, color,
}: {
  ativo: boolean;
  icon: React.ReactNode;
  label: string;
  count: number;
  color: 'indigo' | 'sky' | 'amber';
}) {
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[11px] font-semibold transition-opacity',
        ativo ? colorMap[color] : 'bg-muted/40 text-muted-foreground border-border/40 opacity-60',
      )}
    >
      {icon}
      <span>{label}</span>
      {ativo && <span className="font-black ml-0.5">{count}</span>}
    </div>
  );
}
