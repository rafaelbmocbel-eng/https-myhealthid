import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Activity, Pill, AlertTriangle, Brain, Users, Scissors, Send, Loader2, Plus, Trash2, ClipboardList,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface CirurgiaItem { id: string; tipo: string; ano: string; complicacoes: string }
interface MedicamentoItem { id: string; nome: string; dose: string; frequencia: string }

interface HistoricoClinico {
  doencas_cronicas: { condicoes: string[]; detalhes: string };
  cirurgias: { items: CirurgiaItem[] };
  medicamentos: { items: MedicamentoItem[] };
  alergias: { medicamentos: string; alimentos: string; outros: string };
  saude_mental: { condicoes: string[]; diagnostico_formal: boolean; detalhes: string };
  historico_familiar: { condicoes: string[]; detalhes: string };
  atualizado_em?: string;
  ultimo_envio?: string;
}

const ESTADO_INICIAL: HistoricoClinico = {
  doencas_cronicas: { condicoes: [], detalhes: '' },
  cirurgias: { items: [] },
  medicamentos: { items: [] },
  alergias: { medicamentos: '', alimentos: '', outros: '' },
  saude_mental: { condicoes: [], diagnostico_formal: false, detalhes: '' },
  historico_familiar: { condicoes: [], detalhes: '' },
};

const DOENCAS_CRONICAS_OPCOES = [
  'Hipertensão arterial',
  'Diabetes tipo 1',
  'Diabetes tipo 2',
  'Hipotireoidismo',
  'Hipertireoidismo',
  'Lúpus',
  'Artrite reumatoide',
  'Esclerose múltipla',
  'Doença de Crohn / Colite ulcerativa',
  'Fibromialgia',
  'Asma / DPOC',
  'Insuficiência renal',
  'Outras',
];

const SAUDE_MENTAL_OPCOES = [
  'Ansiedade',
  'Depressão',
  'Transtorno bipolar',
  'TDAH',
  'Transtorno de pânico',
  'Burnout',
  'Outras',
];

const HIST_FAMILIAR_OPCOES = [
  'Doenças cardiovasculares',
  'Câncer',
  'Diabetes',
  'Hipertensão',
  'Doenças autoimunes',
  'Doenças neurológicas',
  'Outras',
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Subcomponentes menores ─────────────────────────────────────────────────

function CheckboxGroup({
  opcoes,
  selecionadas,
  onChange,
}: {
  opcoes: string[];
  selecionadas: string[];
  onChange: (novo: string[]) => void;
}) {
  const toggle = (op: string) => {
    onChange(selecionadas.includes(op) ? selecionadas.filter(s => s !== op) : [...selecionadas, op]);
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {opcoes.map(op => (
        <div key={op} className="flex items-center gap-2">
          <Checkbox
            id={`chk-${op}`}
            checked={selecionadas.includes(op)}
            onCheckedChange={() => toggle(op)}
          />
          <Label htmlFor={`chk-${op}`} className="text-sm cursor-pointer">{op}</Label>
        </div>
      ))}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────

export default function HistoricoClinicoCard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [dados, setDados] = useState<HistoricoClinico>(ESTADO_INICIAL);
  const [pacienteId, setPacienteId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [enviando, setEnviando] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Carrega dados salvos ──────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('pacientes')
        .select('id, historico_clinico')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setPacienteId(data.id);
        if (data.historico_clinico) {
          setDados({ ...ESTADO_INICIAL, ...(data.historico_clinico as HistoricoClinico) });
        }
      }
      setLoaded(true);
    })();
  }, [user]);

  // ── Auto-save debounced ────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded || !pacienteId) return;

    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        const now = new Date().toISOString();
        const payload: HistoricoClinico = { ...dados, atualizado_em: now };

        // Sumários para campos legados do perfil
        const condicoes = [
          ...dados.doencas_cronicas.condicoes,
          ...dados.saude_mental.condicoes,
        ].join(', ');
        const meds = dados.medicamentos.items
          .filter(m => m.nome.trim())
          .map(m => `${m.nome}${m.dose ? ` ${m.dose}` : ''}${m.frequencia ? `, ${m.frequencia}` : ''}`)
          .join('; ');
        const alerg = [
          dados.alergias.medicamentos,
          dados.alergias.alimentos,
          dados.alergias.outros,
        ].filter(Boolean).join('; ');

        await (supabase as any)
          .from('pacientes')
          .update({
            historico_clinico: payload,
            ...(condicoes ? { condicoes_preexistentes: condicoes } : {}),
            ...(meds ? { medicamentos_uso: meds } : {}),
            ...(alerg ? { alergias: alerg } : {}),
          })
          .eq('id', pacienteId);

        setSaveStatus('saved');
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2500);
      } catch {
        setSaveStatus('idle');
      }
    }, 2500);

    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(dados)]);

  // ── Helpers de atualização ─────────────────────────────────────────────
  const setDoencas = (patch: Partial<HistoricoClinico['doencas_cronicas']>) =>
    setDados(d => ({ ...d, doencas_cronicas: { ...d.doencas_cronicas, ...patch } }));

  const setCirurgia = (id: string, patch: Partial<CirurgiaItem>) =>
    setDados(d => ({
      ...d,
      cirurgias: {
        items: d.cirurgias.items.map(i => i.id === id ? { ...i, ...patch } : i),
      },
    }));
  const addCirurgia = () =>
    setDados(d => ({ ...d, cirurgias: { items: [...d.cirurgias.items, { id: uid(), tipo: '', ano: '', complicacoes: '' }] } }));
  const removeCirurgia = (id: string) =>
    setDados(d => ({ ...d, cirurgias: { items: d.cirurgias.items.filter(i => i.id !== id) } }));

  const setMed = (id: string, patch: Partial<MedicamentoItem>) =>
    setDados(d => ({
      ...d,
      medicamentos: {
        items: d.medicamentos.items.map(i => i.id === id ? { ...i, ...patch } : i),
      },
    }));
  const addMed = () =>
    setDados(d => ({ ...d, medicamentos: { items: [...d.medicamentos.items, { id: uid(), nome: '', dose: '', frequencia: '' }] } }));
  const removeMed = (id: string) =>
    setDados(d => ({ ...d, medicamentos: { items: d.medicamentos.items.filter(i => i.id !== id) } }));

  const setAlergias = (patch: Partial<HistoricoClinico['alergias']>) =>
    setDados(d => ({ ...d, alergias: { ...d.alergias, ...patch } }));

  const setSaudeMental = (patch: Partial<HistoricoClinico['saude_mental']>) =>
    setDados(d => ({ ...d, saude_mental: { ...d.saude_mental, ...patch } }));

  const setFamiliar = (patch: Partial<HistoricoClinico['historico_familiar']>) =>
    setDados(d => ({ ...d, historico_familiar: { ...d.historico_familiar, ...patch } }));

  // ── Enviar ao profissional ─────────────────────────────────────────────
  const enviar = async () => {
    const answers: { categoria: string; pergunta: string; resposta: string }[] = [];

    dados.doencas_cronicas.condicoes.forEach(c => {
      answers.push({
        categoria: 'doenca_sistemica',
        pergunta: 'Doença crônica',
        resposta: c + (dados.doencas_cronicas.detalhes ? ` — ${dados.doencas_cronicas.detalhes}` : ''),
      });
    });

    dados.cirurgias.items.filter(i => i.tipo.trim()).forEach(i => {
      answers.push({
        categoria: 'cirurgia',
        pergunta: 'Cirurgia ou internação',
        resposta: `${i.tipo}${i.ano ? ` (${i.ano})` : ''}${i.complicacoes ? ` — complicações: ${i.complicacoes}` : ''}`,
      });
    });

    dados.medicamentos.items.filter(m => m.nome.trim()).forEach(m => {
      answers.push({
        categoria: 'medicamento',
        pergunta: 'Medicamento em uso',
        resposta: `${m.nome}${m.dose ? `, ${m.dose}` : ''}${m.frequencia ? `, ${m.frequencia}` : ''}`,
      });
    });

    const alergTexto = [
      dados.alergias.medicamentos && `medicamentos: ${dados.alergias.medicamentos}`,
      dados.alergias.alimentos && `alimentos: ${dados.alergias.alimentos}`,
      dados.alergias.outros && `outros: ${dados.alergias.outros}`,
    ].filter(Boolean).join('; ');
    if (alergTexto) {
      answers.push({ categoria: 'alergia', pergunta: 'Alergias', resposta: alergTexto });
    }

    dados.saude_mental.condicoes.forEach(c => {
      answers.push({
        categoria: 'saude_mental',
        pergunta: 'Saúde mental',
        resposta: c + (dados.saude_mental.diagnostico_formal ? ' (diagnóstico formal)' : '') +
          (dados.saude_mental.detalhes ? ` — ${dados.saude_mental.detalhes}` : ''),
      });
    });

    const famTexto = dados.historico_familiar.condicoes.join(', ') +
      (dados.historico_familiar.detalhes ? ` — ${dados.historico_familiar.detalhes}` : '');
    if (dados.historico_familiar.condicoes.length > 0) {
      answers.push({ categoria: 'historico_familiar', pergunta: 'Histórico familiar', resposta: famTexto });
    }

    if (answers.length === 0) {
      toast({ title: 'Nada para enviar', description: 'Preencha pelo menos uma seção antes de enviar.' });
      return;
    }

    setEnviando(true);
    try {
      const { REGIONS } = await import('@/components/presencial/Body3DAvatar');
      const { VISCERAL_REGIONS } = await import('@/utils/anatomia/regioesViscerais');
      const regions = [
        ...REGIONS.map(r => ({ id: r.id, label: r.label, sistemas: ['musculoesqueletico'] })),
        ...VISCERAL_REGIONS.map(r => ({ id: r.id, label: r.label, sistemas: r.sistemas })),
      ];

      const { data, error } = await supabase.functions.invoke('triagem-historico-clinico', {
        body: { answers, regions },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      // Salva timestamp do último envio
      await (supabase as any)
        .from('pacientes')
        .update({ historico_clinico: { ...dados, ultimo_envio: new Date().toISOString() } })
        .eq('id', pacienteId);
      setDados(d => ({ ...d, ultimo_envio: new Date().toISOString() }));

      toast({
        title: '✅ Histórico enviado',
        description: 'Seu profissional vai revisar e decidir o que entra no seu Avatar Clínico.',
      });
    } catch (e) {
      toast({
        title: 'Não foi possível enviar',
        description: e instanceof Error ? e.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setEnviando(false);
    }
  };

  // ── Renderização ───────────────────────────────────────────────────────
  const ultimoEnvio = dados.ultimo_envio
    ? new Date(dados.ultimo_envio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  const temConteudo =
    dados.doencas_cronicas.condicoes.length > 0 ||
    dados.cirurgias.items.some(i => i.tipo.trim()) ||
    dados.medicamentos.items.some(m => m.nome.trim()) ||
    [dados.alergias.medicamentos, dados.alergias.alimentos, dados.alergias.outros].some(Boolean) ||
    dados.saude_mental.condicoes.length > 0 ||
    dados.historico_familiar.condicoes.length > 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <ClipboardList className="h-4 w-4 text-primary" /> Histórico Clínico Estratégico
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Salvo automaticamente. Seu profissional revisa tudo antes de qualquer coisa entrar no Avatar Clínico.
          </p>
          {ultimoEnvio && (
            <p className="text-[11px] text-muted-foreground mt-1">Último envio ao profissional: {ultimoEnvio}</p>
          )}
        </div>
        <div className="shrink-0 pt-1">
          {saveStatus === 'saving' && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <span className="animate-pulse">●</span> Salvando…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[11px] text-emerald-600 flex items-center gap-1">✓ Salvo</span>
          )}
        </div>
      </div>

      <CardContent className="pt-3 pb-5">
        <Accordion type="multiple" className="space-y-2">

          {/* ── 1. Doenças crônicas ── */}
          <AccordionItem value="doencas" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-red-500" />
                Doenças crônicas
                {dados.doencas_cronicas.condicoes.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {dados.doencas_cronicas.condicoes.length}
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              <CheckboxGroup
                opcoes={DOENCAS_CRONICAS_OPCOES}
                selecionadas={dados.doencas_cronicas.condicoes}
                onChange={condicoes => setDoencas({ condicoes })}
              />
              {dados.doencas_cronicas.condicoes.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Detalhes adicionais (opcional)</Label>
                  <Textarea
                    value={dados.doencas_cronicas.detalhes}
                    onChange={e => setDoencas({ detalhes: e.target.value })}
                    placeholder="Ex: diabetes tipo 2 diagnosticado em 2021, controlado com metformina…"
                    rows={2}
                    style={{ fontSize: '16px' }}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ── 2. Cirurgias e internações ── */}
          <AccordionItem value="cirurgias" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Scissors className="h-4 w-4 text-orange-500" />
                Cirurgias e internações
                {dados.cirurgias.items.filter(i => i.tipo.trim()).length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {dados.cirurgias.items.filter(i => i.tipo.trim()).length}
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              {dados.cirurgias.items.map((item, idx) => (
                <div key={item.id} className="border rounded-md p-3 space-y-2 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Cirurgia {idx + 1}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeCirurgia(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <Input
                        placeholder="Tipo de cirurgia (ex: ligamento do joelho)"
                        value={item.tipo}
                        onChange={e => setCirurgia(item.id, { tipo: e.target.value })}
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                    <Input
                      placeholder="Ano (ex: 2019)"
                      value={item.ano}
                      onChange={e => setCirurgia(item.id, { ano: e.target.value })}
                      style={{ fontSize: '16px' }}
                    />
                    <Input
                      placeholder="Complicações (se houver)"
                      value={item.complicacoes}
                      onChange={e => setCirurgia(item.id, { complicacoes: e.target.value })}
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-2 w-full" onClick={addCirurgia}>
                <Plus className="h-3.5 w-3.5" /> Adicionar cirurgia ou internação
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* ── 3. Medicamentos em uso ── */}
          <AccordionItem value="medicamentos" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Pill className="h-4 w-4 text-blue-500" />
                Medicamentos em uso
                {dados.medicamentos.items.filter(m => m.nome.trim()).length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {dados.medicamentos.items.filter(m => m.nome.trim()).length}
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              {dados.medicamentos.items.map((item, idx) => (
                <div key={item.id} className="border rounded-md p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Medicamento {idx + 1}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeMed(item.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <Input
                      placeholder="Nome do medicamento (ex: levotiroxina)"
                      value={item.nome}
                      onChange={e => setMed(item.id, { nome: e.target.value })}
                      style={{ fontSize: '16px' }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Dose (ex: 50mcg)"
                        value={item.dose}
                        onChange={e => setMed(item.id, { dose: e.target.value })}
                        style={{ fontSize: '16px' }}
                      />
                      <Input
                        placeholder="Frequência (ex: 1x ao dia)"
                        value={item.frequencia}
                        onChange={e => setMed(item.id, { frequencia: e.target.value })}
                        style={{ fontSize: '16px' }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" className="gap-2 w-full" onClick={addMed}>
                <Plus className="h-3.5 w-3.5" /> Adicionar medicamento
              </Button>
            </AccordionContent>
          </AccordionItem>

          {/* ── 4. Alergias ── */}
          <AccordionItem value="alergias" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Alergias
                {[dados.alergias.medicamentos, dados.alergias.alimentos, dados.alergias.outros].some(Boolean) && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">✓</Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Alergias a medicamentos</Label>
                <Input
                  placeholder="Ex: dipirona, penicilina…"
                  value={dados.alergias.medicamentos}
                  onChange={e => setAlergias({ medicamentos: e.target.value })}
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Alergias a alimentos</Label>
                <Input
                  placeholder="Ex: amendoim, glúten…"
                  value={dados.alergias.alimentos}
                  onChange={e => setAlergias({ alimentos: e.target.value })}
                  style={{ fontSize: '16px' }}
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Outras alergias</Label>
                <Input
                  placeholder="Ex: látex, pólen, poeira…"
                  value={dados.alergias.outros}
                  onChange={e => setAlergias({ outros: e.target.value })}
                  style={{ fontSize: '16px' }}
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* ── 5. Saúde mental ── */}
          <AccordionItem value="saude_mental" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Brain className="h-4 w-4 text-purple-500" />
                Saúde mental
                {dados.saude_mental.condicoes.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {dados.saude_mental.condicoes.length}
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              <CheckboxGroup
                opcoes={SAUDE_MENTAL_OPCOES}
                selecionadas={dados.saude_mental.condicoes}
                onChange={condicoes => setSaudeMental({ condicoes })}
              />
              {dados.saude_mental.condicoes.length > 0 && (
                <>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="diagnostico_formal"
                      checked={dados.saude_mental.diagnostico_formal}
                      onCheckedChange={(v) => setSaudeMental({ diagnostico_formal: !!v })}
                    />
                    <Label htmlFor="diagnostico_formal" className="text-sm cursor-pointer">
                      Tenho diagnóstico formal
                    </Label>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Detalhes adicionais (opcional)</Label>
                    <Textarea
                      value={dados.saude_mental.detalhes}
                      onChange={e => setSaudeMental({ detalhes: e.target.value })}
                      placeholder="Ex: ansiedade generalizada, em acompanhamento psicológico desde 2022…"
                      rows={2}
                      style={{ fontSize: '16px' }}
                    />
                  </div>
                </>
              )}
            </AccordionContent>
          </AccordionItem>

          {/* ── 6. Histórico familiar ── */}
          <AccordionItem value="historico_familiar" className="border rounded-lg px-4">
            <AccordionTrigger className="py-3 hover:no-underline">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <Users className="h-4 w-4 text-emerald-500" />
                Histórico familiar
                {dados.historico_familiar.condicoes.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                    {dados.historico_familiar.condicoes.length}
                  </Badge>
                )}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-4 space-y-3">
              <CheckboxGroup
                opcoes={HIST_FAMILIAR_OPCOES}
                selecionadas={dados.historico_familiar.condicoes}
                onChange={condicoes => setFamiliar({ condicoes })}
              />
              {dados.historico_familiar.condicoes.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Detalhes adicionais (opcional)</Label>
                  <Textarea
                    value={dados.historico_familiar.detalhes}
                    onChange={e => setFamiliar({ detalhes: e.target.value })}
                    placeholder="Ex: pai com infarto aos 55 anos, avó materna com câncer de mama…"
                    rows={2}
                    style={{ fontSize: '16px' }}
                  />
                </div>
              )}
            </AccordionContent>
          </AccordionItem>

        </Accordion>

        {/* ── Enviar ao profissional ── */}
        <div className="pt-4 space-y-2 flex flex-col items-center">
          <Button
            onClick={enviar}
            disabled={enviando || !temConteudo}
            className="w-full sm:w-auto gap-2"
            size="lg"
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {enviando ? 'Enviando…' : 'Enviar para meu profissional'}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center max-w-xs">
            {!temConteudo
              ? 'Preencha pelo menos uma seção para enviar.'
              : 'Seu profissional recebe uma lista para revisar e adicionar ao seu Avatar Clínico.'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
