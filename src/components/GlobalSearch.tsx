import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, Users, CalendarDays, Settings, MessageSquare, FileText,
  Search, User, PartyPopper, BookOpen, DollarSign, Tag, Inbox, GitBranch,
  Zap, BarChart3, Target, Wrench, UserPlus, CalendarPlus, Plug, Bell,
  ShieldCheck, Stethoscope, Home, ClipboardList, Activity, Workflow,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

type NavItem = {
  label: string;
  href: string;
  icon: any;
  keywords: string;
  group: 'Páginas' | 'CRM' | 'Configurações' | 'Ações';
};

const ITEMS: NavItem[] = [
  // Páginas principais
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

  // CRM
  { label: 'CRM · Inbox WhatsApp', href: '/crm?tab=inbox', icon: Inbox, keywords: 'whatsapp conversa mensagem chat', group: 'CRM' },
  { label: 'CRM · Pipeline', href: '/crm?tab=pipeline', icon: GitBranch, keywords: 'funil vendas lead oportunidade kanban', group: 'CRM' },
  { label: 'CRM · Cadências', href: '/crm?tab=cadencias', icon: Workflow, keywords: 'automacao sequencia followup', group: 'CRM' },
  { label: 'CRM · Métricas', href: '/crm?tab=metricas', icon: BarChart3, keywords: 'kpi conversao analise', group: 'CRM' },
  { label: 'CRM · Tráfego', href: '/crm?tab=trafego', icon: Target, keywords: 'utm origem pixel instagram links', group: 'CRM' },
  { label: 'CRM · Automações', href: '/crm?tab=automacoes', icon: Zap, keywords: 'whatsapp template automatico mensagem', group: 'CRM' },

  // Configurações (abas internas)
  { label: 'Configurações · Home', href: '/configuracoes?tab=home', icon: Home, keywords: 'atalhos personalizar', group: 'Configurações' },
  { label: 'Configurações · Clínica', href: '/configuracoes?tab=clinica', icon: Settings, keywords: 'empresa dados', group: 'Configurações' },
  { label: 'Configurações · Agenda', href: '/configuracoes?tab=agenda', icon: CalendarDays, keywords: 'horario disponibilidade', group: 'Configurações' },
  { label: 'Configurações · Equipe', href: '/configuracoes?tab=equipe', icon: Users, keywords: 'profissionais membros usuarios', group: 'Configurações' },
  { label: 'Configurações · Base Científica', href: '/configuracoes?tab=base-cientifica', icon: BookOpen, keywords: 'evidencia pubmed', group: 'Configurações' },
  { label: 'Configurações · Convênios', href: '/configuracoes?tab=convenios', icon: ShieldCheck, keywords: 'plano saude seguro', group: 'Configurações' },
  { label: 'Configurações · Serviços', href: '/configuracoes?tab=servicos', icon: Wrench, keywords: 'precos atendimento sessao', group: 'Configurações' },
  { label: 'Configurações · Notificações', href: '/configuracoes?tab=notificacoes', icon: Bell, keywords: 'alertas avisos', group: 'Configurações' },
  { label: 'Configurações · Integrações', href: '/configuracoes?tab=integracoes', icon: Plug, keywords: 'whatsapp api conector', group: 'Configurações' },

  // Ações rápidas
  { label: 'Novo paciente', href: '/pacientes?novo=1', icon: UserPlus, keywords: 'criar cadastrar adicionar cliente', group: 'Ações' },
  { label: 'Novo agendamento', href: '/agenda?novo=1', icon: CalendarPlus, keywords: 'criar marcar sessao consulta', group: 'Ações' },
  { label: 'Novo evento', href: '/eventos?novo=1', icon: PartyPopper, keywords: 'criar workshop curso', group: 'Ações' },
];

interface PatientResult { id: string; nome: string; sobrenome: string; }
interface EventoResult { id: string; titulo: string; }
interface AgendamentoResult { id: string; titulo: string | null; data_inicio: string; }

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<PatientResult[]>([]);
  const [eventos, setEventos] = useState<EventoResult[]>([]);
  const [agendamentos, setAgendamentos] = useState<AgendamentoResult[]>([]);
  const navigate = useNavigate();
  const { user } = useAuth();

  // ⌘K / Ctrl+K shortcut
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

  // Search dynamic data (patients, events, appointments) when query changes
  useEffect(() => {
    if (!user || query.length < 2) {
      setPatients([]); setEventos([]); setAgendamentos([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const like = `%${query}%`;
      const [pac, evt, agd] = await Promise.all([
        supabase.from('pacientes')
          .select('id, nome, sobrenome')
          .eq('terapeuta_id', user.id)
          .or(`nome.ilike.${like},sobrenome.ilike.${like}`)
          .limit(6),
        supabase.from('eventos')
          .select('id, titulo')
          .eq('terapeuta_id', user.id)
          .ilike('titulo', like)
          .limit(4),
        supabase.from('agendamentos')
          .select('id, titulo, data_inicio')
          .eq('terapeuta_id', user.id)
          .ilike('titulo', like)
          .order('data_inicio', { ascending: false })
          .limit(4),
      ]);
      setPatients(pac.data || []);
      setEventos(evt.data || []);
      setAgendamentos(agd.data || []);
    }, 220);
    return () => clearTimeout(timeout);
  }, [query, user]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
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

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border/50 bg-card/60 text-muted-foreground text-sm hover:bg-card hover:border-border transition-all"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden sm:inline">Buscar qualquer coisa...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 text-[10px] font-mono text-muted-foreground">
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
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          {patients.length > 0 && (
            <>
              <CommandGroup heading="Pacientes">
                {patients.map(p => (
                  <CommandItem key={p.id} onSelect={() => go(`/pacientes/${p.id}`)} className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{p.nome} {p.sobrenome}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {eventos.length > 0 && (
            <>
              <CommandGroup heading="Eventos">
                {eventos.map(e => (
                  <CommandItem key={e.id} onSelect={() => go(`/eventos`)} className="flex items-center gap-2">
                    <PartyPopper className="h-4 w-4 text-muted-foreground" />
                    <span>{e.titulo}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {agendamentos.length > 0 && (
            <>
              <CommandGroup heading="Agendamentos">
                {agendamentos.map(a => (
                  <CommandItem key={a.id} onSelect={() => go(`/agenda`)} className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{a.titulo || 'Sessão'}</span>
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {new Date(a.data_inicio).toLocaleDateString('pt-BR')}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
            </>
          )}

          {(['Ações', 'Páginas', 'CRM', 'Configurações'] as const).map(g =>
            grouped[g].length > 0 ? (
              <CommandGroup key={g} heading={g}>
                {grouped[g].map(item => (
                  <CommandItem key={item.href} onSelect={() => go(item.href)} className="flex items-center gap-2">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span>{item.label}</span>
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
