import { useState, useMemo, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Share2, FileDown, Sparkles, Plus, X, Eye, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import PropostaDocumento, { type PropostaDocumentoData } from './PropostaDocumento';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  protocolo: any;
  pacienteId: string;
  pacienteNome: string;
}

interface TecnicaEd {
  tecnica: string;
  justificativa?: string;
  lente_clinica?: string;
  nivel_evidencia?: string | number;
}

interface FaseEd {
  numero: number;
  titulo: string;
  objetivo: string;
  semanas: string;
  focos: string[];
  tecnicas: TecnicaEd[];
}


function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
}

const FASE_COLORS = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500'];
const FASE_BORDER = ['border-l-rose-500', 'border-l-amber-500', 'border-l-emerald-500'];

export default function PropostaTratamentoDialog({ open, onOpenChange, protocolo, pacienteId, pacienteNome }: Props) {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'editar' | 'preview'>('editar');

  // ---- pacote / CTA ----
  const [numeroSessoes, setNumeroSessoes] = useState<number>(12);
  const [frequencia, setFrequencia] = useState<string>('2x por semana');
  const [duracao, setDuracao] = useState<string>(protocolo?.duracao_total || '12 semanas');
  const [valorSessao, setValorSessao] = useState<number>(150);
  const [desconto, setDesconto] = useState<number>(0);
  const [formaPagamento, setFormaPagamento] = useState<string>('PIX, cartão em até 6x sem juros');
  const [telefone, setTelefone] = useState<string>((profile as any)?.telefone || '');
  const [mensagem, setMensagem] = useState<string>(
    `Olá ${pacienteNome.split(' ')[0]}! Preparei seu plano de tratamento personalizado com base na sua avaliação. Vamos começar?`
  );
  const [validadeDias, setValidadeDias] = useState<number>(7);

  // ---- conteúdo clínico editável ----
  const initialQueixa = protocolo?.scores_avaliacao?.queixa_principal || protocolo?.titulo?.replace(/^Diretriz\s*[—-]\s*/i, '') || '';
  const initialClass = protocolo?.scores_avaliacao?.classificacao || '';
  const initialResumo = protocolo?.descricao || '';
  const initialPrognostico = protocolo?.scores_avaliacao?.prognostico || '';

  const [queixa, setQueixa] = useState<string>(initialQueixa);
  const [classificacao, setClassificacao] = useState<string>(initialClass);
  const [resumoClinico, setResumoClinico] = useState<string>(initialResumo);
  const [prognostico, setPrognostico] = useState<string>(initialPrognostico);

  const initialFases: FaseEd[] = useMemo(() => {
    const snap = protocolo?.scores_avaliacao?.diretriz_snapshot;
    const arr = Array.isArray(snap?.fases) ? snap.fases : [];
    if (arr.length === 0) {
      return [
        { numero: 1, titulo: 'Alívio & Proteção', objetivo: 'Reduzir dor e estabilizar', semanas: '1-2', focos: ['Controle de sintomas', 'Educação em dor'], tecnicas: [] },
        { numero: 2, titulo: 'Carga Progressiva', objetivo: 'Reganhar força e mobilidade', semanas: '3-6', focos: ['Exercícios progressivos'], tecnicas: [] },
        { numero: 3, titulo: 'Retorno Funcional', objetivo: 'Voltar às atividades', semanas: '7-12', focos: ['Atividades específicas'], tecnicas: [] },
      ];
    }
    return arr.slice(0, 3).map((f: any, i: number) => {
      const objetivos = Array.isArray(f.objetivos) ? f.objetivos : [];
      const demandas = Array.isArray(f.demandasAlvo) ? f.demandasAlvo : (Array.isArray(f.demandas_alvo) ? f.demandas_alvo : []);
      const criterios = Array.isArray(f.criteriosProgressao) ? f.criteriosProgressao : (Array.isArray(f.criterios_progressao) ? f.criterios_progressao : []);
      const focos = [...objetivos, ...demandas, ...criterios].filter(Boolean).slice(0, 6);
      const tecnicasRaw = Array.isArray(f.tecnicas) ? f.tecnicas : [];
      const tecnicas: TecnicaEd[] = tecnicasRaw.map((t: any) => ({
        tecnica: t?.tecnica || t?.nome || '',
        justificativa: t?.justificativa || t?.descricao || '',
        lente_clinica: t?.lente_clinica || t?.lente || '',
        nivel_evidencia: t?.nivel_evidencia ?? t?.evidencia ?? '',
      })).filter((t: TecnicaEd) => t.tecnica);
      return {
        numero: f.numero ?? i + 1,
        titulo: f.titulo || `Fase ${i + 1}`,
        objetivo: f.objetivo || (objetivos[0] || ''),
        semanas: f.semanas_inicio && f.semanas_fim ? `${f.semanas_inicio}-${f.semanas_fim}` : (f.semanas || ''),
        focos,
        tecnicas,
      };
    });
  }, [protocolo]);


  const [fases, setFases] = useState<FaseEd[]>(initialFases);
  useEffect(() => setFases(initialFases), [initialFases]);

  // ---- plano de manutenção editável ----
  const initialManut = useMemo(() => {
    const m = protocolo?.scores_avaliacao?.diretriz_snapshot?.manutencao;
    return {
      mensagemPaciente: m?.mensagem_paciente || m?.mensagemPaciente || '',
      rotinaMinima: Array.isArray(m?.rotina_minima) ? m.rotina_minima : (Array.isArray(m?.rotinaMinima) ? m.rotinaMinima : []),
      frequenciaReavaliacao: m?.frequencia_reavaliacao || m?.frequenciaReavaliacao || '',
      sinaisParaRetornar: Array.isArray(m?.sinais_para_retornar) ? m.sinais_para_retornar : (Array.isArray(m?.sinaisParaRetornar) ? m.sinaisParaRetornar : []),
      habitosChave: Array.isArray(m?.habitos_chave) ? m.habitos_chave : (Array.isArray(m?.habitosChave) ? m.habitosChave : []),
    };
  }, [protocolo]);

  const [manut, setManut] = useState(initialManut);
  useEffect(() => setManut(initialManut), [initialManut]);

  const total = useMemo(() => {
    const bruto = numeroSessoes * valorSessao;
    return bruto * (1 - (desconto || 0) / 100);
  }, [numeroSessoes, valorSessao, desconto]);

  const profissionalNome = profile ? [profile.nome, (profile as any).sobrenome].filter(Boolean).join(' ') : undefined;

  // ---- branding da clínica (logo já em data URL, sem CORS, pro html2canvas) ----
  const [clinicaNome, setClinicaNome] = useState<string | undefined>(undefined);
  // Guarda a logo COM dimensões — usadas pra sobrepor a logo nítida no PDF.
  const [clinicaLogo, setClinicaLogo] = useState<{ dataUrl: string; w: number; h: number } | undefined>(undefined);
  const clinicaLogoDataUrl = clinicaLogo?.dataUrl;
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let vivo = true;
    (async () => {
      const { carregarBrandingClinica } = await import('@/utils/pdfBranding');
      const b = await carregarBrandingClinica(user?.id);
      if (!vivo) return;
      setClinicaNome(b.clinicaNome || (profile as any)?.nome_clinica || undefined);
      if (b.clinicaLogoUrl) {
        const { loadImageForPDF } = await import('@/utils/pdfFingerprintWatermark');
        const img = await loadImageForPDF(b.clinicaLogoUrl);
        if (vivo && img) setClinicaLogo(img);
      }
    })();
    return () => { vivo = false; };
  }, [open, user?.id, profile]);

  // Props únicas do documento — mesmas na pré-visualização e no PDF.
  const docProps: PropostaDocumentoData = {
    pacienteNome,
    profissionalNome,
    clinicaNome,
    clinicaLogoDataUrl,
    queixa: queixa.trim() || undefined,
    classificacao: classificacao.trim() || undefined,
    resumoClinico: resumoClinico.trim() || undefined,
    prognostico: prognostico.trim() || undefined,
    fases: fases.map(f => ({ numero: f.numero, titulo: f.titulo, semanas: f.semanas, objetivo: f.objetivo, focos: f.focos })),
    manut,
    numeroSessoes, duracao, frequencia, valorSessao, desconto, formaPagamento, total,
    mensagem, telefone: telefone || undefined, validadeDias,
  };

  // ---- helpers fases ----
  const updFase = (i: number, patch: Partial<FaseEd>) => {
    setFases(prev => prev.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  };
  const updFoco = (faseIdx: number, focoIdx: number, val: string) => {
    setFases(prev => prev.map((f, idx) => idx === faseIdx
      ? { ...f, focos: f.focos.map((x, j) => j === focoIdx ? val : x) } : f));
  };
  const addFoco = (faseIdx: number) => {
    setFases(prev => prev.map((f, idx) => idx === faseIdx ? { ...f, focos: [...f.focos, ''] } : f));
  };
  const rmFoco = (faseIdx: number, focoIdx: number) => {
    setFases(prev => prev.map((f, idx) => idx === faseIdx
      ? { ...f, focos: f.focos.filter((_, j) => j !== focoIdx) } : f));
  };

  // ---- helpers manutenção ----
  const updManutList = (key: 'rotinaMinima' | 'sinaisParaRetornar' | 'habitosChave', i: number, val: string) => {
    setManut(prev => ({ ...prev, [key]: prev[key].map((x: string, j: number) => j === i ? val : x) }));
  };
  const addManutItem = (key: 'rotinaMinima' | 'sinaisParaRetornar' | 'habitosChave') => {
    setManut(prev => ({ ...prev, [key]: [...prev[key], ''] }));
  };
  const rmManutItem = (key: 'rotinaMinima' | 'sinaisParaRetornar' | 'habitosChave', i: number) => {
    setManut(prev => ({ ...prev, [key]: prev[key].filter((_: string, j: number) => j !== i) }));
  };

  const handleGerar = async (modo: 'share' | 'download') => {
    setLoading(true);
    try {
      // O PDF é o MESMO documento da pré-visualização (PropostaDocumento),
      // capturado do HTML off-screen e paginado sem cortar cards.
      if (!printRef.current) throw new Error('Documento não pronto. Tente novamente.');
      // dá um tempo pro layout/imagem da logo assentarem antes de capturar
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(null))));
      const { gerarPropostaPdfDeHtml } = await import('@/utils/pdfPropostaHtml');
      const blob = await gerarPropostaPdfDeHtml(printRef.current, { logo: clinicaLogo });

      const downloadPDFBlob = (b: Blob, name: string) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };

      const filename = `Proposta_${pacienteNome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      const file = new File([blob], filename, { type: 'application/pdf' });
      const navAny = navigator as any;

      if (modo === 'share' && navAny.canShare && navAny.canShare({ files: [file] })) {
        try {
          await navAny.share({ files: [file], title: 'Proposta de Tratamento', text: mensagem });
        } catch (err: any) {
          if (err?.name !== 'AbortError') downloadPDFBlob(blob, filename);
        }
      } else {
        downloadPDFBlob(blob, filename);
        if (modo === 'share') {
          toast({ title: 'PDF baixado', description: 'Envie pelo WhatsApp ou e-mail.' });
        }
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error('[PropostaTratamentoDialog]', err);
      toast({ title: 'Erro ao gerar proposta', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90dvh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 pb-3 border-b border-border/40 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">Proposta de Tratamento</DialogTitle>
              <DialogDescription className="text-xs">
                Edite cada bloco e veja a prévia do PDF antes de enviar.
              </DialogDescription>
            </div>
          </div>

          {/* Tabs Editar / Preview */}
          <div className="flex gap-1 mt-3 p-1 bg-muted/50 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('editar')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                tab === 'editar' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Pencil className="h-3 w-3" /> Editar
            </button>
            <button
              type="button"
              onClick={() => setTab('preview')}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                tab === 'preview' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="h-3 w-3" /> Pré-visualizar
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4">
          {tab === 'editar' ? (
            <div className="space-y-5">
              {/* Diagnóstico */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">1. Diagnóstico clínico</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Queixa principal</Label>
                    <Input value={queixa} onChange={(e) => setQueixa(e.target.value)} placeholder="Ex: Dor lombar crônica" />
                  </div>
                  <div>
                    <Label className="text-[11px]">Classificação</Label>
                    <Input value={classificacao} onChange={(e) => setClassificacao(e.target.value)} placeholder="Ex: Moderada" />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px]">Resumo clínico</Label>
                  <Textarea rows={3} value={resumoClinico} onChange={(e) => setResumoClinico(e.target.value)} placeholder="Descrição do quadro do paciente em linguagem acessível." />
                </div>
                <div>
                  <Label className="text-[11px]">Prognóstico</Label>
                  <Textarea rows={2} value={prognostico} onChange={(e) => setPrognostico(e.target.value)} placeholder="Expectativa de evolução com o tratamento." />
                </div>
              </section>

              {/* Fases */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">2. Plano em 3 fases</h3>
                {fases.map((f, i) => (
                  <div key={i} className={cn('rounded-lg border bg-card p-3 border-l-4', FASE_BORDER[i] || 'border-l-primary')}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={cn('h-6 w-6 rounded-full text-white flex items-center justify-center text-xs font-bold shrink-0', FASE_COLORS[i] || 'bg-primary')}>
                        {f.numero}
                      </div>
                      <Input className="h-8 text-sm font-semibold" value={f.titulo} onChange={(e) => updFase(i, { titulo: e.target.value })} placeholder="Título da fase" />
                      <Input className="h-8 w-20 text-xs" value={f.semanas} onChange={(e) => updFase(i, { semanas: e.target.value })} placeholder="1-2" />
                    </div>
                    <Textarea rows={2} className="text-xs mb-2" value={f.objetivo} onChange={(e) => updFase(i, { objetivo: e.target.value })} placeholder="Objetivo desta fase" />
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Focos</Label>
                      {f.focos.map((foco, j) => (
                        <div key={j} className="flex items-center gap-1">
                          <Input className="h-7 text-xs" value={foco} onChange={(e) => updFoco(i, j, e.target.value)} placeholder="Foco / técnica" />
                          <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => rmFoco(i, j)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] gap-1 text-muted-foreground" onClick={() => addFoco(i)}>
                        <Plus className="h-3 w-3" /> Adicionar foco
                      </Button>
                    </div>
                    {f.tecnicas && f.tecnicas.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-border/40">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          Técnicas da diretriz ({f.tecnicas.length}) — incluídas no PDF
                        </Label>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {f.tecnicas.map((t, k) => (
                            <span key={k} className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-foreground border border-border/40">
                              {t.tecnica}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ))}
              </section>

              {/* Manutenção */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">3. Plano de manutenção (pós-alta)</h3>
                <div className="rounded-lg border border-l-4 border-l-emerald-500 bg-emerald-50/30 dark:bg-emerald-900/10 p-3 space-y-3">
                  <div>
                    <Label className="text-[11px]">Mensagem ao paciente</Label>
                    <Textarea rows={2} value={manut.mensagemPaciente} onChange={(e) => setManut(prev => ({ ...prev, mensagemPaciente: e.target.value }))} placeholder='Ex: "Continue cuidando do seu corpo após a alta"' />
                  </div>
                  <div>
                    <Label className="text-[11px]">Frequência de reavaliação</Label>
                    <Input value={manut.frequenciaReavaliacao} onChange={(e) => setManut(prev => ({ ...prev, frequenciaReavaliacao: e.target.value }))} placeholder="Ex: A cada 3 meses" />
                  </div>

                  {(['rotinaMinima', 'habitosChave', 'sinaisParaRetornar'] as const).map((k) => {
                    const labels: Record<typeof k, string> = {
                      rotinaMinima: 'Rotina mínima',
                      habitosChave: 'Hábitos-chave',
                      sinaisParaRetornar: 'Voltar ao profissional se',
                    } as any;
                    return (
                      <div key={k} className="space-y-1">
                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">{labels[k]}</Label>
                        {(manut[k] as string[]).map((item: string, i: number) => (
                          <div key={i} className="flex items-center gap-1">
                            <Input className="h-7 text-xs" value={item} onChange={(e) => updManutList(k, i, e.target.value)} />
                            <Button type="button" size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => rmManutItem(k, i)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] gap-1 text-muted-foreground" onClick={() => addManutItem(k)}>
                          <Plus className="h-3 w-3" /> Adicionar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Investimento */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">4. Investimento</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Nº de sessões</Label>
                    <Input type="number" inputMode="numeric" min={1} value={numeroSessoes || ''} onChange={(e) => setNumeroSessoes(e.target.value === '' ? 0 : Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Frequência</Label>
                    <Input value={frequencia} onChange={(e) => setFrequencia(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Duração</Label>
                    <Input value={duracao} onChange={(e) => setDuracao(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Valor por sessão (R$)</Label>
                    <Input type="number" inputMode="decimal" min={0} step="0.01" value={valorSessao || ''} onChange={(e) => setValorSessao(e.target.value === '' ? 0 : Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Desconto (%)</Label>
                    <Input type="number" inputMode="decimal" min={0} max={90} value={desconto || ''} onChange={(e) => setDesconto(e.target.value === '' ? 0 : Number(e.target.value))} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Validade (dias)</Label>
                    <Input type="number" inputMode="numeric" min={1} value={validadeDias || ''} onChange={(e) => setValidadeDias(e.target.value === '' ? 0 : Number(e.target.value))} />
                  </div>
                </div>
                <div>
                  <Label className="text-[11px]">Forma de pagamento</Label>
                  <Input value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)} />
                </div>
              </section>

              {/* CTA */}
              <section className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">5. Chamada para ação</h3>
                <div>
                  <Label className="text-[11px]">WhatsApp para contato</Label>
                  <Input placeholder="(11) 9 9999-9999" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
                </div>
                <div>
                  <Label className="text-[11px]">Mensagem na proposta</Label>
                  <Textarea rows={3} value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
                </div>
              </section>
            </div>
          ) : (
            /* ============ PREVIEW (mesmo componente do PDF) ============ */
            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 sm:p-6">
              <div className="mx-auto bg-white text-slate-900 shadow-lg rounded-md overflow-hidden" style={{ maxWidth: 560 }}>
                <PropostaDocumento {...docProps} />
              </div>
            </div>
          )}
        </div>

        {/* Footer fixo com totais + ações */}
        <div className="border-t border-border/40 p-3 shrink-0 bg-background">
          <div className="flex items-center justify-between mb-2 px-1">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
              <p className="text-base font-bold">{brl(total)}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Por sessão</p>
              <p className="text-sm font-semibold">{brl(total / Math.max(1, numeroSessoes))}</p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => handleGerar('download')} disabled={loading} className="flex-1">
              {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <FileDown className="h-4 w-4 shrink-0" />}
              Baixar PDF
            </Button>
            <Button onClick={() => handleGerar('share')} disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
              {loading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Share2 className="h-4 w-4 shrink-0" />}
              Enviar WhatsApp
            </Button>
          </DialogFooter>
        </div>

        {/* Documento off-screen para captura em PDF (largura fixa ~ A4).
            Sempre montado enquanto o dialog está aberto, independente da aba. */}
        {/* Largura maior (780px) = fonte efetiva menor no A4 = layout mais compacto. */}
        <div aria-hidden style={{ position: 'fixed', left: -99999, top: 0, width: 780, background: '#fff', pointerEvents: 'none' }}>
          <div ref={printRef} style={{ width: 780, background: '#fff' }}>
            <PropostaDocumento {...docProps} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
