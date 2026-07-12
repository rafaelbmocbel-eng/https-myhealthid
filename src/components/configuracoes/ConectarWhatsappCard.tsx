import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MessageCircle, Loader2, CheckCircle2, QrCode, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ensureAutomacoesPadrao } from '@/lib/whatsappAutomacoesDefaults';

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
  const [diag, setDiag] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);

  const rodarDiagnostico = async () => {
    setDiagLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-diagnostico', { body: {} });
      setDiag(error ? { error: error.message } : data);
    } catch (e: any) {
      setDiag({ error: e.message });
    } finally {
      setDiagLoading(false);
      setDiagOpen(true);
    }
  };

  const chamar = useCallback(async (action: 'provisionar' | 'qrcode' | 'status') => {
    const { data, error } = await supabase.functions.invoke('zapi-conectar', { body: { action } });
    if (error) throw new Error(data?.error || error.message);
    if (data?.error) throw new Error(data.error);
    return data as { ok?: boolean; qr?: string | null; connected?: boolean };
  }, []);

  const pararPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  // Ao conectar, semeia a configuração padrão das automações (confirmação,
  // lembrete, pós-sessão já ligados) para o app funcionar "de cara".
  const finalizarConexao = useCallback(async () => {
    setConnected(true);
    pararPoll();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await ensureAutomacoesPadrao(user.id);
    } catch { /* semear é best-effort — não bloqueia a conexão */ }
    setTimeout(() => { setOpen(false); onConectado?.(); }, 1500);
  }, [onConectado]);

  const iniciarPoll = useCallback(() => {
    pararPoll();
    pollRef.current = window.setInterval(async () => {
      try {
        const st = await chamar('status');
        if (st.connected) {
          await finalizarConexao();
          return;
        }
        // Renova o QR (expira periodicamente)
        const q = await chamar('qrcode');
        if (q.connected) { await finalizarConexao(); }
        else if (q.qr) setQr(q.qr);
      } catch { /* mantém tentando */ }
    }, 4000);
  }, [chamar, finalizarConexao]);

  const conectar = async () => {
    setProvisionando(true);
    setConnected(false);
    setQr(null);
    try {
      await chamar('provisionar');
      setOpen(true);
      const q = await chamar('qrcode');
      if (q.connected) { await finalizarConexao(); }
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
      <div className="flex flex-wrap gap-2">
        <Button onClick={conectar} disabled={provisionando} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
          {provisionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
          {jaConectado ? 'Reconectar WhatsApp' : 'Conectar WhatsApp'}
        </Button>
        <Button variant="outline" onClick={rodarDiagnostico} disabled={diagLoading} className="gap-2">
          {diagLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Diagnóstico
        </Button>
      </div>

      {/* Resultado do diagnóstico */}
      <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" /> Diagnóstico do WhatsApp
            </DialogTitle>
          </DialogHeader>
          {!diag ? (
            <p className="text-xs text-muted-foreground py-6 text-center">Sem dados.</p>
          ) : diag.error ? (
            <p className="text-sm text-red-600 py-4">Erro: {diag.error}</p>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border p-2.5">
                  <div className="text-[10px] uppercase text-muted-foreground">Respostas recebidas</div>
                  <div className="text-2xl font-bold tabular-nums">{diag.db?.mensagens_entrada ?? '—'}</div>
                </div>
                <div className="rounded-lg border p-2.5">
                  <div className="text-[10px] uppercase text-muted-foreground">Enviadas pela clínica</div>
                  <div className="text-2xl font-bold tabular-nums">{diag.db?.mensagens_saida ?? '—'}</div>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Conectado na Z-API</span><b>{diag.zapi?.conectada ? '✅ Sim' : '❌ Não'}</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Webhook aponta pro app</span><b>{diag.zapi?.webhook_recebimento_aponta_pra_nos === true ? '✅ Sim' : diag.zapi?.webhook_recebimento_aponta_pra_nos === false ? '❌ Não' : '—'}</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Segredo do webhook</span><b>{diag.db?.webhook_secret_configurado ? 'Configurado' : 'Não (ok)'}</b></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Conversas ativas</span><b>{diag.db?.conversas_ativas ?? '—'}</b></div>
              </div>
              {Array.isArray(diag.problemas) && diag.problemas.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-2.5 space-y-1">
                  <div className="text-[11px] font-bold text-amber-700 uppercase">Possíveis problemas</div>
                  {diag.problemas.map((p: string, i: number) => (
                    <p key={i} className="text-xs text-amber-800 dark:text-amber-300">• {p}</p>
                  ))}
                </div>
              )}
              {Array.isArray(diag.problemas) && diag.problemas.length === 0 && (
                <p className="text-xs text-emerald-700">✅ Nenhum problema óbvio detectado.</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

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
