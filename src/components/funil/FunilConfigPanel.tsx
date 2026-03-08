import { useState, useEffect } from 'react';
import { useFunilConfig, FunilConfig, ServicoFunil } from '@/hooks/useFunilConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2, Plus, Trash2, Copy, ExternalLink, MessageCircle, CreditCard, Star, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_CONFIG: FunilConfig = {
  ativo: true,
  slug: '',
  mensagem_boas_vindas: 'Olá! 👋 Seja bem-vindo(a)! Como posso te ajudar hoje?',
  diferenciais: ['Atendimento personalizado', 'Método exclusivo baseado em evidências', 'Acompanhamento contínuo'],
  servicos: [{ nome: 'Avaliação Inicial', descricao: 'Avaliação completa com relatório', valor: 250, parcelas_max: 3 }],
  pix_chave: '',
  pix_tipo: 'cpf',
  pix_nome: '',
  link_cartao: '',
  mensagem_diferenciais: 'Conheça nossos diferenciais:',
  mensagem_servicos: 'Confira nossos serviços disponíveis:',
  mensagem_agendamento: 'Ótima escolha! Vamos agendar sua sessão? 📅',
  mensagem_pagamento: 'Para confirmar, escolha a forma de pagamento:',
  mensagem_confirmacao: 'Tudo certo! ✅ Seu agendamento foi confirmado. Enviaremos um lembrete antes da sessão.',
};

export default function FunilConfigPanel() {
  const { config, isLoading, saveConfig } = useFunilConfig();
  const [form, setForm] = useState<FunilConfig>(DEFAULT_CONFIG);
  const { toast } = useToast();

  useEffect(() => {
    if (config) setForm(config);
  }, [config]);

  const handleSave = () => {
    if (!form.slug?.trim()) {
      toast({ title: 'Defina um slug para o link do funil', variant: 'destructive' });
      return;
    }
    saveConfig.mutate(form);
  };

  const addDiferencial = () => setForm(prev => ({ ...prev, diferenciais: [...prev.diferenciais, ''] }));
  const removeDiferencial = (i: number) => setForm(prev => ({ ...prev, diferenciais: prev.diferenciais.filter((_, idx) => idx !== i) }));
  const updateDiferencial = (i: number, val: string) => setForm(prev => ({ ...prev, diferenciais: prev.diferenciais.map((d, idx) => idx === i ? val : d) }));

  const addServico = () => setForm(prev => ({ ...prev, servicos: [...prev.servicos, { nome: '', descricao: '', valor: 0, parcelas_max: 1 }] }));
  const removeServico = (i: number) => setForm(prev => ({ ...prev, servicos: prev.servicos.filter((_, idx) => idx !== i) }));
  const updateServico = (i: number, field: keyof ServicoFunil, val: any) => {
    setForm(prev => ({
      ...prev,
      servicos: prev.servicos.map((s, idx) => idx === i ? { ...s, [field]: val } : s),
    }));
  };

  const funilUrl = form.slug ? `${window.location.origin}/funil/${form.slug}` : '';

  const copyLink = () => {
    if (funilUrl) {
      navigator.clipboard.writeText(funilUrl);
      toast({ title: 'Link copiado! 📋' });
    }
  };

  if (isLoading) return <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header & Link */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            Funil de Atendimento Automatizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Label>Ativo</Label>
            <Switch checked={form.ativo} onCheckedChange={v => setForm(prev => ({ ...prev, ativo: v }))} />
          </div>

          <div>
            <Label>Slug do Link</Label>
            <div className="flex gap-2 mt-1">
              <div className="flex items-center bg-muted rounded-l-lg px-3 text-sm text-muted-foreground border border-r-0 border-input">
                /funil/
              </div>
              <Input
                value={form.slug || ''}
                onChange={e => setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="meu-consultorio"
                className="rounded-l-none"
              />
            </div>
          </div>

          {funilUrl && (
            <div className="flex items-center gap-2 p-3 bg-success/10 rounded-lg border border-success/20">
              <span className="text-sm text-foreground truncate flex-1">{funilUrl}</span>
              <Button variant="outline" size="sm" onClick={copyLink}><Copy className="h-3.5 w-3.5 mr-1" /> Copiar</Button>
              <Button variant="outline" size="sm" asChild>
                <a href={funilUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir</a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mensagens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Mensagens do Chatbot
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Boas-vindas</Label>
            <Textarea value={form.mensagem_boas_vindas} onChange={e => setForm(prev => ({ ...prev, mensagem_boas_vindas: e.target.value }))} rows={2} />
          </div>
          <div>
            <Label>Intro Diferenciais</Label>
            <Input value={form.mensagem_diferenciais || ''} onChange={e => setForm(prev => ({ ...prev, mensagem_diferenciais: e.target.value }))} />
          </div>
          <div>
            <Label>Intro Serviços</Label>
            <Input value={form.mensagem_servicos || ''} onChange={e => setForm(prev => ({ ...prev, mensagem_servicos: e.target.value }))} />
          </div>
          <div>
            <Label>Antes do Agendamento</Label>
            <Input value={form.mensagem_agendamento || ''} onChange={e => setForm(prev => ({ ...prev, mensagem_agendamento: e.target.value }))} />
          </div>
          <div>
            <Label>Pagamento</Label>
            <Input value={form.mensagem_pagamento || ''} onChange={e => setForm(prev => ({ ...prev, mensagem_pagamento: e.target.value }))} />
          </div>
          <div>
            <Label>Confirmação Final</Label>
            <Textarea value={form.mensagem_confirmacao || ''} onChange={e => setForm(prev => ({ ...prev, mensagem_confirmacao: e.target.value }))} rows={2} />
          </div>
        </CardContent>
      </Card>

      {/* Diferenciais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-accent" /> Diferenciais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {form.diferenciais.map((d, i) => (
            <div key={i} className="flex gap-2">
              <Input value={d} onChange={e => updateDiferencial(i, e.target.value)} placeholder="Ex: Atendimento personalizado" className="flex-1" />
              <Button variant="ghost" size="icon" onClick={() => removeDiferencial(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addDiferencial}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
        </CardContent>
      </Card>

      {/* Serviços */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            💼 Serviços e Valores
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {form.servicos.map((s, i) => (
            <div key={i} className="p-3 border border-border rounded-lg space-y-2 bg-muted/30">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Serviço {i + 1}</span>
                <Button variant="ghost" size="sm" onClick={() => removeServico(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
              <Input value={s.nome} onChange={e => updateServico(i, 'nome', e.target.value)} placeholder="Nome do serviço" />
              <Input value={s.descricao} onChange={e => updateServico(i, 'descricao', e.target.value)} placeholder="Descrição" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input type="number" value={s.valor} onChange={e => updateServico(i, 'valor', Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">Parcelas máx.</Label>
                  <Input type="number" value={s.parcelas_max} onChange={e => updateServico(i, 'parcelas_max', Number(e.target.value))} min={1} max={12} />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addServico}><Plus className="h-4 w-4 mr-1" /> Adicionar Serviço</Button>
        </CardContent>
      </Card>

      {/* Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo de Chave PIX</Label>
              <Select value={form.pix_tipo || 'cpf'} onValueChange={v => setForm(prev => ({ ...prev, pix_tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input value={form.pix_chave || ''} onChange={e => setForm(prev => ({ ...prev, pix_chave: e.target.value }))} placeholder="Sua chave PIX" />
            </div>
          </div>
          <div>
            <Label>Nome do Beneficiário (PIX)</Label>
            <Input value={form.pix_nome || ''} onChange={e => setForm(prev => ({ ...prev, pix_nome: e.target.value }))} placeholder="Nome que aparece no PIX" />
          </div>
          <Separator />
          <div>
            <Label>Link de Pagamento (Cartão/Parcelado)</Label>
            <Input value={form.link_cartao || ''} onChange={e => setForm(prev => ({ ...prev, link_cartao: e.target.value }))} placeholder="https://pay.mercadopago.com/..." />
            <p className="text-xs text-muted-foreground mt-1">Cole aqui o link do Mercado Pago, PagSeguro, ou qualquer plataforma de pagamento</p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saveConfig.isPending} className="gap-2">
          {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Funil
        </Button>
      </div>
    </div>
  );
}
