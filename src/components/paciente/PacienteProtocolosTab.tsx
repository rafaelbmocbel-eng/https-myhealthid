import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Eye, Download, Trash2, Calendar, Activity, Loader2,
  Zap, FileText, User, Plus
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarPDFProtocolo, PDFProtocolo } from '@/utils/pdfGenerator';
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

  const handleNovaDiretrizManual = () => {
    const pendentes = tipo === 'cob_zero' ? avaliacoesCobZeroSemProtocolo : avaliacoesSemProtocolo;

    if (pendentes.length === 0) {
      toast({
        title: "Nenhuma avaliação disponível",
        description: `Conclua uma avaliação ${tipo === 'cob_zero' ? 'COB° ZERO' : 'Identidade'} para gerar uma diretriz.`,
        variant: "destructive"
      });
      return;
    }

    if (pendentes.length === 1) {
      if (tipo === 'cob_zero') handleGerarDiretrizCobZero(pendentes[0]);
      else setAnalisandoAvaliacao(pendentes[0]);
      return;
    }

    // Se houver múltiplas, rolar para a seção de pendências
    const element = document.getElementById('secao-pendencias');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      toast({ title: "Selecione uma avaliação", description: "Escolha qual avaliação deseja usar para a nova diretriz." });
    }
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
      const { error } = await supabase
        .from('protocolos_cob_zero' as any)
        .insert({
          paciente_id: pacienteId,
          terapeuta_id: user!.id,
          classificacao_lenke: av.lenke_type,
          cobb_angle: av.cobb_angle,
          risco_progressao: av.risco_percentage,
          status: 'ativo',
          dados_protocolo: av.dados_avaliacao
        });

      if (error) throw error;
      toast({ title: 'Diretriz CobZero gerada!' });
      qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar diretriz', variant: 'destructive' });
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
        />
      </div>
    );
  }

  if (analisandoAvaliacao && tipo === 'identidade') {
    return (
      <ProtocoloEditor
        avaliacao={analisandoAvaliacao}
        pacienteNome={pacienteNome}
        onSave={() => {
          setAnalisandoAvaliacao(null);
          qc.invalidateQueries({ queryKey: ['protocolos-paciente'] });
          qc.invalidateQueries({ queryKey: ['avaliacoes-sem-protocolo-paciente'] });
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

  if (protocolos.length === 0 && avaliacoesSemProtocolo.length === 0 && avaliacoesCobZeroSemProtocolo.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Nenhuma diretriz criada</p>
        <p className="text-sm mt-1">
          {tipo === 'identidade'
            ? 'Conclua uma avaliação para gerar uma diretriz automaticamente.'
            : 'Conclua uma avaliação COB° ZERO para gerar uma diretriz.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho de Ações Superiores */}
      <div className="flex justify-between items-center bg-white/40 dark:bg-black/20 p-4 rounded-xl border border-dashed border-primary/20 shadow-sm">
        <div>
          <h3 className="text-sm font-black text-foreground tracking-tight uppercase">Diretrizes e Serviços</h3>
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest mt-0.5">Repositório de Condutas</p>
        </div>
        <Button
          size="sm"
          className="bg-gradient-primary text-white gap-2 font-bold px-4 h-9 shadow-lg hover:shadow-primary/20 transition-all rounded-xl"
          onClick={handleNovaDiretrizManual}
        >
          <Plus className="h-4 w-4" /> Nova Diretriz
        </Button>
      </div>

      {/* Avaliações prontas para protocolo (identidade) */}
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
                <Button size="sm" className="bg-gradient-primary text-white gap-1 h-7 text-xs shadow-sm"
                  onClick={() => setAnalisandoAvaliacao(av)}>
                  <Zap className="h-3 w-3" /> Gerar
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Avaliações prontas para protocolo (cob_zero) */}
      {tipo === 'cob_zero' && avaliacoesCobZeroSemProtocolo.length > 0 && (
        <div className="space-y-2" id="secao-pendencias">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-blue-500" />
            <span className="text-xs font-semibold text-muted-foreground uppercase">Avaliações CobZero Disponíveis</span>
            <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">{avaliacoesCobZeroSemProtocolo.length}</Badge>
          </div>
          {avaliacoesCobZeroSemProtocolo.map((av: any) => (
            <div key={av.id} className="border-l-4 border-blue-400 rounded-lg p-3 bg-blue-50/50 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
              <Activity className="h-4 w-4 text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">
                    {format(new Date(av.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <Badge variant="outline" className="text-[10px] h-4">Cobb {av.cobb_angle}°</Badge>
                  <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px]">Lenke {av.lenke_type}</Badge>
                </div>
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white gap-1 h-7 text-xs"
                onClick={() => handleGerarDiretrizCobZero(av)}>
                <Zap className="h-3 w-3" /> Gerar
              </Button>
            </div>
          ))}
        </div>
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
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => { if (confirm('Excluir esta diretriz?')) deleteMutation.mutate(protocolo.id); }}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
