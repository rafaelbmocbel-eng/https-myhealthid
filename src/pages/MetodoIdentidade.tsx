import { useState, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import { AvaliacaoIdentidade } from '@/types/identidade';
import Bloco1Anamnese from '@/components/identidade/Bloco1Anamnese';
import Bloco2Dor from '@/components/identidade/Bloco2Dor';
import Bloco3Funcionalidade from '@/components/identidade/Bloco3Funcionalidade';
import Bloco4Kinesiophobia from '@/components/identidade/Bloco4Kinesiophobia';
import Bloco5Regulacao from '@/components/identidade/Bloco5Regulacao';
import Bloco6Estrutural from '@/components/identidade/Bloco6Estrutural';
import RelatorioIdentidade from '@/components/identidade/RelatorioIdentidade';
import { calcularIDFinal } from '@/utils/calculations';
import {
  CheckCircle2, Circle, ClipboardList, HeartPulse, Activity, Brain,
  Bed, Dumbbell, Users, Link2, Copy, Loader2, Search, ChevronRight, MessageCircle,
  History, ChevronDown, ChevronUp, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { usePacientes } from '@/hooks/usePacientes';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { useAvaliacoesIdentidade } from '@/hooks/useAvaliacoesSalvas';
import { differenceInDays, format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { shareAvaliacaoLink } from '@/utils/whatsapp';
import { cn } from '@/lib/utils';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const blocos = [
  { id: 1, label: 'Anamnese & Contexto', sublabel: 'Score F', icon: ClipboardList, time: '8 min' },
  { id: 2, label: 'Avaliação da Dor', sublabel: 'Score D', icon: HeartPulse, time: '12 min' },
  { id: 3, label: 'Funcionalidade', sublabel: 'Score EFI', icon: Activity, time: '4 min' },
  { id: 4, label: 'Kinesiophobia', sublabel: 'Score P (TSK-11)', icon: Brain, time: '6 min' },
  { id: 5, label: 'Regulação Neurovegetativa', sublabel: 'Scores R e C', icon: Bed, time: '10 min' },
  { id: 6, label: 'Avaliação Estrutural', sublabel: 'Score E (8 UCs)', icon: Dumbbell, time: '15 min' },
];

const makeDefaultAvaliacao = (pacienteNome = 'Paciente'): AvaliacaoIdentidade => ({
  pacienteNome,
  pacienteIdade: 35,
  terapeutaNome: '',
  dataAvaliacao: new Date().toLocaleDateString('pt-BR'),
  bloco1: {
    queixaPrincipal: '', duracao: '', eventoPrecipitante: false, eventoPrecipitanteDescricao: '',
    historicoMedico: [], historicoFamiliar: false, historicoFamiliarDescricao: '',
    metasTerapeuticas: ['', '', ''], profissao: '', horasSedentario: 8, atividadeFisica: 'leve',
    qualidadeSono: 5, tabagismo: false, alcool: 'nenhum', litrosAgua: 2,
    impactoQualidadeVida: 5, interferenciaTrbalho: 5, quantidadeComorbidades: 2, historicoFamiliarPeso: 3,
    scoreF: 0,
  },
  bloco2: { regioes: [], scoreD: 0 },
  bloco3: { trabalho: 5, domesticas: 5, exercicio: 5, independencia: 5, vidaSocial: 5, scoreEFI: 5 },
  bloco4: { respostas: Array(11).fill(2), scoreP: 0 },
  bloco5: {
    qualidadeSono: 5, horasSono: 7, acordaNaNoite: 3, dorAfetaSono: 3, descansadoAoAcordar: 6,
    scoreR1: 0, energiaAoAcordar: 6, fadigaDia: 4, precisaCochiblar: 2, motivacao: 6, resistenciaFisica: 6,
    scoreR2: 0, nivelStress: 5, humorGeral: 6, concentracao: 6, preocupacaoSaude: 4, sensacaoControle: 6,
    scoreR3: 0, cargaLaboral: 5, relacionamentos: 4, situacaoFinanceira: 4, eventosEstressantes: 3,
    scoreC: 0, scoreR: 0,
  },
  bloco6: { unidades: [], scoreE: 0 },
  idFinal: 0,
  classificacao: '',
  blocoAtual: 1,
  concluido: false,
});

export default function MetodoIdentidade() {
  const { user, loading: authLoading } = useAuth();
  const { pacientes, isLoading: loadingPacientes } = usePacientes('metodo_identidade');
  const { links, gerarLink, copiarLink, cancelarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const { avaliacoes: avaliacoesSalvas, isLoading: loadingAvaliacoes, deletar: deletarAvaliacao } = useAvaliacoesIdentidade();

  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(null);
  const [searchPac, setSearchPac] = useState('');
  const [avaliacao, setAvaliacao] = useState<AvaliacaoIdentidade>(makeDefaultAvaliacao());
  const [showRelatorio, setShowRelatorio] = useState(false);
  const [blocosConcluidos, setBlocosConcluidos] = useState<Set<number>>(new Set());
  const [showLinkPanel, setShowLinkPanel] = useState(false);
  const [expandedAvaliacaoId, setExpandedAvaliacaoId] = useState<string | null>(null);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const selectedPaciente = pacientes.find(p => p.id === selectedPacienteId);
  const filteredPac = pacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(searchPac.toLowerCase())
  );

  const getLinkAtivo = (pid: string) =>
    links.find(l => l.paciente_id === pid && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  const handleSelectPaciente = (pac: typeof pacientes[0]) => {
    setSelectedPacienteId(pac.id);
    setAvaliacao(makeDefaultAvaliacao(`${pac.nome} ${pac.sobrenome}`));
    setBlocosConcluidos(new Set());
    setShowRelatorio(false);
    setShowLinkPanel(false);
  };

  const updateBloco = useCallback((blocoKey: keyof AvaliacaoIdentidade, data: any) => {
    setAvaliacao(prev => ({ ...prev, [blocoKey]: data }));
  }, []);

  const avancarBloco = useCallback((blocoAtual: number) => {
    setBlocosConcluidos(prev => new Set([...prev, blocoAtual]));
    if (blocoAtual < 6) {
      setAvaliacao(prev => ({ ...prev, blocoAtual: blocoAtual + 1 }));
    } else {
      const { idFinal, classificacao } = calcularIDFinal(
        avaliacao.bloco6.scoreE, avaliacao.bloco4.scoreP,
        avaliacao.bloco5.scoreC, avaliacao.bloco1.scoreF,
        avaliacao.bloco2.scoreD, avaliacao.bloco5.scoreR,
      );
      setAvaliacao(prev => ({ ...prev, idFinal, classificacao, concluido: true }));
      setShowRelatorio(true);
    }
  }, [avaliacao]);

  const voltarBloco = useCallback(() => {
    setAvaliacao(prev => ({ ...prev, blocoAtual: Math.max(1, prev.blocoAtual - 1) }));
  }, []);

  const progresso = (blocosConcluidos.size / 6) * 100;

  if (showRelatorio) {
    return (
      <AppLayout>
        <RelatorioIdentidade avaliacao={avaliacao} pacienteId={selectedPacienteId || undefined} onBack={() => setShowRelatorio(false)} />
      </AppLayout>
    );
  }

  // Patient selection screen
  if (!selectedPacienteId) {
    return (
      <AppLayout>
        <div className="container py-8 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Método Identidade</h1>
              <p className="text-muted-foreground text-sm">Selecione o paciente para iniciar a avaliação</p>
            </div>
          </div>

          <div className="clinical-card">
            <div className="flex items-center gap-3 mb-4">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Pacientes — Método Identidade</h3>
            </div>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar paciente..."
                className="pl-9"
                value={searchPac}
                onChange={e => setSearchPac(e.target.value)}
              />
            </div>

            {loadingPacientes ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : filteredPac.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-2 opacity-30" />
                <p className="font-medium">Nenhum paciente com Método Identidade ativo</p>
                <p className="text-sm mt-1">Cadastre pacientes em <strong>Pacientes</strong> e ative o serviço.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPac.map(p => {
                  const linkAtivo = getLinkAtivo(p.id);
                  const diasRestantes = linkAtivo ? differenceInDays(new Date(linkAtivo.data_expiracao), new Date()) : 0;
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border hover:border-primary/30 hover:bg-accent/20 transition-all group">
                      <div className="h-10 w-10 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-white font-bold text-sm">
                        {p.nome[0]}{p.sobrenome?.[0] || ''}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                          {linkAtivo && (
                            <Badge variant="outline" className="text-[10px] h-4 bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                              <Link2 className="h-2.5 w-2.5" /> {diasRestantes}d
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs gap-1"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (linkAtivo) {
                              copiarLink(linkAtivo.token);
                            } else {
                              const novo = await gerarLink(p.id);
                              if (novo) copiarLink(novo.token);
                            }
                          }}
                          disabled={gerando}
                        >
                          {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                          {linkAtivo ? 'Copiar' : 'Gerar link'}
                        </Button>
                        {(linkAtivo && p.telefone) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1 border-green-500 text-green-600 hover:bg-green-50"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const url = getLinkUrl(linkAtivo.token);
                              shareAvaliacaoLink(`${p.nome} ${p.sobrenome}`, p.telefone!, url);
                            }}
                            title="Enviar link por WhatsApp"
                          >
                            <MessageCircle className="h-3 w-3" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          className="h-8 text-xs bg-gradient-primary text-white gap-1"
                          onClick={() => handleSelectPaciente(p)}
                        >
                          Avaliar <ChevronRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Histórico de avaliações salvas */}
          {avaliacoesSalvas.length > 0 && (
            <div className="clinical-card mt-4">
              <div className="flex items-center gap-3 mb-4">
                <History className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Histórico de Avaliações</h3>
              </div>
              <div className="space-y-2">
                {avaliacoesSalvas.map((av: any) => (
                  <div key={av.id} className="border rounded-xl overflow-hidden">
                    <div
                      className="flex items-center gap-3 p-3 hover:bg-accent/20 transition-all cursor-pointer"
                      onClick={() => setExpandedAvaliacaoId(expandedAvaliacaoId === av.id ? null : av.id)}
                    >
                      <div className="h-9 w-9 rounded-full bg-gradient-primary flex items-center justify-center shrink-0 text-primary-foreground font-bold text-sm">
                        {av.paciente_nome?.[0] || '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground">{av.paciente_nome}</span>
                          {av.classificacao && (
                            <Badge variant="outline" className="text-[10px] h-4">{av.classificacao}</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {av.data_avaliacao} · ID: {av.id_final?.toFixed(1)}/50
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deletarAvaliacao(av.id); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        {expandedAvaliacaoId === av.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </div>
                    </div>
                    {expandedAvaliacaoId === av.id && (
                      <div className="px-4 pb-3 border-t bg-muted/30">
                        <div className="grid grid-cols-4 gap-3 pt-3 text-center">
                          {[
                            { label: 'E', value: av.score_e },
                            { label: 'P', value: av.score_p },
                            { label: 'C', value: av.score_c },
                            { label: 'D', value: av.score_d },
                            { label: 'F', value: av.score_f },
                            { label: 'R', value: av.score_r },
                            { label: 'EFI', value: av.score_efi },
                          ].map(s => (
                            <div key={s.label} className="bg-background rounded-lg p-2">
                              <div className="text-xs text-muted-foreground">{s.label}</div>
                              <div className="font-bold text-sm text-foreground">{s.value?.toFixed(1) ?? '–'}</div>
                            </div>
                          ))}
                        </div>
                        <Button
                          size="sm"
                          className="w-full mt-3 bg-gradient-primary text-primary-foreground text-xs"
                          onClick={() => {
                            const pac = pacientes.find(p => p.id === av.paciente_id);
                            if (pac) {
                              setSelectedPacienteId(pac.id);
                              setAvaliacao(av.dados_avaliacao as AvaliacaoIdentidade);
                              setShowRelatorio(true);
                            }
                          }}
                        >
                          Ver relatório completo
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Assessment screen
  return (
    <AppLayout>
      <div className="container py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Método Identidade</h1>
              <p className="text-muted-foreground text-sm">Avaliação Integrada da Disfunção | {avaliacao.dataAvaliacao}</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto text-xs" onClick={() => setSelectedPacienteId(null)}>
              <Users className="h-3.5 w-3.5 mr-1" /> Trocar paciente
            </Button>
          </div>
          <div className="flex items-center gap-4 mt-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Progresso da avaliação</span>
                <span className="font-medium text-primary">{blocosConcluidos.size}/6 blocos</span>
              </div>
              <Progress value={progresso} className="h-2" />
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Paciente</div>
              <div className="font-semibold">{avaliacao.pacienteNome}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="clinical-card sticky top-24">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-4">Blocos de Avaliação</h3>
              <div className="space-y-2">
                {blocos.map(bloco => {
                  const Icon = bloco.icon;
                  const isActive = avaliacao.blocoAtual === bloco.id;
                  const isConcluido = blocosConcluidos.has(bloco.id);
                  return (
                    <button
                      key={bloco.id}
                      onClick={() => setAvaliacao(prev => ({ ...prev, blocoAtual: bloco.id }))}
                      className={`w-full text-left block-step ${isActive ? 'active' : isConcluido ? 'completed' : 'pending'}`}
                    >
                      <div className="flex items-center gap-3">
                        {isConcluido ? (
                          <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0" />
                        ) : isActive ? (
                          <Icon className="h-5 w-5 text-primary flex-shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className={cn('text-sm font-medium truncate', isActive ? 'text-primary' : isConcluido ? 'text-success' : 'text-foreground')}>
                            {bloco.label}
                          </div>
                          <div className="text-xs text-muted-foreground">{bloco.sublabel} · {bloco.time}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Link de avaliação remota */}
              {selectedPacienteId && (() => {
                const linkAtivo = getLinkAtivo(selectedPacienteId);
                return (
                  <div className="mt-4 pt-4 border-t space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avaliação Remota</p>
                    {linkAtivo ? (
                      <>
                        <div className="flex items-center gap-2 text-xs text-emerald-600">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Link ativo · {differenceInDays(new Date(linkAtivo.data_expiracao), new Date())} dias
                        </div>
                        <Button size="sm" variant="outline" className="w-full text-xs gap-1 h-8" onClick={() => copiarLink(linkAtivo.token)}>
                          <Copy className="h-3 w-3" /> Copiar link
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full text-xs gap-1 h-8"
                        onClick={async () => {
                          const novo = await gerarLink(selectedPacienteId);
                          if (novo) copiarLink(novo.token);
                        }}
                        disabled={gerando}
                      >
                        {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2 className="h-3 w-3" />}
                        Gerar link 30 dias
                      </Button>
                    )}
                  </div>
                );
              })()}

              {blocosConcluidos.size > 0 && (
                <Button
                  className="w-full mt-3 bg-gradient-primary text-white text-xs"
                  onClick={() => {
                    const { idFinal, classificacao } = calcularIDFinal(
                      avaliacao.bloco6.scoreE, avaliacao.bloco4.scoreP,
                      avaliacao.bloco5.scoreC, avaliacao.bloco1.scoreF,
                      avaliacao.bloco2.scoreD, avaliacao.bloco5.scoreR,
                    );
                    setAvaliacao(prev => ({ ...prev, idFinal, classificacao }));
                    setShowRelatorio(true);
                  }}
                >
                  Ver Relatório Parcial
                </Button>
              )}
            </div>
          </div>

          {/* Conteúdo principal */}
          <div className="lg:col-span-3">
            <div className="animate-slide-in">
              {avaliacao.blocoAtual === 1 && (
                <Bloco1Anamnese data={avaliacao.bloco1} onChange={(d) => updateBloco('bloco1', d)} onNext={() => avancarBloco(1)} />
              )}
              {avaliacao.blocoAtual === 2 && (
                <Bloco2Dor data={avaliacao.bloco2} onChange={(d) => updateBloco('bloco2', d)} onNext={() => avancarBloco(2)} onBack={voltarBloco} />
              )}
              {avaliacao.blocoAtual === 3 && (
                <Bloco3Funcionalidade data={avaliacao.bloco3} onChange={(d) => updateBloco('bloco3', d)} onNext={() => avancarBloco(3)} onBack={voltarBloco} />
              )}
              {avaliacao.blocoAtual === 4 && (
                <Bloco4Kinesiophobia data={avaliacao.bloco4} onChange={(d) => updateBloco('bloco4', d)} onNext={() => avancarBloco(4)} onBack={voltarBloco} />
              )}
              {avaliacao.blocoAtual === 5 && (
                <Bloco5Regulacao data={avaliacao.bloco5} onChange={(d) => updateBloco('bloco5', d)} onNext={() => avancarBloco(5)} onBack={voltarBloco} />
              )}
              {avaliacao.blocoAtual === 6 && (
                <Bloco6Estrutural data={avaliacao.bloco6} onChange={(d) => updateBloco('bloco6', d)} onNext={() => avancarBloco(6)} onBack={voltarBloco} />
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
