import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useAgenda, ConfigAgenda } from '@/hooks/useAgenda';
import { Navigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, CalendarDays, Clock, Save, Loader2, CheckCircle2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

const DIAS_LABEL: Record<string, string> = {
  seg: 'Segunda', ter: 'Terça', qua: 'Quarta', qui: 'Quinta', sex: 'Sexta', sab: 'Sábado', dom: 'Domingo',
};

const DURACAO_OPTIONS = [30, 45, 50, 60, 90];

export default function Configuracoes() {
  const { user, loading: authLoading } = useAuth();
  const { config, saveConfig, loading } = useAgenda();
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
      <div className="container py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
              <p className="text-muted-foreground text-sm">Gerencie horários de trabalho e dias livres da agenda</p>
            </div>
          </div>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/agenda"><CalendarDays className="h-4 w-4" /> Abrir Agenda</Link>
          </Button>
        </div>

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
