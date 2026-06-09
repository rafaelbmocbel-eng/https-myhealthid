import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Brain, Plus, TrendingUp, Loader2, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

type TipoEscala = 'phq9' | 'gad7' | 'pss10';

const PHQ9 = [
  'Pouco interesse ou prazer em fazer as coisas',
  'Se sentir para baixo, deprimido(a) ou sem perspectiva',
  'Dificuldade para dormir, dormir demais ou acordar várias vezes',
  'Se sentir cansado(a) ou com pouca energia',
  'Falta de apetite ou comer demais',
  'Se sentir mal consigo mesmo(a) ou achar que é um fracasso',
  'Dificuldade para se concentrar (ler, ver TV)',
  'Lentidão para se movimentar/falar OU agitação/inquietação',
  'Pensamentos de se ferir ou que seria melhor estar morto(a)',
];
const GAD7 = [
  'Se sentir nervoso(a), ansioso(a) ou tenso(a)',
  'Não conseguir parar ou controlar as preocupações',
  'Preocupar-se muito com diversas coisas',
  'Dificuldade para relaxar',
  'Ficar tão inquieto(a) que é difícil ficar parado(a)',
  'Ficar facilmente aborrecido(a) ou irritado(a)',
  'Sentir medo como se algo terrível fosse acontecer',
];
const PSS10 = [
  'Com que frequência você ficou chateado(a) por causa de algo inesperado?',
  'Sentiu-se incapaz de controlar as coisas importantes em sua vida?',
  'Sentiu-se nervoso(a) e estressado(a)?',
  'Tratou com sucesso de problemas irritantes do dia a dia?', // reverse
  'Sentiu que estava lidando bem com mudanças importantes?', // reverse
  'Sentiu confiança na sua habilidade de resolver problemas?', // reverse
  'Sentiu que as coisas estavam acontecendo conforme sua vontade?', // reverse
  'Achou que não conseguiria lidar com tudo que tinha para fazer?',
  'Conseguiu controlar irritações na sua vida?', // reverse
  'Sentiu que as dificuldades se acumulavam tanto que não as superaria?',
];
const PSS_REVERSE = [3, 4, 5, 6, 8]; // 0-indexed

const OPTS_4 = [
  { v: 0, l: 'Nenhuma vez' },
  { v: 1, l: 'Vários dias' },
  { v: 2, l: 'Mais da metade dos dias' },
  { v: 3, l: 'Quase todos os dias' },
];
const OPTS_5 = [
  { v: 0, l: 'Nunca' },
  { v: 1, l: 'Quase nunca' },
  { v: 2, l: 'Às vezes' },
  { v: 3, l: 'Quase sempre' },
  { v: 4, l: 'Sempre' },
];

const META: Record<TipoEscala, { nome: string; sigla: string; items: string[]; opts: typeof OPTS_4; max: number }> = {
  phq9: { nome: 'Depressão (PHQ-9)', sigla: 'PHQ-9', items: PHQ9, opts: OPTS_4, max: 27 },
  gad7: { nome: 'Ansiedade (GAD-7)', sigla: 'GAD-7', items: GAD7, opts: OPTS_4, max: 21 },
  pss10: { nome: 'Estresse percebido (PSS-10)', sigla: 'PSS-10', items: PSS10, opts: OPTS_5, max: 40 },
};

function classificar(tipo: TipoEscala, score: number): { classificacao: string; severidade: string; cor: string } {
  if (tipo === 'phq9') {
    if (score <= 4) return { classificacao: 'Mínima/sem depressão', severidade: 'minima', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' };
    if (score <= 9) return { classificacao: 'Depressão leve', severidade: 'leve', cor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' };
    if (score <= 14) return { classificacao: 'Depressão moderada', severidade: 'moderada', cor: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' };
    if (score <= 19) return { classificacao: 'Depressão moderadamente grave', severidade: 'moderadamente_grave', cor: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
    return { classificacao: 'Depressão grave', severidade: 'grave', cor: 'bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-100' };
  }
  if (tipo === 'gad7') {
    if (score <= 4) return { classificacao: 'Ansiedade mínima', severidade: 'minima', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' };
    if (score <= 9) return { classificacao: 'Ansiedade leve', severidade: 'leve', cor: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300' };
    if (score <= 14) return { classificacao: 'Ansiedade moderada', severidade: 'moderada', cor: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' };
    return { classificacao: 'Ansiedade grave', severidade: 'grave', cor: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
  }
  // pss10
  if (score <= 13) return { classificacao: 'Estresse baixo', severidade: 'minima', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' };
  if (score <= 26) return { classificacao: 'Estresse moderado', severidade: 'moderada', cor: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' };
  return { classificacao: 'Estresse alto', severidade: 'grave', cor: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' };
}

function calcularPontuacao(tipo: TipoEscala, respostas: Record<number, number>): number {
  if (tipo !== 'pss10') {
    return Object.values(respostas).reduce((a, b) => a + (b ?? 0), 0);
  }
  // PSS-10 com itens reversos (0-4 → 4-0)
  let total = 0;
  for (let i = 0; i < 10; i++) {
    const r = respostas[i] ?? 0;
    total += PSS_REVERSE.includes(i) ? 4 - r : r;
  }
  return total;
}

interface Props {
  pacienteId: string;
}

export default function EscalasPsicologiaCard({ pacienteId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<TipoEscala>('phq9');
  const [respostas, setRespostas] = useState<Record<number, number>>({});
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ['escalas-psi', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('escalas_psicologia' as any)
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('data_aplicacao', { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const meta = META[tipo];
  const scoreAtual = calcularPontuacao(tipo, respostas);
  const cls = classificar(tipo, scoreAtual);
  const completo = Object.keys(respostas).length === meta.items.length;

  const ultimos = (['phq9', 'gad7', 'pss10'] as TipoEscala[]).map((t) => ({
    tipo: t,
    reg: registros.find((r) => r.tipo_escala === t),
  }));

  const abrirNova = (t: TipoEscala) => {
    setTipo(t);
    setRespostas({});
    setObs('');
    setOpen(true);
  };

  const salvar = async () => {
    if (!user || !completo) return;
    setSaving(true);
    try {
      const c = classificar(tipo, scoreAtual);
      const { error } = await supabase.from('escalas_psicologia' as any).insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        tipo_escala: tipo,
        respostas,
        pontuacao_total: scoreAtual,
        classificacao: c.classificacao,
        severidade: c.severidade,
        observacoes: obs || null,
      });
      if (error) throw error;
      toast({ title: 'Escala salva', description: `${META[tipo].sigla}: ${scoreAtual} — ${c.classificacao}` });
      qc.invalidateQueries({ queryKey: ['escalas-psi', pacienteId] });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Escalas clínicas</CardTitle>
              <CardDescription>PHQ-9 · GAD-7 · PSS-10 com pontuação automática</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-3 gap-2">
          {ultimos.map(({ tipo: t, reg }) => {
            const m = META[t];
            const c = reg ? classificar(t, reg.pontuacao_total) : null;
            return (
              <div key={t} className="rounded-lg border border-border/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{m.sigla}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => abrirNova(t)}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                {reg ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">{reg.pontuacao_total}</span>
                      <span className="text-xs text-muted-foreground">/ {m.max}</span>
                    </div>
                    <Badge variant="outline" className={cn('text-[10px] border-0', c?.cor)}>
                      {c?.classificacao}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground">
                      {format(parseISO(reg.data_aplicacao), "dd 'de' MMM yyyy", { locale: ptBR })}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Sem registros</p>
                )}
              </div>
            );
          })}
        </div>

        {registros.length > 1 && (
          <Collapsible open={historicoAberto} onOpenChange={setHistoricoAberto}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                <TrendingUp className="h-3.5 w-3.5 mr-1.5" />
                Histórico longitudinal ({registros.length})
                <ChevronDown className={cn('h-3.5 w-3.5 ml-auto transition-transform', historicoAberto && 'rotate-180')} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-1.5">
              {registros.map((r) => {
                const c = classificar(r.tipo_escala, r.pontuacao_total);
                return (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-xs p-2 rounded border border-border/30">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px]">{META[r.tipo_escala as TipoEscala].sigla}</Badge>
                      <span className="text-muted-foreground shrink-0">
                        {format(parseISO(r.data_aplicacao), 'dd/MM/yy', { locale: ptBR })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{r.pontuacao_total}</span>
                      <Badge variant="outline" className={cn('text-[10px] border-0', c.cor)}>
                        {c.classificacao}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        )}

        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{meta.nome}</DialogTitle>
          </DialogHeader>

          <Tabs value={tipo} onValueChange={(v) => { setTipo(v as TipoEscala); setRespostas({}); }}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="phq9">PHQ-9</TabsTrigger>
              <TabsTrigger value="gad7">GAD-7</TabsTrigger>
              <TabsTrigger value="pss10">PSS-10</TabsTrigger>
            </TabsList>

            {(['phq9', 'gad7', 'pss10'] as TipoEscala[]).map((t) => (
              <TabsContent key={t} value={t} className="space-y-4 mt-4">
                <p className="text-xs text-muted-foreground">
                  {t === 'pss10'
                    ? 'No último mês, com que frequência você...'
                    : 'Nas últimas 2 semanas, com que frequência você foi incomodado(a) por:'}
                </p>
                {META[t].items.map((q, i) => (
                  <div key={i} className="space-y-2 pb-3 border-b border-border/30 last:border-0">
                    <Label className="text-sm leading-snug">
                      {i + 1}. {q}
                    </Label>
                    <RadioGroup
                      value={respostas[i]?.toString() ?? ''}
                      onValueChange={(v) => setRespostas((r) => ({ ...r, [i]: Number(v) }))}
                      className="grid grid-cols-2 sm:grid-cols-4 gap-2"
                    >
                      {META[t].opts.map((o) => (
                        <Label
                          key={o.v}
                          className={cn(
                            'flex items-center gap-2 p-2 rounded border border-border/40 text-xs cursor-pointer hover:bg-accent',
                            respostas[i] === o.v && 'border-primary bg-primary/5',
                          )}
                        >
                          <RadioGroupItem value={o.v.toString()} />
                          {o.l}
                        </Label>
                      ))}
                    </RadioGroup>
                  </div>
                ))}
              </TabsContent>
            ))}
          </Tabs>

          <div className="space-y-2">
            <Label className="text-xs">Observações clínicas (opcional)</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>

          {completo && (
            <div className={cn('rounded-lg p-3 flex items-center justify-between', cls.cor)}>
              <div>
                <p className="text-xs opacity-75">Pontuação</p>
                <p className="text-2xl font-bold">{scoreAtual} <span className="text-sm font-normal opacity-70">/ {meta.max}</span></p>
              </div>
              <Badge variant="outline" className="border-current bg-background/40">{cls.classificacao}</Badge>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!completo || saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Salvar avaliação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
