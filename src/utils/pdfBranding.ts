// Branding da clínica para os PDFs que vão ao cliente. Centraliza a busca em
// config_clinica (logo + razão social) pra todos os geradores usarem o MESMO
// padrão da Proposta: logo da clínica no topo quando existir, senão a marca do
// app discreta. Retorno já no formato dos campos que os geradores aceitam, então
// o chamador só faz `...await carregarBrandingClinica(user.id)`.
import { supabase } from '@/integrations/supabase/client';

export interface BrandingClinica {
  clinicaNome?: string;
  clinicaLogoUrl?: string;
}

export async function carregarBrandingClinica(terapeutaId?: string | null): Promise<BrandingClinica> {
  if (!terapeutaId) return {};
  try {
    const { data } = await (supabase as any)
      .from('config_clinica')
      .select('logo_url, razao_social')
      .eq('terapeuta_id', terapeutaId)
      .maybeSingle();
    if (!data) return {};
    return {
      clinicaNome: data.razao_social || undefined,
      clinicaLogoUrl: data.logo_url || undefined,
    };
  } catch {
    // Sem branding (rede/RLS): geradores caem na marca do app. Não bloqueia o PDF.
    return {};
  }
}
