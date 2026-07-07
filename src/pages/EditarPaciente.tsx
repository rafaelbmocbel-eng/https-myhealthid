import { useState, useEffect, useRef, type ComponentType, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useLayoutConfig } from '@/contexts/LayoutConfigContext';
import { DEFAULT_LAYOUT_CONFIG, type LayoutConfig, type TabConfig } from '@/hooks/useLayoutConfig';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Save, RotateCcw, Eye, EyeOff,
  ChevronUp, ChevronDown,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Monitor, Smartphone, Activity, Target, ClipboardList,
  History, ShieldAlert, User, Fingerprint, BookOpen, Pencil,
} from 'lucide-react';

// ─── Tab icon registry ────────────────────────────────────────────────────────
const TAB_ICON: Record<string, ComponentType<{ className?: string }>> = {
  presencial: Activity,
  diretrizes: Target,
  'evolucao-prontuario': ClipboardList,
  portal: Smartphone,
  historico: History,
  diagnostico: Fingerprint,
  corpo: User,
  jornada: Activity,
};

// ─── Shared controls ──────────────────────────────────────────────────────────

function SectionCard({ color, title, children }: { color: string; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border overflow-hidden mb-4">
      <div className={cn('px-3 py-2 text-xs font-semibold text-white', color)}>{title}</div>
      <div className="p-3 space-y-3 bg-card">{children}</div>
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const id = `tr-${label}`;
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function SizePicker({ value, onChange }: { value: 'sm' | 'md' | 'lg'; onChange: (v: 'sm' | 'md' | 'lg') => void }) {
  return (
    <div className="flex gap-1">
      {(['sm', 'md', 'lg'] as const).map(s => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={cn(
            'w-9 py-1 rounded text-xs font-medium border transition-colors',
            value === s ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-accent',
          )}
        >
          {s === 'sm' ? 'P' : s === 'md' ? 'M' : 'G'}
        </button>
      ))}
    </div>
  );
}

function PillPicker<T extends string>({
  value, onChange, options,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; title?: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map(opt => (
        <button
          key={String(opt.value)}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1',
            value === opt.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border hover:bg-accent',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function TabRow({
  tab, onUpdate, onMoveUp, onMoveDown, isFirst, isLast,
}: {
  tab: TabConfig; onUpdate: (t: TabConfig) => void;
  onMoveUp: () => void; onMoveDown: () => void;
  isFirst: boolean; isLast: boolean;
}) {
  const Icon = TAB_ICON[tab.id] ?? Activity;
  return (
    <div className={cn('flex items-center gap-2 p-2 rounded-lg border bg-background', !tab.visivel && 'opacity-40')}>
      <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <Input
        value={tab.label}
        onChange={e => onUpdate({ ...tab, label: e.target.value })}
        className="h-7 text-xs flex-1 min-w-0"
      />
      <button onClick={() => onUpdate({ ...tab, visivel: !tab.visivel })} className="text-muted-foreground hover:text-foreground shrink-0">
        {tab.visivel ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </button>
      <div className="flex flex-col shrink-0">
        <button disabled={isFirst} onClick={onMoveUp} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
          <ChevronUp className="w-3 h-3" />
        </button>
        <button disabled={isLast} onClick={onMoveDown} className="text-muted-foreground hover:text-foreground disabled:opacity-20">
          <ChevronDown className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Live preview sub-components ──────────────────────────────────────────────

function PreviewHeader({ config }: { config: LayoutConfig }) {
  return (
    <div className="bg-background border-b px-3 py-2 flex items-center gap-2 shrink-0">
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
        <ArrowLeft className="w-3 h-3" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">Marcieni Andrade</div>
        <div className="text-[10px] text-muted-foreground">Fisioterapia</div>
      </div>
      <div className="flex gap-1 shrink-0">
        {config.header_docs && (
          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
            <BookOpen className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        {config.header_identidade && (
          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
            <Fingerprint className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        {config.header_portal && (
          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
            <Smartphone className="w-3 h-3 text-muted-foreground" />
          </div>
        )}
        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
          <Pencil className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}

function PreviewStats({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex gap-2 overflow-x-auto px-3 py-2 no-scrollbar shrink-0">
      {[['12', 'Sessões'], ['8', 'Consultas'], ['5', 'Tarefas'], ['47', 'Dias']].map(([v, label]) => (
        <div key={label} className="rounded-xl bg-card border shrink-0 px-2.5 py-1.5 min-w-[64px] text-center">
          <div className="text-base font-bold">{v}</div>
          <div className="text-[9px] text-muted-foreground">{label}</div>
        </div>
      ))}
    </div>
  );
}

function PreviewLGPD({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="mx-3 mb-2 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/40 px-3 py-2 text-[10px] text-blue-700 dark:text-blue-300 flex items-center gap-2 shrink-0">
      <ShieldAlert className="w-3 h-3 shrink-0" />
      Termo de consentimento LGPD assinado
    </div>
  );
}

function PreviewDecisao({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="mx-3 mb-2 rounded-xl border bg-card p-2.5 shrink-0">
      <div className="text-[10px] font-semibold text-muted-foreground mb-1.5">Decisão Clínica</div>
      <div className="h-7 rounded bg-muted/50" />
    </div>
  );
}

function PreviewButtons({ config }: { config: LayoutConfig }) {
  const bp = config.botao_presencial;
  const br = config.botao_resposta_completa;
  if (!bp.visivel && !br.visivel) return null;

  const sizeMap = { sm: 'sm', md: 'default', lg: 'lg' } as const;
  const dirClass = config.botoes_direcao === 'column' ? 'flex-col' : 'flex-row';
  const alignClass: Record<string, string> = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  };
  const widthClass: Record<string, string> = {
    auto: '',
    half: 'flex-1 max-w-[50%]',
    full: 'w-full',
  };

  return (
    <div className={cn('flex gap-2 px-3 py-2 shrink-0', dirClass, alignClass[config.botoes_alinhamento])}>
      {bp.visivel && (
        <Button
          size={sizeMap[bp.tamanho]}
          variant={bp.variante === 'outline' ? 'outline' : bp.variante === 'ghost' ? 'ghost' : 'default'}
          className={cn('text-xs h-8', widthClass[config.botao_presencial_largura])}
        >
          {bp.label}
        </Button>
      )}
      {!config.botoes_unidos && br.visivel && (
        <Button size={sizeMap[br.tamanho]} variant="outline" className="text-xs h-8">
          {br.label}
        </Button>
      )}
    </div>
  );
}

function PreviewSubTabs({ config }: { config: LayoutConfig }) {
  const visible = [...config.sub_tabs].filter(t => t.visivel).sort((a, b) => a.ordem - b.ordem);
  if (!visible.length) return null;
  const cols = Math.min(visible.length, 3);
  return (
    <div className="px-3 py-1 shrink-0">
      <div className={cn('grid rounded-lg bg-muted p-0.5 gap-0.5', `grid-cols-${cols}`)}>
        {visible.map((tab, i) => {
          const Icon = TAB_ICON[tab.id] ?? Activity;
          return (
            <div
              key={tab.id}
              className={cn(
                'rounded-md py-1.5 flex items-center justify-center gap-1 text-[10px] font-medium',
                i === 0 ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground',
              )}
            >
              {config.tabs_icone && <Icon className="w-2.5 h-2.5" />}
              <span>{config.tabs_compacto ? tab.label.slice(0, 3) : tab.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviewMainTabs({ config }: { config: LayoutConfig }) {
  const visible = [...config.main_tabs].filter(t => t.visivel).sort((a, b) => a.ordem - b.ordem);
  if (!visible.length) return null;
  return (
    <div className="border-t bg-background shrink-0">
      <div className={cn('grid', `grid-cols-${Math.min(visible.length, 5)}`)}>
        {visible.map((tab, i) => {
          const Icon = TAB_ICON[tab.id] ?? Activity;
          return (
            <div
              key={tab.id}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] border-t-2 transition-colors',
                i === 0 ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
              )}
            >
              {config.tabs_icone && <Icon className="w-3.5 h-3.5" />}
              {!config.tabs_compacto && <span className="leading-none">{tab.label}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LivePreview({ config }: { config: LayoutConfig }) {
  const btnArea = <PreviewButtons config={config} />;
  return (
    <div className="h-full flex flex-col bg-background text-foreground overflow-hidden">
      <PreviewHeader config={config} />
      <div className="flex-1 overflow-y-auto">
        <PreviewStats visible={config.mostrar_stats} />
        <PreviewLGPD visible={config.mostrar_lgpd} />
        <PreviewDecisao visible={config.mostrar_decisao} />
        {config.botoes_posicao === 'topo' && btnArea}
        <PreviewSubTabs config={config} />
        <div className="mx-3 mt-2 mb-3 rounded-xl border bg-card p-3 flex items-center justify-center" style={{ minHeight: 120 }}>
          <span className="text-[11px] text-muted-foreground">Conteúdo da aba selecionada</span>
        </div>
        {config.botoes_posicao === 'rodape' && btnArea}
      </div>
      <PreviewMainTabs config={config} />
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function EditarPaciente() {
  const navigate = useNavigate();
  const { config: saved, loading, save, reset } = useLayoutConfig();
  const { toast } = useToast();
  const [draft, setDraft] = useState<LayoutConfig>(DEFAULT_LAYOUT_CONFIG);
  const [panel, setPanel] = useState<'controls' | 'preview'>('controls');
  const [viewport, setViewport] = useState<'mobile' | 'desktop'>('mobile');
  const synced = useRef(false);

  useEffect(() => {
    if (!loading && !synced.current) {
      synced.current = true;
      setDraft(JSON.parse(JSON.stringify(saved)));
    }
  }, [loading]);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function patch(p: Partial<LayoutConfig>) {
    setDraft(d => ({ ...d, ...p }));
  }
  function patchBP(p: Partial<LayoutConfig['botao_presencial']>) {
    setDraft(d => ({ ...d, botao_presencial: { ...d.botao_presencial, ...p } }));
  }
  function patchBR(p: Partial<LayoutConfig['botao_resposta_completa']>) {
    setDraft(d => ({ ...d, botao_resposta_completa: { ...d.botao_resposta_completa, ...p } }));
  }

  const sortedSubs = [...draft.sub_tabs].sort((a, b) => a.ordem - b.ordem);
  const sortedMains = [...draft.main_tabs].sort((a, b) => a.ordem - b.ordem);

  function updateSubTab(id: string, t: TabConfig) {
    patch({ sub_tabs: draft.sub_tabs.map(x => (x.id === id ? t : x)) });
  }
  function moveSubTab(fromId: string, dir: 1 | -1) {
    const sorted = [...sortedSubs];
    const idx = sorted.findIndex(t => t.id === fromId);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
    patch({ sub_tabs: sorted.map((t, i) => ({ ...t, ordem: i })) });
  }

  function updateMainTab(id: string, t: TabConfig) {
    patch({ main_tabs: draft.main_tabs.map(x => (x.id === id ? t : x)) });
  }
  function moveMainTab(fromId: string, dir: 1 | -1) {
    const sorted = [...sortedMains];
    const idx = sorted.findIndex(t => t.id === fromId);
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
    patch({ main_tabs: sorted.map((t, i) => ({ ...t, ordem: i })) });
  }

  async function handlePublish() {
    await save(draft);
    synced.current = true;
    toast({ title: '✅ Publicado!', description: 'Layout atualizado em toda a plataforma.' });
  }

  async function handleReset() {
    const fresh: LayoutConfig = JSON.parse(JSON.stringify(DEFAULT_LAYOUT_CONFIG));
    setDraft(fresh);
    await reset();
    synced.current = true;
    toast({ title: 'Layout resetado para o padrão.' });
  }

  // ── Controls ─────────────────────────────────────────────────────────────────
  const Controls = (
    <div className="overflow-y-auto flex-1 p-3">

      {/* Botões de ação */}
      <SectionCard color="bg-blue-600" title="🔵 Botões de Ação">

        <ToggleRow label="Mostrar botão principal" checked={draft.botao_presencial.visivel} onChange={v => patchBP({ visivel: v })} />
        {draft.botao_presencial.visivel && (
          <div className="space-y-2 pl-1 border-l-2 border-blue-200 dark:border-blue-800 ml-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Texto</Label>
              <Input value={draft.botao_presencial.label} onChange={e => patchBP({ label: e.target.value })} className="h-7 text-xs" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Tamanho</Label>
              <SizePicker value={draft.botao_presencial.tamanho} onChange={v => patchBP({ tamanho: v })} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Estilo visual</Label>
              <PillPicker
                value={draft.botao_presencial.variante ?? 'primary'}
                onChange={v => patchBP({ variante: v as LayoutConfig['botao_presencial']['variante'] })}
                options={[
                  { value: 'primary' as const, label: 'Sólido' },
                  { value: 'outline' as const, label: 'Contorno' },
                  { value: 'ghost' as const, label: 'Fantasma' },
                ]}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Largura</Label>
              <PillPicker
                value={draft.botao_presencial_largura}
                onChange={v => patch({ botao_presencial_largura: v })}
                options={[
                  { value: 'auto' as const, label: 'Automático' },
                  { value: 'half' as const, label: '½ tela' },
                  { value: 'full' as const, label: 'Tela cheia' },
                ]}
              />
            </div>
          </div>
        )}

        <div className="border-t pt-2">
          <ToggleRow label="Mostrar botão secundário" checked={draft.botao_resposta_completa.visivel} onChange={v => patchBR({ visivel: v })} />
        </div>
        {draft.botao_resposta_completa.visivel && (
          <div className="space-y-2 pl-1 border-l-2 border-blue-200 dark:border-blue-800 ml-1">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Texto</Label>
              <Input value={draft.botao_resposta_completa.label} onChange={e => patchBR({ label: e.target.value })} className="h-7 text-xs" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[11px] text-muted-foreground">Tamanho</Label>
              <SizePicker value={draft.botao_resposta_completa.tamanho} onChange={v => patchBR({ tamanho: v })} />
            </div>
          </div>
        )}

        {draft.botao_presencial.visivel && draft.botao_resposta_completa.visivel && (
          <ToggleRow label="Fundir em um botão só" checked={draft.botoes_unidos} onChange={v => patch({ botoes_unidos: v })} />
        )}

        <div className="border-t pt-2 space-y-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Posição dos botões</Label>
            <PillPicker
              value={draft.botoes_posicao}
              onChange={v => patch({ botoes_posicao: v })}
              options={[
                { value: 'topo' as const, label: '⬆ Topo' },
                { value: 'rodape' as const, label: '⬇ Rodapé' },
              ]}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Direção</Label>
            <PillPicker
              value={draft.botoes_direcao}
              onChange={v => patch({ botoes_direcao: v })}
              options={[
                { value: 'row' as const, label: '→ Horizontal' },
                { value: 'column' as const, label: '↓ Vertical' },
              ]}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Alinhamento</Label>
            <PillPicker
              value={draft.botoes_alinhamento}
              onChange={v => patch({ botoes_alinhamento: v })}
              options={[
                { value: 'start' as const, label: <AlignLeft className="w-3.5 h-3.5" />, title: 'Esquerda' },
                { value: 'center' as const, label: <AlignCenter className="w-3.5 h-3.5" />, title: 'Centro' },
                { value: 'end' as const, label: <AlignRight className="w-3.5 h-3.5" />, title: 'Direita' },
                { value: 'between' as const, label: <AlignJustify className="w-3.5 h-3.5" />, title: 'Separados' },
              ]}
            />
          </div>
        </div>
      </SectionCard>

      {/* Sub-abas */}
      <SectionCard color="bg-green-600" title="🟢 Sub-abas (MyID / Corpo / Jornada)">
        <ToggleRow label="Modo compacto" checked={draft.tabs_compacto} onChange={v => patch({ tabs_compacto: v })} />
        <ToggleRow label="Mostrar ícones" checked={draft.tabs_icone} onChange={v => patch({ tabs_icone: v })} />
        <div className="space-y-1.5 mt-1">
          {sortedSubs.map((tab, i) => (
            <TabRow
              key={tab.id}
              tab={tab}
              onUpdate={t => updateSubTab(tab.id, t)}
              onMoveUp={() => moveSubTab(tab.id, -1)}
              onMoveDown={() => moveSubTab(tab.id, 1)}
              isFirst={i === 0}
              isLast={i === sortedSubs.length - 1}
            />
          ))}
        </div>
      </SectionCard>

      {/* Abas principais */}
      <SectionCard color="bg-orange-500" title="🟠 Abas Principais">
        <div className="space-y-1.5">
          {sortedMains.map((tab, i) => (
            <TabRow
              key={tab.id}
              tab={tab}
              onUpdate={t => updateMainTab(tab.id, t)}
              onMoveUp={() => moveMainTab(tab.id, -1)}
              onMoveDown={() => moveMainTab(tab.id, 1)}
              isFirst={i === 0}
              isLast={i === sortedMains.length - 1}
            />
          ))}
        </div>
      </SectionCard>

      {/* Seções */}
      <SectionCard color="bg-red-500" title="🔴 Seções da Página">
        <ToggleRow label="Estatísticas do paciente" checked={draft.mostrar_stats} onChange={v => patch({ mostrar_stats: v })} />
        <ToggleRow label="Banner LGPD" checked={draft.mostrar_lgpd} onChange={v => patch({ mostrar_lgpd: v })} />
        <ToggleRow label="Painel de decisão clínica" checked={draft.mostrar_decisao} onChange={v => patch({ mostrar_decisao: v })} />
      </SectionCard>

      {/* Cabeçalho */}
      <SectionCard color="bg-purple-600" title="🟣 Cabeçalho">
        <ToggleRow label="Botão Portal do Paciente" checked={draft.header_portal} onChange={v => patch({ header_portal: v })} />
        <ToggleRow label="Botão Documentos" checked={draft.header_docs} onChange={v => patch({ header_docs: v })} />
        <ToggleRow label="Botão Identidade" checked={draft.header_identidade} onChange={v => patch({ header_identidade: v })} />
      </SectionCard>

      {/* spacer */}
      <div className="h-4" />
    </div>
  );

  // ── Preview ──────────────────────────────────────────────────────────────────
  const Preview = (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b px-4 py-2 flex items-center justify-between bg-muted/30 shrink-0">
        <span className="text-xs font-medium text-muted-foreground">Pré-visualização ao vivo</span>
        <div className="flex gap-1">
          <button
            title="Celular"
            onClick={() => setViewport('mobile')}
            className={cn('p-1.5 rounded', viewport === 'mobile' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          <button
            title="Desktop"
            onClick={() => setViewport('desktop')}
            className={cn('p-1.5 rounded', viewport === 'desktop' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-muted/20 flex items-start justify-center p-4">
        <div
          className={cn(
            'bg-background border rounded-2xl shadow-xl overflow-hidden transition-all duration-300',
            viewport === 'mobile' ? 'w-[375px]' : 'w-full max-w-2xl',
          )}
          style={{ height: 680 }}
        >
          <LivePreview config={draft} />
        </div>
      </div>
    </div>
  );

  // ── Shell ────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">

      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b bg-background shrink-0 z-10">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold leading-tight">Editar Página do Paciente</h1>
          {isDirty && <p className="text-[10px] text-orange-500 leading-tight">Alterações não publicadas</p>}
          {!isDirty && !loading && <p className="text-[10px] text-muted-foreground leading-tight">Layout publicado</p>}
        </div>
        <Button size="sm" variant="outline" onClick={handleReset} className="gap-1.5 h-8 text-xs shrink-0">
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Resetar</span>
        </Button>
        <Button
          size="sm"
          onClick={handlePublish}
          disabled={!isDirty}
          className="gap-1.5 h-8 text-xs shrink-0 bg-green-600 hover:bg-green-700 text-white border-0"
        >
          <Save className="w-3.5 h-3.5" />
          Publicar
        </Button>
      </div>

      {/* Desktop: two columns */}
      <div className="hidden lg:flex flex-1 overflow-hidden">
        <div className="w-[380px] border-r flex flex-col overflow-hidden shrink-0">
          {Controls}
        </div>
        {Preview}
      </div>

      {/* Mobile: tab switcher */}
      <div className="lg:hidden flex flex-col flex-1 overflow-hidden">
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setPanel('controls')}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              panel === 'controls' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground',
            )}
          >
            ⚙ Controles
          </button>
          <button
            onClick={() => setPanel('preview')}
            className={cn(
              'flex-1 py-2.5 text-xs font-medium transition-colors',
              panel === 'preview' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground',
            )}
          >
            👁 Pré-visualização
          </button>
        </div>
        {panel === 'controls' ? (
          <div className="flex flex-col flex-1 overflow-hidden">{Controls}</div>
        ) : (
          <div className="flex flex-1 overflow-hidden">{Preview}</div>
        )}
      </div>

    </div>
  );
}
