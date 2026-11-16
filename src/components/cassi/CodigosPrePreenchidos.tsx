import { useId, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { MODELO_DA_GUIA, formatarCodigoOficial, limiteDoCodigo, ordenarParaLancamento, quantidadeParaMarcar, type CodigoFaturavel } from '@/lib/cassiFaturamento';
import {
  ConfiguracaoNaoSalva, escolhaDoModelo, escolhasIguais, limiteDaQuantidadePreenchida, modeloDaConfiguracao, type EscolhaDoModelo,
} from '@/lib/cassiModeloConfig';

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const textoDoLimite = (codigo: string) => {
  const { porGuia, porMes } = limiteDoCodigo(codigo);
  if (porMes != null) return `máx. ${porMes} no mês`;
  if (porGuia != null) return `máx. ${porGuia} por guia`;
  return '';
};

const resumoDaEscolha = (escolha: EscolhaDoModelo) => (escolha.length > 0 ? escolha.map((e) => `${e.codigo} × ${e.quantidade}`).join(' · ') : 'nenhum código marcado');

// Faixa da aba Faturamento com o que já vem marcado na guia nova e o botão para escolher. A escolha é do profissional e fica na
// configuração dele (cassi_config.codigos): vale para as guias novas; o que já foi lançado não muda.
export function CodigosPrePreenchidos({ catalogo, salva, indisponivel = false, onSalvar, onAbrirConfiguracoes }: {
  catalogo: CodigoFaturavel[]; // todos os códigos da lista (com a escolha atual de cada um, se houver)
  salva: boolean; // já existe configuração salva (sem ela não há onde guardar a escolha)
  indisponivel?: boolean; // a leitura da configuração falhou: não dá para escolher sem risco de gravar por cima
  onSalvar: (escolha: EscolhaDoModelo | null) => Promise<void>; // rejeita com a mensagem do que deu errado
  onAbrirConfiguracoes: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const atual = useMemo(() => escolhaDoModelo(modeloDaConfiguracao(catalogo)), [catalogo]);

  return (
    <section className="rounded-xl border border-border/50 bg-background p-3 flex flex-wrap items-center gap-x-3 gap-y-2" aria-label="Códigos pré-preenchidos">
      <div className="min-w-0 flex-1 basis-48">
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Já vem marcado na guia nova</p>
        <p className="text-[13px] font-medium tabular-nums">{resumoDaEscolha(atual)}</p>
        {indisponivel && (
          <p className="text-[12px] text-rose-600 dark:text-rose-400" role="status">Não consegui carregar suas configurações. Sem elas não dá para escolher os códigos.</p>
        )}
      </div>
      <Button type="button" variant="outline" className="h-11 gap-1.5 text-[13px]" disabled={indisponivel} onClick={() => setAberto(true)}>
        <ListChecks className="h-4 w-4" aria-hidden /> Códigos pré-preenchidos
      </Button>
      {aberto && (
        <EscolhaDeCodigos
          catalogo={catalogo}
          inicial={atual}
          salva={salva}
          onSalvar={onSalvar}
          onFechar={() => setAberto(false)}
          onAbrirConfiguracoes={() => { setAberto(false); onAbrirConfiguracoes(); }}
        />
      )}
    </section>
  );
}

function EscolhaDeCodigos({ catalogo, inicial, salva, onSalvar, onFechar, onAbrirConfiguracoes }: {
  catalogo: CodigoFaturavel[];
  inicial: EscolhaDoModelo;
  salva: boolean;
  onSalvar: (escolha: EscolhaDoModelo | null) => Promise<void>;
  onFechar: () => void;
  onAbrirConfiguracoes: () => void;
}) {
  const idBase = useId();
  const [escolha, setEscolha] = useState<EscolhaDoModelo>(() => inicial.map((e) => ({ ...e })));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [semConfiguracao, setSemConfiguracao] = useState(false);

  // Na ordem das linhas da guia (a do modelo que vale hoje, sem repetidos): os desmarcados ficam sempre nessa ordem.
  const unicos = useMemo(() => ordenarParaLancamento(catalogo, modeloDaConfiguracao(catalogo)), [catalogo]);
  const noCatalogo = (codigo: string) => unicos.some((c) => c.codigo === codigo);
  // Linhas: os marcados na ordem escolhida, depois os demais na ordem da lista.
  const marcados = escolha.filter((e) => noCatalogo(e.codigo)).map((e) => ({ c: unicos.find((c) => c.codigo === e.codigo)!, quantidade: e.quantidade }));
  const demais = unicos.filter((c) => !escolha.some((e) => e.codigo === c.codigo));
  const alterado = !escolhasIguais(escolha, inicial);
  const semSalvar = !salva || semConfiguracao;

  const marcar = (codigo: string) => setEscolha((atual) => [...atual, { codigo, quantidade: Math.min(quantidadeParaMarcar(codigo), limiteDaQuantidadePreenchida(codigo)) }]);
  const desmarcar = (codigo: string) => setEscolha((atual) => atual.filter((e) => e.codigo !== codigo));
  const definirQuantidade = (codigo: string, quantidade: number) => setEscolha((atual) => atual.map((e) => (e.codigo === codigo ? { ...e, quantidade } : e)));
  const mover = (codigo: string, passo: -1 | 1) => setEscolha((atual) => {
    const i = atual.findIndex((e) => e.codigo === codigo);
    const j = i + passo;
    if (i < 0 || j < 0 || j >= atual.length) return atual;
    const nova = [...atual];
    [nova[i], nova[j]] = [nova[j], nova[i]];
    return nova;
  });
  const voltarAoPadrao = () => setEscolha(escolhaDoModelo(MODELO_DA_GUIA).filter((e) => noCatalogo(e.codigo)).map((e) => ({ ...e })));

  const gravar = async () => {
    if (semSalvar) return;
    setErro(null);
    setSalvando(true);
    try {
      await onSalvar(escolha);
      onFechar();
    } catch (e) {
      if (e instanceof ConfiguracaoNaoSalva) setSemConfiguracao(true);
      else setErro((e as { message?: string })?.message || 'erro');
      setSalvando(false);
    }
  };

  return (
    // Durante a gravação o diálogo não fecha por Esc, clique fora ou no X: o que foi escolhido não se perde no meio.
    <Dialog open onOpenChange={(aberto) => { if (!aberto && !salvando) onFechar(); }}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[92vh] overflow-y-auto" aria-busy={salvando}>
        <DialogHeader>
          <DialogTitle className="text-base">Códigos pré-preenchidos</DialogTitle>
          <DialogDescription className="text-[12px]">
            Marque os códigos que já vêm marcados em cada guia nova, a quantidade e a ordem. Os outros ficam em "Outros códigos".
            O que já foi lançado não muda.
          </DialogDescription>
        </DialogHeader>

        {semSalvar && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 space-y-2 text-[12px] text-amber-800 dark:text-amber-300" role="alert">
            <p>Salve primeiro as Configurações CASSI. Sem elas não há onde guardar a sua escolha.</p>
            <Button type="button" size="sm" variant="outline" className="h-11" onClick={onAbrirConfiguracoes}>Abrir Configurações CASSI</Button>
          </div>
        )}

        <ul className="space-y-2" aria-label="Códigos da lista">
          {marcados.map(({ c, quantidade }, i) => (
            <li key={c.codigo} className="rounded-lg border border-primary/40 bg-primary/5 p-2 space-y-1.5">
              <LinhaDoCodigo c={c} marcado salvando={salvando} onMarcar={() => desmarcar(c.codigo)} />
              <div className="flex flex-wrap items-center gap-2 pl-1">
                <label className="flex items-center gap-1.5 text-[12px]" htmlFor={`${idBase}-qtd-${c.codigo}`}>
                  Quantidade
                  <select
                    id={`${idBase}-qtd-${c.codigo}`}
                    value={quantidade}
                    disabled={salvando}
                    aria-label={`Quantidade do código ${c.codigo}`}
                    onChange={(e) => definirQuantidade(c.codigo, Number(e.target.value))}
                    className="h-11 min-w-16 rounded-md border border-input bg-background px-2 text-[16px] sm:text-sm tabular-nums disabled:opacity-50"
                  >
                    {Array.from({ length: limiteDaQuantidadePreenchida(c.codigo) }, (_, k) => k + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <div className="ml-auto flex items-center gap-1">
                  <span className="text-[11px] text-muted-foreground tabular-nums">posição {i + 1} de {marcados.length}</span>
                  <Button type="button" size="icon" variant="outline" className="h-11 w-11" disabled={salvando || i === 0}
                    aria-label={`Subir o código ${c.codigo}`} onClick={() => mover(c.codigo, -1)}>
                    <ChevronUp className="h-4 w-4" aria-hidden />
                  </Button>
                  <Button type="button" size="icon" variant="outline" className="h-11 w-11" disabled={salvando || i === marcados.length - 1}
                    aria-label={`Descer o código ${c.codigo}`} onClick={() => mover(c.codigo, 1)}>
                    <ChevronDown className="h-4 w-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          ))}
          {demais.map((c) => (
            <li key={c.codigo} className="rounded-lg border border-border/60 p-2">
              <LinhaDoCodigo c={c} marcado={false} salvando={salvando} onMarcar={() => marcar(c.codigo)} />
            </li>
          ))}
        </ul>

        {erro && <p className="text-[12px] text-rose-600 dark:text-rose-400" role="alert">Não consegui salvar: {erro}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" className="h-11 text-[12px]" disabled={salvando} onClick={voltarAoPadrao}>Voltar ao padrão (144, 012 e 160)</Button>
          <div className="flex gap-2 sm:justify-end">
            <Button type="button" variant="ghost" className="h-11 flex-1 sm:flex-none" disabled={salvando} onClick={onFechar}>Cancelar</Button>
            <Button type="button" className="h-11 flex-1 sm:flex-none" disabled={salvando || semSalvar || !alterado} onClick={gravar}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LinhaDoCodigo({ c, marcado, salvando, onMarcar }: { c: CodigoFaturavel; marcado: boolean; salvando: boolean; onMarcar: () => void }) {
  const limite = textoDoLimite(c.codigo);
  return (
    <div className="flex items-start gap-1">
      <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 pr-1 text-[12px]">
        <span className="flex h-11 w-11 items-center justify-center">
          <Checkbox checked={marcado} disabled={salvando} aria-label={`Já vem marcado: código ${c.codigo}`} onCheckedChange={() => onMarcar()} />
        </span>
      </label>
      <div className={cn('min-w-0 flex-1 py-1')}>
        <p className="text-[13px] leading-tight">
          <span className="font-bold tabular-nums">{c.codigo}</span>
          <span className="text-muted-foreground"> · {c.descricao || 'sem descrição'}</span>
        </p>
        <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
          {formatarCodigoOficial(c.codigo_oficial, c.codigo)} · {c.valor > 0 ? brl(c.valor) : 'sem valor (defina em Configurações)'}{limite ? ` · ${limite}` : ''}
        </p>
      </div>
    </div>
  );
}
