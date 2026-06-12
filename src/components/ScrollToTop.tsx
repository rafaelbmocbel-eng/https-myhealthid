import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Reseta a posição de scroll ao trocar de rota.
 * - Considera múltiplos containers scrolláveis (window + <main> + [data-scroll-container]).
 * - Preserva a posição em navegação POP (back/forward — swipe do iOS).
 * - Usa "auto" (instantâneo) — smooth no iOS gera lag perceptível.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navType = useNavigationType();

  useEffect(() => {
    if (navType === "POP") return; // mantém posição no back/forward

    const reset = () => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {
        window.scrollTo(0, 0);
      }
      document
        .querySelectorAll<HTMLElement>(
          'main, [data-scroll-container], .scroll-reset-on-route'
        )
        .forEach((el) => {
          el.scrollTop = 0;
          el.scrollLeft = 0;
        });
    };

    // Dois frames: garante que o novo layout já foi pintado antes do reset
    // (evita "piscar" no iOS quando a rota ainda está montando).
    const id = requestAnimationFrame(() => requestAnimationFrame(reset));
    return () => cancelAnimationFrame(id);
  }, [pathname, navType]);

  return null;
};

export default ScrollToTop;
