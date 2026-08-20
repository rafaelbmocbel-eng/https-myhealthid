import { lazy, Suspense, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Activity, Dumbbell, Apple, Loader2, Copy, UserCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Hub da aba "Diretrizes" do profissional: reúne, em 3 sub-abas, a produção de
// Fisioterapia (diretriz existente), Reabilitação/Treino e Nutrição — usando os
// MESMOS componentes e tabelas que o Portal já usa (planos_treino /
// planos_alimentares), então o que se edita aqui aparece lá e vice-versa.
const PacienteProtocolosTab = lazy(() => import('@/components/paciente/PacienteProtocolosTab'));
const PlanoTreinoCard = lazy(() => import('@/components/educador/PlanoTreinoCard'));
const DiretrizTreinoCard = lazy(() => import('@/components/educador/DiretrizTreinoCard'));
const PlanoAlimentarCard = lazy(() => import('@/components/nutricao/PlanoAlimentarCard'));
const DiretrizNutricionalCard = lazy(() => import('@/components/nutricao/DiretrizNutricionalCard'));

const Fallback = <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

interface Props {
  pacienteId: string;
  pacienteNome: string;
}

export default function DiretrizesPlanosHub({ pacienteId, pacienteNome }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [usandoBase, setUsandoBase] = useState<null | 'treino' | 'nutricao'>(null);

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
    <Tabs defaultValue="fisio" className="w-full">
      <TabsList className="w-full grid grid-cols-3 h-auto p-1">
        <TabsTrigger value="fisio" className="text-xs gap-1.5 py-2"><Activity className="h-3.5 w-3.5" /> Fisioterapia</TabsTrigger>
        <TabsTrigger value="treino" className="text-xs gap-1.5 py-2"><Dumbbell className="h-3.5 w-3.5" /> Reabilitação/Treino</TabsTrigger>
        <TabsTrigger value="nutricao" className="text-xs gap-1.5 py-2"><Apple className="h-3.5 w-3.5" /> Nutrição</TabsTrigger>
      </TabsList>

      <TabsContent value="fisio" className="mt-4">
        <Suspense fallback={Fallback}>
          <PacienteProtocolosTab pacienteId={pacienteId} pacienteNome={pacienteNome} tipo="identidade" />
        </Suspense>
      </TabsContent>

      <TabsContent value="treino" className="mt-4 space-y-3">
        {geradoCliente?.treinoIA && clienteRef('treino', geradoCliente.treinoIA.titulo)}
        <Suspense fallback={Fallback}>
          <PlanoTreinoCard pacienteId={pacienteId} />
          <DiretrizTreinoCard pacienteId={pacienteId} />
        </Suspense>
      </TabsContent>

      <TabsContent value="nutricao" className="mt-4 space-y-3">
        {geradoCliente?.nutricaoIA && clienteRef('nutricao', geradoCliente.nutricaoIA.titulo)}
        <Suspense fallback={Fallback}>
          <PlanoAlimentarCard pacienteId={pacienteId} />
          <DiretrizNutricionalCard pacienteId={pacienteId} />
        </Suspense>
      </TabsContent>
    </Tabs>
  );
}
