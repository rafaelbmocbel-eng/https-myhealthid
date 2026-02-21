import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLinksAvaliacao } from '@/hooks/useLinksAvaliacao';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity, AlignCenter, Link2, MessageCircle, FileText, Loader2, Copy, CalendarDays,
} from 'lucide-react';
import { shareAvaliacaoLink, shareAgendaLink } from '@/utils/whatsapp';
import { getAgendaUrl } from '@/utils/linkUrls';
import IndicesRiscoComprometimento from '@/components/paciente/IndicesRiscoComprometimento';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  pacienteTelefone?: string;
}

const SCORE_COLORS: Record<string, string> = {
  E: 'bg-score-e/10 text-score-e border-score-e/20',
  P: 'bg-score-p/10 text-score-p border-score-p/20',
  C: 'bg-score-c/10 text-score-c border-score-c/20',
  F: 'bg-score-f/10 text-score-f border-score-f/20',
  D: 'bg-score-d/10 text-score-d border-score-d/20',
  R: 'bg-score-r/10 text-score-r border-score-r/20',
};

export default function StudioAvaliacaoTab({ pacienteId, pacienteNome, pacienteTelefone }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [gerandoAgenda, setGerandoAgenda] = useState(false);
  const { links, gerarLink, copiarLink, getLinkUrl, gerando } = useLinksAvaliacao();

  // Agenda links
  const { data: linksAgenda = [] } = useQuery({
    queryKey: ['links_agenda_paciente', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const linkAgendaAtivo = linksAgenda.find((l: any) => l.paciente_id === pacienteId && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());

  const gerarLinkAgenda = async () => {
    if (!user) return;
    setGerandoAgenda(true);
    try {
      await supabase
        .from('links_agenda_paciente')
        .update({ status: 'cancelado' } as any)
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user.id)
        .eq('status', 'ativo');

      const { data, error } = await supabase
        .from('links_agenda_paciente')
        .insert({ paciente_id: pacienteId, terapeuta_id: user.id } as any)
        .select()
        .single();

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links_agenda_paciente'] });
      toast({ title: 'Link de agenda gerado! ✅', description: 'Válido por 90 dias.' });
      return data;
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerandoAgenda(false);
    }
  };

  const copiarLinkAgenda = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link de agenda copiado! 📋' });
  };

  const { data: avaliacoesIdentidade = [] } = useQuery({
    queryKey: ['studio-av-identidade', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('id, paciente_nome, data_avaliacao, id_final, classificacao, score_e, score_p, score_c, score_f, score_d, score_r, score_efi, created_at')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: avaliacoesCob = [] } = useQuery({
    queryKey: ['studio-av-cobzero', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_cob_zero')
        .select('id, data_avaliacao, cobb_angle, lenke_type, risco_level, risco_percentage, score_e, created_at')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ['studio-respostas', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('respostas_avaliacao_paciente')
        .select('id, bloco_numero, data_preenchimento, dados_respostas, link_id')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      return data || [];
    },
  });

  const linkAtivo = links.find(l => l.paciente_id === pacienteId && l.status === 'ativo' && new Date(l.data_expiracao) > new Date());
  const ultimaId = avaliacoesIdentidade[0];
  const ultimaCob = avaliacoesCob[0];

  const BLOCO_NAMES: Record<number, string> = { 1: 'Anamnese & Dor', 3: 'Funcionalidade', 4: 'Comportamento', 5: 'Regulação' };

  // Group respostas by link_id
  const sessions = respostas.reduce((acc: Record<string, any[]>, r: any) => {
    if (!acc[r.link_id]) acc[r.link_id] = [];
    acc[r.link_id].push(r);
    return acc;
  }, {} as Record<string, any[]>);
  const sessionKeys = Object.keys(sessions);

  return (
    <div className="space-y-4">
      {/* Links compactos */}
      <Card className="border-studio/20">
        <CardContent className="pt-3 pb-3">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="h-3.5 w-3.5 text-studio" />
            <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">Links do Paciente</h4>
          </div>
          <div className="space-y-1.5">
            {/* Questionário */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-medium text-muted-foreground w-20 shrink-0">Questionário</span>
              <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2" disabled={gerando}
                onClick={async () => {
                  if (linkAtivo) copiarLink(linkAtivo.token);
                  else { const novo = await gerarLink(pacienteId); if (novo) copiarLink(novo.token); }
                }}>
                {gerando ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Copy className="h-2.5 w-2.5" />}
                {linkAtivo ? 'Copiar' : 'Gerar'}
              </Button>
              {linkAtivo && (
                <>
                  <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2"
                    onClick={() => shareAvaliacaoLink(getLinkUrl(linkAtivo.token), pacienteNome, pacienteTelefone)}>
                    <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                  </Button>
                  <Badge variant="outline" className="text-[9px] h-5">{differenceInDays(new Date(linkAtivo.data_expiracao), new Date())}d</Badge>
                </>
              )}
            </div>
            {/* Agenda */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-medium text-muted-foreground w-20 shrink-0">Agendamento</span>
              <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2" disabled={gerandoAgenda}
                onClick={async () => {
                  if (linkAgendaAtivo) copiarLinkAgenda(linkAgendaAtivo.token);
                  else { const novo = await gerarLinkAgenda(); if (novo) copiarLinkAgenda(novo.token); }
                }}>
                {gerandoAgenda ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Copy className="h-2.5 w-2.5" />}
                {linkAgendaAtivo ? 'Copiar' : 'Gerar'}
              </Button>
              {linkAgendaAtivo && (
                <>
                  <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2"
                    onClick={() => shareAgendaLink(pacienteNome, pacienteTelefone || '', getAgendaUrl(linkAgendaAtivo.token))}>
                    <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                  </Button>
                  <Badge variant="outline" className="text-[9px] h-5">{differenceInDays(new Date(linkAgendaAtivo.data_expiracao), new Date())}d</Badge>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Índices de Risco Biopsicossocial */}
      {(() => {
        if (ultimaId) {
          return <IndicesRiscoComprometimento scores={ultimaId as any} />;
        }
        // Fallback: scores from questionnaire responses
        if (respostas.length > 0) {
          const scoresFromResponses: Record<string, number> = {};
          respostas.forEach((r: any) => {
            const dados = r.dados_respostas as any;
            if (!dados) return;
            Object.entries(dados).forEach(([k, v]) => {
              if (k.startsWith('score') && typeof v === 'number') {
                scoresFromResponses[k] = v;
              }
            });
          });
          if (Object.keys(scoresFromResponses).length > 0) {
            return <IndicesRiscoComprometimento scores={scoresFromResponses} parcial />;
          }
        }
        return null;
      })()}

      <div className="grid sm:grid-cols-2 gap-3">
        {/* Identidade */}
        <Card className={cn('border transition-all', ultimaId ? 'border-primary/20' : 'border-border')}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-identidade flex items-center justify-center">
                <Activity className="h-4 w-4 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-xs">Método Identidade</h4>
                <p className="text-[10px] text-muted-foreground">{ultimaId ? `Última: ${ultimaId.data_avaliacao}` : 'Sem avaliação'}</p>
              </div>
              {ultimaId?.classificacao && (
                <Badge className={cn('ml-auto text-[9px]',
                  ultimaId.classificacao === 'LEVE' ? 'bg-emerald-100 text-emerald-700' :
                  ultimaId.classificacao === 'MODERADO' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                )}>{ultimaId.classificacao}</Badge>
              )}
            </div>
            {ultimaId ? (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">ID Final</span>
                  <span className="text-xl font-black">{Number(ultimaId.id_final || 0).toFixed(1)}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {['E', 'P', 'C', 'F', 'D', 'R'].map(k => (
                    <Badge key={k} variant="outline" className={cn('text-[9px] font-bold', SCORE_COLORS[k])}>
                      {k}: {Number((ultimaId as any)[`score_${k.toLowerCase()}`] || 0).toFixed(1)}
                    </Badge>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">{avaliacoesIdentidade.length} avaliação(ões)</p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">Envie o questionário ao aluno</p>
            )}
          </CardContent>
        </Card>

        {/* COB ZERO */}
        <Card className={cn('border transition-all', ultimaCob ? 'border-blue-200' : 'border-border')}>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center">
                <AlignCenter className="h-4 w-4 text-white" />
              </div>
              <div>
                <h4 className="font-bold text-xs">COB° ZERO</h4>
                <p className="text-[10px] text-muted-foreground">{ultimaCob ? `Última: ${ultimaCob.data_avaliacao}` : 'Sem avaliação'}</p>
              </div>
            </div>
            {ultimaCob ? (
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Cobb</span><span className="font-bold">{ultimaCob.cobb_angle}°</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lenke</span><span className="font-bold">{ultimaCob.lenke_type || '—'}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Risco</span><span className="font-bold">{ultimaCob.risco_percentage ? `${Number(ultimaCob.risco_percentage).toFixed(0)}%` : '—'}</span></div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-3">Sem dados COB° ZERO</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Questionário Responses */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="h-4 w-4 text-studio" />
            <h4 className="font-bold text-sm">Questionários Respondidos</h4>
            <Badge variant="outline" className="ml-auto text-[10px]">{respostas.length} resposta(s)</Badge>
          </div>
          {sessionKeys.length > 0 ? (
            <div className="space-y-2">
              {sessionKeys.slice(0, 5).map((linkId, idx) => {
                const rs = sessions[linkId];
                const blocos = rs.map((r: any) => r.bloco_numero).sort();
                const dataP = rs[0]?.data_preenchimento;
                return (
                  <div key={linkId} className="p-2.5 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">Sessão {sessionKeys.length - idx}</span>
                      {dataP && <span className="text-[10px] text-muted-foreground">{format(parseISO(dataP), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {blocos.map((b: number) => (
                        <Badge key={b} variant="outline" className="text-[9px] bg-studio-light text-studio border-studio/20">
                          B{b} — {BLOCO_NAMES[b] || `Bloco ${b}`}
                        </Badge>
                      ))}
                    </div>
                    {/* Extract scores */}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {rs.map((r: any) => {
                        const d = r.dados_respostas;
                        if (!d) return null;
                        if (r.bloco_numero === 3 && d.scoreEFI != null) return <Badge key={r.id} variant="outline" className="text-[9px] font-bold bg-score-e/10 text-score-e border-score-e/20">EFI: {Number(d.scoreEFI).toFixed(1)}</Badge>;
                        if (r.bloco_numero === 4 && d.scoreP != null) return <Badge key={r.id} variant="outline" className="text-[9px] font-bold bg-score-p/10 text-score-p border-score-p/20">P: {Number(d.scoreP).toFixed(1)}</Badge>;
                        if (r.bloco_numero === 5 && d.scoreR != null) return <Badge key={r.id} variant="outline" className="text-[9px] font-bold bg-score-r/10 text-score-r border-score-r/20">R: {Number(d.scoreR).toFixed(1)}</Badge>;
                        return null;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum questionário respondido</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
