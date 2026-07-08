import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import {
  Share2, Loader2, Copy, MessageCircle,
  CheckCircle2, AlertCircle, User2, Activity, FileText, Target,
} from 'lucide-react';
import { getBaseUrl } from '@/utils/linkUrls';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  pacienteTelefone?: string | null;
  terapeutaNome: string;
}

export default function CompartilharPacienteSheet({
  pacienteId, pacienteNome, pacienteTelefone, terapeutaNome,
}: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [incluirMyID, setIncluirMyID] = useState(true);
  const [incluirAvatar, setIncluirAvatar] = useState(true);
  const [incluirDiretriz, setIncluirDiretriz] = useState(false);
  const [exportando, setExportando] = useState(false);

  // ── MyID ────────────────────────────────────────────────────────────────────
  const { data: ultimaMyID } = useQuery({
    queryKey: ['ultima-myid-concluida', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('myid_avaliacoes')
        .select('id, token_acesso, resultado_processado, myid_score_parcial, updated_at')
        .eq('paciente_id', pacienteId)
        .eq('status', 'concluido')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const hasMyID = !!ultimaMyID?.resultado_processado;
  const myidUrl = ultimaMyID?.token_acesso
    ? `${getBaseUrl()}/myid/ver/${ultimaMyID.token_acesso}`
    : null;

  // ── Diretriz de Tratamento ──────────────────────────────────────────────────
  const { data: protocolo } = useQuery({
    queryKey: ['compartilhar-diretriz', pacienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolos')
        .select('*')
        .eq('paciente_id', pacienteId)
        .eq('status', 'ativo')
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return data?.[0] || null;
    },
    enabled: open,
  });

  const { data: fasesDiretriz = [] } = useQuery({
    queryKey: ['compartilhar-diretriz-fases', protocolo?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protocolo_fases' as any)
        .select('*')
        .eq('protocolo_id', protocolo!.id)
        .order('numero_fase');
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!protocolo?.id && open,
  });

  const hasDiretriz = !!protocolo;

  // ── Message builder ─────────────────────────────────────────────────────────
  function buildMessage(): string {
    const firstName = pacienteNome.split(' ')[0];
    const lines: string[] = [`Olá ${firstName}! 🩺`];

    if (incluirMyID && myidUrl) {
      lines.push('');
      lines.push('Sua Avaliação MyID está disponível:');
      if (incluirAvatar) lines.push('(inclui Avatar Clínico e todos os resultados)');
      lines.push(`🔗 ${myidUrl}`);
    }

    if (incluirDiretriz && protocolo) {
      lines.push('');
      lines.push(`📋 Diretriz de Tratamento: ${protocolo.nome || 'Protocolo ativo'}`);
      if (fasesDiretriz.length > 0) {
        fasesDiretriz.forEach((f: any) => {
          lines.push(`  • Fase ${f.numero_fase}: ${f.nome || f.descricao || '—'}`);
        });
      }
    }

    lines.push('');
    lines.push(`Att, ${terapeutaNome}`);
    return lines.join('\n');
  }

  // ── Actions ─────────────────────────────────────────────────────────────────
  async function handleWhatsApp() {
    const msg = buildMessage();
    const phone = pacienteTelefone?.replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      try {
        await navigator.clipboard.writeText(msg);
        toast({ title: 'Mensagem copiada!', description: 'Número não cadastrado — mensagem copiada.' });
      } catch {
        toast({ title: 'Número não cadastrado', variant: 'destructive' });
      }
    }
  }

  async function handleCopiarLink() {
    if (!myidUrl) {
      toast({ title: 'Sem avaliação MyID', description: 'Conclua um MyID primeiro.', variant: 'destructive' });
      return;
    }
    try {
      await navigator.clipboard.writeText(myidUrl);
      toast({ title: '🔗 Link copiado!' });
    } catch {
      toast({ title: myidUrl });
    }
  }

  async function handleBaixarPDF() {
    if (!ultimaMyID?.resultado_processado) {
      toast({ title: 'Sem MyID concluído', description: 'Conclua um MyID para gerar o PDF.', variant: 'destructive' });
      return;
    }
    setExportando(true);
    try {
      const r: any = ultimaMyID.resultado_processado;
      const { gerarPDFRespostaCompleta } = await import('@/utils/pdfRespostaCompleta');
      await gerarPDFRespostaCompleta({
        pacienteId,
        terapeutaNome,
        avaliacao: {
          pacienteNome,
          dataAvaliacao: format(parseISO(ultimaMyID.updated_at), 'dd/MM/yyyy'),
          resultado: {
            componentScores: r.componentScores || r.scores || {},
            myidScore: ultimaMyID.myid_score_parcial ?? r.myidScore ?? 0,
            classificacao: r.classificacao || r.classification || '—',
            ...r,
          },
        },
      });
      toast({ title: '📄 PDF baixado com sucesso!' });
    } catch (e: any) {
      toast({ title: 'Erro ao exportar', description: e.message, variant: 'destructive' });
    } finally {
      setExportando(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {/* Apenas ícone, sem texto */}
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 bg-background/80 backdrop-blur"
          title="Compartilhar"
        >
          <Share2 className="h-3.5 w-3.5 text-primary" />
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            Compartilhar
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{pacienteNome}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Status MyID */}
          <div className={cn(
            'flex items-center gap-3 rounded-xl border p-3',
            hasMyID
              ? 'border-sky-200/70 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20'
              : 'border-border bg-muted/30',
          )}>
            {hasMyID
              ? <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />
              : <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
            <div className="min-w-0">
              <p className="text-xs font-semibold">
                {hasMyID ? 'MyID disponível' : 'Sem avaliação MyID concluída'}
              </p>
              {ultimaMyID?.updated_at && (
                <p className="text-[10px] text-muted-foreground">
                  {format(parseISO(ultimaMyID.updated_at), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
          </div>

          {/* O que incluir */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que incluir</p>

            {/* Avaliação MyID */}
            <div className={cn('flex items-center justify-between rounded-lg border p-3', !hasMyID && 'opacity-40')}>
              <div className="flex items-center gap-2.5">
                <Activity className="h-4 w-4 text-sky-600 shrink-0" />
                <div>
                  <Label className="text-xs font-medium">Avaliação MyID</Label>
                  <p className="text-[10px] text-muted-foreground">Link de visualização dos resultados</p>
                </div>
              </div>
              <Switch checked={incluirMyID && hasMyID} onCheckedChange={setIncluirMyID} disabled={!hasMyID} />
            </div>

            {/* Avatar Clínico */}
            <div className={cn('flex items-center justify-between rounded-lg border p-3', (!hasMyID || !incluirMyID) && 'opacity-40')}>
              <div className="flex items-center gap-2.5">
                <User2 className="h-4 w-4 text-teal-600 shrink-0" />
                <div>
                  <Label className="text-xs font-medium">Avatar Clínico</Label>
                  <p className="text-[10px] text-muted-foreground">Incluído no link do MyID</p>
                </div>
              </div>
              <Switch
                checked={incluirAvatar && hasMyID && incluirMyID}
                onCheckedChange={setIncluirAvatar}
                disabled={!hasMyID || !incluirMyID}
              />
            </div>

            {/* Diretriz de Tratamento */}
            <div className={cn('flex items-center justify-between rounded-lg border p-3', !hasDiretriz && 'opacity-40')}>
              <div className="flex items-center gap-2.5">
                <Target className="h-4 w-4 text-violet-600 shrink-0" />
                <div>
                  <Label className="text-xs font-medium">Diretriz de Tratamento</Label>
                  <p className="text-[10px] text-muted-foreground">
                    {hasDiretriz
                      ? protocolo?.nome || `${fasesDiretriz.length} fase${fasesDiretriz.length !== 1 ? 's' : ''}`
                      : 'Nenhum protocolo ativo'}
                  </p>
                </div>
              </div>
              <Switch
                checked={incluirDiretriz && hasDiretriz}
                onCheckedChange={setIncluirDiretriz}
                disabled={!hasDiretriz}
              />
            </div>
          </div>

          {/* Ações */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enviar</p>

            <Button
              onClick={handleWhatsApp}
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1ebe59] text-white border-0"
            >
              <MessageCircle className="h-4 w-4" />
              {pacienteTelefone ? 'Enviar via WhatsApp' : 'Copiar mensagem'}
            </Button>

            {!pacienteTelefone && (
              <p className="text-[10px] text-muted-foreground text-center">
                Número não cadastrado — a mensagem será copiada
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={handleCopiarLink} disabled={!hasMyID} className="gap-1.5 text-xs">
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </Button>
              <Button variant="outline" size="sm" onClick={handleBaixarPDF} disabled={!hasMyID || exportando} className="gap-1.5 text-xs">
                {exportando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
                Baixar PDF
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
