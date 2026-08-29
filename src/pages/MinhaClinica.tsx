import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AppLayout from '@/components/AppLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlanoGate } from '@/components/planos/PlanoGate';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { getBaseUrl } from '@/utils/linkUrls';
import { Building2, UserPlus, Copy, Trash2, Loader2, LogOut, Crown, Link2 } from 'lucide-react';

const PERFIL_LABEL: Record<string, string> = {
  fisioterapeuta: 'Fisioterapeuta', medico: 'Médico(a)', psicologo: 'Psicólogo(a)',
  nutricionista: 'Nutricionista', educador_fisico: 'Educador Físico', terapeuta_ocupacional: 'T. Ocupacional',
  dentista: 'Dentista',
};
const PAPEL_LABEL: Record<string, string> = { dono: 'Dono', profissional: 'Profissional', recepcao: 'Recepção' };

interface Membro { id: string; user_id: string; papel: string; status: string; perfil: string | null; nome: string | null; email: string | null; }
interface Convite { id: string; email: string; papel: string; token: string; expira_em: string; }
interface Equipe { clinica: { id: string; nome: string; ativa: boolean; limite: number; sou_dono: boolean }; membros: Membro[]; convites: Convite[]; }

const linkConvite = (token: string) => `${getBaseUrl()}/clinica/convite/${token}`;

export default function MinhaClinica() {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [nomeNova, setNomeNova] = useState('');
  const [conviteEmail, setConviteEmail] = useState('');
  const [convitePapel, setConvitePapel] = useState('profissional');

  const { data: equipe, isLoading } = useQuery<Equipe | null>({
    queryKey: ['minha-clinica'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('minha_clinica_equipe');
      if (error) throw error;
      return (data as Equipe | null) || null;
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['minha-clinica'] });

  const criar = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc('criar_minha_clinica', { p_nome: nomeNova });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Clínica criada 🎉' }); setNomeNova(''); invalidate(); },
    onError: (e: any) => toast({ title: 'Erro ao criar', description: e.message, variant: 'destructive' }),
  });

  const convidar = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('convidar_clinica', { p_email: conviteEmail, p_papel: convitePapel });
      if (error) throw error;
      return data as string; // token
    },
    onSuccess: async (token) => {
      setConviteEmail('');
      try { await navigator.clipboard.writeText(linkConvite(token)); } catch { /* clipboard pode falhar em http */ }
      toast({ title: 'Convite criado — link copiado', description: 'Envie o link ao profissional para ele entrar na clínica.' });
      invalidate();
    },
    onError: (e: any) => {
      const msg = /limite_atingido/.test(e.message) ? 'Limite de profissionais atingido para o plano.' : e.message;
      toast({ title: 'Não foi possível convidar', description: msg, variant: 'destructive' });
    },
  });

  const remover = useMutation({
    mutationFn: async (membroId: string) => {
      const { error } = await (supabase as any).rpc('remover_membro_clinica', { p_membro_id: membroId });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Membro removido' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const cancelarConvite = useMutation({
    mutationFn: async (conviteId: string) => {
      const { error } = await (supabase as any).rpc('cancelar_convite_clinica', { p_convite_id: conviteId });
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Convite cancelado' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Erro', description: e.message, variant: 'destructive' }),
  });

  const copiar = (txt: string) => {
    navigator.clipboard.writeText(txt).then(
      () => toast({ title: 'Link copiado 🔗' }),
      () => toast({ title: 'Copie manualmente', description: txt }),
    );
  };

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-bold">Minha Clínica</h1>
        </div>

        <PlanoGate
          feature="multi_profissional"
          title="Plano Clínica"
          description="Trabalhe com vários profissionais na mesma clínica — cada um com seu login, compartilhando pacientes e agenda. Disponível no plano Clínica."
        >
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : !equipe ? (
            // ── Sem clínica: criar ──
            <Card className="p-5 space-y-3">
              <h2 className="font-semibold">Crie sua clínica</h2>
              <p className="text-sm text-muted-foreground">
                Dê um nome à clínica. Depois você convida os outros profissionais (fisioterapeuta, educador físico, nutricionista, médico...) — cada um entra com o próprio login e passa a compartilhar os pacientes.
              </p>
              <div className="flex gap-2">
                <Input placeholder="Nome da clínica" value={nomeNova} onChange={(e) => setNomeNova(e.target.value)} />
                <Button onClick={() => criar.mutate()} disabled={criar.isPending || !nomeNova.trim()}>
                  {criar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar clínica'}
                </Button>
              </div>
            </Card>
          ) : (
            <>
              {/* ── Cabeçalho da clínica ── */}
              <Card className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{equipe.clinica.nome}</div>
                  <div className="text-xs text-muted-foreground">
                    {equipe.membros.length} de {equipe.clinica.limite} profissionais · {equipe.clinica.sou_dono ? 'Você é o dono' : 'Você é membro'}
                  </div>
                </div>
                {equipe.clinica.sou_dono && <Badge className="gap-1"><Crown className="h-3 w-3" /> Dono</Badge>}
              </Card>

              {/* ── Equipe ── */}
              <Card className="p-4 space-y-2">
                <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Equipe</h2>
                {equipe.membros.map((m) => {
                  const ehOutroDono = m.papel === 'dono';
                  return (
                    <div key={m.id} className="flex items-center gap-2 py-1.5 border-b border-border/40 last:border-0">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{m.nome || m.email || 'Profissional'}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          {m.email && <span className="truncate">{m.email}</span>}
                        </div>
                      </div>
                      {m.perfil && <Badge variant="outline" className="text-[10px]">{PERFIL_LABEL[m.perfil] || m.perfil}</Badge>}
                      <Badge variant={ehOutroDono ? 'default' : 'secondary'} className="text-[10px]">{PAPEL_LABEL[m.papel] || m.papel}</Badge>
                      {equipe.clinica.sou_dono && !ehOutroDono && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={remover.isPending}
                          onClick={() => { if (confirm(`Remover ${m.nome || m.email || 'este membro'} da clínica?`)) remover.mutate(m.id); }}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </Card>

              {/* ── Convidar (só dono) ── */}
              {equipe.clinica.sou_dono && (
                <Card className="p-4 space-y-3">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4" /> Convidar profissional
                  </h2>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input type="email" placeholder="e-mail do profissional" value={conviteEmail}
                      onChange={(e) => setConviteEmail(e.target.value)} className="flex-1" />
                    <Select value={convitePapel} onValueChange={setConvitePapel}>
                      <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="profissional">Profissional</SelectItem>
                        <SelectItem value="recepcao">Recepção</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={() => convidar.mutate()} disabled={convidar.isPending || !conviteEmail.trim()}>
                      {convidar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Gerar convite'}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    O convite gera um link — envie ao profissional. Ele entra com o próprio login (ou cria uma conta) e passa a fazer parte da clínica. O perfil profissional dele define o que pode chancelar.
                  </p>

                  {equipe.convites.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[11px] font-semibold text-muted-foreground">Convites pendentes</div>
                      {equipe.convites.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-xs bg-muted/30 rounded-lg p-2">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="flex-1 min-w-0 truncate">{c.email} · {PAPEL_LABEL[c.papel] || c.papel}</span>
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="Copiar link" onClick={() => copiar(linkConvite(c.token))}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" title="Cancelar convite" aria-label="Cancelar convite" onClick={() => { if (confirm('Cancelar este convite? O link deixará de funcionar.')) cancelarConvite.mutate(c.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              {/* ── Sair (membro não-dono) ── */}
              {!equipe.clinica.sou_dono && (() => {
                const meu = equipe.membros.find((m) => m.user_id === user?.id);
                if (!meu) return null;
                return (
                  <Button variant="outline" className="gap-2 text-destructive" disabled={remover.isPending}
                    onClick={() => { if (confirm('Sair desta clínica?')) remover.mutate(meu.id); }}>
                    <LogOut className="h-4 w-4" /> Sair da clínica
                  </Button>
                );
              })()}
            </>
          )}
        </PlanoGate>
      </div>
    </AppLayout>
  );
}
