import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye, Download, Trash2, Calendar, Activity, Loader2,
  Zap, FileText, User, Plus, Send
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { PDFProtocolo } from '@/utils/pdfGenerator';
import { useToast } from '@/hooks/use-toast';
import ProtocoloViewer from '@/components/protocolo/ProtocoloViewer';
import {
  identificarDemandas,
  gerarProtocoloAutomatico,
  ProtocoloAnalise
} from '@/utils/demandasAnalyzer';
import ProtocoloEditor from '@/components/protocolo/ProtocoloEditor';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  tipo: 'identidade' | 'cob_zero' | 'studio';
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  rascunho: { label: 'Rascunho IA', color: 'bg-amber-100 text-amber-700' },
  concluido: { label: 'Concluído', color: 'bg-blue-100 text-blue-700' },
  pausado: { label: 'Pausado', color: 'bg-amber-100 text-amber-700' },
};

export default function PacienteProtocolosTab({ pacienteId, pacienteNome, tipo }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [analisandoAvaliacao, setAnalisandoAvaliacao] = useState<any | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingProtocoloId, setDeletingProtocoloId] = useState<string | null>(null);

  // Protocolos do paciente
  const { data: protocolos = [], isLoading } = useQuery({
    queryKey: ['protocolos-paciente', pacienteId, tipo],
    queryFn: async () => {
      const table = (tipo === 'identidade' || tipo === 'studio') ? 'protocolos' : 'protocolos_cob_zero';

      const { data, error } = await supabase
        .from(table as any)
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
  });

  // Avaliações concluídas sem protocolo (identidade/studio)
  const { data: avaliacoesSemProtocolo = [] } = useQuery({
    queryKey: ['avaliacoes-sem-protocolo-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', pacienteId)
        .eq('status', 'concluida')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const avalIds = protocolos
        .filter((p: any) => tipo === 'identidade' || tipo === 'studio')
        .map((p: any) => p.avaliacao_id)
        .filter(Boolean);
      return (data || []).filter((a: any) => !avalIds.includes(a.id));
    },
    enabled: !!user && (tipo === 'identidade' || tipo === 'studio'),
  });

  const { data: avaliacoesVozComDiretriz = [] } = useQuery({
    queryKey: ['avaliacoes-voz-diretriz-pendente', pacienteId, protocolos.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_voz')
        .select('id, resultado, created_at, queixa_principal, classificacao_severidade')
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []).filter((av: any) => {
        const resultado = typeof av.resultado === 'string' ? JSON.parse(av.resultado) : av.resultado;
        return resultado?.diretriz_tratamento
          && resultado?._secoes?.confirmadas?.includes('diretriz')
          && !resultado?._secoes?.diretriz_protocolo_id;
      });
    },
    enabled: !!user && tipo === 'identidade',
  });

  // Avaliações CobZero sem protocolo
  const { data: avaliacoesCobZeroSemProtocolo = [] } = useQuery({
    queryKey: ['avaliacoes-cob-zero-sem-protocolo-paciente', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_cob_zero')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Simplificação: por enquanto, mostrar todas as avaliações CobZero concluídas
      // que ainda não tem um protocolo associado (baseado na data ou id se houver relação clara)
      // Atualmente não há uma FK explícita em protocolos_cob_zero para a avaliação,
      // mas podemos assumir que se houver um protocolo recente, não precisa de outro.
      return data || [];
    },
    enabled: !!user && tipo === 'cob_zero',
  });

  const handleNovaDiretrizManual = async () => {
    if (tipo === 'cob_zero') {
      const pendentes = avaliacoesCobZeroSemProtocolo;
      if (pendentes.length === 0) {
        toast({ title: "Nenhuma avaliação disponível", description: "Conclua uma avaliação COB° ZERO para gerar uma diretriz.", variant: "destructive" });
        return;
      }
      if (pendentes.length === 1) { handleGerarDiretrizCobZero(pendentes[0]); return; }
      const element = document.getElementById('secao-pendencias');
      if (element) { element.scrollIntoView({ behavior: 'smooth' }); toast({ title: "Selecione uma avaliação" }); }
      return;
    }

    // Identidade/Studio: check avaliacoes, then structural, then voice
    if (avaliacoesSemProtocolo.length > 0) {
      if (avaliacoesSemProtocolo.length === 1) { setAnalisandoAvaliacao(avaliacoesSemProtocolo[0]); return; }
      const element = document.getElementById('secao-pendencias');
      if (element) { element.scrollIntoView({ behavior: 'smooth' }); toast({ title: "Selecione uma avaliação" }); }
      return;
    }

    // Fallback: structural assessments (exclude MyID questionnaires)
    const { data: structuralAvs } = await supabase
      .from('avaliacoes_identidade')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('terapeuta_id', user!.id)
      .not('score_e', 'is', null)
      .is('myid_score', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (structuralAvs && structuralAvs.length > 0) {
      const sa = structuralAvs[0] as any;
      setAnalisandoAvaliacao({
        id: sa.id, paciente_id: pacienteId, created_at: sa.created_at,
        score_e: sa.score_e || 0, score_p: sa.score_p || 0, score_c: sa.score_c || 0,
        score_f: sa.score_f || 0, score_d: sa.score_d || 0, score_r: sa.score_r || 0,
        score_efi: sa.score_efi || 0, dor_identidade: sa.id_final || 0, status: 'concluida',
      });
      return;
    }

    // Fallback: voice assessments
    const { data: voiceAvs } = await supabase
      .from('avaliacoes_voz')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('terapeuta_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1);

    if (voiceAvs && voiceAvs.length > 0) {
      const av = voiceAvs[0] as any;
      const resultado = typeof av.resultado === 'string' ? JSON.parse(av.resultado) : av.resultado;
      setAnalisandoAvaliacao({
        id: av.id, paciente_id: pacienteId, created_at: av.created_at,
        score_e: resultado?.scores?.estrutural || 0, score_p: resultado?.scores?.psicologico || 0,
        score_c: resultado?.scores?.contexto || 0, score_f: resultado?.scores?.funcionalidade || 0,
        score_d: resultado?.scores?.dor || resultado?.intensidade_dor || 0, score_r: resultado?.scores?.regulacao || 0,
        score_efi: resultado?.scores?.efi || 0, dor_identidade: resultado?.intensidade_dor || 0, status: 'concluida',
      });
      return;
    }

    toast({ title: "Nenhuma avaliação disponível", description: "Conclua uma avaliação presencial ou por voz antes de criar uma diretriz.", variant: "destructive" });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const table = tipo === 'identidade' ? 'protocolos' : 'protocolos_cob_zero';
      const { error } = await supabase.from(table as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });
      toast({ title: 'Diretriz excluída' });
    },
    onError: () => toast({ title: 'Erro ao excluir', variant: 'destructive' }),
  });

  const handleExportPDF = async (protocolo: any) => {
    if (tipo !== 'identidade') return;
    setExportingId(protocolo.id);
    try {
      const { data: fases } = await supabase
        .from('protocolo_fases' as any)
        .select('*')
        .eq('protocolo_id', protocolo.id)
        .order('numero_fase');
      const { data: prescricoes } = await supabase
        .from('prescricoes_exercicios' as any)
        .select('*, exercicio:exercicio_id(*)')
        .eq('protocolo_id', protocolo.id);
      const { data: tratamentos } = await (supabase as any)
        .from('protocolo_tratamentos')
        .select('*, tecnica:tecnica_id(nome, categoria)')
        .eq('protocolo_id', protocolo.id)
        .eq('ativo', true);

      const fasesComExercicios = (fases || []).map((f: any) => ({
        fase: f.numero_fase,
        titulo: f.titulo,
        semanas: `${f.semanas_inicio}-${f.semanas_fim}`,
        objetivos: f.objetivos || [],
        sessoes_por_semana: f.sessoes_por_semana || 2,
        exercicios: (prescricoes || [])
          .filter((p: any) => p.fase_id === f.id)
          .map((p: any) => ({
            nome: p.exercicio?.nome || 'Exercício',
            series: p.series || 3,
            repeticoes: p.repeticoes || 12,
            frequencia: p.frequencia || '2x por semana',
            observacoes: p.observacoes,
          })),
      }));

      const scores = protocolo.scores_avaliacao || {};
      const pdfData: PDFProtocolo = {
        pacienteNome,
        terapeutaNome: `${profile?.nome || ''} ${profile?.sobrenome || ''}`.trim() || 'Terapeuta',
        dataEmissao: format(new Date(), 'dd/MM/yyyy', { locale: ptBR }),
        classificacao: scores['classificacao'] || 'MODERADO',
        idFinal: scores['idFinal'] || 0,
        scores: { E: scores['E'] || 0, P: scores['P'] || 0, C: scores['C'] || 0, F: scores['F'] || 0, D: scores['D'] || 0, R: scores['R'] || 0, EFI: scores['EFI'] || 0 },
        perfilDominante: protocolo.perfil_dominante || [],
        objetivoGeral: protocolo.objetivo_geral || '',
        duracao: protocolo.duracao_total || '12 semanas',
        frequencia: protocolo.frequencia || '2-3x por semana',
        prognose: scores['prognose'] || 'Moderado',
        fases: fasesComExercicios,
        tecnicas: (tratamentos || []).map((t: any) => ({
          nome: t.tecnica?.nome || 'Técnica',
          categoria: t.tecnica?.categoria || '',
          fase_numero: t.fase_numero || 1,
          observacoes: t.observacoes,
        })),
      };
      const { gerarPDFProtocolo } = await import('@/utils/pdfGenerator');
      await gerarPDFProtocolo(pdfData);
      toast({ title: 'PDF gerado com sucesso!' });
    } catch {
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleGerarDiretrizCobZero = async (av: any) => {
    try {
      const { data: prot, error } = await (supabase as any)
        .from('protocolos_cob_zero')
        .insert({
          paciente_id: pacienteId,
          terapeuta_id: user!.id,
          classificacao_lenke: av.lenke_type,
          cobb_angle: av.cobb_angle,
          risco_progressao: av.risco_percentage,
          status: 'ativo',
          dados_protocolo: av.dados_avaliacao
        })
        .select('id')
        .single();

      if (error) throw error;

      if (prot?.id) {
        const descricao = `🧠 DIRETRIZ COB° ZERO REGISTRADA

📋 Classificação Lenke: ${av.lenke_type || 'N/A'}
📐 Ângulo de Cobb: ${av.cobb_angle ?? 'N/A'}°
📈 Risco de progressão: ${av.risco_percentage ?? 'N/A'}%

Diretriz registrada automaticamente após avaliação COB° ZERO.`;

        await (supabase as any).from('notas_prontuario').insert({
          paciente_id: pacienteId,
          terapeuta_id: user!.id,
          tipo: 'conduta_diretriz',
          titulo: `Diretriz COB° ZERO — Lenke ${av.lenke_type || 'N/A'}`,
          descricao,
          referencia_id: prot.id,
          dados_extras: {
            protocolo_id: prot.id,
            cobb_angle: av.cobb_angle ?? null,
            risco_progressao: av.risco_percentage ?? null,
            lenke_type: av.lenke_type || null,
          },
        });
      }
      toast({ title: 'Diretriz CobZero gerada!' });
      qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      qc.invalidateQueries({ queryKey: ['evolucao-paciente'] });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar diretriz', variant: 'destructive' });
    }
  };

  const handleCriarProtocoloDaVoz = async (av: any) => {
    try {
      const resultado = typeof av.resultado === 'string' ? JSON.parse(av.resultado) : av.resultado;
      const diretriz = resultado?.diretriz_tratamento;
      if (!diretriz) throw new Error('Diretriz indisponível nesta avaliação.');
      const queixa = resultado?.queixa_principal || av.queixa_principal || 'Avaliação por voz';
      const fasesConfig = [
        { numero: 1, key: 'fase_1_alivio', titulo: 'Fase 1 — Alívio & Proteção', semanas_inicio: 1, semanas_fim: 2 },
        { numero: 2, key: 'fase_2_carga', titulo: 'Fase 2 — Carga Progressiva', semanas_inicio: 3, semanas_fim: 6 },
        { numero: 3, key: 'fase_3_retorno', titulo: 'Fase 3 — Retorno Funcional', semanas_inicio: 7, semanas_fim: 12 },
      ];

      const { data: prot, error } = await (supabase as any).from('protocolos').insert({
        terapeuta_id: user!.id,
        paciente_id: pacienteId,
        titulo: `Diretriz — ${queixa}`,
        descricao: resultado?.resumo_clinico || null,
        objetivo_geral: `Plano clínico em 3 fases para "${queixa}" — gerado a partir da avaliação por voz.`,
        duracao_total: '12 semanas',
        frequencia: diretriz.frequencia_sugerida || '2-3x por semana',
        status: 'ativo',
        origem: 'ia_voz',
        scores_avaliacao: { diretriz_snapshot: { origem: 'ia_voz', fases: fasesConfig.map((cfg) => ({ ...cfg, objetivo: diretriz?.[cfg.key]?.objetivos?.[0] || 'Conduta terapêutica planejada.', tecnicas: diretriz?.[cfg.key]?.tecnicas || [] })) } },
      }).select('id').single();
      if (error) throw error;
      await (supabase as any).from('protocolo_fases').insert(fasesConfig.map((cfg) => ({ protocolo_id: prot.id, numero_fase: cfg.numero, titulo: cfg.titulo, semanas_inicio: cfg.semanas_inicio, semanas_fim: cfg.semanas_fim, objetivos: diretriz?.[cfg.key]?.objetivos || [], sessoes_por_semana: 2 })));
      await supabase.from('avaliacoes_voz').update({ resultado: { ...resultado, _secoes: { ...(resultado._secoes || {}), diretriz_protocolo_id: prot.id } } }).eq('id', av.id);
      qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });
      qc.invalidateQueries({ queryKey: ['avaliacoes-voz-diretriz-pendente'] });
      setViewingId(prot.id);
      toast({ title: 'Diretriz enviada para a aba Diretrizes' });
    } catch (err: any) {
      toast({ title: 'Erro ao criar diretriz', description: err?.message, variant: 'destructive' });
    }
  };

  // Auto-envia diretrizes confirmadas na avaliação para a aba Diretrizes,
  // sem exigir clique manual em "Enviar".
  const autoSentRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (tipo !== 'identidade') return;
    avaliacoesVozComDiretriz.forEach((av: any) => {
      if (!autoSentRef.current.has(av.id)) {
        autoSentRef.current.add(av.id);
        handleCriarProtocoloDaVoz(av);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avaliacoesVozComDiretriz, tipo]);




  const handlePublicarExercicios = async (protocolo: any) => {
    setPublishingId(protocolo.id);
    try {
      // 1. Buscar fases e prescrições do protocolo
      const { data: fases } = await supabase
        .from('protocolo_fases' as any)
        .select('*')
        .eq('protocolo_id', protocolo.id)
        .order('numero_fase');

      const { data: prescricoes } = await supabase
        .from('prescricoes_exercicios' as any)
        .select('*, exercicio:exercicio_id(*)')
        .eq('protocolo_id', protocolo.id);

      if (!prescricoes || prescricoes.length === 0) {
        toast({ title: 'Sem exercícios', description: 'Esta diretriz não possui exercícios prescritos.', variant: 'destructive' });
        return;
      }

      // 2. Criar treino no Studio já publicado
      const { data: treino, error: treinoErr } = await supabase
        .from('studio_treinos' as any)
        .insert({
          paciente_id: pacienteId,
          terapeuta_id: user!.id,
          titulo: `${protocolo.titulo || 'Diretriz'} — Exercícios`,
          objetivo: protocolo.objetivo_geral || 'Reabilitação',
          duracao_estimada: protocolo.duracao_total || '12 semanas',
          frequencia: protocolo.frequencia || '2-3x por semana',
          intensidade: 'Moderada',
          publicado: true,
          ativo: true,
        })
        .select('id')
        .single();

      if (treinoErr) throw treinoErr;

      // 3. Inserir exercícios do protocolo no treino
      const exerciciosInsert = (prescricoes as any[]).map((p: any, idx: number) => ({
        treino_id: (treino as any).id,
        exercicio_id: p.exercicio_id || null,
        nome_customizado: p.exercicio?.nome || 'Exercício',
        grupo_muscular: (p.exercicio?.regiao_corporal as any[])?.[0] || 'Geral',
        ordem: idx + 1,
        series: p.series || 3,
        repeticoes: p.repeticoes || 12,
        descanso_segundos: parseInt(p.tempo_descanso) || 60,
        orientacoes: p.observacoes || null,
      }));

      const { data: insertedExs, error: exErr } = await supabase
        .from('studio_treino_exercicios' as any)
        .insert(exerciciosInsert)
        .select('id, nome_customizado, grupo_muscular');

      if (exErr) throw exErr;

      toast({ title: 'Exercícios publicados!', description: `${exerciciosInsert.length} exercícios enviados. Gerando ilustrações...` });
      qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });

      // Generate AI images in background (non-blocking)
      if (insertedExs) {
        (insertedExs as any[]).forEach(async (ex: any) => {
          try {
            await supabase.functions.invoke('generate-exercise-image', {
              body: {
                exerciseName: ex.nome_customizado || 'Exercício',
                muscleGroup: ex.grupo_muscular || 'Geral',
                exerciseId: ex.id,
              },
            });
          } catch (imgErr) {
            console.warn('Failed to generate image for', ex.nome_customizado, imgErr);
          }
        });
      }
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao publicar exercícios', variant: 'destructive' });
    } finally {
      setPublishingId(null);
    }
  };

  // Viewing a protocol
  if (viewingId && tipo === 'identidade') {
    return (
      <div>
        <ProtocoloViewer
          protocoloId={viewingId}
          onBack={() => setViewingId(null)}
          onExportPDF={() => {
            const p = protocolos.find((x: any) => x.id === viewingId);
            if (p) handleExportPDF(p);
          }}
          onNewDiretriz={() => {
            setViewingId(null);
            handleNovaDiretrizManual();
          }}
        />
      </div>
    );
  }

  if (analisandoAvaliacao && tipo === 'identidade') {
    return (
      <ProtocoloEditor
        avaliacao={analisandoAvaliacao}
        pacienteNome={pacienteNome}
        onSave={(protocoloId?: string) => {
          setAnalisandoAvaliacao(null);
          qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });
          qc.invalidateQueries({ queryKey: ['avaliacoes-sem-protocolo-paciente'] });
          qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
          // Auto-navigate to the saved directive viewer
          if (protocoloId) {
            setViewingId(protocoloId);
          }
        }}
        onCancel={() => setAnalisandoAvaliacao(null)}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (protocolos.length === 0 && avaliacoesSemProtocolo.length === 0 && avaliacoesCobZeroSemProtocolo.length === 0 && avaliacoesVozComDiretriz.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-dashed border-primary/20 shadow-sm">
          <div>
            <h3 className="text-sm font-black text-foreground tracking-tight uppercase">Diretrizes e Tratamentos</h3>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Repositório de Condutas</p>
          </div>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground gap-2 font-bold px-4 h-9 shadow-lg hover:shadow-primary/20 transition-all rounded-xl"
            onClick={handleNovaDiretrizManual}
          >
            <Plus className="h-4 w-4" /> Nova Diretriz
          </Button>
        </div>
        <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma diretriz criada</p>
          <p className="text-sm mt-1">
            {tipo === 'identidade'
              ? 'Conclua uma avaliação presencial ou por voz e clique em "Nova Diretriz".'
              : 'Conclua uma avaliação COB° ZERO para gerar uma diretriz.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho de Ações Superiores */}
      <div className="flex justify-between items-center bg-muted/30 p-4 rounded-xl border border-dashed border-primary/20 shadow-sm">
        <div>
          <h3 className="text-sm font-black text-foreground tracking-tight uppercase">Diretrizes e Tratamentos</h3>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Repositório de Condutas</p>
        </div>
        <Button
          size="sm"
          className="bg-primary text-primary-foreground gap-2 font-bold px-4 h-9 shadow-lg hover:shadow-primary/20 transition-all rounded-xl"
          onClick={handleNovaDiretrizManual}
        >
          <Plus className="h-4 w-4" /> Nova Diretriz
        </Button>
      </div>

      {/* Avaliações prontas para protocolo (identidade) */}
      {tipo === 'identidade' && avaliacoesVozComDiretriz.length > 0 && (
        <div className="space-y-2" id="secao-diretrizes-voz">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Diretrizes da avaliação</span>
            <Badge className="bg-primary/10 text-primary border-0 text-[10px]">{avaliacoesVozComDiretriz.length}</Badge>
          </div>
          {avaliacoesVozComDiretriz.map((av: any) => (
            <div key={av.id} className="border-l-4 border-primary rounded-lg p-3 bg-primary/5 flex items-center gap-3 shadow-sm">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{av.queixa_principal || 'Avaliação por voz'}</p>
                <p className="text-xs text-muted-foreground">Confirmada em {format(new Date(av.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
              </div>
              <Button size="sm" className="bg-primary text-primary-foreground gap-1 h-7 text-xs shadow-sm" onClick={() => handleCriarProtocoloDaVoz(av)}>
                <Plus className="h-3 w-3" /> Enviar
              </Button>
            </div>
          ))}
        </div>
      )}

      {(tipo === 'identidade' || tipo === 'studio') && avaliacoesSemProtocolo.length > 0 && (
        <div className="space-y-2" id="secao-pendencias">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Prontas para Diretriz</span>
            <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">{avaliacoesSemProtocolo.length}</Badge>
          </div>
          {avaliacoesSemProtocolo.map((av: any) => {
            const demandasCount = identificarDemandas({
              E: av.score_e || 0, P: av.score_p || 0, C: av.score_c || 0,
              F: av.score_f || 0, D: av.score_d || 0, R: av.score_r || 0, EFI: av.score_efi || 0,
            }).length;
            return (
              <div key={av.id} className="border-l-4 border-amber-400 rounded-lg p-3 bg-amber-50/50 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <Activity className="h-4 w-4 text-amber-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">
                      {format(new Date(av.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    <Badge variant="outline" className="text-[10px] h-4">ID {(av.dor_identidade || 0).toFixed(1)}</Badge>
                    <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px]">{demandasCount} demandas</Badge>
                  </div>
                </div>
                <Button size="sm" className="bg-primary text-primary-foreground gap-1 h-7 text-xs shadow-sm"
                  onClick={() => setAnalisandoAvaliacao(av)}>
                  <Zap className="h-3 w-3" /> Gerar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Avaliações prontas para protocolo (cob_zero) — DEPRECATED: serviço descontinuado, mantido apenas para histórico */}
      {false && tipo === 'cob_zero' && avaliacoesCobZeroSemProtocolo.length > 0 && (
        <div className="space-y-2" id="secao-pendencias" />
      )}

      {/* Lista de protocolos */}
      <div className="space-y-2">
        {protocolos.map((protocolo: any) => {
          const statusInfo = STATUS_LABELS[protocolo.status] || STATUS_LABELS.ativo;
          const scores = protocolo.scores_avaliacao || {};
          const isCobZero = tipo === 'cob_zero';

          return (
            <div key={protocolo.id} className="border rounded-xl p-3 hover:bg-accent/10 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold truncate">
                      {isCobZero ? `COB° ZERO — Lenke ${protocolo.classificacao_lenke || '?'}` : protocolo.titulo}
                    </span>
                    <Badge className={`${statusInfo.color} border-0 text-[10px] h-4`}>{statusInfo.label}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(protocolo.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                    {!isCobZero && protocolo.duracao_total && <span>{protocolo.duracao_total}</span>}
                    {isCobZero && protocolo.cobb_angle && <span>Cobb: {protocolo.cobb_angle}°</span>}
                    {isCobZero && protocolo.risco_progressao != null && <span>Risco: {protocolo.risco_progressao}%</span>}
                  </div>
                  {!isCobZero && scores && Object.keys(scores).length > 0 && (
                    <div className="flex gap-3 mt-1 text-[10px]">
                      {['E', 'P', 'D', 'R'].map(k => (
                        scores[k] != null && (
                          <span key={k} className="text-muted-foreground">
                            <strong className="text-foreground">{(scores[k] || 0).toFixed(1)}</strong> {k}
                          </span>
                        )
                      ))}
                      {scores['idFinal'] != null && (
                        <span className="text-primary font-bold">ID {Number(scores['idFinal'] as number).toFixed(1)}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isCobZero && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setViewingId(protocolo.id)}>
                      <Eye className="h-3 w-3" /> Ver
                    </Button>
                  )}
                  {!isCobZero && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                      onClick={() => handleExportPDF(protocolo)} disabled={exportingId === protocolo.id}>
                      {exportingId === protocolo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    </Button>
                  )}
                  {!isCobZero && (
                    <Button size="sm" className="h-7 text-xs gap-1 bg-primary/90 hover:bg-primary text-primary-foreground"
                      onClick={() => handlePublicarExercicios(protocolo)} disabled={publishingId === protocolo.id}>
                      {publishingId === protocolo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Publicar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => setDeletingProtocoloId(protocolo.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deletingProtocoloId} onOpenChange={(open) => !open && setDeletingProtocoloId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta diretriz? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingProtocoloId) deleteMutation.mutate(deletingProtocoloId); setDeletingProtocoloId(null); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
