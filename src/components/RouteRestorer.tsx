import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'myhealthid.last-route';

// Routes that should NOT be restored (public, auth, transient, patient portal)
const EXCLUDED_PREFIXES = [
  '/auth', '/avaliacao/', '/agenda/', '/myid/responder/',
  '/funil/', '/evento/', '/cadastro/', '/portal/',
  '/paciente/', '/paciente',
];

function shouldPersist(path: string): boolean {
  if (path === '/') return false;
  return !EXCLUDED_PREFIXES.some(p => path.startsWith(p));
}

/**
 * Returns true if the given path belongs to the professional side of the app.
 * Patient-portal routes (/paciente/*) and public routes are NOT professional.
 */
function isProfessionalRoute(path: string): boolean {
  if (path.startsWith('/paciente')) return false;
  if (path.startsWith('/portal')) return false;
  if (path.startsWith('/auth')) return false;
  if (path.startsWith('/avaliacao/')) return false;
  if (path.startsWith('/myid/responder/')) return false;
  if (path.startsWith('/funil/')) return false;
  if (path.startsWith('/evento/')) return false;
  if (path.startsWith('/cadastro/')) return false;
  return true;
}

export default function RouteRestorer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, authReady } = useAuth();
  const restored = useRef(false);

  // Save current route on every navigation (only professional routes)
  useEffect(() => {
    if (shouldPersist(location.pathname)) {
      sessionStorage.setItem(STORAGE_KEY, location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  // On first load, restore saved route — but ONLY for professionals
  useEffect(() => {
    if (restored.current || loading || !authReady) return;
    restored.current = true;

    if (!user) return;

    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved || saved === location.pathname) return;

    // Only restore professional routes when on a landing page
    // Never restore for users currently on patient routes
    if (location.pathname.startsWith('/paciente')) return;

    // Only restore after login (/auth landing). Never redirect away from "/" —
    // the home page (Início) is a destination, not a transient landing.
    if (isProfessionalRoute(saved) && location.pathname === '/auth') {
      navigate(saved, { replace: true });
    }
  }, [user, loading, authReady, navigate, location.pathname]);

  return null;
}
