import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Dumbbell, Search, Loader2, ChevronRight, ArrowLeft } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Aplicacao {
  id: string;
  nome: string;
  descricao: string;
  detalhes: string[];
  icone: typeof Dumbbell;
  rota: (pacienteId: string) => string;
}

// Ferramentas de avaliação que trabalham sobre um paciente. Para incluir uma
// nova, basta acrescentar um item aqui com a rota da página dela.
const APLICACOES: Aplicacao[] = [
  {
    id: 'dinamometria',
    nome: 'Análise de dinamometria',
    descricao: 'Importa o Excel do dinamômetro e gera a avaliação de força.',
    detalhes: ['Simetria entre lados e razão agonista/antagonista', 'Fadiga, taxa de desenvolvimento de força e curvas', 'Score de força, evolução e relatório em PDF'],
    icone: Dumbbell,
    rota: id => `/pacientes/${id}/dinamometria`,
  },
];

export default function Aplicacoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [escolhida, setEscolhida] = useState<Aplicacao | null>(null);
  const [busca, setBusca] = useState('');

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['aplicacoes-pacientes', user?.id, busca],
    enabled: !!escolhida && !!user,
    queryFn: async () => {
      let q = (supabase as any).from('pacientes').select('id, nome, sobrenome').eq('terapeuta_id', user!.id).eq('ativo', true).order('nome').limit(30);
      const termo = busca.trim();
      if (termo) q = q.ilike('nome', `%${termo}%`);
      const { data } = await q;
      return (data || []) as { id: string; nome: string; sobrenome: string | null }[];
    },
  });

  return (
    <AppLayout>
      <div className="container max-w-5xl py-6 space-y-5">
        <PageHeader
          title="Aplicações"
          subtitle="Ferramentas de avaliação para usar com seus pacientes."
          icon={<LayoutGrid className="icon-md" />}
        />

        {!escolhida ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {APLICACOES.map(a => {
              const Icone = a.icone;
              return (
                <Card key={a.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="h-10 w-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 flex items-center justify-center shrink-0"><Icone className="h-5 w-5" /></span>
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{a.nome}</p>
                      <p className="text-xs text-muted-foreground">{a.descricao}</p>
                    </div>
                  </div>
                  <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-0.5">
                    {a.detalhes.map(d => <li key={d}>{d}</li>)}
                  </ul>
                  <Button className="mt-auto" onClick={() => { setEscolhida(a); setBusca(''); }}>Abrir</Button>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEscolhida(null)}><ArrowLeft className="h-4 w-4 mr-1" />Aplicações</Button>
            </div>
            <div>
              <p className="font-semibold">{escolhida.nome}</p>
              <p className="text-sm text-muted-foreground">Escolha o paciente da avaliação.</p>
            </div>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus className="pl-9" placeholder="Buscar pelo nome" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : pacientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{busca ? 'Nenhum paciente com esse nome.' : 'Nenhum paciente ativo cadastrado.'}</p>
            ) : (
              <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
                {pacientes.map(p => (
                  <li key={p.id}>
                    <button type="button" onClick={() => navigate(escolhida.rota(p.id))} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-muted/50">
                      <span className="text-sm font-medium">{`${p.nome} ${p.sobrenome || ''}`.trim()}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
