import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ClipboardCheck, Loader2, ChevronUp } from 'lucide-react';
import { useNotasProntuario } from '@/hooks/useNotasProntuario';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  pacienteId: string;
  onSuccess?: () => void;
}

const EVOLUCAO_OPCOES = ['Melhora', 'Estável', 'Piora'] as const;

/**
 * Fechamento rápido de sessão: registra em 3 campos curtos o que foi feito hoje,
 * direto na tela de atendimento, sem precisar abrir a aba de Evolução/prontuário
 * para escrever uma nota SOAP completa.
 */
export default function FechamentoSessaoForm({ pacienteId, onSuccess }: Props) {
  const [aberto, setAberto] = useState(false);
  const [exerciciosFeitos, setExerciciosFeitos] = useState('');
  const [evolucaoDor, setEvolucaoDor] = useState<typeof EVOLUCAO_OPCOES[number] | ''>('');
  const [observacoes, setObservacoes] = useState('');
  const { adicionar, adicionando } = useNotasProntuario(pacienteId);

  const limpar = () => {
    setExerciciosFeitos('');
    setEvolucaoDor('');
    setObservacoes('');
  };

  const handleSalvar = async () => {
    if (!exerciciosFeitos.trim() && !evolucaoDor && !observacoes.trim()) {
      toast({ title: 'Preencha pelo menos um campo', variant: 'destructive' });
      return;
    }
    const descricao = [
      exerciciosFeitos.trim() && `Exercícios/condutas realizados: ${exerciciosFeitos.trim()}`,
      evolucaoDor && `Evolução da dor desde a última sessão: ${evolucaoDor}`,
      observacoes.trim() && `Observações: ${observacoes.trim()}`,
    ].filter(Boolean).join('\n');

    try {
      await adicionar({
        pacienteId,
        tipo: 'fechamento_sessao',
        titulo: `Fechamento de sessão — ${new Date().toLocaleDateString('pt-BR')}`,
        descricao,
        dadosExtras: { exercicios_feitos: exerciciosFeitos.trim(), evolucao_dor: evolucaoDor, observacoes: observacoes.trim() },
      });
      toast({ title: 'Sessão registrada! ✅' });
      limpar();
      setAberto(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  };

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={() => setAberto(true)}>
        <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
        Fechar sessão de hoje
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <button
        type="button"
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setAberto(false)}
      >
        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <ClipboardCheck className="h-4 w-4 text-primary shrink-0" />
          Fechamento de sessão
        </span>
        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      <div>
        <Label className="text-xs">Exercícios/condutas realizados hoje</Label>
        <Textarea
          value={exerciciosFeitos}
          onChange={e => setExerciciosFeitos(e.target.value)}
          rows={2}
          className="mt-1 text-xs"
          placeholder="ex.: alongamento cervical, TENS, mobilização escapular..."
        />
      </div>

      <div>
        <Label className="text-xs">Evolução da dor desde a última sessão</Label>
        <div className="flex gap-1.5 mt-1">
          {EVOLUCAO_OPCOES.map(op => (
            <button
              key={op}
              type="button"
              onClick={() => setEvolucaoDor(op === evolucaoDor ? '' : op)}
              className={cn(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                evolucaoDor === op
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted',
              )}
            >
              {op}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs">Observações</Label>
        <Textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          rows={2}
          className="mt-1 text-xs"
          placeholder="Algo a registrar para a próxima sessão..."
        />
      </div>

      <Button onClick={handleSalvar} disabled={adicionando} size="sm" className="w-full gap-2">
        {adicionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
        Salvar fechamento
      </Button>
    </div>
  );
}
