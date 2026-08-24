import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Building2, Users, GraduationCap, DollarSign, TrendingUp, ShieldCheck } from 'lucide-react';

// Página PÚBLICA (sem login) do parceiro de vendas: mostra só o resumo de
// negócio. Nenhum dado de paciente, nenhum acesso ao app. O acesso é o token
// da URL (revogável pelo dono no painel admin).
interface Negocio {
  mrr_total: number; mrr_profissionais: number; mrr_alunos: number;
  clinicas_ativas: number; profissionais_ativos: number; alunos_ativos: number;
  receita_vendas_12m: number;
}

const fmtBRL = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtInt = (n: number) => n.toLocaleString('pt-BR');

function Stat({ icon: Icon, label, valor, sub }: { icon: any; label: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
        <Icon className="h-4 w-4 text-primary" /> {label}
      </div>
      <div className="text-2xl font-black tabular-nums">{valor}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ParceiroResumo() {
  const { token } = useParams<{ token: string }>();
  const [estado, setEstado] = useState<'carregando' | 'ok' | 'erro'>('carregando');
  const [label, setLabel] = useState('');
  const [neg, setNeg] = useState<Negocio | null>(null);
  const [geradoEm, setGeradoEm] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('resumo-parceiro', { body: { token } });
        if (!vivo) return;
        if (error || (data as any)?.error || !(data as any)?.ok) {
          setEstado('erro');
          return;
        }
        setLabel((data as any).label || '');
        setNeg((data as any).negocio);
        setGeradoEm((data as any).gerado_em || null);
        setEstado('ok');
      } catch {
        if (vivo) setEstado('erro');
      }
    })();
    return () => { vivo = false; };
  }, [token]);

  if (estado === 'carregando') {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" /> Carregando resumo…
      </div>
    );
  }

  if (estado === 'erro' || !neg) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <h1 className="text-lg font-bold mb-1">Link indisponível</h1>
          <p className="text-sm text-muted-foreground">Este link de resumo é inválido ou foi revogado. Peça um novo ao responsável.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-3xl mx-auto px-5 py-8">
        <header className="mb-6">
          <div className="flex items-center gap-2 text-primary font-black text-lg mb-1">
            <TrendingUp className="h-5 w-5" /> My Health ID
          </div>
          <h1 className="text-2xl font-black">Resumo de negócio</h1>
          <p className="text-sm text-muted-foreground">
            {label ? <>Compartilhado com <b>{label}</b> · </> : null}
            somente números agregados — sem dados de clientes.
          </p>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Stat icon={DollarSign} label="Receita recorrente (MRR)" valor={fmtBRL(neg.mrr_total)} sub={`Pro ${fmtBRL(neg.mrr_profissionais)} · Alunos ${fmtBRL(neg.mrr_alunos)}`} />
          <Stat icon={Building2} label="Clínicas ativas" valor={fmtInt(neg.clinicas_ativas)} />
          <Stat icon={Users} label="Profissionais ativos" valor={fmtInt(neg.profissionais_ativos)} />
          <Stat icon={GraduationCap} label="Alunos ativos" valor={fmtInt(neg.alunos_ativos)} />
          <Stat icon={DollarSign} label="Vendas (12 meses)" valor={fmtBRL(neg.receita_vendas_12m)} />
        </section>

        <footer className="mt-8 flex items-center gap-2 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" />
          Página de acesso restrito por link. {geradoEm ? `Atualizado em ${new Date(geradoEm).toLocaleString('pt-BR')}.` : ''} Nenhum dado pessoal de paciente é exibido aqui.
        </footer>
      </div>
    </div>
  );
}
