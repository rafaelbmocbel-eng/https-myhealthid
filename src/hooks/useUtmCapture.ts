import { useEffect } from 'react';

const STORAGE_KEY = 'mh:utm';

export interface UtmData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  referrer?: string;
  landing_page?: string;
  captured_at?: string;
}

/**
 * Captura UTMs da URL atual e persiste em sessionStorage.
 * Se já existe UTM salvo na sessão, não sobrescreve (first-touch).
 * Chame uma vez no topo das páginas públicas (Funil, Cadastro, Agenda, Evento, MyID).
 */
export function useUtmCapture() {
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const existing = sessionStorage.getItem(STORAGE_KEY);
      if (existing) return;

      const params = new URLSearchParams(window.location.search);
      const utm: UtmData = {};
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
        const v = params.get(k);
        if (v) (utm as Record<string, string>)[k] = v.slice(0, 120);
      });

      // Inferir source se UTM ausente
      if (!utm.utm_source && document.referrer) {
        try {
          const ref = new URL(document.referrer);
          const host = ref.hostname.replace(/^www\./, '');
          if (host.includes('instagram')) utm.utm_source = 'instagram';
          else if (host.includes('facebook') || host.includes('fb.')) utm.utm_source = 'facebook';
          else if (host.includes('google')) utm.utm_source = 'google';
          else if (host.includes('whatsapp') || host.includes('wa.me')) utm.utm_source = 'whatsapp';
          else if (host.includes('youtube')) utm.utm_source = 'youtube';
          else if (host.includes('tiktok')) utm.utm_source = 'tiktok';
          else if (host.includes('linkedin')) utm.utm_source = 'linkedin';
          else utm.utm_source = host;
          utm.utm_medium = utm.utm_medium || 'referral';
        } catch {
          /* ignore */
        }
      }

      if (Object.keys(utm).length === 0) {
        utm.utm_source = 'direto';
        utm.utm_medium = 'direct';
      }

      utm.referrer = document.referrer || null as unknown as string;
      utm.landing_page = window.location.pathname;
      utm.captured_at = new Date().toISOString();

      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(utm));
    } catch {
      /* ignore */
    }
  }, []);
}

/** Lê UTMs persistidos. Retorna `null` se não houver nada. */
export function getCapturedUtm(): UtmData | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UtmData;
  } catch {
    return null;
  }
}
