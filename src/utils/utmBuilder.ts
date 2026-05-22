import { getBaseUrl } from './linkUrls';

export type Destino =
  | { tipo: 'funil'; slug: string }
  | { tipo: 'cadastro'; slug: string }
  | { tipo: 'evento'; slug: string }
  | { tipo: 'myid'; token: string }
  | { tipo: 'portal'; token: string }
  | { tipo: 'agenda'; token: string }
  | { tipo: 'custom'; url: string };

export function destinoToUrl(d: Destino): string {
  switch (d.tipo) {
    case 'funil': return `${getBaseUrl()}/funil/${d.slug}`;
    case 'cadastro': return `${getBaseUrl()}/cadastro/${d.slug}`;
    case 'evento': return `${getBaseUrl()}/evento/${d.slug}`;
    case 'myid': return `${getBaseUrl()}/myid/responder/${d.token}`;
    case 'portal': return `${getBaseUrl()}/portal/${d.token}`;
    case 'agenda': return `${getBaseUrl()}/agenda/${d.token}`;
    case 'custom': return d.url;
  }
}

export type Utms = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};

export function buildUtmUrl(baseUrl: string, utms: Utms): string {
  try {
    const url = new URL(baseUrl);
    (Object.entries(utms) as [keyof Utms, string | undefined][]).forEach(([k, v]) => {
      if (v && v.trim()) url.searchParams.set(k, v.trim().toLowerCase().replace(/\s+/g, '_'));
    });
    return url.toString();
  } catch {
    return baseUrl;
  }
}

export const ORIGENS_PRESET: { value: string; label: string; emoji: string; medium?: string }[] = [
  { value: 'instagram', label: 'Instagram', emoji: '📷', medium: 'social' },
  { value: 'whatsapp', label: 'WhatsApp', emoji: '🟢', medium: 'chat' },
  { value: 'facebook', label: 'Facebook', emoji: '👍', medium: 'social' },
  { value: 'google_ads', label: 'Google Ads', emoji: '🔍', medium: 'cpc' },
  { value: 'google', label: 'Google (orgânico)', emoji: '🔎', medium: 'organic' },
  { value: 'email', label: 'E-mail', emoji: '📧', medium: 'email' },
  { value: 'bio_link', label: 'Bio link', emoji: '🔗', medium: 'bio' },
  { value: 'youtube', label: 'YouTube', emoji: '▶️', medium: 'video' },
  { value: 'tiktok', label: 'TikTok', emoji: '🎵', medium: 'social' },
  { value: 'linkedin', label: 'LinkedIn', emoji: '💼', medium: 'social' },
];

export const MIDIAS_PRESET = ['feed', 'story', 'reels', 'dm', 'ads', 'organic', 'newsletter', 'cpc', 'qr'];
