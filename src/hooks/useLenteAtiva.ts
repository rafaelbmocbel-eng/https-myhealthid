import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type PerfilProfissional =
  | 'fisioterapeuta'
  | 'medico'
  | 'psicologo'
  | 'nutricionista'
  | 'educador_fisico'
  | 'terapeuta_ocupacional';

export interface LenteProfissional {
  id: PerfilProfissional;
  nome_exibicao: string;
  descricao: string | null;
  blocos_ativos: string[];
  prompt_sistema: string;
  template_evolucao: string | null;
}

/**
 * Carrega a lente profissional ativa do usuário logado.
 * Default = fisioterapeuta (mantém comportamento original).
 */
export function useLenteAtiva() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['lente-ativa', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<LenteProfissional> => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('perfil_profissional')
        .eq('user_id', user!.id)
        .maybeSingle();

      const perfilId = ((profile as any)?.perfil_profissional || 'fisioterapeuta') as PerfilProfissional;

      const { data: lente } = await supabase
        .from('perfis_profissionais' as any)
        .select('*')
        .eq('id', perfilId)
        .maybeSingle();

      if (lente) {
        return {
          id: (lente as any).id,
          nome_exibicao: (lente as any).nome_exibicao,
          descricao: (lente as any).descricao,
          blocos_ativos: Array.isArray((lente as any).blocos_ativos)
            ? (lente as any).blocos_ativos
            : [],
          prompt_sistema: (lente as any).prompt_sistema,
          template_evolucao: (lente as any).template_evolucao,
        };
      }

      // Fallback seguro
      return {
        id: 'fisioterapeuta',
        nome_exibicao: 'Fisioterapeuta',
        descricao: null,
        blocos_ativos: ['voz', 'avatar'],
        prompt_sistema: 'LENTE_FISIO',
        template_evolucao: 'SOAP',
      };
    },
  });
}

export function temBloco(lente: LenteProfissional | undefined, bloco: string): boolean {
  if (!lente) return bloco === 'voz' || bloco === 'avatar'; // default fisio
  return lente.blocos_ativos.includes(bloco);
}
