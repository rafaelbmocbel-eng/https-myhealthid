import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, FileCheck, CheckCircle2, Loader2 } from 'lucide-react';
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
  terapeutaId: string;
}

export default function PacienteConsentimentoLGPD({ pacienteId, terapeutaId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [aceito, setAceito] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const { data: termos = [], isLoading } = useQuery({
    queryKey: ['paciente-termos-lgpd', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('termos_consentimento')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const termoAtivo = termos.find((t: any) => t.aceito);
  const termoPendente = termos.find((t: any) => !t.aceito);

  const aceitarPendente = async (termoId: string) => {
    setSalvando(true);
    try {
      const { error } = await (supabase as any)
        .from('termos_consentimento')
        .update({ aceito: true, data_aceite: new Date().toISOString() })
        .eq('id', termoId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['paciente-termos-lgpd', pacienteId] });
      toast({ title: 'Consentimento registrado! ✅', description: 'Obrigado pelo seu aceite.' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  const criarEAceitar = async () => {
    setSalvando(true);
    try {
      const { error } = await (supabase as any).from('termos_consentimento').insert({
        paciente_id: pacienteId,
        terapeuta_id: terapeutaId,
        tipo: 'lgpd',
        versao: '1.0',
        texto_termo: TERMO_LGPD_PADRAO,
        aceito: true,
        data_aceite: new Date().toISOString(),
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['paciente-termos-lgpd', pacienteId] });
      toast({ title: 'Consentimento registrado! ✅' });
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setSalvando(false);
    }
  };

  if (isLoading) return null;

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Consentimento LGPD
          {termoAtivo && (
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] gap-1 ml-auto">
              <CheckCircle2 className="h-3 w-3" /> Aceito
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {termoAtivo ? (
          <p className="text-xs text-muted-foreground">
            ✅ Você aceitou o termo em {format(parseISO(termoAtivo.data_aceite || termoAtivo.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })} (versão {termoAtivo.versao}).
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              Leia atentamente o termo abaixo e dê seu aval para o tratamento dos seus dados pessoais.
            </p>
            <ScrollArea className="h-56 rounded-md border p-3 bg-muted/20">
              <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/80 leading-relaxed">
                {termoPendente?.texto_termo || TERMO_LGPD_PADRAO}
              </pre>
            </ScrollArea>
            <div className="flex items-start gap-2">
              <Checkbox id="aceite-paciente" checked={aceito} onCheckedChange={(c) => setAceito(!!c)} />
              <label htmlFor="aceite-paciente" className="text-xs text-muted-foreground leading-tight cursor-pointer">
                Li, compreendi e <strong>concordo</strong> com os termos acima.
              </label>
            </div>
            <Button
              onClick={() => termoPendente ? aceitarPendente(termoPendente.id) : criarEAceitar()}
              disabled={!aceito || salvando}
              className="w-full gap-2"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
              Dar meu aval
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
