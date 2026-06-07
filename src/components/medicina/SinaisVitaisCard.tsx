import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Activity, Plus, Trash2, Loader2 } from 'lucide-react';
import { useSinaisVitais, type NovoSinalVital } from '@/hooks/useSinaisVitais';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  pacienteId: string;
}

const EMPTY: NovoSinalVital = {
  medido_em: new Date().toISOString(),
  pa_sistolica: null,
  pa_diastolica: null,
  fc: null,
  temperatura: null,
  spo2: null,
  peso_kg: null,
  altura_cm: null,
  glicemia: null,
  observacoes: null,
};

function n(v: string): number | null {
  if (!v.trim()) return null;
  const x = Number(v.replace(',', '.'));
  return Number.isFinite(x) ? x : null;
}

export default function SinaisVitaisCard({ pacienteId }: Props) {
  const { list, criar, remover } = useSinaisVitais(pacienteId);
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<NovoSinalVital>(EMPTY);

  const salvar = async () => {
    await criar.mutateAsync({ ...form, medido_em: new Date().toISOString() });
    setForm(EMPTY);
    setAberto(false);
  };

  const ultimo = list.data?.[0];

  return (
    <Card className="p-4 sm:p-5 rounded-xl border-border/40 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="icon-sm text-primary" />
          <h3 className="h-card">Sinais Vitais</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAberto((v) => !v)}>
          <Plus className="icon-xs shrink-0 mr-1" />
          Novo registro
        </Button>
      </div>

      {ultimo && !aberto && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Metric label="PA" value={ultimo.pa_sistolica && ultimo.pa_diastolica ? `${ultimo.pa_sistolica}/${ultimo.pa_diastolica}` : '—'} unit="mmHg" />
          <Metric label="FC" value={ultimo.fc ?? '—'} unit="bpm" />
          <Metric label="SpO₂" value={ultimo.spo2 ?? '—'} unit="%" />
          <Metric label="Temp." value={ultimo.temperatura ?? '—'} unit="°C" />
          <Metric label="Peso" value={ultimo.peso_kg ?? '—'} unit="kg" />
          <Metric label="Altura" value={ultimo.altura_cm ?? '—'} unit="cm" />
          <Metric label="Glicemia" value={ultimo.glicemia ?? '—'} unit="mg/dL" />
          <div className="text-caption">
            {format(new Date(ultimo.medido_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </div>
        </div>
      )}

      {!ultimo && !aberto && (
        <p className="text-caption">Nenhum registro ainda.</p>
      )}

      {aberto && (
        <div className="space-y-3 mt-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="PA Sist." unit="mmHg" onChange={(v) => setForm((f) => ({ ...f, pa_sistolica: n(v) ? Math.round(n(v)!) : null }))} />
            <Field label="PA Diast." unit="mmHg" onChange={(v) => setForm((f) => ({ ...f, pa_diastolica: n(v) ? Math.round(n(v)!) : null }))} />
            <Field label="FC" unit="bpm" onChange={(v) => setForm((f) => ({ ...f, fc: n(v) ? Math.round(n(v)!) : null }))} />
            <Field label="SpO₂" unit="%" onChange={(v) => setForm((f) => ({ ...f, spo2: n(v) ? Math.round(n(v)!) : null }))} />
            <Field label="Temp." unit="°C" onChange={(v) => setForm((f) => ({ ...f, temperatura: n(v) }))} />
            <Field label="Peso" unit="kg" onChange={(v) => setForm((f) => ({ ...f, peso_kg: n(v) }))} />
            <Field label="Altura" unit="cm" onChange={(v) => setForm((f) => ({ ...f, altura_cm: n(v) }))} />
            <Field label="Glicemia" unit="mg/dL" onChange={(v) => setForm((f) => ({ ...f, glicemia: n(v) ? Math.round(n(v)!) : null }))} />
          </div>
          <div>
            <Label className="text-caption">Observações</Label>
            <Textarea
              rows={2}
              value={form.observacoes ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value || null }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setAberto(false); setForm(EMPTY); }}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={criar.isPending}>
              {criar.isPending && <Loader2 className="icon-xs shrink-0 mr-1 animate-spin" />}
              Salvar
            </Button>
          </div>
        </div>
      )}

      {list.data && list.data.length > 1 && (
        <details className="mt-4">
          <summary className="text-caption cursor-pointer">Histórico ({list.data.length})</summary>
          <div className="mt-2 space-y-1 max-h-60 overflow-auto">
            {list.data.map((sv) => (
              <div key={sv.id} className="flex items-center justify-between text-xs py-1 border-b border-border/30">
                <span>
                  {format(new Date(sv.medido_em), "dd/MM HH:mm", { locale: ptBR })} —
                  {' '}PA {sv.pa_sistolica ?? '—'}/{sv.pa_diastolica ?? '—'} · FC {sv.fc ?? '—'} · SpO₂ {sv.spo2 ?? '—'}%
                </span>
                <button
                  className="text-destructive/70 hover:text-destructive"
                  onClick={() => remover.mutate(sv.id)}
                  aria-label="Remover"
                >
                  <Trash2 className="icon-xs shrink-0" />
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </Card>
  );
}

function Metric({ label, value, unit }: { label: string; value: string | number; unit: string }) {
  return (
    <div>
      <div className="text-micro text-muted-foreground">{label}</div>
      <div className="font-semibold">
        {value} <span className="text-micro font-normal text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function Field({ label, unit, onChange }: { label: string; unit: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-micro">{label} <span className="text-muted-foreground">({unit})</span></Label>
      <Input
        inputMode="decimal"
        className="h-9"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
