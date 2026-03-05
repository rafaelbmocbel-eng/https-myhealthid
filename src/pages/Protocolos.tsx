import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  FileText, Plus, Search, Eye, Download, Trash2,
  Calendar, User, Activity, ChevronRight, Loader2, ClipboardList,
  Zap, AlertTriangle, Target, CheckCircle2, ChevronDown, ChevronUp,
  Dumbbell, Clock, RotateCcw, Lightbulb, TrendingUp, Brain,
  Info, X, Check
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarPDFProtocolo, PDFProtocolo } from '@/utils/pdfGenerator';
import { toast } from '@/hooks/use-toast';
import ProtocoloViewer from '@/components/protocolo/ProtocoloViewer';
import {
  identificarDemandas,
  gerarProtocoloAutomatico,
  DemandaMelhoria,
  FaseProtocolo,
  ProtocoloAnalise
} from '@/utils/demandasAnalyzer';
import { StructuralAssessmentData, UNIT_CONFIGS, classifyScore, classifyScoreColor } from '@/types/structural';

interface Protocolo {
  id: string;
  titulo: string;
  status: string;
  duracao_total: string;
  frequencia: string;
  perfil_dominante: string[];
  objetivo_geral: string;
  scores_avaliacao: Record<string, number>;
  data_inicio: string;
  data_fim_prevista: string;
  created_at: string;
  paciente_id: string;
  terapeuta_id: string;
  hierarquia_terapeutica: any[];
  avaliacao_id: string;
}

interface Avaliacao {
  id: string;
  paciente_id: string;
  created_at: string;
  score_e: number;
  score_p: number;
  score_c: number;
  score_f: number;
  score_d: number;
  score_r: number;
  score_efi: number;
  dor_identidade: number;
  status: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  concluido: { label: 'Concluído', color: 'bg-blue-100 text-blue-700' },
  pausado: { label: 'Pausado', color: 'bg-amber-100 text-amber-700' },
};

const FASE_CORES = ['bg-indigo-500', 'bg-amber-500', 'bg-emerald-500', 'bg-red-500'];
const FASE_TEXT = ['text-indigo-700', 'text-amber-700', 'text-emerald-700', 'text-red-700'];
const FASE_BG = ['bg-indigo-50', 'bg-amber-50', 'bg-emerald-50', 'bg-red-50'];
const FASE_BORDE = ['border-indigo-200', 'border-amber-200', 'border-emerald-200', 'border-red-200'];

// ── Componente: Análise Automática ─────────────────────────────────────────────
function AnaliseAutomatica({
  avaliacao,
  pacienteNome,
  onSalvar,
  onDescartar,
  salvando,
}: {
  avaliacao: Avaliacao;
  pacienteNome: string;
  onSalvar: (analise: ProtocoloAnalise) => void;
  onDescartar: () => void;
  salvando: boolean;
}) {
  const scores = {
    E: avaliacao.score_e || 0,
    P: avaliacao.score_p || 0,
    C: avaliacao.score_c || 0,
    F: avaliacao.score_f || 0,
    D: avaliacao.score_d || 0,
    R: avaliacao.score_r || 0,
    EFI: avaliacao.score_efi || 0,
    idFinal: avaliacao.dor_identidade || 0,
    classificacao: '',
  };

  const demandas = identificarDemandas(scores);
  const analise = gerarProtocoloAutomatico(scores, demandas);
  const [fasesAbertas, setFasesAbertas] = useState<Set<number>>(new Set([0]));
  const [modoAceitar, setModoAceitar] = useState(false);

  // Selection state: track which exercises and techniques are selected per phase
  const [selectedExercicios, setSelectedExercicios] = useState<Record<number, Set<number>>>(() => {
    const initial: Record<number, Set<number>> = {};
    analise.fases.forEach((fase, idx) => {
      initial[idx] = new Set(fase.exercicios.map((_, i) => i));
    });
    return initial;
  });
  const [selectedTecnicas, setSelectedTecnicas] = useState<Record<number, Set<number>>>(() => {
    const initial: Record<number, Set<number>> = {};
    analise.fases.forEach((fase, idx) => {
      initial[idx] = new Set(fase.tecnicas.map((_, i) => i));
    });
    return initial;
  });

  const toggleExercicio = (faseIdx: number, exIdx: number) => {
    setSelectedExercicios(prev => {
      const s = new Set(prev[faseIdx] || []);
      if (s.has(exIdx)) s.delete(exIdx); else s.add(exIdx);
      return { ...prev, [faseIdx]: s };
    });
  };

  const toggleTecnica = (faseIdx: number, tecIdx: number) => {
    setSelectedTecnicas(prev => {
      const s = new Set(prev[faseIdx] || []);
      if (s.has(tecIdx)) s.delete(tecIdx); else s.add(tecIdx);
      return { ...prev, [faseIdx]: s };
    });
  };

  const handleSalvarPersonalizado = () => {
    const analisePersonalizada: ProtocoloAnalise = {
      ...analise,
      fases: analise.fases.map((fase, idx) => ({
        ...fase,
        exercicios: fase.exercicios.filter((_, i) => selectedExercicios[idx]?.has(i)),
        tecnicas: fase.tecnicas.filter((_, i) => selectedTecnicas[idx]?.has(i)),
      })),
    };
    onSalvar(analisePersonalizada);
  };

  const totalExSelecionados = Object.values(selectedExercicios).reduce((sum, s) => sum + s.size, 0);
  const totalTecSelecionados = Object.values(selectedTecnicas).reduce((sum, s) => sum + s.size, 0);
  const totalEx = analise.fases.reduce((sum, f) => sum + f.exercicios.length, 0);
  const totalTec = analise.fases.reduce((sum, f) => sum + f.tecnicas.length, 0);

  const toggleFase = (i: number) => {
    setFasesAbertas(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  };

  const scoreItems = [
    { key: 'E', label: 'Estrutural', val: scores.E },
    { key: 'P', label: 'Psico-comp.', val: scores.P },
    { key: 'C', label: 'Contextual', val: scores.C },
    { key: 'F', label: 'Biológico', val: scores.F },
    { key: 'D', label: 'Dor', val: scores.D },
    { key: 'R', label: 'Regulação', val: scores.R },
    { key: 'EFI', label: 'Funcional.', val: scores.EFI },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header de análise */}
      <div className="clinical-card bg-gradient-primary text-white">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs opacity-70 uppercase tracking-widest mb-1 flex items-center gap-2">
              <Zap className="h-3 w-3" /> Análise Automática Gerada
            </div>
            <h2 className="text-xl font-bold">Diretriz Personalizada – {pacienteNome}</h2>
            <p className="text-sm opacity-80 mt-1">{analise.duracaoTotal} · {analise.frequencia}</p>
          </div>
          <div className="text-right shrink-0 ml-4">
            <div className="text-xs opacity-70 mb-1">ID Final</div>
            <div className="text-4xl font-black">{scores.idFinal.toFixed(1)}</div>
            <div className="text-sm opacity-80">{demandas.length} demandas</div>
          </div>
        </div>
        <div className="mt-4 p-3 rounded-xl bg-white/10 text-sm">
          <strong>Objetivo:</strong> {analise.objetivoGeral}
        </div>
      </div>

      {/* Scores + Demandas - grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scores */}
        <div className="clinical-card">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Scores da Avaliação
          </h3>
          <div className="space-y-3">
            {scoreItems.map(item => {
              const pct = Math.min(100, (item.val / 10) * 100);
              const cor = item.val >= 7 ? '#ef4444' : item.val <= 4 ? '#dc2626' : item.val >= 5 ? '#f59e0b' : '#10b981';
              const alerta = item.val >= 7 || (item.key === 'R' && item.val <= 4) || (item.key === 'EFI' && item.val <= 4);
              return (
                <div key={item.key} className="flex items-center gap-2">
                  <div className="w-20 text-xs text-muted-foreground shrink-0">{item.label}</div>
                  <div className="flex-1 h-3 rounded-full bg-secondary overflow-hidden">
                    <div className="h-3 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
                  </div>
                  <div className="w-12 text-right text-xs font-bold" style={{ color: cor }}>{item.val.toFixed(1)}</div>
                  {alerta && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Demandas */}
        <div className="clinical-card">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Demandas de Melhoria ({demandas.length})
          </h3>
          {demandas.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
              Scores dentro dos parâmetros normais.
            </div>
          ) : (
            <div className="space-y-2">
              {demandas.map((d, i) => (
                <div key={i} className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: d.corBg }}>
                  <div className="mt-0.5 shrink-0">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: d.cor }}>
                      {d.prioridade === 0 ? '!' : i + 1}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold" style={{ color: d.cor }}>{d.area}</span>
                      <Badge className="text-[10px] h-4 border-0 px-1" style={{ backgroundColor: d.cor + '20', color: d.cor }}>
                        {d.severidade}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{d.score.toFixed(1)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{d.descricao}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Prognose */}
      <div className="clinical-card border-l-4 border-primary bg-primary/5">
        <div className="flex items-center gap-2 mb-1">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Prognose</h3>
        </div>
        <p className="text-sm text-muted-foreground">{analise.prognose}</p>
      </div>

      {/* 4 Fases */}
      <div>
        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          Diretriz em 4 Fases
        </h3>
        <div className="space-y-3">
          {analise.fases.map((fase, idx) => {
            const aberta = fasesAbertas.has(idx);
            return (
              <div key={idx} className={`rounded-xl border-2 ${FASE_BORDE[idx]} overflow-hidden`}>
                <button
                  className={`w-full flex items-center justify-between p-4 ${FASE_BG[idx]} text-left`}
                  onClick={() => toggleFase(idx)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${FASE_CORES[idx]} flex items-center justify-center text-white text-sm font-bold shrink-0`}>
                      {fase.numero}
                    </div>
                    <div>
                      <div className={`font-semibold ${FASE_TEXT[idx]}`}>{fase.titulo}</div>
                      <div className="text-xs text-muted-foreground">
                        Semanas {fase.semanas} · {fase.frequenciaSemanal}x/sem · {fase.duracaoSessao}
                        {fase.demandasAlvo.length > 0 && (
                          <span className="ml-2">· Foco: {fase.demandasAlvo.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {aberta ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </button>

                {aberta && (
                  <div className="p-4 space-y-4 bg-background">
                    {/* Objetivo */}
                    <div className="p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                      <strong className="text-foreground">Objetivo:</strong> {fase.objetivo}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Exercícios */}
                      <div>
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <Dumbbell className="h-3.5 w-3.5 text-muted-foreground" />
                          Exercícios Sugeridos ({selectedExercicios[idx]?.size || 0}/{fase.exercicios.length})
                        </h4>
                        <div className="space-y-2">
                          {fase.exercicios.map((ex, i) => {
                            const isSelected = selectedExercicios[idx]?.has(i);
                            return (
                              <div key={i} className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-card border-primary/30' : 'bg-muted/30 border-dashed opacity-50'}`} onClick={() => toggleExercicio(idx, i)}>
                                <div className="flex items-start gap-2">
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{ex.nome}</div>
                                    <Badge variant="outline" className="text-[10px] mt-0.5">{ex.categoria}</Badge>
                                    <p className="text-xs text-muted-foreground mt-1">{ex.descricao}</p>
                                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <RotateCcw className="h-2.5 w-2.5" />
                                        {ex.series}× {ex.repeticoes}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5" />
                                        {ex.duracao}
                                      </span>
                                    </div>
                                    <div className="mt-1.5 p-1.5 rounded bg-amber-50 border border-amber-100">
                                      <p className="text-[10px] text-amber-700">
                                        <Lightbulb className="h-2.5 w-2.5 inline mr-1" />
                                        {ex.motivo}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Técnicas */}
                      <div>
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                          Técnicas Sugeridas ({selectedTecnicas[idx]?.size || 0}/{fase.tecnicas.length})
                        </h4>
                        <div className="space-y-2">
                          {fase.tecnicas.map((tec, i) => {
                            const isSelected = selectedTecnicas[idx]?.has(i);
                            return (
                              <div key={i} className={`p-3 rounded-lg border transition-all cursor-pointer ${isSelected ? 'bg-card border-primary/30' : 'bg-muted/30 border-dashed opacity-50'}`} onClick={() => toggleTecnica(idx, i)}>
                                <div className="flex items-start gap-2">
                                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                                    {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm">{tec.nome}</div>
                                    <p className="text-xs text-muted-foreground mt-1">{tec.descricao}</p>
                                    <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-2.5 w-2.5" /> {tec.duracao}
                                      </span>
                                      <span>{tec.frequencia}</span>
                                    </div>
                                    <div className="mt-1.5 p-1.5 rounded bg-blue-50 border border-blue-100">
                                      <p className="text-[10px] text-blue-700">
                                        <Info className="h-2.5 w-2.5 inline mr-1" />
                                        {tec.motivo}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Ações */}
      <div className="clinical-card">
        <h3 className="font-semibold text-sm mb-3">Personalização e Ações</h3>
        <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Dumbbell className="h-3.5 w-3.5" />
            <strong className="text-foreground">{totalExSelecionados}</strong>/{totalEx} exercícios
          </span>
          <span className="flex items-center gap-1.5">
            <Brain className="h-3.5 w-3.5" />
            <strong className="text-foreground">{totalTecSelecionados}</strong>/{totalTec} técnicas
          </span>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Clique nos exercícios e técnicas acima para selecionar ou remover os tratamentos mais adequados para este paciente. Apenas os itens selecionados serão incluídos na diretriz final.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-gradient-primary text-white gap-2"
            onClick={handleSalvarPersonalizado}
            disabled={salvando || (totalExSelecionados === 0 && totalTecSelecionados === 0)}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aceitar e Salvar Diretriz ({totalExSelecionados + totalTecSelecionados} itens)
          </Button>
          <Button variant="outline" onClick={onDescartar} className="gap-2">
            <X className="h-4 w-4" />
            Descartar
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Página Principal ─────────────────────────────────────────────────────────
export default function Protocolos() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [analiseAvaliacao, setAnaliseAvaliacao] = useState<Avaliacao | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!loading && !user) { navigate('/auth'); return null; }

  // Protocolos existentes
  const { data: protocolos = [], isLoading } = useQuery({
    queryKey: ['protocolos', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos' as any)
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Protocolo[];
    },
    enabled: !!user,
  });

  // Avaliações concluídas sem protocolo
  const { data: avaliacoesSemProtocolo = [] } = useQuery({
    queryKey: ['avaliacoes-sem-protocolo', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('status', 'concluida')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Filtrar avaliações que já tem protocolo
      const avalIds = (protocolos as any[]).map((p: any) => p.avaliacao_id).filter(Boolean);
      return (data || []).filter((a: any) => !avalIds.includes(a.id)) as Avaliacao[];
    },
    enabled: !!user,
  });

  // Structural evaluations with data
  const { data: structuralAvals = [] } = useQuery({
    queryKey: ['structural-sem-diretriz', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_identidade')
        .select('id, paciente_id, created_at, dados_estruturais')
        .eq('terapeuta_id', user!.id)
        .not('dados_estruturais', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: pacientes = [] } = useQuery({
    queryKey: ['pacientes-names', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome')
        .eq('terapeuta_id', user!.id);
      return data || [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('protocolos' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['protocolos'] }); toast({ title: 'Diretriz excluída' }); },
    onError: () => toast({ title: 'Erro ao excluir', variant: 'destructive' }),
  });

  const getPacienteNome = (id: string) => {
    const p = pacientes.find(p => p.id === id);
    return p ? `${p.nome} ${p.sobrenome}`.trim() : 'Paciente';
  };

  const handleExportPDF = async (protocolo: Protocolo) => {
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
        pacienteNome: getPacienteNome(protocolo.paciente_id),
        terapeutaNome: `${profile?.nome || ''} ${profile?.sobrenome || ''}`.trim() || 'Terapeuta',
        dataEmissao: format(new Date(), 'dd/MM/yyyy', { locale: ptBR }),
        classificacao: scores['classificacao'] as any || 'MODERADO',
        idFinal: scores['idFinal'] || 0,
        scores: { E: scores['E'] || 0, P: scores['P'] || 0, C: scores['C'] || 0, F: scores['F'] || 0, D: scores['D'] || 0, R: scores['R'] || 0, EFI: scores['EFI'] || 0 },
        perfilDominante: protocolo.perfil_dominante || [],
        objetivoGeral: protocolo.objetivo_geral || '',
        duracao: protocolo.duracao_total || '12 semanas',
        frequencia: protocolo.frequencia || '2-3x por semana',
        prognose: scores['prognose'] as any || 'Moderado – melhora esperada com aderência ao tratamento.',
        fases: fasesComExercicios,
        tecnicas: (tratamentos || []).map((t: any) => ({
          nome: t.tecnica?.nome || 'Técnica',
          categoria: t.tecnica?.categoria || '',
          fase_numero: t.fase_numero || 1,
          observacoes: t.observacoes,
        })),
      };

      await gerarPDFProtocolo(pdfData);
      toast({ title: 'PDF gerado com sucesso!', description: 'O download foi iniciado.' });
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao gerar PDF', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  const handleSalvarAnalise = async (analise: ProtocoloAnalise) => {
    if (!analiseAvaliacao || !user) return;
    setSalvando(true);
    try {
      const scores = {
        E: analiseAvaliacao.score_e || 0,
        P: analiseAvaliacao.score_p || 0,
        C: analiseAvaliacao.score_c || 0,
        F: analiseAvaliacao.score_f || 0,
        D: analiseAvaliacao.score_d || 0,
        R: analiseAvaliacao.score_r || 0,
        EFI: analiseAvaliacao.score_efi || 0,
        idFinal: analiseAvaliacao.dor_identidade || 0,
        prognose: analise.prognose,
      };

      const pacNome = getPacienteNome(analiseAvaliacao.paciente_id);

      // 1. Criar protocolo
      const { data: prot, error: errProt } = await supabase
        .from('protocolos' as any)
        .insert({
          paciente_id: analiseAvaliacao.paciente_id,
          terapeuta_id: user.id,
          avaliacao_id: analiseAvaliacao.id,
          titulo: `Diretriz Personalizada – ${pacNome}`,
          objetivo_geral: analise.objetivoGeral,
          duracao_total: analise.duracaoTotal,
          frequencia: analise.frequencia,
          perfil_dominante: analise.demandasIdentificadas.map(d => d.area.toUpperCase().replace(/ /g, '_')),
          scores_avaliacao: scores,
          hierarquia_terapeutica: analise.demandasIdentificadas.map(d => ({
            foco: d.area,
            severidade: d.severidade,
            prioridade: d.prioridade,
            motivo: d.motivo,
          })),
          status: 'ativo',
          data_inicio: new Date().toISOString().split('T')[0],
        })
        .select()
        .single();

      if (errProt) throw errProt;

      // 2. Criar fases
      for (const fase of analise.fases) {
        await supabase.from('protocolo_fases' as any).insert({
          protocolo_id: (prot as any).id,
          numero_fase: fase.numero,
          titulo: fase.titulo,
          semanas_inicio: fase.semanas_inicio,
          semanas_fim: fase.semanas_fim,
          objetivos: [fase.objetivo, ...fase.demandasAlvo.map(d => `Foco: ${d}`)],
          sessoes_por_semana: fase.frequenciaSemanal,
        });
      }

      qc.invalidateQueries({ queryKey: ['protocolos'] });
      qc.invalidateQueries({ queryKey: ['avaliacoes-sem-protocolo'] });
      toast({ title: '✅ Diretriz salva com sucesso!', description: 'Diretriz em 4 fases criada e pronta para uso.' });
      setAnaliseAvaliacao(null);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro ao salvar diretriz', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const filtered = protocolos.filter(p => {
    const nome = getPacienteNome(p.paciente_id).toLowerCase();
    const titulo = p.titulo.toLowerCase();
    const q = search.toLowerCase();
    return nome.includes(q) || titulo.includes(q);
  });

  // ── View: Análise automática ─────────────────────────────────────────────────
  if (analiseAvaliacao) {
    return (
      <AppLayout>
        <div className="container py-8">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="outline" onClick={() => setAnaliseAvaliacao(null)} className="gap-2">
              <ChevronRight className="h-4 w-4 rotate-180" />
              Voltar
            </Button>
            <div>
              <h1 className="text-xl font-bold text-foreground">Análise Automática de Diretriz</h1>
              <p className="text-sm text-muted-foreground">Baseada nos scores da avaliação · {getPacienteNome(analiseAvaliacao.paciente_id)}</p>
            </div>
          </div>
          <AnaliseAutomatica
            avaliacao={analiseAvaliacao}
            pacienteNome={getPacienteNome(analiseAvaliacao.paciente_id)}
            onSalvar={handleSalvarAnalise}
            onDescartar={() => setAnaliseAvaliacao(null)}
            salvando={salvando}
          />
        </div>
      </AppLayout>
    );
  }

  // ── View: Ver protocolo existente ─────────────────────────────────────────────
  if (viewingId) {
    return (
      <AppLayout>
        <ProtocoloViewer
          protocoloId={viewingId}
          onBack={() => setViewingId(null)}
          onExportPDF={() => {
            const p = protocolos.find(x => x.id === viewingId);
            if (p) handleExportPDF(p);
          }}
        />
      </AppLayout>
    );
  }

  // ── View: Lista de protocolos ─────────────────────────────────────────────────
  return (
    <AppLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <ClipboardList className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Diretrizes de Tratamento</h1>
              <p className="text-muted-foreground text-sm">
                {protocolos.length} diretriz{protocolos.length !== 1 ? 'es' : ''} · {avaliacoesSemProtocolo.length} avaliação{avaliacoesSemProtocolo.length !== 1 ? 'ões' : ''} pendente{avaliacoesSemProtocolo.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/metodo-identidade')}
            className="bg-gradient-primary text-white gap-2"
          >
            <Plus className="h-4 w-4" />
            Nova Avaliação
          </Button>
        </div>

        {/* Avaliações pendentes de protocolo */}
        {avaliacoesSemProtocolo.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-sm text-foreground">Avaliações Prontas para Diretriz</h2>
              <Badge className="bg-amber-100 text-amber-700 border-0">{avaliacoesSemProtocolo.length}</Badge>
            </div>
            <div className="space-y-2">
              {avaliacoesSemProtocolo.map(av => {
                const idFinal = av.dor_identidade || 0;
                const demandasCount = identificarDemandas({
                  E: av.score_e || 0, P: av.score_p || 0, C: av.score_c || 0,
                  F: av.score_f || 0, D: av.score_d || 0, R: av.score_r || 0, EFI: av.score_efi || 0,
                }).length;
                return (
                  <div key={av.id} className="clinical-card border-l-4 border-amber-400 flex items-center gap-4 py-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <Activity className="h-5 w-5 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{getPacienteNome(av.paciente_id)}</span>
                        <Badge variant="outline" className="text-xs">ID {idFinal.toFixed(1)}</Badge>
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">{demandasCount} demandas</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Avaliação de {format(new Date(av.created_at), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Button
                      className="bg-gradient-primary text-white gap-2 shrink-0"
                      size="sm"
                      onClick={() => setAnaliseAvaliacao(av)}
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Gerar Diretriz
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Structural evaluations */}
        {structuralAvals.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-orange-500" />
              <h2 className="font-semibold text-sm text-foreground">Avaliações Estruturais</h2>
              <Badge className="bg-orange-100 text-orange-700 border-0">{structuralAvals.length}</Badge>
            </div>
            <div className="space-y-2">
              {structuralAvals.slice(0, 5).map((av: any) => {
                const sData = av.dados_estruturais as StructuralAssessmentData | null;
                if (!sData) return null;
                return (
                  <StructuralDiretrizCard
                    key={av.id}
                    pacienteNome={getPacienteNome(av.paciente_id)}
                    date={av.created_at}
                    data={sData}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Busca */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente ou diretriz..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Lista de protocolos */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <FileText className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma diretriz encontrada</h3>
            <p className="text-muted-foreground mb-6">
              Conclua uma avaliação do Método Identidade para gerar uma diretriz automaticamente.
            </p>
            <Button onClick={() => navigate('/metodo-identidade')} className="bg-gradient-primary text-white">
              <Plus className="h-4 w-4 mr-2" />
              Iniciar Avaliação
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(protocolo => {
              const statusInfo = STATUS_LABELS[protocolo.status] || STATUS_LABELS.ativo;
              const paciente = getPacienteNome(protocolo.paciente_id);
              const scores = protocolo.scores_avaliacao || {};

              return (
                <div key={protocolo.id} className="clinical-card hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="font-semibold text-foreground truncate">{protocolo.titulo}</h3>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />{paciente}
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(protocolo.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </span>
                            <span>{protocolo.duracao_total}</span>
                            <span>{protocolo.frequencia}</span>
                          </div>
                        </div>
                        <Badge className={`${statusInfo.color} border-0 shrink-0`}>
                          {statusInfo.label}
                        </Badge>
                      </div>

                      {Object.keys(scores).length > 0 && (
                        <div className="flex gap-4 mt-3 text-xs">
                          {['E', 'P', 'D', 'R', 'EFI'].map(k => (
                            <div key={k} className="text-center">
                              <div className="font-bold text-foreground">{(scores[k] || 0).toFixed(1)}</div>
                              <div className="text-muted-foreground">{k}</div>
                            </div>
                          ))}
                          {scores['idFinal'] && (
                            <div className="text-center ml-2 pl-2 border-l border-border">
                              <div className="font-bold text-primary text-sm">{(scores['idFinal'] as number).toFixed(1)}</div>
                              <div className="text-muted-foreground">ID</div>
                            </div>
                          )}
                        </div>
                      )}

                      {protocolo.perfil_dominante?.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {protocolo.perfil_dominante.slice(0, 3).map(p => (
                            <Badge key={p} variant="outline" className="text-xs py-0">
                              {p.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {protocolo.perfil_dominante.length > 3 && (
                            <Badge variant="outline" className="text-xs py-0">
                              +{protocolo.perfil_dominante.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => setViewingId(protocolo.id)} className="gap-1">
                        <Eye className="h-3 w-3" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExportPDF(protocolo)}
                        disabled={exportingId === protocolo.id}
                        className="gap-1"
                      >
                        {exportingId === protocolo.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                        PDF
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm('Excluir esta diretriz?')) deleteMutation.mutate(protocolo.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// ── Structural evaluation card with inline diretriz generation ────────
function StructuralDiretrizCard({ pacienteNome, date, data }: { pacienteNome: string; date: string; data: StructuralAssessmentData }) {
  const [guidelines, setGuidelines] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    const lines: string[] = [];
    const d = new Date().toLocaleDateString('pt-BR');
    lines.push('═══════════════════════════════════════');
    lines.push('  DIRETRIZ ESTRUTURAL · Método Identidade');
    lines.push(`  Paciente: ${pacienteNome} · ${d}`);
    lines.push('═══════════════════════════════════════');
    lines.push('');
    lines.push(`Score Geral: ${data.scoreStructuralGeneral.toFixed(1)}/10 — ${data.classification}`);
    lines.push('');
    if (data.primaryDriver) {
      const cfg = UNIT_CONFIGS.find(u => u.id === data.primaryDriver);
      const unit = data.units[data.primaryDriver];
      if (cfg && unit) {
        lines.push(`⚠️ DRIVER: ${cfg.id} (${cfg.name}) — ${unit.score.toFixed(1)}`);
        lines.push('');
      }
    }
    if (data.clinicalPriorities.length > 0) {
      lines.push('─── PRIORIDADES ───');
      data.clinicalPriorities.forEach(p => {
        const cfg = UNIT_CONFIGS.find(u => u.id === p.unitId);
        lines.push(`  ${p.priority}. ${cfg?.emoji || ''} ${p.unitId} (${p.score.toFixed(1)}) · ${p.action}`);
      });
      lines.push('');
    }
    if (data.relationships.direct.length > 0) {
      lines.push('─── CONEXÕES ───');
      data.relationships.direct.forEach(rel => {
        lines.push(`  ${rel.source} → ${rel.target} · ${rel.mechanism}`);
      });
      lines.push('');
    }
    const critical = data.clinicalPriorities.filter(p => p.score >= 8);
    const moderate = data.clinicalPriorities.filter(p => p.score >= 5 && p.score < 8);
    lines.push('─── PROTOCOLO ───');
    if (critical.length > 0) {
      lines.push('FASE 1 — AGUDA (Sem 1-3): Liberação miofascial, TENS, isométricos');
    }
    if (moderate.length > 0) {
      lines.push('FASE 2 — SUBAGUDA (Sem 3-6): Mob. grau III-IV, estabilização');
    }
    lines.push('FASE 3 — MANUTENÇÃO (Sem 6-8): Exercícios funcionais, reeducação');
    setGuidelines(lines.join('\n'));
  };

  const handleCopy = () => {
    if (guidelines) { navigator.clipboard.writeText(guidelines); setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="clinical-card border-l-4 border-orange-400 py-3">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
          <Activity className="h-5 w-5 text-orange-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{pacienteNome}</span>
            <Badge variant="outline" className="text-xs">
              <span className={classifyScoreColor(data.scoreStructuralGeneral)}>{data.scoreStructuralGeneral.toFixed(1)}</span>
            </Badge>
            <Badge className="bg-orange-100 text-orange-700 border-0 text-xs">{data.classification}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Avaliação Estrutural · {format(new Date(date), "dd 'de' MMM, yyyy", { locale: ptBR })}
          </p>
        </div>
        {!guidelines && (
          <Button className="bg-gradient-primary text-white gap-2 shrink-0" size="sm" onClick={generate}>
            <Zap className="h-3.5 w-3.5" /> Gerar Diretriz
          </Button>
        )}
      </div>

      {guidelines && (
        <div className="mt-3 pt-3 border-t space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold flex items-center gap-1">
              <Zap className="h-3 w-3 text-primary" /> Diretriz Gerada
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2" onClick={handleCopy}>
                {copied ? '✓' : 'Copiar'}
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                onClick={() => { const w = window.open('', '_blank'); if (w) { w.document.write(`<pre style="font-family:monospace;font-size:12px;padding:20px;white-space:pre-wrap;">${guidelines}</pre>`); w.document.close(); w.print(); } }}>
                Imprimir
              </Button>
            </div>
          </div>
          <pre className="text-[9px] bg-muted/50 p-2 rounded-lg whitespace-pre-wrap font-mono max-h-60 overflow-y-auto">{guidelines}</pre>
        </div>
      )}
    </div>
  );
}
