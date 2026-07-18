import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import TreinoDocumento from '@/components/paciente/TreinoDocumento';
import { Loader2, Dumbbell } from 'lucide-react';

// Página PÚBLICA do treino (sem login) — aberta por token. O cliente
// compartilha o link e qualquer pessoa vê o treino com os GIFs animando.
// Leitura via RPC SECURITY DEFINER get_treino_por_token (só o necessário).
export default function TreinoPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [dados, setDados] = useState<{ paciente_nome: string; titulo: string | null; conteudo: any; nutricao?: any } | null>(null);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      const { data } = await (supabase as any).rpc('get_treino_por_token', { p_token: token });
      const row = Array.isArray(data) ? data[0] : data;
      setDados(row || null);
      setLoading(false);
    })();
  }, [token]);

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      {/* Barra pública com a marca */}
      <div className="bg-[#1e2952] text-white print:hidden">
        <div className="max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-2">
          <Dumbbell className="h-4 w-4" />
          <span className="text-sm font-bold">My Health ID</span>
          <span className="ml-auto text-[11px] text-blue-100/80">Treino personalizado</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !dados ? (
        <div className="max-w-2xl mx-auto p-8 text-center">
          <Dumbbell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Este link de treino não está mais disponível.</p>
        </div>
      ) : (
        <>
          <div className="max-w-2xl mx-auto my-4 print:my-0">
            <TreinoDocumento nome={dados.paciente_nome} titulo={dados.titulo} conteudo={dados.conteudo} nutricao={dados.nutricao} />
          </div>
          {/* CTA — quem recebeu o link conhece a plataforma */}
          <div className="max-w-2xl mx-auto px-4 pb-8 print:hidden">
            <a href="/" className="block rounded-xl bg-[#1e2952] text-white text-center px-4 py-3 text-sm font-semibold hover:bg-[#26315f] transition-colors">
              Quer um treino individual assim, feito da sua avaliação? Conheça o My Health ID →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
