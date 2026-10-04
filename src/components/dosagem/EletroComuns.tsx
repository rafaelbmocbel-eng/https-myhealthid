import { Info, TriangleAlert } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fmt } from '@/lib/dosagem/calculos';
import { ROTULO_NIVEL, type CondicaoEletro, type NivelEvidencia, type ParamsEletro } from '@/lib/dosagem/protocolosEletro';
import { Aviso, FontesChips } from './comuns';
import { SeloStatus, type Tom } from './visual';

const TOM_NIVEL: Record<NivelEvidencia, Tom> = { moderada: 'bom', baixa: 'atencao', muito_baixa: 'atencao', insuficiente: 'neutro', inconclusiva: 'neutro' };

export const descreverParams = (p: ParamsEletro) => [
  p.portadoraHz ? `portadora ${fmt(p.portadoraHz, 0)} Hz` : '',
  p.amfHz ? `AMF ${fmt(p.amfHz, 0)} Hz` : '',
  p.burstHz ? `burst ${fmt(p.burstHz, 0)} Hz` : '',
  p.freqHz ? `${fmt(p.freqHz, 0)} Hz` : '',
  p.larguraUs ? `${fmt(p.larguraUs, 0)} µs` : '',
  p.onS !== undefined ? `on ${fmt(p.onS, 1)} s` : '',
  p.offS !== undefined ? `off ${fmt(p.offS, 1)} s` : '',
  p.rampaS !== undefined ? `rampa ${fmt(p.rampaS, 1)} s` : '',
  p.correnteMa ? `${fmt(p.correnteMa, 0)} mA` : '',
  p.duracaoMin ? `${fmt(p.duracaoMin, 0)} min` : '',
  p.sessoes ? `${p.sessoes} sessão(ões)` : '',
].filter(Boolean).join(' · ');

export function SeletorCondicao({ condicoes, valor, onChange }: { condicoes: CondicaoEletro[]; valor: string; onChange: (id: string) => void }) {
  return (
    <Select value={valor} onValueChange={onChange}>
      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
      <SelectContent>{condicoes.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
    </Select>
  );
}

/** Evidência da condição: o que a literatura concluiu, as faixas observadas e os exemplos carregáveis. */
export function CartaoCondicaoEletro({ cond, onUsar }: { cond: CondicaoEletro; onUsar: (p: ParamsEletro) => void }) {
  return (
    <div className="space-y-3 rounded-2xl bg-muted/40 p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {cond.nivel && <SeloStatus tom={TOM_NIVEL[cond.nivel]}>{ROTULO_NIVEL[cond.nivel]}</SeloStatus>}
      </div>
      <p className="text-xs leading-relaxed">{cond.resumo}</p>

      {cond.faixas.length > 0 && (
        <dl className="space-y-2">
          {cond.faixas.map((f) => (
            <div key={f.rotulo} className="rounded-xl border border-border/60 bg-background p-2.5">
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.rotulo}</dt>
              <dd className="mt-0.5 text-xs font-medium leading-snug">{f.valor}</dd>
              <FontesChips ids={f.fontes} className="mt-1.5" />
            </div>
          ))}
        </dl>
      )}

      {cond.ressalvas && cond.ressalvas.length > 0 && (
        <ul className="space-y-1.5">
          {cond.ressalvas.map((r) => (
            <li key={r} className="flex gap-2 text-[11.5px] leading-snug text-amber-900 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span>{r}</span>
            </li>
          ))}
        </ul>
      )}

      {cond.exemplos && cond.exemplos.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Exemplos de ensaios</p>
          {cond.exemplos.map((e) => (
            <div key={e.titulo} className="space-y-1 rounded-xl border border-border/60 bg-background p-2.5 text-xs">
              <p className="font-semibold">{e.titulo}</p>
              <p className="tabular-nums">{descreverParams(e.params)}</p>
              {e.nota && <p className="text-muted-foreground">{e.nota}</p>}
              <div className="flex items-center justify-between gap-2">
                <FontesChips ids={e.fontes} />
                <button type="button" onClick={() => onUsar(e.params)} className="shrink-0 font-medium text-primary hover:underline">Usar estes valores</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <FontesChips ids={cond.fontes} />
    </div>
  );
}

export function RegraIntensidade({ children, fontes }: { children: React.ReactNode; fontes: string[] }) {
  return (
    <Aviso tom="bom" icone={<Info className="h-4 w-4" />} titulo="Como ajustar a intensidade">
      {children}
      <FontesChips ids={fontes} className="mt-1.5" />
    </Aviso>
  );
}
