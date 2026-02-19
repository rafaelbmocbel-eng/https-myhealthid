import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, XCircle, CalendarDays } from 'lucide-react';
import logoMetodo from '@/assets/logo-metodo-identidade.jpg';

export default function AgendaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [valido, setValido] = useState(false);

  useEffect(() => {
    if (!token) { setErro('Link inválido.'); setLoading(false); return; }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('links_agenda_paciente')
          .select('id, status, data_expiracao')
          .eq('token', token)
          .maybeSingle();

        if (error || !data) { setErro('Link não encontrado.'); setLoading(false); return; }
        if (data.status !== 'ativo') { setErro('Este link foi cancelado.'); setLoading(false); return; }
        if (new Date(data.data_expiracao!) < new Date()) { setErro('Este link expirou.'); setLoading(false); return; }

        setValido(true);
      } catch {
        setErro('Erro ao validar o link. Tente novamente.');
      }
      setLoading(false);
    })();
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (erro) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
      <XCircle className="h-16 w-16 text-destructive" />
      <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
      <p className="text-muted-foreground text-center max-w-sm">{erro}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <img src={logoMetodo} alt="Logo" className="h-10 w-10 rounded-xl object-cover shrink-0" />
          <div>
            <h1 className="font-bold text-sm text-foreground">Agenda — Método Identidade</h1>
            <p className="text-xs text-muted-foreground">Agende sua sessão de fisioterapia</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <CalendarDays className="h-16 w-16 text-amber-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">Agendamento Online</h2>
        <p className="text-muted-foreground">
          Em breve você poderá agendar sua sessão diretamente por aqui.<br />
          Por enquanto, entre em contato com seu terapeuta para marcar um horário.
        </p>
      </div>
    </div>
  );
}
