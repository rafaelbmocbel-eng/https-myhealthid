import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  ArrowLeft, Save, RotateCcw, ChevronUp, ChevronDown,
  Eye, EyeOff, Merge, SplitSquareHorizontal,
  Activity, Target, ClipboardList, Smartphone, FileText,
  Fingerprint, Stethoscope, Rocket, LayoutTemplate,
} from 'lucide-react';
import {
  useLayoutConfig,
  DEFAULT_LAYOUT_CONFIG,
  type LayoutConfig,
  type TabConfig,
} from '@/hooks/useLayoutConfig';
import { useToast } from '@/hooks/use-toast';

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

const SIZE_OPTIONS: { value: 'sm' | 'md' | 'lg'; label: string }[] = [
  { value: 'sm', label: 'P' },
  { value: 'md', label: 'M' },
  { value: 'lg', label: 'G' },
];

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-xs overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function TabRow({
  tab,
  index,
  total,
  onChange,
  onMove,
}: {
  tab: TabConfig;
  index: number;
  total: number;
  onChange: (updated: TabConfig) => void;
  onMove: (from: number, to: number) => void;
}) {
  const Icon = TAB_ICONS[tab.id] || Activity;
  return (
    <div className={cn(
      'flex items-center gap-2 p-2.5 rounded-xl border transition-colors',
      tab.visivel ? 'border-border/50 bg-background' : 'border-border/30 bg-muted/40 opacity-60',
    )}>
      <div className="flex flex-col gap-0.5 shrink-0">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
          className="p-0.5 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />

      <Input
        value={tab.label}
        onChange={e => onChange({ ...tab, label: e.target.value })}
        className="h-7 text-sm flex-1 min-w-0 border-0 bg-transparent px-1 focus-visible:ring-0 focus-visible:bg-muted/40 rounded"
        placeholder={tab.defaultLabel}
      />

      <button
        type="button"
        onClick={() => onChange({ ...tab, visivel: !tab.visivel })}
        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        title={tab.visivel ? 'Ocultar aba' : 'Mostrar aba'}
      >
        {tab.visivel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </button>
    </div>
  );
}

function BotaoPreview({ config }: { config: LayoutConfig }) {
  const sizeClass = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-sm',
  };

  if (!config.botao_presencial.visivel && !config.botao_resposta_completa.visivel) {
    return (
      <div className="flex items-center justify-center h-14 rounded-xl border border-dashed border-border/40 bg-muted/20">
        <span className="text-[11px] text-muted-foreground italic">Nenhum botão visível</span>
      </div>
    );
  }

  if (config.botoes_unidos) {
    return (
      <div className="flex justify-center">
        <div className={cn(
          'rounded-xl font-semibold bg-primary text-primary-foreground shadow-sm',
          sizeClass[config.botao_presencial.tamanho],
        )}>
          {config.botao_presencial.label}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 justify-between">
      {config.botao_presencial.visivel && (
        <div className={cn(
          'rounded-xl font-semibold bg-primary text-primary-foreground shadow-sm',
          sizeClass[config.botao_presencial.tamanho],
        )}>
          {config.botao_presencial.label}
        </div>
      )}
      {config.botao_resposta_completa.visivel && (
        <div className={cn(
          'rounded-xl font-semibold border border-border bg-background text-foreground',
          sizeClass[config.botao_resposta_completa.tamanho],
        )}>
          {config.botao_resposta_completa.label}
        </div>
      )}
    </div>
  );
}

function TabsPreview({ tabs, gridCols }: { tabs: TabConfig[]; gridCols: string }) {
  const visible = tabs.filter(t => t.visivel);
  if (visible.length === 0) {
    return (
      <div className="flex items-center justify-center h-10 rounded-xl border border-dashed border-border/40 bg-muted/20">
        <span className="text-[10px] text-muted-foreground italic">Nenhuma aba visível</span>
      </div>
    );
  }
  return (
    <div className={cn('grid gap-0.5 bg-muted/50 rounded-xl p-1', gridCols)}>
      {visible.map((t, i) => {
        const Icon = TAB_ICONS[t.id] || Activity;
        return (
          <div
            key={t.id}
            className={cn(
              'flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-[10px] font-semibold',
              i === 0 ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="truncate max-w-full px-0.5">{t.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function LayoutEditor() {
  const navigate = useNavigate();
  const { config: saved, save, reset } = useLayoutConfig();
  const { toast } = useToast();
  const [draft, setDraft] = useState<LayoutConfig>(() => JSON.parse(JSON.stringify(saved)));

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function handleSave() {
    save(draft);
    toast({ title: 'Layout salvo!', description: 'As mudanças aparecem imediatamente nos perfis de pacientes.' });
  }

  function handleReset() {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_LAYOUT_CONFIG));
    setDraft(fresh);
    reset();
    toast({ title: 'Layout resetado para o padrão.' });
  }

  function updateMainTab(index: number, updated: TabConfig) {
    const tabs = [...draft.main_tabs];
    tabs[index] = updated;
    setDraft({ ...draft, main_tabs: tabs });
  }

  function moveMainTab(from: number, to: number) {
    const tabs = [...draft.main_tabs];
    const [item] = tabs.splice(from, 1);
    tabs.splice(to, 0, item);
    setDraft({ ...draft, main_tabs: tabs.map((t, i) => ({ ...t, ordem: i })) });
  }

  function updateSubTab(index: number, updated: TabConfig) {
    const tabs = [...draft.sub_tabs];
    tabs[index] = updated;
    setDraft({ ...draft, sub_tabs: tabs });
  }

  function moveSubTab(from: number, to: number) {
    const tabs = [...draft.sub_tabs];
    const [item] = tabs.splice(from, 1);
    tabs.splice(to, 0, item);
    setDraft({ ...draft, sub_tabs: tabs.map((t, i) => ({ ...t, ordem: i })) });
  }

  const visibleMainCount = draft.main_tabs.filter(t => t.visivel).length;
  const visibleSubCount = draft.sub_tabs.filter(t => t.visivel).length;

  const mainGridCols = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3', 'grid-cols-4', 'grid-cols-5'][Math.min(visibleMainCount, 5)] || 'grid-cols-5';
  const subGridCols = ['', 'grid-cols-1', 'grid-cols-2', 'grid-cols-3'][Math.min(visibleSubCount, 3)] || 'grid-cols-3';

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 pb-16 pt-2 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 py-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-4 h-4 text-primary shrink-0" />
              <h1 className="text-base font-bold leading-tight">Editor de Layout</h1>
            </div>
            <p className="text-[11px] text-muted-foreground">Perfil do paciente</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-muted-foreground h-8"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden xs:inline">Resetar</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!isDirty}
              className="gap-1.5 h-8"
            >
              <Save className="w-3.5 h-3.5" />
              Salvar
            </Button>
          </div>
        </div>

        {/* Section 1: Botões de Ação */}
        <SectionCard title="Botões de Ação">
          {/* Preview */}
          <div className="bg-muted/30 rounded-xl p-3 border border-border/30">
            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Prévia</p>
            <BotaoPreview config={draft} />
          </div>

          {/* Unir botões */}
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-semibold">Unir em um único botão</Label>
              <p className="text-[11px] text-muted-foreground">Combina os dois botões em um só</p>
            </div>
            <Switch
              checked={draft.botoes_unidos}
              onCheckedChange={v => setDraft({ ...draft, botoes_unidos: v })}
            />
          </div>

          <div className="h-px bg-border/40" />

          {/* Botão presencial */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">
                {draft.botoes_unidos ? 'Botão único' : 'Iniciar Avaliação Presencial'}
              </Label>
              {!draft.botoes_unidos && (
                <button
                  type="button"
                  onClick={() => setDraft({
                    ...draft,
                    botao_presencial: { ...draft.botao_presencial, visivel: !draft.botao_presencial.visivel },
                  })}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {draft.botao_presencial.visivel
                    ? <Eye className="w-4 h-4" />
                    : <EyeOff className="w-4 h-4" />}
                </button>
              )}
            </div>

            <Input
              value={draft.botao_presencial.label}
              onChange={e => setDraft({
                ...draft,
                botao_presencial: { ...draft.botao_presencial, label: e.target.value },
              })}
              placeholder="Nome do botão"
              className="h-8 text-sm"
            />

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Tamanho:</span>
              <div className="flex gap-1">
                {SIZE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraft({
                      ...draft,
                      botao_presencial: { ...draft.botao_presencial, tamanho: opt.value },
                    })}
                    className={cn(
                      'w-8 h-7 rounded-lg text-xs font-bold border transition-colors',
                      draft.botao_presencial.tamanho === opt.value
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Botão resposta completa — só quando não estiver unido */}
          {!draft.botoes_unidos && (
            <>
              <div className="h-px bg-border/40" />
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Resposta Completa</Label>
                  <button
                    type="button"
                    onClick={() => setDraft({
                      ...draft,
                      botao_resposta_completa: {
                        ...draft.botao_resposta_completa,
                        visivel: !draft.botao_resposta_completa.visivel,
                      },
                    })}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {draft.botao_resposta_completa.visivel
                      ? <Eye className="w-4 h-4" />
                      : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>

                <Input
                  value={draft.botao_resposta_completa.label}
                  onChange={e => setDraft({
                    ...draft,
                    botao_resposta_completa: { ...draft.botao_resposta_completa, label: e.target.value },
                  })}
                  placeholder="Nome do botão"
                  className="h-8 text-sm"
                />

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">Tamanho:</span>
                  <div className="flex gap-1">
                    {SIZE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDraft({
                          ...draft,
                          botao_resposta_completa: { ...draft.botao_resposta_completa, tamanho: opt.value },
                        })}
                        className={cn(
                          'w-8 h-7 rounded-lg text-xs font-bold border transition-colors',
                          draft.botao_resposta_completa.tamanho === opt.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border text-muted-foreground hover:border-primary/50',
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SectionCard>

        {/* Section 2: Sub-abas */}
        <SectionCard title="Sub-abas (MyID · Corpo · Jornada)">
          <div className="bg-muted/30 rounded-xl p-3 border border-border/30">
            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Prévia</p>
            <TabsPreview tabs={draft.sub_tabs} gridCols={subGridCols} />
          </div>

          <div className="space-y-2">
            {draft.sub_tabs.map((tab, i) => (
              <TabRow
                key={tab.id}
                tab={tab}
                index={i}
                total={draft.sub_tabs.length}
                onChange={updated => updateSubTab(i, updated)}
                onMove={moveSubTab}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Use as setas para reordenar. Clique no olho para ocultar.
          </p>
        </SectionCard>

        {/* Section 3: Abas Principais */}
        <SectionCard title="Abas Principais">
          <div className="bg-muted/30 rounded-xl p-3 border border-border/30">
            <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide font-semibold">Prévia</p>
            <TabsPreview tabs={draft.main_tabs} gridCols={mainGridCols} />
          </div>

          <div className="space-y-2">
            {draft.main_tabs.map((tab, i) => (
              <TabRow
                key={tab.id}
                tab={tab}
                index={i}
                total={draft.main_tabs.length}
                onChange={updated => updateMainTab(i, updated)}
                onMove={moveMainTab}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Use as setas para reordenar. Clique no olho para ocultar.
          </p>
        </SectionCard>

        {/* Section 4: Botões do Cabeçalho */}
        <SectionCard title="Cabeçalho — Botões de Ação Rápida">
          {(
            [
              { key: 'header_portal', label: 'Portal', desc: 'Enviar link do portal ao paciente' },
              { key: 'header_docs', label: 'Docs', desc: 'Atestados, recibos e declarações' },
              { key: 'header_identidade', label: 'Identidade', desc: 'PDF e MyID portátil' },
            ] as const
          ).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold">{label}</Label>
                <p className="text-[11px] text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={draft[key]}
                onCheckedChange={v => setDraft({ ...draft, [key]: v })}
              />
            </div>
          ))}
        </SectionCard>

        {/* Salvar flutuante */}
        {isDirty && (
          <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <Button
              size="lg"
              onClick={handleSave}
              className="pointer-events-auto shadow-xl gap-2 rounded-2xl"
            >
              <Save className="w-4 h-4" />
              Salvar alterações
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
