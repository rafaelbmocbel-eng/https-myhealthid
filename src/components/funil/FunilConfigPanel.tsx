import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFunil, FunilConfig, ServicoFunil } from '@/hooks/useFunil';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, ExternalLink, Copy, Zap, Star, CreditCard, MessageSquare, Loader2 } from 'lucide-react';

const DEFAULT_CONFIG: Partial<FunilConfig> = {
  slug: '',
  ativo: true,
  mensagem_boas_vindas: 'Olá! Bem-vindo ao meu consultório online. Como posso te ajudar hoje?',
  mensagem_diferenciais: 'Conheça nossos diferenciais:',
  mensagem_servicos: 'Estes são os serviços que oferecemos:',
  mensagem_agendamento: 'Ótima escolha! Para agendarmos, vou precisar de alguns dados rápidos.',
  mensagem_pagamento: 'Como você prefere realizar o pagamento?',
  mensagem_confirmacao: 'Tudo pronto! Recebemos seu interesse e entraremos em contato em breve para confirmar seu horário. ✅',
  diferenciais: [],
  servicos: [],
  pix_tipo: 'cpf',
  pix_chave: '',
  pix_nome: '',
  link_cartao: '',
};

const FunilConfigPanel = () => {
  const { config, isLoading, saveConfig } = useFunil();
  const [form, setForm] = useState<Partial<FunilConfig>>(DEFAULT_CONFIG);
  const { toast } = useToast();

  useEffect(() => {
    if (config) {
      setForm(config);
    }
  }, [config]);

  const handleSave = () => {
    if (!form.slug?.trim()) {
      toast({ title: 'O slug é obrigatório', variant: 'destructive' });
      return;
    }
    saveConfig.mutate(form);
  };

  const addDiferencial = () => {
    setForm(prev => ({ ...prev, diferenciais: [...(prev.diferenciais || []), ''] }));
  };

  const updateDiferencial = (index: number, value: string) => {
    const newDifs = [...(form.diferenciais || [])];
    newDifs[index] = value;
    setForm(prev => ({ ...prev, diferenciais: newDifs }));
  };

  const removeDiferencial = (index: number) => {
    setForm(prev => ({ ...prev, diferenciais: (prev.diferenciais || []).filter((_, i) => i !== index) }));
  };

  const addServico = () => {
    const newService: ServicoFunil = { nome: '', descricao: '', valor: 0, parcelas_max: 1 };
    setForm(prev => ({ ...prev, servicos: [...(prev.servicos || []), newService] }));
  };

  const updateServico = (index: number, field: keyof ServicoFunil, value: any) => {
    const newServices = [...(form.servicos || [])];
    newServices[index] = { ...newServices[index], [field]: value };
    setForm(prev => ({ ...prev, servicos: newServices }));
  };

  const removeServico = (index: number) => {
    setForm(prev => ({ ...prev, servicos: (prev.servicos || []).filter((_, i) => i !== index) }));
  };

  const publicUrl = `${window.location.origin}/funil/${form.slug}`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(publicUrl);
    toast({ title: 'Link copiado! 📋' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Sticky save bar */}
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-background/95 backdrop-blur py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-accent shrink-0" />
          <span className="font-semibold text-sm">Funil</span>
          <Switch
            id="ativo"
            checked={form.ativo ?? true}
            onCheckedChange={(val) => setForm(prev => ({ ...prev, ativo: val }))}
          />
          <span className="text-xs font-medium">{form.ativo ? 'ATIVO' : 'INATIVO'}</span>
        </div>
        <Button onClick={handleSave} disabled={saveConfig.isPending} size="sm">
          {saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
          Salvar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Link Público</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Slug do Link (ex: dr-joao-silva)</Label>
            <div className="flex gap-2">
              <Input
                value={form.slug || ''}
                onChange={(e) => setForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                placeholder="seu-nome"
              />
              <Button variant="outline" size="icon" onClick={copyToClipboard} title="Copiar Link">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" asChild title="Ver Funil">
                <a href={publicUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground break-all">{publicUrl}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mensagens do Chatbot */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Mensagens do Chat
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Boas-vindas</Label>
              <Textarea
                value={form.mensagem_boas_vindas || ''}
                onChange={(e) => setForm(prev => ({ ...prev, mensagem_boas_vindas: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Apresentação Diferenciais</Label>
              <Input
                value={form.mensagem_diferenciais || ''}
                onChange={(e) => setForm(prev => ({ ...prev, mensagem_diferenciais: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Apresentação Serviços</Label>
              <Input
                value={form.mensagem_servicos || ''}
                onChange={(e) => setForm(prev => ({ ...prev, mensagem_servicos: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Coleta de Dados</Label>
              <Input
                value={form.mensagem_agendamento || ''}
                onChange={(e) => setForm(prev => ({ ...prev, mensagem_agendamento: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Input
                value={form.mensagem_pagamento || ''}
                onChange={(e) => setForm(prev => ({ ...prev, mensagem_pagamento: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmação Final</Label>
              <Textarea
                value={form.mensagem_confirmacao || ''}
                onChange={(e) => setForm(prev => ({ ...prev, mensagem_confirmacao: e.target.value }))}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {/* Diferenciais */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-accent" /> Seus Diferenciais
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={addDiferencial} className="h-8">
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {form.diferenciais?.map((dif, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={dif}
                    onChange={(e) => updateDiferencial(idx, e.target.value)}
                    placeholder="Ex: 10 anos de experiência"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeDiferencial(idx)} className="text-destructive h-10 w-10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {(!form.diferenciais || form.diferenciais.length === 0) && (
                <p className="text-xs text-muted-foreground italic">Nenhum diferencial adicionado.</p>
              )}
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Pagamento
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tipo de Chave PIX</Label>
                  <Select
                    value={form.pix_tipo}
                    onValueChange={(val) => setForm(prev => ({ ...prev, pix_tipo: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cpf">CPF</SelectItem>
                      <SelectItem value="cnpj">CNPJ</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="aleatoria">Chave Aleatória</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Chave PIX</Label>
                  <Input
                    value={form.pix_chave || ''}
                    onChange={(e) => setForm(prev => ({ ...prev, pix_chave: e.target.value }))}
                    placeholder="Sua chave"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nome do Favorecido (PIX)</Label>
                <Input
                  value={form.pix_nome || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, pix_nome: e.target.value }))}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>Link de Pagamento (Cartão)</Label>
                <Input
                  value={form.link_cartao || ''}
                  onChange={(e) => setForm(prev => ({ ...prev, link_cartao: e.target.value }))}
                  placeholder="https://pay.mercadopago.com/..."
                />
                <p className="text-[10px] text-muted-foreground">Ex: Mercado Pago, Stripe, PagSeguro, etc.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Serviços */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2">
            💼 Serviços e Valores
          </CardTitle>
          <Button variant="outline" size="sm" onClick={addServico} className="h-8">
            <Plus className="h-4 w-4 mr-1" /> Adicionar Serviço
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {form.servicos?.map((serv, idx) => (
              <div key={idx} className="p-4 border border-border rounded-lg bg-muted/30 relative group">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeServico(idx)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-destructive h-8 w-8"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome do Serviço</Label>
                    <Input
                      value={serv.nome}
                      onChange={(e) => updateServico(idx, 'nome', e.target.value)}
                      placeholder="Ex: Psicoterapia Individual"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição Curta</Label>
                    <Input
                      value={serv.descricao}
                      onChange={(e) => updateServico(idx, 'descricao', e.target.value)}
                      placeholder="Ex: Sessão semanal de 50min"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Valor (R$)</Label>
                      <Input
                        type="number"
                        value={serv.valor ?? 0}
                        onChange={(e) => updateServico(idx, 'valor', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Parcelas Máx</Label>
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={serv.parcelas_max}
                        onChange={(e) => updateServico(idx, 'parcelas_max', parseInt(e.target.value))}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {(!form.servicos || form.servicos.length === 0) && (
              <div className="col-span-full py-8 text-center border-2 border-dashed border-muted rounded-xl">
                <p className="text-sm text-muted-foreground italic">Nenhum serviço cadastrado.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FunilConfigPanel;
