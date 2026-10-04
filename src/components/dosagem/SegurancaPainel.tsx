import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { detectarAlertas, itensDaModalidade, type Alerta, type ItemSeguranca } from '@/lib/dosagem/seguranca';
import { MODALIDADES, type Modalidade } from '@/lib/dosagem/tipos';
import type { PacienteDosagem } from '@/hooks/useProntuarioSeguranca';
import { Aviso, FontesChips, Secao } from './comuns';

export function useSeguranca(modalidade: Modalidade, paciente: PacienteDosagem | null | undefined) {
  const itens = useMemo(() => itensDaModalidade(modalidade), [modalidade]);
  const alertas = useMemo(() => {
    const a: Record<string, Alerta[]> = detectarAlertas(paciente?.textos ?? [], itens);
    const idade = paciente?.idade;
    if (idade !== null && idade !== undefined) {
      for (const i of itens) {
        if (idade < 18 && i.id.endsWith('_epifise')) (a[i.id] ||= []).push({ origem: 'Cadastro', trecho: `${idade} anos` });
        if (idade >= 65 && i.id === 'eswt_idosos_focal') (a[i.id] ||= []).push({ origem: 'Cadastro', trecho: `${idade} anos` });
      }
    }
    return a;
  }, [itens, paciente]);

  const [reconhecidos, setReconhecidos] = useState<Set<string>>(new Set());
  const [conferido, setConferido] = useState(false);
  useEffect(() => { setReconhecidos(new Set()); setConferido(false); }, [paciente?.id, modalidade]);

  const alternar = (id: string) => setReconhecidos((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const pendentes = Object.keys(alertas).filter((id) => !reconhecidos.has(id));
  const pronto = conferido && pendentes.length === 0;
  return { itens, alertas, reconhecidos, alternar, conferido, setConferido, pendentes, pronto };
}

type Estado = ReturnType<typeof useSeguranca>;

function Item({ item, alertas, marcado, onMarcar }: { item: ItemSeguranca; alertas?: Alerta[]; marcado: boolean; onMarcar: () => void }) {
  const aceso = !!alertas?.length;
  return (
    <li className={cn('rounded-xl border p-3 text-xs space-y-1.5',
      aceso
        ? (item.gravidade === 'contraindicacao' ? 'border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800' : 'border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800')
        : 'border-border/60 bg-background')}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug">{item.titulo}</p>
        <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide',
          item.gravidade === 'contraindicacao' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200')}>
          {item.gravidade === 'contraindicacao' ? 'contraindicação' : 'precaução'}
        </span>
      </div>
      <p className="text-muted-foreground leading-snug">{item.detalhe}</p>
      {item.fonte === 'literatura' && item.refs ? <FontesChips ids={item.refs} /> : (
        <p className="text-[10px] italic text-muted-foreground">Lista clássica da prática — não localizada em artigo na pesquisa; confira o manual do aparelho.</p>
      )}
      {aceso && (
        <div className="space-y-1.5 border-t border-current/10 pt-1.5">
          {alertas!.slice(0, 2).map((a, i) => (
            <p key={i} className="text-[11px]"><strong>Encontrado no prontuário</strong> ({a.origem}): “{a.trecho}”</p>
          ))}
          <label className="flex items-center gap-2 text-[11px] font-medium cursor-pointer">
            <Checkbox checked={marcado} onCheckedChange={onMarcar} />
            Ciente — avaliei este ponto para este paciente
          </label>
        </div>
      )}
    </li>
  );
}

export function SegurancaPainel({ modalidade, estado, paciente, numero }: { modalidade: Modalidade; estado: Estado; paciente: PacienteDosagem | null | undefined; numero?: number }) {
  const { itens, alertas, reconhecidos, alternar, conferido, setConferido } = estado;
  const acesos = itens.filter((i) => alertas[i.id]?.length);
  const demais = itens.filter((i) => !alertas[i.id]?.length);
  const [aberto, setAberto] = useState(false);

  return (
    <Secao numero={numero} titulo="Segurança do paciente"
      direita={acesos.length > 0
        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300"><ShieldAlert className="h-3.5 w-3.5" />{acesos.length} no prontuário</span>
        : <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />{itens.length} itens</span>}>
      {!paciente && (
        <Aviso>Escolha um paciente no topo para o app procurar, no prontuário dele, sinais ligados a estas contraindicações. Sem paciente, confira a lista abaixo à mão.</Aviso>
      )}
      {acesos.length > 0 && (
        <ul className="space-y-2">{acesos.map((i) => <Item key={i.id} item={i} alertas={alertas[i.id]} marcado={reconhecidos.has(i.id)} onMarcar={() => alternar(i.id)} />)}</ul>
      )}
      <div>
        <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
          <span>{acesos.length ? 'Demais contraindicações e precauções' : 'Contraindicações e precauções'} ({demais.length})</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', aberto && 'rotate-180')} />
        </button>
        {aberto && <ul className="mt-2 space-y-2">{demais.map((i) => <Item key={i.id} item={i} marcado={false} onMarcar={() => undefined} />)}</ul>}
      </div>
      <label className="flex items-start gap-2 rounded-xl border border-border/70 bg-muted/30 p-3 text-xs font-medium cursor-pointer">
        <Checkbox checked={conferido} onCheckedChange={(v) => setConferido(v === true)} className="mt-0.5" />
        <span>Conferi as contraindicações e precauções desta modalidade ({(MODALIDADES.find((m) => m.id === modalidade)?.curto ?? '').toLowerCase()}) para este paciente.</span>
      </label>
    </Secao>
  );
}
