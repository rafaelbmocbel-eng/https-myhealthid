import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, X, Share, Plus } from 'lucide-react';
import { usePwaInstall } from '@/hooks/usePwaInstall';
import { motion, AnimatePresence } from 'framer-motion';

const DISMISS_KEY = 'myhealthid.pwa-install-dismissed';

export default function PwaInstallBanner() {
  const { canInstall, isInstalled, promptInstall, showIOSGuide } = usePwaInstall();
  const [dismissed, setDismissed] = useState(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (!stored) return false;
    // Re-show after 7 days
    const dismissedAt = parseInt(stored, 10);
    return Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000;
  });
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (isInstalled || dismissed) return null;
  if (!canInstall && !showIOSGuide) return null;

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (!accepted) {
      // Don't dismiss if user cancelled, they might want to try again
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-0 shadow-md overflow-hidden bg-gradient-to-r from-emerald-500 to-teal-600">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Download className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-bold text-white">
                    📲 Instale o app no celular!
                  </h3>
                  <button onClick={handleDismiss} className="text-white/60 hover:text-white/90 p-0.5">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-[11px] text-white/70 mt-0.5">
                  Acesse mais rápido direto da tela inicial, como um app nativo.
                </p>

                {canInstall && (
                  <Button
                    size="sm"
                    className="mt-2 h-7 text-xs font-bold bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={handleInstall}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Instalar agora
                  </Button>
                )}

                {showIOSGuide && !showIosSteps && (
                  <Button
                    size="sm"
                    className="mt-2 h-7 text-xs font-bold bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => setShowIosSteps(true)}
                  >
                    <Share className="h-3.5 w-3.5 mr-1" />
                    Como instalar
                  </Button>
                )}

                {showIosSteps && (
                  <div className="mt-2 space-y-1 text-[11px] text-white/80">
                    <p className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold shrink-0">1</span>
                      Toque em <Share className="h-3 w-3 inline" /> <strong>Compartilhar</strong>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold shrink-0">2</span>
                      Selecione <Plus className="h-3 w-3 inline" /> <strong>Tela de Início</strong>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[9px] font-bold shrink-0">3</span>
                      Toque em <strong>Adicionar</strong>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
