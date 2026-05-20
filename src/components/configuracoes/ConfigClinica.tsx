import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, MapPin, MessageCircle, Save, Loader2, CheckCircle2, AlertCircle, ShieldCheck, Image as ImageIcon, Upload, X } from 'lucide-react';

type ConfigClinica = {
  razao_social: string;
  cnpj: string;
  responsavel: string;
  registro_responsavel: string;
  telefone: string;
  email_clinica: string;
  endereco: string;
  cidade: string;
  uf: string;
  cep: string;
  horario_funcionamento: string;
  logo_url: string;
  zapi_instance_id: string;
  zapi_token: string;
  zapi_client_token: string;
  zapi_ativo: boolean;
};

const EMPTY: ConfigClinica = {
  razao_social: '', cnpj: '', responsavel: '', registro_responsavel: '',
  telefone: '', email_clinica: '', endereco: '', cidade: '', uf: '', cep: '',
  horario_funcionamento: '',
  logo_url: '',
  zapi_instance_id: '', zapi_token: '', zapi_client_token: '', zapi_ativo: false,
};

const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

export default function ConfigClinica() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<ConfigClinica>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'ok' | 'fail' | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const handleLogoUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'Logo muito grande', description: 'Máximo 2MB.', variant: 'destructive' });
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('clinica-assets').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('clinica-assets').getPublicUrl(path);
      update('logo_url', urlData.publicUrl);
      toast({ title: 'Logo enviado! Salve as configurações para confirmar.' });
    } catch (e: any) {
      toast({ title: 'Erro ao enviar logo', description: e.message, variant: 'destructive' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const removerLogo = () => update('logo_url', '');

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from('config_clinica').select('*').eq('terapeuta_id', user.id).maybeSingle();
      if (data) setForm({ ...EMPTY, ...data });
      setLoading(false);
    })();
  }, [user]);

  const update = <K extends keyof ConfigClinica>(k: K, v: ConfigClinica[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { ...form, terapeuta_id: user.id };
    const { error } = await supabase.from('config_clinica').upsert(payload, { onConflict: 'terapeuta_id' });
    setSaving(false);
    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast({ title: 'Configurações salvas! ✓' });
    }
  };

  const testarZapi = async () => {
    if (!form.zapi_instance_id || !form.zapi_token) {
      toast({ title: 'Preencha Instance ID e Token', variant: 'destructive' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { test: true, instanceId: form.zapi_instance_id, token: form.zapi_token, clientToken: form.zapi_client_token },
      });
      if (error || !data?.connected) throw new Error(data?.error || error?.message || 'Falha');
      setTestResult('ok');
      toast({ title: 'Conexão Z-API funcionando! ✅' });
    } catch (e: any) {
      setTestResult('fail');
      toast({ title: 'Falha na conexão', description: e.message, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="clinical-card mb-4 sm:mb-5 h-32 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <>
      {/* Identidade da clínica */}
      <div className="clinical-card mb-4 sm:mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Identidade da Clínica</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Aparece nos PDFs e documentos emitidos pelo sistema.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium mb-1.5 block">Razão social (opcional)</Label>
            <Input value={form.razao_social} onChange={e => update('razao_social', e.target.value)} placeholder="Ex: Movment Fisioterapia LTDA" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">CNPJ (opcional)</Label>
            <Input value={form.cnpj} onChange={e => update('cnpj', e.target.value)} placeholder="00.000.000/0000-00" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Responsável técnico</Label>
            <Input value={form.responsavel} onChange={e => update('responsavel', e.target.value)} placeholder="Ex: Dra. Maria Silva" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Registro profissional (CREFITO/CRM)</Label>
            <Input value={form.registro_responsavel} onChange={e => update('registro_responsavel', e.target.value)} placeholder="Ex: CREFITO-12/12345-F" />
            <p className="text-[11px] text-muted-foreground mt-1">Aparece na assinatura dos documentos emitidos.</p>
          </div>
        </div>
      </div>

      {/* Logo da clínica */}
      <div className="clinical-card mb-4 sm:mb-5">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon className="icon-sm text-primary shrink-0" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Logo da Clínica</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Usado em PDFs, recibos e portal do paciente. PNG/JPG até 2MB.</p>

        {form.logo_url ? (
          <div className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 border border-border/40">
            <img src={form.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded-lg bg-background border" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Logo enviado ✓</p>
              <p className="text-[11px] text-muted-foreground truncate">{form.logo_url.split('/').pop()}</p>
            </div>
            <div className="flex gap-1">
              <label className="cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
                <Button asChild size="sm" variant="outline" className="h-8"><span>Trocar</span></Button>
              </label>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={removerLogo}>
                <X className="icon-sm" />
              </Button>
            </div>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])} />
            <div className="border-2 border-dashed border-muted-foreground/20 rounded-xl p-6 text-center hover:border-primary/40 hover:bg-primary/5 transition-colors">
              {uploadingLogo ? (
                <Loader2 className="icon-md mx-auto animate-spin text-primary" />
              ) : (
                <>
                  <Upload className="icon-md mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Enviar logo</p>
                  <p className="text-xs text-muted-foreground mt-1">Clique para escolher um arquivo</p>
                </>
              )}
            </div>
          </label>
        )}
      </div>


      <div className="clinical-card mb-4 sm:mb-5">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-4 w-4 text-primary" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Contato e Localização</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Telefone / WhatsApp</Label>
            <Input value={form.telefone} onChange={e => update('telefone', e.target.value)} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">E-mail da clínica</Label>
            <Input type="email" value={form.email_clinica} onChange={e => update('email_clinica', e.target.value)} placeholder="contato@clinica.com.br" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium mb-1.5 block">Endereço</Label>
            <Input value={form.endereco} onChange={e => update('endereco', e.target.value)} placeholder="Rua, número, bairro" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Cidade</Label>
            <Input value={form.cidade} onChange={e => update('cidade', e.target.value)} placeholder="Ex: São Paulo" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">UF</Label>
              <Select value={form.uf} onValueChange={v => update('uf', v)}>
                <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UFS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">CEP</Label>
              <Input value={form.cep} onChange={e => update('cep', e.target.value)} placeholder="00000-000" />
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs font-medium mb-1.5 block">Horário de funcionamento</Label>
            <Input
              value={form.horario_funcionamento}
              onChange={e => update('horario_funcionamento', e.target.value)}
              placeholder="Ex: Seg–Sex 08h–19h · Sáb 08h–12h"
            />
            <p className="text-[11px] text-muted-foreground mt-1">Aparece no cabeçalho dos documentos emitidos.</p>
          </div>
        </div>
      </div>

      {/* WhatsApp próprio (Z-API) */}
      <div className="clinical-card mb-4 sm:mb-5 border-2 border-emerald-500/20">
        <div className="flex items-center gap-2 mb-2">
          <MessageCircle className="h-4 w-4 text-emerald-600" />
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">WhatsApp Próprio</h2>
          {form.zapi_ativo && <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-bold">ATIVO</span>}
        </div>
        <p className="text-xs text-muted-foreground mb-3">Mensagens automáticas saem do <strong>seu próprio número</strong> via Z-API.</p>
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-4 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Crie uma conta em <a href="https://z-api.io" target="_blank" rel="noopener noreferrer" className="underline font-medium">z-api.io</a>, conecte seu WhatsApp e cole as credenciais abaixo.</span>
        </div>

        <div className="space-y-3">
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Instance ID</Label>
            <Input value={form.zapi_instance_id} onChange={e => update('zapi_instance_id', e.target.value)} placeholder="Ex: 3F0FFAEB63ACB1CFC00036AB34E3996B" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Token</Label>
            <Input value={form.zapi_token} onChange={e => update('zapi_token', e.target.value)} placeholder="Ex: CD549AC35AC2C7C41DF9BA7D" />
          </div>
          <div>
            <Label className="text-xs font-medium mb-1.5 block">Client Token (Account Security Token)</Label>
            <Input value={form.zapi_client_token} onChange={e => update('zapi_client_token', e.target.value)} placeholder="Ex: Fab9619019bb94059a7c4156a0e26ef4cS" />
            <p className="text-[11px] text-muted-foreground mt-1">Encontrado em "Account → Security Token" no painel Z-API.</p>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <Label className="text-xs font-medium cursor-pointer">Ativar envio via WhatsApp próprio</Label>
            </div>
            <Switch checked={form.zapi_ativo} onCheckedChange={v => update('zapi_ativo', v)} />
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={testarZapi} disabled={testing} className="gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : testResult === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <MessageCircle className="h-4 w-4" />}
              Testar conexão
            </Button>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end mb-4 sm:mb-5">
        <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground gap-2 min-w-[200px]">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
          {saved ? 'Salvo!' : 'Salvar dados da clínica'}
        </Button>
      </div>
    </>
  );
}
