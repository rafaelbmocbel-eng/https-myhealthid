import type { ReactNode } from 'react';
import { ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { EquipamentoFisio } from '@/lib/dosagem/tipos';
import { ACC } from '@/lib/dosagem/acentos';
import { cn } from '@/lib/utils';
import { referencia, rotuloReferencia, urlPubmed } from '@/lib/dosagem/referencias';

export const parseNum = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export const numStr = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

export function CampoNumero({ id, label, unidade, valor, onChange, dica, placeholder, className }: {
  id: string; label: string; unidade?: string; valor: string; onChange: (v: string) => void; dica?: string; placeholder?: string; className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label htmlFor={id} className="text-xs font-medium">{label}</Label>
      <div className="relative">
        <Input id={id} inputMode="decimal" value={valor} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
          className={cn('h-10 tabular-nums text-[16px] sm:text-sm', unidade && 'pr-14')} />
        {unidade && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{unidade}</span>}
      </div>
      {dica && <p className="text-[11px] leading-snug text-muted-foreground">{dica}</p>}
    </div>
  );
}

export function Secao({ numero, titulo, children, direita }: { numero?: number; titulo: string; children: ReactNode; direita?: ReactNode }) {
  return (
    <section className="space-y-3.5 rounded-2xl border border-border/60 bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
          {numero !== undefined && (
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold', ACC.suaveForte, ACC.texto)}>{numero}</span>
          )}
          {titulo}
        </h3>
        {direita}
      </div>
      {children}
    </section>
  );
}

export function Linha({ rotulo, valor, destaque, dica }: { rotulo: string; valor: ReactNode; destaque?: boolean; dica?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        {dica && <p className="text-[10px] text-muted-foreground/80">{dica}</p>}
      </div>
      <p className={cn('tabular-nums text-right shrink-0', destaque ? 'text-lg font-bold' : 'text-sm font-semibold')}>{valor}</p>
    </div>
  );
}

export function FontesChips({ ids, className }: { ids: string[]; className?: string }) {
  const unicos = [...new Set(ids)].filter((i) => referencia(i));
  if (!unicos.length) return null;
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Fonte</span>
      {unicos.map((id) => {
        const r = referencia(id)!;
        return (
          <a key={id} href={urlPubmed(r.pmid)} target="_blank" rel="noreferrer" title={`${r.autores}, ${r.ano}, ${r.revista} — PubMed ${r.pmid}`}
            className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-muted/40 px-2 py-0.5 text-[10.5px] font-medium text-foreground/80 hover:bg-muted">
            {rotuloReferencia(id)} <ExternalLink className="h-2.5 w-2.5 opacity-60" />
          </a>
        );
      })}
    </div>
  );
}

const TONS: Record<string, string> = {
  bom: 'border-emerald-300/70 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-800',
  atencao: 'border-amber-300/70 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800',
  ruim: 'border-red-300/70 bg-red-50 text-red-900 dark:bg-red-950/30 dark:text-red-200 dark:border-red-800',
  neutro: 'border-border bg-muted/50 text-muted-foreground',
};

export function Aviso({ tom = 'neutro', titulo, children, icone }: { tom?: keyof typeof TONS; titulo?: string; children: ReactNode; icone?: ReactNode }) {
  return (
    <div className={cn('flex gap-2 rounded-xl border p-3 text-xs leading-snug', TONS[tom])}>
      {icone && <span className="mt-0.5 shrink-0">{icone}</span>}
      <div className="min-w-0 space-y-0.5">
        {titulo && <p className="font-semibold">{titulo}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

export function mesesDesde(data: string | null): number | null {
  if (!data) return null;
  const d = new Date(`${data.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const h = new Date();
  return (h.getFullYear() - d.getFullYear()) * 12 + (h.getMonth() - d.getMonth());
}

export function SeletorAparelho({ itens, valor, onChange, disponivel, onGerenciar }: {
  itens: EquipamentoFisio[]; valor: string; onChange: (id: string) => void; disponivel: boolean; onGerenciar: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Aparelho</Label>
        <button type="button" onClick={onGerenciar} className="text-[11px] font-medium text-primary hover:underline">Meus aparelhos</button>
      </div>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">Digitar os valores à mão</SelectItem>
          {itens.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome}{e.modelo ? ` · ${e.modelo}` : ''}</SelectItem>)}
        </SelectContent>
      </Select>
      {valor !== 'manual' && (() => {
        const e = itens.find((x) => x.id === valor);
        const m = mesesDesde(e?.ultima_calibracao ?? null);
        if (!e) return null;
        return (
          <p className="text-[11px] text-muted-foreground">
            {m === null ? 'Sem data de calibração cadastrada — confira o laudo.' : `Última calibração há ${m <= 0 ? 'menos de 1 mês' : `${m} ${m === 1 ? 'mês' : 'meses'}`}.`}
          </p>
        );
      })()}
    </div>
  );
}

/** Id inicial da condição: o recebido do guia, se existir na lista; senão, o primeiro. */
export const condicaoInicial = (lista: { id: string }[], id?: string | null) => (lista.some((c) => c.id === id) ? (id as string) : lista[0].id);
