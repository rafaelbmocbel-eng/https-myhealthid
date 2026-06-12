import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2, Calendar, ClipboardCheck, FileCheck, Receipt, Stethoscope, Sparkles, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  TIPO_DOCUMENTO_LABEL,
  type TipoDocumento,
  type ClinicaInfo,
  type TerapeutaInfo,
  type PacienteInfo,
} from '@/utils/pdfDocumentos';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paciente: PacienteInfo & { id: string; data_nascimento?: string | null; sexo?: string | null };
}

const TIPOS: { value: TipoDocumento; label: string; icon: any; desc: string }[] = [
  { value: 'laudo_cinetico', label: 'Laudo Cinético-Funcional', icon: Stethoscope, desc: 'Laudo completo com anamnese, exame, MyID e CIF (auto-preenchido).' },
  { value: 'comparecimento', label: 'Atestado de Comparecimento', icon: Calendar, desc: 'Comprova presença em sessão (data e horário).' },
  { value: 'atestado_fisio', label: 'Atestado Fisioterapêutico', icon: ClipboardCheck, desc: 'Justifica afastamento de atividades por X dias.' },
  { value: 'declaracao_tratamento', label: 'Declaração de Tratamento', icon: FileCheck, desc: 'Confirma acompanhamento (sem dados clínicos).' },
  
];

// CIF (Classificação Internacional de Funcionalidade) — sugestão por palavras-chave do motivo
const CIF_KEYWORDS: { keywords: string[]; cif: string; desc: string }[] = [
  // Dor por região
  { keywords: ['lombar', 'lombalgia', 'coluna lombar', 'costas', 'dorsalgia', 'hérnia de disco', 'hernia de disco', 'ciática', 'ciatica', 'lombociatalgia'], cif: 'b28013.2', desc: 'Dor nas costas' },
  { keywords: ['cervical', 'cervicalgia', 'pescoço', 'pescoco', 'torcicolo', 'cefaleia', 'cefaléia', 'enxaqueca'], cif: 'b28010.2', desc: 'Dor na cabeça e pescoço' },
  { keywords: ['ombro', 'manguito', 'bursite', 'capsulite', 'ombro congelado'], cif: 'b28014.2', desc: 'Dor no membro superior' },
  { keywords: ['cotovelo', 'epicondilite', 'punho', 'mão', 'mao', 'tunel do carpo', 'túnel do carpo', 'dedo', 'antebraço', 'antebraco'], cif: 'b28014.2', desc: 'Dor no membro superior' },
  { keywords: ['joelho', 'condromalácia', 'condromalacia', 'menisco', 'ligamento cruzado', 'lca', 'patelar', 'patelofemoral'], cif: 'b28015.2', desc: 'Dor no membro inferior' },
  { keywords: ['quadril', 'coxa', 'tornozelo', 'entorse', 'fascite plantar', 'pé', 'pe ', 'panturrilha', 'calcanhar', 'esporão'], cif: 'b28015.2', desc: 'Dor no membro inferior' },
  { keywords: ['torácica', 'toracica', 'costela', 'tórax', 'torax'], cif: 'b28012.2', desc: 'Dor no tórax' },
  { keywords: ['abdominal', 'abdome', 'pélvica', 'pelvica'], cif: 'b28016.2', desc: 'Dor nas articulações' },
  // Estruturas
  { keywords: ['pós-operatório', 'pós operatório', 'pos-operatorio', 'pos operatorio', 'cirurgia', 'cirúrgico', 'cirurgico', 'artroplastia', 'prótese', 'protese'], cif: 's770.3', desc: 'Estruturas adicionais relacionadas ao movimento' },
  { keywords: ['fratura', 'osteossíntese', 'osteossintese'], cif: 's7702.3', desc: 'Ligamentos e fáscias' },
  { keywords: ['artrose', 'osteoartrose', 'osteoartrite', 'artrite'], cif: 'b7101.2', desc: 'Mobilidade de várias articulações' },
  { keywords: ['escoliose', 'cifose', 'lordose', 'desvio postural'], cif: 's7600.2', desc: 'Estrutura da coluna vertebral' },
  // Atividade/Participação
  { keywords: ['marcha', 'andar', 'caminhar', 'deambulação', 'deambulacao'], cif: 'd450.2', desc: 'Andar' },
  { keywords: ['levantar', 'sentar', 'transferência', 'transferencia', 'mudar de posição'], cif: 'd410.2', desc: 'Mudar a posição básica do corpo' },
  { keywords: ['atividade laboral', 'trabalho', 'afastamento', 'incapacidade'], cif: 'd850.2', desc: 'Trabalho remunerado' },
  { keywords: ['esporte', 'esportiva', 'lazer', 'recreação', 'recreacao'], cif: 'd920.2', desc: 'Recreação e lazer' },
  // Funções
  { keywords: ['força', 'forca', 'fraqueza', 'atrofia', 'sarcopenia'], cif: 'b730.2', desc: 'Funções da força muscular' },
  { keywords: ['amplitude', 'rigidez', 'limitação articular', 'limitacao articular', 'mobilidade', 'adm'], cif: 'b710.2', desc: 'Funções da mobilidade articular' },
  { keywords: ['equilíbrio', 'equilibrio', 'queda', 'tontura', 'labirintite', 'vertigem'], cif: 'b755.2', desc: 'Funções de reações motoras involuntárias' },
  { keywords: ['avc', 'hemiplegia', 'hemiparesia', 'derrame', 'acidente vascular'], cif: 'b730.3', desc: 'Funções da força muscular' },
  { keywords: ['parkinson', 'neurológic', 'neurologic', 'esclerose', 'paralisia', 'medular'], cif: 'b760.2', desc: 'Controle do movimento voluntário' },
  { keywords: ['respirat', 'pulmon', 'asma', 'dpoc', 'bronquite'], cif: 'b440.2', desc: 'Funções da respiração' },
  { keywords: ['tendinite', 'tendinopatia', 'tendão', 'tendao'], cif: 'b7800.2', desc: 'Sensação de rigidez muscular' },
  { keywords: ['edema', 'inchaço', 'inchaco', 'linfedema'], cif: 'b435.2', desc: 'Funções do sistema imunológico (linfático)' },
  { keywords: ['cicatriz', 'pele'], cif: 's810.2', desc: 'Estrutura das áreas da pele' },
];

// Fallback genérico para garantir que sempre haja uma CIF sugerida no laudo
const CIF_FALLBACK = { cif: 'b28018.1', desc: 'Dor — não especificada (revisar e ajustar)' };

function sugerirCIF(motivo: string): { cif: string; desc: string } | null {
  const m = (motivo || '').toLowerCase();
  if (!m.trim()) return null;
  for (const item of CIF_KEYWORDS) {
    if (item.keywords.some(k => m.includes(k))) return { cif: item.cif, desc: item.desc };
  }
  // Sempre retorna algo quando há motivo descrito
  return CIF_FALLBACK;
}

export default function DocumentosModal({ open, onOpenChange, paciente }: Props) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<TipoDocumento | null>(null);
  const [gerando, setGerando] = useState(false);
  const [clinica, setClinica] = useState<ClinicaInfo | null>(null);
  const [terapeuta, setTerapeuta] = useState<TerapeutaInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Form fields (todos os tipos)
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [horaEntrada, setHoraEntrada] = useState('09:00');
  const [horaSaida, setHoraSaida] = useState('10:00');
  const [diasAfastamento, setDiasAfastamento] = useState(1);
  const [cid, setCid] = useState('');
  const [motivo, setMotivo] = useState('');
  const [desde, setDesde] = useState(new Date().toISOString().split('T')[0]);
  const [finalidade, setFinalidade] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [valor, setValor] = useState(0);
  const [referente, setReferente] = useState('sessões de fisioterapia');
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [numeroSessoes, setNumeroSessoes] = useState<number | undefined>();

  // Laudo cinético
  const [profissao, setProfissao] = useState('');
  const [queixaPrincipal, setQueixaPrincipal] = useState('');
  const [hma, setHma] = useState('');
  const [hpp, setHpp] = useState('');
  const [medicamentos, setMedicamentos] = useState('');
  const [exameFisico, setExameFisico] = useState('');
  const [testesEspeciais, setTestesEspeciais] = useState('');
  const [diagnosticoFuncional, setDiagnosticoFuncional] = useState('');
  const [cidPrincipal, setCidPrincipal] = useState('');
  const [cifCodigos, setCifCodigos] = useState('');
  const [objetivos, setObjetivos] = useState('');
  const [conduta, setConduta] = useState('');
  const [frequenciaSugerida, setFrequenciaSugerida] = useState('2x por semana, por 8 semanas');
  const [prognostico, setPrognostico] = useState('');
  const [myidData, setMyidData] = useState<{
    score?: number | null;
    classificacao?: string | null;
    dimensoes?: { label: string; valor: number }[];
  } | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [clinicaRes, profileRes] = await Promise.all([
        (supabase as any).from('config_clinica').select('*').eq('terapeuta_id', user.id).maybeSingle(),
        supabase.from('profiles').select('nome, sobrenome, especialidade, crefito').eq('user_id', user.id).maybeSingle(),
      ]);
      const c = clinicaRes.data as any;
      setClinica(c || null);
      const p = profileRes.data as any;
      // Preferir responsável/registro salvos em config_clinica (editáveis em Configurações)
      const respFull = (c?.responsavel || '').trim();
      const [respFirst, ...respRest] = respFull ? respFull.split(' ') : [];
      setTerapeuta({
        nome: respFirst || p?.nome || user.email?.split('@')[0] || 'Terapeuta',
        sobrenome: respRest.length ? respRest.join(' ') : (respFull ? undefined : p?.sobrenome),
        registro: c?.registro_responsavel || p?.crefito,
        especialidade: p?.especialidade,
      });
    })();
  }, [open, user]);

  // Auto-fill MyID + última avaliação presencial quando seleciona Laudo
  useEffect(() => {
    if (tipo !== 'laudo_cinetico' || !user) return;
    (async () => {
      setAutoFilling(true);
      try {
        const [idRes, vozRes] = await Promise.all([
          (supabase as any)
            .from('avaliacoes_identidade')
            .select('myid_score, classificacao, score_n, score_i, score_f, score_c, score_p, score_e, score_r, score_d, dados_avaliacao, myid_analysis, created_at')
            .eq('paciente_id', paciente.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          (supabase as any)
            .from('avaliacoes_voz')
            .select('queixa_principal, transcricao, resultado, created_at')
            .eq('paciente_id', paciente.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        const id = idRes.data;
        if (id) {
          const dims: { label: string; valor: number }[] = [];
          const map: [string, string][] = [
            ['N', 'Neuro'], ['I', 'Inflamatório'], ['F', 'Funcional'],
            ['C', 'Comportamental'], ['P', 'Postural'], ['E', 'Estrutural'],
            ['R', 'Recuperação'], ['D', 'Dor'],
          ];
          map.forEach(([k, label]) => {
            const v = id[`score_${k.toLowerCase()}`];
            if (v != null) dims.push({ label, valor: Number(v) });
          });
          setMyidData({
            score: id.myid_score,
            classificacao: id.classificacao,
            dimensoes: dims,
          });

          // Pré-preencher narrativa se existir myid_analysis
          const analysis = id.myid_analysis;
          if (analysis && typeof analysis === 'object') {
            if (!diagnosticoFuncional && analysis.diagnostico_funcional) {
              setDiagnosticoFuncional(String(analysis.diagnostico_funcional));
            }
            if (!objetivos && analysis.objetivos) {
              setObjetivos(Array.isArray(analysis.objetivos) ? analysis.objetivos.join('; ') : String(analysis.objetivos));
            }
            if (!conduta && analysis.conduta) {
              setConduta(Array.isArray(analysis.conduta) ? analysis.conduta.join('; ') : String(analysis.conduta));
            }
            if (!prognostico && analysis.prognostico) {
              setPrognostico(String(analysis.prognostico));
            }
          }
        }

        const voz = vozRes.data;
        if (voz) {
          if (!queixaPrincipal && voz.queixa_principal) setQueixaPrincipal(voz.queixa_principal);
          if (!hma && voz.transcricao) setHma(voz.transcricao.slice(0, 800));
          const r = voz.resultado as any;
          if (r && typeof r === 'object') {
            if (!exameFisico && r.exame_fisico) setExameFisico(String(r.exame_fisico));
            if (!testesEspeciais && r.testes_especiais) setTestesEspeciais(String(r.testes_especiais));
          }
        }
      } finally {
        setAutoFilling(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, paciente.id, user]);

  const buildDados = () => {
    let dados: any = {};
    switch (tipo) {
      case 'comparecimento':
        dados = { data, horaEntrada, horaSaida };
        break;
      case 'atestado_fisio': {
        const cifAuto = sugerirCIF(motivo);
        dados = {
          diasAfastamento,
          dataInicio: data,
          cid: cid || undefined,
          motivo: motivo || undefined,
          cif: cifAuto?.cif,
          cifDescricao: cifAuto?.desc,
        };
        break;
      }
      case 'declaracao_tratamento':
        dados = { desde, finalidade: finalidade || undefined, observacoes: observacoes || undefined };
        break;
      case 'recibo':
        dados = { valor, referente, formaPagamento, numeroSessoes };
        break;
      case 'laudo_cinetico':
        dados = {
          dataNascimento: paciente.data_nascimento,
          sexo: paciente.sexo,
          profissao: profissao || undefined,
          queixaPrincipal,
          hma,
          hpp: hpp || undefined,
          medicamentos: medicamentos || undefined,
          exameFisico,
          testesEspeciais: testesEspeciais || undefined,
          diagnosticoFuncional,
          cidPrincipal: cidPrincipal || undefined,
          cifCodigos: cifCodigos || undefined,
          myidScore: myidData?.score ?? null,
          myidClassificacao: myidData?.classificacao ?? null,
          myidDimensoes: myidData?.dimensoes,
          objetivos,
          conduta,
          frequenciaSugerida: frequenciaSugerida || undefined,
          prognostico: prognostico || undefined,
        };
        break;
    }
    return dados;
  };

  const handlePreview = async () => {
    if (!tipo || !terapeuta) return;
    setPreviewLoading(true);
    try {
      const { gerarDocumento } = await import('@/utils/pdfDocumentos');
      const doc = await gerarDocumento(tipo, { clinica, terapeuta, paciente }, buildDados());
      const blob = doc.output('blob');
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
    } catch (err: any) {
      console.error('Erro no preview:', err);
      toast({ title: 'Erro ao pré-visualizar', description: err.message, variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Limpa URL ao fechar/trocar tipo
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  // Auto-preview debounced: regenera quando qualquer campo do form muda
  useEffect(() => {
    if (!tipo || !terapeuta) return;
    const t = setTimeout(() => { handlePreview(); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tipo, terapeuta, clinica,
    data, horaEntrada, horaSaida, diasAfastamento, cid, motivo,
    desde, finalidade, observacoes, valor, referente, formaPagamento, numeroSessoes,
    profissao, queixaPrincipal, hma, hpp, medicamentos, exameFisico, testesEspeciais,
    diagnosticoFuncional, cidPrincipal, cifCodigos, objetivos, conduta,
    frequenciaSugerida, prognostico, myidData,
  ]);

  const handleGerar = async () => {
    if (!tipo || !terapeuta || !user) return;
    setGerando(true);
    try {
      const dados = buildDados();
      const { gerarDocumento } = await import('@/utils/pdfDocumentos');
      const doc = await gerarDocumento(tipo, { clinica, terapeuta, paciente }, dados);
      const filename = `${TIPO_DOCUMENTO_LABEL[tipo].replace(/\s/g, '_')}_${paciente.nome}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      // Salvar histórico
      await (supabase as any).from('documentos_emitidos').insert({
        terapeuta_id: user.id,
        paciente_id: paciente.id,
        tipo,
        titulo: TIPO_DOCUMENTO_LABEL[tipo],
        conteudo: dados,
      });

      toast({ title: '📄 Documento gerado!', description: `${TIPO_DOCUMENTO_LABEL[tipo]} baixado com sucesso.` });
      onOpenChange(false);
      setTipo(null);
    } catch (err: any) {
      console.error('Erro ao gerar documento:', err);
      toast({ title: 'Erro ao gerar', description: err.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Documento Clínico
          </DialogTitle>
          <DialogDescription>
            Para <strong>{paciente.nome} {paciente.sobrenome}</strong>
          </DialogDescription>
        </DialogHeader>

        {!tipo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className="text-left p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">{t.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{TIPO_DOCUMENTO_LABEL[tipo]}</span>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setTipo(null)}>
                Trocar
              </Button>
            </div>

            {tipo === 'comparecimento' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <Label htmlFor="data">Data da sessão</Label>
                  <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="hentrada">Entrada</Label>
                  <Input id="hentrada" type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="hsaida">Saída</Label>
                  <Input id="hsaida" type="time" value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} />
                </div>
              </div>
            )}

            {tipo === 'atestado_fisio' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dias">Dias de afastamento</Label>
                  <Input id="dias" type="number" inputMode="numeric" min={1} value={diasAfastamento || ''} onChange={(e) => setDiasAfastamento(e.target.value === '' ? 0 : Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="dini">A partir de</Label>
                  <Input id="dini" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cid">CID (opcional)</Label>
                  <Input id="cid" placeholder="Ex: M54.5" value={cid} onChange={(e) => setCid(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="motivo">Motivo clínico (opcional)</Label>
                  <Textarea id="motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex: lombalgia aguda, pós-operatório de joelho…" />
                  {(() => {
                    const s = sugerirCIF(motivo);
                    if (!s) return null;
                    return (
                      <div className="mt-2 flex items-start gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                        <Sparkles className="icon-sm text-emerald-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>CIF sugerida:</strong> {s.cif} — {s.desc}
                          <br />
                          <span className="text-muted-foreground">Adicionada automaticamente ao documento.</span>
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}

            {tipo === 'declaracao_tratamento' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="desde">Em tratamento desde</Label>
                  <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="fin">Finalidade (opcional)</Label>
                  <Input id="fin" placeholder="Ex: empresa, escola, seguro" value={finalidade} onChange={(e) => setFinalidade(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="obs">Observações (opcional)</Label>
                  <Textarea id="obs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>
              </div>
            )}

            {tipo === 'recibo' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="valor">Valor (R$)</Label>
                  <Input id="valor" type="number" inputMode="decimal" step="0.01" value={valor || ''} onChange={(e) => setValor(e.target.value === '' ? 0 : Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="forma">Forma de pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartão de crédito">Cartão de crédito</SelectItem>
                      <SelectItem value="cartão de débito">Cartão de débito</SelectItem>
                      <SelectItem value="transferência bancária">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nses">Nº de sessões (opcional)</Label>
                  <Input id="nses" type="number" min={1} value={numeroSessoes ?? ''} onChange={(e) => setNumeroSessoes(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="ref">Referente a</Label>
                  <Input id="ref" value={referente} onChange={(e) => setReferente(e.target.value)} />
                </div>
              </div>
            )}

            {tipo === 'laudo_cinetico' && (
              <div className="space-y-3">
                {autoFilling && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                    <Loader2 className="icon-sm animate-spin" /> Buscando MyID e última avaliação…
                  </div>
                )}
                {myidData?.score != null && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs">
                    <Sparkles className="icon-sm text-emerald-600 shrink-0" />
                    <span>
                      MyID auto-preenchido: <strong>{Number(myidData.score).toFixed(1)}/100</strong>
                      {myidData.classificacao && ` · ${myidData.classificacao}`}
                      {myidData.dimensoes?.length ? ` · ${myidData.dimensoes.length} dimensões` : ''}
                    </span>
                  </div>
                )}

                <div>
                  <Label htmlFor="prof">Profissão (opcional)</Label>
                  <Input id="prof" value={profissao} onChange={(e) => setProfissao(e.target.value)} placeholder="Ex: Professora" />
                </div>
                <div>
                  <Label htmlFor="qp">Queixa Principal *</Label>
                  <Textarea id="qp" rows={2} value={queixaPrincipal} onChange={(e) => setQueixaPrincipal(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="hma">História da Moléstia Atual (HMA) *</Label>
                  <Textarea id="hma" rows={3} value={hma} onChange={(e) => setHma(e.target.value)} placeholder="Início, evolução, fatores de melhora/piora" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="hpp">História Pregressa</Label>
                    <Textarea id="hpp" rows={2} value={hpp} onChange={(e) => setHpp(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="med">Medicamentos</Label>
                    <Textarea id="med" rows={2} value={medicamentos} onChange={(e) => setMedicamentos(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="ef">Exame Físico-Funcional *</Label>
                  <Textarea id="ef" rows={3} value={exameFisico} onChange={(e) => setExameFisico(e.target.value)} placeholder="Inspeção, ADM, força, postura" />
                </div>
                <div>
                  <Label htmlFor="te">Testes Especiais</Label>
                  <Textarea id="te" rows={2} value={testesEspeciais} onChange={(e) => setTestesEspeciais(e.target.value)} placeholder="Ex: Lasègue +, FABER -" />
                </div>
                <div>
                  <Label htmlFor="dx">Diagnóstico Cinético-Funcional *</Label>
                  <Textarea id="dx" rows={2} value={diagnosticoFuncional} onChange={(e) => setDiagnosticoFuncional(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="cid10">CID-10</Label>
                    <Input id="cid10" value={cidPrincipal} onChange={(e) => setCidPrincipal(e.target.value)} placeholder="Ex: M54.5" />
                  </div>
                  <div>
                    <Label htmlFor="cif">Códigos CIF</Label>
                    <Input id="cif" value={cifCodigos} onChange={(e) => setCifCodigos(e.target.value)} placeholder="Ex: b280.2, d450.1" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="obj">Objetivos *</Label>
                  <Textarea id="obj" rows={2} value={objetivos} onChange={(e) => setObjetivos(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cond">Conduta Fisioterapêutica *</Label>
                  <Textarea id="cond" rows={3} value={conduta} onChange={(e) => setConduta(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="freq">Frequência sugerida</Label>
                    <Input id="freq" value={frequenciaSugerida} onChange={(e) => setFrequenciaSugerida(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="prog">Prognóstico</Label>
                    <Input id="prog" value={prognostico} onChange={(e) => setPrognostico(e.target.value)} placeholder="Ex: Bom em 6-8 semanas" />
                  </div>
                </div>
              </div>
            )}

            {previewUrl && (
              <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Eye className="icon-sm text-primary" />
                    Pré-visualização (atualize após editar)
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                    >
                      <ExternalLink className="icon-sm" /> Abrir
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (previewUrl) URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }}
                    >
                      <EyeOff className="icon-sm mr-1" /> Fechar
                    </Button>
                  </div>
                </div>
                <iframe
                  src={previewUrl}
                  title="Pré-visualização do documento"
                  className="w-full h-[60vh] bg-white"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handlePreview}
                disabled={previewLoading || gerando}
              >
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                {previewUrl ? 'Atualizar pré-visualização' : 'Pré-visualizar'}
              </Button>
              <Button
                className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground"
                onClick={handleGerar}
                disabled={gerando}
              >
                {gerando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Gerar PDF e Baixar
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground text-center">
              A pré-visualização atualiza automaticamente conforme você edita os campos.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
