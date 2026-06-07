import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, Save, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { pacienteId: string; }

const CATALOGO = [
  { id: 'sentar_levantar_30s', nome: 'Sentar-levantar 30s', unidade: 'reps' },
  { id: 'flexao_braco', nome: 'Flexão de braço (máx)', unidade: 'reps' },
  { id: 'cooper_12min', nome: 'Cooper 12 min', unidade: 'metros' },
  { id: 'sit_and_reach', nome: 'Sit-and-reach', unidade: 'cm' },
  { id: 'equilibrio_unipodal', nome: 'Equilíbrio unipodal', unidade: 'segundos' },
  { id: 'fms_deep_squat', nome: 'FMS Deep Squat', unidade: 'score (0-3)' },
  { id: 'salto_horizontal', nome: 'Salto horizontal', unidade: 'cm' },
  { id: 'preensao_manual', nome: 'Preensão manual', unidade: 'kgf' },
  { id: 'tug', nome: 'Timed Up and Go', unidade: 'segundos' },
];

// Classificação simplificada para Cooper (homens 20-29)
const classifyCooper = (m: number) => {
  if (m >= 2800) return 'Excelente';
  if (m >= 2400) return 'Bom';
  if (m >= 2200) return 'Regular';
  if (m >= 1600) return 'Fraco';
  return 'Muito fraco';
};
const classifySentarLevantar = (r: number) => {
  if (r >= 20) return 'Excelente';
  if (r >= 15) return 'Bom';
  if (r >= 10) return 'Regular';
  return 'Fraco';
};
const autoClassify = (tipo: string, valor: number) => {
  if (tipo === 'cooper_12min') return classifyCooper(valor);
  if (tipo === 'sentar_levantar_30s') return classifySentarLevantar(valor);
  return '';
};

export default function TestesFuncionaisCard({ pacienteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [tipo, setTipo] = useState<string>(CATALOGO[0].id);
  const [resultado, setResultado] = useState('');
  const [classificacao, setClassificacao] = useState('');
  const [obs, setObs] = useState('');

  const catItem = CATALOGO.find((c) => c.id === tipo)!;

  const { data: historico = [] } = useQuery({
    queryKey: ['testes-func', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('testes_funcionais_paciente').select('*')
        .eq('paciente_id', pacienteId)
        .order('data_teste', { ascending: false }).limit(15);
      return data || [];
    },
  });

  const salvarMut = useMutation({
    mutationFn: async () => {
      const v = Number(resultado.replace(',', '.'));
      if (!v && v !== 0) throw new Error('Informe o resultado');
      const classif = classificacao || autoClassify(tipo, v);
      const { error } = await (supabase as any).from('testes_funcionais_paciente').insert({
        terapeuta_id: user!.id,
        paciente_id: pacienteId,
        tipo_teste: tipo,
        resultado: v,
        unidade: catItem.unidade,
        classificacao: classif || null,
        observacao: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Teste registrado');
      qc.invalidateQueries({ queryKey: ['testes-func', pacienteId] });
      setResultado(''); setClassificacao(''); setObs('');
    },
    onError: (e: any) => toast.error(e.message || 'Erro'),
  });

  const apagar = async (id: string) => {
    if (!confirm('Apagar este teste?')) return;
    await (supabase as any).from('testes_funcionais_paciente').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['testes-func', pacienteId] });
  };

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Activity className="icon-sm text-primary" /> Testes Funcionais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={tipo} onValueChange={(v) => { setTipo(v); setClassificacao(''); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATALOGO.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Resultado ({catItem.unidade})</label>
            <Input inputMode="decimal" value={resultado} onChange={(e) => setResultado(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] uppercase text-muted-foreground tracking-wide">Classificação</label>
            <Input placeholder="Excelente/Bom/..." value={classificacao} onChange={(e) => setClassificacao(e.target.value)} />
          </div>
        </div>

        <Textarea placeholder="Observação (opcional)" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} />

        <div className="flex justify-end">
          <Button size="sm" onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending || !resultado}>
            {salvarMut.isPending ? <Loader2 className="icon-xs animate-spin mr-1" /> : <Save className="icon-xs mr-1" />}
            Registrar
          </Button>
        </div>

        {historico.length > 0 && (
          <div className="pt-3 border-t border-border/40 space-y-1.5">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Histórico</p>
            {historico.map((t: any) => {
              const cat = CATALOGO.find((c) => c.id === t.tipo_teste);
              return (
                <div key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{cat?.nome || t.tipo_teste}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(t.data_teste).toLocaleDateString('pt-BR')} · {t.resultado} {t.unidade}
                      {t.classificacao && <Badge variant="outline" className="ml-2 text-[10px]">{t.classificacao}</Badge>}
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => apagar(t.id)}>
                    <Trash2 className="icon-xs text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
