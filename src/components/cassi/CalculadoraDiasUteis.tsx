import { useMemo, useState } from 'react';
import { CalendarDays, Copy, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { calcularDiasUteisGuia } from '@/lib/feriados';
import { cn } from '@/lib/utils';

const CHAVE = 'cassi_feriados_locais';

interface Extra { iso: string; nome: string }

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

// Calculadora de datas da guia CASSI: a partir do dia em que a guia foi autorizada, só em dias úteis.
export default function CalculadoraDiasUteis({ onClose, inicial }: { onClose: () => void; inicial?: { autorizacao?: string; quantidade?: number; comAvaliacao?: boolean } }) {
  const [autorizacao, setAutorizacao] = useState(inicial?.autorizacao || hojeISO());
  const [quantidade, setQuantidade] = useState(String(inicial?.quantidade || 10));
  const [contarDia, setContarDia] = useState(true);
  const [comAvaliacao, setComAvaliacao] = useState(!!inicial?.comAvaliacao);
  const [extras, setExtras] = useState<Extra[]>(lerExtras);
  const [novo, setNovo] = useState({ iso: '', nome: '' });

  const n = Math.floor(Number(quantidade));
  const r = useMemo(
    () => calcularDiasUteisGuia({ autorizacaoISO: autorizacao, quantidade: n, contarDiaAutorizacao: contarDia, comAvaliacao, extras: new Set(extras.map((e) => e.iso)) }),
    [autorizacao, n, contarDia, comAvaliacao, extras],
  );
  const nomeExtra = (iso: string) => extras.find((e) => e.iso === iso)?.nome;

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
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-primary" /> Calculadora de dias úteis</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">Datas da guia só em dias úteis (segunda a sexta, sem feriado), contadas a partir do dia em que a guia foi autorizada.</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="cdu-aut" className="text-[10px] uppercase tracking-wide text-muted-foreground">Autorizada em</label>
              <Input id="cdu-aut" type="date" value={autorizacao} onChange={(e) => setAutorizacao(e.target.value)} className="h-10" />
            </div>
            <div className="space-y-1">
              <label htmlFor="cdu-qtd" className="text-[10px] uppercase tracking-wide text-muted-foreground">Sessões (dias úteis)</label>
              <Input id="cdu-qtd" type="number" min={1} max={400} inputMode="numeric" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} onFocus={(e) => e.currentTarget.select()} className="h-10" />
            </div>
          </div>
          <div className="space-y-1.5 text-sm">
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={contarDia} onChange={(e) => setContarDia(e.target.checked)} /> <span>Contar o dia da autorização como o 1º dia <span className="text-xs text-muted-foreground">(se for dia útil)</span></span></label>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1" checked={comAvaliacao} onChange={(e) => setComAvaliacao(e.target.checked)} /> <span>Incluir o dia da avaliação (144) além das sessões</span></label>
          </div>

          {!r ? (
            <p className="rounded-xl border border-border/60 p-3 text-sm text-muted-foreground">Informe a data da autorização e a quantidade de sessões.</p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Última data</p>
                <p className="text-2xl font-bold tabular-nums">{r.dias[r.dias.length - 1].semana} {br(r.fimISO!)}</p>
                <p className="text-xs text-muted-foreground">{n} sessão(ões){comAvaliacao ? ' + avaliação' : ''} · começa em {r.dias[0].semana} {br(r.dias[0].iso)}</p>
              </div>

              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" aria-label="Datas da guia">
                {r.dias.map((d) => (
                  <li key={d.iso} className={cn('rounded-lg border px-2.5 py-1.5 text-sm tabular-nums', d.rotulo === 'avaliacao' ? 'border-violet-400/50 bg-violet-500/10' : 'border-border/60')}>
                    <span className="mr-1.5 text-[11px] text-muted-foreground">{d.rotulo === 'avaliacao' ? 'Aval.' : `${d.numero}ª`}</span>
                    <span className="font-medium">{d.semana} {curto(d.iso)}</span>
                  </li>
                ))}
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
      </DialogContent>
    </Dialog>
  );
}
