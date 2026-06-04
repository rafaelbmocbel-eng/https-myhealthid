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

  // Query params que disparam modais/wizards e NÃO devem ser restaurados
  // quando o usuário reabre o app (ex: /agenda?novo=1 reabria o modal de
  // cadastro de horário toda vez que o app era aberto).
  const TRANSIENT_PARAMS = ['novo', 'paciente', 'openNew', 'open', 'modal', 'edit', 'editar', 'action'];

  // Salva a rota atual em localStorage a cada navegação válida.
  useEffect(() => {
    const sp = new URLSearchParams(location.search);
    TRANSIENT_PARAMS.forEach(k => sp.delete(k));
    const cleanSearch = sp.toString();
    const full = location.pathname + (cleanSearch ? `?${cleanSearch}` : '');
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

  // Ao abrir o app (cold start apenas), restaura a última rota — só após auth pronta.
  // IMPORTANTE: só restaura uma vez por sessão da aba. Se o usuário clicar no logo
  // ou navegar manualmente para uma landing depois disso, NÃO o redirecionamos
  // — caso contrário o app "volta sozinho" para a tela anterior.
  useEffect(() => {
    if (restored.current || loading || !authReady) return;
    if (!user) return;

    // Marca como restaurado para esta sessão da aba (sobrevive a re-renders,
    // mas NÃO a um novo carregamento da página — exatamente o que queremos).
    const SESSION_FLAG = 'myhealthid.route-restored';
    const alreadyRestoredThisSession = sessionStorage.getItem(SESSION_FLAG) === '1';
    restored.current = true;

    if (alreadyRestoredThisSession) return;
    try { sessionStorage.setItem(SESSION_FLAG, '1'); } catch { /* ignore */ }

    let saved: string | null = null;
    try {
      if (PRO_LANDINGS.has(location.pathname)) {
        saved = localStorage.getItem(PRO_KEY);
        if (saved && isProfessionalRoute(saved) && saved !== location.pathname) {
          navigate(saved, { replace: true });
          return;
        }
      }
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
