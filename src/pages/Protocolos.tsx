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
            <h2 className="text-xl font-bold">Protocolo Personalizado – {pacienteNome}</h2>
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
          Protocolo em 4 Fases
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
                          Exercícios Sugeridos ({fase.exercicios.length})
                        </h4>
                        <div className="space-y-2">
                          {fase.exercicios.map((ex, i) => (
                            <div key={i} className="p-3 rounded-lg border bg-card">
                              <div className="flex items-start gap-2">
                                <div className={`w-5 h-5 rounded-full ${FASE_CORES[idx]} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5`}>
                                  {i + 1}
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
                          ))}
                        </div>
                      </div>

                      {/* Técnicas */}
                      <div>
                        <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
                          Técnicas Sugeridas ({fase.tecnicas.length})
                        </h4>
                        <div className="space-y-2">
                          {fase.tecnicas.map((tec, i) => (
                            <div key={i} className="p-3 rounded-lg border bg-card">
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
                          ))}
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
        <h3 className="font-semibold text-sm mb-3">Ações do Protocolo</h3>
        <div className="flex flex-wrap gap-3">
          <Button
            className="bg-gradient-primary text-white gap-2"
            onClick={() => onSalvar(analise)}
            disabled={salvando}
          >
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aceitar e Salvar Protocolo
          </Button>
          <Button variant="outline" onClick={onDescartar} className="gap-2">
            <X className="h-4 w-4" />
            Descartar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Ao aceitar, o protocolo será salvo e você poderá exportar o PDF ou enviá-lo ao paciente.
        </p>
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['protocolos'] }); toast({ title: 'Protocolo excluído' }); },
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
          titulo: `Protocolo Personalizado – ${pacNome}`,
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
      toast({ title: '✅ Protocolo salvo com sucesso!', description: 'Protocolo em 4 fases criado e pronto para uso.' });
      setAnaliseAvaliacao(null);
    } catch (err: any) {
      console.error(err);
      toast({ title: 'Erro ao salvar protocolo', description: err.message, variant: 'destructive' });
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
              <h1 className="text-xl font-bold text-foreground">Análise Automática de Protocolo</h1>
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
              <h1 className="text-2xl font-bold text-foreground">Protocolos de Tratamento</h1>
              <p className="text-muted-foreground text-sm">
                {protocolos.length} protocolo{protocolos.length !== 1 ? 's' : ''} · {avaliacoesSemProtocolo.length} avaliação{avaliacoesSemProtocolo.length !== 1 ? 'ões' : ''} pendente{avaliacoesSemProtocolo.length !== 1 ? 's' : ''}
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
              <h2 className="font-semibold text-sm text-foreground">Avaliações Prontas para Protocolo</h2>
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
                      Gerar Protocolo
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Busca */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente ou protocolo..."
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
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhum protocolo encontrado</h3>
            <p className="text-muted-foreground mb-6">
              Conclua uma avaliação do Método Identidade para gerar um protocolo automaticamente.
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
                          if (confirm('Excluir este protocolo?')) deleteMutation.mutate(protocolo.id);
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
