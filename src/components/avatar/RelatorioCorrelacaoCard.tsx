import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Brain, Fingerprint, MapPin, AlertCircle, CheckCircle2, TrendingUp, Info } from 'lucide-react';
import { useEventosAnatomicos, type EventoAnatomico } from '@/hooks/useEventosAnatomicos';
import { cn } from '@/lib/utils';
import { REGIONS } from '@/components/presencial/Body3DAvatar';
import { VISCERAL_REGIONS } from '@/utils/anatomia/regioesViscerais';

interface Props {
  pacienteId: string;
}

export default function RelatorioCorrelacaoCard({ pacienteId }: Props) {
  const { data: eventos = [] } = useEventosAnatomicos(pacienteId);

  // Busca a última avaliação MyID
  const { data: lastMyID } = useQuery({
    queryKey: ['correlacao-myid', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!pacienteId,
  });

  const { correlacoes, sinaisCorpo } = (() => {
    if (!lastMyID) return { correlacoes: [], sinaisCorpo: [] };
    const dados = lastMyID.dados_avaliacao as any;
    const painMap = dados?.painMap || dados?.mapa_dor || dados?.resultado?.painMap || {};
    const respostas = dados?.respostas || {};
    
    // Filtra regiões relatadas no MyID (subjetivo)
    const regioesMyID = Object.entries(painMap)
      .filter(([_, val]) => Number(val) > 0)
      .map(([id, val]) => ({ id, intensidade: Number(val) }));

    const correlacoes = regioesMyID.map(relato => {
      // Procura achados clínicos (objetivo) na mesma região
      const achadosNaRegiao = eventos.filter(e => e.regiao_id === relato.id && e.status !== 'resolvido');
      const regInfo = [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === relato.id);

      return {
        regiaoId: relato.id,
        label: regInfo?.label || relato.id,
        intensidadeSubjetiva: relato.intensidade,
        achadosObjetivos: achadosNaRegiao,
        confirmado: achadosNaRegiao.length > 0,
      };
    });

    // Mapeamento de Sinais do Corpo (Bloco 6)
    const sinais = respostas.bloco_6_sinais_autonomicos || respostas.bloco_6_sinaisAutonomicos || [];
    const visceralIssues = respostas.bloco_6_visceral_issues || [];
    const todosSinais = [...new Set([...sinais, ...visceralIssues])];

    const sinalMapping: Record<string, { label: string; regiao: string }> = {
      bruxismo: { label: 'Bruxismo', regiao: 'cabeca' },
      bruxism: { label: 'Bruxismo', regiao: 'cabeca' },
      zumbido: { label: 'Zumbido', regiao: 'cabeca' },
      tinnitus: { label: 'Zumbido', regiao: 'cabeca' },
      reflux: { label: 'Refluxo', regiao: 'esofago' },
      refluxo: { label: 'Refluxo', regiao: 'esofago' },
      gastritis: { label: 'Gastrite', regiao: 'estomago' },
      gastrite: { label: 'Gastrite', regiao: 'estomago' },
      bloating: { label: 'Estufamento/Gases', regiao: 'intestino_grosso' },
      gases: { label: 'Gases', regiao: 'intestino_grosso' },
      palpitations: { label: 'Palpitações', regiao: 'coracao' },
      palpitacao: { label: 'Palpitações', regiao: 'coracao' },
      antidepressivo: { label: 'Uso de Antidepressivo', regiao: 'cabeca' },
    };

    const sinaisCorpo = todosSinais
      .map(s => {
        const signalKey = s.toLowerCase();
        const found = Object.entries(sinalMapping).find(([key]) => signalKey.includes(key));
        if (!found) return null;
        
        const info = found[1];
        const achados = eventos.filter(e => e.regiao_id === info.regiao && e.status !== 'resolvido');
        return {
          key: s,
          label: info.label,
          regiaoId: info.regiao,
          regiaoLabel: [...REGIONS, ...VISCERAL_REGIONS].find(r => r.id === info.regiao)?.label || info.regiao,
          confirmado: achados.length > 0,
          achados
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    return { correlacoes, sinaisCorpo };
  })();

  const achadosNaoRelatados = eventos.filter(e => {
    const noMyID = !correlacoes.some(c => c.regiaoId === e.regiao_id);
    return noMyID && e.status !== 'resolvido';
  });

  if (!lastMyID && eventos.length === 0) return null;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-5 w-5 text-primary" />
          Inteligência de Correlação Clínica
          <Badge variant="outline" className="ml-auto text-[10px] uppercase tracking-wider">Beta</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Cruzamento entre a Impressão Digital (Subjetivo) e o Avatar Clínico (Objetivo).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Resumo de Convergência */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-background/60 p-3 rounded-xl border border-border/50">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Convergência</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-primary">
                {correlacoes.length > 0 
                  ? Math.round((correlacoes.filter(c => c.confirmado).length / correlacoes.length) * 100) 
                  : 0}%
              </span>
              <span className="text-[10px] text-muted-foreground pb-1">dos relatos confirmados</span>
            </div>
          </div>
          <div className="bg-background/60 p-3 rounded-xl border border-border/50">
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Achados Ocultos</p>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-amber-600">{achadosNaoRelatados.length}</span>
              <span className="text-[10px] text-muted-foreground pb-1">áreas sem queixa ativa</span>
            </div>
          </div>
        </div>

        {/* Lista de Correlações */}
        <div className="space-y-2">
          <h4 className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1.5 px-1">
            <Fingerprint className="h-3 w-3" /> Mapeamento MyID vs Avatar
          </h4>
          
          {correlacoes.length === 0 && (
            <p className="text-xs text-muted-foreground italic px-1">Nenhum relato de dor na última avaliação MyID.</p>
          )}

          {correlacoes.map(c => (
            <div key={c.regiaoId} className="group relative bg-background border border-border/50 rounded-lg p-3 transition-all hover:border-primary/30">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold">{c.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase">Intensidade:</span>
                  <Badge variant="secondary" className="h-5 text-[10px]">{c.intensidadeSubjetiva}/10</Badge>
                </div>
              </div>

              {c.confirmado ? (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <Badge className="bg-emerald-500 hover:bg-emerald-600 text-[9px] h-4">Confirmado</Badge>
                    <span className="text-[10px] text-muted-foreground italic">Achado objetivo no Avatar</span>
                  </div>
                  {c.achadosObjetivos.map(ev => (
                    <div key={ev.id} className="flex items-start gap-2 text-xs bg-emerald-500/5 p-2 rounded-md border border-emerald-500/10">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-emerald-900">{ev.tipo_achado}</p>
                        <p className="text-[10px] text-emerald-700/70">{ev.estrutura || 'Estrutura não especificada'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-[9px] h-4 uppercase">Lacuna</Badge>
                    <span className="text-[10px] text-muted-foreground italic">Queixa sem diagnóstico mapeado</span>
        </div>

        {/* Sinais do Corpo (Sistema Nervoso/Visceral) */}
        {sinaisCorpo.length > 0 && (
          <div className="space-y-2 mt-4">
            <h4 className="text-[11px] font-bold uppercase text-muted-foreground flex items-center gap-1.5 px-1">
              <Activity className="h-3 w-3" /> Sinais do Corpo (Autonômicos)
            </h4>
            {sinaisCorpo.map(s => (
              <div key={s.key} className="bg-background border border-border/50 rounded-lg p-2.5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground">{s.regiaoLabel}</p>
                </div>
                {s.confirmado ? (
                  <Badge className="bg-emerald-500 text-[9px] h-4">Validado</Badge>
                ) : (
                  <Badge variant="outline" className="text-sky-600 border-sky-200 bg-sky-50 text-[9px] h-4">Relatado</Badge>
                )}
              </div>
            ))}
          </div>
        )}
                  <div className="flex items-center gap-2 text-xs bg-amber-500/5 p-2 rounded-md border border-amber-500/10 text-amber-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span>O paciente relatou dor nesta área no MyID, mas não há um evento clínico registrado no Avatar.</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Insights Automáticos */}
        {achadosNaoRelatados.length > 0 && (
          <div className="mt-4 p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h5 className="text-xs font-bold text-primary italic">Alerta de Prevenção</h5>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              O Avatar identifica <span className="font-bold text-foreground">{achadosNaoRelatados.length} áreas</span> com alterações clínicas (ex: {achadosNaoRelatados[0].tipo_achado}) que não foram relatadas como dor no MyID. Isso pode indicar compensações assintomáticas ou áreas de risco futuro.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
