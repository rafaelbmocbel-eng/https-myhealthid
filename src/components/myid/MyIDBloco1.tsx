import { useRef, useState } from 'react';
import type { MyIDBloco1Data } from '@/types/myid';
import { MUDANCAS_RECENTES_OPTIONS } from '@/types/myid';
import { calcularScoreI } from '@/utils/myidCalculations';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Loader2, Mic, MicOff } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { cn } from '@/lib/utils';

interface Props {
  data: MyIDBloco1Data;
  onChange: (data: MyIDBloco1Data) => void;
  onNext: () => void;
}

export default function MyIDBloco1({ data, onChange, onNext }: Props) {
  const [localData, setLocalData] = useState<MyIDBloco1Data>(data);
  // O ditado chega depois de parar a gravação; o ref evita sobrescrever o que foi
  // marcado nesse meio-tempo com uma cópia antiga dos dados.
  const dataRef = useRef(localData);
  const { isListening, isTranscribing, startListening, stopListening, isSupported } = useSpeechToText();

  const update = (field: keyof MyIDBloco1Data, value: any) => {
    const updated = { ...dataRef.current, [field]: value };
    updated.scoreI = calcularScoreI(updated);
    dataRef.current = updated;
    setLocalData(updated);
    onChange(updated);
  };

  const toggleMudanca = (item: string) => {
    const current = localData.mudancasRecentes;
    if (item === 'Nenhuma mudança que eu note') {
      update('mudancasRecentes', current.includes(item) ? [] : [item]);
    } else {
      const filtered = current.filter(m => m !== 'Nenhuma mudança que eu note');
      update('mudancasRecentes',
        filtered.includes(item) ? filtered.filter(m => m !== item) : [...filtered, item]
      );
    }
  };

  const handleVoice = () => {
    if (!isSupported) {
      alert('A gravação de voz não é suportada neste navegador. Digite sua resposta ou tente pelo app ou pelo Chrome.');
      return;
    }
    if (isListening) { stopListening(); return; }
    startListening((text) => {
      const atual = dataRef.current.queixaPrincipal;
      update('queixaPrincipal', (atual + (atual ? ' ' : '') + text).slice(0, 500));
    });
  };

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 1</Badge>
              <span className="text-xs text-muted-foreground">~2 min</span>
            </div>
            <h2 className="text-xl font-bold">Identificação e Gatilhos</h2>
            <p className="text-muted-foreground text-sm mt-1">Queixa principal e mudanças recentes</p>
          </div>
        </div>
      </div>

      {/* 1.1 Queixa Principal */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
          Qual é sua queixa principal?
        </h3>
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <Label>Descreva com suas palavras <span className="text-destructive">*</span></Label>
            <Button
              type="button"
              variant={isListening ? 'destructive' : 'outline'}
              size="sm"
              className="h-8 gap-1.5 text-xs shrink-0"
              onClick={handleVoice}
              disabled={isTranscribing}
            >
              {isTranscribing
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : isListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              {isTranscribing ? 'Transcrevendo...' : isListening ? 'Parar gravação' : 'Ditar por voz'}
            </Button>
          </div>
          <Textarea
            placeholder="Ex: Dor nas costas ao acordar, dor no joelho ao correr, formigamento no braço..."
            value={localData.queixaPrincipal}
            onChange={e => update('queixaPrincipal', e.target.value)}
            className="resize-none" rows={3} maxLength={500}
          />
          <div className="text-xs text-muted-foreground mt-1">{localData.queixaPrincipal.length}/500</div>
        </div>
      </div>

      {/* 1.2 Mudanças recentes */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
          Nas últimas 4 semanas, houve alguma mudança?
        </h3>
        <div className="space-y-3">
          {MUDANCAS_RECENTES_OPTIONS.map(item => (
            <div key={item} className={cn(
              'flex items-center gap-3 p-3 rounded-lg border-2 transition-all cursor-pointer',
              localData.mudancasRecentes.includes(item)
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30'
            )} onClick={() => toggleMudanca(item)}>
              <Checkbox checked={localData.mudancasRecentes.includes(item)} onCheckedChange={() => toggleMudanca(item)} />
              <span className="text-sm">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 1.3 Quando começou */}
      <div className="clinical-card space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">3</span>
          Quando exatamente começou a dor?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Data aproximada</Label>
            <Input type="date" value={localData.dataInicioDor}
              onChange={e => update('dataInicioDor', e.target.value)} className="mt-1.5" />
          </div>
          <div>
            <Label>O que aconteceu?</Label>
            <Input placeholder="Ex: Levantei um peso, acordei assim..."
              value={localData.descricaoEvento}
              onChange={e => update('descricaoEvento', e.target.value)} className="mt-1.5" />
          </div>
        </div>
      </div>

      {/* Avançar */}
      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-end">
          <Button onClick={onNext} className="bg-primary text-primary-foreground shadow-primary">
            Próximo: Mapeamento da Dor
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
