import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2, Calendar, ClipboardCheck, FileCheck, Receipt, Stethoscope, Sparkles, Eye, ExternalLink } from 'lucide-react';
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
import { corpoPadraoDocumento, fmtDate } from '@/utils/documentosTexto';

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

// Patologias mais comuns na fisioterapia — atalho pra inserir no texto do documento.
const PATOLOGIAS_COMUNS = [
  'Lombalgia', 'Lombociatalgia', 'Hérnia de disco lombar', 'Cervicalgia',
  'Cervicobraquialgia', 'Tendinite do supraespinhal (ombro)', 'Bursite de ombro',
  'Capsulite adesiva (ombro congelado)', 'Epicondilite lateral (cotovelo)',
  'Síndrome do túnel do carpo', 'Gonartrose (joelho)', 'Condromalácia patelar',
  'Pós-operatório de joelho', 'Entorse de tornozelo', 'Fascite plantar',
  'Escoliose', 'Cervicalgia postural', 'Fibromialgia', 'Coxartrose (quadril)',
  'Lesão do manguito rotador',
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

// Pré-visualização em HTML fiel ao PDF — funciona no celular (o iframe de PDF
// não renderiza em navegador mobile). Mostra o MESMO texto (corpo) que sai no
// PDF, então é WYSIWYG de verdade.
function DocumentoPreviewHTML({
  clinica, terapeuta, paciente, titulo, corpo, dataEmissao,
}: {
  clinica: ClinicaInfo | null;
  terapeuta: TerapeutaInfo;
  paciente: PacienteInfo;
  titulo: string;
  corpo: string;
  dataEmissao: string;
}) {
  const nomeClinica = clinica?.razao_social || 'MY HEALTH ID';
  const endParts = [
    clinica?.endereco,
    clinica?.cidade ? `${clinica.cidade}${clinica.uf ? '/' + clinica.uf : ''}` : null,
    clinica?.cep ? `CEP ${clinica.cep}` : null,
  ].filter(Boolean);
  const linha1 = [clinica?.cnpj ? `CNPJ ${clinica.cnpj}` : null, endParts.join(', ') || null].filter(Boolean).join(' · ');
  const contato = [
    clinica?.telefone,
    clinica?.email_clinica,
    clinica?.horario_funcionamento ? `Atend.: ${clinica.horario_funcionamento}` : null,
  ].filter(Boolean).join(' · ');
  const cidade = clinica?.cidade ? `${clinica.cidade}${clinica.uf ? '/' + clinica.uf : ''}, ` : '';
  const nomeTer = `${terapeuta.nome}${terapeuta.sobrenome ? ' ' + terapeuta.sobrenome : ''}`;
  const reg = [terapeuta.especialidade, terapeuta.registro].filter(Boolean).join(' · ');
  const paragrafos = String(corpo || '').split('\n');

  return (
    <div className="bg-white text-[#1e1e2e] rounded-md shadow-sm mx-auto w-full max-w-[520px] px-6 py-6 sm:px-8 sm:py-8 text-[13px] leading-relaxed">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 pb-2 border-b-2 border-[#1c3753]">
        {clinica?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={clinica.logo_url} alt="" className="h-12 w-12 object-contain shrink-0" />
        )}
        <div className="min-w-0">
          <div className="text-[#1c3753] font-bold text-base leading-tight">{nomeClinica}</div>
          {linha1 && <div className="text-[10px] text-gray-500 mt-0.5">{linha1}</div>}
          {contato && <div className="text-[10px] text-gray-500">{contato}</div>}
        </div>
      </div>

      {/* Título */}
      <h3 className="text-center text-[#1c3753] font-bold text-sm uppercase tracking-wide mt-5 mb-4">
        {titulo}
      </h3>

      {/* Corpo */}
      <div className="space-y-2 text-justify">
        {paragrafos.map((p, i) =>
          p.trim() === ''
            ? <div key={i} className="h-2" />
            : <p key={i}>{p}</p>,
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-16 text-center">
        <p>{cidade}{fmtDate(dataEmissao)}.</p>
        <div className="mx-auto mt-10 w-56 border-t border-[#1e1e2e]" />
        <p className="font-bold mt-1">{nomeTer}</p>
        {reg && <p className="text-[11px] text-gray-500">{reg}</p>}
        <p className="text-[8px] text-gray-400 mt-6">feito por My Health ID</p>
      </div>
    </div>
  );
}

export default function DocumentosModal({ open, onOpenChange, paciente }: Props) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<TipoDocumento | null>(null);
  const [gerando, setGerando] = useState(false);
  const [clinica, setClinica] = useState<ClinicaInfo | null>(null);
  const [terapeuta, setTerapeuta] = useState<TerapeutaInfo | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Corpo do documento editável + data de emissão (todos os tipos de texto)
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().split('T')[0]);
  const [corpo, setCorpo] = useState('');
  const [corpoEditado, setCorpoEditado] = useState(false);

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

  // Campos estruturados (sem o corpo/emissão) — alimentam o texto padrão.
  const buildDadosBase = () => {
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

  const isTextoDoc = !!tipo && tipo !== 'laudo_cinetico';

  // Dados finais enviados ao gerador: campos + data de emissão + corpo editado
  // (só sobrescreve o texto padrão quando o usuário mexeu no texto à mão).
  const buildDados = () => {
    const base = buildDadosBase();
    const extra: any = { dataEmissao };
    if (isTextoDoc && corpoEditado && corpo.trim()) extra.corpo = corpo;
    return { ...base, ...extra };
  };

  // Mantém o campo de texto em sincronia com os campos estruturados enquanto o
  // usuário NÃO editou o texto manualmente. Assim ele vê o texto que vai sair e
  // pode assumir a edição a qualquer momento (WYSIWYG de verdade).
  useEffect(() => {
    if (!isTextoDoc || !terapeuta || corpoEditado) return;
    const txt = corpoPadraoDocumento(tipo!, { paciente, terapeuta }, buildDadosBase());
    setCorpo(txt || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tipo, terapeuta, paciente, corpoEditado,
    data, horaEntrada, horaSaida, diasAfastamento, cid, motivo,
    desde, finalidade, observacoes, valor, referente, formaPagamento, numeroSessoes,
  ]);

  // Insere uma patologia comum no fim do texto (o usuário edita/reposiciona depois).
  const inserirPatologia = (p: string) => {
    if (!p) return;
    setCorpo((c) => `${(c || '').trimEnd()}\n\nObservação clínica: ${p}.`);
    setCorpoEditado(true);
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
    // Ao trocar de tipo, apenas solta a edição manual — NÃO limpa o texto aqui.
    // (Limpar apagava o texto que o efeito de sincronização preenche no mesmo
    // render, deixando a caixa vazia.) O sync repõe o texto padrão do novo tipo.
    setCorpoEditado(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo]);

  // Auto-preview (PDF em iframe) SÓ para o Laudo — que é estruturado e não tem
  // uma pré-visualização HTML. Os documentos de texto usam a prévia HTML abaixo,
  // que renderiza no celular (iframe de PDF não abre em navegador mobile).
  useEffect(() => {
    if (tipo !== 'laudo_cinetico' || !terapeuta) return;
    const t = setTimeout(() => { handlePreview(); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tipo, terapeuta, clinica,
    profissao, queixaPrincipal, hma, hpp, medicamentos, exameFisico, testesEspeciais,
    diagnosticoFuncional, cidPrincipal, cifCodigos, objetivos, conduta,
    frequenciaSugerida, prognostico, myidData, dataEmissao,
  ]);

  // Gera o PDF de verdade e abre em nova aba (útil no celular pra ver/imprimir
  // o arquivo final — a prévia HTML já mostra o conteúdo ao vivo).
  const handleAbrirPdf = async () => {
    if (!tipo || !terapeuta) return;
    setPreviewLoading(true);
    try {
      const { gerarDocumento } = await import('@/utils/pdfDocumentos');
      const doc = await gerarDocumento(tipo, { clinica, terapeuta, paciente }, buildDados());
      const url = URL.createObjectURL(doc.output('blob'));
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      console.error('Erro ao abrir PDF:', err);
      toast({ title: 'Erro ao abrir PDF', description: err.message, variant: 'destructive' });
    } finally {
      setPreviewLoading(false);
    }
  };

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

            <div>
              <Label htmlFor="demissao">Data de emissão (rodapé)</Label>
              <Input id="demissao" type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} />
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

            {isTextoDoc && (
              <div>
                <div className="flex items-center justify-between mb-1 gap-2">
                  <Label htmlFor="corpo">Texto do documento (editável)</Label>
                  <div className="flex items-center gap-1.5">
                    <Select value="" onValueChange={inserirPatologia}>
                      <SelectTrigger className="h-7 text-[11px] w-auto gap-1 px-2">
                        <Sparkles className="h-3 w-3 text-primary" />
                        <SelectValue placeholder="Patologia" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {PATOLOGIAS_COMUNS.map((p) => (
                          <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {corpoEditado && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[11px] gap-1 px-2"
                        onClick={() => setCorpoEditado(false)}
                      >
                        Restaurar padrão
                      </Button>
                    )}
                  </div>
                </div>
                <Textarea
                  id="corpo"
                  rows={8}
                  value={corpo}
                  onChange={(e) => { setCorpo(e.target.value); setCorpoEditado(true); }}
                  className="text-sm leading-relaxed"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {corpoEditado
                    ? 'Você está editando o texto à mão. Os campos acima não vão mais sobrescrever.'
                    : 'Os campos acima preenchem este texto. Pode editar livremente aqui — assim que digitar, o texto passa a ser o seu.'}
                </p>
              </div>
            )}

            {/* Prévia HTML (fiel ao PDF) — documentos de texto. Renderiza no celular. */}
            {isTextoDoc && terapeuta && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/60 border-b border-border text-xs font-medium">
                  <Eye className="icon-sm text-primary" />
                  Pré-visualização
                </div>
                <div className="max-h-[60vh] overflow-y-auto p-3 bg-neutral-200/60 dark:bg-neutral-800">
                  <DocumentoPreviewHTML
                    clinica={clinica}
                    terapeuta={terapeuta}
                    paciente={paciente}
                    titulo={TIPO_DOCUMENTO_LABEL[tipo!]}
                    corpo={corpo}
                    dataEmissao={dataEmissao}
                  />
                </div>
              </div>
            )}

            {/* Laudo é estruturado (sem corpo de texto) — mantém a prévia em PDF. */}
            {tipo === 'laudo_cinetico' && previewUrl && (
              <div className="rounded-xl border border-border overflow-hidden bg-muted/30">
                <div className="flex items-center justify-between px-3 py-2 bg-muted/60 border-b border-border">
                  <div className="flex items-center gap-2 text-xs font-medium">
                    <Eye className="icon-sm text-primary" />
                    Pré-visualização
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => previewUrl && window.open(previewUrl, '_blank')}
                  >
                    <ExternalLink className="icon-sm" /> Abrir em nova aba
                  </Button>
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
                onClick={tipo === 'laudo_cinetico' ? handlePreview : handleAbrirPdf}
                disabled={previewLoading || gerando}
              >
                {previewLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ExternalLink className="h-4 w-4 mr-2" />}
                {tipo === 'laudo_cinetico' ? 'Atualizar pré-visualização' : 'Abrir PDF'}
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
