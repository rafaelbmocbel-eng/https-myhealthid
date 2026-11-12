import { useState } from 'react';
import { Gift, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { concederPremiumCliente, revogarPremiumCliente } from '@/hooks/useAdminMetrics';

const DIAS_MAXIMOS = 3650;

function lerDias(texto: string): { ok: true; dias?: number } | { ok: false } {
  const t = texto.trim();
  if (!t) return { ok: true };
  if (!/^\d+$/.test(t)) return { ok: false };
  const n = Number(t);
  if (n < 1 || n > DIAS_MAXIMOS) return { ok: false };
  return { ok: true, dias: n };
}

export default function PremiumClienteCard() {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [dias, setDias] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [confirmandoRetirada, setConfirmandoRetirada] = useState(false);

  const emailLimpo = email.trim();

  const dar = async () => {
    if (!emailLimpo) { toast({ title: 'Informe o e-mail do cliente', variant: 'destructive' }); return; }
    const prazo = lerDias(dias);
    if (!prazo.ok) { toast({ title: `Dias deve ser um número inteiro de 1 a ${DIAS_MAXIMOS}, ou ficar em branco`, variant: 'destructive' }); return; }
    setOcupado(true);
    try {
      const r = await concederPremiumCliente({ email: emailLimpo, dias: prazo.dias });
      if (r.ja_premium) {
        toast({ title: 'Essa conta já era Premium', description: 'Nada mudou.' });
      } else {
        toast({ title: 'Premium liberado 🎁', description: prazo.dias ? `${emailLimpo} · por ${prazo.dias} dias (a checagem de vencimento pode levar até 3 dias a mais)` : `${emailLimpo} · sem prazo` });
      }
      setEmail(''); setDias(''); setConfirmandoRetirada(false);
    } catch (e) {
      toast({ title: 'Não consegui liberar', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setOcupado(false);
    }
  };

  const tirar = async () => {
    if (!emailLimpo) { toast({ title: 'Informe o e-mail do cliente', variant: 'destructive' }); return; }
    setOcupado(true);
    try {
      await revogarPremiumCliente({ email: emailLimpo });
      toast({ title: 'Cortesia retirada', description: `${emailLimpo} voltou para a conta gratuita.` });
      setEmail(''); setDias('');
    } catch (e) {
      toast({ title: 'Não consegui retirar', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setOcupado(false);
      setConfirmandoRetirada(false);
    }
  };

  return (
    <Card data-testid="premium-cliente-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2"><Gift className="h-4 w-4 text-primary" /> Premium do cliente (cortesia)</CardTitle>
        <p className="text-[11px] text-muted-foreground mt-1">
          Dá o Premium, sem cobrança, a uma conta de <b>cliente do portal</b>. Não vale para paciente cadastrado por profissional, e a pessoa precisa já ter entrado no portal com esse e-mail.
          Assinatura paga nunca é alterada por aqui.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
          <div>
            <label htmlFor="premium-cliente-email" className="text-[10px] uppercase text-muted-foreground tracking-wide">E-mail do cliente</label>
            <Input id="premium-cliente-email" type="email" value={email}
              onChange={(e) => { setEmail(e.target.value); setConfirmandoRetirada(false); }}
              placeholder="cliente@email.com" className="h-9 text-sm" disabled={ocupado} />
          </div>
          <div>
            <label htmlFor="premium-cliente-dias" className="text-[10px] uppercase text-muted-foreground tracking-wide">Dias (opcional)</label>
            <Input id="premium-cliente-dias" type="text" inputMode="numeric" autoComplete="off" value={dias}
              onChange={(e) => setDias(e.target.value)} placeholder="sem prazo" className="h-9 text-sm w-full sm:w-28" disabled={ocupado} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button size="sm" className="h-9 gap-1.5" onClick={dar} disabled={ocupado}>
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Dar Premium
          </Button>
          {!confirmandoRetirada ? (
            <Button size="sm" variant="outline" className="h-9" onClick={() => setConfirmandoRetirada(true)} disabled={ocupado || !emailLimpo}>
              Tirar a cortesia
            </Button>
          ) : (
            <>
              <Button size="sm" variant="destructive" className="h-9" onClick={tirar} disabled={ocupado || !emailLimpo}>Confirmar: tirar o Premium</Button>
              <Button size="sm" variant="ghost" className="h-9" onClick={() => setConfirmandoRetirada(false)} disabled={ocupado}>Cancelar</Button>
            </>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">Sem "dias" = sem prazo. Com dias, o Premium acaba sozinho depois do prazo (a checagem de vencimento dá uma folga de 3 dias).</p>
      </CardContent>
    </Card>
  );
}
