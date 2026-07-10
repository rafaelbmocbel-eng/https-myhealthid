import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageCircle, Loader2, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  /** Chamado quando a conexão é concluída, para o pai recarregar as credenciais. */
  onConectado?: () => void;
  jaConectado?: boolean;
}

/**
 * Conexão de WhatsApp em 1 clique: provisiona a instância na Z-API, aponta o
 * webhook e mostra o QR Code para a clínica escanear. Sem copiar credenciais.
 */
export default function ConectarWhatsappCard({ onConectado, jaConectado }: Props) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [provisionando, setProvisionando] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const pollRef = useRef<number | null>(null);

  const chamar = useCallback(async (action: 'provisionar' | 'qrcode' | 'status') => {
    const { data, error } = await supabase.functions.invoke('zapi-conectar', { body: { action } });
    if (error) throw new Error(data?.error || error.message);
    if (data?.error) throw new Error(data.error);
    return data as { ok?: boolean; qr?: string | null; connected?: boolean };
  }, []);

  const pararPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const iniciarPoll = useCallback(() => {
    pararPoll();
    pollRef.current = window.setInterval(async () => {
      try {
        const st = await chamar('status');
        if (st.connected) {
          setConnected(true);
          pararPoll();
          setTimeout(() => { setOpen(false); onConectado?.(); }, 1500);
          return;
        }
        // Renova o QR (expira periodicamente)
        const q = await chamar('qrcode');
        if (q.connected) { setConnected(true); pararPoll(); setTimeout(() => { setOpen(false); onConectado?.(); }, 1500); }
        else if (q.qr) setQr(q.qr);
      } catch { /* mantém tentando */ }
    }, 4000);
  }, [chamar, onConectado]);

  const conectar = async () => {
    setProvisionando(true);
    setConnected(false);
    setQr(null);
    try {
      await chamar('provisionar');
      setOpen(true);
      const q = await chamar('qrcode');
      if (q.connected) { setConnected(true); onConectado?.(); }
      else setQr(q.qr ?? null);
      iniciarPoll();
    } catch (e: any) {
      toast({ title: 'Não foi possível conectar', description: e.message, variant: 'destructive' });
    } finally {
      setProvisionando(false);
    }
  };

  useEffect(() => () => pararPoll(), []);

  return (
    <div className="clinical-card mb-4 sm:mb-5 border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-50/50 to-transparent dark:from-emerald-950/20">
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="h-4 w-4 text-emerald-600" />
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Conectar WhatsApp</h2>
        {jaConectado && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">CONECTADO</span>}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Conecte o WhatsApp da clínica em 1 clique — sem copiar credenciais nem configurar nada.
        Basta escanear o QR Code com o celular do consultório.
      </p>
      <Button onClick={conectar} disabled={provisionando} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
        {provisionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
        {jaConectado ? 'Reconectar WhatsApp' : 'Conectar WhatsApp'}
      </Button>

      <Dialog open={open} onOpenChange={(o) => { if (!o) pararPoll(); setOpen(o); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" /> Conectar WhatsApp
            </DialogTitle>
          </DialogHeader>
          {connected ? (
            <div className="flex flex-col items-center py-8 gap-3 text-center">
              <CheckCircle2 className="h-14 w-14 text-emerald-500" />
              <p className="font-bold">WhatsApp conectado! ✅</p>
              <p className="text-xs text-muted-foreground">Já pode enviar e receber mensagens pelo app.</p>
            </div>
          ) : (
            <div className="flex flex-col items-center py-4 gap-3 text-center">
              <ol className="text-[12px] text-muted-foreground text-left space-y-1 self-start mb-1">
                <li>1. Abra o WhatsApp no celular do consultório</li>
                <li>2. Toque em <b>Aparelhos conectados → Conectar aparelho</b></li>
                <li>3. Aponte a câmera para o código abaixo</li>
              </ol>
              {qr ? (
                <img src={qr} alt="QR Code do WhatsApp" className="w-56 h-56 rounded-xl border bg-white p-2" />
              ) : (
                <div className="w-56 h-56 rounded-xl border flex items-center justify-center bg-muted/30">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <RefreshCw className="h-3 w-3 animate-spin" /> Aguardando leitura… o código renova sozinho.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
