import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

// Top-level routes onde o botão "voltar" não deve aparecer
const TOP_LEVEL = new Set<string>([
  '/',
  '/inicio-app',
  '/hoje',
  '/agenda',
  '/pacientes',
  '/eventos',
  '/configuracoes',
  '/crm/inbox',
  '/base-cientifica',
  '/auth',
  '/paciente/dashboard',
  '/paciente/login',
]);

// Prefixos de rotas onde NÃO mostrar o botão flutuante (portal já tem nav inferior + topo dedicado)
const HIDDEN_PREFIXES = [
  '/portal/',
  '/avaliacao/',
  '/myid/responder/',
  '/funil/',
  '/evento/',
  '/cadastro/',
];

/**
 * Botão flutuante "voltar" para mobile.
 * Aparece em qualquer rota interna que não seja top-level e dispara `history.back()`,
 * preservando o comportamento nativo do gesto de voltar do sistema.
 */
export default function GlobalBackButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile) return null;
  if (TOP_LEVEL.has(location.pathname)) return null;
  if (HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p))) return null;
  // Patient portal já tem header próprio
  if (location.pathname.startsWith('/paciente/')) return null;
  if (typeof window !== 'undefined' && window.history.length <= 1) return null;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Voltar"
      className="md:hidden fixed left-3 z-40 flex items-center justify-center h-10 w-10 rounded-full bg-card/90 backdrop-blur-sm border border-border shadow-md text-foreground active:scale-95 transition-transform"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
    >
      <ArrowLeft className="h-5 w-5" />
    </button>
  );
}
