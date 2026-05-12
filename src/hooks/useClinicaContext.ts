import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ClinicaPapel = 'dono' | 'profissional' | 'recepcao';

export interface ClinicaContext {
  clinica: {
    id: string;
    nome: string;
    ativa: boolean;
    dono_user_id: string;
    limite_profissionais: number;
  };
  papel: ClinicaPapel;
  permissoes: {
    verCaixaTotal: boolean;
    verFinanceiroProprio: boolean;
    vender: boolean;
    editarPrecos: boolean;
    editarConfigClinica: boolean;
    gerenciarEquipe: boolean;
    apagarPaciente: boolean;
    restaurarPaciente: boolean;
  };
}

function buildPermissoes(papel: ClinicaPapel): ClinicaContext['permissoes'] {
  const dono = papel === 'dono';
  const prof = papel === 'profissional';
  const recep = papel === 'recepcao';
  return {
    verCaixaTotal: dono || recep,
    verFinanceiroProprio: dono || prof,
    vender: dono || prof || recep,
    editarPrecos: dono,
    editarConfigClinica: dono,
    gerenciarEquipe: dono,
    apagarPaciente: dono,
    restaurarPaciente: dono,
  };
}

/**
 * Retorna o contexto da clínica ativa do usuário, ou null (modo solo).
 * Modo solo = comportamento atual do app, idêntico ao que existe hoje.
 */
export function useClinicaContext() {
  const { user, authReady } = useAuth();
  const [data, setData] = useState<ClinicaContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setData(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        // 1) Tenta achar clínica como DONO ativada
        const { data: ownClinic } = await supabase
          .from('clinicas')
          .select('*')
          .eq('dono_user_id', user.id)
          .eq('ativa', true)
          .maybeSingle();

        if (ownClinic && !cancelled) {
          setData({
            clinica: ownClinic as any,
            papel: 'dono',
            permissoes: buildPermissoes('dono'),
          });
          setLoading(false);
          return;
        }

        // 2) Tenta achar como membro ativo
        const { data: membro } = await supabase
          .from('clinica_membros')
          .select('papel, clinica:clinicas(*)')
          .eq('user_id', user.id)
          .eq('status', 'ativo')
          .maybeSingle();

        if (membro?.clinica && (membro.clinica as any).ativa && !cancelled) {
          const papel = membro.papel as ClinicaPapel;
          setData({
            clinica: membro.clinica as any,
            papel,
            permissoes: buildPermissoes(papel),
          });
          setLoading(false);
          return;
        }

        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      } catch (err) {
        console.warn('[useClinicaContext] modo solo (fallback):', err);
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, authReady]);

  return { ...data, contexto: data, isSolo: !data, loading };
}
