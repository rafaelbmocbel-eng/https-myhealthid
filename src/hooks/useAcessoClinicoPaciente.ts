import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AcessoClinicoStatus = 'ativo' | 'carencia' | 'bloqueado';

interface Resultado {
  status: AcessoClinicoStatus;
  diasRestantesCarencia: number | null;
  expiraEm: Date | null;
  ultimoPagamento: Date | null;
  temPacoteAtivo: boolean;
}

/**
 * Calcula o status de acesso clínico de um paciente sob a ótica do profissional.
 * - ativo: pacote ativo OU pagamento pago nos últimos 30 dias
 * - carencia: 30 a 60 dias após último pagamento/pacote
 * - bloqueado: > 60 dias
 */
export function useAcessoClinicoPaciente(pacienteId?: string) {
  return useQuery<Resultado>({
    queryKey: ['acesso-clinico', pacienteId],
    enabled: !!pacienteId,
    staleTime: 60_000,
    queryFn: async () => {
      const [pacRes, pagRes, pacoteRes] = await Promise.all([
        supabase.from('pacientes').select('created_at').eq('id', pacienteId!).maybeSingle(),
        supabase
          .from('pagamentos_paciente')
          .select('updated_at')
          .eq('paciente_id', pacienteId!)
          .eq('status', 'pago')
          .order('updated_at', { ascending: false })
          .limit(1),
        supabase
          .from('pacotes_sessoes')
          .select('status, total_sessoes, sessoes_utilizadas, data_fim, data_inicio')
          .eq('paciente_id', pacienteId!)
          .order('created_at', { ascending: false }),
      ]);

      const createdAt = pacRes.data?.created_at ? new Date(pacRes.data.created_at) : new Date();
      const ultimoPagamento = pagRes.data?.[0]?.updated_at ? new Date(pagRes.data[0].updated_at) : null;
      const pacotes = pacoteRes.data ?? [];

      const temPacoteAtivo = pacotes.some(
        (p) => p.status === 'ativo' && (p.sessoes_utilizadas ?? 0) < (p.total_sessoes ?? 0),
      );
      const ultimoPacoteFim = pacotes
        .map((p) => p.data_fim || p.data_inicio)
        .filter(Boolean)
        .map((d) => new Date(d as string))
        .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      const ref = new Date(
        Math.max(
          ultimoPagamento?.getTime() ?? 0,
          ultimoPacoteFim?.getTime() ?? 0,
          createdAt.getTime(),
        ),
      );
      const diasDesdeRef = (Date.now() - ref.getTime()) / 86_400_000;

      let status: AcessoClinicoStatus = 'ativo';
      let expiraEm: Date | null = null;
      let diasRestantesCarencia: number | null = null;

      if (temPacoteAtivo || diasDesdeRef <= 30) {
        status = 'ativo';
        expiraEm = new Date(ref.getTime() + 30 * 86_400_000);
      } else if (diasDesdeRef <= 60) {
        status = 'carencia';
        expiraEm = new Date(ref.getTime() + 60 * 86_400_000);
        diasRestantesCarencia = Math.max(0, Math.ceil(60 - diasDesdeRef));
      } else {
        status = 'bloqueado';
      }

      return { status, diasRestantesCarencia, expiraEm, ultimoPagamento, temPacoteAtivo };
    },
  });
}
