import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Save, RotateCcw, ChevronUp, ChevronDown,
  Eye, EyeOff, AlignLeft, AlignCenter, AlignRight,
  ArrowLeftRight, Activity, Target, ClipboardList,
  Smartphone, FileText, Fingerprint, Stethoscope, Rocket,
  LayoutTemplate, Rows, Columns, Maximize2, Minimize2,
  CreditCard, ShieldAlert, Bell,
} from 'lucide-react';
import {
  DEFAULT_LAYOUT_CONFIG,
  type LayoutConfig,
  type TabConfig,
} from '@/hooks/useLayoutConfig';
import { useLayoutConfig } from '@/contexts/LayoutConfigContext';
import { useToast } from '@/hooks/use-toast';

// ─── icon maps ────────────────────────────────────────────────────────────────
const TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  presencial: Activity,
  diretrizes: Target,
  'evolucao-prontuario': ClipboardList,
  portal: Smartphone,
  historico: FileText,
  diagnostico: Fingerprint,
  corpo: Stethoscope,
  jornada: Rocket,
};

// ─── shared helpers ────────────────────────────────────────────────────────────
function SectionCard({ title, color = 'default', children }: {
  title: string;
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'default';
  children: React.ReactNode;
}) {
  const accent: Record<string, string> = {
    blue:   'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200/60 dark:border-blue-800/40',
    green:  'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40',
    orange: 'bg-orange-50/60 dark:bg-orange-950/20 border-orange-200/60 dark:border-orange-800/40',
    red:    'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-800/40',
    purple: 'bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-800/40',
    default:'bg-card border-border/60',
  };
  const dot: Record<string, string> = {
    blue: 'bg-blue-500', green: 'bg-emerald-500', orange: 'bg-orange-500',
    red: 'bg-rose-500', purple: 'bg-violet-500', default: 'bg-muted-foreground',
  };
  return (
    <div className={cn('rounded-2xl border overflow-hidden shadow-xs', accent[color])}>
      <div className="px-4 py-3 border-b border-inherit flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full shrink-0', dot[color])} />
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function Divider() {
  return <div className="h-px bg-border/50" />;
}

// ─── pill pickers ──────────────────────────────────────────────────────────────
function PillPicker<T extends string>({ options, value, onChange }: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map(o => (
        <button
          key={String(o.value)}
          type="button"
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
            value === o.value
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : 'bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ─── button preview ────────────────────────────────────────────────────────────
function BotaoPreview({ cfg }: { cfg: LayoutConfig }) {
  const { botao_presencial: bp, botao_resposta_completa: br,
          botoes_unidos, botoes_direcao, botoes_alinhamento, botao_presencial_largura } = cfg;

  const sizeH = { sm: 'h-7 text-xs px-3', md: 'h-8 text-sm px-4', lg: 'h-9 text-sm px-5' };
  const dirClass = botoes_direcao === 'column' ? 'flex-col items-stretch' : 'flex-row items-center';
  const alignClass = {
    start: 'justify-start', center: 'justify-center',
    end: 'justify-end', between: 'justify-between',
  }[botoes_alinhamento];
  const pWidthClass = botao_presencial_largura === 'full' ? 'w-full'
    : botao_presencial_largura === 'half' ? 'w-1/2' : '';

  if (!bp.visivel && !br.visivel && !botoes_unidos) {
    return (
      <div className="flex items-center justify-center h-10 rounded-xl border border-dashed border-border/40 bg-muted/20">
        <span className="text-[10px] text-muted-foreground italic">Nenhum botão visível</span>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 w-full', dirClass, !botoes_unidos && alignClass)}>
      {(botoes_unidos ? bp.visivel : bp.visivel) && (
        <div className={cn(
          'rounded-lg font-semibold bg-primary text-primary-foreground shadow-sm flex-shrink-0 flex items-center justify-center',
          sizeH[bp.tamanho], pWidthClass,
          botoes_direcao === 'column' && 'w-full',
        )}>
          {bp.label || 'Botão principal'}
          {botoes_unidos && br.visivel && <span className="opacity-60 ml-1">▾</span>}
        </div>
      )}
      {!botoes_unidos && br.visivel && (
        <div className={cn(
          'rounded-lg font-semibold border border-border bg-background text-foreground flex items-center justify-center',
          sizeH[br.tamanho],
          botoes_direcao === 'column' && 'w-full',
        )}>
          {br.label || 'Secundário'}
        </div>
      )}
    </div>
  );
}

// ─── tabs preview ──────────────────────────────────────────────────────────────
function TabsPreview({ tabs, compact, showIcon }: {
  tabs: TabConfig[]; compact: boolean; showIcon: boolean;
}) {
  const visible = tabs.filter(t => t.visivel);
  const gridCols = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'][Math.min(visible.length, 5)] ?? 'grid-cols-5';
  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-8 rounded-xl border border-dashed border-border/40 bg-muted/20">
        <span className="text-[10px] text-muted-foreground italic">Nenhuma aba visível</span>
      </div>
    );
  }
  return (
    <div className={cn('grid gap-0.5 bg-muted/60 rounded-xl p-1', gridCols)}>
      {visible.map((t, i) => {
        const Icon = TAB_ICONS[t.id] || Activity;
        return (
          <div key={t.id} className={cn(
            'flex items-center justify-center gap-1 rounded-lg font-semibold text-[10px]',
            compact ? 'py-1' : 'py-2',
            i === 0 ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground',
          )}>
            {showIcon && <Icon className="w-3 h-3 shrink-0" />}
            <span className="truncate">{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── tab row (reorder + toggle + rename) ──────────────────────────────────────
function TabRow({ tab, index, total, onChange, onMove }: {
  tab: TabConfig; index: number; total: number;
  onChange: (u: TabConfig) => void; onMove: (f: number, t: number) => void;
}) {
  const Icon = TAB_ICONS[tab.id] || Activity;
  return (
    <div className={cn(
      'flex items-center gap-2 p-2 rounded-xl border transition-colors',
      tab.visivel ? 'border-border/50 bg-background' : 'border-border/20 bg-muted/30 opacity-50',
    )}>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button type="button" disabled={index === 0} onClick={() => onMove(index, index - 1)}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-20">
          <ChevronUp className="w-3 h-3 text-muted-foreground" />
        </button>
        <button type="button" disabled={index === total - 1} onClick={() => onMove(index, index + 1)}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-20">
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <Input
        value={tab.label}
        onChange={e => onChange({ ...tab, label: e.target.value })}
        className="h-7 text-sm flex-1 min-w-0 border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:bg-muted/40 rounded"
        placeholder={tab.defaultLabel}
      />
      <button type="button" onClick={() => onChange({ ...tab, visivel: !tab.visivel })}
        className="shrink-0 text-muted-foreground hover:text-foreground">
        {tab.visivel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ─── size picker ───────────────────────────────────────────────────────────────
function SizePicker({ value, onChange }: {
  value: 'sm' | 'md' | 'lg'; onChange: (v: 'sm' | 'md' | 'lg') => void;
}) {
  return (
    <div className="flex gap-1">
      {(['sm', 'md', 'lg'] as const).map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={cn(
            'w-9 h-7 rounded-lg text-xs font-bold border transition-all',
            value === s
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background border-border text-muted-foreground hover:border-primary/50',
          )}>
          {s === 'sm' ? 'P' : s === 'md' ? 'M' : 'G'}
        </button>
      ))}
    </div>
  );
}

// ─── section toggle row ────────────────────────────────────────────────────────
function ToggleRow({ label, desc, checked, onChange, icon: Icon }: {
  label: string; desc: string; checked: boolean;
  onChange: (v: boolean) => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3 p-2.5 rounded-xl border transition-colors',
      checked ? 'border-border/50 bg-background' : 'border-border/20 bg-muted/20 opacity-60')}>
      <div className="flex items-center gap-2.5 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none mb-0.5">{label}</p>
          <p className="text-[11px] text-muted-foreground leading-tight">{desc}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="shrink-0" />
    </div>
  );
}

// ─── main component ────────────────────────────────────────────────────────────
export default function LayoutEditor() {
  const navigate = useNavigate();
  const { config: saved, loading, save, reset } = useLayoutConfig();
  const { toast } = useToast();
  const [draft, setDraft] = useState<LayoutConfig>(() => JSON.parse(JSON.stringify(saved)));
  // Sync draft once Supabase finishes loading the real stored config.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (!loading && !syncedRef.current) {
      syncedRef.current = true;
      setDraft(JSON.parse(JSON.stringify(saved)));
    }
  }, [loading]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  async function handleSave() {
    await save(draft);
    toast({ title: 'Layout salvo!', description: 'Mudanças visíveis para todos em toda a plataforma.' });
  }

  async function handleReset() {
    const fresh: LayoutConfig = JSON.parse(JSON.stringify(DEFAULT_LAYOUT_CONFIG));
    setDraft(fresh);
    await reset();
    syncedRef.current = true;
    toast({ title: 'Layout resetado para o padrão.' });
  }

  function patch(partial: Partial<LayoutConfig>) {
    setDraft(d => ({ ...d, ...partial }));
  }

  function updateMainTab(i: number, u: TabConfig) {
    const tabs = [...draft.main_tabs]; tabs[i] = u; patch({ main_tabs: tabs });
  }
  function moveMainTab(from: number, to: number) {
    const tabs = [...draft.main_tabs];
    const [item] = tabs.splice(from, 1); tabs.splice(to, 0, item);
    patch({ main_tabs: tabs.map((t, i) => ({ ...t, ordem: i })) });
  }
  function updateSubTab(i: number, u: TabConfig) {
    const tabs = [...draft.sub_tabs]; tabs[i] = u; patch({ sub_tabs: tabs });
  }
  function moveSubTab(from: number, to: number) {
    const tabs = [...draft.sub_tabs];
    const [item] = tabs.splice(from, 1); tabs.splice(to, 0, item);
    patch({ sub_tabs: tabs.map((t, i) => ({ ...t, ordem: i })) });
  }

  const visibleMain = draft.main_tabs.filter(t => t.visivel).length;
  const visibleSub  = draft.sub_tabs.filter(t => t.visivel).length;
  const mainGrid = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'][Math.min(visibleMain, 5)] ?? 'grid-cols-5';
  const subGrid  = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'][Math.min(visibleSub, 3)] ?? 'grid-cols-3';

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 pb-24 pt-2 space-y-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 py-2">
          <button type="button" onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-primary shrink-0" />
              <h1 className="text-base font-bold">Editor de Layout</h1>
            </div>
            <p className="text-[11px] text-muted-foreground">Perfil do paciente</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1.5 text-muted-foreground h-8">
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Resetar</span>
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!isDirty} className="gap-1.5 h-8">
              <Save className="w-3.5 h-3.5" />
              Salvar
            </Button>
          </div>
        </div>

        {/* ── 1. Botões de Ação ──────────────────────────────────────────── */}
        <SectionCard title="Botões de Ação" color="blue">

          {/* Prévia ao vivo */}
          <div className="rounded-xl border border-blue-200/50 bg-blue-50/30 dark:bg-blue-950/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600/70 dark:text-blue-400/70 mb-2">Prévia</p>
            <BotaoPreview cfg={draft} />
          </div>

          {/* Unir */}
          <ToggleRow
            label="Unir em um único botão"
            desc="Combina os dois botões com dropdown"
            checked={draft.botoes_unidos}
            onChange={v => patch({ botoes_unidos: v })}
          />

          <Divider />

          {/* Posição */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Posição na página</Label>
            <PillPicker
              value={draft.botoes_posicao}
              onChange={v => patch({ botoes_posicao: v })}
              options={[
                { value: 'topo', label: '↑ Acima do conteúdo', title: 'Botões aparecem acima das sub-abas' },
                { value: 'rodape', label: '↓ Abaixo do conteúdo', title: 'Botões aparecem abaixo das sub-abas' },
              ]}
            />
          </div>

          {/* Direção */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Direção</Label>
            <PillPicker
              value={draft.botoes_direcao}
              onChange={v => patch({ botoes_direcao: v })}
              options={[
                { value: 'row', label: <span className="flex items-center gap-1"><Columns className="w-3.5 h-3.5" />Lado a lado</span> },
                { value: 'column', label: <span className="flex items-center gap-1"><Rows className="w-3.5 h-3.5" />Empilhados</span> },
              ]}
            />
          </div>

          {/* Alinhamento */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Alinhamento</Label>
            <PillPicker
              value={draft.botoes_alinhamento}
              onChange={v => patch({ botoes_alinhamento: v })}
              options={[
                { value: 'start',   label: <AlignLeft className="w-3.5 h-3.5" />, title: 'Esquerda' },
                { value: 'center',  label: <AlignCenter className="w-3.5 h-3.5" />, title: 'Centro' },
                { value: 'end',     label: <AlignRight className="w-3.5 h-3.5" />, title: 'Direita' },
                { value: 'between', label: <AlignLeftRight className="w-3.5 h-3.5" />, title: 'Separados (entre)' },
              ]}
            />
          </div>

          {/* Largura do botão principal */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Largura do botão principal</Label>
            <PillPicker
              value={draft.botao_presencial_largura}
              onChange={v => patch({ botao_presencial_largura: v })}
              options={[
                { value: 'auto', label: 'Automática' },
                { value: 'half', label: '½ Largura' },
                { value: 'full', label: <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" />Largura total</span> },
              ]}
            />
          </div>

          <Divider />

          {/* Botão presencial */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                {draft.botoes_unidos ? 'Botão único' : 'Botão principal'}
              </Label>
              {!draft.botoes_unidos && (
                <button type="button"
                  onClick={() => patch({ botao_presencial: { ...draft.botao_presencial, visivel: !draft.botao_presencial.visivel } })}
                  className="text-muted-foreground hover:text-foreground">
                  {draft.botao_presencial.visivel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              )}
            </div>
            <Input value={draft.botao_presencial.label}
              onChange={e => patch({ botao_presencial: { ...draft.botao_presencial, label: e.target.value } })}
              placeholder="Rótulo do botão" className="h-8 text-sm" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Altura:</span>
              <SizePicker value={draft.botao_presencial.tamanho}
                onChange={v => patch({ botao_presencial: { ...draft.botao_presencial, tamanho: v } })} />
            </div>
          </div>

          {/* Botão resposta completa */}
          {!draft.botoes_unidos && (
            <>
              <Divider />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Botão secundário</Label>
                  <button type="button"
                    onClick={() => patch({ botao_resposta_completa: { ...draft.botao_resposta_completa, visivel: !draft.botao_resposta_completa.visivel } })}
                    className="text-muted-foreground hover:text-foreground">
                    {draft.botao_resposta_completa.visivel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
                <Input value={draft.botao_resposta_completa.label}
                  onChange={e => patch({ botao_resposta_completa: { ...draft.botao_resposta_completa, label: e.target.value } })}
                  placeholder="Rótulo do botão" className="h-8 text-sm" />
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Altura:</span>
                  <SizePicker value={draft.botao_resposta_completa.tamanho}
                    onChange={v => patch({ botao_resposta_completa: { ...draft.botao_resposta_completa, tamanho: v } })} />
                </div>
              </div>
            </>
          )}
        </SectionCard>

        {/* ── 2. Sub-abas ────────────────────────────────────────────────── */}
        <SectionCard title="Sub-abas (MyID · Corpo · Jornada)" color="green">
          <div className="rounded-xl border border-emerald-200/50 bg-emerald-50/30 dark:bg-emerald-950/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600/70 dark:text-emerald-400/70 mb-2">Prévia</p>
            <TabsPreview tabs={draft.sub_tabs} compact={draft.tabs_compacto} showIcon={draft.tabs_icone} />
          </div>
          <div className="space-y-2">
            {draft.sub_tabs.map((tab, i) => (
              <TabRow key={tab.id} tab={tab} index={i} total={draft.sub_tabs.length}
                onChange={u => updateSubTab(i, u)} onMove={moveSubTab} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">↑↓ reordenar · 👁 mostrar/ocultar · editar o nome</p>
        </SectionCard>

        {/* ── 3. Abas Principais ─────────────────────────────────────────── */}
        <SectionCard title="Abas Principais" color="orange">
          <div className="rounded-xl border border-orange-200/50 bg-orange-50/30 dark:bg-orange-950/10 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-600/70 dark:text-orange-400/70 mb-2">Prévia</p>
            <TabsPreview tabs={draft.main_tabs} compact={draft.tabs_compacto} showIcon={draft.tabs_icone} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Altura</Label>
              <PillPicker
                value={draft.tabs_compacto ? 'compact' : 'normal'}
                onChange={v => patch({ tabs_compacto: v === 'compact' })}
                options={[
                  { value: 'compact', label: <span className="flex items-center gap-1"><Minimize2 className="w-3 h-3" />Compacto</span> },
                  { value: 'normal',  label: <span className="flex items-center gap-1"><Maximize2 className="w-3 h-3" />Normal</span> },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ícones nas abas</Label>
              <PillPicker
                value={draft.tabs_icone ? 'sim' : 'nao'}
                onChange={v => patch({ tabs_icone: v === 'sim' })}
                options={[
                  { value: 'sim', label: '✓ Mostrar' },
                  { value: 'nao', label: '✗ Ocultar' },
                ]}
              />
            </div>
          </div>

          <Divider />

          <div className="space-y-2">
            {draft.main_tabs.map((tab, i) => (
              <TabRow key={tab.id} tab={tab} index={i} total={draft.main_tabs.length}
                onChange={u => updateMainTab(i, u)} onMove={moveMainTab} />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">↑↓ reordenar · 👁 mostrar/ocultar · editar o nome</p>
        </SectionCard>

        {/* ── 4. Seções da Página ─────────────────────────────────────────── */}
        <SectionCard title="Seções da Página" color="red">
          <ToggleRow
            label="Cards de métricas"
            desc="Cliente há, MyID, Próxima consulta, Sessões"
            icon={CreditCard}
            checked={draft.mostrar_stats}
            onChange={v => patch({ mostrar_stats: v })}
          />
          <ToggleRow
            label="Painel de Decisão Clínica"
            desc="Indicador CRÍTICO SEVERO e alertas de conduta"
            icon={ShieldAlert}
            checked={draft.mostrar_decisao}
            onChange={v => patch({ mostrar_decisao: v })}
          />
          <ToggleRow
            label="Alerta LGPD"
            desc="Banner de termo de consentimento pendente"
            icon={Bell}
            checked={draft.mostrar_lgpd}
            onChange={v => patch({ mostrar_lgpd: v })}
          />
        </SectionCard>

        {/* ── 5. Cabeçalho ───────────────────────────────────────────────── */}
        <SectionCard title="Cabeçalho — Botões Rápidos" color="purple">
          <ToggleRow
            label="Portal"
            desc="Enviar link do portal via WhatsApp"
            icon={Smartphone}
            checked={draft.header_portal}
            onChange={v => patch({ header_portal: v })}
          />
          <ToggleRow
            label="Docs"
            desc="Atestados, recibos e declarações"
            icon={FileText}
            checked={draft.header_docs}
            onChange={v => patch({ header_docs: v })}
          />
          <ToggleRow
            label="Identidade"
            desc="PDF do MyID e relatório portátil"
            icon={Activity}
            checked={draft.header_identidade}
            onChange={v => patch({ header_identidade: v })}
          />
        </SectionCard>

      </div>

      {/* ── Salvar flutuante ─────────────────────────────────────────────── */}
      {isDirty && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none px-4">
          <Button size="lg" onClick={handleSave}
            className="pointer-events-auto shadow-xl gap-2 rounded-2xl w-full max-w-xs">
            <Save className="w-4 h-4" />
            Salvar alterações
          </Button>
        </div>
      )}
    </AppLayout>
  );
}
