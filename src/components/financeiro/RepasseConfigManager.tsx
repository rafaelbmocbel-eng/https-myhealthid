import { useState } from 'react';
import { useConvenios } from '@/hooks/useConvenios';
import { useRepasseConfig } from '@/hooks/useRepasseConfig';
import { useEquipe } from '@/hooks/useEquipe';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Percent, Users } from 'lucide-react';

/**
 * Matriz: linhas = membros da equipe, colunas = Particular + convênios cadastrados.
 * Cada célula é um input de % aplicado quando o profissional atende sob aquele convênio.
 */
export default function RepasseConfigManager() {
  const { membros, loading: loadingMembros } = useEquipe();
  const { convenios, loading: loadingConv } = useConvenios();
  const { getRepasse, setRepasse } = useRepasseConfig();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const key = (m: string, c: string | null) => `${m}::${c ?? 'particular'}`;

  const onChange = (membroId: string, convenioId: string | null, raw: string) => {
    setDraft((d) => ({ ...d, [key(membroId, convenioId)]: raw }));
  };

  const onBlur = async (membroId: string, convenioId: string | null) => {
    const k = key(membroId, convenioId);
    const raw = draft[k];
    if (raw === undefined) return;
    const num = Math.max(0, Math.min(100, Number(raw.replace(',', '.')) || 0));
    await setRepasse.mutateAsync({ membro_equipe_id: membroId, convenio_id: convenioId, percentual: num });
    setDraft((d) => { const n = { ...d }; delete n[k]; return n; });
  };

  const cellValue = (membroId: string, convenioId: string | null) => {
    const k = key(membroId, convenioId);
    if (draft[k] !== undefined) return draft[k];
    const r = getRepasse(membroId, convenioId);
    return r ? String(r.percentual) : '';
  };

  const ativos = membros.filter((m) => m.ativo);
  const cols: Array<{ id: string | null; label: string }> = [
    { id: null, label: 'Particular' },
    ...convenios.map((c) => ({ id: c.id, label: c.nome })),
  ];

  return (
    <Card className="rounded-xl border-border/40 shadow-xs p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Percent className="icon-sm text-primary" />
        <h3 className="h-section">Repasse por profissional</h3>
      </div>
      <p className="text-caption mb-4">
        Defina a porcentagem que cada profissional recebe por sessão, conforme o tipo de atendimento.
      </p>

      {loadingMembros || loadingConv ? (
        <p className="text-caption">Carregando…</p>
      ) : ativos.length === 0 ? (
        <div className="flex items-center gap-2 text-caption">
          <Users className="icon-xs" /> Cadastre membros da equipe em Configurações → Equipe.
        </div>
      ) : (
        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left p-2 font-medium text-muted-foreground">Profissional</th>
                {cols.map((c) => (
                  <th key={c.label} className="text-center p-2 font-medium text-muted-foreground whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ativos.map((m) => (
                <tr key={m.id} className="border-b border-border/20 last:border-0">
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.cor }} />
                      <span className="truncate">{m.nome}</span>
                    </div>
                  </td>
                  {cols.map((c) => (
                    <td key={c.label} className="p-1.5 text-center">
                      <div className="relative inline-block">
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          step="1"
                          value={cellValue(m.id, c.id)}
                          onChange={(e) => onChange(m.id, c.id, e.target.value)}
                          onBlur={() => onBlur(m.id, c.id)}
                          className="h-9 w-20 text-center pr-6"
                          placeholder="—"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-micro text-muted-foreground pointer-events-none">%</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
