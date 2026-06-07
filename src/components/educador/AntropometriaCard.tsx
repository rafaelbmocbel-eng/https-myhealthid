import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Ruler, Save, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Props { pacienteId: string; }

const classifyIMC = (imc: number | null) => {
  if (!imc) return null;
  if (imc < 18.5) return { label: 'Abaixo do peso', tone: 'text-blue-600' };
  if (imc < 25) return { label: 'Eutrófico', tone: 'text-emerald-600' };
  if (imc < 30) return { label: 'Sobrepeso', tone: 'text-amber-600' };
  if (imc < 35) return { label: 'Obesidade I', tone: 'text-orange-600' };
  if (imc < 40) return { label: 'Obesidade II', tone: 'text-red-600' };
  return { label: 'Obesidade III', tone: 'text-red-700' };
};

const classifyRCQ = (rcq: number | null, sexo?: string | null) => {
  if (!rcq) return null;
  const limite = (sexo || '').toLowerCase().startsWith('f') ? 0.85 : 0.90;
  return rcq >= limite
    ? { label: 'Risco cardiovascular ↑', tone: 'text-destructive' }
    : { label: 'Risco baixo', tone: 'text-emerald-600' };
};

export default function AntropometriaCard({ pacienteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    peso_kg: '', altura_cm: '', cintura_cm: '', quadril_cm: '',
    braco_cm: '', coxa_cm: '', panturrilha_cm: '', pescoco_cm: '',
    gordura_pct: '', massa_magra_kg: '', observacao: '',
  });

  const { data: paciente } = useQuery({
    queryKey: ['paciente-sexo', pacienteId],
    queryFn: async () => {
      const { data } = await supabase.from('pacientes').select('sexo').eq('id', pacienteId).maybeSingle();
      return data;
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ['antropometria', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('antropometria').select('*')
        .eq('paciente_id', pacienteId)
        .order('data_medicao', { ascending: false }).limit(10);
      return data || [];
    },
  });

  const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')));

  const salvarMut = useMutation({
    mutationFn: async () => {
      const payload: any = {
        terapeuta_id: user!.id,
        paciente_id: pacienteId,
        peso_kg: num(form.peso_kg),
        altura_cm: num(form.altura_cm),
        cintura_cm: num(form.cintura_cm),
        quadril_cm: num(form.quadril_cm),
        braco_cm: num(form.braco_cm),
        coxa_cm: num(form.coxa_cm),
        panturrilha_cm: num(form.panturrilha_cm),
        pescoco_cm: num(form.pescoco_cm),
        gordura_pct: num(form.gordura_pct),
        massa_magra_kg: num(form.massa_magra_kg),
        observacao: form.observacao || null,
      };
      const algum = Object.entries(payload).some(([k, v]) => !['terapeuta_id', 'paciente_id', 'observacao'].includes(k) && v !== null);
      if (!algum) throw new Error('Preencha ao menos uma medida');
      const { error } = await (supabase as any).from('antropometria').insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Medidas salvas');
      qc.invalidateQueries({ queryKey: ['antropometria', pacienteId] });
      setForm({ peso_kg: '', altura_cm: '', cintura_cm: '', quadril_cm: '', braco_cm: '', coxa_cm: '', panturrilha_cm: '', pescoco_cm: '', gordura_pct: '', massa_magra_kg: '', observacao: '' });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao salvar'),
  });

  const apagar = async (id: string) => {
    if (!confirm('Apagar esta medição?')) return;
    await (supabase as any).from('antropometria').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['antropometria', pacienteId] });
  };

  // Preview cálculos
  const pesoPrev = num(form.peso_kg);
  const altPrev = num(form.altura_cm);
  const imcPrev = pesoPrev && altPrev ? +(pesoPrev / Math.pow(altPrev / 100, 2)).toFixed(2) : null;
  const cintPrev = num(form.cintura_cm);
  const quadPrev = num(form.quadril_cm);
  const rcqPrev = cintPrev && quadPrev ? +(cintPrev / quadPrev).toFixed(2) : null;

  const ultima = historico[0];

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Ruler className="icon-sm text-primary" /> Antropometria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { k: 'peso_kg', label: 'Peso (kg)' },
            { k: 'altura_cm', label: 'Altura (cm)' },
            { k: 'cintura_cm', label: 'Cintura (cm)' },
            { k: 'quadril_cm', label: 'Quadril (cm)' },
            { k: 'braco_cm', label: 'Braço (cm)' },
            { k: 'coxa_cm', label: 'Coxa (cm)' },
            { k: 'panturrilha_cm', label: 'Pant. (cm)' },
            { k: 'pescoco_cm', label: 'Pescoço (cm)' },
            { k: 'gordura_pct', label: '% Gordura' },
            { k: 'massa_magra_kg', label: 'M. magra (kg)' },
          ].map((f) => (
            <div key={f.k}>
              <label className="text-[10px] uppercase text-muted-foreground tracking-wide">{f.label}</label>
              <Input inputMode="decimal" value={(form as any)[f.k]} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} />
            </div>
          ))}
        </div>

        {(imcPrev || rcqPrev) && (
          <div className="flex flex-wrap gap-2 text-xs">
            {imcPrev && (() => {
              const c = classifyIMC(imcPrev);
              return <Badge variant="outline" className={c?.tone}>IMC {imcPrev} · {c?.label}</Badge>;
            })()}
            {rcqPrev && (() => {
              const c = classifyRCQ(rcqPrev, (paciente as any)?.sexo);
              return <Badge variant="outline" className={c?.tone}>RCQ {rcqPrev} · {c?.label}</Badge>;
            })()}
          </div>
        )}

        <Textarea placeholder="Observações (opcional)" rows={2} value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} />

        <div className="flex justify-end">
          <Button size="sm" onClick={() => salvarMut.mutate()} disabled={salvarMut.isPending}>
            {salvarMut.isPending ? <Loader2 className="icon-xs animate-spin mr-1" /> : <Save className="icon-xs mr-1" />}
            Salvar medição
          </Button>
        </div>

        {ultima && (
          <div className="pt-3 border-t border-border/40">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">Última medição · {new Date(ultima.data_medicao).toLocaleDateString('pt-BR')}</p>
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {ultima.imc && <div className="rounded-md bg-muted/40 p-2"><div className="text-muted-foreground">IMC</div><div className="font-semibold">{ultima.imc}</div></div>}
              {ultima.peso_kg && <div className="rounded-md bg-muted/40 p-2"><div className="text-muted-foreground">Peso</div><div className="font-semibold">{ultima.peso_kg} kg</div></div>}
              {ultima.gordura_pct && <div className="rounded-md bg-muted/40 p-2"><div className="text-muted-foreground">% Gord.</div><div className="font-semibold">{ultima.gordura_pct}%</div></div>}
            </div>
          </div>
        )}

        {historico.length > 1 && (
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">Histórico</p>
            {historico.slice(1).map((m: any) => (
              <div key={m.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {new Date(m.data_medicao).toLocaleDateString('pt-BR')} · {m.peso_kg ? `${m.peso_kg}kg` : '—'} · IMC {m.imc || '—'}
                </span>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => apagar(m.id)}>
                  <Trash2 className="icon-xs text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
