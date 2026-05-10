import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, TrendingUp, Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  protocoloId: string;
  progressao: any;
  fases: any[];
  faseAtual: number;
}

const CRITERIOS_POR_FASE: Record<number, { label: string; meta: string; metrica: string }[]> = {
  1: [
    { label: 'EVA ≤ 6', meta: 'Controle de dor', metrica: 'eva' },
    { label: 'Mobilidade ≥ 30%', meta: 'Mobilidade protegida', metrica: 'mobilidade' },
    { label: 'Edema reduzido 50%', meta: 'Controle inflamatório', metrica: 'edema' },
    { label: 'Melhora do sono', meta: 'Regulação básica', metrica: 'sono' },
  ],
  2: [
    { label: 'EVA ≤ 4', meta: 'Dor controlada', metrica: 'eva' },
    { label: 'Mobilidade ≥ 60%', meta: 'Ganho ADM', metrica: 'mobilidade' },
    { label: 'Força MMT ≥ 3/5', meta: 'Ativação muscular', metrica: 'forca' },
    { label: 'Funcionalidade ≥ 40%', meta: 'AVDs básicas', metrica: 'funcionalidade' },
  ],
  3: [
    { label: 'EVA ≤ 2', meta: 'Dor mínima', metrica: 'eva' },
    { label: 'Mobilidade ≥ 85%', meta: 'ADM funcional', metrica: 'mobilidade' },
    { label: 'Força MMT ≥ 4/5', meta: 'Força funcional', metrica: 'forca' },
    { label: 'Funcionalidade ≥ 70%', meta: 'AVDs expandidas', metrica: 'funcionalidade' },
  ],
  4: [
    { label: 'EVA ≤ 1', meta: 'Sem dor', metrica: 'eva' },
    { label: 'Mobilidade ≥ 95%', meta: 'ADM completa', metrica: 'mobilidade' },
    { label: 'Força MMT = 5/5', meta: 'Força completa', metrica: 'forca' },
    { label: 'Funcionalidade ≥ 90%', meta: 'Retorno pleno', metrica: 'funcionalidade' },
  ],
};

export default function ProtocoloProgressao({ protocoloId, progressao, fases, faseAtual }: Props) {
  const criteriosAtingidos = progressao?.criterios_atingidos || {};
  const totalFases = Math.max(fases.length, 4);
  const progressoGeral = ((faseAtual - 1) / totalFases) * 100;

  return (
    <div className="space-y-6 mb-6">
      {/* Progresso geral */}
      <div className="clinical-card">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Progresso Geral
          </h3>
          <Badge className="bg-primary/10 text-primary border-0">
            Fase {faseAtual} de {totalFases}
          </Badge>
        </div>
        <Progress value={progressoGeral} className="h-3 mb-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{Math.round(progressoGeral)}% concluído</span>
          {progressao?.proxima_avaliacao && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Próxima avaliação: {format(new Date(progressao.proxima_avaliacao), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
        </div>
      </div>

      {/* Critérios por fase */}
      {[1, 2, 3, 4].map(faseNum => {
        const criterios = CRITERIOS_POR_FASE[faseNum] || [];
        const isAtual = faseAtual === faseNum;
        const isConcluida = faseAtual > faseNum;
        const isFutura = faseAtual < faseNum;

        const atingidos = criterios.filter(c => criteriosAtingidos[c.metrica] === true).length;
        const pct = criterios.length > 0 ? (atingidos / criterios.length) * 100 : 0;

        return (
          <div key={faseNum} className={`clinical-card ${isAtual ? 'ring-2 ring-primary' : ''} ${isFutura ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {isConcluida ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                ) : isAtual ? (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
                    {faseNum}
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
                <h4 className="font-semibold text-sm">
                  Fase {faseNum}: {fases[faseNum - 1]?.titulo || `Fase ${faseNum}`}
                </h4>
              </div>
              {isAtual && <Badge className="bg-primary text-primary-foreground text-[10px]">Em andamento</Badge>}
              {isConcluida && <Badge className="bg-emerald-100 text-emerald-700 border-0 text-[10px]">Concluída</Badge>}
            </div>

            {!isFutura && (
              <>
                <Progress value={isConcluida ? 100 : pct} className="h-2 mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  {criterios.map((c, i) => {
                    const atingido = isConcluida || criteriosAtingidos[c.metrica] === true;
                    return (
                      <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${
                        atingido ? 'bg-emerald-50 text-emerald-700' : 'bg-muted/40 text-muted-foreground'
                      }`}>
                        {atingido ? (
                          <CheckCircle2 className="icon-sm text-emerald-500 shrink-0" />
                        ) : (
                          <Circle className="icon-sm text-muted-foreground shrink-0" />
                        )}
                        <div>
                          <div className="font-medium">{c.label}</div>
                          <div className="text-[10px] opacity-70">{c.meta}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Observações */}
      {progressao?.observacoes && (
        <div className="clinical-card border-l-4 border-amber-400">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h4 className="font-semibold text-sm">Observações Clínicas</h4>
          </div>
          <p className="text-sm text-muted-foreground">{progressao.observacoes}</p>
        </div>
      )}
    </div>
  );
}
