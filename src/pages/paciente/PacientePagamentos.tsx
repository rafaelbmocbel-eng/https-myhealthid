import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, QrCode, ExternalLink, Copy, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { gerarPixQrCodeDataUrl } from '@/utils/pixQrCode';
import { createSumUpCheckout } from '@/utils/sumupCheckout';
import ResumoFinanceiro from '@/components/pagamento/ResumoFinanceiro';
import HistoricoPagamentos from '@/components/pagamento/HistoricoPagamentos';
import UploadComprovante from '@/components/pagamento/UploadComprovante';

interface ServicoFunil {
  nome: string;
  descricao: string;
  valor: number;
  parcelas_max: number;
}

interface FunilConfig {
  pix_chave: string | null;
  pix_nome: string | null;
  pix_tipo: string | null;
  link_cartao: string | null;
  servicos: ServicoFunil[];
}

interface Pagamento {
  id: string;
  descricao: string;
  valor: number;
  forma_pagamento: string;
  status: string;
  created_at: string;
  comprovante_url?: string | null;
}

export default function PacientePagamentos() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [paciente, setPaciente] = useState<any>(null);
  const [config, setConfig] = useState<FunilConfig | null>(null);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedServico, setSelectedServico] = useState<ServicoFunil | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'cartao' | null>(null);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [generatingQr, setGeneratingQr] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastPaymentId, setLastPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  // Realtime: listen for payment status updates
  useEffect(() => {
    if (!paciente) return;
    const channel = supabase
      .channel('pagamentos-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pagamentos_paciente',
          filter: `paciente_id=eq.${paciente.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setPagamentos(prev =>
            prev.map(p => p.id === updated.id ? { ...p, ...updated } : p)
          );
          if (updated.status === 'confirmado') {
            toast({ title: 'Pagamento confirmado! ✅', description: `${updated.descricao} foi confirmado pelo profissional.` });
          } else if (updated.status === 'recusado') {
            toast({ title: 'Pagamento recusado ❌', description: `${updated.descricao} foi marcado como recusado.`, variant: 'destructive' });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [paciente]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('id, terapeuta_id, nome, sobrenome')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (!pac) return;
      setPaciente(pac);

      const { data: cfg } = await supabase
        .from('funil_config')
        .select('pix_chave, pix_nome, pix_tipo, link_cartao, servicos')
        .eq('terapeuta_id', pac.terapeuta_id)
        .maybeSingle();
      if (cfg) {
        setConfig({ ...cfg, servicos: (cfg.servicos as any) || [] });
      }

      const { data: pags } = await supabase
        .from('pagamentos_paciente')
        .select('id, descricao, valor, forma_pagamento, status, created_at, comprovante_url')
        .eq('paciente_id', pac.id)
        .order('created_at', { ascending: false });
      setPagamentos((pags as any[]) || []);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectServico = (servico: ServicoFunil) => {
    setSelectedServico(servico);
    setPaymentMethod(null);
    setPixQr(null);
    setLastPaymentId(null);
  };

  const handleSelectPix = async () => {
    if (!config?.pix_chave || !config?.pix_nome || !selectedServico) return;
    setPaymentMethod('pix');
    setGeneratingQr(true);
    try {
      const qr = await gerarPixQrCodeDataUrl({
        chave: config.pix_chave,
        nome: config.pix_nome,
        valor: selectedServico.valor,
        descricao: selectedServico.nome.substring(0, 25),
      });
      setPixQr(qr);
    } finally {
      setGeneratingQr(false);
    }
  };

  const [sumupLoading, setSumupLoading] = useState(false);
  const [sumupUrl, setSumupUrl] = useState<string | null>(null);

  const handleSelectCartao = () => {
    setPaymentMethod('cartao');
    setPixQr(null);
    // Use static link directly from funil_config
    setSumupUrl(config?.link_cartao || null);
  };

  const handleConfirmPayment = async () => {
    if (!paciente || !selectedServico || !paymentMethod) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('pagamentos_paciente').insert({
        paciente_id: paciente.id,
        terapeuta_id: paciente.terapeuta_id,
        descricao: selectedServico.nome,
        valor: selectedServico.valor,
        forma_pagamento: paymentMethod,
        status: 'pendente',
      }).select('id').single();
      if (error) throw error;
      setLastPaymentId(data.id);
      toast({ title: 'Pagamento registrado! ✅', description: 'Seu profissional será notificado para confirmar.' });
      loadData();
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyPixKey = () => {
    if (config?.pix_chave) {
      navigator.clipboard.writeText(config.pix_chave);
      toast({ title: 'Chave PIX copiada! 📋' });
    }
  };

  if (loading) {
    return (
      <ProtectedPatientRoute>
        <PacienteLayout>
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PacienteLayout>
      </ProtectedPatientRoute>
    );
  }

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-6">
          <h1 className="text-lg font-black text-foreground">Pagamentos</h1>

          {/* Financial summary */}
          {pagamentos.length > 0 && <ResumoFinanceiro pagamentos={pagamentos} />}

          {/* Service selection */}
          {!selectedServico && config?.servicos && config.servicos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Selecione o serviço</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {config.servicos.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectServico(s)}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{s.nome}</p>
                      {s.descricao && <p className="text-xs text-muted-foreground">{s.descricao}</p>}
                    </div>
                    <span className="text-sm font-bold text-primary">
                      R$ {s.valor.toFixed(2).replace('.', ',')}
                    </span>
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {!selectedServico && (!config?.servicos || config.servicos.length === 0) && (
            <Card>
              <CardContent className="p-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum serviço disponível para pagamento no momento.</p>
              </CardContent>
            </Card>
          )}

          {/* Payment method selection */}
          {selectedServico && !paymentMethod && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{selectedServico.nome}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedServico(null)}>Voltar</Button>
                </div>
                <p className="text-lg font-bold text-primary">R$ {selectedServico.valor.toFixed(2).replace('.', ',')}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">Escolha a forma de pagamento:</p>
                {config?.pix_chave && (
                  <button onClick={handleSelectPix} className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <QrCode className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">PIX</p>
                      <p className="text-xs text-muted-foreground">Pagamento instantâneo via QR Code</p>
                    </div>
                  </button>
                )}
                <button onClick={handleSelectCartao} className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-foreground">Cartão de Crédito</p>
                      <p className="text-xs text-muted-foreground">Pague com cartão via SumUp</p>
                    </div>
                  </button>
                {!config?.pix_chave && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhuma forma de pagamento configurada pelo profissional.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* PIX payment */}
          {selectedServico && paymentMethod === 'pix' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <QrCode className="h-4 w-4 text-emerald-600" /> Pagamento via PIX
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setPaymentMethod(null)}>Voltar</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-primary mb-3">
                    R$ {selectedServico.valor.toFixed(2).replace('.', ',')}
                  </p>
                  {generatingQr ? (
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                  ) : pixQr ? (
                    <img src={pixQr} alt="QR Code PIX" className="mx-auto rounded-lg" />
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 bg-muted rounded-lg text-xs font-mono truncate">{config?.pix_chave}</div>
                  <Button variant="outline" size="icon" onClick={copyPixKey}><Copy className="h-4 w-4" /></Button>
                </div>
                <p className="text-[10px] text-muted-foreground text-center">
                  Após pagar, clique em "Já paguei" para notificar seu profissional.
                </p>
                <Button onClick={handleConfirmPayment} disabled={submitting || !!lastPaymentId} className="w-full gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Já paguei
                </Button>
                {lastPaymentId && user && (
                  <UploadComprovante pagamentoId={lastPaymentId} userId={user.id} onUploaded={loadData} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Credit card payment */}
          {selectedServico && paymentMethod === 'cartao' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" /> Pagamento com Cartão
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setPaymentMethod(null)}>Voltar</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-primary mb-1">
                    R$ {selectedServico.valor.toFixed(2).replace('.', ',')}
                  </p>
                  {selectedServico.parcelas_max > 1 && (
                    <p className="text-xs text-muted-foreground">
                      ou até {selectedServico.parcelas_max}x de R$ {(selectedServico.valor / selectedServico.parcelas_max).toFixed(2).replace('.', ',')}
                    </p>
                  )}
                </div>
                {sumupLoading ? (
                  <Button disabled className="w-full gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Gerando link de pagamento...
                  </Button>
                ) : sumupUrl ? (
                  <Button asChild className="w-full gap-2">
                    <a href={sumupUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Pagar com Cartão
                    </a>
                  </Button>
                ) : (
                  <Button disabled className="w-full gap-2">
                    <CreditCard className="h-4 w-4" /> Link indisponível
                  </Button>
                )}
                <p className="text-[10px] text-muted-foreground text-center">
                  Você será redirecionado para a página de pagamento. Após concluir, volte e clique em "Já paguei".
                </p>
                <Button variant="outline" onClick={handleConfirmPayment} disabled={submitting || !!lastPaymentId} className="w-full gap-2">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Já paguei
                </Button>
                {lastPaymentId && user && (
                  <UploadComprovante pagamentoId={lastPaymentId} userId={user.id} onUploaded={loadData} />
                )}
              </CardContent>
            </Card>
          )}

          {/* Payment history with filters */}
          {user && (
            <HistoricoPagamentos
              pagamentos={pagamentos}
              userId={user.id}
              onRefresh={loadData}
            />
          )}
        </div>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
