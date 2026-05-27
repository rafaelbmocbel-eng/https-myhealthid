import { calcularPerdaDimensao } from '@/utils/myid/lossTable';

interface Props {
  scores: Record<string, any>;
}

// Patient-friendly labels (no clinical jargon)
const ALL_ITEMS = [
  { key: 'D',   label: 'Dor',          type: 'demand'   as const, hint: 'Quanto a dor está te incomodando' },
  { key: 'EFI', label: 'Suas atividades do dia', type: 'capacity' as const, hint: 'Como está sua rotina (trabalho, casa, lazer)' },
  { key: 'P',   label: 'Cabeça e emoções', type: 'demand'  as const, hint: 'Medo, ansiedade, preocupações com o corpo' },
  { key: 'I',   label: 'Mudanças recentes', type: 'demand'  as const, hint: 'Tudo que mudou e pode estar pesando' },
  { key: 'N',   label: 'Sinais do corpo', type: 'demand'  as const, hint: 'Outros sintomas que podem influenciar' },
  { key: 'R',   label: 'Sono e energia', type: 'capacity' as const, hint: 'Como você dorme e acorda' },
  { key: 'C',   label: 'Vida pessoal', type: 'capacity' as const, hint: 'Trabalho, família, finanças' },
  { key: 'AF',  label: 'Movimento',    type: 'capacity' as const, hint: 'Quanto você se exercita' },
  { key: 'HID', label: 'Hidratação',   type: 'capacity' as const, hint: 'Quanta água você toma' },
  { key: 'NUT', label: 'Alimentação',  type: 'capacity' as const, hint: 'Qualidade do que você come' },
  { key: 'ERG', label: 'Postura no dia',type: 'capacity' as const, hint: 'Como você se posiciona ao longo do dia' },
];

function statusFor(loss: number): { label: string; color: string; bar: string; emoji: string } {
  if (loss >= 8)  return { label: 'Precisa de atenção', color: 'text-red-700 dark:text-red-400',     bar: 'bg-red-500',    emoji: '🔴' };
  if (loss >= 3)  return { label: 'Dá pra melhorar',    color: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500',  emoji: '🟡' };
  return            { label: 'Está bem',             color: 'text-emerald-700 dark:text-emerald-400', bar: 'bg-emerald-500', emoji: '🟢' };
}

export default function PatientHealthAreas({ scores }: Props) {
  if (!scores || Object.keys(scores).length === 0) return null;

  const rows = ALL_ITEMS.map(item => {
    const raw = Number(scores[item.key]) || 0;
    const lossInput = item.type === 'demand' ? raw : (10 - raw);
    const perda = calcularPerdaDimensao(item.key, lossInput);
    return { ...item, value: raw, loss: perda.perda_pontos, status: statusFor(perda.perda_pontos) };
  });

  // Sort: highest loss first (most urgent at top)
  rows.sort((a, b) => b.loss - a.loss);

  const precisam = rows.filter(r => r.loss >= 3);
  const bons     = rows.filter(r => r.loss < 3);

  return (
    <div className="space-y-5">
      {/* Áreas que precisam de atenção */}
      {precisam.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">
            O que mais está pesando hoje
          </h4>
          <div className="space-y-2">
            {precisam.map(r => (
              <div key={r.key} className="rounded-xl border border-border/40 bg-card p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{r.status.emoji}</span>
                      <span className="text-sm font-semibold text-foreground">{r.label}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 ml-7">{r.hint}</p>
                  </div>
                  <span className={`text-[10px] font-bold whitespace-nowrap ${r.status.color}`}>
                    {r.status.label}
                  </span>
                </div>
                <div className="ml-7 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${r.status.bar} transition-all`}
                    style={{ width: `${Math.min(100, (r.loss / 15) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* O que está indo bem */}
      {bons.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-3">
            O que está indo bem
          </h4>
          <div className="flex flex-wrap gap-2">
            {bons.map(r => (
              <div
                key={r.key}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 px-3 py-1"
              >
                <span className="text-xs">🟢</span>
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  {r.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Helper line */}
      <p className="text-[11px] text-muted-foreground italic leading-relaxed">
        Essas áreas vêm do seu MyID. Conforme você cuida delas no dia a dia, seu retrato evolui.
      </p>
    </div>
  );
}
