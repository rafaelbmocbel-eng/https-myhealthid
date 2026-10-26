import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { CalendarCheck, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BuscaDeCliente, type CandidatoBusca } from '@/components/cassi/BuscaDeCliente';
import { LancamentoDoCliente } from '@/components/cassi/LancamentoDoCliente';
import {
  brutoDosLancamentos, problemasDosLancamentos, resumoDosLancamentos, type CodigoFaturavel, type GuiaLancada,
} from '@/lib/cassiFaturamento';

const brl = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface ClienteDoMes {
  id: string;
  nome: string;
  // Sessões atendidas na agenda neste mês: só referência, não entram na conta.
  sessoesAgenda: number;
  // O que foi lançado para este cliente no mês (é daqui que sai o valor).
  guias: GuiaLancada[];
  encerrado?: boolean;
}

// Lista dos clientes do mês na aba Faturamento do Controle CASSI: o profissional adiciona o cliente e lança os códigos
// usados e a quantidade de cada um; o valor do mês sai disso.
export function ClientesDoMes({
  mesLabel, clientes, candidatos, comSessaoFora, catalogo, quantosPreencheriaComAgenda, ocupado = false, carregando = false,
  erro = false, sessoesEstado = 'ok', salvandoId = null, rascunhoAlterado,
  onAdicionar, onAdicionarComSessao, onRemover, onLimpar, onSalvarLancamento, onPreencherComAgenda,
}: {
  mesLabel: string; // ex.: "outubro de 2026"
  clientes: ClienteDoMes[];
  candidatos: CandidatoBusca[]; // quem ainda não está na lista
  comSessaoFora: number; // clientes com sessão atendida no mês que ainda não estão na lista
  catalogo: CodigoFaturavel[]; // códigos com valor, já na ordem de exibição
  quantosPreencheriaComAgenda: number; // clientes sem lançamento que têm sessão na agenda
  ocupado?: boolean;
  carregando?: boolean; // a lista do mês ainda está chegando: não dá para dizer que está vazia
  erro?: boolean; // não foi possível carregar a lista: quem mostra o aviso é a tela
  sessoesEstado?: 'ok' | 'carregando' | 'erro'; // a agenda é só referência, mas ainda assim não pode afirmar "sem sessão"
  salvandoId?: string | null;
  rascunhoAlterado?: MutableRefObject<boolean>; // quem está em volta (a tela do mês) também precisa saber se há algo digitado e não salvo
  onAdicionar: (id: string) => void;
  onAdicionarComSessao: () => void;
  onRemover: (id: string) => void;
  onLimpar: () => void;
  onSalvarLancamento: (id: string, guias: GuiaLancada[]) => Promise<boolean> | boolean;
  onPreencherComAgenda: () => void;
}) {
  const [abertoPedido, setAbertoId] = useState<string | null>(null);
  const interno = useRef(false);
  const abertoAlterado = rascunhoAlterado ?? interno; // o lançamento aberto tem algo digitado que ainda não foi salvo
  const [soFaltam, setSoFaltam] = useState(false);
  const valorDe = (c: string) => catalogo.find((x) => x.codigo === c)?.valor || 0;
  const faltam = clientes.filter((c) => c.guias.length === 0);
  // O cliente que saiu da lista não fica com o lançamento "aberto" (nem reabre sozinho se voltar).
  const abertoId = clientes.some((c) => c.id === abertoPedido) ? abertoPedido : null;
  useEffect(() => { if (abertoPedido !== null && abertoId === null) setAbertoId(null); }, [abertoPedido, abertoId]);
  // O filtro só vale enquanto há quem falte: sem ninguém faltando a lista volta inteira (e o botão de voltar não some).
  const filtrando = soFaltam && faltam.length > 0;
  // O cliente com o lançamento aberto não some com o filtro: o que está digitado nele não se perde sem aviso.
  const visiveis = filtrando ? clientes.filter((c) => c.guias.length === 0 || c.id === abertoId) : clientes;

  const referenciaAgenda = (c: ClienteDoMes) => {
    if (sessoesEstado === 'carregando') return 'agenda: carregando…';
    if (sessoesEstado === 'erro') return 'agenda indisponível';
    if (c.sessoesAgenda > 0) return `agenda: ${c.sessoesAgenda} ${c.sessoesAgenda === 1 ? 'sessão' : 'sessões'}`;
    return 'agenda: sem sessão atendida';
  };

  return (
    <section className="rounded-xl border border-border/50 bg-background p-3 space-y-2.5" aria-label={`Clientes de ${mesLabel}`}>
      <div>
        <h2 className="text-sm font-bold">Clientes de {mesLabel}</h2>
        <p className="text-[12px] text-muted-foreground tabular-nums">
          {clientes.length} na lista{clientes.length > 0 ? ` · ${clientes.length - faltam.length} com códigos` : ''}
        </p>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Adicione os clientes do mês e, em cada um, lance os códigos usados e a quantidade de cada um. O valor do mês, as guias que fecham
        e o relatório consideram só estes clientes.
      </p>

      <BuscaDeCliente
        candidatos={candidatos}
        placeholder="Adicionar cliente (nome ou carteirinha)"
        rotulo="Adicionar cliente à lista do mês"
        onEscolher={onAdicionar}
        desabilitado={ocupado}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px]" disabled={ocupado || comSessaoFora === 0} onClick={onAdicionarComSessao}>
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
          Adicionar quem teve sessão no mês{comSessaoFora > 0 ? ` (${comSessaoFora})` : ''}
        </Button>
        {clientes.length > 0 && (
          <button type="button" disabled={ocupado} onClick={onLimpar}
            className="ml-auto text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50">
            Limpar lista
          </button>
        )}
      </div>

      {faltam.length > 0 && !carregando && (
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 px-2.5 py-2 text-[12px]">
          <span className="text-amber-800 dark:text-amber-300">{faltam.length} {faltam.length === 1 ? 'cliente sem' : 'clientes sem'} códigos lançados.</span>
          <button type="button" onClick={() => setSoFaltam((v) => !v)} aria-pressed={filtrando} className="font-medium underline underline-offset-2 text-amber-900 dark:text-amber-200">
            {filtrando ? 'Mostrar todos' : 'Mostrar só quem falta'}
          </button>
          {quantosPreencheriaComAgenda > 0 && (
            <button type="button" disabled={ocupado || abertoId !== null} onClick={onPreencherComAgenda}
              title={abertoId !== null ? 'Feche o lançamento aberto antes de preencher com a agenda' : undefined}
              className="font-medium underline underline-offset-2 text-amber-900 dark:text-amber-200 disabled:opacity-50">
              Preencher {quantosPreencheriaComAgenda} com a agenda (código 012)
            </button>
          )}
        </div>
      )}

      {carregando ? (
        <p className="text-center text-[13px] text-muted-foreground py-4" role="status">Carregando a lista…</p>
      ) : clientes.length === 0 ? (
        erro ? null : (
          <p className="text-center text-[13px] text-muted-foreground py-4">
            Nenhum cliente na lista de {mesLabel}. Procure um cliente acima para começar.
          </p>
        )
      ) : (
        <ul className="divide-y divide-border/40 rounded-lg border border-border/50" aria-label="Clientes na lista do mês">
          {visiveis.map((c) => {
            const aberto = abertoId === c.id;
            const bruto = brutoDosLancamentos(c.guias, valorDe);
            const acimaDoLimite = problemasDosLancamentos(c.guias).length > 0;
            return (
              <li key={c.id}>
                <div className="flex items-center gap-1 pl-1 pr-1 py-1">
                  <button
                    type="button"
                    disabled={salvandoId != null}
                    onClick={() => {
                      // Trocar de cliente (ou fechar) joga fora o que foi digitado: pergunta antes.
                      // Enquanto grava não troca: se a gravação falhasse, o que foi digitado já teria ido embora.
                      if (abertoId !== null && abertoAlterado.current && !window.confirm('Descartar o que você digitou no lançamento aberto?')) return;
                      abertoAlterado.current = false;
                      setAbertoId(aberto ? null : c.id);
                    }}
                    aria-expanded={aberto}
                    aria-label={`${aberto ? 'Fechar' : 'Lançar códigos e sessões de'} ${c.nome}`}
                    aria-describedby={`resumo-lancamento-${c.id}`}
                    className="flex-1 min-w-0 flex items-center gap-2 px-2 py-1.5 text-left rounded-md hover:bg-muted/40 disabled:opacity-60"
                  >
                    <span className="flex-1 min-w-0" id={`resumo-lancamento-${c.id}`}>
                      <span className="flex items-center gap-1.5">
                        <span className="block text-sm font-medium truncate">{c.nome}</span>
                        {c.encerrado && <span className="text-[9px] uppercase font-bold text-muted-foreground bg-muted rounded px-1 shrink-0">encerrado</span>}
                      </span>
                      {c.guias.length > 0 ? (
                        <span className="block text-[11px] tabular-nums text-muted-foreground">
                          {resumoDosLancamentos(c.guias)} · <b className="text-foreground">{brl(bruto)}</b>
                          {acimaDoLimite && <span className="text-rose-600 dark:text-rose-400"> · acima do limite da CASSI</span>}
                          {bruto === 0 && <span className="text-amber-700 dark:text-amber-400"> · códigos sem valor (defina em Configurações)</span>}
                        </span>
                      ) : (
                        <span className="block text-[11px] text-amber-700 dark:text-amber-400">Sem códigos lançados</span>
                      )}
                      <span className="block text-[11px] text-muted-foreground">{referenciaAgenda(c)}</span>
                    </span>
                    <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', aberto && 'rotate-180')} aria-hidden />
                  </button>
                  <button type="button" disabled={ocupado} onClick={() => onRemover(c.id)} aria-label={`Tirar ${c.nome} da lista`} title="Tirar da lista"
                    className="p-2 text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
                {aberto && (
                  <LancamentoDoCliente
                    key={`${mesLabel}-${c.id}`}
                    nome={c.nome}
                    catalogo={catalogo}
                    inicial={c.guias}
                    sessoesAgenda={sessoesEstado === 'ok' ? c.sessoesAgenda : 0}
                    salvando={salvandoId === c.id}
                    onCancelar={() => setAbertoId(null)}
                    onAlterado={(alterado) => { abertoAlterado.current = alterado; }}
                    onSalvar={async (guias) => {
                      // Se a gravação demorou e outro cliente foi aberto nesse meio-tempo, o dele não fecha.
                      if (await onSalvarLancamento(c.id, guias)) setAbertoId((atual) => (atual === c.id ? null : atual));
                    }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
