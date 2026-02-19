import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  FileText, Plus, Search, Eye, Download, Trash2,
  Calendar, User, Activity, ChevronRight, Loader2, ClipboardList
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { gerarPDFProtocolo, PDFProtocolo } from '@/utils/pdfGenerator';
import { toast } from '@/hooks/use-toast';
import ProtocoloViewer from '@/components/protocolo/ProtocoloViewer';

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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ativo: { label: 'Ativo', color: 'bg-emerald-100 text-emerald-700' },
  concluido: { label: 'Concluído', color: 'bg-blue-100 text-blue-700' },
  pausado: { label: 'Pausado', color: 'bg-amber-100 text-amber-700' },
};

export default function Protocolos() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);

  if (!loading && !user) { navigate('/auth'); return null; }

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
      // Buscar fases e exercícios do protocolo
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
        scores: {
          E: scores['E'] || 0,
          P: scores['P'] || 0,
          C: scores['C'] || 0,
          F: scores['F'] || 0,
          D: scores['D'] || 0,
          R: scores['R'] || 0,
          EFI: scores['EFI'] || 0,
        },
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

  const filtered = protocolos.filter(p => {
    const nome = getPacienteNome(p.paciente_id).toLowerCase();
    const titulo = p.titulo.toLowerCase();
    const q = search.toLowerCase();
    return nome.includes(q) || titulo.includes(q);
  });

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
                {protocolos.length} protocolo{protocolos.length !== 1 ? 's' : ''} gerado{protocolos.length !== 1 ? 's' : ''}
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

        {/* Search */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por paciente ou protocolo..."
            className="pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Lista */}
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
                    {/* Icon */}
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>

                    {/* Content */}
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

                      {/* Scores resumo */}
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

                      {/* Perfil dominante */}
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

                    {/* Actions */}
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingId(protocolo.id)}
                        className="gap-1"
                      >
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
                        {exportingId === protocolo.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3 w-3" />
                        )}
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
