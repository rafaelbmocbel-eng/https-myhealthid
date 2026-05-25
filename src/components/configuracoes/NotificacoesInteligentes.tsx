import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Sparkles, Bell, Clock, MessageSquare, Loader2, Save, History, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DIMENSAO_LABEL: Record<string, string> = {
  D: 'Dor', EFI: 'Funcionalidade', P: 'Psicológico (medo)', I: 'Inércia (mudanças)',
  R: 'Regulação / Sono', C: 'Contexto / Estresse', AF: 'Atividade Física',
  HID: 'Hidratação', NUT: 'Nutrição', ERG: 'Ergonomia', N: 'Ruído Sistêmico',
  MED: 'Medicação', ANY: 'Qualquer driver',
};

const CANAL_LABEL: Record<string, string> = {
  in_app: 'No aplicativo', whatsapp: 'WhatsApp', push: 'Notificação push',
};

interface Regra {
  id: string;
  driver: string;
  titulo: string;
  template_mensagem: string;
  canal: 'in_app' | 'whatsapp' | 'push';
  horario_envio: string;
  dias_semana: number[];
  intervalo_repeticao_horas: number | null;
  ativo: boolean;
}

export default function NotificacoesInteligentes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Config geral
  const { data: cfg, isLoading: loadingCfg } = useQuery({
    queryKey: ['notif-config', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacao_inteligente_config')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Regras
  const { data: regras = [], isLoading: loadingRegras } = useQuery({
    queryKey: ['notif-regras', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notificacao_regras')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('horario_envio');
      if (error) throw error;
      return data as Regra[];
    },
    enabled: !!user,
  });

  // Log de envios (últimos 30)
  const { data: envios = [] } = useQuery({
    queryKey: ['notif-envios', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notificacao_envios')
        .select('id, paciente_id, driver, canal, mensagem, status, enviado_em, pacientes(nome,sobrenome)')
        .eq('terapeuta_id', user!.id)
        .order('enviado_em', { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!user,
  });

  const toggleAtiva = useMutation({
    mutationFn: async (ativa: boolean) => {
      const { error } = await supabase
        .from('notificacao_inteligente_config')
        .upsert({ terapeuta_id: user!.id, ativa }, { onConflict: 'terapeuta_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-config'] });
      toast({ title: 'Configuração salva' });
    },
  });

  const seedDefaults = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('seed_notificacao_regras_default', { p_terapeuta_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notif-regras'] });
      toast({ title: 'Regras padrão criadas', description: '11 templates desativados foram adicionados.' });
    },
  });

  const updateRegra = useMutation({
    mutationFn: async (r: Partial<Regra> & { id: string }) => {
      const { error } = await supabase.from('notificacao_regras').update(r).eq('id', r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notif-regras'] }),
  });

  if (loadingCfg || loadingRegras) {
    return <div className="flex justify-center py-12"><Loader2 className="icon-lg animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Header explicativo */}
      <div className="clinical-card bg-primary/5 border-primary/15">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <Brain className="icon-md text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="h-section mb-1">Notificações inteligentes por MyID</h2>
            <p className="text-caption">
              Envia automaticamente dicas e lembretes para cada paciente conforme o <strong>Driver Primário</strong> do MyID dele.
              Ex.: paciente com Driver = Sono recebe lembrete às 22h; Driver = Hidratação recebe ping a cada 3h.
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-background border border-border/40">
          <div>
            <p className="text-sm font-medium">Sistema ativo</p>
            <p className="text-[11px] text-muted-foreground">
              {cfg?.ativa ? 'Notificações sendo enviadas automaticamente.' : 'Desligado — nenhum envio acontece.'}
            </p>
          </div>
          <Switch
            checked={!!cfg?.ativa}
            onCheckedChange={(v) => toggleAtiva.mutate(v)}
            disabled={toggleAtiva.isPending}
          />
        </div>
      </div>

      {/* Regras */}
      <div className="clinical-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="icon-sm text-muted-foreground" />
            <h2 className="h-section">Regras por driver</h2>
          </div>
          {regras.length === 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => seedDefaults.mutate()}
              disabled={seedDefaults.isPending}
              className="rounded-xl gap-1.5"
            >
              {seedDefaults.isPending ? <Loader2 className="icon-xs animate-spin" /> : <Sparkles className="icon-xs" />}
              Criar 11 regras padrão
            </Button>
          )}
        </div>

        {regras.length === 0 ? (
          <p className="text-caption">Nenhuma regra criada ainda. Clique acima para gerar os templates padrão.</p>
        ) : (
          <div className="space-y-2.5">
            {regras.map((r) => (
              <RegraEditor key={r.id} regra={r} onSave={(patch) => updateRegra.mutate({ id: r.id, ...patch })} />
            ))}
          </div>
        )}
      </div>

      {/* Log de envios */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <History className="icon-sm text-muted-foreground" />
          <h2 className="h-section">Últimos envios</h2>
        </div>
        {envios.length === 0 ? (
          <p className="text-caption">Nenhuma notificação enviada ainda.</p>
        ) : (
          <div className="space-y-2">
            {envios.map((e: any) => (
              <div key={e.id} className="p-3 rounded-lg border border-border/40 bg-background/60">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium">
                    {e.pacientes?.nome} {e.pacientes?.sobrenome || ''}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(e.enviado_em), "dd/MM HH:mm", { locale: ptBR })}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-1">
                  {DIMENSAO_LABEL[e.driver] || e.driver} · {CANAL_LABEL[e.canal] || e.canal}
                </p>
                <p className="text-xs">{e.mensagem}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RegraEditor({ regra, onSave }: { regra: Regra; onSave: (p: Partial<Regra>) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(regra);
  const dirty = JSON.stringify(draft) !== JSON.stringify(regra);

  return (
    <div className={cn('rounded-xl border bg-background/60 transition-colors', regra.ativo ? 'border-primary/30' : 'border-border/40')}>
      <div className="flex items-center justify-between p-3 gap-3">
        <button onClick={() => setOpen(!open)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold">{regra.titulo}</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {DIMENSAO_LABEL[regra.driver] || regra.driver}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Clock className="icon-xs" /> {regra.horario_envio.slice(0, 5)}
            <span>·</span>
            <MessageSquare className="icon-xs" /> {CANAL_LABEL[regra.canal] || regra.canal}
            {regra.intervalo_repeticao_horas && <span>· repete a cada {regra.intervalo_repeticao_horas}h</span>}
          </div>
        </button>
        <Switch
          checked={regra.ativo}
          onCheckedChange={(v) => onSave({ ativo: v })}
        />
      </div>

      {open && (
        <div className="border-t border-border/40 p-3 space-y-3 animate-in fade-in slide-in-from-top-1">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={draft.titulo} onChange={(e) => setDraft({ ...draft, titulo: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Mensagem (use {'{nome}'} para personalizar)</Label>
            <Textarea
              value={draft.template_mensagem}
              onChange={(e) => setDraft({ ...draft, template_mensagem: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Horário</Label>
              <Input
                type="time"
                value={draft.horario_envio.slice(0, 5)}
                onChange={(e) => setDraft({ ...draft, horario_envio: e.target.value + ':00' })}
              />
            </div>
            <div>
              <Label className="text-xs">Canal</Label>
              <Select value={draft.canal} onValueChange={(v: any) => setDraft({ ...draft, canal: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_app">No app</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Repetir a cada (horas) — opcional</Label>
            <Input
              type="number" min={0} max={24}
              value={draft.intervalo_repeticao_horas ?? ''}
              onChange={(e) => setDraft({ ...draft, intervalo_repeticao_horas: e.target.value ? Number(e.target.value) : null })}
              placeholder="Ex: 3 (a cada 3h)"
            />
          </div>
          {dirty && (
            <Button size="sm" className="w-full rounded-xl gap-1.5" onClick={() => { onSave(draft); setOpen(false); }}>
              <Save className="icon-xs" /> Salvar alterações
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
