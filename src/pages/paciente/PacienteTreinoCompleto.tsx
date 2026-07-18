import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, FileDown, Loader2, Dumbbell } from 'lucide-react';

// Versão WEB do plano de treino — "imita o PDF", mas com os GIFs ANIMANDO de
// verdade (PDF não anima; página web sim). Layout limpo, pronto para imprimir
// ou compartilhar. Tudo expandido, sem interações — é um documento vivo.
export default function PacienteTreinoCompleto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [nome, setNome] = useState('');
  const [plano, setPlano] = useState<{ titulo?: string; conteudo: any } | null>(null);
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: pac } = await supabase.from('pacientes').select('id, nome, sobrenome').eq('user_id', user.id).maybeSingle();
      if (!pac) { setLoading(false); return; }
      setNome(`${pac.nome || ''} ${pac.sobrenome || ''}`.trim());
      const { data } = await (supabase as any).from('planos_ia_cliente')
        .select('titulo, conteudo').eq('paciente_id', pac.id).eq('tipo', 'treino').maybeSingle();
      setPlano(data || null);
      setLoading(false);
    })();
  }, [user]);

  const baixarPdf = async () => {
    if (!plano) return;
    setBaixando(true);
    try {
      const { gerarPDFPlanoTreino } = await import('@/utils/pdfPlanoTreino');
      const { downloadPDFBlob } = await import('@/utils/pdfMyIDPaciente');
      const blob = await gerarPDFPlanoTreino({ pacienteNome: nome || 'Paciente', titulo: plano.titulo, conteudo: plano.conteudo });
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
          <div className="max-w-2xl mx-auto bg-white text-[#212529] my-4 rounded-xl overflow-hidden shadow-sm print:my-0 print:shadow-none print:rounded-none">
            {/* Cabeçalho estilo documento */}
            <div className="bg-[#1e2952] text-white px-6 py-5">
              <h1 className="text-xl font-black">Meu Plano de Treino</h1>
              <p className="text-[13px] text-blue-100/90 mt-0.5">{nome} · {new Date().toLocaleDateString('pt-BR')}</p>
            </div>

            <div className="px-5 sm:px-6 py-5 space-y-5">
              {plano.titulo && <h2 className="text-lg font-bold text-[#1e2952]">{plano.titulo}</h2>}
              {plano.conteudo?.resumo && <p className="text-sm text-[#6e7482] -mt-3">{plano.conteudo.resumo}</p>}

              {fases.map((f, fi) => (
                <section key={fi} className="space-y-3">
                  <div className="rounded-lg bg-[#2563eb] text-white px-3 py-2 flex items-center justify-between">
                    <span className="text-sm font-bold">{f.nome || `Fase ${fi + 1}`}</span>
                    {f.semanas && <span className="text-xs text-blue-100">{f.semanas} semanas</span>}
                  </div>
                  {f.objetivo && <p className="text-xs text-[#6e7482]">{f.objetivo}</p>}

                  {(Array.isArray(f.sessoes) ? f.sessoes : []).map((s: any, si: number) => (
                    <div key={si} className="space-y-2">
                      <h3 className="text-sm font-bold text-[#1e2952] pt-1">
                        {s.nome || `Treino ${si + 1}`}{s.duracao_min ? ` · ~${s.duracao_min} min` : ''}
                      </h3>
                      {s.aquecimento && <p className="text-xs text-[#6e7482]"><strong>Aquecimento:</strong> {s.aquecimento}</p>}

                      <div className="space-y-2">
                        {(Array.isArray(s.exercicios) ? s.exercicios : []).map((ex: any, ei: number) => (
                          <div key={ei} className="flex gap-3 rounded-lg border border-[#e1e4eb] p-2.5 break-inside-avoid">
                            {ex.gif_url ? (
                              // GIF ANIMANDO — o que o PDF não consegue fazer
                              <img src={ex.gif_url} alt={ex.nome} className="h-24 w-24 rounded-lg object-cover border border-[#e1e4eb] shrink-0 bg-white" loading="lazy" />
                            ) : (
                              <div className="h-24 w-24 rounded-lg bg-[#eef1f8] flex items-center justify-center shrink-0 text-sm font-bold text-[#2563eb]">{ei + 1}</div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-[#212529]">{ex.nome || 'Exercício'}</p>
                              <p className="text-[13px] font-bold text-[#2563eb] mt-0.5">
                                {[ex.series && ex.reps ? `${ex.series}×${ex.reps}` : ex.series, ex.carga, ex.descanso_s && `${ex.descanso_s}s descanso`].filter(Boolean).join('  ·  ')}
                              </p>
                              {(ex.orientacoes || ex.obs) && (
                                <p className="text-xs text-[#6e7482] mt-1 leading-relaxed">
                                  {ex.orientacoes && <><strong className="text-[#212529]">Execução:</strong> {ex.orientacoes} </>}
                                  {ex.obs}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {s.desaquecimento && <p className="text-xs text-[#6e7482]"><strong>Desaquecimento:</strong> {s.desaquecimento}</p>}
                    </div>
                  ))}
                </section>
              ))}

              {plano.conteudo?.observacoes_gerais && (
                <div className="border-t border-[#e1e4eb] pt-3">
                  <h3 className="text-sm font-bold text-[#1e2952] mb-1">Observações</h3>
                  <p className="text-xs text-[#6e7482]">{plano.conteudo.observacoes_gerais}</p>
                </div>
              )}

              <p className="text-[11px] text-[#9ca3af] border-t border-[#e1e4eb] pt-3">
                My Health ID · Plano de treino gerado por IA — apoio, não substitui avaliação profissional.
              </p>
            </div>
          </div>
        )}
      </div>
    </ProtectedPatientRoute>
  );
}
