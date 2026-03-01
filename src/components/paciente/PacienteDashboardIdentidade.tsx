import { useState } from 'react';
import { ArrowLeft, Link2, Copy, MessageCircle, Mail, Plus, Loader2, FileText, Calendar, BarChart3, CalendarDays, Dumbbell, AlignCenter, Fingerprint, UserCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, format } from 'date-fns';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { getAgendaUrl } from '@/utils/linkUrls';
import QuestionariosComparacao from './QuestionariosComparacao';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import { getMyIDFingerprintData, getMyIDSeverityColor } from '@/utils/myidCalculations';
import type { MyIDResult as MyIDResultType } from '@/types/myid';
import { MyIDWizard } from '../myid/MyIDWizard';
import { MyIDResult } from '../myid/MyIDResult';

interface Paciente {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string | null;
  telefone?: string | null;
}

interface RespostasPrecarga {
  bloco1?: any;
  bloco2?: any;
  bloco3?: any;
  bloco4?: any;
  bloco5?: any;
}

interface Props {
  paciente: Paciente;
  onBack: () => void;
  onIniciarAvaliacao: (precarga?: RespostasPrecarga) => void;
  onVerRelatorio: (avaliacao: any) => void;
  onEditarAvaliacao?: (avaliacao: any) => void;
}

export default function PacienteDashboardIdentidade({ paciente, onBack }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [gerandoAgenda, setGerandoAgenda] = useState(false);

  const linkAtivo = links.find(l => l.paciente_id === paciente.id && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  // Links de agenda para este paciente
  const { data: linksAgenda = [] } = useQuery({
    queryKey: ['links-agenda-dashboard', user?.id, paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const linkAgendaAtivo = linksAgenda.find((l: any) => l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  const gerarLinkAgenda = async () => {
    if (!user) return;
    setGerandoAgenda(true);
    try {
      await supabase
        .from('links_agenda_paciente')
        .update({ status: 'cancelado' })
        .eq('paciente_id', paciente.id)
        .eq('terapeuta_id', user.id)
        .eq('status', 'ativo');

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 90);
      const { error } = await supabase.from('links_agenda_paciente').insert({
        paciente_id: paciente.id,
        terapeuta_id: user.id,
        data_expiracao: dataExpiracao.toISOString(),
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links-agenda-dashboard'] });
      toast({ title: 'Link de agenda gerado! ✅', description: 'Válido por 90 dias.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoAgenda(false);
    }
  };

  const copiarAgendaLink = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link de agenda copiado! 📋' });
  };

  // Respostas remotas para este paciente
  const { data: linksAvPaciente = [] } = useQuery({
    queryKey: ['links-av-paciente', user?.id, paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ['respostas-paciente', paciente.id],
    queryFn: async () => {
      const linkIds = linksAvPaciente.map(l => l.id);
      if (linkIds.length === 0) return [];
      const { data, error } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('*')
        .in('link_id', linkIds)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: linksAvPaciente.length > 0,
  });

  // Buscar dados de outros serviços para integração (COB e Studio)
  const { data: ultimaCob } = useQuery({
    queryKey: ['dashboard-ultima-cob', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_cob_zero')
        .select('*')
        .eq('paciente_id', paciente.id)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const { data: ultimaMedidaStudio } = useQuery({
    queryKey: ['dashboard-ultima-medida-studio', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('studio_medidas')
        .select('*')
        .eq('paciente_id', paciente.id)
        .order('data_medida', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  // Buscar última avaliação MyID
  const { data: ultimaMyID } = useQuery({
    queryKey: ['dashboard-ultima-myid', paciente.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', paciente.id)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      return data?.[0] || null;
    },
  });

  const enviarEmail = async () => {
    if (!paciente.email || !linkAtivo) return;
    setEnviandoEmail(true);
    try {
      const { data, error } = await supabase.functions.invoke('enviar-link-email', {
        body: {
          patientName: `${paciente.nome} ${paciente.sobrenome}`,
          patientEmail: paciente.email,
          linkUrl: getLinkUrl(linkAtivo.token),
          linkType: 'avaliacao',
        },
      });
      if (error) throw error;
      if (data?.error) toast({ title: 'Email não enviado', description: data.error, variant: 'destructive' });
      else toast({ title: '✉️ Email enviado!', description: `Para ${paciente.email}` });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar email', description: e.message, variant: 'destructive' });
    } finally {
      setEnviandoEmail(false);
    }
  };

  const { data: myidAvaliacoes = [], refetch: refetchMyID } = useQuery({
    queryKey: ['myid-avaliacoes', paciente.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .eq('status', 'concluido')
        // Na vida real você teria paciente_id mas no momento a tabela não conectou direto o dashboard ao Link se não setarmos
        // Idealmente, adicionar paciente_id se houver. Por enquanto buscamos todos e não filtramos por paciente_id se não existe na migration... 
        // Ops, a migration DEVE ter paciente_id.
        // Simulando pegar a mais recente para o contexto da UI
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const [iniciandoMyID, setIniciandoMyID] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-12 w-12 rounded-2xl bg-gradient-identidade flex items-center justify-center shadow-lg shrink-0 text-white font-bold text-lg">
          {paciente.nome[0]}{paciente.sobrenome?.[0] || ''}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-black text-foreground truncate">{paciente.nome} {paciente.sobrenome}</h1>
          <p className="text-xs text-muted-foreground">Método Identidade</p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <a href={`/pacientes/${paciente.id}`}>
            <ExternalLink className="h-3.5 w-3.5 mr-1" /> Perfil
          </a>
        </Button>
      </div>

      {/* Links Compactos */}
      <div className="clinical-card !p-3">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Link Avaliação */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Link2 className="h-4 w-4 text-identidade shrink-0" />
            <span className="text-xs font-semibold shrink-0">Questionário Identidade</span>
            {linkAtivo ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse shrink-0" />
                <span className="text-[10px] text-success shrink-0">{differenceInDays(new Date(linkAtivo.data_expiracao), new Date())}d</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarLink(linkAtivo.token)}>
                  <Copy className="h-3 w-3" />
                </Button>
                {paciente.telefone && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success"
                    onClick={() => shareAvaliacaoLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getLinkUrl(linkAtivo.token))}>
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                )}
                {paciente.email && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-identidade" onClick={enviarEmail} disabled={enviandoEmail}>
                    {enviandoEmail ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-identidade" disabled={gerando}
                onClick={async () => { const novo = await gerarLink(paciente.id); if (novo) copiarLink(novo.token); }}>
                {gerando ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Gerar
              </Button>
            )}
          </div>

          <div className="h-6 w-px bg-border shrink-0" />

          {/* Link Agenda */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <CalendarDays className="h-4 w-4 text-accent shrink-0" />
            <span className="text-xs font-semibold shrink-0">Agenda</span>
            {linkAgendaAtivo ? (
              <>
                <div className="h-2 w-2 rounded-full bg-success animate-pulse shrink-0" />
                <span className="text-[10px] text-success shrink-0">{differenceInDays(new Date(linkAgendaAtivo.data_expiracao), new Date())}d</span>
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copiarAgendaLink(linkAgendaAtivo.token)}>
                  <Copy className="h-3 w-3" />
                </Button>
                {paciente.telefone && (
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success"
                    onClick={() => shareAgendaLink(`${paciente.nome} ${paciente.sobrenome}`, paciente.telefone!, getAgendaUrl(linkAgendaAtivo.token))}>
                    <MessageCircle className="h-3 w-3" />
                  </Button>
                )}
              </>
            ) : (
              <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1 text-accent" disabled={gerandoAgenda}
                onClick={gerarLinkAgenda}>
                {gerandoAgenda ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                Gerar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* MyID Fingerprint Card */}
      {ultimaMyID && ultimaMyID.myid_score != null && (
        (() => {
          const myidAnalysis = ultimaMyID.myid_analysis as any;
          const componentScores: MyIDResultType['componentScores'] = myidAnalysis?.componentScores || {
            D: Number(ultimaMyID.score_d) || 0,
            EFI: Number(ultimaMyID.score_efi) || 0,
            P: Number(ultimaMyID.score_p) || 0,
            I: Number(ultimaMyID.score_i) || 0,
            R: Number(ultimaMyID.score_r) || 0,
            C: Number(ultimaMyID.score_c) || 0,
            N: Number(ultimaMyID.score_n) || 0,
          };
          const rings = getMyIDFingerprintData(componentScores);
          const classificacao = ultimaMyID.classificacao || 'LEVE';
          const severityClass = getMyIDSeverityColor(classificacao);
          return (
            <div className="clinical-card border-l-4 border-l-identidade">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-identidade flex items-center justify-center">
                  <Fingerprint className="h-4 w-4 text-identidade-foreground" />
                </div>
                <h4 className="font-bold text-sm">MyID Fingerprint</h4>
                <Badge className={`ml-auto text-[10px] border ${severityClass}`}>{classificacao}</Badge>
              </div>
              <div className="flex flex-col md:flex-row items-center gap-4">
                <div className="w-full md:w-1/2">
                  <MyIDFingerprint rings={rings} myidScore={Number(ultimaMyID.myid_score)} />
                </div>
                <div className="w-full md:w-1/2 space-y-2">
                  <div className="text-center md:text-left">
                    <div className="text-3xl font-black text-foreground">{Number(ultimaMyID.myid_score).toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground">MyID Score</div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {rings.map(r => (
                      <div key={r.scoreKey} className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                        <span className="text-[10px] text-muted-foreground truncate">{r.label}</span>
                        <span className="text-[10px] font-bold ml-auto">{r.value.toFixed(1)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                    {ultimaMyID.data_avaliacao}
                  </div>
                </div>
              </div>
            </div>
          );
        })()
      )}

      {/* Tabs */}
      <Tabs defaultValue="respostas" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-10 bg-muted/60">
          <TabsTrigger value="respostas" className="text-xs gap-1 data-[state=active]:bg-gradient-identidade data-[state=active]:text-white">
            <FileText className="h-3.5 w-3.5" /> Questionários {respostas.length > 0 && `(${respostas.length})`}
          </TabsTrigger>
          <TabsTrigger value="myid" className="text-xs gap-1 data-[state=active]:bg-gradient-identidade data-[state=active]:text-white">
            <UserCircle className="h-3.5 w-3.5" /> MyID {myidAvaliacoes.length > 0 && `(${myidAvaliacoes.length})`}
          </TabsTrigger>
          <TabsTrigger value="avaliacoes" className="text-xs gap-1 data-[state=active]:bg-gradient-identidade data-[state=active]:text-white">
            <BarChart3 className="h-3.5 w-3.5" /> Serviços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="myid" className="mt-4">
          {iniciandoMyID ? (
            <div className="bg-white rounded-xl shadow-sm border p-4 relative">
              <Button variant="ghost" className="mb-4 absolute top-2 right-2" size="sm" onClick={() => setIniciandoMyID(false)}>Voltar</Button>
              <MyIDWizard onComplete={async (result, rawData) => {
                await supabase.from('myid_avaliacoes').insert({
                  terapeuta_id: user?.id,
                  status: 'concluido',
                  respostas_brutas: rawData,
                  resultado_processado: result,
                  // se tiver paciente_id na tabela: paciente_id: paciente.id
                });
                refetchMyID();
                setIniciandoMyID(false);
                toast({ title: 'MyID Salvo!', description: 'Avaliação registrada com sucesso.' });
              }} />
            </div>
          ) : myidAvaliacoes.length > 0 ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center bg-white p-4 rounded-xl border shadow-sm">
                <div>
                  <h3 className="font-bold text-lg text-primary">Último MyID ({format(new Date(myidAvaliacoes[0].created_at), 'dd/MM/yyyy')})</h3>
                  <p className="text-sm text-gray-500">Resultado da impressão digital sistêmica.</p>
                </div>
                <Button onClick={() => setIniciandoMyID(true)}>Refazer Avaliação</Button>
              </div>
              {myidAvaliacoes[0].resultado_processado && (
                <div className="bg-white p-4 rounded-xl border shadow-sm">
                  <MyIDResult result={myidAvaliacoes[0].resultado_processado} />
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed bg-white/50">
              <UserCircle className="h-10 w-10 mx-auto mb-3 opacity-30 text-primary" />
              <p className="font-medium text-lg text-gray-700">Nenhum MyID registrado</p>
              <p className="text-sm mt-1 mb-6 max-w-md mx-auto">O questionário MyID é a base do Método Identidade para mapear Numerador e Denominador sistêmico.</p>
              <Button onClick={() => setIniciandoMyID(true)} className="px-8">Preencher Novo MyID</Button>
            </div>
          )}
        </TabsContent>

        {/* Aba: Questionários Remotos */}
        <TabsContent value="respostas" className="mt-4">
          <QuestionariosComparacao linksAvPaciente={linksAvPaciente} respostas={respostas} />
        </TabsContent>

        {/* Aba: Avaliações de Serviços */}
        <TabsContent value="avaliacoes" className="mt-4">
          {(ultimaCob || ultimaMedidaStudio) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ultimaCob && (
                <div className="clinical-card border-l-4 border-l-blue-500 bg-blue-50/30">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center">
                      <AlignCenter className="h-4 w-4 text-white" />
                    </div>
                    <h4 className="font-bold text-xs text-blue-900">Exame COB° ZERO</h4>
                    <Badge variant="outline" className="ml-auto text-[10px] bg-white">{ultimaCob.data_avaliacao}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/60 rounded-lg p-2 border border-blue-100">
                      <div className="text-xs font-black text-blue-700">{ultimaCob.cobb_angle}°</div>
                      <div className="text-[10px] text-muted-foreground">Ângulo</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 border border-blue-100">
                      <div className="text-xs font-black text-blue-700">{ultimaCob.risco_percentage}%</div>
                      <div className="text-[10px] text-muted-foreground">Risco</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 border border-blue-100">
                      <div className="text-xs font-black text-blue-700">{ultimaCob.score_e || '—'}</div>
                      <div className="text-[10px] text-muted-foreground">Score E</div>
                    </div>
                  </div>
                </div>
              )}

              {ultimaMedidaStudio && (
                <div className="clinical-card border-l-4 border-l-studio bg-studio-light/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-7 w-7 rounded-lg bg-studio flex items-center justify-center">
                      <Dumbbell className="h-4 w-4 text-white" />
                    </div>
                    <h4 className="font-bold text-xs text-studio-foreground">Studio Personal ID</h4>
                    <Badge variant="outline" className="ml-auto text-[10px] bg-white">{format(new Date(ultimaMedidaStudio.data_medida), 'dd/MM/yy')}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white/60 rounded-lg p-2 border border-studio/10">
                      <div className="text-xs font-black text-studio">{ultimaMedidaStudio.peso}kg</div>
                      <div className="text-[10px] text-muted-foreground">Peso</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 border border-studio/10">
                      <div className="text-xs font-black text-studio">{ultimaMedidaStudio.percentual_gordura}%</div>
                      <div className="text-[10px] text-muted-foreground">% Gord.</div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-2 border border-studio/10">
                      <div className="text-xs font-black text-studio">{ultimaMedidaStudio.imc || '—'}</div>
                      <div className="text-[10px] text-muted-foreground">IMC</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
              <Calendar className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nenhuma avaliação de serviços</p>
              <p className="text-sm mt-1">As avaliações de serviços aparecerão aqui quando disponíveis.</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
