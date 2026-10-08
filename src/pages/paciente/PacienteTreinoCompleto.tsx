import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import PortalSkeleton from '@/components/paciente/PortalSkeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, FileDown, Loader2, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import TreinoDocumento from '@/components/paciente/TreinoDocumento';
import { origemDoPlanoLiberado, type OrigemPlano } from '@/lib/governanca';

interface PlanoLiberado {
  titulo?: string | null;
  conteudo: any;
  origem: OrigemPlano;
}

// Versão WEB do plano de treino — "imita o PDF", mas com os GIFs ANIMANDO de
// verdade (PDF não anima; página web sim). Layout limpo, pronto para imprimir.
// Tudo expandido, sem interações — é um documento vivo.
//
// Mostra só o que foi LIBERADO ao cliente (meu_plano_liberado): o plano do profissional
// ou o que a equipe científica MyHealthID chancelou. Somente leitura: alterar um plano
// já liberado ou chancelado é com o profissional / a equipe.
export default function PacienteTreinoCompleto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [terapeutaId, setTerapeutaId] = useState<string | null>(null);
  const [plano, setPlano] = useState<PlanoLiberado | null>(null);
  const [nutricao, setNutricao] = useState<any>(null);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const { data: pac } = await supabase.from('pacientes').select('id, nome, sobrenome, terapeuta_id').eq('user_id', user.id).maybeSingle();
        if (!pac) return;
        setNome(`${pac.nome || ''} ${pac.sobrenome || ''}`.trim());
        setTerapeutaId((pac as any).terapeuta_id ?? null);
        const [t, n] = await Promise.all([
          (supabase as any).rpc('meu_plano_liberado', { p_tipo: 'treino' }),
          (supabase as any).rpc('meu_plano_liberado', { p_tipo: 'nutricao' }),
        ]);
        if (t.error) throw t.error;
        setPlano(t.data ? { titulo: t.data.titulo, conteudo: t.data.conteudo, origem: origemDoPlanoLiberado(t.data) } : null);
        // Falha ao ler a nutrição não impede o treino de aparecer.
        setNutricao(n.error ? null : n.data?.conteudo ?? null);
      } catch (e) {
        console.error('[PacienteTreinoCompleto] carregar error:', e);
        toast.error('Não consegui carregar o seu treino agora. Tente de novo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const baixarPdf = async () => {
    if (!plano) return;
    setBaixando(true);
    try {
      const { gerarPDFPlanoTreino } = await import('@/utils/pdfPlanoTreino');
      const { downloadPDFBlob } = await import('@/utils/pdfMyIDPaciente');
      const { carregarBrandingClinica } = await import('@/utils/pdfBranding');
      // Branding vem do terapeuta do paciente (o usuário aqui é o paciente).
      const branding = await carregarBrandingClinica(terapeutaId);
      const blob = await gerarPDFPlanoTreino({
        pacienteNome: nome || 'Paciente', titulo: plano.titulo, ...branding,
        conteudo: plano.conteudo, nutricao, origemGov: plano.origem, aprovado: true,
      });
      downloadPDFBlob(blob, `Meu_Treino_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      console.error('[PacienteTreinoCompleto] baixarPdf error:', e);
      toast.error('Não consegui gerar o PDF agora. Tente de novo.');
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
          <PortalSkeleton />
        ) : !plano || fases.length === 0 ? (
          <div className="max-w-2xl mx-auto p-8 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Você ainda não tem um treino liberado.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Ele aparece aqui quando o seu profissional liberar ou quando a equipe científica MyHealthID chancelar o plano que você pediu.
            </p>
            <Button className="mt-4" onClick={() => navigate('/paciente/exercicios')}>Ver meu plano de tratamento</Button>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto my-4 print:my-0">
            <TreinoDocumento
              nome={nome}
              titulo={plano.titulo}
              conteudo={plano.conteudo}
              nutricao={nutricao}
              origemGov={plano.origem}
              aprovado
            />
          </div>
        )}
      </div>
    </ProtectedPatientRoute>
  );
}
