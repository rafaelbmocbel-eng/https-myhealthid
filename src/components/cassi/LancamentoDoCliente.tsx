import { useEffect, useId, useState } from 'react';
import { CalendarCheck, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  MAXIMO_GUIAS_NO_MES, brutoDosLancamentos, formatarCodigoOficial, guiaDoModelo, guiasPelaAgenda, lancamentosIguais, limiteDoCodigo,
  maximoNaGuia, normalizarLancamentos, problemasDosLancamentos, quantidadeDoModelo, resumoDosLancamentos, sessoesDosLancamentos,
  type CodigoFaturavel, type GuiaLancada,
} from '@/lib/cassiFaturamento';

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const textoDoLimite = (codigo: string) => {
  const { porGuia, porMes } = limiteDoCodigo(codigo);
  if (porMes != null) return `máx. ${porMes} no mês`;
  if (porGuia != null) return `máx. ${porGuia} por guia`;
  return '';
};

// Lançamento de um cliente no mês: em cada guia, a quantidade usada de cada código. Respeita os limites da CASSI
// (10 por guia, 1 consulta por guia, 10 de biofeedback no mês): o campo não passa do que cabe.
// Guia nova abre com o modelo (MODELO_DA_GUIA): 144, 012 e 185 já marcados; 131, 301 e 020 com a quantidade pronta, mas sem
// valer até o profissional marcar. Cada linha tem uma caixa de marcar: marcada vale a quantidade; desmarcada não conta.
export function LancamentoDoCliente({ nome, catalogo, inicial, sessoesAgenda, salvando = false, onSalvar, onCancelar, onAlterado }: {
  nome: string;
  catalogo: CodigoFaturavel[]; // já na ordem de exibição
  inicial: GuiaLancada[];
  sessoesAgenda: number; // referência: sessões atendidas na agenda neste mês
  salvando?: boolean;
  onSalvar: (guias: GuiaLancada[]) => void;
  onCancelar: () => void;
  onAlterado?: (alterado: boolean) => void; // avisa quem abriu este lançamento que há algo digitado ainda não salvo
}) {
  // Guia nova: o modelo, só com os códigos que existem na lista (se faltar algum, ele simplesmente não vem marcado).
  const novaGuia = (): GuiaLancada => Object.fromEntries(Object.entries(guiaDoModelo()).filter(([c]) => catalogo.some((x) => x.codigo === c)));
  const [guias, setGuias] = useState<GuiaLancada[]>(() => (inicial.length > 0 ? inicial.map((g) => ({ ...g })) : [novaGuia()]));
  // Quantidade que o profissional deixou numa linha ao desmarcá-la, por guia: ao marcar de novo ela volta com esse número.
  // Sempre do mesmo tamanho de `guias` (uma entrada por guia, na mesma posição): quem mexe em uma lista mexe na outra.
  const [lembradas, setLembradas] = useState<Array<Record<string, number>>>(() => (inicial.length > 0 ? inicial : [{}]).map(() => ({})));
  const idBase = useId();

  // Código que já está lançado mas não está mais na lista de códigos (ex.: tirado de Configurações) continua à vista:
  // vale R$ 0,00 e precisa dar para zerar, senão fica gravado sem ninguém ver.
  const conhecidos = new Set(catalogo.map((c) => c.codigo));
  const foraDaLista = [...new Set(guias.flatMap((g) => Object.keys(g)))].filter((c) => !conhecidos.has(c));
  const linhas: CodigoFaturavel[] = [
    ...catalogo,
    ...foraDaLista.map((codigo) => ({ codigo, descricao: 'fora da lista de códigos (vale R$ 0,00)', valor: 0 })),
  ];
  const valorDe = (c: string) => catalogo.find((x) => x.codigo === c)?.valor || 0;

  const definir = (posicao: number, codigo: string, desejado: number) => {
    setGuias((atual) => {
      const antes = atual[posicao]?.[codigo] || 0;
      const max = maximoNaGuia(atual, posicao, codigo);
      const n = Math.max(0, Math.floor(Number.isFinite(desejado) ? desejado : 0));
      // Só o AUMENTO é limitado: quem já está acima do limite (dado antigo) consegue descer um por vez.
      const q = n > antes ? Math.min(n, Math.max(antes, max)) : n;
      return atual.map((g, i) => {
        if (i !== posicao) return g;
        const nova = { ...g };
        if (q > 0) nova[codigo] = q; else delete nova[codigo];
        return nova;
      });
    });
  };

  const lembrar = (posicao: number, codigo: string, q: number) =>
    setLembradas((atual) => atual.map((memoria, k) => (k === posicao ? { ...memoria, [codigo]: q } : memoria)));
  const propostaDa = (posicao: number, codigo: string) => lembradas[posicao]?.[codigo] ?? quantidadeDoModelo(codigo);
  // Marcar põe a quantidade proposta (ou o que sobrar do limite); desmarcar guarda o número para a próxima vez.
  const marcar = (posicao: number, codigo: string) => definir(posicao, codigo, Math.max(1, propostaDa(posicao, codigo)));
  const desmarcar = (posicao: number, codigo: string, q: number) => {
    lembrar(posicao, codigo, q);
    definir(posicao, codigo, 0);
  };

  const guiasValidas = normalizarLancamentos(guias);
  // O que se compara para saber se "há algo digitado": o que já estava salvo, ou, num cliente sem lançamento, o modelo da guia
  // (abrir e não mexer em nada não é uma alteração).
  const referencia = normalizarLancamentos(inicial.length > 0 ? inicial : [novaGuia()]);
  const alterado = !lancamentosIguais(guiasValidas, referencia);
  const soOModelo = inicial.length === 0 && !alterado;
  // Enquanto grava, o que está digitado já está a caminho: não conta como "não salvo".
  const naoSalvo = alterado && !salvando;
  useEffect(() => {
    onAlterado?.(naoSalvo);
    return () => onAlterado?.(false);
  }, [naoSalvo]); // eslint-disable-line react-hooks/exhaustive-deps
  const daAgenda = guiasPelaAgenda(sessoesAgenda);
  const qtdDaAgenda = daAgenda.reduce((soma, g) => soma + Object.values(g).reduce((a, b) => a + b, 0), 0);
  const total = brutoDosLancamentos(guiasValidas, valorDe);
  const sessoes = sessoesDosLancamentos(guiasValidas);
  const acimaDoLimite = problemasDosLancamentos(guiasValidas).length > 0;

  return (
    <div className="px-3 pb-3 pt-2 space-y-3 bg-muted/20 border-t border-border/40" role="group" aria-label={`Códigos e sessões de ${nome}`} aria-busy={salvando}>
      {guias.map((g, i) => (
        <section key={i} className="rounded-lg border border-border/60 bg-background" aria-label={`Guia ${i + 1} de ${nome}`}>
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/40">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Guia {i + 1}</p>
            {guias.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  setGuias((atual) => atual.filter((_, k) => k !== i));
                  setLembradas((atual) => atual.filter((_, k) => k !== i));
                }}
                aria-label={`Tirar a guia ${i + 1}`}
                disabled={salvando}
                className="p-2 -m-1 text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
          <ul className="divide-y divide-border/40">
            {linhas.map((c) => {
              const q = g[c.codigo] || 0;
              const max = maximoNaGuia(guias, i, c.codigo);
              const limite = textoDoLimite(c.codigo);
              const marcada = q > 0;
              const proposta = propostaDa(i, c.codigo);
              return (
                <li key={c.codigo} className={cn('flex items-center gap-2 px-2.5 py-2', marcada && 'bg-primary/5')}>
                  <label className="-m-2 flex shrink-0 cursor-pointer items-center justify-center p-2">
                    <Checkbox
                      checked={marcada}
                      disabled={salvando || (!marcada && max === 0)}
                      aria-label={`Marcar o código ${c.codigo} na guia ${i + 1}`}
                      onCheckedChange={(valor) => { if (valor === true) marcar(i, c.codigo); else desmarcar(i, c.codigo, q); }}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-tight">
                      <span className="font-bold tabular-nums">{c.codigo}</span>
                      <span className="text-muted-foreground"> · {c.descricao || 'sem descrição'}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                      {formatarCodigoOficial(c.codigo_oficial, c.codigo)} ·{' '}
                      {c.valor > 0 ? brl(c.valor) : <span className="text-amber-700 dark:text-amber-400">sem valor (defina em Configurações)</span>}
                      {limite ? ` · ${limite}` : ''}
                    </p>
                    {q > max && <p className="text-[10px] font-semibold text-rose-600 dark:text-rose-400">acima do limite da CASSI</p>}
                    {q > 0 && q === max && <p className="text-[10px] text-amber-700 dark:text-amber-400">no limite</p>}
                    {max === 0 && q === 0 && <p className="text-[10px] text-amber-700 dark:text-amber-400">limite do mês já usado nas outras guias</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={salvando || q <= 0}
                      aria-label={`Diminuir o código ${c.codigo} da guia ${i + 1}`} onClick={() => definir(i, c.codigo, q - 1)}>
                      <Minus className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={marcada ? String(q) : ''}
                      placeholder={proposta > 0 ? String(proposta) : '0'}
                      aria-label={`Quantidade do código ${c.codigo} na guia ${i + 1}`}
                      aria-describedby={marcada ? undefined : `${idBase}-${i}-${c.codigo}`}
                      disabled={salvando}
                      onChange={(e) => definir(i, c.codigo, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
                      onFocus={(e) => e.currentTarget.select()}
                      className={cn(
                        'h-8 w-11 rounded-md border border-input bg-background text-center text-[16px] sm:text-sm tabular-nums placeholder:text-muted-foreground disabled:opacity-50',
                      )}
                    />
                    {!marcada && (
                      <span id={`${idBase}-${i}-${c.codigo}`} className="sr-only">
                        Não marcado, não conta. Ao marcar, a quantidade fica {proposta > 0 ? proposta : 1}.
                      </span>
                    )}
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={salvando || q >= max}
                      aria-label={`Aumentar o código ${c.codigo} da guia ${i + 1}`} onClick={() => (marcada ? definir(i, c.codigo, q + 1) : marcar(i, c.codigo))}>
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]"
          disabled={salvando || guias.length >= MAXIMO_GUIAS_NO_MES} onClick={() => {
            setGuias((atual) => [...atual, novaGuia()]);
            setLembradas((atual) => [...atual, {}]);
          }}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Outra guia
        </Button>
        {qtdDaAgenda > 0 && (
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 text-[12px]" disabled={salvando} title="Troca o que está digitado por 012 × as sessões da agenda"
            onClick={() => {
              if (guiasValidas.length > 0 && !soOModelo && !window.confirm(`Trocar o que está digitado por 012 × ${qtdDaAgenda} (as sessões da agenda)?`)) return;
              setGuias(daAgenda);
              setLembradas(daAgenda.map(() => ({})));
            }}>
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
            Usar 012 × {qtdDaAgenda} da agenda
          </Button>
        )}
      </div>

      {soOModelo && guiasValidas.length > 0 && (
        <p className="text-[12px] text-muted-foreground" role="note">
          Já vem marcado o modelo da guia ({resumoDosLancamentos(guiasValidas)}). Confira e ajuste antes de salvar.
        </p>
      )}

      {acimaDoLimite && (
        <p className="text-[12px] text-rose-600 dark:text-rose-400" role="alert">
          Há quantidade acima do limite da CASSI. Diminua o que está em vermelho para poder salvar.
        </p>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[13px] tabular-nums" aria-live="polite">
          <span className="text-muted-foreground">Total de {nome.split(' ')[0]}: </span>
          <b>{brl(total)}</b>
          <span className="text-muted-foreground"> · {sessoes} {sessoes === 1 ? 'sessão' : 'sessões'}</span>
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant="ghost" className="h-9" disabled={salvando}
            onClick={() => { if (alterado && !window.confirm('Descartar o que você digitou?')) return; onCancelar(); }}>Cancelar</Button>
          <Button type="button" size="sm" className="h-9" disabled={salvando || acimaDoLimite} onClick={() => onSalvar(guiasValidas)}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
        </div>
      </div>
    </div>
  );
}
