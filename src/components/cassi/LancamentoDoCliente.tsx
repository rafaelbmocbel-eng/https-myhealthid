import { useState } from 'react';
import { CalendarCheck, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  MAXIMO_GUIAS_NO_MES, brutoDosLancamentos, formatarCodigoOficial, guiasPelaAgenda, limiteDoCodigo, maximoNaGuia,
  normalizarLancamentos, problemasDosLancamentos, sessoesDosLancamentos, type CodigoFaturavel, type GuiaLancada,
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
export function LancamentoDoCliente({ nome, catalogo, inicial, sessoesAgenda, salvando = false, onSalvar, onCancelar }: {
  nome: string;
  catalogo: CodigoFaturavel[]; // já na ordem de exibição
  inicial: GuiaLancada[];
  sessoesAgenda: number; // referência: sessões atendidas na agenda neste mês
  salvando?: boolean;
  onSalvar: (guias: GuiaLancada[]) => void;
  onCancelar: () => void;
}) {
  const [guias, setGuias] = useState<GuiaLancada[]>(() => (inicial.length > 0 ? inicial.map((g) => ({ ...g })) : [{}]));

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

  const guiasValidas = normalizarLancamentos(guias);
  const total = brutoDosLancamentos(guiasValidas, valorDe);
  const sessoes = sessoesDosLancamentos(guiasValidas);
  const acimaDoLimite = problemasDosLancamentos(guiasValidas).length > 0;

  return (
    <div className="px-3 pb-3 pt-2 space-y-3 bg-muted/20 border-t border-border/40" role="group" aria-label={`Códigos e sessões de ${nome}`}>
      {guias.map((g, i) => (
        <section key={i} className="rounded-lg border border-border/60 bg-background" aria-label={`Guia ${i + 1} de ${nome}`}>
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/40">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Guia {i + 1}</p>
            {guias.length > 1 && (
              <button
                type="button"
                onClick={() => setGuias((atual) => atual.filter((_, k) => k !== i))}
                aria-label={`Tirar a guia ${i + 1}`}
                className="p-1 text-muted-foreground hover:text-destructive"
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
              return (
                <li key={c.codigo} className="flex items-center gap-2 px-2.5 py-2">
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
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={q <= 0}
                      aria-label={`Diminuir o código ${c.codigo} da guia ${i + 1}`} onClick={() => definir(i, c.codigo, q - 1)}>
                      <Minus className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={q > 0 ? String(q) : ''}
                      placeholder="0"
                      aria-label={`Quantidade do código ${c.codigo} na guia ${i + 1}`}
                      onChange={(e) => definir(i, c.codigo, parseInt(e.target.value.replace(/\D/g, ''), 10) || 0)}
                      onFocus={(e) => e.currentTarget.select()}
                      className="h-8 w-11 rounded-md border border-input bg-background text-center text-[16px] sm:text-sm tabular-nums"
                    />
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={q >= max}
                      aria-label={`Aumentar o código ${c.codigo} da guia ${i + 1}`} onClick={() => definir(i, c.codigo, q + 1)}>
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
          disabled={guias.length >= MAXIMO_GUIAS_NO_MES} onClick={() => setGuias((atual) => [...atual, {}])}>
          <Plus className="h-3.5 w-3.5" aria-hidden /> Outra guia
        </Button>
        {sessoesAgenda > 0 && (
          <Button type="button" size="sm" variant="ghost" className="h-8 gap-1.5 text-[12px]" title="Troca o que está digitado por 012 × as sessões da agenda"
            onClick={() => setGuias(guiasPelaAgenda(sessoesAgenda).length > 0 ? guiasPelaAgenda(sessoesAgenda) : [{}])}>
            <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
            {sessoesAgenda === 1 ? 'Usar a sessão da agenda' : `Usar as ${sessoesAgenda} sessões da agenda`}
          </Button>
        )}
      </div>

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
          <Button type="button" size="sm" variant="ghost" className="h-9" disabled={salvando} onClick={onCancelar}>Cancelar</Button>
          <Button type="button" size="sm" className="h-9" disabled={salvando || acimaDoLimite} onClick={() => onSalvar(guiasValidas)}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}
