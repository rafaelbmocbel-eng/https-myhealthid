import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanoAtivo {
  plano_id: string;
  plano_nome: string;
  modulos: string[];
  preco_mensal: number;
  limite_ia_mensal: number;
  uso_ia_atual: number;
  status: string;
  data_fim: string | null;
}

/**
 * Retorna o plano ativo do usuário logado + uso atual de IA do mês.
 * Quando não houver assinatura ativa, retorna null (modo legado: tudo liberado).
 *
 * Use junto com `<PlanoGate feature="...">` para controlar acesso.
 */
export function usePlanoAtivo() {
  return useQuery({
    queryKey: ["meu-plano-atual"],
    queryFn: async (): Promise<PlanoAtivo | null> => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) return null;

      const { data, error } = await supabase.rpc("meu_plano_atual" as any);
      if (error) {
        console.warn("[usePlanoAtivo] erro:", error.message);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      return row as PlanoAtivo;
    },
    staleTime: 60_000,
  });
}

/**
 * Helper síncrono — checa se o plano dá acesso a um módulo específico.
 * Se não houver plano ativo (assinatura ainda não obrigatória), libera tudo.
 */
export function temAcessoModulo(plano: PlanoAtivo | null | undefined, modulo: string): boolean {
  if (!plano) return true; // modo legado / sem cobrança ainda
  return Array.isArray(plano.modulos) && plano.modulos.includes(modulo);
}

/**
 * Helper — true quando o usuário ainda tem cota mensal de IA disponível.
 */
export function temCotaIA(plano: PlanoAtivo | null | undefined): boolean {
  if (!plano) return true;
  if (plano.limite_ia_mensal === 0) return false;
  return plano.uso_ia_atual < plano.limite_ia_mensal;
}
