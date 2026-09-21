import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { normalizarBusca } from '@/lib/utils';
import { getPortalUrl } from '@/utils/linkUrls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Search, MessageCircle, Copy, Smartphone, Loader2, Send } from 'lucide-react';

type Estado = 'convidado' | 'entrou' | 'respondeu';

interface PacientePortal {
  id: string;
  nome: string;
  sobrenome: string | null;
  telefone: string | null;
  email: string | null;
  portal_token: string | null;
  user_id: string | null;
  estado: Estado;
}

// Painel do PORTAL DO CLIENTE (aba do Zap): mostra quem já ENTROU (criou conta)
// e quem RESPONDEU (MyID concluído), e envia o link pessoal em massa (WhatsApp /
// copiar). Um lugar só pra acompanhar e cobrar os clientes.
export default function CrmPortal({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useAuth();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todos' | Estado | 'sem_tel'>('todos');
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['crm-portal-pacientes', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: pac, error } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome, telefone, email, portal_token, user_id')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      const lista = (pac || []) as Omit<PacientePortal, 'estado'>[];

      // MyID concluído = "respondeu". Busca só os IDs dos nossos pacientes.
      const ids = lista.map((p) => p.id);
      const respondeu = new Set<string>();
      if (ids.length) {
        const { data: myid } = await (supabase as any)
          .from('myid_avaliacoes')
          .select('paciente_id')
          .eq('status', 'concluido')
          .in('paciente_id', ids);
        (myid || []).forEach((m: any) => m?.paciente_id && respondeu.add(m.paciente_id));
      }

      return lista.map((p): PacientePortal => ({
        ...p,
        estado: respondeu.has(p.id) ? 'respondeu' : p.user_id ? 'entrou' : 'convidado',
      }));
    },
  });

  const contagem = useMemo(() => ({
    total: pacientes.length,
    convidado: pacientes.filter((p) => p.estado === 'convidado').length,
    entrou: pacientes.filter((p) => p.estado === 'entrou').length,
    respondeu: pacientes.filter((p) => p.estado === 'respondeu').length,
  }), [pacientes]);

  const lista = useMemo(() => {
    const q = normalizarBusca(busca);
    return pacientes.filter((p) => {
      if (q && !normalizarBusca(`${p.nome} ${p.sobrenome || ''}`).includes(q)) return false;
      if (filtro === 'sem_tel') return !(p.telefone || '').replace(/\D/g, '');
      if (filtro !== 'todos') return p.estado === filtro;
      return true;
    });
  }, [pacientes, busca, filtro]);

  const msgDe = (p: PacientePortal, url: string) =>
    `Olá ${p.nome}! Esse é o seu acesso ao Portal do Paciente:\n${url}\n\nÉ só abrir, criar sua senha e responder sua avaliação. 🙂`;

  const enviarWhats = (p: PacientePortal) => {
    if (!p.portal_token) return;
    const url = getPortalUrl(p.portal_token);
    const tel = (p.telefone || '').replace(/\D/g, '');
    const num = tel.length >= 12 ? tel : `55${tel}`;
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msgDe(p, url))}`, '_blank');
    setEnviados((s) => new Set(s).add(p.id));
  };
  const copiar = async (token: string) => {
    try { await navigator.clipboard.writeText(getPortalUrl(token)); toast.success('Link copiado!'); }
    catch { toast.error('Não consegui copiar.'); }
  };
  const copiarTodos = async () => {
    const linhas = lista
      .filter((p) => p.portal_token)
      .map((p) => `${`${p.nome} ${p.sobrenome || ''}`.trim()}: ${getPortalUrl(p.portal_token!)}`);
    if (!linhas.length) { toast.error('Nenhum link disponível na lista atual.'); return; }
    try { await navigator.clipboard.writeText(linhas.join('\n')); toast.success(`${linhas.length} link(s) copiado(s)!`); }
    catch { toast.error('Não consegui copiar — tente item a item.'); }
  };

  const seloEstado = (e: Estado) => {
    if (e === 'respondeu') return <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">respondeu</Badge>;
    if (e === 'entrou') return <Badge className="text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300">entrou</Badge>;
    return <Badge variant="outline" className="text-[10px] text-muted-foreground">não entrou</Badge>;
  };

  const StatChip = ({ label, valor, cor, ativo, onClick }: { label: string; valor: number; cor: string; ativo: boolean; onClick: () => void }) => (
    <button onClick={onClick}
      className={`flex-1 min-w-[84px] rounded-xl border p-2.5 text-left transition-colors ${ativo ? 'border-primary bg-primary/5' : 'border-border/50 hover:bg-muted/40'}`}>
      <div className={`text-xl font-black tabular-nums ${cor}`}>{valor}</div>
      <div className="text-[11px] text-muted-foreground leading-tight">{label}</div>
    </button>
  );

  return (
    <div className={embedded ? 'p-3 sm:p-4 space-y-4' : 'container py-4 space-y-4'}>
      {!embedded && (
        <div>
          <div className="eyebrow-accent mb-1.5">Portal do cliente</div>
          <h1 className="h-page flex items-center gap-2"><Smartphone className="h-5 w-5 text-muted-foreground/70" /> Acesso &amp; respostas</h1>
          <p className="text-caption mt-1">Acompanhe quem entrou e quem respondeu, e envie o link de acesso.</p>
        </div>
      )}

      {/* Resumo (também filtram ao tocar) */}
      <div className="flex gap-2 flex-wrap">
        <StatChip label="Total" valor={contagem.total} cor="text-foreground" ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} />
        <StatChip label="Não entraram" valor={contagem.convidado} cor="text-muted-foreground" ativo={filtro === 'convidado'} onClick={() => setFiltro('convidado')} />
        <StatChip label="Entraram" valor={contagem.entrou} cor="text-sky-600" ativo={filtro === 'entrou'} onClick={() => setFiltro('entrou')} />
        <StatChip label="Responderam" valor={contagem.respondeu} cor="text-emerald-600" ativo={filtro === 'respondeu'} onClick={() => setFiltro('respondeu')} />
      </div>

      {/* Busca + copiar todos */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
          <Input className="h-9 pl-8" placeholder="Filtrar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        {filtro !== 'todos' && filtro !== 'sem_tel' && (
          <Button variant="ghost" size="sm" className="h-9 text-xs shrink-0" onClick={() => setFiltro('todos')}>limpar filtro</Button>
        )}
        <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0" onClick={copiarTodos} title="Copiar nome + link de todos os listados">
          <Copy className="h-3.5 w-3.5" /> Copiar todos
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : lista.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">Nenhum cliente nesta lista.</p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground px-1">{lista.length} cliente(s)</p>
          {lista.map((p) => {
            const tel = (p.telefone || '').replace(/\D/g, '');
            return (
              <div key={p.id} className="rounded-lg border border-border/50 p-2.5 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate flex items-center gap-1.5">
                    {p.nome} {p.sobrenome || ''}
                    {enviados.has(p.id) && <Send className="h-3 w-3 text-emerald-600 shrink-0" />}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {seloEstado(p.estado)}
                    <span className="text-[11px] text-muted-foreground">{tel ? p.telefone : 'sem telefone'}</span>
                  </div>
                </div>
                {p.portal_token ? (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" disabled={!tel} onClick={() => enviarWhats(p)}
                      className="h-8 gap-1.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white">
                      <MessageCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">WhatsApp</span>
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Copiar link" onClick={() => copiar(p.portal_token!)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <span className="text-[11px] text-muted-foreground shrink-0">sem link</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
