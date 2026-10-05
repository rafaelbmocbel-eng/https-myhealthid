import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronDown, ClipboardList, Compass, ShieldAlert, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ACC, estiloAcento } from '@/lib/dosagem/acentos';
import {
  FAIXAS, GRUPOS_GUIA, PATOLOGIAS, indicacoesOrdenadas, interpretarDescricao, interpretarProntuario, modalidadesSemDados, patologia,
  type Faixa, type IndicacaoGuia, type Interpretacao,
} from '@/lib/dosagem/guia';
import { alertasDoPaciente, itensDaModalidade } from '@/lib/dosagem/seguranca';
import { MODALIDADES, type Modalidade } from '@/lib/dosagem/tipos';
import type { PacienteDosagem } from '@/hooks/useProntuarioSeguranca';
import { FontesChips, Secao } from './comuns';
import { ICONES } from './visual';

const SELO: Record<Faixa, string> = {
  A: 'bg-emerald-100 text-emerald-900 ring-emerald-300/70 dark:bg-emerald-950/60 dark:text-emerald-200 dark:ring-emerald-800',
  B: 'bg-teal-100 text-teal-900 ring-teal-300/70 dark:bg-teal-950/60 dark:text-teal-200 dark:ring-teal-800',
  C: 'bg-amber-100 text-amber-900 ring-amber-300/70 dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-800',
  D: 'bg-red-100 text-red-900 ring-red-300/70 dark:bg-red-950/60 dark:text-red-200 dark:ring-red-800',
};

const nomeModalidade = (m: Modalidade) => MODALIDADES.find((x) => x.id === m)!;

interface Props {
  paciente: PacienteDosagem | null | undefined;
  patologiaId: string;
  onPatologia: (id: string) => void;
  onUsar: (modalidade: Modalidade, calc: string) => void;
}

interface Sugestao extends Interpretacao { origens?: string[] }

function CartaoIndicacao({ ind, posicao, destaque, paciente, onUsar }: {
  ind: IndicacaoGuia; posicao: number; destaque: boolean; paciente: PacienteDosagem | null | undefined; onUsar: () => void;
}) {
  const info = nomeModalidade(ind.modalidade);
  const Icone = ICONES[ind.modalidade];
  const alertas = useMemo(() => {
    const itens = itensDaModalidade(ind.modalidade);
    const a = alertasDoPaciente(itens, paciente);
    return itens.filter((i) => a[i.id]?.length).map((i) => ({ item: i, achados: a[i.id] }));
  }, [ind.modalidade, paciente]);
  const [aberto, setAberto] = useState(false);

  return (
    <article style={estiloAcento(ind.modalidade)}
      className={cn('relative overflow-hidden rounded-2xl border bg-card p-4 transition-shadow sm:p-5',
        destaque ? cn(ACC.borda, 'ring-2 shadow-md', ACC.anel) : 'border-border/60 shadow-[0_1px_2px_rgba(15,23,42,0.04)]')}>
      {destaque && <span aria-hidden className={cn('pointer-events-none absolute inset-0', ACC.gradiente)} />}
      <div className="relative flex gap-3.5">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span className={cn('flex h-11 w-11 items-center justify-center rounded-2xl', destaque ? ACC.solido : cn(ACC.suaveForte, ACC.texto))}><Icone className="h-5 w-5" /></span>
          <span className="text-[11px] font-bold tabular-nums text-muted-foreground">{posicao}º</span>
        </div>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h3 className="text-base font-bold tracking-tight">{info.nome}</h3>
            <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', SELO[ind.faixa])} title={FAIXAS[ind.faixa].descricao}>
              {FAIXAS[ind.faixa].titulo}
            </span>
            {destaque && <span className={cn('text-[10.5px] font-semibold uppercase tracking-wider', ACC.texto)}>Mais respaldo nesta patologia</span>}
          </div>
          <p className="text-[13px] leading-relaxed">{ind.resumo}</p>
          <FontesChips ids={ind.fontes} />

          {alertas.length > 0 && (
            <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-2.5 text-xs dark:border-amber-800 dark:bg-amber-950/30">
              <button type="button" onClick={() => setAberto((v) => !v)} className="flex w-full items-center justify-between gap-2 font-semibold text-amber-900 dark:text-amber-200">
                <span className="inline-flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> {alertas.length} alerta(s) no prontuário</span>
                <ChevronDown className={cn('h-4 w-4 transition-transform', aberto && 'rotate-180')} />
              </button>
              {aberto && (
                <ul className="mt-2 space-y-1.5 text-amber-950 dark:text-amber-100">
                  {alertas.map(({ item, achados }) => (
                    <li key={item.id}><strong>{item.titulo}</strong> — “{achados[0].trecho}” ({achados[0].origem})</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="pt-0.5">
            <Button size="sm" variant={destaque ? 'default' : 'outline'} onClick={onUsar} className="gap-1.5">
              Usar {info.curto.toLowerCase()} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function GuiaRecursos({ paciente, patologiaId, onPatologia, onUsar }: Props) {
  const [texto, setTexto] = useState('');
  const [textoAnalisado, setTextoAnalisado] = useState('');
  const [doProntuario, setDoProntuario] = useState<Sugestao[] | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setTextoAnalisado(texto.trim()), 450);
    return () => clearTimeout(id);
  }, [texto]);

  const digitadas = useMemo<Sugestao[]>(() => (textoAnalisado.length >= 3 ? interpretarDescricao(textoAnalisado) : []), [textoAnalisado]);

  // Entendeu a descrição com boa confiança: já mostra a melhor patologia (as outras ficam como opções).
  useEffect(() => {
    if (digitadas[0] && digitadas[0].pontos >= 3 && digitadas[0].id !== patologiaId) onPatologia(digitadas[0].id);
  }, [digitadas]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setDoProntuario(null); }, [paciente?.id]);

  const lerProntuario = () => {
    if (!paciente) return;
    const r = interpretarProntuario(paciente.textos);
    setDoProntuario(r);
    if (!r.length) { toast.message('Não encontrei, no prontuário, nada que combine com as patologias do guia.', { description: 'Descreva o caso ou escolha a patologia na lista.' }); return; }
    if (r[0].pontos >= 3) onPatologia(r[0].id);
  };

  const atual = patologia(patologiaId);
  const ordenadas = atual ? indicacoesOrdenadas(atual) : [];
  const sem = atual ? modalidadesSemDados(atual, MODALIDADES.map((m) => m.id)) : [];
  const sugestoes: Sugestao[] = [...(doProntuario ?? []), ...digitadas.filter((d) => !(doProntuario ?? []).some((p) => p.id === d.id))];

  return (
    <div className="space-y-4">
      <Secao titulo="Descreva o que o paciente tem" direita={<Compass className="h-4 w-4 text-muted-foreground" />}>
        <Textarea rows={2} value={texto} onChange={(e) => setTexto(e.target.value)} className="bg-background text-[16px] sm:text-sm"
          placeholder="Ex.: dor no joelho há 6 meses, com artrose · tendinite patelar em corredor · AVC com pé caído" />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={!paciente} onClick={lerProntuario}
            title={paciente ? 'Procura no prontuário as patologias do guia' : 'Escolha um paciente no topo'}>
            <ClipboardList className="h-3.5 w-3.5" /> Ler o prontuário{paciente ? ` de ${paciente.nome}` : ''}
          </Button>
          {!paciente && <span className="text-[11px] text-muted-foreground">Escolha um paciente no topo para o app ler o prontuário.</span>}
        </div>

        {sugestoes.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><Sparkles className="h-3 w-3" /> O app entendeu — toque para escolher</p>
            <div className="flex flex-wrap gap-1.5">
              {sugestoes.map((s) => (
                <button key={s.id} type="button" onClick={() => onPatologia(s.id)}
                  className={cn('rounded-xl border px-2.5 py-1.5 text-left text-xs transition',
                    s.id === patologiaId ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border bg-background hover:bg-muted')}>
                  <span className="block font-semibold">{s.nome}</span>
                  <span className="block text-[10px] text-muted-foreground">{s.origens ? `no prontuário (${s.origens.join(', ')})` : `“${s.trechos[0]}”`}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {textoAnalisado.length >= 3 && digitadas.length === 0 && !doProntuario?.length && (
          <p className="text-[11.5px] text-amber-700 dark:text-amber-400">Não reconheci a patologia. Descreva de outro jeito (ex.: “artrose de joelho”) ou escolha na lista abaixo.</p>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium">Ou escolha a patologia</p>
          <Select value={patologiaId || undefined} onValueChange={onPatologia}>
            <SelectTrigger className="h-10"><SelectValue placeholder={`Escolher entre ${PATOLOGIAS.length} patologias…`} /></SelectTrigger>
            <SelectContent className="max-h-80">
              {GRUPOS_GUIA.map((g) => (
                <SelectGroup key={g.id}>
                  <SelectLabel>{g.titulo}</SelectLabel>
                  {PATOLOGIAS.filter((p) => p.grupo === g.id).map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Secao>

      {!atual ? (
        <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
          Escolha ou descreva a patologia para ver quais recursos têm mais respaldo.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Recursos para</p>
              <h2 className="text-xl font-bold tracking-tight">{atual.nome}</h2>
            </div>
            <details className="text-[11px] text-muted-foreground">
              <summary className="cursor-pointer font-medium">Como ler as faixas</summary>
              <ul className="mt-1.5 max-w-xs space-y-1 rounded-xl border border-border/60 bg-card p-2.5">
                {(Object.keys(FAIXAS) as Faixa[]).map((f) => (
                  <li key={f} className="flex gap-2"><span className={cn('mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ring-1', SELO[f])}>{f}</span><span><strong>{FAIXAS[f].titulo}:</strong> {FAIXAS[f].descricao}</span></li>
                ))}
              </ul>
            </details>
          </div>
          {atual.nota && <p className="rounded-xl bg-muted/50 px-3 py-2 text-xs leading-relaxed">{atual.nota}</p>}

          <div className="space-y-3">
            {ordenadas.map((ind, i) => (
              <CartaoIndicacao key={ind.modalidade} ind={ind} posicao={i + 1} destaque={i === 0 && ind.faixa !== 'D'} paciente={paciente} onUsar={() => onUsar(ind.modalidade, ind.calc)} />
            ))}
          </div>

          {sem.length > 0 && (
            <details className="rounded-2xl border border-border/60 bg-card p-3.5 text-xs">
              <summary className="cursor-pointer font-medium">Sem dados levantados para esta patologia ({sem.length})</summary>
              <p className="mt-2 text-muted-foreground">A pesquisa não encontrou, nos artigos lidos, dado para: {sem.map((m) => nomeModalidade(m).curto).join(', ')}. Isso não significa que não funcionem — só que não há respaldo levantado aqui. Você pode abrir a calculadora de qualquer um deles na aba “Calculadoras de dose”.</p>
            </details>
          )}

          <p className="px-1 text-[10.5px] leading-snug text-muted-foreground">
            A faixa de cada recurso é uma classificação do app a partir dos artigos citados e está em validação clínica; ela orienta, mas não substitui o seu raciocínio nem a avaliação do paciente.
          </p>
        </div>
      )}
    </div>
  );
}
