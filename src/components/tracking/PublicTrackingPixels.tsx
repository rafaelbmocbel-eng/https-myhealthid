import { useEffect, useRef } from 'react';
import { fetchPublicTrackingConfig } from '@/hooks/useTrackingConfig';

declare global {
  interface Window {
    fbq?: any;
    _fbq?: any;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

interface Props {
  terapeutaId?: string | null;
  /** Optional event to fire after pixel boots. */
  event?: 'PageView' | 'Lead' | 'Schedule' | 'Purchase';
}

/**
 * Loads Meta Pixel + GA4 scripts for the given therapist on public pages.
 * No-op if the therapist has no active tracking_config.
 * Each script tag loads only once per page.
 */
export function PublicTrackingPixels({ terapeutaId, event = 'PageView' }: Props) {
  const loaded = useRef<{ meta?: string; ga4?: string }>({});

  useEffect(() => {
    if (!terapeutaId) return;
    let cancelled = false;

    (async () => {
      const cfg = await fetchPublicTrackingConfig(terapeutaId);
      if (cancelled || !cfg) return;

      // ---- Meta Pixel ----
      if (cfg.meta_pixel_id && loaded.current.meta !== cfg.meta_pixel_id) {
        if (!window.fbq) {
          (function (f: any, b: any, e: any, v: any) {
            if (f.fbq) return;
            const n: any = (f.fbq = function () {
              n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            });
            if (!f._fbq) f._fbq = n;
            n.push = n;
            n.loaded = true;
            n.version = '2.0';
            n.queue = [];
            const t = b.createElement(e);
            t.async = true;
            t.src = v;
            const s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s);
          })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
        }
        window.fbq?.('init', cfg.meta_pixel_id);
        loaded.current.meta = cfg.meta_pixel_id;
      }
      if (cfg.meta_pixel_id) {
        window.fbq?.('track', event);
      }

      // ---- GA4 ----
      if (cfg.ga4_id && loaded.current.ga4 !== cfg.ga4_id) {
        if (!window.gtag) {
          const s = document.createElement('script');
          s.async = true;
          s.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.ga4_id}`;
          document.head.appendChild(s);
          window.dataLayer = window.dataLayer || [];
          window.gtag = function () {
            // eslint-disable-next-line prefer-rest-params
            window.dataLayer!.push(arguments);
          };
          window.gtag('js', new Date());
        }
        window.gtag?.('config', cfg.ga4_id);
        loaded.current.ga4 = cfg.ga4_id;
      }
      if (cfg.ga4_id && event !== 'PageView') {
        const ga4Event =
          event === 'Lead' ? 'generate_lead' :
          event === 'Schedule' ? 'schedule' :
          event === 'Purchase' ? 'purchase' :
          event;
        window.gtag?.('event', ga4Event);
      }
    })();

    return () => { cancelled = true; };
  }, [terapeutaId, event]);

  return null;
}
