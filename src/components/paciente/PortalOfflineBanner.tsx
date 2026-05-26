import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Banner discreto que aparece quando o paciente perde conexão.
 * Some sozinho ao voltar online. Não bloqueia a UI.
 */
export default function PortalOfflineBanner() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed left-0 right-0 z-[60] flex items-center justify-center gap-2 bg-amber-500 text-white text-xs font-semibold py-1.5 px-3 shadow-md"
      style={{ top: 'env(safe-area-inset-top, 0px)' }}
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Sem conexão. Mostrando o que está em cache.</span>
    </div>
  );
}
