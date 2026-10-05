import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutGrid, Dumbbell, Search, Loader2, ChevronRight, ArrowLeft, UserPlus, UserRound, Zap, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Aplicacao {
  id: string;
  nome: string;
  /** Nome curto, só para leitores de tela e dicas (a tela mostra apenas o ícone). */
  curto: string;
  /** Lida por leitores de tela; a tela mostra só o ícone e o nome. */
  descricao: string;
  icone: typeof Dumbbell;
  /** Classes do azulejo do ícone (claro e escuro). */
  cor: string;
  rota: (pacienteId: string) => string;
  /** Abre direto, sem escolher paciente antes; o paciente é opcional dentro da ferramenta. */
  rotaDireta?: string;
}

// Ferramentas de avaliação que trabalham sobre um paciente. Para incluir uma
// nova, basta acrescentar um item aqui com a rota da página dela.
const APLICACOES: Aplicacao[] = [
  {
    id: 'dinamometria',
    nome: 'Análise de dinamometria',
    curto: 'Dinamometria',
    descricao: 'Célula de carga Bluetooth ou Excel do dinamômetro: teste de força guiado, simetria, fadiga e treino com alvo.',
    icone: Dumbbell,
    cor: 'from-emerald-500/20 to-emerald-500/5 text-emerald-700 ring-emerald-500/25 dark:text-emerald-300',
    rota: id => `/dinamometria?paciente=${id}`,
  },
  {
    id: 'dosagem',
    nome: 'Dosagem de eletrotermofototerapia',
    curto: 'Dosagem',
    descricao: 'Guia do recurso com mais respaldo para cada patologia e calculadoras de dose, com a fonte de cada número.',
    icone: Zap,
    cor: 'from-sky-500/20 to-sky-500/5 text-sky-700 ring-sky-500/25 dark:text-sky-300',
    rota: id => `/dosagem?paciente=${id}`,
    rotaDireta: '/dosagem',
  },
  {
    id: 'analise-angular',
    nome: 'Análise angular',
    curto: 'Análise angular',
    descricao: 'Ângulos e desníveis do corpo em foto e análise da marcha em vídeo, com comparação e PDF.',
    icone: Ruler,
    cor: 'from-violet-500/20 to-violet-500/5 text-violet-700 ring-violet-500/25 dark:text-violet-300',
    rota: id => `/analise-angular?paciente=${id}`,
    rotaDireta: '/analise-angular',
  },
];

export default function Aplicacoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [escolhida, setEscolhida] = useState<Aplicacao | null>(null);
  const [busca, setBusca] = useState('');
  const [novo, setNovo] = useState<null | { nome: string; telefone: string; nascimento: string; sexo: string; lgpd: boolean }>(null);
  const [salvando, setSalvando] = useState(false);

  // Cadastro rápido para quem vem só fazer o exame: mesmos campos e regras do
  // cadastro rápido da tela Pacientes, mais nascimento e sexo (usados nas normas).
  const cadastrar = async () => {
    if (!user || !escolhida || !novo) return;
    const partes = novo.nome.trim().split(/\s+/);
    if (!partes[0]) { toast.error('Informe o nome do cliente.'); return; }
    if (novo.telefone.replace(/\D/g, '').length < 10) { toast.error('Informe o WhatsApp/telefone com DDD.'); return; }
    if (!novo.lgpd) { toast.error('Confirme o aceite LGPD do cliente.'); return; }
    setSalvando(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8);
      const { data, error } = await (supabase as any).from('pacientes').insert({
        nome: partes[0],
        sobrenome: partes.slice(1).join(' '),
        telefone: novo.telefone,
        data_nascimento: novo.nascimento || null,
        sexo: novo.sexo || null,
        terapeuta_id: user.id,
        ativo: true,
        cadastro_status: 'pendente_paciente',
        portal_token: token,
        origem: 'cadastro_rapido',
        lgpd_aceite_em: new Date().toISOString(),
        lgpd_versao: '1.0',
        tipo_pagamento: 'particular',
      }).select('id').single();
      if (error) throw error;
      try {
        await (supabase as any).from('termos_consentimento').insert({
          paciente_id: data.id, terapeuta_id: user.id, tipo: 'lgpd', versao: '1.0',
          texto_termo: 'Autorizo o tratamento dos meus dados pessoais e de saúde para fins clínicos e administrativos, conforme a LGPD.',
          aceito: true, data_aceite: new Date().toISOString(),
        });
      } catch { /* o termo é complementar; o aceite já fica registrado no paciente */ }
      toast.success('Cliente cadastrado');
      navigate(escolhida.rota(data.id));
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cadastrar o cliente.');
    } finally {
      setSalvando(false);
    }
  };

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['aplicacoes-pacientes', user?.id, busca],
    enabled: !!escolhida && !!user,
    queryFn: async () => {
      let q = (supabase as any).from('pacientes').select('id, nome, sobrenome').eq('terapeuta_id', user!.id).eq('ativo', true).order('nome').limit(30);
      // Nomes ficam gravados sem acento: tira os acentos do que foi digitado.
      const termo = busca.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
          subtitle="Ferramentas de avaliação."
          icon={<LayoutGrid className="icon-md" />}
        />

        {!escolhida ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {APLICACOES.map(a => {
              const Icone = a.icone;
              const abrir = () => {
                if (a.rotaDireta) navigate(a.rotaDireta);
                else { setEscolhida(a); setBusca(''); }
              };
              return (
                <div key={a.id} className="group relative">
                  <button type="button" onClick={abrir} aria-label={`${a.nome}. ${a.descricao}`} title={a.nome}
                    className="flex aspect-square w-full items-center justify-center rounded-3xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                    <span className={`flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ring-1 ${a.cor}`}><Icone className="h-10 w-10" strokeWidth={1.75} /></span>
                  </button>
                  {a.rotaDireta && (
                    <button type="button" onClick={() => { setEscolhida(a); setBusca(''); }} aria-label={`${a.curto} com paciente`} title="Abrir com um paciente"
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/80 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <UserRound className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setEscolhida(null); setNovo(null); }}><ArrowLeft className="h-4 w-4 mr-1" />Aplicações</Button>
            </div>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold">{escolhida.nome}</p>
                <p className="text-sm text-muted-foreground">Escolha o paciente da avaliação ou cadastre um cliente novo.</p>
              </div>
              {!novo && <Button variant="outline" size="sm" onClick={() => setNovo({ nome: busca, telefone: '', nascimento: '', sexo: '', lgpd: false })}><UserPlus className="h-4 w-4 mr-1" />Cadastrar novo cliente</Button>}
            </div>
            {novo && (
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 space-y-3">
                <p className="font-medium text-sm">Novo cliente</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 sm:col-span-2"><Label htmlFor="ap-nome" className="text-xs">Nome completo</Label><Input id="ap-nome" value={novo.nome} onChange={e => setNovo(n => n && { ...n, nome: e.target.value })} /></div>
                  <div className="space-y-1"><Label htmlFor="ap-tel" className="text-xs">WhatsApp / telefone</Label><Input id="ap-tel" inputMode="tel" placeholder="(11) 99999-9999" value={novo.telefone} onChange={e => setNovo(n => n && { ...n, telefone: e.target.value })} /></div>
                  <div className="space-y-1"><Label htmlFor="ap-nasc" className="text-xs">Data de nascimento</Label><Input id="ap-nasc" type="date" value={novo.nascimento} onChange={e => setNovo(n => n && { ...n, nascimento: e.target.value })} /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">Sexo</Label>
                    <Select value={novo.sexo} onValueChange={v => setNovo(n => n && { ...n, sexo: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent><SelectItem value="masculino">Masculino</SelectItem><SelectItem value="feminino">Feminino</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <label htmlFor="ap-lgpd" className="flex items-start gap-2 text-sm cursor-pointer">
                  <Checkbox id="ap-lgpd" checked={novo.lgpd} onCheckedChange={v => setNovo(n => n && { ...n, lgpd: v === true })} className="mt-0.5" />
                  <span>O cliente autorizou o uso dos dados pessoais e de saúde para fins clínicos e administrativos (LGPD).</span>
                </label>
                <div className="flex gap-2">
                  <Button onClick={cadastrar} disabled={salvando}>{salvando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}Cadastrar e abrir a avaliação</Button>
                  <Button variant="ghost" onClick={() => setNovo(null)}>Cancelar</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">O cliente entra na sua lista de pacientes. Os demais dados podem ser completados depois no cadastro.</p>
              </div>
            )}
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus className="pl-9" placeholder="Buscar pelo nome" value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : pacientes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{busca ? 'Nenhum paciente com esse nome. Use "Cadastrar novo cliente".' : 'Nenhum paciente ativo cadastrado.'}</p>
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
