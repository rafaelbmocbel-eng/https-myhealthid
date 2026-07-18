import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, ClipboardList, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

// Anamnese nutricional — perguntas que individualizam o plano alimentar.
// Além de objetivo/restrições/preferências, coleta os DADOS QUE CALCULAM as
// calorias e macros: peso, altura (→ IMC), idade, sexo e nível de atividade.
// Sem eles a IA chuta o valor calórico; com eles, calcula (TMB/TDEE).
export default function AnamneseNutricionalCard({ pacienteId }: { pacienteId: string }) {
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [preenchida, setPreenchida] = useState(false);
  const [r, setR] = useState<Record<string, string>>({
    peso_kg: '', altura_cm: '', idade: '', sexo: '', nivel_atividade: '',
    objetivo: '', refeicoes_por_dia: '', restricoes_alergias: '',
    aversoes: '', preferencias: '', rotina: '',
  });

  useEffect(() => {
    (async () => {
      const [anam, pac, antro] = await Promise.all([
        (supabase as any).from('nutricao_anamnese').select('respostas').eq('paciente_id', pacienteId).maybeSingle(),
        supabase.from('pacientes').select('data_nascimento, sexo').eq('id', pacienteId).maybeSingle(),
        (supabase as any).from('antropometria').select('peso_kg, altura_cm').eq('paciente_id', pacienteId).order('data_medicao', { ascending: false }).limit(1).maybeSingle(),
      ]);
      const salvas = (anam.data?.respostas || {}) as Record<string, string>;
      // Pré-preenche do cadastro/antropometria o que ainda não foi respondido.
      const p = pac.data as any;
      const a = antro.data as any;
      const idadeCalc = p?.data_nascimento ? String(Math.floor((Date.now() - new Date(p.data_nascimento).getTime()) / (365.25 * 24 * 3600 * 1000))) : '';
      setR(prev => ({
        ...prev,
        idade: salvas.idade || idadeCalc || '',
        sexo: salvas.sexo || (p?.sexo ? String(p.sexo).toLowerCase().startsWith('f') ? 'feminino' : 'masculino' : ''),
        peso_kg: salvas.peso_kg || (a?.peso_kg ? String(a.peso_kg) : ''),
        altura_cm: salvas.altura_cm || (a?.altura_cm ? String(a.altura_cm) : ''),
        ...salvas,
      }));
      setPreenchida(Object.values(salvas).some(v => String(v || '').trim() !== ''));
    })();
  }, [pacienteId]);

  const imc = (() => {
    const peso = Number(r.peso_kg); const alt = Number(r.altura_cm) / 100;
    if (peso > 0 && alt > 0) return +(peso / (alt * alt)).toFixed(1);
    return null;
  })();
  const classeIMC = imc == null ? '' : imc < 18.5 ? 'baixo peso' : imc < 25 ? 'peso normal' : imc < 30 ? 'sobrepeso' : 'obesidade';

  const salvar = async () => {
    setSalvando(true);
    const respostas = { ...r, imc: imc != null ? String(imc) : '' };
    const { error } = await (supabase as any).from('nutricao_anamnese')
      .upsert({ paciente_id: pacienteId, respostas, updated_at: new Date().toISOString() }, { onConflict: 'paciente_id' });
    setSalvando(false);
    if (error) { toast.error('Erro ao salvar: ' + error.message); return; }
    setPreenchida(true);
    setAberto(false);
    toast.success('Respostas salvas! Elas entram no seu próximo plano alimentar.');
  };

  const AREAS: { k: string; label: string; ph: string }[] = [
    { k: 'restricoes_alergias', label: 'Restrições ou alergias alimentares', ph: 'Ex.: lactose, glúten, amendoim… (ou "nenhuma")' },
    { k: 'aversoes', label: 'Alimentos que você NÃO gosta', ph: 'Ex.: fígado, quiabo…' },
    { k: 'preferencias', label: 'Alimentos que você adora', ph: 'Ex.: frango, banana, aveia…' },
    { k: 'rotina', label: 'Sua rotina (horários de trabalho/treino/sono)', ph: 'Ex.: trabalho 8h-18h, treino 19h, durmo 23h' },
  ];

  const campo = (k: string, ph: string, tipo: 'number' | 'text' = 'text') => (
    <Input type={tipo} inputMode={tipo === 'number' ? 'decimal' : undefined} placeholder={ph}
      value={r[k] || ''} onChange={e => setR(prev => ({ ...prev, [k]: e.target.value }))} className="text-sm" />
  );

  return (
    <Card className="overflow-hidden">
      <button onClick={() => setAberto(v => !v)} className="w-full text-left p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
          {preenchida ? <Check className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold">Perguntas do plano nutricional</p>
          <p className="text-[11px] text-muted-foreground">
            {preenchida
              ? `Respondido${imc != null ? ` · IMC ${imc} (${classeIMC})` : ''} — toque para revisar.`
              : 'Peso, altura, idade e rotina — para calcular sua nutrição sob medida.'}
          </p>
        </div>
        <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${aberto ? 'rotate-90' : ''}`} />
      </button>
      {aberto && (
        <CardContent className="pt-0 space-y-3">
          {/* Dados que calculam calorias e macros */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Dados do cálculo</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1"><Label className="text-xs">Peso (kg)</Label>{campo('peso_kg', 'Ex.: 72', 'number')}</div>
              <div className="space-y-1"><Label className="text-xs">Altura (cm)</Label>{campo('altura_cm', 'Ex.: 170', 'number')}</div>
              <div className="space-y-1"><Label className="text-xs">Idade</Label>{campo('idade', 'Ex.: 34', 'number')}</div>
              <div className="space-y-1">
                <Label className="text-xs">Sexo</Label>
                <Select value={r.sexo || ''} onValueChange={v => setR(prev => ({ ...prev, sexo: v }))}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nível de atividade física</Label>
              <Select value={r.nivel_atividade || ''} onValueChange={v => setR(prev => ({ ...prev, nivel_atividade: v }))}>
                <SelectTrigger className="text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sedentario">Sedentário (pouco ou nenhum exercício)</SelectItem>
                  <SelectItem value="leve">Leve (1-3x/semana)</SelectItem>
                  <SelectItem value="moderado">Moderado (3-5x/semana)</SelectItem>
                  <SelectItem value="intenso">Intenso (6-7x/semana)</SelectItem>
                  <SelectItem value="muito_intenso">Muito intenso (2x/dia ou trabalho físico)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {imc != null && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">IMC: {imc} — {classeIMC}</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Qual seu objetivo principal?</Label>
            {campo('objetivo', 'Ex.: perder gordura, ganhar massa, mais energia…')}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantas refeições consegue fazer por dia?</Label>
            {campo('refeicoes_por_dia', 'Ex.: 4', 'number')}
          </div>
          {AREAS.map(c => (
            <div key={c.k} className="space-y-1">
              <Label className="text-xs">{c.label}</Label>
              <Textarea rows={2} placeholder={c.ph} value={r[c.k] || ''} onChange={e => setR(prev => ({ ...prev, [c.k]: e.target.value }))} className="text-sm" />
            </div>
          ))}
          <Button onClick={salvar} disabled={salvando} className="w-full gap-1.5">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Salvar respostas
          </Button>
        </CardContent>
      )}
    </Card>
  );
}
