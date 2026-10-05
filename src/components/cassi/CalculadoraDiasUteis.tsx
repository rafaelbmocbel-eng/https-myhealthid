import { useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, Copy, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { calcularDiasUteisGuia } from '@/lib/feriados';
import { cn } from '@/lib/utils';

const CHAVE = 'cassi_feriados_locais';
const ATALHOS = [5, 8, 10, 12, 15, 20];

interface Extra { iso: string; nome: string }

export interface InicialCalculadora { autorizacao?: string; quantidade?: number; comAvaliacao?: boolean }

const lerExtras = (): Extra[] => {
  try {
    const bruto = JSON.parse(window.localStorage.getItem(CHAVE) || '[]');
    return Array.isArray(bruto) ? bruto.filter((e): e is Extra => typeof e?.iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.iso)) : [];
  } catch {
    // Armazenamento bloqueado ou conteúdo corrompido: segue sem feriados locais.
    return [];
  }
};

const gravarExtras = (l: Extra[]) => {
  try { window.localStorage.setItem(CHAVE, JSON.stringify(l)); }
  catch { /* sem armazenamento (aba anônima): as datas valem só enquanto a janela estiver aberta */ }
};

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const curto = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Calculadora de datas da guia CASSI, para uso manual: serve para guia que não está na lista, com data
// no passado ou no futuro. Só dias úteis; conta a partir da data (ou até a data, no retroativo).
function Painel({ inicial }: { inicial?: InicialCalculadora }) {
  const [data, setData] = useState(inicial?.autorizacao || hojeISO());
  const [quantidade, setQuantidade] = useState(String(inicial?.quantidade || 10));
  const [sentido, setSentido] = useState<'adiante' | 'atras'>('adiante');
  const [contarDia, setContarDia] = useState(true);
  const [comAvaliacao, setComAvaliacao] = useState(!!inicial?.comAvaliacao);
  const [extras, setExtras] = useState<Extra[]>(lerExtras);
  const [novo, setNovo] = useState({ iso: '', nome: '' });

  const n = Math.floor(Number(quantidade));
  const hoje = hojeISO();
  const r = useMemo(
    () => calcularDiasUteisGuia({ autorizacaoISO: data, quantidade: n, contarDiaAutorizacao: contarDia, comAvaliacao, sentido, extras: new Set(extras.map((e) => e.iso)) }),
    [data, n, contarDia, comAvaliacao, sentido, extras],
  );
  const nomeExtra = (iso: string) => extras.find((e) => e.iso === iso)?.nome;
  const passaram = r ? r.dias.filter((d) => d.iso < hoje).length : 0;
  const ehHoje = r ? r.dias.some((d) => d.iso === hoje) : false;
  const futuras = r ? r.dias.length - passaram - (ehHoje ? 1 : 0) : 0;

  const copiar = async (texto: string, ok: string) => {
    try { await navigator.clipboard.writeText(texto); toast.success(ok); }
    catch { toast.error('Não consegui copiar.'); }
  };

  const adicionar = () => {
    if (!novo.iso) { toast.error('Escolha a data do feriado.'); return; }
    if (extras.some((e) => e.iso === novo.iso)) { toast.error('Essa data já está na lista.'); return; }
    const l = [...extras, { iso: novo.iso, nome: novo.nome.trim() || 'Feriado local' }].sort((a, b) => a.iso.localeCompare(b.iso));
    setExtras(l); gravarExtras(l); setNovo({ iso: '', nome: '' });
  };
  const remover = (iso: string) => { const l = extras.filter((e) => e.iso !== iso); setExtras(l); gravarExtras(l); };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Para guia que não está na lista: informe a data e a quantidade de sessões e veja as datas de atendimento, só em dias úteis (segunda a sexta, sem feriado), no passado ou no futuro.</p>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="cdu-aut" className="text-[10px] uppercase tracking-wide text-muted-foreground">{sentido === 'adiante' ? 'Autorizada em' : 'Última sessão em'}</label>
          <Input id="cdu-aut" type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-10" />
        </div>
        <div className="space-y-1">
          <label htmlFor="cdu-qtd" className="text-[10px] uppercase tracking-wide text-muted-foreground">Sessões (dias úteis)</label>
          <Input id="cdu-qtd" type="number" min={1} max={400} inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} onFocus={(e) => e.currentTarget.select()} className="h-10" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quantidades comuns">
        {ATALHOS.map((q) => (
          <button key={q} type="button" onClick={() => setQuantidade(String(q))} aria-pressed={n === q}
            className={cn('rounded-full border px-3 py-1 text-xs font-medium tabular-nums transition-colors', n === q ? 'border-primary bg-primary/10' : 'border-border/60 text-muted-foreground hover:bg-muted')}>{q}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-xl bg-muted/60 p-1" role="group" aria-label="Sentido da contagem">
        {([['adiante', 'A partir da data'], ['atras', 'Até a data (retroativo)']] as const).map(([v, rotulo]) => (
          <button key={v} type="button" aria-pressed={sentido === v} onClick={() => setSentido(v)}
            className={cn('rounded-lg px-2 py-1.5 text-xs font-semibold transition-all', sentido === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}>{rotulo}</button>
        ))}
      </div>

      <div className="space-y-1.5 text-sm">
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={contarDia} onChange={(e) => setContarDia(e.target.checked)} /> <span>Contar o dia da data como sessão <span className="text-xs text-muted-foreground">(se for dia útil)</span></span></label>
        <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={comAvaliacao} onChange={(e) => setComAvaliacao(e.target.checked)} /> <span>Incluir o dia da avaliação (144) além das sessões</span></label>
      </div>

      {!r ? (
        <p className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">Informe a data e a quantidade de sessões.</p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Período</p>
                <p className="text-xl font-bold tabular-nums">{r.dias[0].semana} {br(r.inicioISO!)} <span className="font-normal text-muted-foreground">a</span> {r.dias[r.dias.length - 1].semana} {br(r.fimISO!)}</p>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">
                {n} sessão(ões){comAvaliacao ? ' + avaliação' : ''} · {passaram > 0 && `${passaram} já passou(aram)`}{passaram > 0 && (ehHoje || futuras > 0) && ' · '}{ehHoje && 'hoje'}{ehHoje && futuras > 0 && ' · '}{futuras > 0 && `${futuras} a fazer`}
              </p>
            </div>
          </div>

          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Datas da guia">
            {r.dias.map((d) => {
              const passou = d.iso < hoje;
              const agora = d.iso === hoje;
              return (
                <li key={d.iso} className={cn('rounded-lg border px-2.5 py-1.5 text-sm tabular-nums',
                  d.rotulo === 'avaliacao' ? 'border-violet-400/50 bg-violet-500/10' : agora ? 'border-primary bg-primary/10' : passou ? 'border-border/40 bg-muted/40 text-muted-foreground' : 'border-border/60')}>
                  <span className="mr-1.5 text-[11px] text-muted-foreground">{d.rotulo === 'avaliacao' ? 'Aval.' : `${d.numero}ª`}</span>
                  <span className="font-medium">{d.semana} {curto(d.iso)}</span>
                  {agora && <span className="ml-1 text-[10px] font-semibold text-primary">hoje</span>}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="gap-1.5" onClick={() => void copiar(r.dias.map((d) => br(d.iso)).join('\n'), 'Datas copiadas, uma por linha.')}><Copy className="h-3.5 w-3.5" /> Copiar datas</Button>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => void copiar(r.dias.map((d) => curto(d.iso)).join(', '), 'Datas copiadas em uma linha.')}><Copy className="h-3.5 w-3.5" /> Copiar em uma linha</Button>
          </div>

          {r.pulados.length > 0 && (
            <details className="rounded-xl border border-border/60 p-3 text-xs">
              <summary className="cursor-pointer font-medium">{r.pulados.length} dia(s) pulado(s) no período</summary>
              <ul className="mt-2 space-y-0.5 tabular-nums text-muted-foreground">
                {r.pulados.map((p) => <li key={p.iso}>{p.semana} {br(p.iso)} · {nomeExtra(p.iso) ?? p.motivo}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-border/60 p-3">
        <p className="text-sm font-semibold">Feriados locais</p>
        <p className="text-[11px] text-muted-foreground">Já entram os feriados nacionais, inclusive Carnaval, Sexta-feira Santa e Corpus Christi. Acrescente aqui feriado municipal ou recesso; fica salvo neste aparelho.</p>
        <div className="flex flex-wrap items-end gap-2">
          <Input type="date" aria-label="Data do feriado local" value={novo.iso} onChange={(e) => setNovo((s) => ({ ...s, iso: e.target.value }))} className="h-9 w-40" />
          <Input aria-label="Nome do feriado local" placeholder="Nome (opcional)" value={novo.nome} onChange={(e) => setNovo((s) => ({ ...s, nome: e.target.value }))} className="h-9 min-w-[8rem] flex-1 text-[16px] sm:text-sm" />
          <Button size="sm" variant="outline" className="h-9 gap-1" onClick={adicionar}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
        </div>
        {extras.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {extras.map((e) => (
              <li key={e.iso} className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 py-0.5 pl-2.5 pr-1 text-xs tabular-nums">
                {curto(e.iso)} · {e.nome}
                <button type="button" aria-label={`Remover ${e.nome}`} onClick={() => remover(e.iso)} className="rounded-full p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Cartão que se abre dentro da aba "Este mês". */
export function CalculadoraCartao({ aberto, onAlternar }: { aberto: boolean; onAlternar: () => void }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border/50 bg-background" id="calculadora-dias-uteis">
      <button type="button" onClick={onAlternar} aria-expanded={aberto} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
        <span className="flex-1">
          <span className="block text-sm font-bold">Calculadora de dias úteis</span>
          <span className="block text-[11px] text-muted-foreground">Guia fora da lista: veja as datas de atendimento, no passado ou no futuro.</span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')} />
      </button>
      {aberto && <div className="border-t border-border/50 p-3"><Painel /></div>}
    </section>
  );
}

/** Mesma calculadora em janela, aberta de dentro da guia com a data e as sessões já preenchidas. */
export default function CalculadoraDiasUteis({ onClose, inicial }: { onClose: () => void; inicial?: InicialCalculadora }) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Calculadora de dias úteis</DialogTitle></DialogHeader>
        <Painel inicial={inicial} />
      </DialogContent>
    </Dialog>
  );
}
