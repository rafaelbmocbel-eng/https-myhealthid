import { useState } from 'react';
import { useStudioMedidas, useStudioExecucoes } from '@/hooks/useStudioData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO, differenceInDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Plus, Ruler, TrendingUp, TrendingDown, Save, Loader2,
  CalendarDays, CheckCircle2, XCircle, Circle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  pacienteId: string;
}

export default function StudioEvolucaoTab({ pacienteId }: Props) {
  const { medidas, isLoading: loadingMedidas, salvarMedida } = useStudioMedidas(pacienteId);
  const { execucoes } = useStudioExecucoes(pacienteId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    paciente_id: pacienteId,
    peso: '', percentual_gordura: '', massa_magra: '', imc: '',
    cintura: '', quadril: '', braco_direito: '', braco_esquerdo: '',
    coxa_direita: '', coxa_esquerda: '', peitoral: '', panturrilha: '',
    observacoes: '',
  });

  const { user } = useAuth();
  const { toast } = useToast();


  const handleSave = async () => {
    const payload: any = { paciente_id: pacienteId };
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && k !== 'paciente_id') payload[k] = isNaN(Number(v)) ? v : Number(v);
    });
    await salvarMedida.mutateAsync(payload);
    setShowForm(false);
    setForm(p => ({ ...p, peso: '', percentual_gordura: '', massa_magra: '', imc: '', cintura: '', quadril: '', braco_direito: '', braco_esquerdo: '', coxa_direita: '', coxa_esquerda: '', peitoral: '', panturrilha: '', observacoes: '' }));
  };

  const ultima = medidas[0];
  const penultima = medidas[1];
  const delta = (a: any, b: any, key: string) => {
    if (!a?.[key] || !b?.[key]) return null;
    return Number(a[key]) - Number(b[key]);
  };

  // Aderência: calendar of executions this month
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const execDates = execucoes.map((e: any) => new Date(e.data_execucao));
  const treinosNoMes = execDates.filter((d: Date) => d >= monthStart && d <= monthEnd).length;

  const DeltaBadge = ({ val }: { val: number | null }) => {
    if (val === null) return null;
    const positive = val > 0;
    return (
      <Badge variant="outline" className={cn('text-[10px] gap-0.5', positive ? 'text-emerald-700 bg-emerald-50' : 'text-red-600 bg-red-50')}>
        {positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
        {positive ? '+' : ''}{val.toFixed(1)}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Peso', value: ultima?.peso ? `${Number(ultima.peso).toFixed(1)}kg` : '—', delta: delta(ultima, penultima, 'peso'), invert: true },
          { label: '% Gordura', value: ultima?.percentual_gordura ? `${Number(ultima.percentual_gordura).toFixed(1)}%` : '—', delta: delta(ultima, penultima, 'percentual_gordura'), invert: true },
          { label: 'Sessões/Mês', value: `${treinosNoMes}`, delta: null },
          { label: 'Medições', value: `${medidas.length}`, delta: null },
        ].map(stat => (
          <Card key={stat.label} className="border-studio/10">
            <CardContent className="pt-3 pb-2 text-center">
              <div className="text-lg font-black text-foreground">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
              {stat.delta !== null && <DeltaBadge val={stat.invert ? -(stat.delta!) : stat.delta!} />}
            </CardContent>
          </Card>
        ))}
      </div>


      {/* Aderência Calendar */}

      {/* Aderência Calendar */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-studio" />
            <h4 className="font-bold text-sm">Aderência — {format(now, 'MMMM yyyy', { locale: ptBR })}</h4>
            <Badge variant="outline" className="ml-auto text-[10px]">{treinosNoMes} treinos</Badge>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
              <div key={i} className="text-[10px] font-semibold text-muted-foreground py-1">{d}</div>
            ))}
            {/* Offset for first day */}
            {Array.from({ length: monthStart.getDay() }).map((_, i) => <div key={`e-${i}`} />)}
            {daysInMonth.map(day => {
              const hasExec = execDates.some((d: Date) => isSameDay(d, day));
              const isPast = day < now && !isSameDay(day, now);
              const isToday = isSameDay(day, now);
              return (
                <div key={day.toISOString()} className={cn(
                  'h-7 w-7 mx-auto rounded-full flex items-center justify-center text-[10px] font-medium',
                  hasExec ? 'bg-studio text-white' : isPast ? 'text-muted-foreground' : 'text-foreground',
                  isToday && !hasExec && 'ring-1 ring-studio',
                )}>
                  {day.getDate()}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Medidas Table */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-studio" />
              <h4 className="font-bold text-sm">Medidas Antropométricas</h4>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowForm(!showForm)}>
              <Plus className="h-3 w-3" /> Nova Medição
            </Button>
          </div>

          {showForm && (
            <div className="p-3 rounded-lg border-2 border-studio/20 bg-studio-light/20 space-y-3 mb-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { k: 'peso', l: 'Peso (kg)' }, { k: 'percentual_gordura', l: '% Gordura' }, { k: 'massa_magra', l: 'M. Magra (kg)' },
                  { k: 'cintura', l: 'Cintura (cm)' }, { k: 'quadril', l: 'Quadril (cm)' }, { k: 'peitoral', l: 'Peitoral (cm)' },
                  { k: 'braco_direito', l: 'Braço D (cm)' }, { k: 'braco_esquerdo', l: 'Braço E (cm)' }, { k: 'coxa_direita', l: 'Coxa D (cm)' },
                  { k: 'coxa_esquerda', l: 'Coxa E (cm)' }, { k: 'panturrilha', l: 'Panturrilha (cm)' }, { k: 'imc', l: 'IMC' },
                ].map(f => (
                  <div key={f.k}>
                    <label className="text-[10px] text-muted-foreground">{f.l}</label>
                    <Input type="number" step="0.1" className="h-8 text-sm" value={(form as any)[f.k]} onChange={e => setForm(p => ({ ...p, [f.k]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <Input placeholder="Observações" value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} className="h-8 text-sm" />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" className="h-7" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button size="sm" className="h-7 bg-gradient-studio text-white gap-1" onClick={handleSave} disabled={salvarMedida.isPending}>
                  {salvarMedida.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                </Button>
              </div>
            </div>
          )}

          {medidas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma medição registrada</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1.5 text-muted-foreground font-medium">Data</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Peso</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">%Gord</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Cintura</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Braço</th>
                    <th className="text-right py-1.5 text-muted-foreground font-medium">Coxa</th>
                  </tr>
                </thead>
                <tbody>
                  {medidas.slice(0, 10).map((m: any) => (
                    <tr key={m.id} className="border-b border-border/50">
                      <td className="py-1.5 font-medium">{format(parseISO(m.data_medida), 'dd/MM/yy')}</td>
                      <td className="text-right">{m.peso ? `${Number(m.peso).toFixed(1)}kg` : '—'}</td>
                      <td className="text-right">{m.percentual_gordura ? `${Number(m.percentual_gordura).toFixed(1)}%` : '—'}</td>
                      <td className="text-right">{m.cintura ? `${Number(m.cintura).toFixed(1)}` : '—'}</td>
                      <td className="text-right">{m.braco_direito ? `${Number(m.braco_direito).toFixed(1)}` : '—'}</td>
                      <td className="text-right">{m.coxa_direita ? `${Number(m.coxa_direita).toFixed(1)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
