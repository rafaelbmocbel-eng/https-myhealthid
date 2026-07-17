import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, ChevronDown, ChevronUp, ShieldAlert, Stethoscope, ChevronRight, Info } from 'lucide-react';
import { scoresDoResultado } from '@/utils/myid/scores';

// Dimensão MyID (com perda) → perfis do catálogo (mesmo mapa do Dever de Casa).
const DIM_TO_PERFIS: Record<string, string[]> = {
  D: ['DOR_PERCEBIDA'], EFI: ['FUNCIONALIDADE_COMPROMETIDA'], P: ['PSICO_COMPORTAMENTAL'],
  R: ['REGULACAO_CRITICA'], AF: ['FUNCIONALIDADE_COMPROMETIDA', 'ESTRUTURAL'],
  ERG: ['ESTRUTURAL', 'ERGONOMIA'], HID: ['HIDRATACAO'],
};
const asArr = (v: any): any[] => (Array.isArray(v) ? v : []);

interface Dica {
  id: string; nome: string; categoria: string | null; descricao: string | null;
  instrucoes: any; precaucoes: any; perfis_indicados: any; tempo_duracao: string | null;
}

export default function PacienteDicas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [dicas, setDicas] = useState<Dica[]>([]);
  const [pessoais, setPessoais] = useState<Dica[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pac } = await supabase.from('pacientes').select('id').eq('user_id', user.id).maybeSingle();
      // 1) Dicas PERSONALIZADAS — geradas automaticamente pela IA quando o
      // MyID é concluído (MyID + história clínica + artigos científicos).
      if (pac) {
        const { data: pd } = await (supabase as any).from('paciente_dicas')
          .select('dicas').eq('paciente_id', pac.id).maybeSingle();
        const lista = Array.isArray(pd?.dicas) ? pd.dicas : [];
        setPessoais(lista.map((d: any, i: number) => ({
          id: `pd-${i}`, nome: d.nome || 'Dica', categoria: d.categoria || null,
          descricao: d.descricao || null, instrucoes: d.instrucoes || [],
          precaucoes: d.precaucoes || [], perfis_indicados: [], tempo_duracao: d.tempo_duracao || null,
        })));
      }
      // Perfis recomendados a partir do MyID
      const perfis = new Set<string>();
      if (pac) {
        const { data: my } = await supabase.from('myid_avaliacoes')
          .select('resultado_processado').eq('paciente_id', pac.id).eq('status', 'concluido')
          .order('updated_at', { ascending: false }).limit(1).maybeSingle();
        const scores = scoresDoResultado(my?.resultado_processado) || {};
        Object.entries(scores).forEach(([dim, val]) => {
          const v = Number(val); if (Number.isNaN(v)) return;
          const isDemanda = ['D', 'EFI', 'P', 'I'].includes(dim);
          const fraca = isDemanda ? v >= 6 : v <= 5;
          if (fraca && DIM_TO_PERFIS[dim]) DIM_TO_PERFIS[dim].forEach(p => perfis.add(p));
        });
      }
      // Exercícios/dicas aprovados (leitura pública). Filtra por perfil do MyID;
      // se não houver MyID/perfil, mostra uma seleção geral.
      const { data } = await supabase.from('exercicios_biblioteca')
        .select('id, nome, categoria, descricao, instrucoes, precaucoes, perfis_indicados, tempo_duracao')
        .eq('aprovado', true).limit(200);
      let itens = (data || []) as Dica[];
      if (perfis.size > 0) {
        const filtradas = itens.filter(e => asArr(e.perfis_indicados).some((p: string) => perfis.has(p)));
        if (filtradas.length > 0) itens = filtradas;
      }
      setDicas(itens.slice(0, 30));
      setLoading(false);
    })();
  }, [user]);

  const grupos = useMemo(() => {
    const g: Record<string, Dica[]> = {};
    dicas.forEach(d => { const k = d.categoria || 'Geral'; (g[k] ||= []).push(d); });
    const entradas = Object.entries(g);
    // As personalizadas (IA + MyID + história) vêm SEMPRE primeiro.
    if (pessoais.length > 0) entradas.unshift(['✨ Feitas pra você (do seu MyID)', pessoais]);
    return entradas;
  }, [dicas, pessoais]);

  return (
    <ProtectedPatientRoute><PacienteLayout>
      <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
        <div>
          <h1 className="h-page flex items-center gap-2"><Lightbulb className="h-5 w-5 text-primary" /> Dicas pra você</h1>
          <p className="text-xs text-muted-foreground">Exercícios e dicas baseados em evidência científica, escolhidos a partir da sua avaliação MyID.</p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/50 border border-border/40">
          <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            Dicas gerais de <strong>apoio</strong>, com base em evidência — <strong>não substituem</strong> avaliação profissional. Para um plano individual, procure um profissional.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : dicas.length === 0 && pessoais.length === 0 ? (
          <Card><CardContent className="p-8 text-center">
            <Lightbulb className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Ainda não há dicas disponíveis</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Complete sua avaliação MyID para receber dicas personalizadas.</p>
          </CardContent></Card>
        ) : (
          grupos.map(([cat, itens]) => (
            <div key={cat} className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">{cat}</p>
              {itens.map(d => {
                const open = aberto === d.id;
                return (
                  <Card key={d.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold">{d.nome}</span>
                            {d.tempo_duracao && <Badge variant="outline" className="text-[10px]">{d.tempo_duracao}</Badge>}
                          </div>
                          {d.descricao && <p className="text-xs text-muted-foreground mt-1">{d.descricao}</p>}
                          {(asArr(d.instrucoes).length > 0 || asArr(d.precaucoes).length > 0) && (
                            <button onClick={() => setAberto(open ? null : d.id)} className="text-[11px] text-primary flex items-center gap-0.5 mt-1.5">
                              {open ? <>Menos <ChevronUp className="h-3 w-3" /></> : <>Como fazer <ChevronDown className="h-3 w-3" /></>}
                            </button>
                          )}
                        </div>
                      </div>
                      {open && (
                        <div className="mt-2 space-y-2 text-xs border-t border-border/40 pt-2">
                          {asArr(d.instrucoes).length > 0 && (
                            <ol className="list-decimal pl-4 space-y-0.5 text-muted-foreground">
                              {asArr(d.instrucoes).map((s, i) => <li key={i}>{String(s)}</li>)}
                            </ol>
                          )}
                          {asArr(d.precaucoes).length > 0 && (
                            <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                              <ShieldAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                              <span>{asArr(d.precaucoes).map(String).join(' · ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ))
        )}

        {/* CTA — procure um profissional (alimenta a Vitrine) */}
        <Card className="border-0 shadow-md overflow-hidden">
          <button onClick={() => navigate('/paciente/profissionais')}
            className="w-full text-left p-4 flex items-center gap-3 text-white" style={{ background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%)' }}>
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0"><Stethoscope className="h-5 w-5" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black">Quer um plano individual, de verdade?</p>
              <p className="text-[11px] text-white/80 mt-0.5">Procure um profissional que usa o My Health ID — ele personaliza tudo pra você, com exames e acompanhamento.</p>
            </div>
            <ChevronRight className="h-5 w-5 text-white/80 shrink-0" />
          </button>
        </Card>
      </div>
    </PacienteLayout></ProtectedPatientRoute>
  );
}
