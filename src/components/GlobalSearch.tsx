import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard, Users, CalendarDays, ClipboardList, AlignCenter,
  Settings, Sparkles, MessageSquare, FileText, Search, User, PartyPopper,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const PAGES = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, keywords: 'início home' },
  { label: 'Pacientes', href: '/pacientes', icon: Users, keywords: 'lista clientes' },
  { label: 'Método Identidade', href: '/metodo-identidade', icon: ClipboardList, keywords: 'avaliação' },
  { label: 'COB° ZERO', href: '/cob-zero', icon: AlignCenter, keywords: 'escoliose cobb' },
  { label: 'Studio Personal ID', href: '/studio-personal-id', icon: Sparkles, keywords: 'treino exercício' },
  { label: 'Agenda', href: '/agenda', icon: CalendarDays, keywords: 'calendário horário' },
  { label: 'Gestão & CRM', href: '/crm', icon: MessageSquare, keywords: 'vendas funil leads' },
  { label: 'Eventos', href: '/eventos', icon: PartyPopper, keywords: 'evento workshop recovery inscrição' },
  { label: 'Relatórios', href: '/relatorios', icon: FileText, keywords: 'report pdf' },
  { label: 'Configurações', href: '/configuracoes', icon: Settings, keywords: 'config perfil conta' },
];

interface PatientResult {
  id: string;
  nome: string;
  sobrenome: string;
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<PatientResult[]>([]);
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

  // Search patients when query changes
  useEffect(() => {
    if (!user || query.length < 2) {
      setPatients([]);
      return;
    }
    const timeout = setTimeout(async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome')
        .eq('terapeuta_id', user.id)
        .or(`nome.ilike.%${query}%,sobrenome.ilike.%${query}%`)
        .limit(8);
      setPatients(data || []);
    }, 250);
    return () => clearTimeout(timeout);
  }, [query, user]);

  const filteredPages = useMemo(() => {
    if (!query) return PAGES;
    const q = query.toLowerCase();
    return PAGES.filter(
      p => p.label.toLowerCase().includes(q) || p.keywords.includes(q)
    );
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
        className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border/50 bg-card/60 text-muted-foreground text-sm hover:bg-card hover:border-border transition-all"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Buscar...</span>
        <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border/60 bg-muted/50 px-1.5 text-[10px] font-mono text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Buscar paciente, página ou ação..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>

          {patients.length > 0 && (
            <CommandGroup heading="Pacientes">
              {patients.map(p => (
                <CommandItem
                  key={p.id}
                  onSelect={() => go(`/pacientes/${p.id}`)}
                  className="flex items-center gap-2"
                >
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span>{p.nome} {p.sobrenome}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {patients.length > 0 && filteredPages.length > 0 && <CommandSeparator />}

          <CommandGroup heading="Páginas">
            {filteredPages.map(page => (
              <CommandItem
                key={page.href}
                onSelect={() => go(page.href)}
                className="flex items-center gap-2"
              >
                <page.icon className="h-4 w-4 text-muted-foreground" />
                <span>{page.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
