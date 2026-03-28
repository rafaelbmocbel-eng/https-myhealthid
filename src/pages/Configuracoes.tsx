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
import { Settings, CalendarDays, Clock, Save, Loader2, CheckCircle2, Users, Link2, Copy, ExternalLink, RefreshCw, Plus, ClipboardList, AlignCenter, Sparkles, LayoutGrid, PartyPopper } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { getAgendaUrl } from '@/utils/linkUrls';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServicosAtivos, ServicosAtivos } from '@/hooks/useServicosAtivos';
import EquipeManager from '@/components/equipe/EquipeManager';

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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-gradient-primary flex items-center justify-center shrink-0">
              <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">Configurações</h1>
              <p className="text-muted-foreground text-xs sm:text-sm">Gerencie horários de trabalho e dias livres da agenda</p>
            </div>
          </div>
          <Button asChild variant="outline" className="gap-2 w-full sm:w-auto">
            <Link to="/agenda"><CalendarDays className="h-4 w-4" /> Abrir Agenda</Link>
          </Button>
        </div>

        {/* Módulos / Serviços ativos */}
        <div className="clinical-card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <LayoutGrid className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Módulos Ativos</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Escolha quais serviços ficam <strong>visíveis</strong> no menu lateral. Desmarcar um módulo apenas oculta-o da navegação.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              { key: 'identidade' as const, label: 'Método Identidade', icon: ClipboardList, iconClassName: 'text-primary' },
              { key: 'cob_zero' as const, label: 'COB° ZERO', icon: AlignCenter, iconClassName: 'text-primary' },
              { key: 'studio' as const, label: 'Studio Personal ID', icon: Sparkles, iconClassName: 'text-primary' },
              { key: 'eventos' as const, label: 'Eventos', icon: PartyPopper, iconClassName: 'text-primary' },
            ]).map(mod => {
              const ativo = servicos[mod.key];
              return (
                <button
                  key={mod.key}
                  onClick={() => saveServicos({ ...servicos, [mod.key]: !ativo })}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                    ativo
                      ? 'border-primary bg-primary/5'
                      : 'border-dashed border-muted-foreground/20 opacity-50',
                  )}
                >
                  <Switch checked={ativo} onCheckedChange={(v) => saveServicos({ ...servicos, [mod.key]: v })} />
                  <mod.icon className={cn('h-4 w-4 shrink-0', ativo ? mod.iconClassName : 'text-muted-foreground')} />
                  <span className={cn('text-sm font-medium', ativo ? 'text-foreground' : 'text-muted-foreground')}>
                    {mod.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Equipe / Profissionais */}
        <EquipeManager />

        {/* Dias de atendimento */}
        <div className="clinical-card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Dias de Atendimento</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Dias desmarcados ficam como <strong>livres</strong> (sem atendimento) na agenda e na agenda pública.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(DIAS_LABEL).map(([key, label]) => {
              const ativo = form.dias_semana[key] ?? false;
              return (
                <button
                  key={key}
                  onClick={() => updateDia(key, !ativo)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-2 transition-all',
                    ativo
                      ? 'border-primary bg-primary/5'
                      : 'border-dashed border-muted-foreground/20 opacity-50',
                  )}
                >
                  <Switch checked={ativo} onCheckedChange={(v) => updateDia(key, v)} />
                  <span className={cn('text-sm font-medium', ativo ? 'text-foreground' : 'text-muted-foreground')}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Horários */}
        <div className="clinical-card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Horários de Trabalho</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Horários fora deste intervalo serão considerados <strong>livres</strong>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Início do expediente</Label>
              <Input
                type="time"
                value={form.horario_inicio?.slice(0, 5) || '08:00'}
                onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value + ':00' }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Fim do expediente</Label>
              <Input
                type="time"
                value={form.horario_fim?.slice(0, 5) || '18:00'}
                onChange={e => setForm(f => ({ ...f, horario_fim: e.target.value + ':00' }))}
              />
            </div>
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Duração padrão (min)</Label>
              <Select
                value={String(form.duracao_padrao)}
                onValueChange={v => setForm(f => ({ ...f, duracao_padrao: Number(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURACAO_OPTIONS.map(d => (
                    <SelectItem key={d} value={String(d)}>{d} minutos</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Intervalo entre sessões */}
        <div className="clinical-card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Intervalo entre Sessões</h2>
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
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Link de Agendamento Online</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Use este link geral para permitir que <strong>novos pacientes</strong> realizem o auto-agendamento. Eles preencherão o cadastro automaticamente.
          </p>

          <GeneralLinkSection />
        </div>

        {/* Link de Cadastro de Novo Cliente */}
        <ClientRegistrationLink />

        {/* Vagas por horário */}
        <div className="clinical-card mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Vagas por Horário</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-4">
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
            className="bg-gradient-primary text-white gap-2 min-w-[160px]"
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
