import { useState } from 'react';
import type { MyIDBloco2Data, MyIDRegiaoDor } from '@/types/myid';
import { TIPOS_DOR_MYID, DEFAULT_RED_FLAGS } from '@/types/myid';
import { calcularScoreD_MyID, checkRedFlags } from '@/utils/myidCalculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ChevronLeft, AlertTriangle, MapPin, X } from 'lucide-react';
import { BodyAvatarSVG, REGIOES_CORPO } from '@/components/identidade/BodyAvatarSVG';
import { cn } from '@/lib/utils';

interface Props {
  data: MyIDBloco2Data;
  onChange: (data: MyIDBloco2Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function MyIDBloco2({ data, onChange, onNext, onBack }: Props) {
  const [regioes, setRegioes] = useState<MyIDRegiaoDor[]>(data.regioes);
  const [redFlags, setRedFlags] = useState(data.redFlags || { ...DEFAULT_RED_FLAGS });
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const syncData = (newRegioes: MyIDRegiaoDor[], newFlags = redFlags) => {
    const scoreD = calcularScoreD_MyID({ ...data, regioes: newRegioes });
    const { detected } = checkRedFlags(newFlags);
    onChange({ regioes: newRegioes, redFlags: newFlags, temRedFlag: detected, scoreD });
  };

  const handleRegionClick = (regionId: string) => {
    const existing = regioes.find(r => r.id === regionId);
    if (existing) {
      setSelectedRegion(regionId);
    } else {
      const nome = REGIOES_CORPO.find(r => r.id === regionId)?.nome || regionId;
      const newRegiao: MyIDRegiaoDor = {
        id: regionId, nome, tiposDor: [],
        intensidadeAtual: 5, intensidadeMaxima: 7, intensidadeMelhorDia: 3,
      };
      const updated = [...regioes, newRegiao];
      setRegioes(updated);
      syncData(updated);
      setSelectedRegion(regionId);
    }
  };

  const updateRegiao = (id: string, partial: Partial<MyIDRegiaoDor>) => {
    const updated = regioes.map(r => r.id === id ? { ...r, ...partial } : r);
    setRegioes(updated);
    syncData(updated);
  };

  const removeRegiao = (id: string) => {
    const updated = regioes.filter(r => r.id !== id);
    setRegioes(updated);
    syncData(updated);
    if (selectedRegion === id) setSelectedRegion(null);
  };

  const toggleRedFlag = (key: keyof typeof redFlags) => {
    const updated = { ...redFlags, [key]: !redFlags[key] };
    setRedFlags(updated);
    syncData(regioes, updated);
  };

  const { detected: hasRedFlags, alerts } = checkRedFlags(redFlags);
  const painMap: Record<string, number> = {};
  regioes.forEach(r => { painMap[r.id] = r.intensidadeAtual; });
  const sel = selectedRegion ? regioes.find(r => r.id === selectedRegion) : null;

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <Badge variant="outline" className="text-xs">Bloco 2</Badge>
            <h2 className="text-xl font-bold mt-1">Mapeamento da Dor</h2>
            <p className="text-muted-foreground text-sm">Clique onde dói e defina a intensidade</p>
          </div>
        </div>
      </div>

      {/* Avatar */}
      <div className="clinical-card">
        <BodyAvatarSVG mode="pain" painMap={painMap} onRegionClick={handleRegionClick}
          showBack={true} className="max-w-lg mx-auto" />
      </div>

      {/* Selected region detail */}
      {sel && (
        <div className="clinical-card space-y-4 border-primary/30">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold">{sel.nome}</h3>
            <Button variant="ghost" size="sm" onClick={() => removeRegiao(sel.id)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div>
            <Label className="mb-2 block">Tipo de dor</Label>
            <div className="flex flex-wrap gap-2">
              {TIPOS_DOR_MYID.map(tipo => (
                <button key={tipo} onClick={() => {
                  const tipos = sel.tiposDor.includes(tipo)
                    ? sel.tiposDor.filter(t => t !== tipo)
                    : [...sel.tiposDor, tipo];
                  updateRegiao(sel.id, { tiposDor: tipos });
                }}
                  className={cn('px-3 py-1.5 rounded-lg border text-sm transition-all',
                    sel.tiposDor.includes(tipo)
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/40'
                  )}>
                  {tipo}
                </button>
              ))}
            </div>
          </div>

          {[
            { key: 'intensidadeAtual' as const, label: 'Dor AGORA' },
            { key: 'intensidadeMaxima' as const, label: 'MÁXIMO que chegou' },
            { key: 'intensidadeMelhorDia' as const, label: 'Dor no MELHOR dia' },
          ].map(({ key, label }) => (
            <div key={key}>
              <div className="flex justify-between mb-1">
                <Label className="text-sm">{label}</Label>
                <span className="font-bold text-primary">{sel[key]}/10</span>
              </div>
              <Slider value={[sel[key]]} min={0} max={10} step={1}
                onValueChange={([v]) => updateRegiao(sel.id, { [key]: v })} />
            </div>
          ))}
        </div>
      )}

      {/* Regions list */}
      {regioes.length > 0 && (
        <div className="clinical-card">
          <h3 className="font-semibold text-sm mb-3">Regiões marcadas ({regioes.length})</h3>
          <div className="space-y-2">
            {regioes.map(r => (
              <div key={r.id}
                className={cn('flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-all',
                  selectedRegion === r.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/30'
                )}
                onClick={() => setSelectedRegion(r.id)}>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 text-primary" />
                  <span className="text-sm font-medium">{r.nome}</span>
                  {r.tiposDor.map(t => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
                </div>
                <span className="text-sm font-bold text-primary">{r.intensidadeAtual}/10</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Red Flags (visually subtle) */}
      <div className="clinical-card space-y-3">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Filtro de Segurança
        </h3>
        <p className="text-xs text-muted-foreground">Responda com sinceridade. Estas perguntas ajudam a garantir sua segurança.</p>
        {[
          { key: 'perdaPeso' as const, label: 'Perda de peso não planejada nos últimos 3 meses?' },
          { key: 'febreCalafrios' as const, label: 'Febre ou calafrios sem causa aparente?' },
          { key: 'dorNoturnaImpedeSono' as const, label: 'A dor acorda você de madrugada e impede o sono?' },
          { key: 'alteracaoEsfincteriana' as const, label: 'Alteração no controle de urina ou fezes?' },
          { key: 'dorPioraConsistente' as const, label: 'Dor que piora consistentemente a cada dia?' },
          { key: 'dormenciaProgressiva' as const, label: 'Dormência/formigamento que progride?' },
        ].map(({ key, label }) => (
          <div key={key} className={cn('flex items-center gap-3 p-2 rounded-lg border transition-all',
            redFlags[key] ? 'border-destructive/50 bg-destructive/5' : 'border-border')}>
            <Checkbox checked={redFlags[key]} onCheckedChange={() => toggleRedFlag(key)} />
            <Label className="text-sm cursor-pointer flex-1">{label}</Label>
          </div>
        ))}

        {hasRedFlags && (
          <div className="p-4 rounded-lg bg-destructive/10 border-2 border-destructive/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-destructive text-sm">🚨 ALERTA CRÍTICO</p>
                <p className="text-xs text-destructive/80 mt-1">
                  Recomendamos avaliação médica antes de prosseguir com qualquer intervenção.
                </p>
                <ul className="mt-2 space-y-1">
                  {alerts.map((a, i) => (
                    <li key={i} className="text-xs text-destructive/80">• {a}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <Button onClick={onNext} className="bg-primary text-primary-foreground shadow-primary">
            Próximo: Funcionalidade
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
