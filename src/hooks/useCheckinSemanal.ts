import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePacientePortal } from '@/hooks/usePacientePortal';
import { inicioDaSemanaBR, type LinhaCheckin, type ValoresCheckin } from '@/lib/checkinSemanal';

export const CAMINHO_CHECKIN = '/paciente/checkin';
// Mesmo caminho que o Início usa para o MyID.
export const CAMINHO_MYID = '/paciente/questionarios';

// Os tipos gerados do Supabase ainda não conhecem as tabelas e funções do check-in.
interface ErroBanco { code?: string; message?: string }
interface RespostaBanco { data: unknown; error: ErroBanco | null; count?: number | null }
interface Consulta extends PromiseLike<RespostaBanco> {
  select(colunas: string, opcoes?: { count: 'exact'; head: boolean }): Consulta;
  eq(coluna: string, valor: unknown): Consulta;
  order(coluna: string, opcoes: { ascending: boolean }): Consulta;
  limit(quantas: number): Consulta;
  maybeSingle(): PromiseLike<RespostaBanco>;
}
const bancoSemTipos = supabase as unknown as {
  from(tabela: string): Consulta;
  rpc(nome: string, args: Record<string, unknown>): PromiseLike<RespostaBanco>;
};

const ULTIMAS_SEMANAS = 26;
const CAMPOS_SERIE = 'semana, origem, fadiga, sono, dor_muscular, estresse, humor, urina, psr';

const CODIGOS_INDISPONIVEL = ['42P01', 'PGRST205', 'PGRST202'];

/** Tabela ou função do check-in ainda não existe no banco (migração não aplicada). */
export function erroIndisponivel(erro: unknown): boolean {
  if (!erro || typeof erro !== 'object') return false;
  const { code, message } = erro as { code?: unknown; message?: unknown };
  if (typeof code === 'string' && CODIGOS_INDISPONIVEL.includes(code)) return true;
  return typeof message === 'string' && /does not exist|schema cache/i.test(message);
}

export function mensagemErroCheckin(erro: unknown): string {
  const texto = erro && typeof erro === 'object' ? String((erro as { message?: unknown }).message ?? '') : '';
  if (texto.includes('checkin_valor_invalido')) return 'Alguma resposta ficou fora do esperado. Confira e envie de novo.';
  if (texto.includes('paciente_nao_vinculado')) return 'Para responder, você precisa estar vinculado(a) a um profissional.';
  if (texto.includes('nao_autenticado')) return 'Sua sessão expirou. Entre de novo para responder.';
  if (erroIndisponivel(erro)) return 'O check-in ainda não está disponível.';
  return 'Não consegui registrar agora. Verifique sua internet e tente de novo.';
}

export interface SerieCheckin {
  linhas: LinhaCheckin[];
  indisponivel: boolean;
}

/** Série do próprio cliente, da semana mais antiga para a mais recente. */
export function useCheckinSerie(pacienteId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['checkin-semanal', 'serie', pacienteId],
    enabled: !!pacienteId,
    staleTime: 30_000,
    queryFn: async (): Promise<SerieCheckin> => {
      const { data, error } = await bancoSemTipos
        .from('checkins_semanais')
        .select(CAMPOS_SERIE)
        .eq('paciente_id', pacienteId)
        .order('semana', { ascending: false })
        .limit(ULTIMAS_SEMANAS);
      if (error) {
        if (erroIndisponivel(error)) return { linhas: [], indisponivel: true };
        throw error;
      }
      const linhas = ((data || []) as LinhaCheckin[]).slice().reverse();
      return { linhas, indisponivel: false };
    },
  });

  const linhas = query.data?.linhas ?? [];
  const semanaAtual = inicioDaSemanaBR(new Date());
  const linhaDaSemana = linhas.find((l) => l.semana === semanaAtual) ?? null;

  return {
    linhas,
    semanaAtual,
    linhaDaSemana,
    respondeuEstaSemana: !!linhaDaSemana,
    indisponivel: query.data?.indisponivel ?? false,
    // Só "disponível" depois de a consulta dar certo: carregando ou com erro, o Início não mostra o check-in.
    disponivel: !!query.data && !query.data.indisponivel,
    isLoading: !!pacienteId && query.isPending,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** MyID concluído: mesma regra do Início (myid_avaliacoes concluído OU registro migrado em avaliacoes_identidade). */
export function useMyidConcluido(pacienteId: string | null | undefined) {
  const query = useQuery({
    queryKey: ['checkin-semanal', 'myid-concluido', pacienteId],
    enabled: !!pacienteId,
    staleTime: 60_000,
    queryFn: async (): Promise<boolean> => {
      const [concluidos, migrados] = await Promise.all([
        supabase.from('myid_avaliacoes').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId!).eq('status', 'concluido'),
        bancoSemTipos.from('avaliacoes_identidade').select('id', { count: 'exact', head: true }).eq('paciente_id', pacienteId),
      ]);
      if (concluidos.error) throw concluidos.error;
      if (migrados.error) throw migrados.error;
      return (concluidos.count || 0) > 0 || (migrados.count || 0) > 0;
    },
  });

  return {
    // Sem resposta (carregando ou erro de rede), o pedido do MyID continua aparecendo: só some quando sabemos que foi concluído.
    concluido: query.data === true,
    isLoading: !!pacienteId && query.isPending,
  };
}

export interface PreferenciaCheckin {
  ativo: boolean;
  indisponivel: boolean;
}

export function useCheckinPreferencia(pacienteId: string | null | undefined) {
  const qc = useQueryClient();
  const chave = ['checkin-semanal', 'preferencia', pacienteId];

  const query = useQuery({
    queryKey: chave,
    enabled: !!pacienteId,
    staleTime: 60_000,
    queryFn: async (): Promise<PreferenciaCheckin> => {
      const { data, error } = await bancoSemTipos
        .from('checkin_preferencias')
        .select('whatsapp_ativo')
        .eq('paciente_id', pacienteId)
        .maybeSingle();
      if (error) {
        if (erroIndisponivel(error)) return { ativo: true, indisponivel: true };
        throw error;
      }
      const linha = data as { whatsapp_ativo?: boolean } | null;
      return { ativo: linha ? linha.whatsapp_ativo !== false : true, indisponivel: false };
    },
  });

  const definir = useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await bancoSemTipos.rpc('definir_checkin_whatsapp', { p_ativo: ativo });
      if (error) throw error;
      return ativo;
    },
    onSuccess: (ativo) => {
      qc.setQueryData<PreferenciaCheckin>(chave, { ativo, indisponivel: false });
    },
  });

  const ativoNaTela = definir.isPending ? (definir.variables as boolean) : (query.data?.ativo ?? true);

  return {
    // Sem a tabela (ou sem resposta), a chave não aparece: ligá-la não teria efeito.
    disponivel: !!query.data && !query.data.indisponivel,
    ativo: ativoNaTela,
    definir: definir.mutate,
    salvando: definir.isPending,
    erro: definir.isError,
  };
}

/** Tudo da tela do check-in: série, MyID, preferência do WhatsApp e o envio. */
export function useCheckinSemanal() {
  const qc = useQueryClient();
  const portal = usePacientePortal();
  const pacienteId = portal.paciente?.id;
  const serie = useCheckinSerie(pacienteId);
  const myid = useMyidConcluido(pacienteId);
  const preferencia = useCheckinPreferencia(pacienteId);

  const registrar = useMutation({
    mutationFn: async (v: ValoresCheckin) => {
      const { data, error } = await bancoSemTipos.rpc('registrar_checkin_semanal', {
        p_fadiga: v.fadiga,
        p_sono: v.sono,
        p_dor_muscular: v.dor_muscular,
        p_estresse: v.estresse,
        p_humor: v.humor,
        p_urina: v.urina ?? null,
        p_psr: v.psr ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checkin-semanal', 'serie', pacienteId] }),
  });

  return {
    paciente: portal.paciente,
    carregandoPaciente: portal.isLoading,
    erroPaciente: portal.isError,
    refazerPaciente: portal.refetch,
    serie,
    myid,
    preferencia,
    registrar,
  };
}
