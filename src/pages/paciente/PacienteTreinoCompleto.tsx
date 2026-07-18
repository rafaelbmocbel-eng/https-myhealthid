import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, FileDown, Loader2, Dumbbell, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import TreinoDocumento from '@/components/paciente/TreinoDocumento';

// Versão WEB do plano de treino — "imita o PDF", mas com os GIFs ANIMANDO de
// verdade (PDF não anima; página web sim). Layout limpo, pronto para imprimir
// ou compartilhar. Tudo expandido, sem interações — é um documento vivo.
export default function PacienteTreinoCompleto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [plano, setPlano] = useState<{ titulo?: string; conteudo: any; share_token?: string | null } | null>(null);
  const [nutricao, setNutricao] = useState<any>(null);
  const [baixando, setBaixando] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pac } = await supabase.from('pacientes').select('id, nome, sobrenome').eq('user_id', user.id).maybeSingle();
      if (!pac) { setLoading(false); return; }
      setPacienteId(pac.id);
      setNome(`${pac.nome || ''} ${pac.sobrenome || ''}`.trim());
      const { data } = await (supabase as any).from('planos_ia_cliente')
        .select('tipo, titulo, conteudo, share_token').eq('paciente_id', pac.id);
      const rows = (data || []) as any[];
      setPlano(rows.find((r) => r.tipo === 'treino') || null);
      setNutricao(rows.find((r) => r.tipo === 'nutricao')?.conteudo || null);
      setLoading(false);
    })();
  }, [user]);

  const compartilhar = async () => {
    if (!plano || !pacienteId) return;
    setCompartilhando(true);
    try {
      let token = plano.share_token;
      if (!token) {
        token = crypto.randomUUID();
        const { error } = await (supabase as any).from('planos_ia_cliente')
          .update({ share_token: token }).eq('paciente_id', pacienteId).eq('tipo', 'treino');
        if (error) throw error;
        setPlano({ ...plano, share_token: token });
      }
      const url = `${window.location.origin}/treino/${token}`;
      const navAny = navigator as any;
      if (navAny.share) {
        try { await navAny.share({ title: 'Meu Treino — My Health ID', text: 'Meu treino personalizado (com os exercícios animados):', url }); }
        catch (e: any) { if (e?.name !== 'AbortError') { await navigator.clipboard.writeText(url); toast.success('Link copiado!'); } }
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copiado! Cole onde quiser compartilhar.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui gerar o link agora.');
    } finally {
      setCompartilhando(false);
    }
  };

  const baixarPdf = async () => {
    if (!plano) return;
    setBaixando(true);
    try {
      const { gerarPDFPlanoTreino } = await import('@/utils/pdfPlanoTreino');
      const { downloadPDFBlob } = await import('@/utils/pdfMyIDPaciente');
      const blob = await gerarPDFPlanoTreino({ pacienteNome: nome || 'Paciente', titulo: plano.titulo, conteudo: plano.conteudo, nutricao });
      downloadPDFBlob(blob, `Meu_Treino_${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally { setBaixando(false); }
  };

  const fases: any[] = Array.isArray(plano?.conteudo?.fases) ? plano!.conteudo.fases : [];

  return (
    <ProtectedPatientRoute>
      <div className="min-h-[100dvh] bg-muted/30">
        {/* Barra de ações — some na impressão */}
        <div className="print:hidden sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border/50">
          <div className="max-w-2xl mx-auto px-3 py-2.5 flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" className="gap-1.5" disabled={compartilhando || !plano} onClick={compartilhar}>
                {compartilhando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} Compartilhar
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Imprimir
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" disabled={baixando || !plano} onClick={baixarPdf}>
                {baixando ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />} PDF
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !plano || fases.length === 0 ? (
          <div className="max-w-2xl mx-auto p-8 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Você ainda não tem um treino gerado.</p>
            <Button className="mt-4" onClick={() => navigate('/paciente/questionarios?foco=plano')}>Montar meu treino</Button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto my-4 print:my-0">
            <TreinoDocumento nome={nome} titulo={plano.titulo} conteudo={plano.conteudo} nutricao={nutricao} />
          </div>
        )}
      </div>
    </ProtectedPatientRoute>
  );
}
