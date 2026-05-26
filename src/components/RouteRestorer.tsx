import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// localStorage (não sessionStorage) → sobrevive a fechar o app / PWA / aba.
const PRO_KEY = 'myhealthid.last-route.pro';
const PATIENT_KEY = 'myhealthid.last-route.patient';

// Rotas públicas / transitórias que nunca devem ser salvas como "última tela".
const PUBLIC_PREFIXES = [
  '/auth', '/avaliacao/', '/agenda/', '/myid/responder/', '/myid/ver/',
  '/funil/', '/evento/', '/cadastro/', '/portal/',
  '/recuperar-senha', '/nova-senha', '/precos', '/demo',
  '/wellness/', '/preview/',
];

// Landings nas quais devemos restaurar a última rota (em vez de manter aí).
const PRO_LANDINGS = new Set(['/', '/auth', '/inicio-app']);
const PATIENT_LANDINGS = new Set(['/paciente/login']);

function isPatientRoute(path: string): boolean {
  return path.startsWith('/paciente') && path !== '/paciente/login';
}

function isProfessionalRoute(path: string): boolean {
  if (isPatientRoute(path)) return false;
  return !PUBLIC_PREFIXES.some(p => path.startsWith(p));
}

function shouldPersistPro(path: string): boolean {
  if (PRO_LANDINGS.has(path)) return false;
  return isProfessionalRoute(path);
}

function shouldPersistPatient(path: string): boolean {
  if (PATIENT_LANDINGS.has(path)) return false;
  return isPatientRoute(path);
}

export default function RouteRestorer() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, authReady } = useAuth();
  const restored = useRef(false);

  // Salva a rota atual em localStorage a cada navegação válida.
  useEffect(() => {
    const full = location.pathname + location.search;
    try {
      if (shouldPersistPro(location.pathname)) {
        localStorage.setItem(PRO_KEY, full);
      } else if (shouldPersistPatient(location.pathname)) {
        localStorage.setItem(PATIENT_KEY, full);
      }
    } catch {
      // localStorage pode falhar em modo privado — ignore.
    }
  }, [location.pathname, location.search]);

  // Ao abrir o app, restaura a última rota — só após auth estar pronta.
  useEffect(() => {
    if (restored.current || loading || !authReady) return;
    if (!user) return;
    restored.current = true;

    let saved: string | null = null;
    try {
      // Se está numa landing de profissional, restaura rota profissional.
      if (PRO_LANDINGS.has(location.pathname)) {
        saved = localStorage.getItem(PRO_KEY);
        if (saved && isProfessionalRoute(saved) && saved !== location.pathname) {
          navigate(saved, { replace: true });
          return;
        }
      }
      // Se está na landing do paciente, restaura rota do portal.
      if (PATIENT_LANDINGS.has(location.pathname)) {
        saved = localStorage.getItem(PATIENT_KEY);
        if (saved && isPatientRoute(saved) && saved !== location.pathname) {
          navigate(saved, { replace: true });
        }
      }
    } catch {
      // Ignore.
    }
  }, [user, loading, authReady, navigate, location.pathname]);

  return null;
}
