import { useState, useCallback } from 'react';
import { Bloco2Data, RegiaoDor } from '@/types/identidade';
import { calcularScoreD, getSeverityColorHex } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, ChevronLeft, X, MapPin, Info, Eraser, Mic, MicOff } from 'lucide-react';
import { BodyAvatarSVG, REGIOES_CORPO } from './BodyAvatarSVG';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { cn } from '@/lib/utils';

const TIPOS_DOR = ['Ardor', 'Queimação', 'Dormência', 'Rigidez', 'Peso/Pressão', 'Pontada', 'Dor profunda'];
const FREQUENCIAS = ['Contínua (24h)', 'Intermitente', 'Noturna (afeta sono)', 'Ao movimento específico'];
const FATORES_PIORA = ['Movimento específico', 'Posição prolongada', 'Clima/umidade', 'Stress/emocional', 'Menstruação', 'Atividade ocupacional', 'Fadiga', 'Sono inadequado'];
const FATORES_MELHORA = ['Repouso', 'Movimento', 'Calor/frio', 'Medicação', 'Fisioterapia', 'Alongamento', 'Outro'];

// ─── Symptom types ────────────────────────────────────────────────
type SintomaTipo = 'dor' | 'irradiacao' | 'rigidez' | 'formigamento' | 'inchaco' | 'queimacao';

const SINTOMA_CONFIG: Record<SintomaTipo, {
  label: string; emoji: string; cor: string; descricao: string;
}> = {
  dor:         { label: 'Dor',               emoji: '🔴', cor: '#C41E3A', descricao: 'Dor localizada' },
  irradiacao:  { label: 'Irradiação',         emoji: '➡️', cor: '#F97316', descricao: 'Dor que se irradia' },
  rigidez:     { label: 'Rigidez/Tensão',     emoji: '🔷', cor: '#3B82F6', descricao: 'Tensão muscular' },
  formigamento:{ label: 'Formigamento',        emoji: '✨', cor: '#FBBF24', descricao: 'Parestesia' },
  inchaco:     { label: 'Inchaço',            emoji: '🌊', cor: '#10B981', descricao: 'Edema local' },
  queimacao:   { label: 'Queimação',          emoji: '🔥', cor: '#DC2626', descricao: 'Sensação de queima' },
};

interface RegiaoExtendida extends RegiaoDor {
  sintomas: SintomaTipo[];
  observacaoPaciente?: string;
}

interface Props {
  data: Bloco2Data;
  onChange: (data: Bloco2Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Bloco2Dor({ data, onChange, onNext, onBack }: Props) {
  const [regioes, setRegioes] = useState<RegiaoExtendida[]>(
    data.regioes.map(r => ({ ...r, sintomas: (r as RegiaoExtendida).sintomas || ['dor'], observacaoPaciente: (r as any).observacaoPaciente || '' }))
  );
  const [modalRegiao, setModalRegiao] = useState<string | null>(null);
  const [sintomaAtivo, setSintomaAtivo] = useState<SintomaTipo>('dor');
  const [observacaoGeral, setObservacaoGeral] = useState((data as any).observacaoGeral || '');
  const { isListening, startListening, stopListening, isSupported } = useSpeechToText();

  const getRegiaoDor = (id: string): RegiaoExtendida => {
    return regioes.find(r => r.id === id) || {
      id, nome: REGIOES_CORPO.find(r => r.id === id)?.nome || id,
      intensidade: 5, tipos: [], irradiacao: false, irradiacaoPara: [],
      frequencia: 'Intermitente', fatoresPiora: [], fatoresMelhora: [],
      sintomas: [sintomaAtivo], observacaoPaciente: '',
    };
  };

  const updateRegiao = useCallback((id: string, updater: (r: RegiaoExtendida) => RegiaoExtendida) => {
    setRegioes(prev => {
      const existing = prev.find(r => r.id === id);
      const base = existing || getRegiaoDor(id);
      const updated = updater(base);
      const newRegioes = existing ? prev.map(r => r.id === id ? updated : r) : [...prev, updated];
      const scoreD = calcularScoreD({ regioes: newRegioes, scoreD: 0 });
      onChange({ regioes: newRegioes, scoreD });
      return newRegioes;
    });
  }, [sintomaAtivo]);

  const handleRegionClick = (regionId: string) => {
    const existing = regioes.find(r => r.id === regionId);
    if (existing) {
      if (existing.sintomas?.includes(sintomaAtivo)) {
        setModalRegiao(regionId);
        return;
      }
      updateRegiao(regionId, r => ({
        ...r,
        sintomas: [...(r.sintomas || []), sintomaAtivo],
      }));
    } else {
      updateRegiao(regionId, r => ({ ...r, sintomas: [sintomaAtivo] }));
      if (sintomaAtivo === 'dor') {
        setTimeout(() => setModalRegiao(regionId), 50);
      }
    }
  };

  const removeRegiao = (id: string) => {
    setRegioes(prev => {
      const newRegioes = prev.filter(r => r.id !== id);
      const scoreD = calcularScoreD({ regioes: newRegioes, scoreD: 0 });
      onChange({ regioes: newRegioes, scoreD });
      return newRegioes;
    });
  };

  const removeSintoma = (regionId: string, sintoma: SintomaTipo) => {
    updateRegiao(regionId, r => {
      const novos = r.sintomas.filter(s => s !== sintoma);
      if (novos.length === 0) {
        setTimeout(() => removeRegiao(regionId), 0);
        return r;
      }
      return { ...r, sintomas: novos };
    });
  };

  const scoreD = calcularScoreD({ regioes, scoreD: 0 });
  const modalRegiaoDor = modalRegiao ? getRegiaoDor(modalRegiao) : null;

  // Build maps for avatar
  const painMap: Record<string, number> = {};
  const sintomaMap: Record<string, string[]> = {};
  regioes.forEach(r => {
    sintomaMap[r.id] = r.sintomas || [];
    if (r.sintomas?.includes('dor') || r.sintomas?.includes('queimacao')) {
      painMap[r.id] = r.intensidade;
    } else if (r.sintomas?.length > 0) {
      painMap[r.id] = Math.min(r.intensidade * 0.5, 4);
    }
  });

  const handleVoice = (field: 'observacaoGeral' | 'observacaoPaciente', regionId?: string) => {
    if (isListening) {
      stopListening();
      return;
    }
    startListening((text) => {
      if (field === 'observacaoGeral') {
        setObservacaoGeral(prev => prev + (prev ? ' ' : '') + text);
      } else if (field === 'observacaoPaciente' && regionId) {
        updateRegiao(regionId, r => ({
          ...r,
          observacaoPaciente: (r.observacaoPaciente || '') + (r.observacaoPaciente ? ' ' : '') + text,
        }));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 2</Badge>
              <span className="text-xs text-muted-foreground">~12 min</span>
            </div>
            <h2 className="text-xl font-bold">Mapeamento Corporal</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Selecione um sintoma e clique nas regiões do corpo (frente e costas)
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score D</div>
            <div className="text-3xl font-bold text-primary">{scoreD.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
        </div>
      </div>

      {/* Symptom Palette — single place to select active tool */}
      <div className="clinical-card">
        <div className="flex items-center gap-2 mb-3">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Selecione o Sintoma</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {(Object.entries(SINTOMA_CONFIG) as [SintomaTipo, typeof SINTOMA_CONFIG[SintomaTipo]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setSintomaAtivo(key)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all',
                sintomaAtivo === key
                  ? 'shadow-md scale-105 ring-2 ring-offset-1'
                  : 'border-border hover:border-foreground/40 hover:scale-102 opacity-60 hover:opacity-100'
              )}
              style={{
                borderColor: sintomaAtivo === key ? cfg.cor : undefined,
                backgroundColor: sintomaAtivo === key ? cfg.cor + '15' : undefined,
              }}
            >
              <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cfg.cor }} />
              <span>{cfg.label}</span>
            </button>
          ))}
          {regioes.length > 0 && (
            <button
              onClick={() => { setRegioes([]); onChange({ regioes: [], scoreD: 0 }); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border-2 border-dashed border-destructive/40 text-sm text-destructive/70 hover:text-destructive hover:border-destructive hover:bg-destructive/5 transition-all"
            >
              <Eraser className="icon-sm" />
              Limpar
            </button>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: SINTOMA_CONFIG[sintomaAtivo].cor }} />
          <span>Ativo: <strong style={{ color: SINTOMA_CONFIG[sintomaAtivo].cor }}>{SINTOMA_CONFIG[sintomaAtivo].label}</strong> — clique no avatar para marcar</span>
        </div>
      </div>

      {/* Avatar FRONT + BACK side by side */}
      <div className="clinical-card">
        <h3 className="font-semibold text-sm mb-3">Avatar Corporal — Frente e Costas</h3>
        <BodyAvatarSVG
          mode="pain"
          painMap={painMap}
          sintomaMap={sintomaMap}
          onRegionClick={handleRegionClick}
          showBack={true}
          className="max-w-lg mx-auto"
        />
      </div>

      {/* Affected regions list */}
      <div className="clinical-card">
        <h3 className="font-semibold text-sm mb-4">Regiões Afetadas ({regioes.length})</h3>
        {regioes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <MapPin className="h-8 w-8 mb-2 opacity-30" />
            <p className="text-sm">Nenhuma região marcada</p>
            <p className="text-xs mt-1">Selecione um sintoma acima e clique no avatar</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {regioes.map(r => (
              <div key={r.id} className="p-3 rounded-lg border bg-card hover:bg-secondary/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{r.nome}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold" style={{ color: getSeverityColorHex(r.intensidade) }}>
                      {r.intensidade}/10
                    </span>
                    <button onClick={() => removeRegiao(r.id)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {/* Symptom badges with colors */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {r.sintomas?.map(s => (
                    <button
                      key={s}
                      onClick={() => removeSintoma(r.id, s)}
                      className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border hover:opacity-80 transition-opacity"
                      style={{
                        backgroundColor: SINTOMA_CONFIG[s]?.cor + '20',
                        borderColor: SINTOMA_CONFIG[s]?.cor + '60',
                        color: SINTOMA_CONFIG[s]?.cor,
                      }}
                      title="Remover sintoma"
                    >
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: SINTOMA_CONFIG[s]?.cor }} />
                      {SINTOMA_CONFIG[s]?.label}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                  {r.irradiacao && <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">Irradia</Badge>}
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
        )}

        {regioes.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary shrink-0" />
              <div className="text-xs">
                <strong>Score D: {scoreD.toFixed(1)}/10</strong> · {regioes.length} regiões ·
                Intensidade média: {(regioes.reduce((s, r) => s + r.intensidade, 0) / regioes.length).toFixed(1)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Patient observation text box with voice */}
      <div className="clinical-card">
        <div className="flex items-center justify-between mb-2">
          <Label className="font-semibold text-sm">Observações do Paciente</Label>
          {isSupported && (
            <Button
              variant="outline"
              size="sm"
              className={cn('h-8 gap-1 text-xs', isListening && 'border-destructive text-destructive')}
              onClick={() => handleVoice('observacaoGeral')}
            >
              {isListening ? <MicOff className="icon-sm" /> : <Mic className="icon-sm" />}
              {isListening ? 'Parar' : 'Ditar'}
            </Button>
          )}
        </div>
        <Textarea
          placeholder="O paciente pode descrever aqui, com suas palavras, o que sente..."
          value={observacaoGeral}
          onChange={e => setObservacaoGeral(e.target.value)}
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1">
          {isSupported ? 'Use o botão Ditar para transcrever por voz' : 'Seu navegador não suporta reconhecimento de voz'}
        </p>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!modalRegiao} onOpenChange={() => setModalRegiao(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalRegiao ? REGIOES_CORPO.find(r => r.id === modalRegiao)?.nome : ''}
            </DialogTitle>
          </DialogHeader>
          {modalRegiao && modalRegiaoDor && (
            <div className="space-y-5">
              {/* Symptom selection IN the modal */}
              <div>
                <Label className="mb-2 block">Sintomas nesta região</Label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(SINTOMA_CONFIG) as [SintomaTipo, typeof SINTOMA_CONFIG[SintomaTipo]][]).map(([key, cfg]) => {
                    const active = modalRegiaoDor.sintomas?.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => updateRegiao(modalRegiao, r => ({
                          ...r,
                          sintomas: active
                            ? (r.sintomas || []).filter(s => s !== key)
                            : [...(r.sintomas || []), key],
                        }))}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all',
                          active ? 'ring-2' : 'opacity-50 hover:opacity-80'
                        )}
                        style={{
                          borderColor: cfg.cor,
                          backgroundColor: active ? cfg.cor + '20' : undefined,
                          color: cfg.cor,
                        }}
                      >
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cfg.cor }} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Intensidade */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Intensidade da dor (paciente escolhe)</Label>
                  <span className="text-2xl font-bold" style={{ color: getSeverityColorHex(modalRegiaoDor.intensidade) }}>
                    {modalRegiaoDor.intensidade}/10
                  </span>
                </div>
                <Slider
                  value={[modalRegiaoDor.intensidade]}
                  min={0} max={10} step={1}
                  onValueChange={([v]) => updateRegiao(modalRegiao, r => ({ ...r, intensidade: v }))}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>😊 Sem dor</span><span>😭 Dor máxima</span>
                </div>
              </div>

              {/* Tipos */}
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

              {/* Frequência */}
              <div>
                <Label>Frequência</Label>
                <Select value={modalRegiaoDor.frequencia} onValueChange={v => updateRegiao(modalRegiao, r => ({ ...r, frequencia: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Irradiação */}
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
                        <Checkbox id={`irr-${r.id}`}
                          checked={modalRegiaoDor.irradiacaoPara.includes(r.nome)}
                          onCheckedChange={c => updateRegiao(modalRegiao, reg => ({
                            ...reg, irradiacaoPara: c ? [...reg.irradiacaoPara, r.nome] : reg.irradiacaoPara.filter(i => i !== r.nome)
                          }))} />
                        <Label htmlFor={`irr-${r.id}`} className="text-xs cursor-pointer">{r.nome}</Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fatores */}
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

              {/* Observation per region with voice */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-sm">Observação do paciente</Label>
                  {isSupported && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn('h-7 gap-1 text-xs', isListening && 'text-destructive')}
                      onClick={() => handleVoice('observacaoPaciente', modalRegiao)}
                    >
                      {isListening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
                      {isListening ? 'Parar' : 'Ditar'}
                    </Button>
                  )}
                </div>
                <Textarea
                  placeholder="Descreva o que sente nesta região..."
                  value={modalRegiaoDor.observacaoPaciente || ''}
                  onChange={e => updateRegiao(modalRegiao, r => ({ ...r, observacaoPaciente: e.target.value }))}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              <Button className="w-full bg-gradient-primary text-white" onClick={() => setModalRegiao(null)}>
                Salvar região ✓
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Navegação */}
      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <span className="text-sm text-muted-foreground">Score D: <strong className="text-primary">{scoreD.toFixed(1)}/10</strong></span>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Funcionalidade
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
