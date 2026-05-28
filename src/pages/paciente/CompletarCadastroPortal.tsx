import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import LogoIcon from '@/components/LogoIcon';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';

const maskCEP = (v: string) => v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
const maskCPF = (v: string) => v.replace(/\D/g, '').slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
};

function CompletarCadastroPortalInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [terapeutaNome, setTerapeutaNome] = useState<string>('');

  const [form, setForm] = useState({
    nome: '', sobrenome: '', telefone: '',
    data_nascimento: '', genero: '', cpf: '',
    cep: '', endereco: '', endereco_numero: '', endereco_complemento: '',
    bairro: '', cidade: '', uf: '',
    queixa_principal: '', alergias: '', medicamentos_uso: '', condicoes_preexistentes: '',
    contato_emergencia_nome: '', contato_emergencia_telefone: '', contato_emergencia_parentesco: '',
    lgpd_aceite: false,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pac } = await supabase
        .from('pacientes')
        .select('nome, sobrenome, telefone, cadastro_status, terapeuta_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (pac) {
        if (pac.cadastro_status === 'completo') {
          navigate('/paciente/questionarios', { replace: true });
          return;
        }
        setForm(f => ({
          ...f,
          nome: pac.nome || '',
          sobrenome: pac.sobrenome || '',
          telefone: pac.telefone || '',
        }));
        const { data: prof } = await supabase
          .from('profiles')
          .select('nome, sobrenome')
          .eq('user_id', pac.terapeuta_id)
          .maybeSingle();
        if (prof) setTerapeutaNome(`${prof.nome || ''} ${prof.sobrenome || ''}`.trim());
      }
      setLoading(false);
    })();
  }, [user, navigate]);

  const buscarCEP = async (cep: string) => {
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const j = await r.json();
      if (!j.erro) {
        setForm(f => ({
          ...f,
          endereco: j.logradouro || f.endereco,
          bairro: j.bairro || f.bairro,
          cidade: j.localidade || f.cidade,
          uf: j.uf || f.uf,
        }));
      }
    } catch { /* silencioso */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lgpd_aceite) {
      return toast({ title: 'Aceite os termos LGPD para continuar', variant: 'destructive' });
    }
    if (form.telefone.replace(/\D/g, '').length < 10) {
      return toast({ title: 'Informe um telefone/WhatsApp válido', variant: 'destructive' });
    }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        cpf: form.cpf.replace(/\D/g, '') || null,
        cep: form.cep.replace(/\D/g, '') || null,
      };
      const { error } = await (supabase as any).rpc('salvar_cadastro_paciente_autenticado', {
        p_data: payload,
      });
      if (error) throw error;
      toast({ title: '✅ Cadastro concluído!', description: 'Agora vamos para sua avaliação MyID.' });
      navigate('/paciente/questionarios', { replace: true });
    } catch (e: any) {
      const msg = e?.message || '';
      let friendly = 'Não foi possível salvar. Tente novamente.';
      if (msg.includes('lgpd')) friendly = 'É obrigatório aceitar a LGPD.';
      else if (msg.includes('CPF inválido')) friendly = 'CPF inválido. Verifique os dígitos.';
      else if (msg.includes('paciente_nao_vinculado')) friendly = 'Sua conta ainda não está vinculada. Faça logout e entre novamente.';
      toast({ title: 'Erro', description: friendly, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background pb-12">
      <header className="px-4 py-5 border-b border-border/40 bg-card sticky top-0 z-10">
        <div className="max-w-xl mx-auto flex items-center gap-3">
          <LogoIcon size={36} />
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted-foreground">Bem-vindo(a) ao portal</div>
            <div className="text-sm font-bold text-foreground leading-tight truncate">
              {terapeutaNome || 'Complete seu cadastro'}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto p-4 sm:p-6">
        <div className="mb-5">
          <h1 className="text-lg sm:text-xl font-bold text-foreground">Olá, {form.nome}!</h1>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Antes de começar sua avaliação <strong>MyID</strong>, complete seus dados pessoais.
            Leva menos de 3 minutos e nos ajuda a oferecer um atendimento mais seguro e personalizado.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Dados pessoais</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome *</Label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required className="text-[16px] sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Sobrenome</Label>
                <Input value={form.sobrenome} onChange={e => setForm(f => ({ ...f, sobrenome: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">WhatsApp *</Label>
                <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: maskPhone(e.target.value) }))} required className="text-[16px] sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CPF</Label>
                <Input value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: maskCPF(e.target.value) }))} className="text-[16px] sm:text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Data de nascimento</Label>
                <Input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Gênero</Label>
                <Select value={form.genero} onValueChange={v => setForm(f => ({ ...f, genero: v }))}>
                  <SelectTrigger className="text-[16px] sm:text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feminino">Feminino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                    <SelectItem value="prefiro_nao_dizer">Prefiro não dizer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Endereço</h2>
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <Input
                value={form.cep}
                onChange={e => {
                  const masked = maskCEP(e.target.value);
                  setForm(f => ({ ...f, cep: masked }));
                  if (masked.replace(/\D/g, '').length === 8) buscarCEP(masked);
                }}
                placeholder="00000-000"
                className="text-[16px] sm:text-sm"
              />
            </div>
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Logradouro</Label>
                <Input value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nº</Label>
                <Input value={form.endereco_numero} onChange={e => setForm(f => ({ ...f, endereco_numero: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Complemento</Label>
              <Input value={form.endereco_complemento} onChange={e => setForm(f => ({ ...f, endereco_complemento: e.target.value }))} className="text-[16px] sm:text-sm" />
            </div>
            <div className="grid grid-cols-[1fr_1fr_60px] gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Bairro</Label>
                <Input value={form.bairro} onChange={e => setForm(f => ({ ...f, bairro: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Cidade</Label>
                <Input value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">UF</Label>
                <Input value={form.uf} maxLength={2} onChange={e => setForm(f => ({ ...f, uf: e.target.value.toUpperCase() }))} className="text-[16px] sm:text-sm" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Saúde</h2>
            <div className="space-y-1">
              <Label className="text-xs">Queixa principal</Label>
              <Textarea rows={2} value={form.queixa_principal} onChange={e => setForm(f => ({ ...f, queixa_principal: e.target.value }))} placeholder="Ex: dor lombar há 3 meses" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Alergias</Label>
              <Input value={form.alergias} onChange={e => setForm(f => ({ ...f, alergias: e.target.value }))} placeholder="Ex: AAS, frutos do mar..." className="text-[16px] sm:text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Medicamentos em uso</Label>
              <Input value={form.medicamentos_uso} onChange={e => setForm(f => ({ ...f, medicamentos_uso: e.target.value }))} className="text-[16px] sm:text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Condições pré-existentes</Label>
              <Input value={form.condicoes_preexistentes} onChange={e => setForm(f => ({ ...f, condicoes_preexistentes: e.target.value }))} placeholder="Ex: HAS, DM2..." className="text-[16px] sm:text-sm" />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Contato de emergência</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome</Label>
                <Input value={form.contato_emergencia_nome} onChange={e => setForm(f => ({ ...f, contato_emergencia_nome: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Parentesco</Label>
                <Input value={form.contato_emergencia_parentesco} onChange={e => setForm(f => ({ ...f, contato_emergencia_parentesco: e.target.value }))} className="text-[16px] sm:text-sm" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={form.contato_emergencia_telefone} onChange={e => setForm(f => ({ ...f, contato_emergencia_telefone: maskPhone(e.target.value) }))} className="text-[16px] sm:text-sm" />
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/20 p-3">
            <Checkbox
              id="lgpd"
              checked={form.lgpd_aceite}
              onCheckedChange={c => setForm(f => ({ ...f, lgpd_aceite: !!c }))}
            />
            <Label htmlFor="lgpd" className="text-[11px] leading-snug cursor-pointer text-foreground">
              Autorizo o tratamento dos meus dados pessoais e de saúde para fins clínicos e administrativos, conforme a LGPD.
            </Label>
          </div>

          <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={submitting || !form.lgpd_aceite}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (
              <span className="flex items-center gap-2">Concluir e iniciar MyID <ArrowRight className="h-4 w-4" /></span>
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center flex items-center justify-center gap-1">
            <ShieldCheck className="h-3 w-3" /> Dados criptografados · LGPD
          </p>
        </form>
      </main>
    </div>
  );
}

export default function CompletarCadastroPortal() {
  return (
    <ProtectedPatientRoute>
      <CompletarCadastroPortalInner />
    </ProtectedPatientRoute>
  );
}
