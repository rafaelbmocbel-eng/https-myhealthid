import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Loader2, ChevronUp, Wand2 } from 'lucide-react';
import { useNotasProntuario } from '@/hooks/useNotasProntuario';
import { useLenteAtiva } from '@/hooks/useLenteAtiva';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface Props {
  pacienteId: string;
  onSuccess?: () => void;
}

const DOR_OPCOES = ['Melhora', 'Estável', 'Piora', 'Não informado'] as const;

interface Evolucao {
  subjetivo: string; objetivo: string; avaliacao: string; plano: string;
  evolucao_dor: string; resumo?: string;
}

/**
 * Assistente de Evolução (IA): o profissional descreve rapidamente a sessão de
 * hoje (digitando ou ditando pelo teclado) e a IA monta uma nota de evolução
 * SOAP usando o contexto clínico do paciente. O profissional revisa e salva.
 */
export default function AssistenteEvolucao({ pacienteId, onSuccess }: Props) {
  const [aberto, setAberto] = useState(false);
  const [relato, setRelato] = useState('');
  const [gerando, setGerando] = useState(false);
  const [ev, setEv] = useState<Evolucao | null>(null);
  const { adicionar, adicionando } = useNotasProntuario(pacienteId);
  const { data: lente } = useLenteAtiva();

  const upd = (patch: Partial<Evolucao>) => setEv((e) => e ? { ...e, ...patch } : e);

  const gerar = async () => {
    if (relato.trim().length < 10) {
      toast({ title: 'Descreva a sessão', description: 'Escreva pelo menos algumas palavras sobre o atendimento.', variant: 'destructive' });
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.functions.invoke('gerar-evolucao', {
        body: { paciente_id: pacienteId, transcript: relato.trim(), perfilProfissional: lente?.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setEv(data as Evolucao);
    } catch (err: any) {
      toast({ title: 'Não consegui gerar', description: err?.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  const salvar = async () => {
    if (!ev) return;
    const descricao = [
      ev.subjetivo && `S (subjetivo): ${ev.subjetivo}`,
      ev.objetivo && `O (objetivo): ${ev.objetivo}`,
      ev.avaliacao && `A (avaliação): ${ev.avaliacao}`,
      ev.plano && `P (plano): ${ev.plano}`,
      ev.evolucao_dor && ev.evolucao_dor !== 'Não informado' && `Evolução da dor: ${ev.evolucao_dor}`,
    ].filter(Boolean).join('\n');
    if (!descricao.trim()) { toast({ title: 'Evolução vazia', variant: 'destructive' }); return; }
    try {
      await adicionar({
        pacienteId,
        tipo: 'evolucao',
        titulo: `Evolução — ${new Date().toLocaleDateString('pt-BR')}`,
        descricao,
        dadosExtras: { ...ev, origem: 'assistente_ia', relato: relato.trim() },
      });
      toast({ title: 'Evolução salva! ✅' });
      setEv(null); setRelato(''); setAberto(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err?.message, variant: 'destructive' });
    }
  };

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full" onClick={() => setAberto(true)}>
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
        Evolução com IA
      </Button>
    );
  }

  const campo = (label: string, key: keyof Evolucao, rows = 2) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea value={(ev as any)?.[key] || ''} onChange={(e) => upd({ [key]: e.target.value } as any)} rows={rows} className="mt-1 text-xs" />
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-3">
      <button type="button" className="w-full flex items-center justify-between gap-2" onClick={() => setAberto(false)}>
        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-primary shrink-0" /> Evolução com IA
        </span>
        <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {!ev ? (
        <>
          <div>
            <Label className="text-xs">Descreva a sessão de hoje (digite ou dite pelo teclado)</Label>
            <Textarea
              value={relato}
              onChange={(e) => setRelato(e.target.value)}
              rows={4}
              className="mt-1 text-xs"
              placeholder="ex.: paciente relatou menos dor lombar, fizemos mobilização e fortalecimento de core, tolerou bem, orientei alongamento em casa..."
            />
          </div>
          <Button onClick={gerar} disabled={gerando} size="sm" className="w-full gap-2">
            {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {gerando ? 'Gerando evolução…' : 'Gerar evolução (IA)'}
          </Button>
        </>
      ) : (
        <>
          {ev.resumo && <p className="text-[11px] text-muted-foreground italic">{ev.resumo}</p>}
          {campo('S — Subjetivo', 'subjetivo')}
          {campo('O — Objetivo', 'objetivo')}
          {campo('A — Avaliação', 'avaliacao')}
          {campo('P — Plano', 'plano')}
          <div>
            <Label className="text-xs">Evolução da dor</Label>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              {DOR_OPCOES.map((op) => (
                <button key={op} type="button" onClick={() => upd({ evolucao_dor: op })}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${ev.evolucao_dor === op ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-muted'}`}>
                  {op}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground italic">Revise antes de salvar — a IA é apoio, não substitui seu julgamento clínico.</p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => setEv(null)} disabled={adicionando}>Refazer</Button>
            <Button size="sm" onClick={salvar} disabled={adicionando} className="gap-1.5">
              {adicionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Salvar evolução
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
