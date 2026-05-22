import { useEffect, useState, useCallback } from 'react';
import {
  Users, LayoutDashboard, PartyPopper, BookOpen, DollarSign,
  Tag, Settings, MessageCircle, CalendarDays,
} from 'lucide-react';

export type AtalhoId =
  | 'pacientes' | 'dashboard' | 'eventos' | 'base-cientifica'
  | 'financeiro' | 'planos' | 'config' | 'crm' | 'agenda';

export interface AtalhoDef {
  id: AtalhoId;
  label: string;
  icon: any;
  to: string;
  descricao: string;
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
];

const STORAGE_KEY = 'home-atalhos-v1';
const DEFAULT_ATALHOS: AtalhoId[] = [
  'pacientes', 'dashboard', 'eventos', 'base-cientifica',
  'financeiro', 'planos', 'config',
];

function readStorage(): AtalhoId[] {
  if (typeof window === 'undefined') return DEFAULT_ATALHOS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ATALHOS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_ATALHOS;
    return parsed.filter((id: any) =>
      ATALHOS_CATALOGO.some(a => a.id === id)
    ) as AtalhoId[];
  } catch {
    return DEFAULT_ATALHOS;
  }
}

export function useHomeAtalhos() {
  const [ativos, setAtivos] = useState<AtalhoId[]>(() => readStorage());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setAtivos(readStorage());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((id: AtalhoId) => {
    setAtivos(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ATALHOS));
    setAtivos(DEFAULT_ATALHOS);
  }, []);

  const itens = ATALHOS_CATALOGO.filter(a => ativos.includes(a.id))
    .sort((a, b) => ativos.indexOf(a.id) - ativos.indexOf(b.id));

  return { ativos, itens, toggle, reset, catalogo: ATALHOS_CATALOGO };
}
