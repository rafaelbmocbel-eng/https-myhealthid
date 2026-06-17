import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, AlertTriangle, Pill, FileWarning } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  pacienteId: string;
}

/**
 * Painel "safety-first": reúne, num único lugar visível no topo do atendimento,
 * tudo que o profissional precisa checar ANTES de prescrever — alergias,
 * condições pré-existentes, medicamentos em uso e red flag do MyID. Hoje essas
 * informações ficam espalhadas em abas separadas do perfil do paciente.
 */
export default function SafetyBanner({ pacienteId }: Props) {
  const { data: paciente, isLoading: loadingPac } = useQuery({
    queryKey: ['paciente-safety', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('alergias, condicoes_preexistentes, medicamentos_uso')
        .eq('id', pacienteId)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId,
  });

  // Mesma queryKey usada em MyIDResumoInline — compartilha o cache, sem fetch duplicado.
  const { data: ultimaAval, isLoading: loadingMyID } = useQuery({
    queryKey: ['avaliacao-presencial-myid', pacienteId],
    queryFn: async () => {
      const { data } = await supabase
        .from('avaliacoes_identidade')
        .select('*')
        .eq('paciente_id', pacienteId)
        .not('myid_score', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pacienteId,
  });

  if (loadingPac || loadingMyID) return null;

  const redFlags = !!((ultimaAval as any)?.dados_avaliacao?.red_flags_detected);
  const alergias = paciente?.alergias?.trim();
  const condicoes = paciente?.condicoes_preexistentes?.trim();
  const medicamentos = paciente?.medicamentos_uso?.trim();

  const temAlerta = redFlags || alergias || condicoes || medicamentos;
  if (!temAlerta) return null;

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50/70 dark:bg-rose-950/20 dark:border-rose-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">
          Checar antes de iniciar
        </span>
      </div>
      <div className="space-y-1.5">
        {redFlags && (
          <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><strong>Red flag detectada</strong> na última avaliação MyID — revisar antes de prescrever exercícios.</span>
          </div>
        )}
        {alergias && (
          <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
            <Pill className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><strong>Alergias:</strong> {alergias}</span>
          </div>
        )}
        {condicoes && (
          <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
            <FileWarning className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><strong>Condições pré-existentes:</strong> {condicoes}</span>
          </div>
        )}
        {medicamentos && (
          <div className="flex items-start gap-2 text-xs text-rose-800 dark:text-rose-300">
            <Pill className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><strong>Medicamentos em uso:</strong> {medicamentos}</span>
          </div>
        )}
      </div>
    </div>
  );
}
