import { useState, useEffect, useMemo } from 'react';
import NotificationPreferences from '@/components/NotificationPreferences';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAgenda, ConfigAgenda } from '@/hooks/useAgenda';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  CalendarDays, Clock, Save, Loader2, CheckCircle2, Users, Link2, Copy,
  ExternalLink, RefreshCw, Plus, UserPlus, Building2, Bell, Sparkles,
  Database, PartyPopper, ArrowRight, BookOpen, LayoutGrid, Brain,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAgendaUrl, getBaseUrl } from '@/utils/linkUrls';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import EquipeManager from '@/components/equipe/EquipeManager';
import AiCreditsBanner from '@/components/AiCreditsBanner';
import ConfigClinica from '@/components/configuracoes/ConfigClinica';
import TurnosEditor from '@/components/configuracoes/TurnosEditor';
import AusenciasManager from '@/components/configuracoes/AusenciasManager';
import PerfilProfissionalCard from '@/components/configuracoes/PerfilProfissionalCard';
import AtalhosHomeEditor from '@/components/configuracoes/AtalhosHomeEditor';
import NotificacoesInteligentes from '@/components/configuracoes/NotificacoesInteligentes';

type TabId = 'clinica' | 'home' | 'agenda' | 'equipe' | 'links' | 'notif' | 'myid' | 'ia';

type TabItem =
  | { id: TabId; label: string; icon: React.ComponentType<any>; kind: 'panel' }
  | { id: string; label: string; icon: React.ComponentType<any>; kind: 'link'; to: string };

const TABS: TabItem[] = [
  { id: 'clinica', label: 'Clínica', icon: Building2, kind: 'panel' },
  { id: 'home', label: 'Home', icon: LayoutGrid, kind: 'panel' },
  { id: 'agenda', label: 'Agenda', icon: CalendarDays, kind: 'panel' },
  { id: 'equipe', label: 'Equipe', icon: Users, kind: 'panel' },
  { id: 'base-cientifica', label: 'Base Científica', icon: BookOpen, kind: 'link', to: '/base-cientifica' },
  { id: 'eventos', label: 'Eventos', icon: PartyPopper, kind: 'link', to: '/eventos' },
  { id: 'links', label: 'Links', icon: Link2, kind: 'panel' },
  { id: 'notif', label: 'Avisos', icon: Bell, kind: 'panel' },
  { id: 'ia', label: 'IA', icon: Sparkles, kind: 'panel' },
];

export default function Configuracoes() {
  const { user, loading: authLoading } = useAuth();
  const { config, saveConfig, loading } = useAgenda();
  const navigate = useNavigate();
  const [form, setForm] = useState<ConfigAgenda>(config);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<TabId>('clinica');

  useEffect(() => { setForm(config); }, [config]);

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(config),
    [form, config],
  );

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const handleSave = async () => {
    setSaving(true);
    await saveConfig(form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
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
      <div className="container py-4 sm:py-6 max-w-2xl pb-32">
        {/* Header */}
        <div className="mb-4 sm:mb-5">
          <div className="eyebrow-accent mb-1.5">Ajustes</div>
          <h1 className="h-page">Configurações</h1>
          <p className="text-caption mt-1">Clínica, agenda, equipe, links e avisos</p>
        </div>


        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="w-full">
          <div className="sticky top-0 z-20 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60 py-2 mb-4 border-b border-border/40">
            <TabsList className="h-auto flex flex-wrap gap-1 bg-secondary/60 p-1 rounded-xl w-full justify-start">
              {TABS.map(t => {
                const Icon = t.icon;
                if (t.kind === 'link') {
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => navigate(t.to)}
                      className="inline-flex items-center gap-1.5 rounded-lg px-3 h-8 text-muted-foreground hover:text-foreground hover:bg-background/60 transition-colors"
                    >
                      <Icon className="icon-xs" />
                      <span className="text-xs sm:text-sm">{t.label}</span>
                      <ArrowRight className="icon-xs opacity-50" />
                    </button>
                  );
                }
                return (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="gap-1.5 rounded-lg px-3 h-8 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                  >
                    <Icon className="icon-xs" />
                    <span className="text-xs sm:text-sm">{t.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>


          {/* CLÍNICA */}
          <TabsContent value="clinica" className="mt-0 space-y-4">
            <PerfilProfissionalCard />
            <ConfigClinica />
          </TabsContent>

          {/* HOME — atalhos */}
          <TabsContent value="home" className="mt-0 space-y-4">
            <AtalhosHomeEditor />
          </TabsContent>



          {/* AGENDA */}
          <TabsContent value="agenda" className="mt-0 space-y-4">
            <TurnosEditor form={form} onChange={setForm} />
            <AusenciasManager />

            <div className="clinical-card">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="icon-sm text-muted-foreground" />
                <h2 className="h-section">Intervalo entre sessões</h2>
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
                <p className="text-[11px] text-muted-foreground mt-1">Tempo livre entre cada sessão (0 = sem intervalo).</p>
              </div>
            </div>

            <div className="clinical-card">
              <div className="flex items-center gap-2 mb-3">
                <Users className="icon-sm text-muted-foreground" />
                <h2 className="h-section">Vagas por horário</h2>
              </div>
              <p className="text-caption mb-3">Quantos pacientes podem agendar no mesmo horário simultaneamente.</p>
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
                <p className="text-[11px] text-muted-foreground mt-1">Padrão: 1 (atendimento individual).</p>
              </div>
            </div>
          </TabsContent>

          {/* EQUIPE */}
          <TabsContent value="equipe" className="mt-0 space-y-4">
            <EquipeManager />
          </TabsContent>

          {/* LINKS — slug unificado */}
          <TabsContent value="links" className="mt-0 space-y-4">
            <LinksUnificados form={form} setForm={setForm} />
          </TabsContent>

          {/* NOTIFICAÇÕES */}
          <TabsContent value="notif" className="mt-0 space-y-4">
            <NotificationPreferences />
          </TabsContent>

          {/* IA */}
          <TabsContent value="ia" className="mt-0 space-y-4">
            <AiCreditsBanner />
            <div className="clinical-card">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="icon-sm text-muted-foreground" />
                <h2 className="h-section">Sobre os créditos de IA</h2>
              </div>
              <p className="text-caption">
                Cada análise automática de MyID, transcrição de áudio do WhatsApp e geração de protocolo
                consome créditos. Os créditos são renovados mensalmente conforme o plano.
              </p>
              <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl gap-2">
                <Link to="/precos"><Sparkles className="icon-xs" /> Ver planos</Link>
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Sticky save bar — só aparece com mudanças não salvas em config de agenda */}
      {isDirty && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+12px)] animate-in slide-in-from-bottom">
          <div className="container max-w-2xl flex items-center justify-between gap-3 px-0">
            <p className="text-xs text-muted-foreground">Você tem alterações não salvas na agenda.</p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setForm(config)} disabled={saving} className="rounded-xl">
                Descartar
              </Button>
              <Button onClick={handleSave} disabled={saving} size="sm" className="gap-2 rounded-xl min-w-[120px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> :
                  saved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                {saved ? 'Salvo' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmação flash quando salvou e não há mais nada dirty */}
      {!isDirty && saved && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-emerald-600 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg animate-in fade-in zoom-in flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" /> Configurações salvas
        </div>
      )}
    </AppLayout>
  );
}

// ─── Links unificados (slug + agenda pública + cadastro de cliente) ──────────
function LinksUnificados({ form, setForm }: { form: ConfigAgenda; setForm: (fn: any) => void }) {
  const slug = form.slug || '';
  const cadastroLink = slug ? `${getBaseUrl()}/cadastro/${slug}` : '';
  const { toast } = useToast();

  return (
    <>
      {/* Slug — base de todos os links públicos */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="icon-sm text-muted-foreground" />
          <h2 className="h-section">Identificador público (slug)</h2>
        </div>
        <p className="text-caption mb-3">
          Usado em todos os seus links públicos. Use letras minúsculas, números e hífens.
        </p>
        <Label className="text-xs font-medium mb-1.5 block">Slug</Label>
        <Input
          placeholder="ex: dr-joao"
          value={slug}
          onChange={e => setForm((f: any) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
        />
        <p className="text-[11px] text-muted-foreground mt-2 break-all">
          Pré-visualização: <strong>{getBaseUrl()}/cadastro/{slug || 'seu-slug'}</strong>
        </p>
      </div>

      {/* Link de cadastro de cliente */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="icon-sm text-muted-foreground" />
          <h2 className="h-section">Link de cadastro de cliente</h2>
        </div>
        {slug ? (
          <>
            <p className="text-caption mb-3">
              Compartilhe para que novos clientes criem conta e entrem no seu banco com acesso ao portal.
            </p>
            <CopyableLink url={cadastroLink} label="Cadastro de cliente" />
          </>
        ) : (
          <p className="text-caption">Defina um slug acima para gerar este link.</p>
        )}
      </div>

      {/* Link de agendamento geral */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="icon-sm text-muted-foreground" />
          <h2 className="h-section">Link de agendamento online</h2>
        </div>
        <p className="text-caption mb-3">
          Para novos pacientes realizarem auto-agendamento — válido por 1 ano.
        </p>
        <GeneralLinkSection />
      </div>
    </>
  );
}

function CopyableLink({ url, label }: { url: string; label: string }) {
  const { toast } = useToast();
  return (
    <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-primary/10">
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">{label}</p>
        <p className="text-xs font-medium truncate text-primary">{url}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => {
          navigator.clipboard.writeText(url);
          toast({ title: 'Link copiado! 📋' });
        }}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => window.open(url, '_blank')}>
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
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
      await supabase.from('links_agenda_paciente').update({ status: 'cancelado' })
        .is('paciente_id', null).eq('terapeuta_id', user.id).eq('status', 'ativo');
      const dataExpiracao = new Date();
      dataExpiracao.setFullYear(dataExpiracao.getFullYear() + 1);
      const { error } = await supabase.from('links_agenda_paciente').insert({
        terapeuta_id: user.id, paciente_id: null, data_expiracao: dataExpiracao.toISOString(),
      }).select().single();
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['link-agenda-geral'] });
      toast({ title: 'Link gerado! 🚀' });
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' });
    } finally { setGerando(false); }
  };

  if (isLoading) return <div className="h-16 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  if (!linkGeral) {
    return (
      <Button variant="outline" className="w-full border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 gap-2 h-12"
        onClick={gerarLinkGeral} disabled={gerando}>
        {gerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Gerar link de agendamento
      </Button>
    );
  }

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
      <CopyableLink url={getAgendaUrl(linkGeral.token)} label="Link de agendamento" />
      <Button variant="ghost" size="sm"
        className="text-[10px] text-muted-foreground hover:text-destructive h-7 gap-1"
        onClick={gerarLinkGeral} disabled={gerando}>
        <RefreshCw className={cn("h-3 w-3", gerando && "animate-spin")} />
        Gerar novo (invalida o atual)
      </Button>
    </div>
  );
}
