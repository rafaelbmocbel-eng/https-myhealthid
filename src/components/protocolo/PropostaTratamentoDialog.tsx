import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Share2, FileDown, Sparkles, Plus, X, Eye, Pencil } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  protocolo: any;
  pacienteId: string;
  pacienteNome: string;
}

interface FaseEd {
  numero: number;
  titulo: string;
  objetivo: string;
  semanas: string;
  focos: string[];
}

function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
}

const FASE_COLORS = ['bg-rose-500', 'bg-amber-500', 'bg-emerald-500'];
const FASE_BORDER = ['border-l-rose-500', 'border-l-amber-500', 'border-l-emerald-500'];

export default function PropostaTratamentoDialog({ open, onOpenChange, protocolo, pacienteId, pacienteNome }: Props) {
  const { profile } = useAuth();
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
        { numero: 1, titulo: 'Alívio & Proteção', objetivo: 'Reduzir dor e estabilizar', semanas: '1-2', focos: ['Controle de sintomas', 'Educação em dor'] },
        { numero: 2, titulo: 'Carga Progressiva', objetivo: 'Reganhar força e mobilidade', semanas: '3-6', focos: ['Exercícios progressivos'] },
        { numero: 3, titulo: 'Retorno Funcional', objetivo: 'Voltar às atividades', semanas: '7-12', focos: ['Atividades específicas'] },
      ];
    }
    return arr.slice(0, 3).map((f: any, i: number) => ({
      numero: f.numero ?? i + 1,
      titulo: f.titulo || `Fase ${i + 1}`,
      objetivo: f.objetivo || '',
      semanas: f.semanas_inicio && f.semanas_fim ? `${f.semanas_inicio}-${f.semanas_fim}` : '',
      focos: (Array.isArray(f.demandasAlvo) ? f.demandasAlvo : (Array.isArray(f.criteriosProgressao) ? f.criteriosProgressao : [])).slice(0, 6),
    }));
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
      const { gerarPDFPropostaTratamento, downloadPDFBlob } = await import('@/utils/pdfPropostaTratamento');
      const fasesLimpas = fases.map(f => ({
        ...f,
        focos: f.focos.map(x => x.trim()).filter(Boolean),
      }));
      const manutLimpa = {
        mensagemPaciente: manut.mensagemPaciente.trim() || undefined,
        rotinaMinima: manut.rotinaMinima.map((x: string) => x.trim()).filter(Boolean),
        frequenciaReavaliacao: manut.frequenciaReavaliacao.trim() || undefined,
        sinaisParaRetornar: manut.sinaisParaRetornar.map((x: string) => x.trim()).filter(Boolean),
        habitosChave: manut.habitosChave.map((x: string) => x.trim()).filter(Boolean),
      };

      const blob = await gerarPDFPropostaTratamento({
        pacienteNome,
        profissionalNome,
        profissionalRegistro: (profile as any)?.registro_profissional || (profile as any)?.registro || undefined,
        clinicaNome: (profile as any)?.nome_clinica || undefined,
        queixaPrincipal: queixa.trim() || undefined,
        classificacao: classificacao.trim() || undefined,
        resumoClinico: resumoClinico.trim() || undefined,
        prognostico: prognostico.trim() || undefined,
        fases: fasesLimpas,
        manutencao: manutLimpa,
        pacote: { numeroSessoes, frequencia, duracao, valorSessao, desconto, formaPagamento },
        ctaTelefone: telefone || undefined,
        ctaMensagem: mensagem,
        validadeDias,
      });

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
                    <Input type="number" min={1} value={numeroSessoes} onChange={(e) => setNumeroSessoes(Number(e.target.value) || 0)} />
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
                    <Input type="number" min={0} value={valorSessao} onChange={(e) => setValorSessao(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Desconto (%)</Label>
                    <Input type="number" min={0} max={90} value={desconto} onChange={(e) => setDesconto(Number(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-[11px]">Validade (dias)</Label>
                    <Input type="number" min={1} value={validadeDias} onChange={(e) => setValidadeDias(Number(e.target.value) || 7)} />
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
            /* ============ PREVIEW ============ */
            <div className="bg-slate-100 dark:bg-slate-900 rounded-lg p-3 sm:p-6">
              <div className="mx-auto bg-white text-slate-900 shadow-lg rounded-md overflow-hidden" style={{ maxWidth: 560 }}>
                {/* Capa */}
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 text-center">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300 mb-2">Proposta de Tratamento</p>
                  <p className="text-2xl font-serif italic font-light">{pacienteNome}</p>
                  {profissionalNome && (
                    <p className="text-xs text-slate-300 mt-3">Preparado por {profissionalNome}</p>
                  )}
                </div>

                {/* Diagnóstico */}
                <div className="p-5 space-y-3">
                  {(queixa || classificacao) && (
                    <div className="border-l-2 border-amber-500 pl-3">
                      <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Seu quadro</p>
                      <p className="text-sm font-semibold text-slate-900">{queixa || '—'}</p>
                      {classificacao && <p className="text-xs text-slate-600">{classificacao}</p>}
                    </div>
                  )}
                  {resumoClinico && (
                    <p className="text-xs text-slate-700 leading-relaxed">{resumoClinico}</p>
                  )}
                  {prognostico && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2">
                      <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Prognóstico</p>
                      <p className="text-xs text-emerald-900">{prognostico}</p>
                    </div>
                  )}
                </div>

                {/* Fases */}
                <div className="px-5 pb-5">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-900 mb-2">Seu plano em {fases.length} fases</p>
                  <div className="space-y-2">
                    {fases.map((f, i) => (
                      <div key={i} className={cn('border border-slate-200 rounded-md p-3 border-l-4', FASE_BORDER[i] || 'border-l-slate-400')}>
                        <div className="flex items-baseline gap-2">
                          <span className={cn('text-2xl font-bold leading-none',
                            i === 0 ? 'text-rose-500' : i === 1 ? 'text-amber-500' : 'text-emerald-500')}>
                            {f.numero}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-slate-900">{f.titulo}</p>
                            {f.semanas && <p className="text-[10px] text-slate-500">Semanas {f.semanas}</p>}
                          </div>
                        </div>
                        {f.objetivo && <p className="text-xs italic text-slate-700 mt-1">"{f.objetivo}"</p>}
                        {f.focos.filter(Boolean).length > 0 && (
                          <ul className="mt-2 space-y-0.5">
                            {f.focos.filter(Boolean).map((foco, j) => (
                              <li key={j} className="text-xs text-slate-700 flex gap-1.5">
                                <span className={cn(
                                  i === 0 ? 'text-rose-500' : i === 1 ? 'text-amber-500' : 'text-emerald-500'
                                )}>•</span>
                                {foco}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Manutenção */}
                {(manut.mensagemPaciente || manut.frequenciaReavaliacao ||
                  manut.rotinaMinima.length > 0 || manut.habitosChave.length > 0 || manut.sinaisParaRetornar.length > 0) && (
                  <div className="px-5 pb-5">
                    <p className="text-[11px] uppercase tracking-wider font-bold text-slate-900 mb-2">Plano de Manutenção (pós-alta)</p>
                    <div className="border-l-4 border-emerald-500 bg-emerald-50 rounded-md p-3 space-y-2">
                      {manut.mensagemPaciente && (
                        <p className="text-xs italic text-slate-700">"{manut.mensagemPaciente}"</p>
                      )}
                      {manut.frequenciaReavaliacao && (
                        <p className="text-xs text-slate-700"><strong>Reavaliação:</strong> {manut.frequenciaReavaliacao}</p>
                      )}
                      {[
                        { k: 'rotinaMinima', label: 'Rotina mínima' },
                        { k: 'habitosChave', label: 'Hábitos-chave' },
                        { k: 'sinaisParaRetornar', label: 'Voltar ao profissional se' },
                      ].map(({ k, label }) => {
                        const items = (manut[k as keyof typeof manut] as string[]).filter(Boolean);
                        if (items.length === 0) return null;
                        return (
                          <div key={k}>
                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">{label}</p>
                            <ul className="space-y-0.5">
                              {items.map((it, i) => (
                                <li key={i} className="text-xs text-slate-700 flex gap-1.5"><span className="text-emerald-600">•</span>{it}</li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Investimento */}
                <div className="px-5 pb-5">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-slate-900 mb-2">Seu investimento</p>
                  <div className="bg-slate-900 text-white rounded-md p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-amber-300">{numeroSessoes} sessões · {duracao}</p>
                    {desconto > 0 && (
                      <p className="text-xs text-slate-400 line-through mt-1">{brl(numeroSessoes * valorSessao)}</p>
                    )}
                    <p className="text-3xl font-bold mt-1">{brl(total)}</p>
                    <p className="text-[11px] text-slate-300 mt-1">{brl(total / Math.max(1, numeroSessoes))} por sessão · {frequencia}</p>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-2 text-center">{formaPagamento}</p>
                </div>

                {/* CTA */}
                <div className="bg-amber-50 border-t border-amber-200 p-5 text-center">
                  <p className="text-xs text-slate-800 leading-relaxed">{mensagem}</p>
                  {telefone && (
                    <div className="mt-3 inline-block bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full">
                      WhatsApp: {telefone}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-3">Proposta válida por {validadeDias} dias</p>
                </div>
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
      </DialogContent>
    </Dialog>
  );
}
