import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const STORAGE_KEY = 'myhealthid.last-route';

// Routes that should NOT be restored (public, auth, transient)
const EXCLUDED_PREFIXES = ['/auth', '/avaliacao/', '/agenda/', '/myid/responder/', '/funil/', '/evento/', '/cadastro/', '/portal/'];

function shouldPersist(path: string): boolean {
  if (path === '/') return false;
  return !EXCLUDED_PREFIXES.some(p => path.startsWith(p));
}

export default function RouteRestorer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, authReady } = useAuth();
  const restored = useRef(false);

  // Save current route on every navigation
  useEffect(() => {
    if (shouldPersist(location.pathname)) {
      sessionStorage.setItem(STORAGE_KEY, location.pathname + location.search);
    }
  }, [location.pathname, location.search]);

  // On first load, restore saved route
  useEffect(() => {
    if (restored.current || loading || !authReady) return;
    restored.current = true;

    if (!user) return; // not logged in — let normal flow handle it

    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved || saved === location.pathname) return;

    // Only restore if we're on a "landing" page (root or auth)
    if (location.pathname === '/' || location.pathname === '/auth' || location.pathname === '/agenda') {
      navigate(saved, { replace: true });
    }
  }, [user, loading, authReady, navigate, location.pathname]);

  return null;
}
