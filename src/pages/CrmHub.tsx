import { useEffect, useState, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { cn } from '@/lib/utils';
import { MessageCircle, Kanban, Zap, TrendingUp, Bot, Loader2, Radio } from 'lucide-react';

const CrmInbox = lazy(() => import('./CrmInbox'));
const CrmPipeline = lazy(() => import('./CrmPipeline'));
const CrmCadencias = lazy(() => import('./CrmCadencias'));
const CrmMetricas = lazy(() => import('./CrmMetricas'));
const WhatsappAutomacoes = lazy(() => import('./WhatsappAutomacoes'));
const CrmTrafego = lazy(() => import('./CrmTrafego'));

type TabKey = 'inbox' | 'pipeline' | 'cadencias' | 'metricas' | 'automacoes' | 'trafego';

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
  { key: 'inbox', label: 'WhatsApp', icon: MessageCircle, desc: 'Conversas' },
  { key: 'pipeline', label: 'Pipeline', icon: Kanban, desc: 'Kanban' },
  { key: 'cadencias', label: 'Cadências', icon: Zap, desc: 'Follow-ups' },
  { key: 'metricas', label: 'Métricas', icon: TrendingUp, desc: 'Conversão' },
  { key: 'trafego', label: 'Tráfego', icon: Radio, desc: 'Origem & canais' },
  { key: 'automacoes', label: 'Automações', icon: Bot, desc: 'Bot & regras' },
];

const STORAGE_KEY = 'crm.lastTab';

function isTabKey(value: string | null): value is TabKey {
  return value === 'inbox' || value === 'pipeline' || value === 'cadencias' || value === 'metricas' || value === 'automacoes' || value === 'trafego';
}

interface Props {
  embedded?: boolean;
}

export default function CrmHub({ embedded = false }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab');

  const initial: TabKey = isTabKey(urlTab)
    ? urlTab
    : (isTabKey(typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null)
      ? (window.localStorage.getItem(STORAGE_KEY) as TabKey)
      : 'inbox');

  const [tab, setTab] = useState<TabKey>(initial);

  useEffect(() => {
    if (isTabKey(urlTab) && urlTab !== tab) setTab(urlTab);
  }, [urlTab]);

  const changeTab = (next: TabKey) => {
    setTab(next);
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, next);
    if (!embedded) {
      const sp = new URLSearchParams(searchParams);
      sp.set('tab', next);
      setSearchParams(sp, { replace: true });
    }
  };

  const Wrapper = embedded ? (({ children }: { children: React.ReactNode }) => <>{children}</>) : AppLayout;

  return (
    <Wrapper>
      <div className={cn('flex flex-col md:flex-row w-full', embedded ? '' : 'h-[calc(100dvh-56px)] md:h-[calc(100dvh-64px)]')}>
        {/* Sidebar (desktop) */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border/40 bg-card/30">
          <div className="px-4 py-4 border-b border-border/40">
            <h2 className="text-base font-semibold">CRM</h2>
            <p className="text-micro text-muted-foreground">Vendas & relacionamento</p>
          </div>
          <nav className="flex-1 p-2 space-y-1">
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => changeTab(t.key)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    active
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                  )}
                >
                  <t.icon className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{t.label}</div>
                    <div className="text-[10px] text-muted-foreground/80 truncate">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Tabs (mobile) */}
        <div className="md:hidden border-b border-border/40 bg-card/30 overflow-x-auto sticky top-0 z-10">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => changeTab(t.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors whitespace-nowrap',
                    active
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  <t.icon className="h-3.5 w-3.5 shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          }>
            {tab === 'inbox' && <CrmInbox embedded />}
            {tab === 'pipeline' && <CrmPipeline embedded />}
            {tab === 'cadencias' && <CrmCadencias embedded />}
            {tab === 'metricas' && <CrmMetricas embedded />}
            {tab === 'automacoes' && <WhatsappAutomacoes embedded />}
            {tab === 'trafego' && <CrmTrafego embedded />}
          </Suspense>
        </main>
      </div>
    </Wrapper>
  );
}
