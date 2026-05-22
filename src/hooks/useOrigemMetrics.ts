import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type Periodo = '7' | '30' | '90';

export interface OrigemBucket {
  source: string;
  leads: number;
  convertidos: number;
  taxa: number;
}

export interface CampanhaRow {
  campanha: string;
  source: string;
  leads: number;
  convertidos: number;
  taxa: number;
}

export interface OrigemMetrics {
  buckets: OrigemBucket[];
  campanhas: CampanhaRow[];
  totalLeads: number;
  totalConvertidos: number;
  serieDiaria: { date: string; leads: number }[];
}

const NORMALIZE: Record<string, string> = {
  ig: 'instagram',
  insta: 'instagram',
  fb: 'facebook',
  wa: 'whatsapp',
  whatsapp_business: 'whatsapp',
};

function normalizeSource(s?: string | null): string {
  if (!s) return 'direto';
  const k = s.toLowerCase().trim();
  return NORMALIZE[k] || k;
}

export function useOrigemMetrics(periodo: Periodo = '30') {
  const { user } = useAuth();
  return useQuery<OrigemMetrics>({
    queryKey: ['origem-metrics', user?.id, periodo],
    enabled: !!user,
    queryFn: async () => {
      const dataInicio = new Date(Date.now() - parseInt(periodo) * 86400000).toISOString();

      const [leadsRes, pacientesRes, eventosRes] = await Promise.all([
        supabase
          .from('funil_leads')
          .select('id, created_at, origem_utm, etapa_atual, status')
          .eq('terapeuta_id', user!.id)
          .gte('created_at', dataInicio),
        supabase
          .from('pacientes')
          .select('id, created_at, origem_utm')
          .eq('terapeuta_id', user!.id)
          .gte('created_at', dataInicio),
        supabase
          .from('evento_inscricoes')
          .select('id, created_at, origem_utm, evento_id')
          .gte('created_at', dataInicio),
      ]);

      const leads = (leadsRes.data || []) as Array<{ created_at: string; origem_utm: Record<string, string> | null; status: string | null; etapa_atual: string | null }>;
      const pacientes = (pacientesRes.data || []) as Array<{ created_at: string; origem_utm: Record<string, string> | null }>;
      const eventos = (eventosRes.data || []) as Array<{ created_at: string; origem_utm: Record<string, string> | null }>;

      const bucketMap: Record<string, OrigemBucket> = {};
      const campMap: Record<string, CampanhaRow> = {};
      const dailyMap: Record<string, number> = {};

      const addBucket = (utm: Record<string, string> | null, converted: boolean, created_at: string) => {
        const src = normalizeSource(utm?.utm_source);
        if (!bucketMap[src]) bucketMap[src] = { source: src, leads: 0, convertidos: 0, taxa: 0 };
        bucketMap[src].leads++;
        if (converted) bucketMap[src].convertidos++;

        const camp = utm?.utm_campaign?.trim() || '(sem campanha)';
        const key = src + '::' + camp;
        if (!campMap[key]) campMap[key] = { campanha: camp, source: src, leads: 0, convertidos: 0, taxa: 0 };
        campMap[key].leads++;
        if (converted) campMap[key].convertidos++;

        const day = (created_at || '').slice(0, 10);
        if (day) dailyMap[day] = (dailyMap[day] || 0) + 1;
      };

      leads.forEach((l) => addBucket(l.origem_utm, l.status === 'convertido' || l.etapa_atual === 'confirmacao', l.created_at));
      pacientes.forEach((p) => addBucket(p.origem_utm, true, p.created_at));
      eventos.forEach((e) => addBucket(e.origem_utm, true, e.created_at));

      Object.values(bucketMap).forEach((b) => (b.taxa = b.leads ? (b.convertidos / b.leads) * 100 : 0));
      Object.values(campMap).forEach((c) => (c.taxa = c.leads ? (c.convertidos / c.leads) * 100 : 0));

      const buckets = Object.values(bucketMap).sort((a, b) => b.leads - a.leads);
      const campanhas = Object.values(campMap).sort((a, b) => b.leads - a.leads).slice(0, 20);

      const serieDiaria = Object.entries(dailyMap)
        .map(([date, leads]) => ({ date, leads }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return {
        buckets,
        campanhas,
        serieDiaria,
        totalLeads: leads.length + pacientes.length + eventos.length,
        totalConvertidos: pacientes.length + eventos.length + leads.filter((l) => l.status === 'convertido').length,
      };
    },
  });
}
