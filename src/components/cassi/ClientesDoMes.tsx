import { CalendarCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BuscaDeCliente, type CandidatoBusca } from '@/components/cassi/BuscaDeCliente';

export interface ClienteDoMes {
  id: string;
  nome: string;
  // Sessões atendidas na agenda neste mês (as que entram na conta).
  sessoes: number;
  encerrado?: boolean;
}

// Lista dos clientes que entram no cálculo financeiro do mês (aba Faturamento do Controle CASSI).
export function ClientesDoMes({ mesLabel, clientes, candidatos, comSessaoFora, ocupado = false, carregando = false, erro = false, sessoesEstado = 'ok', onAdicionar, onAdicionarComSessao, onRemover, onLimpar }: {
  mesLabel: string; // ex.: "outubro de 2026"
  clientes: ClienteDoMes[];
  candidatos: CandidatoBusca[]; // quem ainda não está na lista
  comSessaoFora: number; // clientes com sessão atendida no mês que ainda não estão na lista
  ocupado?: boolean;
  carregando?: boolean; // a lista do mês ainda está chegando: não dá para dizer que está vazia
  sessoesEstado?: 'ok' | 'carregando' | 'erro'; // as sessões vêm da agenda: enquanto não chegam, ninguém "não teve sessão"
  erro?: boolean; // não foi possível carregar a lista: quem mostra o aviso é a tela
  onAdicionar: (id: string) => void;
  onAdicionarComSessao: () => void;
  onRemover: (id: string) => void;
  onLimpar: () => void;
}) {
  return (
    <section className="rounded-xl border border-border/50 bg-background p-3 space-y-2.5" aria-label={`Clientes de ${mesLabel}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-bold">Clientes de {mesLabel}</h2>
        <span className="text-[12px] text-muted-foreground tabular-nums">{clientes.length} na lista</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Adicione quem entra na conta do mês. O cálculo, as guias que fecham e o relatório consideram só estes clientes.
      </p>

      <BuscaDeCliente
        candidatos={candidatos}
        placeholder="Adicionar cliente (nome ou carteirinha)"
        rotulo="Adicionar cliente à lista do mês"
        onEscolher={onAdicionar}
        desabilitado={ocupado}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-[12px]"
          disabled={ocupado || comSessaoFora === 0}
          onClick={onAdicionarComSessao}
        >
          <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
          Adicionar quem teve sessão no mês{comSessaoFora > 0 ? ` (${comSessaoFora})` : ''}
        </Button>
        {clientes.length > 0 && (
          <button
            type="button"
            disabled={ocupado}
            onClick={onLimpar}
            className="ml-auto text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline disabled:opacity-50"
          >
            Limpar lista
          </button>
        )}
      </div>

      {carregando ? (
        <p className="text-center text-[13px] text-muted-foreground py-4" role="status">Carregando a lista…</p>
      ) : clientes.length === 0 ? (
        erro ? null : (
          <p className="text-center text-[13px] text-muted-foreground py-4">
            Nenhum cliente na lista de {mesLabel}. Procure um cliente acima para começar o cálculo.
          </p>
        )
      ) : (
        <ul className="max-h-72 overflow-y-auto divide-y divide-border/40 rounded-lg border border-border/50" aria-label="Clientes na lista do mês">
          {clientes.map((c) => (
            <li key={c.id} className="flex items-center gap-2 pl-3 pr-1 py-1.5">
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{c.nome}</span>
                <span className="flex items-center gap-1.5 text-[11px] tabular-nums">
                  {c.encerrado && <span className="text-[9px] uppercase font-bold text-muted-foreground bg-muted rounded px-1">encerrado</span>}
                  {sessoesEstado === 'carregando' ? (
                    <span className="text-muted-foreground">carregando sessões…</span>
                  ) : sessoesEstado === 'erro' ? (
                    <span className="text-amber-700 dark:text-amber-400">sessões indisponíveis</span>
                  ) : c.sessoes > 0 ? (
                    <span className="text-muted-foreground">{c.sessoes} {c.sessoes === 1 ? 'sessão' : 'sessões'}</span>
                  ) : (
                    <span className="text-amber-700 dark:text-amber-400">sem sessão atendida</span>
                  )}
                </span>
              </span>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onRemover(c.id)}
                aria-label={`Tirar ${c.nome} da lista`}
                title="Tirar da lista"
                className="p-2 text-muted-foreground hover:text-destructive shrink-0 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
