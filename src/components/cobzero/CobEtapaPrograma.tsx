import { AvaliacaoCobZero } from '@/types/cobzero';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, BarChart3 } from 'lucide-react';

const FASES = [
  { id: 0, label: 'Fase 0', sublabel: 'Preparação & Liberação', duration: 'Meses 1-6', color: 'bg-blue-100 border-blue-200 text-blue-800', tecnicas: ['Fascia Release (UC2, UC3, UC4)','Mobilização articular (Maitland I-II)','PNF contract-relax','Descompressão neural','Respiração diafragmática'] },
  { id: 1, label: 'Fase 1', sublabel: '7 Princípios Schroth', duration: 'Semanas 1-4', color: 'bg-green-100 border-green-200 text-green-800', tecnicas: ['Elongação axial ativa','Autocorreção sagital','Translação lateral','Desrotação vertebral','Respiração dirigida dirigida','Lateroflexão corretiva','Manutenção contração'] },
  { id: 2, label: 'Fase 2', sublabel: 'Força & Estabilidade', duration: 'Semanas 5-8', color: 'bg-amber-100 border-amber-200 text-amber-800', tecnicas: ['Prancha dorsal com correção','Bridge glúteo','Rotação resistida com band','Scaption Y-T-W','Série abdominal anti-rotação'] },
  { id: 3, label: 'Fase 3', sublabel: 'Integração Funcional', duration: 'Semanas 9-12', color: 'bg-purple-100 border-purple-200 text-purple-800', tecnicas: ['Reeducação de marcha','Agachamento funcional','Atividades esportivas adaptadas','Propriocepção (BOSU ball)','Ergonomia e ADLs'] },
];

interface Props {
  avaliacao: AvaliacaoCobZero;
  onNext: () => void;
  onBack: () => void;
}

export default function CobEtapaPrograma({ avaliacao, onNext, onBack }: Props) {
  const lenke = avaliacao.etapaLenke;

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <Badge variant="outline" className="text-xs mb-1">Etapa 5</Badge>
        <h2 className="text-xl font-bold">Plano Terapêutico – 4 Fases COB° ZERO</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {lenke.cobbAngle > 0 ? `Lenke ${lenke.lenkeType}${lenke.lumbarModifier} – Cobb ${lenke.cobbAngle}° – Risser ${lenke.risserStage}` : 'Configure os dados de Lenke primeiro'}
        </p>
      </div>

      <div className="clinical-card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Cobb Atual', value: `${lenke.cobbAngle}°`, sub: 'baseline' },
            { label: 'Meta (12 sem)', value: `≤${Math.max(lenke.cobbAngle - 4, 10)}°`, sub: 'redução ≥4°' },
            { label: 'Risco', value: `${avaliacao.etapaRisco.riskPercentage}%`, sub: avaliacao.etapaRisco.riskLevel },
            { label: 'Lenke', value: `${lenke.lenkeType}${lenke.lumbarModifier}${lenke.sagittalModifier}`, sub: 'classificação' },
          ].map(item => (
            <div key={item.label} className="text-center p-3 rounded-xl bg-secondary">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="font-bold text-xl text-primary">{item.value}</div>
              <div className="text-xs text-muted-foreground">{item.sub}</div>
            </div>
          ))}
        </div>

        <div className="space-y-4">
          {FASES.map(fase => (
            <div key={fase.id} className={`p-4 rounded-xl border-2 ${fase.color}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold">{fase.label} – {fase.sublabel}</div>
                  <div className="text-sm opacity-70">{fase.duration}</div>
                </div>
                {fase.id === avaliacao.faseAtual && (
                  <Badge className="bg-primary text-primary-foreground">Fase Atual</Badge>
                )}
              </div>
              <ul className="space-y-1">
                {fase.tecnicas.map((t, i) => (
                  <li key={i} className="text-sm flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}><ChevronLeft className="h-4 w-4 mr-1" />Voltar</Button>
          <Button onClick={onNext} className="bg-primary text-primary-foreground shadow-primary gap-2">
            <BarChart3 className="h-4 w-4" />Gerar Relatório COB° ZERO
          </Button>
        </div>
      </div>
    </div>
  );
}
