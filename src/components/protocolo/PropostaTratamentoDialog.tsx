import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Share2, FileDown, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  protocolo: any;            // row de protocolos
  pacienteId: string;
  pacienteNome: string;
}

function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
}

export default function PropostaTratamentoDialog({ open, onOpenChange, protocolo, pacienteId, pacienteNome }: Props) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [numeroSessoes, setNumeroSessoes] = useState<number>(12);
  const [frequencia, setFrequencia] = useState<string>('2x por semana');
  const [duracao, setDuracao] = useState<string>(protocolo?.duracao_total || '12 semanas');
  const [valorSessao, setValorSessao] = useState<number>(150);
  const [desconto, setDesconto] = useState<number>(0);
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX, cartão em até 6x sem juros');
  const [telefone, setTelefone] = useState<string>(profile?.telefone || '');
  const [mensagem, setMensagem] = useState<string>(
    `Olá ${pacienteNome.split(' ')[0]}! Preparei seu plano de tratamento personalizado com base na sua avaliação. Vamos começar?`
  );
  const [validadeDias, setValidadeDias] = useState<number>(7);

  const total = useMemo(() => {
    const bruto = numeroSessoes * valorSessao;
    return bruto * (1 - (desconto || 0) / 100);
  }, [numeroSessoes, valorSessao, desconto]);

  // Extrai fases do snapshot do protocolo
  const fases = useMemo(() => {
    const snap = protocolo?.scores_avaliacao?.diretriz_snapshot;
    const arr = Array.isArray(snap?.fases) ? snap.fases : [];
    return arr.slice(0, 3).map((f: any, i: number) => ({
      numero: f.numero ?? i + 1,
      titulo: f.titulo || `Fase ${i + 1}`,
      objetivo: f.objetivo || '',
      semanas: f.semanas_inicio && f.semanas_fim ? `${f.semanas_inicio}-${f.semanas_fim}` : undefined,
      focos: Array.isArray(f.demandasAlvo) ? f.demandasAlvo.slice(0, 4) : (Array.isArray(f.criteriosProgressao) ? f.criteriosProgressao.slice(0, 4) : []),
    }));
  }, [protocolo]);

  const handleGerar = async (modo: 'share' | 'download') => {
    setLoading(true);
    try {
      // Tenta puxar o resumo clínico da avaliação por voz vinculada
      let resumoClinico = protocolo?.descricao || '';
      let classificacao = protocolo?.scores_avaliacao?.classificacao || '';
      let queixa = protocolo?.scores_avaliacao?.queixa_principal || protocolo?.titulo?.replace(/^Diretriz\s*[—-]\s*/i, '') || '';
      let prognostico = protocolo?.scores_avaliacao?.prognostico || '';

      const { gerarPDFPropostaTratamento, downloadPDFBlob } = await import('@/utils/pdfPropostaTratamento');

      const blob = await gerarPDFPropostaTratamento({
        pacienteNome,
        profissionalNome: profile ? [profile.nome, (profile as any).sobrenome].filter(Boolean).join(' ') : undefined,
        profissionalRegistro: (profile as any)?.registro_profissional || (profile as any)?.registro || undefined,
        clinicaNome: (profile as any)?.nome_clinica || undefined,
        queixaPrincipal: queixa,
        classificacao,
        resumoClinico,
        prognostico,
        fases: fases.length ? fases : [
          { numero: 1, titulo: 'Alívio & Proteção', objetivo: 'Reduzir dor e estabilizar', semanas: '1-2', focos: ['Controle de sintomas', 'Educação em dor'] },
          { numero: 2, titulo: 'Carga Progressiva', objetivo: 'Reganhar força e mobilidade', semanas: '3-6', focos: ['Exercícios progressivos'] },
          { numero: 3, titulo: 'Retorno Funcional', objetivo: 'Voltar às atividades', semanas: '7-12', focos: ['Atividades específicas'] },
        ],
        pacote: { numeroSessoes, frequencia, duracao, valorSessao, desconto, formaPagamento },
        ctaTelefone: telefone || undefined,
        ctaMensagem: mensagem,
        validadeDias,
      });

      const filename = `Proposta_${pacienteNome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      const navAny = navigator as any;

      if (modo === 'share' && navAny.canShare && navAny.canShare({ files: [file] })) {
        try {
          await navAny.share({ files: [file], title: 'Proposta de Tratamento', text: mensagem });
        } catch (err: any) {
          if (err?.name !== 'AbortError') downloadPDFBlob(blob, filename);
        }
      } else {
        downloadPDFBlob(blob, filename);
        if (modo === 'share') {
          toast({ title: 'PDF baixado', description: 'Envie pelo WhatsApp ou e-mail.' });
        }
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('[PropostaTratamentoDialog]', err);
      toast({ title: 'Erro ao gerar proposta', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="icon-sm shrink-0" />
            </div>
            <div>
              <DialogTitle className="text-base">Proposta de Tratamento</DialogTitle>
              <DialogDescription className="text-xs">
                Transforme a diretriz num PDF de venda pronto para WhatsApp.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Nº de sessões</Label>
              <Input type="number" min={1} value={numeroSessoes} onChange={(e) => setNumeroSessoes(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Frequência</Label>
              <Input value={frequencia} onChange={(e) => setFrequencia(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Duração</Label>
              <Input value={duracao} onChange={(e) => setDuracao(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Valor por sessão (R$)</Label>
              <Input type="number" min={0} value={valorSessao} onChange={(e) => setValorSessao(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Desconto (%)</Label>
              <Input type="number" min={0} max={90} value={desconto} onChange={(e) => setDesconto(Number(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Validade (dias)</Label>
              <Input type="number" min={1} value={validadeDias} onChange={(e) => setValidadeDias(Number(e.target.value) || 7)} />
            </div>
          </div>

          <div>
            <Label className="text-xs">Forma de pagamento</Label>
            <Input value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">WhatsApp para contato</Label>
            <Input placeholder="(11) 9 9999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </div>

          <div>
            <Label className="text-xs">Mensagem na proposta</Label>
            <Textarea rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
          </div>

          <div className="rounded-xl border border-border/40 bg-muted/30 p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total da proposta</p>
              <p className="text-xl font-bold text-foreground">{brl(total)}</p>
              {desconto > 0 && (
                <p className="text-[11px] text-muted-foreground line-through">{brl(numeroSessoes * valorSessao)}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Por sessão</p>
              <p className="text-sm font-semibold text-foreground">{brl(total / Math.max(1, numeroSessoes))}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 mt-4">
          <Button variant="outline" onClick={() => handleGerar('download')} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="icon-sm animate-spin shrink-0" /> : <FileDown className="icon-sm shrink-0" />}
            Baixar PDF
          </Button>
          <Button onClick={() => handleGerar('share')} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="icon-sm animate-spin shrink-0" /> : <Share2 className="icon-sm shrink-0" />}
            Compartilhar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
