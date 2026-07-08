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
  Share2, Download, Sparkles, Loader2, Copy, RefreshCw,
  MessageCircle, CheckCircle2, AlertCircle, User2, Activity, FileText,
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
  const [incluirResumo, setIncluirResumo] = useState(false);
  const [resumo, setResumo] = useState<string | null>(null);
  const [loadingResumo, setLoadingResumo] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [enviando, setEnviando] = useState(false);

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

  const score = ultimaMyID?.myid_score_parcial
    ?? (ultimaMyID?.resultado_processado as any)?.myidScore
    ?? null;

  async function gerarResumo() {
    setLoadingResumo(true);
    setResumo(null);
    try {
      const { data, error } = await supabase.functions.invoke('resumo-30s', {
        body: { pacienteId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResumo(data.resumo);
    } catch (e: any) {
      toast({ title: 'Erro ao gerar resumo', description: e.message, variant: 'destructive' });
      setIncluirResumo(false);
    } finally {
      setLoadingResumo(false);
    }
  }

  function handleToggleResumo(checked: boolean) {
    setIncluirResumo(checked);
    if (checked && !resumo) gerarResumo();
  }

  function buildMessage(): string {
    const lines: string[] = [`Olá ${pacienteNome.split(' ')[0]}! 🩺`];

    if (incluirMyID && myidUrl) {
      lines.push('');
      lines.push('Sua Avaliação MyID está disponível:');
      if (incluirAvatar) lines.push('(inclui seu Avatar Clínico e todos os resultados)');
      lines.push(`🔗 ${myidUrl}`);
    }

    if (incluirResumo && resumo) {
      lines.push('');
      lines.push('📋 Resumo clínico:');
      lines.push(resumo);
    }

    lines.push('');
    lines.push(`Att, ${terapeutaNome}`);

    return lines.join('\n');
  }

  async function handleWhatsApp() {
    if (incluirResumo && !resumo) {
      setEnviando(true);
      await gerarResumo();
      setEnviando(false);
    }
    const msg = buildMessage();
    const phone = pacienteTelefone?.replace(/\D/g, '');
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
    } else {
      try {
        await navigator.clipboard.writeText(msg);
        toast({ title: 'Mensagem copiada!', description: 'Número não cadastrado — mensagem copiada para a área de transferência.' });
      } catch {
        toast({ title: 'Número não cadastrado', description: 'Cadastre o telefone para enviar via WhatsApp.', variant: 'destructive' });
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
      toast({ title: '🔗 Link copiado!', description: 'Link de visualização copiado.' });
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

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 px-2 bg-background/80 backdrop-blur text-xs"
          title="Compartilhar"
        >
          <Share2 className="h-3.5 w-3.5 text-primary" />
          <span className="hidden sm:inline font-semibold">Compartilhar</span>
        </Button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4 text-primary" />
            Compartilhar
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{pacienteNome}</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Status do MyID */}
          <div className={cn(
            'flex items-center gap-3 rounded-xl border p-3',
            hasMyID
              ? 'border-sky-200/70 bg-sky-50/50 dark:border-sky-800/40 dark:bg-sky-950/20'
              : 'border-border bg-muted/30',
          )}>
            {hasMyID
              ? <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />
              : <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-xs font-semibold">
                {hasMyID
                  ? `MyID disponível ${score !== null ? `· Score ${score}` : ''}`
                  : 'Sem avaliação MyID concluída'}
              </p>
              {ultimaMyID?.updated_at && (
                <p className="text-[10px] text-muted-foreground">
                  {format(parseISO(ultimaMyID.updated_at), 'dd/MM/yyyy')}
                </p>
              )}
            </div>
          </div>

          {/* O que incluir */}
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">O que incluir</p>

            <div className={cn('flex items-center justify-between rounded-lg border p-3', !hasMyID && 'opacity-40')}>
              <div className="flex items-center gap-2.5">
                <Activity className="h-4 w-4 text-sky-600 shrink-0" />
                <div>
                  <Label className="text-xs font-medium cursor-pointer">Avaliação MyID</Label>
                  <p className="text-[10px] text-muted-foreground">Link de visualização dos resultados</p>
                </div>
              </div>
              <Switch
                checked={incluirMyID && hasMyID}
                onCheckedChange={setIncluirMyID}
                disabled={!hasMyID}
              />
            </div>

            <div className={cn('flex items-center justify-between rounded-lg border p-3', !hasMyID && 'opacity-40')}>
              <div className="flex items-center gap-2.5">
                <User2 className="h-4 w-4 text-teal-600 shrink-0" />
                <div>
                  <Label className="text-xs font-medium cursor-pointer">Avatar Clínico</Label>
                  <p className="text-[10px] text-muted-foreground">Incluído no link do MyID</p>
                </div>
              </div>
              <Switch
                checked={incluirAvatar && hasMyID && incluirMyID}
                onCheckedChange={setIncluirAvatar}
                disabled={!hasMyID || !incluirMyID}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <Label className="text-xs font-medium cursor-pointer">Resumo em 30s (IA)</Label>
                  <p className="text-[10px] text-muted-foreground">Breve explicação dos resultados</p>
                </div>
              </div>
              <Switch checked={incluirResumo} onCheckedChange={handleToggleResumo} />
            </div>

            {/* Resumo carregado */}
            {incluirResumo && (
              <div className="rounded-lg border bg-muted/30 p-3">
                {loadingResumo ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Gerando resumo clínico…
                  </div>
                ) : resumo ? (
                  <div className="space-y-2">
                    <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-foreground/80">{resumo}</p>
                    <button
                      onClick={gerarResumo}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      <RefreshCw className="h-3 w-3" /> Regenerar
                    </button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Ações */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Enviar</p>

            <Button
              onClick={handleWhatsApp}
              disabled={enviando || loadingResumo}
              className="w-full gap-2 bg-[#25D366] hover:bg-[#1ebe59] text-white border-0"
            >
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
              {pacienteTelefone ? 'Enviar via WhatsApp' : 'Copiar mensagem'}
            </Button>

            {!pacienteTelefone && (
              <p className="text-[10px] text-muted-foreground text-center">
                Número não cadastrado — a mensagem será copiada
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopiarLink}
                disabled={!hasMyID}
                className="gap-1.5 text-xs"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBaixarPDF}
                disabled={!hasMyID || exportando}
                className="gap-1.5 text-xs"
              >
                {exportando
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <FileText className="h-3.5 w-3.5" />
                }
                Baixar PDF
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
