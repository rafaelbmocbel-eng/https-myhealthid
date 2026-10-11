import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Clock, Loader2, Salad, Search, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CHAVE_CONFIG_PLANO_CLIENTE, usePlanoClienteConfig } from '@/hooks/usePlanoClienteConfig';
import {
  CHAVE_PROFISSIONAIS_ADMIN, FILTROS_PROFISSIONAIS, PRAZO_CHANCELA_MAX_DIAS, PRAZO_CHANCELA_MIN_DIAS,
  contarProfissionaisAdmin, existeNutricionistaNaEquipe, filtrarProfissionaisAdmin, mensagemErroAdmin,
  rotuloDiasUteis, validarPrazoChancela, type FiltroProfissionais,
} from '@/lib/chancela';
import { buscarProfissionaisAdmin, definirConfigPlanoCliente, type ChaveConfigPlanoCliente } from '@/lib/chancelaApi';
import { cn } from '@/lib/utils';
import ProfissionalAdminCard from './ProfissionalAdminCard';

// Aba "Administração" da fila de chancela. Só o super-admin chega aqui (o banco confere de novo
// dentro de cada RPC): verificação dos profissionais, equipe científica com áreas por membro e
// as duas configurações do plano do cliente (nutrição Premium e prazo de chancela).

function ConfigPlanoClienteCard({ semNutricionista }: { semNutricionista: boolean }) {
  const qc = useQueryClient();
  const { config, loading, falhou } = usePlanoClienteConfig();
  const [salvando, setSalvando] = useState<ChaveConfigPlanoCliente | null>(null);
  const [confirmandoLigar, setConfirmandoLigar] = useState(false);
  const [prazoTexto, setPrazoTexto] = useState(String(config.prazo_chancela_dias_uteis));
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setPrazoTexto(String(config.prazo_chancela_dias_uteis));
  }, [config.prazo_chancela_dias_uteis]);

  const aplicar = async (chave: ChaveConfigPlanoCliente, valor: boolean | number, sucesso: string): Promise<boolean> => {
    setSalvando(chave);
    setErro(null);
    try {
      await definirConfigPlanoCliente(chave, valor);
      toast.success(sucesso);
      await qc.invalidateQueries({ queryKey: CHAVE_CONFIG_PLANO_CLIENTE });
      return true;
    } catch (e) {
      setErro(mensagemErroAdmin(e));
      return false;
    } finally {
      setSalvando(null);
    }
  };

  const alternarNutricao = (ligar: boolean) => {
    if (ligar) {
      setConfirmandoLigar(true);
      return;
    }
    void aplicar('nutricao_premium_ativa', false, 'Plano nutricional Premium desligado.');
  };

  const confirmarLigar = async () => {
    const ok = await aplicar('nutricao_premium_ativa', true, 'Plano nutricional Premium ligado.');
    if (ok) setConfirmandoLigar(false);
  };

  const prazo = validarPrazoChancela(prazoTexto);
  const salvarPrazo = () => {
    if (prazo.valor === undefined) return;
    void aplicar('prazo_chancela_dias_uteis', prazo.valor, `Prazo de chancela: ${rotuloDiasUteis(prazo.valor)}.`);
  };
  const prazoMudou = prazo.ok && prazo.valor !== config.prazo_chancela_dias_uteis;
  const bloqueado = loading || falhou || salvando !== null;

  return (
    <section aria-label="Configuração do plano do cliente" className="rounded-xl border border-border/60 bg-card p-4 space-y-4">
      <div>
        <h2 className="text-sm font-bold">Configuração do plano do cliente</h2>
        <p className="text-xs text-muted-foreground">Vale para todos os clientes Premium.</p>
      </div>

      {falhou && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
          Não consegui ler a configuração atual, então os controles ficam travados para você não gravar às cegas. Recarregue a página.
        </p>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center gap-3">
          <Switch
            id="cfg-nutricao-premium"
            checked={config.nutricao_premium_ativa}
            disabled={bloqueado}
            onCheckedChange={alternarNutricao}
          />
          <Label htmlFor="cfg-nutricao-premium" className="text-sm font-semibold flex items-center gap-1.5">
            <Salad className="h-4 w-4 text-primary" aria-hidden /> Plano nutricional Premium
          </Label>
          {salvando === 'nutricao_premium_ativa' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Salvando" />}
        </div>
        <p className="text-xs text-muted-foreground">
          {config.nutricao_premium_ativa
            ? 'Ligado: clientes Premium podem gerar o plano alimentar. Ele entra na fila e só chega ao cliente depois da chancela de um nutricionista verificado da equipe, na área Nutrição.'
            : 'Desligado: clientes Premium veem "O plano nutricional Premium estará disponível em breve." e não conseguem gerar plano alimentar. Nenhum plano nutricional chega ao cliente, nem chancelado por você. Os planos que o profissional do paciente cria e libera não são afetados.'}
        </p>
        {config.nutricao_premium_ativa && semNutricionista && (
          <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
            Hoje nenhum nutricionista verificado está na equipe com a área Nutrição: os planos alimentares ficariam esperando a sua chancela.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="cfg-prazo" className="text-sm font-semibold flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-primary" aria-hidden /> Prazo para a equipe chancelar (dias úteis)
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="cfg-prazo"
            type="number"
            inputMode="numeric"
            min={PRAZO_CHANCELA_MIN_DIAS}
            max={PRAZO_CHANCELA_MAX_DIAS}
            value={prazoTexto}
            onChange={(e) => setPrazoTexto(e.target.value)}
            disabled={bloqueado}
            className="w-24"
          />
          <Button
            size="sm"
            className="gap-1.5"
            disabled={bloqueado || !prazoMudou}
            onClick={salvarPrazo}
          >
            {salvando === 'prazo_chancela_dias_uteis' && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar prazo
          </Button>
        </div>
        {!prazo.ok && <p className="text-[11px] text-amber-700 dark:text-amber-300">{prazo.erro}</p>}
        <p className="text-xs text-muted-foreground">
          Conta de segunda a sexta, sem feriados. Passado o prazo ({rotuloDiasUteis(config.prazo_chancela_dias_uteis)} hoje), o plano aparece como
          ATRASADO no topo da fila e o cliente pode cancelar o pedido ou pedir um novo plano.
        </p>
      </div>

      {erro && <p role="alert" className="text-xs text-red-700 dark:text-red-300">{erro}</p>}

      <Dialog open={confirmandoLigar} onOpenChange={(v) => { if (!v && salvando === null) setConfirmandoLigar(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ligar o plano nutricional Premium?</DialogTitle>
            <DialogDescription>
              Os clientes Premium passam a poder gerar o plano alimentar. Cada plano entra na fila de chancela e só chega ao cliente depois
              da revisão de um nutricionista verificado da equipe. Confirme que há quem chancele antes de ligar.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmandoLigar(false)} disabled={salvando !== null}>Cancelar</Button>
            <Button onClick={() => void confirmarLigar()} disabled={salvando !== null} className="gap-1.5">
              {salvando === 'nutricao_premium_ativa' && <Loader2 className="h-4 w-4 animate-spin" />}
              Ligar plano nutricional
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function AdministracaoChancela() {
  const lista = useQuery({
    queryKey: CHAVE_PROFISSIONAIS_ADMIN,
    staleTime: 15_000,
    retry: false,
    queryFn: buscarProfissionaisAdmin,
  });
  const [filtro, setFiltro] = useState<FiltroProfissionais | null>(null);
  const [busca, setBusca] = useState('');

  const profissionais = useMemo(() => lista.data ?? [], [lista.data]);
  const contagem = useMemo(() => contarProfissionaisAdmin(profissionais), [profissionais]);
  const filtroAtivo: FiltroProfissionais = filtro ?? (contagem.pendentes > 0 ? 'pendentes' : 'todos');
  const visiveis = useMemo(() => filtrarProfissionaisAdmin(profissionais, filtroAtivo, busca), [profissionais, filtroAtivo, busca]);

  return (
    <div className="space-y-5">
      <ConfigPlanoClienteCard semNutricionista={!!lista.data && !existeNutricionistaNaEquipe(profissionais)} />

      <section aria-label="Profissionais" className="space-y-3">
        <div>
          <h2 className="text-sm font-bold flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" aria-hidden /> Profissionais e equipe científica</h2>
          <p className="text-xs text-muted-foreground">
            Só você verifica um profissional, depois de conferir o registro no conselho. Profissional verificado pode gerar planos por IA
            para os próprios pacientes; para chancelar planos de clientes ele também precisa estar na equipe científica, com a área liberada.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filtrar profissionais" className="flex flex-wrap gap-1.5">
            {FILTROS_PROFISSIONAIS.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filtroAtivo === f.id}
                onClick={() => setFiltro(f.id)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  filtroAtivo === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground',
                )}
              >
                {f.rotulo} ({contagem[f.id]})
              </button>
            ))}
          </div>
          <div className="relative ml-auto w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, e-mail ou registro"
              aria-label="Buscar profissional"
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {lista.isLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando os profissionais…
          </div>
        )}
        {lista.isError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs dark:border-red-900 dark:bg-red-950/30">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-1">
              <p className="font-semibold">Não consegui carregar os profissionais.</p>
              <p className="text-muted-foreground">{mensagemErroAdmin(lista.error)}</p>
            </div>
          </div>
        )}
        {!lista.isLoading && !lista.isError && visiveis.length === 0 && (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Nenhum profissional nesta lista"
            description={busca ? 'Nenhum resultado para a busca.' : 'Troque o filtro para ver as outras pessoas.'}
            className="py-8"
          />
        )}
        {visiveis.length > 0 && (
          <ul className="space-y-2" aria-label="Lista de profissionais">
            {visiveis.map((p) => <ProfissionalAdminCard key={p.userId} p={p} />)}
          </ul>
        )}
      </section>
    </div>
  );
}
