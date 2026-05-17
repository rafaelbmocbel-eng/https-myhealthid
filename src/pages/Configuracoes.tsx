import { useState, useEffect } from 'react';
import NotificationPreferences from '@/components/NotificationPreferences';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAgenda, ConfigAgenda } from '@/hooks/useAgenda';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, CalendarDays, Clock, Save, Loader2, CheckCircle2, Users, Link2, Copy, ExternalLink, RefreshCw, Plus, ClipboardList, AlignCenter, Sparkles, LayoutGrid, PartyPopper, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { getAgendaUrl, getBaseUrl } from '@/utils/linkUrls';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServicosAtivos, ServicosAtivos } from '@/hooks/useServicosAtivos';
import EquipeManager from '@/components/equipe/EquipeManager';
import ThemeToggle from '@/components/ThemeToggle';
import AiCreditsBanner from '@/components/AiCreditsBanner';
import ControleMensal from '@/components/configuracoes/ControleMensal';
import ConfigClinica from '@/components/configuracoes/ConfigClinica';
import TurnosEditor from '@/components/configuracoes/TurnosEditor';
import AusenciasManager from '@/components/configuracoes/AusenciasManager';

const DIAS_LABEL: Record<string, string> = {
  seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo',
};

const DURACAO_OPTIONS = [30, 45, 50, 60, 90];

export default function Configuracoes() {
  const { user, loading: authLoading } = useAuth();
  const { config, saveConfig, loading } = useAgenda();
  const { servicos, saveServicos } = useServicosAtivos();
  const [form, setForm] = useState<ConfigAgenda>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setForm(config);
  }, [config]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const handleSave = async () => {
    setSaving(true);
    await saveConfig(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const updateDia = (dia: string, ativo: boolean) => {
    setForm(prev => ({
      ...prev,
      dias_semana: { ...prev.dias_semana, [dia]: ativo },
    }));
  };

  if (loading) return (
    <AppLayout>
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    </AppLayout>
  );

  return (
    <AppLayout>
      <div className="px-2 sm:px-0 py-4 sm:py-8 max-w-2xl mx-auto w-full">
        {/* Hero — clean & airy */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="eyebrow-accent mb-1.5">Ajustes</div>
              <h1 className="h-page">Configurações</h1>
              <p className="text-caption mt-1">Horários, módulos e preferências da clínica</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggle />
              <Button asChild variant="outline" size="sm" className="gap-2 rounded-xl h-10">
                <Link to="/agenda"><CalendarDays className="icon-sm" /> <span className="hidden sm:inline">Agenda</span></Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Status de créditos da IA */}
        <AiCreditsBanner />

        {/* Equipe / Profissionais */}
        <EquipeManager />

        {/* Dados da clínica + WhatsApp próprio */}
        <ConfigClinica />

        {/* Controle Mensal de Atendimentos e Repasse */}
        <ControleMensal />

        {/* Horários por dia (turnos múltiplos) */}
        <TurnosEditor form={form} onChange={setForm} />

        {/* Ausências, feriados e férias */}
        <AusenciasManager />

        <div className="clinical-card mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="icon-sm text-muted-foreground" />
            <h2 className="h-section">Intervalo entre Sessões</h2>
          </div>
          <div className="max-w-xs">
            <Label className="text-xs font-medium mb-1.5 block">Minutos de intervalo</Label>
            <Input
              type="number"
              min={0}
              max={60}
              value={form.intervalo_entre_sessoes}
              onChange={e => setForm(f => ({ ...f, intervalo_entre_sessoes: Number(e.target.value) }))}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Tempo livre automático entre cada sessão (0 = sem intervalo)</p>
          </div>
        </div>

        {/* Preferências de Notificação */}
        <div className="mb-6">
          <NotificationPreferences />
        </div>

        {/* Link de Agendamento Online (Geral) */}
        <div className="clinical-card mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="icon-sm text-muted-foreground" />
            <h2 className="h-section">Link de Agendamento Online</h2>
          </div>
          <p className="text-caption mb-4">
            Use este link geral para permitir que <strong>novos pacientes</strong> realizem o auto-agendamento.
          </p>

          <div className="mb-4">
            <Label className="text-xs font-medium mb-1.5 block">Slug personalizado (identificador único)</Label>
            <div className="flex gap-2">
              <Input
                placeholder="ex: dr-joao"
                value={form.slug || ''}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                className="flex-1"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Usado no link de cadastro de clientes: <strong>{getBaseUrl()}/cadastro/{form.slug || 'seu-slug'}</strong>
            </p>
          </div>

          <GeneralLinkSection />
        </div>

        {/* Link de Cadastro de Novo Cliente */}
        <ClientRegistrationLink />

        {/* Vagas por horário */}
        <div className="clinical-card mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Users className="icon-sm text-muted-foreground" />
            <h2 className="h-section">Vagas por Horário</h2>
          </div>
          <p className="text-caption mb-4">
            Quantos pacientes podem agendar no <strong>mesmo horário</strong> simultaneamente.
          </p>
          <div className="max-w-xs">
            <Label className="text-xs font-medium mb-1.5 block">Vagas simultâneas</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={form.vagas_por_horario || ''}
              onChange={e => {
                const raw = e.target.value;
                if (raw === '') { setForm(f => ({ ...f, vagas_por_horario: 0 })); return; }
                const num = parseInt(raw, 10);
                if (!isNaN(num)) setForm(f => ({ ...f, vagas_por_horario: Math.min(99, num) }));
              }}
              onBlur={() => setForm(f => ({ ...f, vagas_por_horario: Math.max(1, f.vagas_por_horario || 1) }))}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Padrão: 1 (atendimento individual)</p>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="gap-2 min-w-[160px] rounded-xl"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saved ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saved ? 'Salvo!' : 'Salvar configurações'}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}

function GeneralLinkSection() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [gerando, setGerando] = useState(false);

  const { data: linkGeral, isLoading } = useQuery({
    queryKey: ['link-agenda-geral', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_agenda_paciente')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .is('paciente_id', null)
        .eq('status', 'ativo')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const gerarLinkGeral = async () => {
    if (!user) return;
    setGerando(true);
    try {
      // Cancelar anteriores
      await supabase
        .from('links_agenda_paciente')
        .update({ status: 'cancelado' })
        .is('paciente_id', null)
        .eq('terapeuta_id', user.id)
        .eq('status', 'ativo');

      const dataExpiracao = new Date();
      dataExpiracao.setFullYear(dataExpiracao.getFullYear() + 1); // 1 ano de validade para o geral

      const { data, error } = await supabase.from('links_agenda_paciente').insert({
        terapeuta_id: user.id,
        paciente_id: null,
        data_expiracao: dataExpiracao.toISOString(),
      }).select().single();

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['link-agenda-geral'] });
      toast({ title: 'Link geral gerado! 🚀', description: 'Agora novos pacientes podem se cadastrar.' });
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  const copiarLink = (token: string) => {
    navigator.clipboard.writeText(getAgendaUrl(token));
    toast({ title: 'Link copiado! 📋', description: 'Envie para seus novos pacientes.' });
  };

  if (isLoading) return <div className="h-20 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (!linkGeral) {
    return (
      <Button
        variant="outline"
        className="w-full border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 gap-2 h-12"
        onClick={gerarLinkGeral}
        disabled={gerando}
      >
        {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Gerar Link de Agendamento Geral
      </Button>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-primary/10">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Seu Link Geral</p>
          <p className="text-xs font-medium truncate text-primary">{getAgendaUrl(linkGeral.token)}</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => copiarLink(linkGeral.token)}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => window.open(getAgendaUrl(linkGeral.token), '_blank')}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="text-[10px] text-muted-foreground hover:text-destructive h-7 gap-1"
        onClick={gerarLinkGeral}
        disabled={gerando}
      >
        <RefreshCw className={cn("h-3 w-3", gerando && "animate-spin")} />
        Gerar novo link (invalida o atual)
      </Button>
    </div>
  );
}

function ClientRegistrationLink() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { config } = useAgenda();

  const slug = config.slug;
  const link = slug ? `${getBaseUrl()}/cadastro/${slug}` : '';

  const copiarLink = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    toast({ title: 'Link copiado! 📋', description: 'Envie para seus novos clientes.' });
  };

  if (!slug) {
    return (
      <div className="clinical-card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="icon-sm text-muted-foreground" />
          <h2 className="h-section">Link de Cadastro de Cliente</h2>
        </div>
        <p className="text-caption">
          Configure um <strong>slug</strong> no campo acima (Link de Agendamento) para gerar seu link de cadastro de novos clientes.
        </p>
      </div>
    );
  }

  return (
    <div className="clinical-card mb-6">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus className="icon-sm text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Link de Cadastro de Cliente</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Compartilhe este link para que novos clientes criem sua conta e entrem automaticamente no seu banco de dados com acesso ao portal.
      </p>
      <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-primary/10">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Seu Link de Cadastro</p>
          <p className="text-xs font-medium truncate text-primary">{link}</p>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={copiarLink}>
            <Copy className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => window.open(link, '_blank')}>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
