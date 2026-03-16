import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AvaliacaoMyID } from '@/types/myid';
import { getMyIDFingerprintData, getMyIDSeverityColor, getMyIDInterpretation } from '@/utils/myidCalculations';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Loader2, Download, Share2, ClipboardList, Activity, Brain, Bed, Dumbbell, ShieldAlert, BadgeInfo, Sparkles, FileText } from 'lucide-react';
import { useAvaliacoesIdentidade } from '@/hooks/useAvaliacoesSalvas';
import { toast } from '@/hooks/use-toast';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import { useAuth } from '@/contexts/AuthContext';
import { gerarPDFRespostaCompleta } from '@/utils/pdfRespostaCompleta';

interface Props {
  avaliacao: AvaliacaoMyID;
  pacienteId?: string;
  onBack: () => void;
}

function ScoreCard({ icon: Icon, label, value, color, description }: {
  icon?: any; label: string; value: string | number; color?: string; description?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-10">
        {Icon && <Icon className="h-16 w-16" style={{ color }} />}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          {Icon && <Icon className="h-4 w-4" style={{ color }} />}
          {label}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-black" style={{ color }}>{value}</span>
      </div>
      {description && <div className="text-xs text-muted-foreground">{description}</div>}
    </div>
  );
}

export default function RelatorioIdentidade({ avaliacao, pacienteId, onBack }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { salvar, salvando } = useAvaliacoesIdentidade();
  const [salvo, setSalvo] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const handleSalvar = async () => {
    if (!pacienteId) return;
    await salvar({ avaliacao, pacienteId });
    setSalvo(true);
  };

  const handleRespostaCompleta = async () => {
    if (!pacienteId) return;
    setGerandoPDF(true);
    try {
      const profileName = user?.email?.split('@')[0] || 'Terapeuta';
      await gerarPDFRespostaCompleta({
        avaliacao,
        pacienteId,
        terapeutaNome: profileName,
      });
      toast({ title: '📄 PDF Gerado!', description: 'Resposta Completa baixada com sucesso.' });
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast({ title: 'Erro', description: 'Não foi possível gerar o PDF.', variant: 'destructive' });
    } finally {
      setGerandoPDF(false);
    }
  };

  const resultado = avaliacao.resultado || {};
  const hasRedFlags = resultado?.redFlagsDetected || false;
  const dimScores = {
    D: resultado?.componentScores?.D ?? 0,
    EFI: resultado?.componentScores?.EFI ?? 0,
    P: resultado?.componentScores?.P ?? 0,
    I: resultado?.componentScores?.I ?? 0,
    N: resultado?.componentScores?.N ?? 0,
  };
  const interp = getMyIDInterpretation(resultado?.myidScore ?? 0, hasRedFlags, dimScores);
  const myidStatus = interp.label;
  const classificacao = interp.status;
  const fpData = getMyIDFingerprintData(resultado?.componentScores || {});

  return (
    <div className="container py-8 max-w-5xl space-y-6">
      {/* ── Header / Breadcrumb ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span>Avaliação Completa</span>
          <span>›</span>
          <span className="font-semibold text-foreground">Resultado MyID</span>
        </div>
        <div className="flex gap-2">
          {pacienteId && (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSalvar} disabled={salvando || salvo}>
              {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {salvo ? 'Salvo ✓' : 'Salvar no Prontuário'}
            </Button>
          )}
          {pacienteId && (
            <Button className="bg-gradient-primary text-white gap-1.5" size="sm" onClick={() => navigate(`/pacientes/${pacienteId}?tab=protocolos`)}>
              <Sparkles className="h-3.5 w-3.5" />
              Gerar Diretriz
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
            toast({ title: 'PDF do Relatório', description: 'Função de PDF está em adaptação para o novo MyID.' });
          }}>
            <Download className="h-3.5 w-3.5" />
            PDF (Breve)
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT: Gauge + Fingerprint */}
        <div className="lg:col-span-5 space-y-4">
          <div className="clinical-card border-none bg-gradient-to-br from-card to-primary/5 shadow-sm">
            <div className="flex flex-col items-center py-6 text-center">
              <h2 className="text-xl font-bold mb-4">Índice MyID Final</h2>

              <div className={`px-8 py-6 rounded-2xl border-2 shadow-sm mb-6 ${getMyIDSeverityColor(classificacao)}`}>
                <div className="text-5xl font-black">{resultado.myidScore.toFixed(1)}</div>
                <div className="text-base font-bold mt-2">{myidStatus}</div>
                <div className="text-xs uppercase tracking-widest mt-1 opacity-80">{classificacao}</div>
              </div>

              <div className="w-full max-w-sm mx-auto">
                <MyIDFingerprint rings={fpData} myidScore={resultado.myidScore} />
              </div>

              <p className="text-xs text-muted-foreground mt-4 px-4">
                A balança entre sua <strong>Demanda Sistêmica</strong> (cores quentes) e sua <strong>Capacidade de Regulação</strong> (cores frias).
              </p>
              <div className="mt-4 mx-4 p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <strong>Nota clínica:</strong> O índice MyID é uma ferramenta de <strong>suporte ao raciocínio clínico</strong>. 
                  Os resultados devem ser interpretados pelo profissional de saúde no contexto da avaliação presencial, 
                  não constituindo diagnóstico isolado.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Componentes Discriminados */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
            <BadgeInfo className="h-5 w-5 text-primary" />
            Componentes da Equação MyID
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ScoreCard
              icon={Activity} label="D: Nível de Dor" value={resultado.componentScores.D.toFixed(1)} color="#FF6B6B"
              description="A dor experiencial atual e máxima relatada."
            />
            <ScoreCard
              icon={Dumbbell} label="EFI: Funcionalidade" value={resultado.componentScores.EFI.toFixed(1)} color="#FFA500"
              description="Capacidade para o trabalho, tarefas domésticas, etc."
            />
            <ScoreCard
              icon={Brain} label="P: Modulador P" value={resultado.componentScores.P.toFixed(1)} color="#FFB84D"
              description="Comportamento da dor, crenças, autoeficácia e medo."
            />
            <ScoreCard
              icon={ClipboardList} label="I: Inércia / Gatilho" value={resultado.componentScores.I.toFixed(1)} color="#FF8C42"
              description="Fatores desencadeantes, novos equipamentos ou mudança brutal na rotina."
            />
            <ScoreCard
              icon={Bed} label="R: Regulação" value={resultado.componentScores.R.toFixed(1)} color="#87CEEB"
              description="Sono, fadiga, energia, estado psicológico base e estresse."
            />
            <ScoreCard
              icon={ShieldAlert} label="C: Contexto" value={resultado.componentScores.C.toFixed(1)} color="#50C878"
              description="Avaliação do ambiente externo."
            />
            <div className="sm:col-span-2">
              <ScoreCard
                icon={Activity} label="N: Ruído Sistêmico" value={resultado.componentScores.N.toFixed(1)} color="#4A90E2"
                description="Presença de outros problemas sistêmicos que 'roubam' suporte de outras partes."
              />
            </div>
          </div>

          {resultado.redFlagsDetected && (
            <div className="mt-6 p-4 rounded-xl border-2 border-red-300 bg-red-50">
              <h4 className="font-bold text-red-800 flex items-center gap-2 mb-2">
                <ShieldAlert className="h-5 w-5" />
                Red Flags Detectadas
              </h4>
              <ul className="list-disc pl-5 text-sm text-red-700 space-y-1">
                {resultado.redFlagAlerts.map((alerta, idx) => (
                  <li key={idx}>{alerta}</li>
                ))}
              </ul>
              <p className="text-xs text-red-600 mt-3 font-medium">Recomendação: Avaliação médica mandatória.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
