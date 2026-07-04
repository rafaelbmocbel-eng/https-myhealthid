import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { ArrowLeft, MapPin, DollarSign, User, CheckCircle2, Send, Loader2, ShieldCheck, Heart } from 'lucide-react';
import logoFull from '@/assets/logo-myhealthid-full.webp';

type Terapeuta = {
  terapeuta_id: string;
  nome_exibicao: string | null;
  bio: string | null;
  especialidades: string[] | null;
  convenios: string[] | null;
  cidade: string | null;
  uf: string | null;
  valor_sessao: number | null;
  foto_url: string | null;
};

export default function PerfilPublicoTerapeuta() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [solicitado, setSolicitado] = useState(false);

  const { data: terapeuta, isLoading, isError } = useQuery({
    queryKey: ['vitrine-terapeuta', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vitrine_terapeutas')
        .select('*')
        .eq('terapeuta_id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Terapeuta | null;
    },
  });

  const mutSolicitar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('not_authenticated');
      const { error } = await supabase.from('solicitacoes_conexao').insert({
        paciente_user_id: user.id,
        terapeuta_id: id!,
        mensagem: mensagem.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSolicitado(true);
      setDialogOpen(false);
      toast.success('Solicitação enviada! O profissional receberá seu pedido.');
    },
    onError: (e: any) => {
      if (e?.code === '23505') {
        toast.error('Você já enviou uma solicitação para este profissional.');
      } else {
        toast.error('Erro ao enviar solicitação. Tente novamente.');
      }
    },
  });

  const handleSolicitar = () => {
    if (!user) {
      navigate(`/paciente/login?proxima=/portaldocliente/terapeuta/${id}`);
      return;
    }
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !terapeuta) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-4 text-center">
        <Heart className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-semibold text-foreground">Perfil não encontrado</p>
        <p className="text-xs text-muted-foreground mt-1">Este profissional pode não estar mais disponível na vitrine.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/portaldocliente/vitrine')}>
          Voltar à vitrine
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/portaldocliente/vitrine')}
              className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <img src={logoFull} alt="My Health ID" className="h-7 w-auto object-contain" />
          </div>
          {!user && (
            <Button size="sm" variant="outline" onClick={() => navigate('/paciente/login')}>
              Entrar
            </Button>
          )}
        </div>
      </header>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
        {/* Profile card */}
        <div className="rounded-2xl border border-border/40 bg-card p-6">
          <div className="flex items-start gap-4 mb-5">
            {terapeuta.foto_url ? (
              <img
                src={terapeuta.foto_url}
                alt={terapeuta.nome_exibicao || 'Terapeuta'}
                className="w-20 h-20 rounded-2xl object-cover bg-muted shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-9 w-9 text-primary/50" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black text-foreground leading-tight">
                {terapeuta.nome_exibicao || 'Profissional'}
              </h1>
              {terapeuta.cidade && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {terapeuta.cidade}{terapeuta.uf ? `, ${terapeuta.uf}` : ''}
                </p>
              )}
              {terapeuta.valor_sessao && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-semibold">
                  <DollarSign className="h-3.5 w-3.5" />
                  R$ {Number(terapeuta.valor_sessao).toFixed(0)} por sessão
                </p>
              )}
            </div>
          </div>

          {/* Especialidades */}
          {(terapeuta.especialidades?.length || 0) > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Especialidades</p>
              <div className="flex flex-wrap gap-1.5">
                {terapeuta.especialidades!.map((e) => (
                  <Badge key={e} variant="outline" className="text-xs border-primary/30 text-primary/80">
                    {e}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Bio */}
          {terapeuta.bio && (
            <div className="mb-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Sobre mim</p>
              <p className="text-sm text-muted-foreground leading-relaxed">{terapeuta.bio}</p>
            </div>
          )}

          {/* Convênios */}
          {(terapeuta.convenios?.length || 0) > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Atende convênios</p>
              <div className="flex flex-wrap gap-1.5">
                {terapeuta.convenios!.map((c) => (
                  <Badge key={c} variant="secondary" className="text-xs">
                    {c}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* CTA */}
          {solicitado ? (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Solicitação enviada!</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70">O profissional entrará em contato em breve.</p>
              </div>
            </div>
          ) : (
            <Button
              className="w-full h-11 rounded-xl font-bold"
              onClick={handleSolicitar}
            >
              <Send className="h-4 w-4 mr-2" />
              Solicitar atendimento
            </Button>
          )}
        </div>

        {/* Trust note */}
        <p className="text-center text-[11px] text-muted-foreground/60 flex items-center justify-center gap-1">
          <ShieldCheck className="h-3 w-3" />
          Seus dados são protegidos pela LGPD
        </p>
      </div>

      {/* Dialog: mensagem opcional */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Solicitar atendimento</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sua solicitação será enviada para <strong>{terapeuta.nome_exibicao}</strong>.
            Adicione uma mensagem opcional explicando sua necessidade.
          </p>
          <Textarea
            placeholder="Ex: Estou buscando acompanhamento para ansiedade..."
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={3}
            className="resize-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => mutSolicitar.mutate()} disabled={mutSolicitar.isPending}>
              {mutSolicitar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar solicitação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
