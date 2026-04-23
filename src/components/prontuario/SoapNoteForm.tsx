import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2, Save, Sparkles, Mic, Wand2 } from 'lucide-react';
import { useNotasProntuario } from '@/hooks/useNotasProntuario';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Build SOAP fields from a voice assessment (`resultado` of avaliacoes_voz)
function buildSoapFromVoice(voice: any, transcricao?: string): { subjectivo: string; objetivo: string; avaliacao: string; plano: string } {
  const a = voice || {};
  const dor = a.dor || {};
  const func = a.funcionalidade || {};
  const psi = a.psicossocial || {};
  const red = a.red_flags || a.redflags || [];
  const hipoteses = Array.isArray(a.hipoteses_diagnosticas) ? a.hipoteses_diagnosticas : [];
  const insights = Array.isArray(a.insights_baseados_evidencia) ? a.insights_baseados_evidencia : [];
  const diretriz = a.diretriz_inicial || a.diretriz || {};
  const plano = a.plano_terapeutico || a.plano || {};

  const subjectivo = [
    `Queixa principal: ${a.queixa_principal || 'N/I'}`,
    dor.localizacao && `Localização da dor: ${dor.localizacao}`,
    dor.intensidade_eva != null && `EVA: ${dor.intensidade_eva}/10`,
    dor.tipo && `Tipo de dor: ${dor.tipo}`,
    dor.fatores_agravantes && `Fatores agravantes: ${Array.isArray(dor.fatores_agravantes) ? dor.fatores_agravantes.join(', ') : dor.fatores_agravantes}`,
    dor.fatores_atenuantes && `Fatores atenuantes: ${Array.isArray(dor.fatores_atenuantes) ? dor.fatores_atenuantes.join(', ') : dor.fatores_atenuantes}`,
    func.limitacoes && `Limitações funcionais: ${Array.isArray(func.limitacoes) ? func.limitacoes.join(', ') : func.limitacoes}`,
    psi.humor && `Humor: ${psi.humor}`,
    psi.sono && `Sono: ${psi.sono}`,
    psi.kinesiofobia && `Kinesiofobia: ${psi.kinesiofobia}`,
    transcricao && `\nRelato (transcrição):\n${transcricao.slice(0, 1500)}${transcricao.length > 1500 ? '…' : ''}`,
  ].filter(Boolean).join('\n');

  const objetivo = [
    a.exame_observacional && `Observação clínica: ${a.exame_observacional}`,
    func.adm && `ADM: ${func.adm}`,
    func.forca && `Força: ${func.forca}`,
    func.testes_funcionais && `Testes funcionais: ${Array.isArray(func.testes_funcionais) ? func.testes_funcionais.join(', ') : func.testes_funcionais}`,
    a.classificacao_severidade && `Classificação clínica: ${a.classificacao_severidade}`,
    red?.length > 0 && `⚠️ Red Flags: ${(Array.isArray(red) ? red : [red]).map((r: any) => r.descricao || r).join('; ')}`,
  ].filter(Boolean).join('\n') || 'Achados objetivos a complementar no exame físico.';

  const avaliacao = [
    a.resumo_clinico && `Resumo clínico: ${a.resumo_clinico}`,
    hipoteses.length > 0 && `Hipóteses diagnósticas:\n${hipoteses.slice(0, 3).map((h: any, i: number) => `  ${i + 1}. ${h.diagnostico} (${h.probabilidade || 'N/I'}) — ${h.evidencia || ''}`).join('\n')}`,
    a.mecanismo_dor && `Mecanismo de dor: ${a.mecanismo_dor}`,
    a.prognostico && `Prognóstico: ${a.prognostico}`,
  ].filter(Boolean).join('\n');

  const planoTexto = [
    diretriz.objetivo && `Objetivo terapêutico: ${diretriz.objetivo}`,
    plano.condutas && `Condutas: ${Array.isArray(plano.condutas) ? plano.condutas.join(', ') : plano.condutas}`,
    plano.tecnicas && `Técnicas: ${Array.isArray(plano.tecnicas) ? plano.tecnicas.join(', ') : plano.tecnicas}`,
    plano.exercicios && `Exercícios: ${Array.isArray(plano.exercicios) ? plano.exercicios.join(', ') : plano.exercicios}`,
    plano.frequencia && `Frequência: ${plano.frequencia}`,
    plano.orientacoes && `Orientações: ${Array.isArray(plano.orientacoes) ? plano.orientacoes.join(', ') : plano.orientacoes}`,
    insights.length > 0 && `\nInsights baseados em evidências:\n${insights.slice(0, 3).map((i: any) => `  • ${i.insight || i} ${i.referencia ? `(${i.referencia})` : ''}`).join('\n')}`,
  ].filter(Boolean).join('\n') || 'Conduta a definir conforme reavaliação.';

  return { subjectivo, objetivo, avaliacao, plano: planoTexto };
}

const SOAP_TEMPLATES: Record<string, { label: string; subjectivo: string; objetivo: string; avaliacao: string; plano: string }> = {
  retorno_geral: {
    label: 'Retorno Geral',
    subjectivo: 'Paciente relata [melhora/piora/manutenção] do quadro desde última sessão.\nQueixa principal atual: \nNível de dor (EVA): /10\nSono: h | Humor: /5',
    objetivo: 'Avaliação postural: \nADM: \nForça muscular: \nTestes especiais: \nPalpação: ',
    avaliacao: 'Hipótese funcional: \nEstágio de recuperação: [agudo/subagudo/crônico]\nClassificação: \nPrognóstico: [favorável/reservado]',
    plano: 'Conduta realizada: \nOrientações domiciliares: \nFrequência proposta: \nPróxima reavaliação: ',
  },
  avaliacao_inicial: {
    label: 'Avaliação Inicial',
    subjectivo: 'Queixa principal: \nHDA: \nHMP: \nCirurgias anteriores: \nMedicações em uso: \nObjetivo do paciente: ',
    objetivo: 'Inspeção: \nPalpação: \nADM ativa/passiva: \nForça muscular: \nTestes especiais: \nAvaliação neurológica: \nPostura: ',
    avaliacao: 'Diagnóstico fisioterapêutico: \nProblemas identificados: \n1. \n2. \n3. \nEstágio: [agudo/subagudo/crônico]\nClassificação de risco: ',
    plano: 'Objetivos de curto prazo: \nObjetivos de longo prazo: \nFrequência: \nDuração estimada: \nEncaminhamentos: ',
  },
  alta_terapeutica: {
    label: 'Alta Terapêutica',
    subjectivo: 'Paciente relata [resolução/melhora significativa] dos sintomas.\nObjetivos atingidos: \nNível funcional atual: ',
    objetivo: 'Reavaliação final:\nADM: \nForça: \nTestes funcionais: \nComparação com avaliação inicial: ',
    avaliacao: 'Critérios de alta atingidos: \nScore final vs inicial: \nGanho funcional: ',
    plano: 'Programa de manutenção: \nOrientações de autocuidado: \nCritérios de retorno: \nAgendamento de follow-up: ',
  },
  pos_operatorio: {
    label: 'Pós-Operatório',
    subjectivo: 'Cirurgia realizada: \nData da cirurgia: \nQueixas atuais: \nDor (EVA): /10\nEdema: [sim/não]',
    objetivo: 'Cicatriz: [aspecto, aderência]\nEdema: [medidas]\nADM: \nForça: [quando aplicável]\nMarcha: ',
    avaliacao: 'Fase PO: [precoce/intermediário/avançado]\nProgresso conforme protocolo: [sim/não]\nComplicações: ',
    plano: 'Técnicas aplicadas: \nCrioterapia: [sim/não]\nExercícios prescritos: \nCuidados domiciliares: \nPróxima sessão: ',
  },
  dor_cronica: {
    label: 'Dor Crônica',
    subjectivo: 'Localização da dor: \nEVA atual: /10 (última sessão: /10)\nFatores agravantes: \nFatores atenuantes: \nImpacto funcional: \nSono: \nHumor/ansiedade: ',
    objetivo: 'Exame sensorial: \nQuantitative Sensory Testing: \nMovimentos provocativos: \nEstratégias de enfrentamento observadas: ',
    avaliacao: 'Mecanismo de dor predominante: [nociceptivo/neuropático/nociplástico]\nCatastrofização: \nKinesiofobia: \nAutoeficácia: ',
    plano: 'Educação em dor: \nExercício terapêutico: \nExposição gradual: \nTécnicas de regulação: \nEncaminhamentos multidisciplinares: ',
  },
};

interface Props {
  pacienteId: string;
  onSuccess?: () => void;
}

export default function SoapNoteForm({ pacienteId, onSuccess }: Props) {
  const [template, setTemplate] = useState('retorno_geral');
  const [subjectivo, setSubjectivo] = useState(SOAP_TEMPLATES.retorno_geral.subjectivo);
  const [objetivo, setObjetivo] = useState(SOAP_TEMPLATES.retorno_geral.objetivo);
  const [avaliacao, setAvaliacao] = useState(SOAP_TEMPLATES.retorno_geral.avaliacao);
  const [plano, setPlano] = useState(SOAP_TEMPLATES.retorno_geral.plano);
  const { adicionar, adicionando } = useNotasProntuario(pacienteId);
  const { toast } = useToast();

  const applyTemplate = (key: string) => {
    const t = SOAP_TEMPLATES[key];
    if (!t) return;
    setTemplate(key);
    setSubjectivo(t.subjectivo);
    setObjetivo(t.objetivo);
    setAvaliacao(t.avaliacao);
    setPlano(t.plano);
  };

  const handleSave = async () => {
    const descricao = `📝 S — SUBJETIVO\n${subjectivo}\n\n🔍 O — OBJETIVO\n${objetivo}\n\n🧠 A — AVALIAÇÃO\n${avaliacao}\n\n📋 P — PLANO\n${plano}`;
    const titulo = `Nota SOAP — ${SOAP_TEMPLATES[template]?.label || 'Geral'} — ${new Date().toLocaleDateString('pt-BR')}`;

    try {
      await adicionar({
        pacienteId,
        tipo: 'soap_note',
        titulo,
        descricao,
        dadosExtras: { template, subjectivo, objetivo, avaliacao, plano },
      });
      toast({ title: 'Nota SOAP salva! ✅' });
      onSuccess?.();
    } catch (err: any) {
      toast({ title: 'Erro ao salvar', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Nova Nota SOAP
          </CardTitle>
          <Select value={template} onValueChange={applyTemplate}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <Sparkles className="h-3 w-3 mr-1 text-primary" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SOAP_TEMPLATES).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1.5 flex-wrap mt-2">
          {['S', 'O', 'A', 'P'].map((letter, i) => (
            <Badge key={letter} variant="outline" className="text-[10px]">
              {['Subjetivo', 'Objetivo', 'Avaliação', 'Plano'][i]}
            </Badge>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs font-semibold text-primary">S — Subjetivo</Label>
          <Textarea value={subjectivo} onChange={e => setSubjectivo(e.target.value)} rows={4} className="mt-1 text-xs" placeholder="O que o paciente relata..." />
        </div>
        <div>
          <Label className="text-xs font-semibold text-blue-600">O — Objetivo</Label>
          <Textarea value={objetivo} onChange={e => setObjetivo(e.target.value)} rows={4} className="mt-1 text-xs" placeholder="Achados clínicos objetivos..." />
        </div>
        <div>
          <Label className="text-xs font-semibold text-amber-600">A — Avaliação</Label>
          <Textarea value={avaliacao} onChange={e => setAvaliacao(e.target.value)} rows={3} className="mt-1 text-xs" placeholder="Diagnóstico e raciocínio clínico..." />
        </div>
        <div>
          <Label className="text-xs font-semibold text-emerald-600">P — Plano</Label>
          <Textarea value={plano} onChange={e => setPlano(e.target.value)} rows={3} className="mt-1 text-xs" placeholder="Conduta e próximos passos..." />
        </div>
        <Button onClick={handleSave} disabled={adicionando} className="w-full gap-2">
          {adicionando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Nota SOAP
        </Button>
      </CardContent>
    </Card>
  );
}
