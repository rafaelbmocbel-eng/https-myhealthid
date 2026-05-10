import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { differenceInDays } from 'date-fns';
import { AlertTriangle, MessageCircle, ChevronDown, ChevronUp, UserX } from 'lucide-react';
import { shareReativacao } from '@/utils/whatsapp';
import { useToast } from '@/hooks/use-toast';

interface Props {
  /** Limite mínimo de dias sem sessão para considerar abandono. Default 21. */
  diasMinimos?: number;
}

interface PacienteAbandono {
  id: string;
  nome: string;
  sobrenome: string | null;
  telefone: string | null;
  ultimaSessao: Date | null;
  diasSumido: number;
}

export default function DetectarAbandonoCard({ diasMinimos = 21 }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['detectar-abandono', user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PacienteAbandono[]> => {
      const now = new Date().toISOString();
      const [pacRes, sessoesRes, ageFutRes] = await Promise.all([
        supabase
          .from('pacientes')
          .select('id, nome, sobrenome, telefone, created_at')
          .eq('terapeuta_id', user!.id)
          .eq('ativo', true),
        supabase
          .from('controle_sessoes')
          .select('paciente_id, data_sessao, status')
          .eq('terapeuta_id', user!.id)
          .eq('status', 'realizada')
          .order('data_sessao', { ascending: false }),
        supabase
          .from('agendamentos')
          .select('paciente_id')
          .eq('terapeuta_id', user!.id)
          .gte('data_inicio', now)
          .in('status', ['confirmado', 'pendente']),
      ]);

      const ultimaPorPaciente = new Map<string, Date>();
      (sessoesRes.data || []).forEach((s: any) => {
        if (!ultimaPorPaciente.has(s.paciente_id)) {
          ultimaPorPaciente.set(s.paciente_id, new Date(s.data_sessao));
        }
      });

      const comFuturo = new Set((ageFutRes.data || []).map((a: any) => a.paciente_id));

      const hoje = new Date();
      const result: PacienteAbandono[] = [];
      for (const p of pacRes.data || []) {
        if (comFuturo.has(p.id)) continue;
        const ultima = ultimaPorPaciente.get(p.id) ?? null;
        const ref = ultima ?? new Date(p.created_at);
        const dias = differenceInDays(hoje, ref);
        if (dias >= diasMinimos) {
          result.push({
            id: p.id,
            nome: p.nome,
            sobrenome: p.sobrenome,
            telefone: p.telefone,
            ultimaSessao: ultima,
            diasSumido: dias,
          });
        }
      }
      result.sort((a, b) => b.diasSumido - a.diasSumido);
      return result;
    },
  });

  const grupos = useMemo(() => {
    const recentes = pacientes.filter((p) => p.diasSumido < 60);
    const medios = pacientes.filter((p) => p.diasSumido >= 60 && p.diasSumido < 120);
    const longos = pacientes.filter((p) => p.diasSumido >= 120);
    return { recentes, medios, longos };
  }, [pacientes]);

  const handleReativar = async (p: PacienteAbandono) => {
    if (!p.telefone) {
      toast({ title: 'Sem telefone', description: 'Cadastre o telefone do paciente primeiro.', variant: 'destructive' });
      return;
    }
    const nomeCompleto = `${p.nome} ${p.sobrenome ?? ''}`.trim();
    const terapeutaNome = user?.email?.split('@')[0] ?? undefined;
    await shareReativacao(nomeCompleto, p.telefone, p.diasSumido, terapeutaNome);
    toast({ title: '📩 WhatsApp aberto com mensagem de reativação' });
  };

  if (isLoading) return null;
  if (pacientes.length === 0) return null;

  const renderRow = (p: PacienteAbandono) => {
    const cor = p.diasSumido >= 120 ? 'text-rose-700 bg-rose-50' : p.diasSumido >= 60 ? 'text-amber-700 bg-amber-50' : 'text-orange-700 bg-orange-50';
    return (
      <div key={p.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-background border border-border/40">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">{p.nome} {p.sobrenome}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 border-0 ${cor}`}>
              {p.diasSumido}d sem sessão
            </Badge>
            {!p.ultimaSessao && <span className="text-[10px] text-muted-foreground">nunca atendido</span>}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 shrink-0"
          onClick={() => handleReativar(p)}
          disabled={!p.telefone}
        >
          <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
          <span className="text-xs">Reativar</span>
        </Button>
      </div>
    );
  };

  return (
    <Card className="border-amber-200 bg-amber-50/40 dark:bg-amber-950/10 dark:border-amber-900/40">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Pacientes em risco de abandono
            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] h-5">
              {pacientes.length}
            </Badge>
          </CardTitle>
          <Button size="sm" variant="ghost" className="h-7 gap-1" onClick={() => setExpanded((v) => !v)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="text-xs">{expanded ? 'Recolher' : 'Ver lista'}</span>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Sem sessão futura agendada e última sessão há mais de {diasMinimos} dias.
        </p>
      </CardHeader>
      {expanded && (
        <CardContent className="space-y-3">
          {grupos.recentes.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-orange-700 uppercase mb-1.5">Recente · {grupos.recentes.length}</p>
              <div className="space-y-1.5">{grupos.recentes.map(renderRow)}</div>
            </div>
          )}
          {grupos.medios.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-amber-700 uppercase mb-1.5">Médio · {grupos.medios.length}</p>
              <div className="space-y-1.5">{grupos.medios.map(renderRow)}</div>
            </div>
          )}
          {grupos.longos.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-rose-700 uppercase mb-1.5 flex items-center gap-1">
                <UserX className="h-3 w-3" /> Crítico · {grupos.longos.length}
              </p>
              <div className="space-y-1.5">{grupos.longos.map(renderRow)}</div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
