import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Loader2, Send, Square, TriangleAlert } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getPortalUrl } from '@/utils/linkUrls';

export interface DestinatarioPortal {
  id: string;
  nome: string;
  telefone: string;
  portal_token: string;
  enviadoEm: string | null;
}

const TAMANHOS = [20, 40, 80, 150];
const FALHAS_SEGUIDAS_PARA_PARAR = 3;

const mensagemPortal = (nome: string, url: string) =>
  `Olá ${nome}! Esse é o seu acesso ao Portal do Paciente:\n${url}\n\nÉ só abrir, criar sua senha e responder sua avaliação. 🙂`;

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const intervalo = () => 8000 + Math.random() * 4000;

// Envio do link do portal em LOTES pela conexão de WhatsApp da clínica. Um
// cliente por vez, com intervalo aleatório de 8–12 s (o WhatsApp bloqueia
// número que dispara muitas mensagens iguais de uma vez). Quem já recebeu fica
// marcado e não recebe de novo. A tela precisa ficar aberta durante o envio.
export default function EnviarPortalLoteDialog({ destinatarios, onFinalizado, onClose }: {
  destinatarios: DestinatarioPortal[];
  onFinalizado: () => void;
  onClose: () => void;
}) {
  const [tamanho, setTamanho] = useState(40);
  const [incluirJaEnviados, setIncluirJaEnviados] = useState(false);
  const [fase, setFase] = useState<'config' | 'enviando' | 'fim'>('config');
  const [feitos, setFeitos] = useState(0);
  const [total, setTotal] = useState(0);
  const [atual, setAtual] = useState('');
  const [falhas, setFalhas] = useState<string[]>([]);
  const [motivoParada, setMotivoParada] = useState<'usuario' | 'conexao' | null>(null);
  const parar = useRef(false);

  useEffect(() => () => { parar.current = true; }, []);

  const jaReceberam = destinatarios.filter((d) => d.enviadoEm).length;
  const elegiveis = useMemo(
    () => destinatarios.filter((d) => incluirJaEnviados || !d.enviadoEm),
    [destinatarios, incluirJaEnviados],
  );
  const fila = useMemo(() => elegiveis.slice(0, tamanho), [elegiveis, tamanho]);
  const minutos = Math.max(1, Math.round((fila.length * 10) / 60));

  const iniciar = async () => {
    if (!fila.length) return;
    parar.current = false;
    setFase('enviando');
    setFeitos(0);
    setFalhas([]);
    setMotivoParada(null);
    setTotal(fila.length);

    let wake: WakeLockSentinel | null = null;
    try { wake = (await navigator.wakeLock?.request('screen')) ?? null; } catch { /* sem wake lock: o envio segue, só a tela pode apagar */ }

    let ok = 0;
    let seguidas = 0;
    const erros: string[] = [];
    for (let i = 0; i < fila.length; i++) {
      if (parar.current) { setMotivoParada('usuario'); break; }
      const d = fila[i];
      setAtual(d.nome);
      const tel = d.telefone.replace(/\D/g, '');
      const phone = tel.length >= 12 ? tel : `55${tel}`;
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone, message: mensagemPortal(d.nome, getPortalUrl(d.portal_token)) },
      });
      const falhou = !!error || !!(data as { error?: string } | null)?.error;
      if (falhou) {
        erros.push(d.nome);
        seguidas++;
        setFalhas([...erros]);
        if (seguidas >= FALHAS_SEGUIDAS_PARA_PARAR) { setMotivoParada('conexao'); break; }
      } else {
        seguidas = 0;
        ok++;
        setFeitos(ok);
        await (supabase as unknown as { from: (t: string) => { update: (v: object) => { eq: (c: string, v: string) => Promise<unknown> } } })
          .from('pacientes').update({ portal_link_enviado_em: new Date().toISOString() }).eq('id', d.id);
      }
      if (i < fila.length - 1 && !parar.current) {
        const fim = Date.now() + intervalo();
        while (Date.now() < fim && !parar.current) await dormir(400);
      }
    }
    try { await wake?.release(); } catch { /* já liberado */ }
    setAtual('');
    setFase('fim');
    onFinalizado();
    if (ok > 0) toast.success(`${ok} link(s) enviado(s) pelo WhatsApp.`);
  };

  const fechar = () => { parar.current = true; onClose(); };
  const progresso = total ? Math.round(((feitos + falhas.length) / total) * 100) : 0;
  const primeiro = fila[0];

  return (
    <Dialog open onOpenChange={(o) => { if (!o) fechar(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send className="h-4 w-4" /> Enviar link do portal pelo WhatsApp</DialogTitle>
        </DialogHeader>

        {fase === 'config' && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <p><strong>{destinatarios.length}</strong> cliente(s) ainda não criaram conta e têm telefone.</p>
              {jaReceberam > 0 && <p className="text-xs text-muted-foreground">{jaReceberam} deles já receberam o link antes.</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Quantos enviar agora</Label>
              <Select value={String(tamanho)} onValueChange={(v) => setTamanho(Number(v))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAMANHOS.map((n) => (
                    <SelectItem key={n} value={String(n)}>{n} clientes{n === 40 ? ' (recomendado)' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {jaReceberam > 0 && (
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={incluirJaEnviados} onCheckedChange={(v) => setIncluirJaEnviados(v === true)} />
                Incluir também quem já recebeu o link
              </label>
            )}

            {primeiro && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Mensagem (exemplo)</p>
                <div className="rounded-xl rounded-tl-sm bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 p-3 text-xs whitespace-pre-wrap break-words">
                  {mensagemPortal(primeiro.nome, getPortalUrl(primeiro.portal_token))}
                </div>
              </div>
            )}

            <div className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 p-3 text-[11px] leading-snug text-amber-900 dark:text-amber-200">
              <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <p>
                Envia um por vez, a cada 8–12 segundos (~{minutos} min para {fila.length}). <strong>Mantenha esta tela aberta.</strong>{' '}
                O WhatsApp pode bloquear números que mandam muitas mensagens iguais de uma vez — por isso o lote. O ideal é um lote por dia.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={fechar}>Cancelar</Button>
              <Button disabled={!fila.length} onClick={iniciar} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
                <Send className="h-4 w-4" /> Enviar para {fila.length}
              </Button>
            </div>
          </div>
        )}

        {fase === 'enviando' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Progress value={progresso} />
              <p className="text-sm font-medium flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                Enviando para {atual || '…'}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {feitos} enviado(s) de {total}{falhas.length > 0 ? ` · ${falhas.length} com falha` : ''}
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground">Não feche nem saia desta tela até terminar.</p>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => { parar.current = true; }} className="gap-1.5">
                <Square className="h-3.5 w-3.5" /> Parar
              </Button>
            </div>
          </div>
        )}

        {fase === 'fim' && (
          <div className="space-y-4">
            <div className="flex items-start gap-2 text-sm">
              {feitos > 0
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                : <TriangleAlert className="h-5 w-5 text-destructive shrink-0" />}
              <div>
                <p className="font-semibold">{feitos} link(s) enviado(s)</p>
                {motivoParada === 'usuario' && <p className="text-xs text-muted-foreground">Você parou o envio. Quem ficou para trás pode receber no próximo lote.</p>}
              </div>
            </div>
            {motivoParada === 'conexao' && (
              <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <TriangleAlert className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p>O envio parou depois de {FALHAS_SEGUIDAS_PARA_PARAR} falhas seguidas. Confira se o WhatsApp da clínica está conectado (Zap → Configurações) e tente de novo — quem já recebeu não recebe outra vez.</p>
              </div>
            )}
            {falhas.length > 0 && (
              <div className="text-xs">
                <p className="font-semibold mb-1">Não foi possível enviar para:</p>
                <p className="text-muted-foreground">{falhas.join(', ')}</p>
              </div>
            )}
            <div className="flex justify-end">
              <Button onClick={onClose}>Concluir</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
