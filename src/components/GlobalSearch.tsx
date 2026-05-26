import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, Users, CalendarDays, Settings, Search, User, PartyPopper,
  BookOpen, DollarSign, Tag, Inbox, GitBranch, Zap, BarChart3, Target, Wrench,
  UserPlus, CalendarPlus, Plug, Bell, ShieldCheck, Stethoscope, Home, Workflow,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

/* ─── Types ─── */
type NavItem = {
  label: string;
  href: string;
  icon: any;
  keywords: string;
  group: 'Páginas' | 'CRM' | 'Configurações' | 'Ações';
};

interface PatientResult { id: string; nome: string; sobrenome: string; }
interface EventoResult { id: string; titulo: string; }
interface AgendamentoResult { id: string; titulo: string | null; data_inicio: string; }

/* ─── Static nav items ─── */
const ITEMS: NavItem[] = [
  { label: 'Home', href: '/hoje', icon: Home, keywords: 'inicio hoje dashboard atalhos', group: 'Páginas' },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays, keywords: 'calendario horario sessao consulta', group: 'Páginas' },
  { label: 'Pacientes', href: '/pacientes', icon: Users, keywords: 'clientes lista cadastro', group: 'Páginas' },
  { label: 'Eventos', href: '/eventos', icon: PartyPopper, keywords: 'workshop curso mentoria inscricao', group: 'Páginas' },
  { label: 'Base Científica', href: '/base-cientifica', icon: BookOpen, keywords: 'evidencia pubmed estudo artigo pesquisa', group: 'Páginas' },
  { label: 'Dashboard', href: '/inicio-app', icon: LayoutDashboard, keywords: 'visao geral metricas', group: 'Páginas' },
  { label: 'Financeiro', href: '/pacientes?tab=financeiro', icon: DollarSign, keywords: 'pagamento receita faturamento dinheiro', group: 'Páginas' },
  { label: 'Auditoria', href: '/pacientes?tab=auditoria', icon: ShieldCheck, keywords: 'historico logs', group: 'Páginas' },
  { label: 'Planos', href: '/precos', icon: Tag, keywords: 'assinatura preco upgrade essencial profissional clinica', group: 'Páginas' },
  { label: 'Demo MyID', href: '/demo', icon: Stethoscope, keywords: 'apresentacao avaliacao demonstracao', group: 'Páginas' },

  { label: 'CRM · Inbox WhatsApp', href: '/crm?tab=inbox', icon: Inbox, keywords: 'whatsapp conversa mensagem chat', group: 'CRM' },
  { label: 'CRM · Pipeline', href: '/crm?tab=pipeline', icon: GitBranch, keywords: 'funil vendas lead oportunidade kanban', group: 'CRM' },
  { label: 'CRM · Cadências', href: '/crm?tab=cadencias', icon: Workflow, keywords: 'automacao sequencia followup', group: 'CRM' },
  { label: 'CRM · Métricas', href: '/crm?tab=metricas', icon: BarChart3, keywords: 'kpi conversao analise', group: 'CRM' },
  { label: 'CRM · Tráfego', href: '/crm?tab=trafego', icon: Target, keywords: 'utm origem pixel instagram links', group: 'CRM' },
  { label: 'CRM · Automações', href: '/crm?tab=automacoes', icon: Zap, keywords: 'whatsapp template automatico mensagem', group: 'CRM' },

  { label: 'Configurações · Home', href: '/configuracoes?tab=home', icon: Home, keywords: 'atalhos personalizar', group: 'Configurações' },
  { label: 'Configurações · Clínica', href: '/configuracoes?tab=clinica', icon: Settings, keywords: 'empresa dados', group: 'Configurações' },
  { label: 'Configurações · Agenda', href: '/configuracoes?tab=agenda', icon: CalendarDays, keywords: 'horario disponibilidade', group: 'Configurações' },
  { label: 'Configurações · Equipe', href: '/configuracoes?tab=equipe', icon: Users, keywords: 'profissionais membros usuarios', group: 'Configurações' },
  { label: 'Configurações · Base Científica', href: '/configuracoes?tab=base-cientifica', icon: BookOpen, keywords: 'evidencia pubmed', group: 'Configurações' },
  { label: 'Configurações · Convênios', href: '/configuracoes?tab=convenios', icon: ShieldCheck, keywords: 'plano saude seguro', group: 'Configurações' },
  { label: 'Configurações · Serviços', href: '/configuracoes?tab=servicos', icon: Wrench, keywords: 'precos atendimento sessao', group: 'Configurações' },
  { label: 'Configurações · Notificações', href: '/configuracoes?tab=notificacoes', icon: Bell, keywords: 'alertas avisos', group: 'Configurações' },
  { label: 'Configurações · Integrações', href: '/configuracoes?tab=integracoes', icon: Plug, keywords: 'whatsapp api conector', group: 'Configurações' },

  { label: 'Novo paciente', href: '/pacientes?novo=1', icon: UserPlus, keywords: 'criar cadastrar adicionar cliente', group: 'Ações' },
  { label: 'Novo agendamento', href: '/agenda?novo=1', icon: CalendarPlus, keywords: 'criar marcar sessao consulta', group: 'Ações' },
  { label: 'Novo evento', href: '/eventos?novo=1', icon: PartyPopper, keywords: 'criar workshop curso', group: 'Ações' },
];

/* ─── Highlight matched text ─── */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return <>{text}</>;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <span className="bg-primary/15 text-primary font-semibold rounded-sm px-0.5">{match}</span>
      {after}
    </>
  );
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [eventos, setEventos] = useState<EventoResult[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoResult[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();

  /* ⌘K shortcut */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  /* Fetch recent patients when dialog opens (warm-up) */
  const fetchRecentPatients = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pacientes')
      .select('id, nome, sobrenome')
      .eq('terapeuta_id', user.id)
      .eq('ativo', true)
      .order('nome')
      .limit(6);
    setPatients(data || []);
  }, [user]);

  useEffect(() => {
    if (open) fetchRecentPatients();
  }, [open, fetchRecentPatients]);

  /* Search-as-you-type: dynamic data */
  useEffect(() => {
    if (!user) return;

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const q = query.trim();
    if (q.length === 0) {
      // Back to recent patients
      fetchRecentPatients();
      return;
    }

    setLoading(true);
    const like = `%${q}%`;
    // Instant response for first letter; tiny debounce for longer queries
    const delay = q.length === 1 ? 0 : 80;

    const timeout = setTimeout(async () => {
      try {
        const [pac, evt, agd] = await Promise.all([
          supabase.from('pacientes')
            .select('id, nome, sobrenome')
            .eq('terapeuta_id', user.id)
            .or(`nome.ilike.${like},sobrenome.ilike.${like}`)
            .order('nome')
            .limit(q.length === 1 ? 12 : 8),
          supabase.from('eventos')
            .select('id, titulo')
            .eq('terapeuta_id', user.id)
            .ilike('titulo', like)
            .limit(q.length === 1 ? 8 : 4),
          supabase.from('agendamentos')
            .select('id, titulo, data_inicio')
            .eq('terapeuta_id', user.id)
            .ilike('titulo', like)
            .order('data_inicio', { ascending: false })
            .limit(q.length === 1 ? 8 : 4),
        ]);
        if (!controller.signal.aborted) {
          setPatients(pac.data || []);
          setEventos(evt.data || []);
          setAgendamentos(agd.data || []);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, delay);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, user, fetchRecentPatients]);

  /* Static item filter */
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 1) {
      // Show all nav items when user types just 1 char (discoverability)
      const match = (i: NavItem) =>
        i.label.toLowerCase().startsWith(q) || i.keywords.startsWith(q);
      return {
        Páginas: ITEMS.filter(i => i.group === 'Páginas' && match(i)),
        CRM: ITEMS.filter(i => i.group === 'CRM' && match(i)),
        Configurações: ITEMS.filter(i => i.group === 'Configurações' && match(i)),
        Ações: ITEMS.filter(i => i.group === 'Ações' && match(i)),
      };
    }
    if (q.length < 2) {
      return { Páginas: [], CRM: [], Configurações: [], Ações: [] };
    }
    const match = (i: NavItem) =>
      i.label.toLowerCase().includes(q) || i.keywords.includes(q);
    return {
      Páginas: ITEMS.filter(i => i.group === 'Páginas' && match(i)),
      CRM: ITEMS.filter(i => i.group === 'CRM' && match(i)),
      Configurações: ITEMS.filter(i => i.group === 'Configurações' && match(i)),
      Ações: ITEMS.filter(i => i.group === 'Ações' && match(i)),
    };
  }, [query]);

  const go = (path: string) => {
    setOpen(false);
    setQuery('');
    navigate(path);
  };

  const hasAnyResult =
    patients.length > 0 ||
    eventos.length > 0 ||
    agendamentos.length > 0 ||
    grouped.Páginas.length > 1 ||
    grouped.CRM.length > 0 ||
    grouped.Configurações.length > 0 ||
    grouped.Ações.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border/50 bg-card/60 text-muted-foreground text-sm hover:bg-card hover:border-border transition-all"
      >
        <Search className="icon-sm shrink-0" />
        <span className="hidden sm:inline">Buscar qualquer coisa...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-1 rounded border border-border/60 bg-muted/50 px-1.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar paciente, evento, página, ação..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando…
            </div>
          )}

          {/* Empty state only when not loading and no results */}
          {!loading && !hasAnyResult && (
            <CommandEmpty>
              {query.trim().length > 0
                ? 'Nenhum resultado encontrado.'
                : 'Digite para buscar pacientes, eventos, páginas…'}
            </CommandEmpty>
          )}

          {/* Patients */}
          {patients.length > 0 && (
            <>
              <CommandGroup heading={query.trim() ? 'Pacientes' : 'Pacientes recentes'}>
                {patients.map(p => (
                  <CommandItem
                    key={p.id}
                    onSelect={() => go(`/pacientes/${p.id}`)}
                    className="flex items-center gap-2"
                  >
                    <User className="icon-sm text-muted-foreground shrink-0" />
                    <span>
                      <Highlight text={`${p.nome} ${p.sobrenome || ''}`.trim()} query={query} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Eventos */}
          {eventos.length > 0 && (
            <>
              <CommandGroup heading="Eventos">
                {eventos.map(e => (
                  <CommandItem
                    key={e.id}
                    onSelect={() => go(`/eventos`)}
                    className="flex items-center gap-2"
                  >
                    <PartyPopper className="icon-sm text-muted-foreground shrink-0" />
                    <span>
                      <Highlight text={e.titulo} query={query} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Agendamentos */}
          {agendamentos.length > 0 && (
            <>
              <CommandGroup heading="Agendamentos">
                {agendamentos.map(a => (
                  <CommandItem
                    key={a.id}
                    onSelect={() => go(`/agenda`)}
                    className="flex items-center gap-2"
                  >
                    <CalendarDays className="icon-sm text-muted-foreground shrink-0" />
                    <span className="truncate">
                      <Highlight text={a.titulo || 'Sessão'} query={query} />
                    </span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {new Date(a.data_inicio).toLocaleDateString('pt-BR')}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {/* Static nav groups */}
          {(['Ações', 'Páginas', 'CRM', 'Configurações'] as const).map(g =>
            grouped[g].length > 0 ? (
              <CommandGroup key={g} heading={g}>
                {grouped[g].map(item => (
                  <CommandItem
                    key={item.href}
                    onSelect={() => go(item.href)}
                    className="flex items-center gap-2"
                  >
                    <item.icon className="icon-sm text-muted-foreground shrink-1" />
                    <span>
                      <Highlight text={item.label} query={query} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
