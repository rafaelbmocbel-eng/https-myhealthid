import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Users, LayoutDashboard, PartyPopper, BookOpen, DollarSign,
  Tag, Settings, MessageCircle, CalendarDays, ShieldCheck,
} from 'lucide-react';
import { useEquipeCientifica } from '@/hooks/useEquipeCientifica';
import { ROTA_CHANCELA } from '@/lib/chancela';

export type AtalhoId =
  | 'pacientes' | 'dashboard' | 'eventos' | 'base-cientifica'
  | 'financeiro' | 'planos' | 'config' | 'crm' | 'agenda' | 'chancela';

export interface AtalhoDef {
  id: AtalhoId;
  label: string;
  icon: any;
  to: string;
  descricao: string;
  /** Só aparece (no catálogo e na home) para a equipe científica MyHealthID. */
  somenteEquipe?: boolean;
}

export const ATALHOS_CATALOGO: AtalhoDef[] = [
  { id: 'pacientes',       label: 'Pacientes',       icon: Users,          to: '/pacientes',       descricao: 'Lista e gestão de pacientes' },
  { id: 'dashboard',       label: 'Dashboard',       icon: LayoutDashboard, to: '/inicio-app',     descricao: 'Visão geral da clínica' },
  { id: 'eventos',         label: 'Eventos',         icon: PartyPopper,    to: '/eventos',         descricao: 'Cursos, mentorias e eventos' },
  { id: 'base-cientifica', label: 'Base Científica', icon: BookOpen,       to: '/base-cientifica', descricao: 'Referências e evidências' },
  { id: 'financeiro',      label: 'Financeiro',      icon: DollarSign,     to: '/financeiro',      descricao: 'Recebimentos e relatórios' },
  { id: 'planos',          label: 'Planos',          icon: Tag,            to: '/precos',          descricao: 'Assinaturas e upgrades' },
  { id: 'config',          label: 'Configurações',   icon: Settings,       to: '/configuracoes',   descricao: 'Ajustes do sistema' },
  { id: 'crm',             label: 'CRM Inbox',       icon: MessageCircle,  to: '/crm?tab=inbox',   descricao: 'Conversas do WhatsApp' },
  { id: 'agenda',          label: 'Agenda',          icon: CalendarDays,   to: '/agenda',          descricao: 'Calendário e sessões' },
  { id: 'chancela',        label: 'Fila de chancela', icon: ShieldCheck,   to: ROTA_CHANCELA,      descricao: 'Planos de clientes aguardando a equipe científica', somenteEquipe: true },
];

const STORAGE_KEY = 'home-atalhos-v1';
const DEFAULT_ATALHOS: AtalhoId[] = [
  'pacientes', 'dashboard', 'eventos', 'base-cientifica',
  'financeiro', 'planos', 'config',
];
// Quem é da equipe científica já recebe a fila de chancela entre os atalhos padrão.
const DEFAULT_ATALHOS_EQUIPE: AtalhoId[] = [...DEFAULT_ATALHOS, 'chancela'];

/** Lista salva pelo usuário; null = nunca personalizou (vale o padrão). */
function readStorage(): AtalhoId[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id: any) =>
      ATALHOS_CATALOGO.some(a => a.id === id)
    ) as AtalhoId[];
  } catch {
    return null;
  }
}

function writeStorage(ids: AtalhoId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Armazenamento indisponível (modo privado/cota): a escolha vale só nesta sessão.
  }
}

export function useHomeAtalhos() {
  const { ehEquipe } = useEquipeCientifica();
  const [salvos, setSalvos] = useState<AtalhoId[] | null>(() => readStorage());
  const padrao = ehEquipe ? DEFAULT_ATALHOS_EQUIPE : DEFAULT_ATALHOS;
  const ativos = salvos ?? padrao;

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSalvos(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((id: AtalhoId) => {
    setSalvos(prev => {
      const atual = prev ?? padrao;
      const next = atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id];
      writeStorage(next);
      return next;
    });
  }, [padrao]);

  const reset = useCallback(() => {
    writeStorage(padrao);
    setSalvos(padrao);
  }, [padrao]);

  const catalogo = useMemo(
    () => ATALHOS_CATALOGO.filter(a => !a.somenteEquipe || ehEquipe),
    [ehEquipe],
  );

  const itens = catalogo.filter(a => ativos.includes(a.id))
    .sort((a, b) => ativos.indexOf(a.id) - ativos.indexOf(b.id));

  return { ativos, itens, toggle, reset, catalogo };
}
