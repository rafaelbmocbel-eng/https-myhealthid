import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FileText, Award } from 'lucide-react';
import { getMyIDInterpretation } from '@/utils/myidCalculations';
import type { NotaProntuario } from '@/hooks/useNotasProntuario';

interface Props {
  pacienteId: string;
  notas: NotaProntuario[];
}

export default function ResumoNarrativo({ pacienteId, notas }: Props) {
  const { profile } = useAuth();

  const { data: paciente, isLoading: loadingPac } = useQuery({
    queryKey: ['resumo-narrativo-pac', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('*')
        .eq('id', pacienteId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: avaliacoesId = [] } = useQuery({
    queryKey: ['resumo-narrativo-avaliacoes', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: avaliacoesCob = [] } = useQuery({
    queryKey: ['resumo-narrativo-cob', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('avaliacoes_cob_zero')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: protocolos = [] } = useQuery({
    queryKey: ['resumo-narrativo-protocolos', pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('protocolos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const narrativa = useMemo(() => {
    if (!paciente) return '';

    const idade = paciente.data_nascimento
      ? differenceInYears(new Date(), parseISO(paciente.data_nascimento))
      : null;

    const paragrafos: string[] = [];

    // --- 1. IDENTIFICAÇÃO ---
    paragrafos.push(
      `Paciente ${paciente.nome} ${paciente.sobrenome}` +
      (idade ? `, ${idade} anos` : '') +
      (paciente.genero ? `, ${paciente.genero}` : '') +
      `. Registro clínico atualizado em ${format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}.`
    );

    // --- 2. MyID ---
    const myidNotas = notas.filter(n => n.tipo === 'myid_resposta');
    const myidAvals = avaliacoesId.filter((a: any) => a.myid_score !== null && a.myid_score !== undefined);

    if (myidAvals.length > 0) {
      const latest = myidAvals[myidAvals.length - 1];
      const score = Number(latest.myid_score);
      const interp = getMyIDInterpretation(score, !!latest.red_flags || (latest.dados_avaliacao as any)?.resultado?.redFlagsDetected);

      let myidText = `Na avaliação MyID mais recente (${format(parseISO(latest.created_at), 'dd/MM/yyyy')}), o paciente obteve score MyID de ${score.toFixed(1)}/100, classificado como "${interp?.label || 'N/A'}" — ${interp?.status || 'sem status definido'}.`;

      if (interp?.recommendation) {
        myidText += ` Recomendação clínica: ${interp.recommendation}`;
      }

      if (myidAvals.length > 1) {
        const first = myidAvals[0];
        const firstScore = Number(first.myid_score);
        const delta = score - firstScore;
        myidText += ` Evolução desde a primeira avaliação (${format(parseISO(first.created_at), 'dd/MM/yyyy')}): variação de ${delta > 0 ? '+' : ''}${delta.toFixed(1)} pontos (de ${firstScore.toFixed(1)} para ${score.toFixed(1)}).`;
      }

      if (latest.red_flags && (Array.isArray(latest.red_flags) ? latest.red_flags.length > 0 : true)) {
        myidText += ` ⚠️ Red flags identificados na última avaliação.`;
      }

      paragrafos.push(myidText);
    }

    // --- 3. AVALIAÇÕES IDENTIDADE (presenciais) ---
    const avalPresenciais = avaliacoesId.filter((a: any) => a.id_final !== null);
    if (avalPresenciais.length > 0) {
      const latest = avalPresenciais[avalPresenciais.length - 1];
      const scores = [
        latest.score_d != null ? `Dor: ${Number(latest.score_d).toFixed(1)}` : null,
        latest.score_efi != null ? `EFI: ${Number(latest.score_efi).toFixed(1)}` : null,
        latest.score_p != null ? `Postura: ${Number(latest.score_p).toFixed(1)}` : null,
        latest.score_f != null ? `Função: ${Number(latest.score_f).toFixed(1)}` : null,
        latest.score_r != null ? `Regulação: ${Number(latest.score_r).toFixed(1)}` : null,
        latest.score_i != null ? `Inflamação: ${Number(latest.score_i).toFixed(1)}` : null,
        latest.score_n != null ? `Neural: ${Number(latest.score_n).toFixed(1)}` : null,
      ].filter(Boolean);

      let avalText = `Avaliação presencial do Método Identidade realizada em ${format(parseISO(latest.created_at), 'dd/MM/yyyy')}.`;
      if (latest.classificacao) avalText += ` Classificação: ${latest.classificacao}.`;
      if (latest.id_final != null) avalText += ` ID Final: ${Number(latest.id_final).toFixed(1)}.`;
      if (scores.length > 0) avalText += ` Scores dimensionais: ${scores.join(', ')}.`;
      if (avalPresenciais.length > 1) {
        avalText += ` Total de ${avalPresenciais.length} avaliações presenciais registradas.`;
      }
      paragrafos.push(avalText);
    }

    // --- 4. COB° ZERO ---
    if (avaliacoesCob.length > 0) {
      const latest = avaliacoesCob[avaliacoesCob.length - 1];
      let cobText = `Avaliação COB° ZERO realizada em ${latest.data_avaliacao}.`;
      if (latest.cobb_angle != null) cobText += ` Ângulo de Cobb: ${latest.cobb_angle}°.`;
      if (latest.lenke_type) cobText += ` Classificação Lenke: Tipo ${latest.lenke_type}.`;
      if (latest.risco_level) cobText += ` Nível de risco: ${latest.risco_level}.`;
      if (latest.risco_percentage != null) cobText += ` Percentual de risco: ${latest.risco_percentage}%.`;
      if (avaliacoesCob.length > 1) {
        cobText += ` Total de ${avaliacoesCob.length} avaliações COB° ZERO registradas.`;
      }
      paragrafos.push(cobText);
    }

    // --- 5. AVALIAÇÕES POR VOZ ---
    const vozNotas = notas.filter(n => n.tipo === 'avaliacao_voz');
    if (vozNotas.length > 0) {
      const latest = vozNotas[0]; // notas already desc
      let vozText = `Avaliação por voz registrada em ${format(parseISO(latest.created_at), 'dd/MM/yyyy')}.`;
      if (latest.dados_extras?.classificacao) vozText += ` Classificação: ${latest.dados_extras.classificacao}.`;
      if (latest.dados_extras?.queixa) vozText += ` Queixa principal: ${latest.dados_extras.queixa}.`;
      paragrafos.push(vozText);
    }

    // --- 6. DIRETRIZES DE TRATAMENTO ---
    if (protocolos.length > 0) {
      const ativo = protocolos.find((p: any) => p.status === 'ativo') || protocolos[protocolos.length - 1];
      let dirText = `Diretriz de tratamento vigente: "${ativo.titulo}", criada em ${format(parseISO(ativo.created_at), 'dd/MM/yyyy')}.`;
      if (ativo.objetivo_geral) dirText += ` Objetivo: ${ativo.objetivo_geral}.`;
      if (ativo.frequencia) dirText += ` Frequência: ${ativo.frequencia}.`;
      if (ativo.duracao_total) dirText += ` Duração estimada: ${ativo.duracao_total}.`;
      if (protocolos.length > 1) {
        dirText += ` Histórico: ${protocolos.length} diretrizes registradas ao longo do tratamento.`;
      }
      paragrafos.push(dirText);
    }

    // --- 7. SESSÕES E CONDUTA ---
    const sessoes = notas.filter(n => n.tipo === 'sessao_confirmada');
    if (sessoes.length > 0) {
      const condutaMantidaCount = sessoes.filter(s =>
        s.descricao.includes('CONDUTA TERAPÊUTICA MANTIDA') || s.descricao.includes('Conduta terapêutica mantida')
      ).length;
      const sessaoComCondutaNova = sessoes.length - condutaMantidaCount;

      let sessaoText = `Foram registradas ${sessoes.length} sessão(ões) confirmada(s) no prontuário.`;
      if (condutaMantidaCount > 0) {
        sessaoText += ` Em ${condutaMantidaCount} sessão(ões) a conduta terapêutica foi mantida conforme diretriz vigente.`;
      }
      if (sessaoComCondutaNova > 0) {
        sessaoText += ` ${sessaoComCondutaNova} sessão(ões) com conduta descrita integralmente.`;
      }
      paragrafos.push(sessaoText);
    }

    // --- 8. DIÁRIO DO PACIENTE ---
    const diarios = notas.filter(n => n.tipo === 'diario_paciente');
    if (diarios.length > 0) {
      const latest = diarios[0];
      let diarioText = `O paciente realizou ${diarios.length} registro(s) de diário.`;
      if (latest.dados_extras) {
        const d = latest.dados_extras;
        diarioText += ` Último registro: Dor ${d.pain ?? '—'}/10, Humor ${d.mood ?? '—'}/5, Sono ${d.sleepHours ?? '—'}h, Energia ${d.energy ?? '—'}/5.`;
      }
      paragrafos.push(diarioText);
    }

    // --- 9. TREINOS ---
    const treinos = notas.filter(n => n.tipo === 'treino_executado');
    if (treinos.length > 0) {
      paragrafos.push(`O paciente executou ${treinos.length} treino(s) registrado(s) no prontuário.`);
    }

    return paragrafos.join('\n\n');
  }, [paciente, notas, avaliacoesId, avaliacoesCob, protocolos]);

  if (loadingPac) {
    return <Skeleton className="h-[200px] w-full rounded-xl" />;
  }

  if (!narrativa) return null;

  return (
    <Card className="border-2 border-primary/10 shadow-sm bg-muted/30 overflow-hidden">
      <div className="bg-primary/5 px-4 py-2 border-b border-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-xs font-black uppercase tracking-wider text-primary">
            Resumo Clínico Narrativo
          </h3>
        </div>
        <Badge variant="outline" className="bg-background text-[10px] font-bold">
          {format(new Date(), 'dd/MM/yyyy')}
        </Badge>
      </div>

      <CardContent className="p-4 space-y-4">
        <div className="prose prose-sm max-w-none">
          {narrativa.split('\n\n').map((p, i) => (
            <p key={i} className="text-xs leading-relaxed text-foreground/80 mb-3 last:mb-0">
              {p}
            </p>
          ))}
        </div>

        {/* Assinatura */}
        <div className="mt-6 pt-4 border-t border-dashed relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-muted/30 px-2">
            <Award className="h-5 w-5 text-muted-foreground/30" />
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-1">
              <div className="h-px bg-muted-foreground/20 w-full mt-6" />
              <p className="text-[10px] text-center font-bold text-muted-foreground uppercase tracking-widest">
                Assinatura do Profissional
              </p>
            </div>
            <div className="text-center flex flex-col items-center justify-end">
              <div className="border-2 border-muted-foreground/10 rounded p-1 w-24 h-12 flex flex-col items-center justify-center opacity-40">
                <p className="text-[8px] font-black leading-tight uppercase">Carimbo</p>
                <p className="text-[7px] font-bold leading-tight uppercase">Profissional</p>
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">
                {profile?.nome} {profile?.sobrenome}
              </p>
              {profile?.crefito && (
                <p className="text-[8px] text-muted-foreground">CREFITO: {profile.crefito}</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
