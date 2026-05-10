import { useNavigate, useLocation } from 'react-router-dom';
import { Users, ClipboardList, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { label: 'Clientes', href: '/pacientes', icon: Users },
  { label: 'Protocolos', href: '/protocolos', icon: ClipboardList },
  { label: 'Relatórios', href: '/relatorios', icon: FileText },
];

export default function PacientesSubNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex items-center gap-1 mb-5 border-b border-border pb-1">
      {tabs.map(t => {
        const active = pathname.startsWith(t.href);
        return (
          <button
            key={t.href}
            onClick={() => !active && navigate(t.href)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-b-2 border-primary text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <t.icon className="icon-sm inline mr-1.5 -mt-0.5" />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
