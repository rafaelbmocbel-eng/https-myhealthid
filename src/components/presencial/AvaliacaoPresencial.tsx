import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardList, Sparkles, Stethoscope, Wand2, AlertCircle, Loader2 } from 'lucide-react';
import VoiceAssessment from '@/components/voice/VoiceAssessment';
import { REGIONS, STRUCTURES } from './Body3DAvatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLenteAtiva, temBloco } from '@/hooks/useLenteAtiva';
import MyIDResumoInline from './MyIDResumoInline';
import { useSaveEventoAnatomico } from '@/hooks/useEventosAnatomicos';
import type { SistemaCorporal } from '@/hooks/useEventosAnatomicos';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { inferirAchadosDoMyID } from '@/utils/anatomia/myidToAvatar';
import { encontrarSintomasEmTexto, extrairTextoDeObjeto } from '@/utils/anatomia/mapeamentoSintomas';

interface Props {
  pacienteId: string;
  patientName: string;
  serviceType?: 'identidade' | 'cobzero' | 'studio';
  onAssessmentComplete?: () => void;
}

// Região com sistema correto e rastreabilidade de fonte
type RegiaoColetada = {
  intensidade: number;
  sistema: SistemaCorporal;
  fonte: 'voz_ia' | 'myid' | 'nlp';
  tipoAchado: string;
};

// Lookup de sistemas padrão por região (para mapa_dor sem sistema explícito)
const SISTEMA_POR_REGIAO_PADRAO: Record<string, SistemaCorporal> = {
  cabeca: 'nervoso', cerebro: 'nervoso', cervical: 'nervoso',
  ombro_d: 'musculoesqueletico', ombro_e: 'musculoesqueletico',
  cotovelo_d: 'musculoesqueletico', cotovelo_e: 'musculoesqueletico',
  punho_d: 'musculoesqueletico', punho_e: 'musculoesqueletico',
  mao_d: 'musculoesqueletico', mao_e: 'musculoesqueletico',
  torax: 'respiratorio', peito: 'circulatorio',
  abdomem: 'digestorio', quadril_d: 'musculoesqueletico', quadril_e: 'musculoesqueletico',
  lombar: 'musculoesqueletico', dorsal: 'musculoesqueletico',
  trapezio_d: 'musculoesqueletico', trapezio_e: 'musculoesqueletico',
  joelho_d: 'musculoesqueletico', joelho_e: 'musculoesqueletico',
  tornozelo_d: 'musculoesqueletico', tornozelo_e: 'musculoesqueletico',
  pe_d: 'musculoesqueletico', pe_e: 'musculoesqueletico',
  coxa_d: 'musculoesqueletico', coxa_e: 'musculoesqueletico',
  perna_d: 'musculoesqueletico', perna_e: 'musculoesqueletico',
  gluteos: 'musculoesqueletico', braco_d: 'nervoso', braco_e: 'nervoso',
  antebraco_d: 'musculoesqueletico', antebraco_e: 'musculoesqueletico',
};

function sistemaDeRegiao(regiao_id: string): SistemaCorporal {
  return SISTEMA_POR_REGIAO_PADRAO[regiao_id] ?? 'musculoesqueletico';
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
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const autoProcessadoRef = useRef(false);
  const saveEvento = useSaveEventoAnatomico();
  const qc = useQueryClient();

  const mostraAvatar = temBloco(lente, 'avatar');

  // Última avaliação por voz — achados estruturados em resultado._meta
  const { data: latestAval, isLoading: loadingAval } = useQuery({
    queryKey: ['avaliacao-voz-latest-presencial', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_voz')
        .select('id, resultado, created_at')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId && mostraAvatar,
  });

  // Última avaliação MyID (sem filtro — inclui presenciais sem score digital)
  const { data: lastMyID, isLoading: loadingMyID } = useQuery({
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

  // Eventos já salvos — para evitar duplicatas
  const { data: eventosExistentes = [], isLoading: loadingEventos } = useQuery({
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

  // Catálogo de regiões para guiar a IA de voz na extração
  const painRegionsCatalog = useMemo(() => ({
    regions: REGIONS.map(r => ({ id: r.id, label: `${r.label} (${r.view === 'back' ? 'posterior' : 'anterior'})` })),
    catalog: Object.fromEntries(
      Object.entries(STRUCTURES).map(([rid, cats]) => [rid, { categories: cats as Record<string, string[]> }])
    ),
  }), []);

  // Agrega regiões de TODAS as fontes com sistema correto por achado
  const coletarRegioes = (): Record<string, RegiaoColetada> => {
    const regioes: Record<string, RegiaoColetada> = {};

    const merge = (rid: string, info: RegiaoColetada) => {
      const ex = regioes[rid];
      if (!ex) {
        regioes[rid] = info;
      } else {
        regioes[rid] = {
          ...ex,
          intensidade: Math.max(ex.intensidade, info.intensidade),
          // Sistema mais específico prevalece sobre musculoesqueletico genérico
          sistema: ex.sistema !== 'musculoesqueletico' ? ex.sistema : info.sistema,
        };
      }
    };

    // ── Fonte 1: avaliação por voz ──────────────────────────────
    if (latestAval) {
      const meta = (latestAval.resultado as any)?._meta;
      // 1a. Mapa de dor explícito (extraído pela IA durante a avaliação)
      if (meta?.mapa_dor && typeof meta.mapa_dor === 'object') {
        Object.entries(meta.mapa_dor as Record<string, number>).forEach(([rid, v]) => {
          if (Number(v) > 0) {
            merge(rid, {
              intensidade: Number(v),
              sistema: sistemaDeRegiao(rid),
              fonte: 'voz_ia',
              tipoAchado: 'Mapa de dor extraído pela IA da avaliação por voz',
            });
          }
        });
      }
      // 1b. NLP no texto completo da avaliação (SOAP, queixa, anamnese...)
      const textoVoz = extrairTextoDeObjeto(latestAval.resultado);
      encontrarSintomasEmTexto(textoVoz).forEach(s => {
        merge(s.regiao_id, {
          intensidade: 5,
          sistema: s.sistema as SistemaCorporal,
          fonte: 'nlp',
          tipoAchado: `Sintoma detectado no texto: "${s.termo}"`,
        });
      });
    }

    // ── Fonte 2: avaliação MyID / presencial ────────────────────
    if (lastMyID) {
      const dados = (lastMyID as any).dados_avaliacao || {};
      const painMapSalvo: Record<string, number> | null =
        dados?.painMap || dados?.mapa_dor || dados?.resultado?.painMap || null;

      if (painMapSalvo) {
        Object.entries(painMapSalvo).forEach(([rid, v]) => {
          if (Number(v) > 0) {
            merge(rid, {
              intensidade: Number(v),
              sistema: sistemaDeRegiao(rid),
              fonte: 'myid',
              tipoAchado: 'Mapa de dor da avaliação presencial',
            });
          }
        });
      } else {
        // Inferência por scores dimensionais (cada dimensão tem sistema correto)
        inferirAchadosDoMyID({
          scores: {
            D:   Number(lastMyID.score_d   || 0),
            EFI: Number(lastMyID.score_efi || 0),
            P:   Number(lastMyID.score_p   || 0),
            I:   Number(lastMyID.score_i   || 0),
            R:   Number(lastMyID.score_r   || 0),
            C:   Number(lastMyID.score_c   || 0),
            N:   Number(lastMyID.score_n   || 0),
            AF:  Number((lastMyID as any).score_af  || 0),
            ERG: Number((lastMyID as any).score_erg || 0),
            HID: Number((lastMyID as any).score_hid || 0),
          },
          textoRelato: extrairTextoDeObjeto(dados),
        }).forEach(a => {
          merge(a.regiao_id, {
            intensidade: a.intensidade,
            sistema: a.sistema as SistemaCorporal,
            fonte: 'myid',
            tipoAchado: a.motivo,
          });
        });
      }
    }

    return regioes;
  };

  // Salva achados no Avatar Clínico com sistema correto
  const handleAutoProcessar = async (silencioso = false) => {
    if (!user?.id) return;
    setIsAutoProcessing(true);
    try {
      const regioesPorId = coletarRegioes();

      if (Object.keys(regioesPorId).length === 0) {
        if (!silencioso) {
          toast({ title: 'Sem dados suficientes', description: 'A avaliação não gerou regiões mapeáveis.' });
        }
        return;
      }

      const existentesSet = new Set(eventosExistentes.map(e => e.regiao_id));
      const regioesNovas = Object.entries(regioesPorId).filter(([rid]) => !existentesSet.has(rid));

      if (regioesNovas.length === 0) {
        if (!silencioso) {
          toast({ title: 'Avatar já atualizado', description: 'Todas as regiões já estão no Avatar Clínico.' });
        }
        return;
      }

      await Promise.all(regioesNovas.map(([regiao_id, info]) =>
        saveEvento.mutateAsync({
          paciente_id: pacienteId,
          regiao_id,
          sistema: info.sistema,  // sistema correto por achado
          origem: info.fonte === 'myid' ? 'subjetivo_myid' : 'voz_ia',
          tipo_achado: info.tipoAchado,
          estrutura: null,
          severidade: info.intensidade >= 7 ? 3 : info.intensidade >= 4 ? 2 : 1,
          status: 'ativo',
          visivel_paciente: true,
          data_inicio: new Date().toISOString().slice(0, 10),
          notas_clinicas: `Auto-processado. Intensidade ${info.intensidade}/10. Sistema: ${info.sistema}. Fonte: ${info.fonte}.`,
          metadata: {
            fontes: [info.fonte === 'nlp' ? 'voz_ia' : info.fonte],
            confianca: info.fonte === 'nlp' ? 'baixa' : 'media',
            auto_processado: true,
          } as any,
        } as any)
      ));

      qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });
      qc.invalidateQueries({ queryKey: ['eventos-anatomicos-count', pacienteId] });

      if (!silencioso) {
        toast({
          title: '✅ Avatar Clínico atualizado!',
          description: `${regioesNovas.length} região${regioesNovas.length > 1 ? 'ões' : ''} em ${new Set(regioesNovas.map(([, i]) => i.sistema)).size} sistema${new Set(regioesNovas.map(([, i]) => i.sistema)).size > 1 ? 's' : ''}.`,
        });
      }
      onAssessmentComplete?.();
    } catch (err) {
      console.error('Erro ao auto-processar avatar:', err);
      if (!silencioso) toast({ title: 'Erro ao processar', variant: 'destructive' });
    } finally {
      setIsAutoProcessing(false);
    }
  };

  // Auto-dispara quando: dados carregados + avatar vazio + há avaliação existente
  useEffect(() => {
    if (loadingEventos || loadingAval || loadingMyID) return;
    if (!mostraAvatar) return;
    if (eventosExistentes.length > 0) return;
    if (!latestAval && !lastMyID) return;
    if (autoProcessadoRef.current) return;

    autoProcessadoRef.current = true;
    handleAutoProcessar(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingEventos, loadingAval, loadingMyID, eventosExistentes.length, latestAval?.id, lastMyID?.id]);

  // Achados de nova avaliação por voz → salva direto no Avatar com sistema correto
  const handlePainExtracted = async (
    findings: Array<{ region_id: string; intensity: number; structures: string[] }>,
  ) => {
    if (!user?.id || findings.length === 0) return;
    const existentes = new Set(eventosExistentes.map(e => e.regiao_id));
    const novas = findings.filter(f => !existentes.has(f.region_id));
    if (novas.length === 0) return;

    try {
      await Promise.all(novas.map(f =>
        saveEvento.mutateAsync({
          paciente_id: pacienteId,
          regiao_id: f.region_id,
          sistema: sistemaDeRegiao(f.region_id),
          origem: 'voz_ia',
          tipo_achado: 'Achado extraído pela IA — avaliação por voz',
          estrutura: f.structures?.join(', ') || null,
          severidade: f.intensity >= 7 ? 3 : f.intensity >= 4 ? 2 : 1,
          status: 'ativo',
          visivel_paciente: true,
          data_inicio: new Date().toISOString().slice(0, 10),
          notas_clinicas: `Intensidade ${f.intensity}/10. Sistema: ${sistemaDeRegiao(f.region_id)}. Estruturas: ${f.structures?.join(', ') || '—'}.`,
          metadata: { fontes: ['voz_ia'], confianca: 'media', auto_processado: true } as any,
        } as any)
      ));
      qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] });
      qc.invalidateQueries({ queryKey: ['eventos-anatomicos-count', pacienteId] });
    } catch (err) {
      console.error('Erro ao salvar achados da IA:', err);
    }
  };

  const temDadosParaProcessar = !!(latestAval || lastMyID);
  const mostrarBanner =
    mostraAvatar &&
    !loadingEventos &&
    eventosExistentes.length === 0 &&
    temDadosParaProcessar &&
    !isAutoProcessing &&
    autoProcessadoRef.current; // só aparece se o auto-processamento já tentou e não funcionou

  return (
    <div className="space-y-3">
      <MyIDResumoInline pacienteId={pacienteId} />

      {/* Indicador de processamento automático em background */}
      {isAutoProcessing && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />
          <p className="text-xs text-primary font-medium">
            Atualizando Avatar Clínico com os achados da avaliação...
          </p>
        </div>
      )}

      {/* Banner manual — aparece somente se o auto-processamento não gerou regiões */}
      {mostrarBanner && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Avatar sem achados automáticos
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
              Não foram detectadas regiões na avaliação. Você pode tentar novamente ou registrar manualmente.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 shrink-0"
            onClick={() => handleAutoProcessar(false)}
          >
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            Tentar novamente
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
          A IA estrutura a avaliação e atualiza o Avatar Clínico automaticamente.
        </p>
        <VoiceAssessment
          mode="voice"
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          onAssessmentComplete={onAssessmentComplete}
          onPainExtracted={mostraAvatar ? handlePainExtracted : undefined}
          painRegionsCatalog={mostraAvatar ? painRegionsCatalog : undefined}
          perfilProfissional={lente?.id}
        />
      </div>
    </div>
  );
}
