import { useState } from 'react';
import { UnidadeCobZero } from '@/types/cobzero';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ChevronRight, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { getSeverityColorHex } from '@/utils/calculations';

const UNIDADES_CONFIG = [
  { id: 'UC1', nome: 'UC1 – Cabeça & Pescoço', emoji: '🧠', checklist: ['Rigidez cervical','Cefaleia','ROM restrito >20%','Dor à palpação'] },
  { id: 'UC2', nome: 'UC2 – Coluna Torácica', emoji: '🫁', checklist: ['Cifose excessiva','ROM restrito >30%','Dor interescapular','Hipomobilidade costal'] },
  { id: 'UC3', nome: 'UC3 – Coluna Lombar', emoji: '💪', checklist: ['Hiperlordose','ROM restrito >30%','Fraqueza abdominal','Instabilidade lombar'] },
  { id: 'UC4', nome: 'UC4 – Sacro-Pélvica', emoji: '⚖️', checklist: ['Assimetria pélvica','Restrição sacroilíaca','Dor SI'] },
  { id: 'UA-D', nome: 'UA-D – MMSS Direito', emoji: '🙌', checklist: ['ROM restrito','Assimetria escapular','Dor'] },
  { id: 'UA-E', nome: 'UA-E – MMSS Esquerdo', emoji: '🙌', checklist: ['ROM restrito','Assimetria escapular','Dor'] },
  { id: 'ID', nome: 'ID – MMII Direito', emoji: '🦵', checklist: ['ROM restrito','Fraqueza','Limitação marcha'] },
  { id: 'DD', nome: 'DD – MMII Esquerdo', emoji: '🦵', checklist: ['ROM restrito','Fraqueza','Limitação marcha'] },
];

interface Props {
  unidades: UnidadeCobZero[];
  onChange: (unidades: UnidadeCobZero[], scoreE: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function CobEtapaUnidades({ unidades: initialUnidades, onChange, onNext, onBack }: Props) {
  const [unidades, setUnidades] = useState<UnidadeCobZero[]>(() =>
    UNIDADES_CONFIG.map(uc => {
      const ex = initialUnidades.find(u => u.id === uc.id);
      return ex || { id: uc.id, nome: uc.nome, score: 0, checklist: Object.fromEntries(uc.checklist.map(k => [k, false])), observacoes: '' };
    })
  );
  const [expanded, setExpanded] = useState<string | null>('UC2');

  const updateUnidade = (id: string, updater: (u: UnidadeCobZero) => UnidadeCobZero) => {
    const newU = unidades.map(u => u.id === id ? updater(u) : u);
    setUnidades(newU);
    const scoreE = newU.reduce((a, u) => a + u.score, 0);
    onChange(newU, scoreE);
  };

  const scoreE = unidades.reduce((a, u) => a + u.score, 0);

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <Badge variant="outline" className="text-xs mb-1">Etapa 4</Badge>
        <h2 className="text-xl font-bold">Mapeamento das 8 Unidades Corporais</h2>
        <p className="text-muted-foreground text-sm mt-1">Score E total: <strong className="text-primary">{scoreE.toFixed(1)}/80</strong></p>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-2">
        {unidades.map(u => (
          <button key={u.id} onClick={() => setExpanded(expanded === u.id ? null : u.id)}
            className={`p-3 rounded-xl border-2 text-center transition-all ${expanded === u.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
            <div className="text-lg">{UNIDADES_CONFIG.find(c => c.id === u.id)?.emoji}</div>
            <div className="text-xs font-medium">{u.id}</div>
            <div className="text-lg font-bold" style={{ color: getSeverityColorHex(u.score) }}>{u.score.toFixed(1)}</div>
          </button>
        ))}
      </div>

      {unidades.map(u => {
        const config = UNIDADES_CONFIG.find(c => c.id === u.id)!;
        const isExpanded = expanded === u.id;
        return (
          <div key={u.id} className={`clinical-card border-2 ${isExpanded ? 'border-primary' : 'border-border'}`}>
            <button className="w-full flex items-center justify-between" onClick={() => setExpanded(isExpanded ? null : u.id)}>
              <div className="flex items-center gap-3">
                <span className="text-xl">{config.emoji}</span>
                <span className="font-semibold text-sm">{u.nome}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xl font-bold" style={{ color: getSeverityColorHex(u.score) }}>{u.score.toFixed(1)}/10</span>
                {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
            {isExpanded && (
              <div className="mt-4 pt-4 border-t space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <Label>Score de comprometimento</Label>
                    <span className="font-bold" style={{ color: getSeverityColorHex(u.score) }}>{u.score.toFixed(1)}/10</span>
                  </div>
                  <Slider value={[u.score]} min={0} max={10} step={0.5}
                    onValueChange={([v]) => updateUnidade(u.id, uu => ({ ...uu, score: v }))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {config.checklist.map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <Checkbox id={`${u.id}-${item}`} checked={u.checklist[item] || false}
                        onCheckedChange={c => updateUnidade(u.id, uu => ({ ...uu, checklist: { ...uu.checklist, [item]: !!c } }))} />
                      <Label htmlFor={`${u.id}-${item}`} className="text-sm cursor-pointer">{item}</Label>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={onNext} className="bg-primary text-primary-foreground shadow-primary">
            Próximo: Plano Terapêutico <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
