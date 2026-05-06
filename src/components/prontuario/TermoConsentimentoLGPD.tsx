import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Loader2, FileCheck, Send, Eye, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TERMO_LGPD_PADRAO = `TERMO DE CONSENTIMENTO PARA TRATAMENTO DE DADOS PESSOAIS

Em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD), este termo visa obter o seu consentimento livre, informado e inequívoco para o tratamento dos seus dados pessoais.

1. DADOS COLETADOS
Serão coletados e tratados os seguintes dados pessoais:
• Dados de identificação: nome, CPF, data de nascimento, gênero, endereço, telefone, e-mail
• Dados de saúde: histórico clínico, avaliações físicas, evolução terapêutica, dados de dor, funcionalidade, scores de avaliação
• Dados de uso: registros de sessões, diários de saúde, respostas a questionários

2. FINALIDADE DO TRATAMENTO
Os dados serão utilizados exclusivamente para:
• Prestação de serviços de saúde e acompanhamento terapêutico
• Registro e manutenção de prontuário clínico conforme legislação vigente
• Comunicação sobre agendamentos, lembretes e orientações
• Análise de evolução clínica e elaboração de relatórios de tratamento

3. COMPARTILHAMENTO DE DADOS
Seus dados pessoais NÃO serão compartilhados com terceiros, exceto:
• Quando necessário para cumprimento de obrigação legal ou regulatória
• Mediante nova autorização específica do titular
• Para proteção da vida ou da incolumidade física do titular ou de terceiro

4. ARMAZENAMENTO E SEGURANÇA
Os dados serão armazenados em ambiente digital seguro, com criptografia e controles de acesso, pelo prazo mínimo de 20 anos conforme exigência do CFM/COFFITO para prontuários de saúde.

5. DIREITOS DO TITULAR
Você tem direito a:
• Confirmar a existência de tratamento de seus dados
• Acessar, corrigir ou atualizar seus dados
• Solicitar anonimização, bloqueio ou eliminação de dados desnecessários
• Revogar este consentimento a qualquer momento
• Solicitar portabilidade dos dados

6. REVOGAÇÃO
Este consentimento pode ser revogado a qualquer momento, mediante solicitação formal ao profissional responsável, sem prejuízo da legalidade do tratamento realizado anteriormente.`;

interface Props {
  pacienteId: string;
  pacienteNome: string;
  compact?: boolean;
}

export default function TermoConsentimentoLGPD({ pacienteId, pacienteNome, compact = false }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [enviando, setEnviando] = useState(false);
  const [visualizando, setVisualizando] = useState(false);
  const [aceitouPreview, setAceitouPreview] = useState(false);
  const [openCompact, setOpenCompact] = useState(false);

  const { data: termos = [], isLoading } = useQuery({
    queryKey: ['termos-consentimento', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('termos_consentimento')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!pacienteId,
  });

  const termoAtivo = termos.find((t: any) => t.aceito);
  const termoPendente = termos.find((t: any) => !t.aceito);

  const enviarTermo = async () => {
    if (!user) return;
    setEnviando(true);
    try {
      const { error } = await (supabase as any).from('termos_consentimento').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        tipo: 'lgpd',
        versao: '1.0',
        texto_termo: TERMO_LGPD_PADRAO,
        aceito: false,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['termos-consentimento'] });
      toast({ title: 'Termo LGPD enviado! ✅', description: 'Aguardando aceite do paciente.' });
    } catch (err: any) {
      toast({ title: 'Erro ao enviar termo', description: err.message, variant: 'destructive' });
    } finally {
      setEnviando(false);
    }
  };

  const registrarAceiteManual = async (termoId: string) => {
    try {
      const { error } = await (supabase as any).from('termos_consentimento')
        .update({ aceito: true, data_aceite: new Date().toISOString() })
        .eq('id', termoId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['termos-consentimento'] });
      toast({ title: 'Aceite registrado! ✅' });
      setVisualizando(false);
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    }
  };

  if (isLoading) return null;

  const statusBadge = termoAtivo ? (
    <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-1">
      <CheckCircle2 className="h-3 w-3" /> Aceito
    </Badge>
  ) : termoPendente ? (
    <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-1">
      <Clock className="h-3 w-3" /> Pendente
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] gap-1 text-destructive border-destructive/30">
      <AlertTriangle className="h-3 w-3" /> Sem termo
    </Badge>
  );

  if (compact) {
    return (
      <Dialog open={openCompact} onOpenChange={setOpenCompact}>
        <DialogTrigger asChild>
          <button className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border bg-card hover:bg-muted/50 transition-colors text-xs">
            <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="font-medium">LGPD</span>
            {statusBadge}
          </button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Shield className="h-5 w-5 text-primary" /> Consentimento LGPD
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {termoAtivo && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>✅ Aceito em {format(parseISO(termoAtivo.data_aceite || termoAtivo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} — Versão {termoAtivo.versao}</p>
                <ScrollArea className="max-h-[50vh] pr-4 mt-2">
                  <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">{termoAtivo.texto_termo}</pre>
                </ScrollArea>
              </div>
            )}
            {termoPendente && !termoAtivo && (
              <>
                <p className="text-xs text-amber-600">Termo enviado, aguardando aceite do paciente.</p>
                <ScrollArea className="max-h-[45vh] pr-4">
                  <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">{termoPendente.texto_termo}</pre>
                </ScrollArea>
                <div className="flex items-start gap-2 pt-3 border-t">
                  <Checkbox id="aceite-c" checked={aceitouPreview} onCheckedChange={(c) => setAceitouPreview(!!c)} />
                  <label htmlFor="aceite-c" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                    Confirmo que <strong>{pacienteNome}</strong> leu, compreendeu e concordou.
                  </label>
                </div>
                <Button onClick={() => registrarAceiteManual(termoPendente.id)} disabled={!aceitouPreview} className="w-full gap-2">
                  <FileCheck className="h-4 w-4" /> Registrar Aceite
                </Button>
              </>
            )}
            {!termoAtivo && !termoPendente && (
              <Button onClick={enviarTermo} disabled={enviando} size="sm" className="w-full gap-1.5 text-xs">
                {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Enviar Termo de Consentimento
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Consentimento LGPD
          {termoAtivo ? (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-1 ml-auto">
              <CheckCircle2 className="h-3 w-3" /> Aceito
            </Badge>
          ) : termoPendente ? (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] gap-1 ml-auto">
              <Clock className="h-3 w-3" /> Pendente
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] gap-1 ml-auto text-destructive border-destructive/30">
              <AlertTriangle className="h-3 w-3" /> Sem termo
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {termoAtivo && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p>✅ Aceito em {format(parseISO(termoAtivo.data_aceite || termoAtivo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            <p>Versão: {termoAtivo.versao}</p>
          </div>
        )}

        {termoPendente && !termoAtivo && (
          <div className="space-y-2">
            <p className="text-xs text-amber-600">Termo enviado, aguardando aceite do paciente.</p>
            <Dialog open={visualizando} onOpenChange={setVisualizando}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full">
                  <Eye className="h-3.5 w-3.5" /> Visualizar e Registrar Aceite Manual
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-base">
                    <Shield className="h-5 w-5 text-primary" /> Termo de Consentimento LGPD
                  </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[50vh] pr-4">
                  <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">
                    {termoPendente.texto_termo}
                  </pre>
                </ScrollArea>
                <div className="flex items-start gap-2 pt-3 border-t">
                  <Checkbox id="aceite" checked={aceitouPreview} onCheckedChange={(c) => setAceitouPreview(!!c)} />
                  <label htmlFor="aceite" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                    Confirmo que <strong>{pacienteNome}</strong> leu, compreendeu e concordou com os termos acima.
                  </label>
                </div>
                <Button onClick={() => registrarAceiteManual(termoPendente.id)} disabled={!aceitouPreview} className="w-full gap-2">
                  <FileCheck className="h-4 w-4" /> Registrar Aceite
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {!termoAtivo && !termoPendente && (
          <Button onClick={enviarTermo} disabled={enviando} size="sm" className="w-full gap-1.5 text-xs">
            {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Enviar Termo de Consentimento
          </Button>
        )}

        {termoAtivo && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground">
                <Eye className="h-3.5 w-3.5" /> Ver termo completo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base">
                  <Shield className="h-5 w-5 text-primary" /> Termo de Consentimento LGPD
                </DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                <pre className="text-xs whitespace-pre-wrap font-sans text-muted-foreground leading-relaxed">
                  {termoAtivo.texto_termo}
                </pre>
              </ScrollArea>
              <p className="text-xs text-emerald-600 pt-2 border-t">
                ✅ Aceito em {format(parseISO(termoAtivo.data_aceite || termoAtivo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  );
}
