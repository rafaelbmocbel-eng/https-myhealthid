import { lazy, Suspense, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Activity, Dumbbell, Apple, Stethoscope, Brain, Smile, Loader2, Copy, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLenteAtiva } from '@/hooks/useLenteAtiva';

// Hub da aba "Diretriz" do profissional: um "Planejamento por especialidade"
// com uma sub-aba por área da saúde. Cada área usa a IA para produzir a diretriz/
// plano a partir da avaliação (presencial/voz) + MyID + questionários, e tudo
// segue para o portal do cliente (após liberar) usando as MESMAS tabelas/motores
// que o app já tem — nada de backend novo.
const PacienteProtocolosTab = lazy(() => import('@/components/paciente/PacienteProtocolosTab'));
const PlanoTreinoCard = lazy(() => import('@/components/educador/PlanoTreinoCard'));
const DiretrizTreinoCard = lazy(() => import('@/components/educador/DiretrizTreinoCard'));
const PlanoAlimentarCard = lazy(() => import('@/components/nutricao/PlanoAlimentarCard'));
const DiretrizNutricionalCard = lazy(() => import('@/components/nutricao/DiretrizNutricionalCard'));
const DiretrizAreaCard = lazy(() => import('@/components/diretrizes/DiretrizAreaCard'));

const Fallback = <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

// Áreas clínicas genéricas (médico, psicólogo, dentista) — mesma engine
// (gerar-diretriz-clinica → diretrizes_profissionais).
const AREAS_CLINICAS = [
  { value: 'medicina', label: 'Médico', Icone: Stethoscope, cor: 'text-sky-600', nome: 'Diretriz de Tratamento (Médica)', ph: 'ex: controle pressórico e metabólico' },
  { value: 'psicologia', label: 'Psicólogo', Icone: Brain, cor: 'text-violet-600', nome: 'Plano Terapêutico (Psicologia)', ph: 'ex: reduzir sintomas de ansiedade' },
  { value: 'odontologia', label: 'Dentista', Icone: Smile, cor: 'text-teal-600', nome: 'Plano de Tratamento (Odontologia)', ph: 'ex: adequação do meio bucal e reabilitação' },
];

// Perfil do profissional logado -> sub-aba que abre por padrão.
const LENTE_TAB: Record<string, string> = {
  fisioterapeuta: 'fisio',
  nutricionista: 'nutricao',
  educador_fisico: 'treino',
  medico: 'medicina',
  psicologo: 'psicologia',
  dentista: 'odontologia',
};

// Deixa explícito o fluxo Rascunho → Liberado (é quando o cliente passa a ver).
function HintLiberar() {
  return (
    <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border/50 rounded-lg px-3 py-2">
      <span className="font-semibold text-foreground">Rascunho</span> = só você vê. Clique em{' '}
      <span className="font-semibold text-emerald-700 dark:text-emerald-400">Liberar/Enviar</span> para o cliente ver no
      portal — ao liberar, o plano também entra no prontuário/evolução dele.
    </p>
  );
}

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

export default function DiretrizesPlanosHub({ pacienteId, pacienteNome }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: lente } = useLenteAtiva();
  const [usandoBase, setUsandoBase] = useState<null | 'treino' | 'nutricao'>(null);

  const defaultTab = (lente && LENTE_TAB[lente.id]) || 'fisio';

  // O que o CLIENTE montou sozinho no portal (planos_ia_cliente) — read-only aqui.
  const { data: geradoCliente } = useQuery({
    queryKey: ['diretrizes-cliente-gerado', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('planos_ia_cliente')
        .select('tipo, titulo, conteudo').eq('paciente_id', pacienteId);
      const rows = (data || []) as any[];
      return {
        treinoIA: rows.find((r) => r.tipo === 'treino') || null,
        nutricaoIA: rows.find((r) => r.tipo === 'nutricao') || null,
      };
    },
  });

  // Copia o plano do cliente para a tabela do profissional como RASCUNHO.
  const usarComoBase = async (tipo: 'treino' | 'nutricao') => {
    if (!user) return;
    setUsandoBase(tipo);
    try {
      if (tipo === 'treino') {
        const t = geradoCliente?.treinoIA;
        const conteudo = (t?.conteudo || {}) as any;
        const fases = Array.isArray(conteudo.fases) ? conteudo.fases : [];
        const duracao = fases.reduce((s: number, f: any) => s + (Number(f.semanas) || 0), 0) || 8;
        const freq = fases.reduce((mx: number, f: any) => Math.max(mx, Array.isArray(f.sessoes) ? f.sessoes.length : 0), 0) || 3;
        const { error } = await (supabase as any).from('planos_treino').insert({
          terapeuta_id: user.id,
          paciente_id: pacienteId,
          titulo: `${t?.titulo || 'Treino do cliente'} (base do cliente)`,
          objetivo: conteudo?.baseadoEm?.objetivo ? 'personalizado' : 'saude',
          nivel: 'iniciante',
          frequencia_semanal: freq,
          duracao_semanas: duracao,
          restricoes: null,
          estrutura: conteudo,
          aprovado: false,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['planos-treino', pacienteId] });
      } else {
        const plano = (geradoCliente?.nutricaoIA?.conteudo || {}) as any;
        const { error } = await (supabase as any).from('planos_alimentares').insert({
          paciente_id: pacienteId,
          terapeuta_id: user.id,
          titulo: `${plano?.titulo || 'Plano alimentar do cliente'} (base do cliente)`,
          objetivo: 'Reeducação alimentar',
          calorias_alvo: plano?.calorias_totais || null,
          macros_alvo: plano?.macros || null,
          plano,
          ativo: true,
          aprovado: false,
        });
        if (error) throw error;
        qc.invalidateQueries({ queryKey: ['planos-alimentares', pacienteId] });
      }
      toast({ title: 'Copiado como rascunho ✅', description: 'Ajuste no card abaixo e libere a sua versão.' });
    } catch (e: any) {
      toast({ title: 'Não consegui copiar', description: e?.message || String(e), variant: 'destructive' });
    } finally {
      setUsandoBase(null);
    }
  };

  const clienteRef = (tipo: 'treino' | 'nutricao', titulo?: string | null) => (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3 flex items-center gap-3">
      <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <UserCheck className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground">O cliente montou no portal</p>
        <p className="text-[11px] text-muted-foreground truncate">{titulo || 'Plano gerado pelo cliente'}</p>
      </div>
      <Button size="sm" variant="outline" className="shrink-0 gap-1.5" disabled={usandoBase === tipo} onClick={() => usarComoBase(tipo)}>
        {usandoBase === tipo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
        Usar como base
      </Button>
    </div>
  );

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Planejamento por especialidade</p>
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="w-full grid grid-cols-3 sm:grid-cols-6 h-auto p-1 gap-0.5">
          <TabsTrigger value="fisio" className="text-[11px] gap-1 py-2 flex-col sm:flex-row"><Activity className="h-3.5 w-3.5" /> Reabilitação</TabsTrigger>
          <TabsTrigger value="nutricao" className="text-[11px] gap-1 py-2 flex-col sm:flex-row"><Apple className="h-3.5 w-3.5" /> Nutricional</TabsTrigger>
          <TabsTrigger value="treino" className="text-[11px] gap-1 py-2 flex-col sm:flex-row"><Dumbbell className="h-3.5 w-3.5" /> Personal</TabsTrigger>
          <TabsTrigger value="medicina" className="text-[11px] gap-1 py-2 flex-col sm:flex-row"><Stethoscope className="h-3.5 w-3.5" /> Médico</TabsTrigger>
          <TabsTrigger value="psicologia" className="text-[11px] gap-1 py-2 flex-col sm:flex-row"><Brain className="h-3.5 w-3.5" /> Psicólogo</TabsTrigger>
          <TabsTrigger value="odontologia" className="text-[11px] gap-1 py-2 flex-col sm:flex-row"><Smile className="h-3.5 w-3.5" /> Dentista</TabsTrigger>
        </TabsList>

        <TabsContent value="fisio" className="mt-4">
          <Suspense fallback={Fallback}>
            <PacienteProtocolosTab pacienteId={pacienteId} pacienteNome={pacienteNome} tipo="identidade" />
          </Suspense>
        </TabsContent>

        <TabsContent value="nutricao" className="mt-4 space-y-3">
          {geradoCliente?.nutricaoIA && clienteRef('nutricao', geradoCliente.nutricaoIA.titulo)}
          <HintLiberar />
          <Suspense fallback={Fallback}>
            <PlanoAlimentarCard pacienteId={pacienteId} />
            <DiretrizNutricionalCard pacienteId={pacienteId} />
          </Suspense>
        </TabsContent>

        <TabsContent value="treino" className="mt-4 space-y-3">
          {geradoCliente?.treinoIA && clienteRef('treino', geradoCliente.treinoIA.titulo)}
          <HintLiberar />
          <Suspense fallback={Fallback}>
            <PlanoTreinoCard pacienteId={pacienteId} />
            <DiretrizTreinoCard pacienteId={pacienteId} />
          </Suspense>
        </TabsContent>

        {AREAS_CLINICAS.map((a) => (
          <TabsContent key={a.value} value={a.value} className="mt-4 space-y-3">
            <HintLiberar />
            <Suspense fallback={Fallback}>
              <DiretrizAreaCard
                pacienteId={pacienteId}
                area={a.value}
                nomeCard={a.nome}
                funcaoIA="gerar-diretriz-clinica"
                Icone={a.Icone}
                corIcone={a.cor}
                descricaoVazio="Gere a diretriz de tratamento a partir da avaliação presencial, do MyID e dos questionários respondidos."
                descricaoGerar="A IA usa a avaliação presencial (achados + suas observações), o MyID e os questionários. Depois é só revisar e enviar ao portal."
                placeholderObjetivo={a.ph}
              />
            </Suspense>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
