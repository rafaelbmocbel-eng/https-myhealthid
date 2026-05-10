import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarRange } from 'lucide-react';

export type PeriodKey = '30d' | '90d' | '180d' | '365d' | 'all';
export type SexoKey = 'all' | 'masculino' | 'feminino' | 'outro';
export type FaixaKey = 'all' | '<18' | '18-29' | '30-44' | '45-59' | '60+';

export interface DashboardFilterState {
  period: PeriodKey;
  sexo: SexoKey;
  faixa: FaixaKey;
}

export const DEFAULT_FILTERS: DashboardFilterState = { period: '90d', sexo: 'all', faixa: 'all' };

export function periodToDate(p: PeriodKey): Date | null {
  if (p === 'all') return null;
  const map: Record<Exclude<PeriodKey, 'all'>, number> = { '30d': 30, '90d': 90, '180d': 180, '365d': 365 };
  const d = new Date(); d.setDate(d.getDate() - map[p]); return d;
}

export function inPeriod(iso: string | null | undefined, p: PeriodKey): boolean {
  if (!iso) return false;
  const cut = periodToDate(p);
  if (!cut) return true;
  return new Date(iso) >= cut;
}

export function ageInFaixa(age: number | null, f: FaixaKey): boolean {
  if (f === 'all') return true;
  if (age == null) return false;
  switch (f) {
    case '<18': return age < 18;
    case '18-29': return age >= 18 && age < 30;
    case '30-44': return age >= 30 && age < 45;
    case '45-59': return age >= 45 && age < 60;
    case '60+': return age >= 60;
  }
}

export function sexoMatch(s: string | null | undefined, sel: SexoKey): boolean {
  if (sel === 'all') return true;
  return (s || '').toLowerCase() === sel;
}

interface Props {
  value: DashboardFilterState;
  onChange: (next: DashboardFilterState) => void;
  showSubgroups?: boolean;
}

export default function DashboardFilters({ value, onChange, showSubgroups }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2 rounded-xl border border-border/40 bg-card mb-3">
      <CalendarRange className="icon-xs text-muted-foreground ml-1" />
      <Select value={value.period} onValueChange={(v) => onChange({ ...value, period: v as PeriodKey })}>
        <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="30d">Últimos 30 dias</SelectItem>
          <SelectItem value="90d">Últimos 90 dias</SelectItem>
          <SelectItem value="180d">Últimos 6 meses</SelectItem>
          <SelectItem value="365d">Últimos 12 meses</SelectItem>
          <SelectItem value="all">Todo o período</SelectItem>
        </SelectContent>
      </Select>
      {showSubgroups && (
        <>
          <Select value={value.sexo} onValueChange={(v) => onChange({ ...value, sexo: v as SexoKey })}>
            <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos sexos</SelectItem>
              <SelectItem value="masculino">Masculino</SelectItem>
              <SelectItem value="feminino">Feminino</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={value.faixa} onValueChange={(v) => onChange({ ...value, faixa: v as FaixaKey })}>
            <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas idades</SelectItem>
              <SelectItem value="<18">&lt;18</SelectItem>
              <SelectItem value="18-29">18–29</SelectItem>
              <SelectItem value="30-44">30–44</SelectItem>
              <SelectItem value="45-59">45–59</SelectItem>
              <SelectItem value="60+">60+</SelectItem>
            </SelectContent>
          </Select>
        </>
      )}
    </div>
  );
}
