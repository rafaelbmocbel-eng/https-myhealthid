import { useEffect, useState } from 'react';
import { Download, FileText, Loader2, MessageCircle, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { baixarBlob, ouvirPdfPronto, pacienteDaUrl, type PdfPronto } from '@/lib/pdf/entrega';

const soDigitos = (t: string) => t.replace(/\D/g, '');
// Número com DDI do Brasil quando vier só DDD + número.
const comDdi = (t: string) => { const d = soDigitos(t); return d.length >= 12 ? d : d.length >= 10 ? `55${d}` : d; };

// Janela única de "PDF pronto": enviar no WhatsApp do cliente (pela integração
// da clínica, como documento), compartilhar pelo celular ou baixar.
export default function PdfProntoDialog() {
  const [pdf, setPdf] = useState<PdfPronto | null>(null);
  const [cliente, setCliente] = useState<{ nome: string; telefone: string } | null>(null);
  const [telefone, setTelefone] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => ouvirPdfPronto((p) => {
    setPdf(p);
    setCliente(null);
    setTelefone(p.telefone || '');
    setMensagem(p.mensagem || '');
  }), []);

  // Dados do cliente: pelo id informado ou pela página aberta.
  useEffect(() => {
    if (!pdf) return;
    const id = pdf.pacienteId || pacienteDaUrl();
    if (!id) return;
    void (async () => {
      const { data } = await (supabase as any).from('pacientes').select('nome, sobrenome, telefone').eq('id', id).maybeSingle();
      if (!data) return;
      const nome = `${data.nome || ''} ${data.sobrenome || ''}`.trim();
      setCliente({ nome, telefone: data.telefone || '' });
      setTelefone((t) => t || data.telefone || '');
      const primeiro = (data.nome || '').split(' ')[0];
      if (!pdf.mensagem) setMensagem(`Olá${primeiro ? `, ${primeiro.charAt(0).toUpperCase()}${primeiro.slice(1).toLowerCase()}` : ''}! Segue o seu documento: ${pdf.titulo || pdf.nome.replace(/\.pdf$/i, '').replace(/_/g, ' ')}.`);
    })();
  }, [pdf]);

  const fechar = () => { if (!enviando) setPdf(null); };
  const podeCompartilhar = typeof navigator !== 'undefined' && !!(navigator as any).canShare && !!pdf && (navigator as any).canShare({ files: [new File([pdf.blob], pdf.nome, { type: 'application/pdf' })] });

  // Sobe o PDF para o armazenamento da clínica e devolve o link público que vai na conversa.
  const subirPdf = async (): Promise<string> => {
    if (!pdf) throw new Error('Sem PDF.');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Sessão expirada. Entre de novo.');
    const seguro = pdf.nome.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_');
    const path = `${user.id}/pdfs/${Date.now()}_${seguro}`;
    const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(path, pdf.blob, { upsert: false, contentType: 'application/pdf' });
    if (upErr) throw upErr;
    return supabase.storage.from('whatsapp-media').getPublicUrl(path).data.publicUrl;
  };

  // Caminho principal: abre a conversa do cliente no WhatsApp, já com a mensagem e o link do PDF.
  // A aba é aberta NO CLIQUE (antes de qualquer espera), senão o navegador bloqueia a janela.
  const abrirWhatsapp = async () => {
    if (!pdf) return;
    const fone = comDdi(telefone);
    if (fone.length < 12) { toast.error('Informe o WhatsApp do cliente com DDD.'); return; }
    const aba = window.open('', '_blank');
    setEnviando(true);
    try {
      const link = await subirPdf();
      const url = `https://wa.me/${fone}?text=${encodeURIComponent(`${mensagem}\n${link}`.trim())}`;
      if (aba) aba.location.href = url;
      else window.location.href = url;
      toast.success('WhatsApp aberto na conversa do cliente. É só tocar em enviar.');
      setPdf(null);
    } catch (e: any) {
      aba?.close();
      toast.error(e?.message || 'Não consegui preparar o PDF para o WhatsApp.');
    } finally {
      setEnviando(false);
    }
  };

  // Opcional: envio automático pela integração da clínica (Zap). Só confirma que o pedido foi aceito.
  const enviarPelaIntegracao = async () => {
    if (!pdf) return;
    const fone = comDdi(telefone);
    if (fone.length < 12) { toast.error('Informe o WhatsApp do cliente com DDD.'); return; }
    setEnviando(true);
    try {
      const link = await subirPdf();
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone: fone, mediaUrl: link, mediaType: 'document', fileName: pdf.nome, caption: mensagem || undefined },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message || 'Falha no envio');
      toast.success('Pedido aceito pela integração do WhatsApp. Confira na conversa do Zap se chegou.');
      setPdf(null);
    } catch (e: any) {
      toast.error(`${e?.message || 'Não consegui enviar pela integração.'} Use o botão “Abrir no WhatsApp do cliente”.`);
    } finally {
      setEnviando(false);
    }
  };

  const compartilhar = async () => {
    if (!pdf) return;
    const arquivo = new File([pdf.blob], pdf.nome, { type: 'application/pdf' });
    const nav = navigator as any;
    if (nav.canShare?.({ files: [arquivo] })) {
      try { await nav.share({ files: [arquivo], title: pdf.titulo || pdf.nome, text: mensagem || undefined }); setPdf(null); }
      catch (e: any) { if (e?.name !== 'AbortError') toast.error('Não consegui compartilhar.'); }
    } else {
      baixarBlob(pdf.blob, pdf.nome);
      toast.message('Este aparelho não compartilha arquivos — o PDF foi baixado.');
    }
  };

  return (
    <Dialog open={!!pdf} onOpenChange={(v) => { if (!v) fechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> PDF pronto</DialogTitle>
          <DialogDescription className="break-all">{pdf?.nome}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5"><MessageCircle className="h-4 w-4 text-emerald-600" /> WhatsApp {cliente ? `de ${cliente.nome}` : 'do cliente'}</p>
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp do cliente</Label>
              <Input inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 91234-5678" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem</Label>
              <Textarea rows={2} value={mensagem} onChange={(e) => setMensagem(e.target.value)} placeholder="Segue o seu documento." />
            </div>
            <Button className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={abrirWhatsapp} disabled={enviando}>
              {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Abrir no WhatsApp do cliente
            </Button>
            <p className="text-[11px] text-muted-foreground">Abre a conversa com a mensagem e o link do PDF. Você só toca em enviar.</p>
          </div>
          <div className={podeCompartilhar ? 'grid grid-cols-2 gap-2' : ''}>
            <Button variant="outline" className="w-full gap-1.5" onClick={() => { if (pdf) baixarBlob(pdf.blob, pdf.nome); setPdf(null); }} disabled={enviando}><Download className="h-4 w-4" /> Baixar o PDF</Button>
            {podeCompartilhar && <Button variant="outline" className="gap-1.5" onClick={compartilhar} disabled={enviando}><Share2 className="h-4 w-4" /> Compartilhar</Button>}
          </div>
          <details className="rounded-lg border border-border/60 p-2.5 text-xs">
            <summary className="cursor-pointer font-medium text-muted-foreground">Enviar automaticamente pela integração do Zap</summary>
            <p className="mt-2 text-muted-foreground">Só funciona se o WhatsApp da clínica estiver conectado. O app confirma que o pedido foi aceito; a entrega você confere na conversa do Zap.</p>
            <Button size="sm" variant="outline" className="mt-2 w-full gap-1.5" onClick={enviarPelaIntegracao} disabled={enviando}>Enviar pela integração</Button>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
