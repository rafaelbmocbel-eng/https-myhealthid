import { useEffect } from 'react';
import { toast } from 'sonner';

export default function PwaUpdateNotifier() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Marca se já havia um SW controlando a página (instalação vs. atualização)
    let hadController = !!navigator.serviceWorker.controller;

    const handleControllerChange = () => {
      if (!hadController) {
        // Primeira instalação — SW assumindo o controle, não é update
        hadController = true;
        return;
      }
      // Novo SW tomou controle: há uma nova versão do app
      toast.info('Nova versão disponível', {
        description: 'Recarregue para aplicar as últimas alterações.',
        action: {
          label: 'Atualizar agora',
          onClick: () => window.location.reload(),
        },
        duration: Infinity,
        id: 'pwa-update',
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Verifica atualizações a cada 90 s (útil durante deploys frequentes)
    const tick = setInterval(async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      } catch { /* ignora erros de rede */ }
    }, 90_000);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      clearInterval(tick);
    };
  }, []);

  return null;
}
