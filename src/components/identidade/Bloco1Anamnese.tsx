import { useState, useCallback } from 'react';
import { Bloco1Data, Bloco2Data, RegiaoDor } from '@/types/identidade';
import { calcularScoreF, calcularScoreD, getSeverityColorHex } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronRight, AlertCircle, Info, Mic, MicOff, MapPin, Eraser, X } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { BodyAvatarSVG, REGIOES_CORPO } from './BodyAvatarSVG';
import { cn } from '@/lib/utils';

const COMORBIDADES = [
  'Diabetes', 'Hipertensão', 'Artrite', 'Fibromialgia', 'Cirurgias prévias',
  'Fraturas', 'Osteoporose', 'Depressão/Ansiedade', 'Doença cardíaca', 'Doença pulmonar',
];

const TIPOS_DOR = ['Ardor', 'Queimação', 'Dormência', 'Rigidez', 'Peso/Pressão', 'Pontada', 'Dor profunda'];
const FREQUENCIAS = ['Contínua (24h)', 'Intermitente', 'Noturna (afeta sono)', 'Ao movimento específico'];
const FATORES_PIORA = ['Movimento específico', 'Posição prolongada', 'Clima/umidade', 'Stress/emocional', 'Menstruação', 'Atividade ocupacional', 'Fadiga', 'Sono inadequado'];
const FATORES_MELHORA = ['Repouso', 'Movimento', 'Calor/frio', 'Medicação', 'Fisioterapia', 'Alongamento', 'Outro'];

type SintomaTipo = 'dor' | 'irradiacao' | 'rigidez' | 'formigamento' | 'inchaco' | 'queimacao';

const SINTOMA_CONFIG: Record<SintomaTipo, { label: string; cor: string; descricao: string }> = {
  dor:          { label: 'Dor',           cor: '#C41E3A', descricao: 'Dor localizada' },
  irradiacao:   { label: 'Irradiação',    cor: '#F97316', descricao: 'Dor que se irradia' },
  rigidez:      { label: 'Rigidez/Tensão', cor: '#3B82F6', descricao: 'Tensão muscular' },
  formigamento: { label: 'Formigamento',  cor: '#FBBF24', descricao: 'Parestesia' },
  inchaco:      { label: 'Inchaço',       cor: '#10B981', descricao: 'Edema local' },
  queimacao:    { label: 'Queimação',     cor: '#DC2626', descricao: 'Sensação de queima' },
};

interface RegiaoExtendida extends RegiaoDor {
  sintomas: SintomaTipo[];
  observacaoPaciente?: string;
}

interface Props {
  data: Bloco1Data;
  bloco2Data: Bloco2Data;
  onChange: (data: Bloco1Data) => void;
  onBloco2Change: (data: Bloco2Data) => void;
  onNext: () => void;
}

export default function Bloco1Anamnese({ data, bloco2Data, onChange, onBloco2Change, onNext }: Props) {
  const [localData, setLocalData] = useState<Bloco1Data>(data);
  const { isListening, startListening, stopListening, isSupported } = useSpeechToText();

  // ── Body mapping state (visual only — does NOT affect Score D) ──
  const [regioes, setRegioes] = useState<RegiaoExtendida[]>(
    bloco2Data.regioes.map(r => ({ ...r, sintomas: (r as RegiaoExtendida).sintomas || ['dor'], observacaoPaciente: (r as any).observacaoPaciente || '' }))
  );
  const [modalRegiao, setModalRegiao] = useState<string | null>(null);
  const [sintomaAtivo, setSintomaAtivo] = useState<SintomaTipo>('dor');
  const [observacaoGeral, setObservacaoGeral] = useState((bloco2Data as any).observacaoGeral || '');

  const update = (field: keyof Bloco1Data, value: any) => {
    const updated = { ...localData, [field]: value };
    updated.scoreF = calcularScoreF(updated);
    setLocalData(updated);
    onChange(updated);
  };

  const toggleComorbidade = (item: string) => {
    const updated = localData.historicoMedico.includes(item)
      ? localData.historicoMedico.filter(i => i !== item)
      : [...localData.historicoMedico, item];
    update('historicoMedico', updated);
  };

  // ── Body mapping handlers (symptom markings are visual-only) ──
  const getRegiaoDor = (id: string): RegiaoExtendida => {
    return regioes.find(r => r.id === id) || {
      id, nome: REGIOES_CORPO.find(r => r.id === id)?.nome || id,
      intensidade: 5, tipos: [], irradiacao: false, irradiacaoPara: [],
      frequencia: 'Intermitente', fatoresPiora: [], fatoresMelhora: [],
      sintomas: [sintomaAtivo], observacaoPaciente: '',
    };
  };

  const syncBloco2 = useCallback((newRegioes: RegiaoExtendida[]) => {
    // Score D is calculated from pain data (intensity, type, frequency, etc.)
    // Symptom markings (sintomas array) are VISUAL ONLY for the dashboard
    const scoreD = calcularScoreD({ regioes: newRegioes, scoreD: 0 });
    onBloco2Change({ regioes: newRegioes, scoreD, observacaoGeral } as any);
  }, [onBloco2Change, observacaoGeral]);

  const updateRegiao = useCallback((id: string, updater: (r: RegiaoExtendida) => RegiaoExtendida) => {
    setRegioes(prev => {
      const existing = prev.find(r => r.id === id);
      const base = existing || getRegiaoDor(id);
      const updated = updater(base);
      const newRegioes = existing ? prev.map(r => r.id === id ? updated : r) : [...prev, updated];
      syncBloco2(newRegioes);
      return newRegioes;
    });
  }, [syncBloco2]);

  const handleRegionClick = (regionId: string) => {
    const existing = regioes.find(r => r.id === regionId);
    if (existing) {
      if (existing.sintomas?.includes(sintomaAtivo)) {
        setModalRegiao(regionId);
        return;
      }
      updateRegiao(regionId, r => ({ ...r, sintomas: [...(r.sintomas || []), sintomaAtivo] }));
    } else {
      updateRegiao(regionId, r => ({ ...r, sintomas: [sintomaAtivo] }));
      if (sintomaAtivo === 'dor') setTimeout(() => setModalRegiao(regionId), 50);
    }
  };

  const removeRegiao = (id: string) => {
    setRegioes(prev => {
      const newRegioes = prev.filter(r => r.id !== id);
      syncBloco2(newRegioes);
      return newRegioes;
    });
  };

  const removeSintoma = (regionId: string, sintoma: SintomaTipo) => {
    updateRegiao(regionId, r => {
      const novos = r.sintomas.filter(s => s !== sintoma);
      if (novos.length === 0) { setTimeout(() => removeRegiao(regionId), 0); return r; }
      return { ...r, sintomas: novos };
    });
  };

  const handleVoice = (field: 'queixaPrincipal' | 'observacaoGeral' | 'observacaoPaciente', regionId?: string) => {
    if (isListening) { stopListening(); return; }
    startListening((text) => {
      if (field === 'queixaPrincipal') update('queixaPrincipal', localData.queixaPrincipal + (localData.queixaPrincipal ? ' ' : '') + text);
      else if (field === 'observacaoGeral') setObservacaoGeral((prev: string) => prev + (prev ? ' ' : '') + text);
      else if (field === 'observacaoPaciente' && regionId) {
        updateRegiao(regionId, r => ({ ...r, observacaoPaciente: (r.observacaoPaciente || '') + (r.observacaoPaciente ? ' ' : '') + text }));
      }
    });
  };

  const scoreF = calcularScoreF(localData);
  const scoreD = calcularScoreD({ regioes, scoreD: 0 });
  const modalRegiaoDor = modalRegiao ? getRegiaoDor(modalRegiao) : null;

  // Build maps for avatar
  const painMap: Record<string, number> = {};
  const sintomaMap: Record<string, string[]> = {};
  regioes.forEach(r => {
    sintomaMap[r.id] = r.sintomas || [];
    if (r.sintomas?.includes('dor') || r.sintomas?.includes('queimacao')) painMap[r.id] = r.intensidade;
    else if (r.sintomas?.length > 0) painMap[r.id] = Math.min(r.intensidade * 0.5, 4);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 1</Badge>
              <span className="text-xs text-muted-foreground">~15 min</span>
            </div>
            <h2 className="text-xl font-bold">Anamnese e Mapeamento da Dor</h2>
            <p className="text-muted-foreground text-sm mt-1">Contexto clínico + marcação dos sintomas pelo paciente</p>
          </div>
          <div className="flex gap-4 text-right">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Score F</div>
              <div className="text-2xl font-bold text-primary">{scoreF.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">/10</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Score D</div>
              <div className="text-2xl font-bold text-primary">{scoreD.toFixed(1)}</div>
              <div className="text-xs text-muted-foreground">/10</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ SEÇÃO 1: Queixa & Contexto ══════════ */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
          Queixa Principal & Contexto
        </h3>

        <div>
          <div className="flex items-center justify-between mb-1">
            <Label>Queixa principal <span className="text-destructive">*</span></Label>
            {isSupported && (
              <Button variant="ghost" size="sm" className={cn('h-7 gap-1 text-xs', isListening && 'text-destructive')}
                onClick={() => handleVoice('queixaPrincipal')}>
                {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                {isListening ? 'Parar' : 'Ditar'}
              </Button>
            )}
          </div>
          <Textarea placeholder="Descreva a queixa principal do paciente..." value={localData.queixaPrincipal}
            onChange={e => update('queixaPrincipal', e.target.value)} className="resize-none" rows={3} maxLength={500} />
          <div className="text-xs text-muted-foreground mt-1">{localData.queixaPrincipal.length}/500</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Duração dos sintomas</Label>
            <Select value={localData.duracao} onValueChange={v => update('duracao', v)}>
              <SelectTrigger className="mt-1.5"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="<2 semanas">&lt;2 semanas</SelectItem>
                <SelectItem value="2-4 semanas">2-4 semanas</SelectItem>
                <SelectItem value="1-3 meses">1-3 meses</SelectItem>
                <SelectItem value="3-6 meses">3-6 meses</SelectItem>
                <SelectItem value="6-12 meses">6-12 meses</SelectItem>
                <SelectItem value=">1 ano">&gt;1 ano</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Atividade física</Label>
            <Select value={localData.atividadeFisica} onValueChange={v => update('atividadeFisica', v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhuma">Nenhuma</SelectItem>
                <SelectItem value="leve">Leve (&lt;2×/sem)</SelectItem>
                <SelectItem value="moderada">Moderada (2-4×/sem)</SelectItem>
                <SelectItem value="intensa">Intensa (&gt;4×/sem)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox id="evento" checked={localData.eventoPrecipitante} onCheckedChange={v => update('eventoPrecipitante', !!v)} />
          <Label htmlFor="evento" className="cursor-pointer">Houve evento precipitante?</Label>
        </div>
        {localData.eventoPrecipitante && (
          <Input placeholder="Descreva o evento..." value={localData.eventoPrecipitanteDescricao}
            onChange={e => update('eventoPrecipitanteDescricao', e.target.value)} />
        )}

        <div>
          <Label>Profissão</Label>
          <Input placeholder="Ex: Contador, Motorista, Professora..." value={localData.profissao}
            onChange={e => update('profissao', e.target.value)} className="mt-1.5" />
        </div>

        <div>
          <Label>Horas em posição sedentária/dia: <strong>{localData.horasSedentario}h</strong></Label>
          <Slider value={[localData.horasSedentario]} min={0} max={16} step={1}
            onValueChange={([v]) => update('horasSedentario', v)} className="mt-2" />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0h (ativo)</span><span>16h (muito sedentário)</span>
          </div>
        </div>

        {/* Hábitos */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t">
          <div>
            <Label className="mb-2 block">Tabagismo</Label>
            <div className="flex items-center gap-3">
              <Checkbox id="tabagismo" checked={localData.tabagismo} onCheckedChange={v => update('tabagismo', !!v)} />
              <Label htmlFor="tabagismo" className="cursor-pointer text-sm">Fumante ativo</Label>
            </div>
          </div>
          <div>
            <Label>Consumo de álcool</Label>
            <Select value={localData.alcool} onValueChange={v => update('alcool', v)}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                <SelectItem value="ocasional">Ocasional (&lt;1×/sem)</SelectItem>
                <SelectItem value="moderado">Moderado (1-3×/sem)</SelectItem>
                <SelectItem value="frequente">Frequente (&gt;3×/sem)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Ingestão de água/dia: <strong>{localData.litrosAgua ?? 2}L</strong></Label>
            <Slider value={[localData.litrosAgua ?? 2]} min={0} max={5} step={0.5}
              onValueChange={([v]) => update('litrosAgua', v)} className="mt-2" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0L</span><span>5L+</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ SEÇÃO 2: Histórico Médico ══════════ */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
          Histórico Médico
        </h3>
        <div>
          <Label>Comorbidades (selecione todas que se aplicam)</Label>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {COMORBIDADES.map(item => (
              <div key={item} className="flex items-center gap-2">
                <Checkbox id={item} checked={localData.historicoMedico.includes(item)} onCheckedChange={() => toggleComorbidade(item)} />
                <Label htmlFor={item} className="cursor-pointer text-sm">{item}</Label>
              </div>
            ))}
          </div>
          {localData.historicoMedico.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-3">
              {localData.historicoMedico.map(item => <Badge key={item} variant="secondary" className="text-xs">{item}</Badge>)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Checkbox id="familiarH" checked={localData.historicoFamiliar} onCheckedChange={v => update('historicoFamiliar', !!v)} />
          <Label htmlFor="familiarH" className="cursor-pointer">Histórico familiar relevante?</Label>
        </div>
        {localData.historicoFamiliar && (
          <Input placeholder="Qual condição familiar?" value={localData.historicoFamiliarDescricao}
            onChange={e => update('historicoFamiliarDescricao', e.target.value)} />
        )}
      </div>

      {/* ══════════ SEÇÃO 3: Escalas Likert ══════════ */}
      <div className="clinical-card space-y-6">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</span>
          Questões de Gravidade
        </h3>
        {[
          { key: 'impactoQualidadeVida', label: 'Impacto na qualidade de vida?', l: 'Nenhum', r: 'Total' },
          { key: 'interferenciaTrbalho', label: 'Interferência no trabalho?', l: 'Nenhuma', r: 'Impossível trabalhar' },
          { key: 'quantidadeComorbidades', label: 'Quantidade de comorbidades (0-5+)?', l: '0 (nenhuma)', r: '5+ comorbidades' },
          { key: 'historicoFamiliarPeso', label: 'Peso do histórico familiar?', l: 'Sem relevância', r: 'Muito relevante' },
        ].map(({ key, label, l, r }) => (
          <div key={key}>
            <div className="flex justify-between items-center mb-2">
              <Label className="text-sm">{label}</Label>
              <span className="text-lg font-bold text-primary">{(localData as any)[key]}/10</span>
            </div>
            <Slider value={[(localData as any)[key]]} min={0} max={10} step={1}
              onValueChange={([v]) => update(key as keyof Bloco1Data, v)} />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{l}</span><span>{r}</span>
            </div>
          </div>
        ))}
        {localData.duracao && ['6-12 meses', '>1 ano'].includes(localData.duracao) && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />
            <p className="text-xs text-warning-foreground">Dor crônica identificada – bônus +2 aplicado ao Score F</p>
          </div>
        )}
      </div>

      {/* ══════════ SEÇÃO 4: Mapeamento Corporal (paciente) ══════════ */}
      <div className="clinical-card">
        <h3 className="font-semibold flex items-center gap-2 mb-3">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">4</span>
          Mapeamento Corporal — Sintomas do Paciente
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Selecione um sintoma abaixo e clique nas regiões do corpo. O nível de dor é escolhido pelo paciente.
          <br />
          <strong>Nota:</strong> Estas marcações são visuais para o dashboard — não alteram o Score D.
        </p>

        {/* Symptom palette */}
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.entries(SINTOMA_CONFIG) as [SintomaTipo, typeof SINTOMA_CONFIG[SintomaTipo]][]).map(([key, cfg]) => (
            <button key={key} onClick={() => setSintomaAtivo(key)}
              className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                sintomaAtivo === key ? 'shadow-md scale-105 ring-2 ring-offset-1' : 'border-border hover:border-foreground/40 opacity-60 hover:opacity-100'
              )}
              style={{ borderColor: sintomaAtivo === key ? cfg.cor : undefined, backgroundColor: sintomaAtivo === key ? cfg.cor + '15' : undefined }}>
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cfg.cor }} />
              <span>{cfg.label}</span>
            </button>
          ))}
          {regioes.length > 0 && (
            <button onClick={() => { setRegioes([]); syncBloco2([]); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-destructive/40 text-sm text-destructive/70 hover:text-destructive hover:border-destructive hover:bg-destructive/5 transition-all">
              <Eraser className="icon-sm" /> Limpar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
          <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: SINTOMA_CONFIG[sintomaAtivo].cor }} />
          <span>Ativo: <strong style={{ color: SINTOMA_CONFIG[sintomaAtivo].cor }}>{SINTOMA_CONFIG[sintomaAtivo].label}</strong> — clique no avatar</span>
        </div>

        {/* Body avatar — front + back */}
        <BodyAvatarSVG mode="pain" painMap={painMap} sintomaMap={sintomaMap} onRegionClick={handleRegionClick} showBack={true} className="max-w-xl mx-auto" />
      </div>

      {/* Affected regions list */}
      {regioes.length > 0 && (
        <div className="clinical-card">
          <h3 className="font-semibold text-sm mb-4">Regiões Afetadas ({regioes.length})</h3>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {regioes.map(r => (
              <div key={r.id} className="p-3 rounded-lg border bg-card hover:bg-secondary/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{r.nome}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold" style={{ color: getSeverityColorHex(r.intensidade) }}>{r.intensidade}/10</span>
                    <button onClick={() => removeRegiao(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-2">
                  {r.sintomas?.map(s => (
                    <button key={s} onClick={() => removeSintoma(r.id, s)}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: SINTOMA_CONFIG[s]?.cor + '20', borderColor: SINTOMA_CONFIG[s]?.cor + '60', color: SINTOMA_CONFIG[s]?.cor }}>
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: SINTOMA_CONFIG[s]?.cor }} />
                      {SINTOMA_CONFIG[s]?.label}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
                {r.tipos.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.tipos.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                  </div>
                )}
                <button onClick={() => setModalRegiao(r.id)} className="text-xs text-primary mt-2 hover:underline block">
                  Editar detalhes →
                </button>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <div className="text-xs">
                <strong>Score D: {scoreD.toFixed(1)}/10</strong> · {regioes.length} regiões ·
                Intensidade média: {(regioes.reduce((s, r) => s + r.intensidade, 0) / regioes.length).toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Patient observation box */}
      <div className="clinical-card">
        <div className="flex items-center justify-between mb-2">
          <Label className="font-semibold text-sm">Observações do Paciente</Label>
          {isSupported && (
            <Button variant="outline" size="sm" className={cn('h-8 gap-1 text-xs', isListening && 'border-destructive text-destructive')}
              onClick={() => handleVoice('observacaoGeral')}>
              {isListening ? <MicOff className="icon-sm" /> : <Mic className="icon-sm" />}
              {isListening ? 'Parar' : 'Ditar'}
            </Button>
          )}
        </div>
        <Textarea placeholder="O paciente pode descrever aqui, com suas palavras, o que sente..."
          value={observacaoGeral} onChange={e => setObservacaoGeral(e.target.value)} rows={3} className="resize-none" />
        <p className="text-xs text-muted-foreground mt-1">
          {isSupported ? 'Use o botão Ditar para transcrever por voz' : 'Seu navegador não suporta reconhecimento de voz'}
        </p>
      </div>

      {/* Detail Modal for region */}
      <Dialog open={!!modalRegiao} onOpenChange={() => setModalRegiao(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{modalRegiao ? REGIOES_CORPO.find(r => r.id === modalRegiao)?.nome : ''}</DialogTitle>
          </DialogHeader>
          {modalRegiao && modalRegiaoDor && (
            <div className="space-y-5">
              {/* Symptom selection */}
              <div>
                <Label className="mb-2 block">Sintomas nesta região</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(SINTOMA_CONFIG) as [SintomaTipo, typeof SINTOMA_CONFIG[SintomaTipo]][]).map(([key, cfg]) => {
                    const active = modalRegiaoDor.sintomas?.includes(key);
                    return (
                      <button key={key} onClick={() => updateRegiao(modalRegiao, r => ({
                        ...r, sintomas: active ? (r.sintomas || []).filter(s => s !== key) : [...(r.sintomas || []), key],
                      }))} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all', active ? 'ring-2' : 'opacity-50 hover:opacity-80')}
                        style={{ borderColor: cfg.cor, backgroundColor: active ? cfg.cor + '20' : undefined, color: cfg.cor }}>
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.cor }} /> {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Intensity — patient chooses */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Intensidade da dor (paciente escolhe)</Label>
                  <span className="text-2xl font-bold" style={{ color: getSeverityColorHex(modalRegiaoDor.intensidade) }}>
                    {modalRegiaoDor.intensidade}/10
                  </span>
                </div>
                <Slider value={[modalRegiaoDor.intensidade]} min={0} max={10} step={1}
                  onValueChange={([v]) => updateRegiao(modalRegiao, r => ({ ...r, intensidade: v }))} />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>😊 Sem dor</span><span>😭 Dor máxima</span>
                </div>
              </div>

              {/* Pain type */}
              <div>
                <Label className="mb-2 block">Tipo(s) de dor</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_DOR.map(tipo => (
                    <div key={tipo} className="flex items-center gap-2">
                      <Checkbox id={tipo} checked={modalRegiaoDor.tipos.includes(tipo)}
                        onCheckedChange={c => updateRegiao(modalRegiao, r => ({
                          ...r, tipos: c ? [...r.tipos, tipo] : r.tipos.filter(t => t !== tipo)
                        }))} />
                      <Label htmlFor={tipo} className="text-sm cursor-pointer">{tipo}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frequency */}
              <div>
                <Label>Frequência</Label>
                <Select value={modalRegiaoDor.frequencia} onValueChange={v => updateRegiao(modalRegiao, r => ({ ...r, frequencia: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Irradiation */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Checkbox id="irradiacao" checked={modalRegiaoDor.irradiacao}
                    onCheckedChange={c => updateRegiao(modalRegiao, r => ({ ...r, irradiacao: !!c }))} />
                  <Label htmlFor="irradiacao" className="cursor-pointer">Apresenta irradiação?</Label>
                </div>
                {modalRegiaoDor.irradiacao && (
                  <div className="grid grid-cols-2 gap-2 ml-6">
                    {REGIOES_CORPO.filter(r => r.id !== modalRegiao).map(r => (
                      <div key={r.id} className="flex items-center gap-2">
                        <Checkbox id={`irr-${r.id}`} checked={modalRegiaoDor.irradiacaoPara.includes(r.nome)}
                          onCheckedChange={c => updateRegiao(modalRegiao, reg => ({
                            ...reg, irradiacaoPara: c ? [...reg.irradiacaoPara, r.nome] : reg.irradiacaoPara.filter(i => i !== r.nome)
                          }))} />
                        <Label htmlFor={`irr-${r.id}`} className="text-xs cursor-pointer">{r.nome}</Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Aggravating / Relieving factors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block text-xs font-semibold text-destructive">Fatores de PIORA</Label>
                  <div className="space-y-1.5">
                    {FATORES_PIORA.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <Checkbox id={`piora-${f}`} checked={modalRegiaoDor.fatoresPiora.includes(f)}
                          onCheckedChange={c => updateRegiao(modalRegiao, r => ({
                            ...r, fatoresPiora: c ? [...r.fatoresPiora, f] : r.fatoresPiora.filter(i => i !== f)
                          }))} />
                        <Label htmlFor={`piora-${f}`} className="text-xs cursor-pointer">{f}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block text-xs font-semibold text-success">Fatores de MELHORA</Label>
                  <div className="space-y-1.5">
                    {FATORES_MELHORA.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <Checkbox id={`melhora-${f}`} checked={modalRegiaoDor.fatoresMelhora.includes(f)}
                          onCheckedChange={c => updateRegiao(modalRegiao, r => ({
                            ...r, fatoresMelhora: c ? [...r.fatoresMelhora, f] : r.fatoresMelhora.filter(i => i !== f)
                          }))} />
                        <Label htmlFor={`melhora-${f}`} className="text-xs cursor-pointer">{f}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Per-region observation with voice */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">Observação do paciente</Label>
                  {isSupported && (
                    <Button variant="ghost" size="sm" className={cn('h-7 gap-1 text-xs', isListening && 'text-destructive')}
                      onClick={() => handleVoice('observacaoPaciente', modalRegiao)}>
                      {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                      {isListening ? 'Parar' : 'Ditar'}
                    </Button>
                  )}
                </div>
                <Textarea placeholder="Descreva o que sente nesta região..." value={modalRegiaoDor.observacaoPaciente || ''}
                  onChange={e => updateRegiao(modalRegiao, r => ({ ...r, observacaoPaciente: e.target.value }))} rows={2} className="resize-none text-sm" />
              </div>

              <Button className="w-full bg-gradient-primary text-white" onClick={() => setModalRegiao(null)}>
                Salvar região ✓
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Score preview + Next */}
      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">
              Score F: <strong className="text-primary">{scoreF.toFixed(1)}/10</strong>
              {regioes.length > 0 && <> · Score D: <strong className="text-primary">{scoreD.toFixed(1)}/10</strong></>}
            </span>
          </div>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Funcionalidade
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
