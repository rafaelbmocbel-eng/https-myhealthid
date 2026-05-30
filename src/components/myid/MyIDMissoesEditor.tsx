import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Pencil, Plus, Trash2, Eye, EyeOff, Trophy, Save, X, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMissoesPaciente, toSourceKey, type PacienteMissao } from '@/hooks/useMissoesPaciente';

export interface EditableMissao {
  source_key: string;
  origem: 'myid' | 'presencial' | 'manual';
  titulo: string;
  descricao: string;
  acao_imediata?: string;
  categoria: 'urgente' | 'importante' | 'oportunidade' | 'positivo';
  xp_recompensa: number;
}

interface Props {
  pacienteId: string;
  terapeutaId: string;
  /** All auto-generated missions to manage (already deduped). */
  autoMissoes: EditableMissao[];
}

const categoriaLabel: Record<string, string> = {
  urgente: 'Urgente',
  importante: 'Importante',
  oportunidade: 'Oportunidade',
  positivo: 'Ponto Forte',
};

const origemBadge: Record<string, { label: string; cls: string }> = {
  myid: { label: 'MyID', cls: 'bg-primary/10 text-primary border-primary/20' },
  presencial: { label: 'Presencial', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' },
  manual: { label: 'Manual', cls: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30' },
};

export default function MyIDMissoesEditor({ pacienteId, terapeutaId, autoMissoes }: Props) {
  const { overrides, manuais, upsertOverride, addManual, removeMissao } = useMissoesPaciente(pacienteId);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftTitulo, setDraftTitulo] = useState('');
  const [draftDescricao, setDraftDescricao] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  function startEdit(m: EditableMissao) {
    const ov = overrides[m.source_key];
    setEditingKey(m.source_key);
    setDraftTitulo(ov?.titulo ?? m.titulo);
    setDraftDescricao(ov?.descricao ?? m.descricao);
  }

  async function saveEdit(m: EditableMissao) {
    try {
      await upsertOverride.mutateAsync({
        source_key: m.source_key,
        origem: m.origem,
        categoria: m.categoria,
        xp_recompensa: m.xp_recompensa,
        terapeuta_id: terapeutaId,
        defaults: { titulo: m.titulo, descricao: m.descricao, acao_imediata: m.acao_imediata },
        override: { titulo: draftTitulo.trim(), descricao: draftDescricao.trim() },
      });
      toast.success('Missão atualizada — paciente vê a nova versão.');
      setEditingKey(null);
    } catch (e: any) {
      toast.error('Falha ao salvar', { description: e.message });
    }
  }

  async function toggleAtivo(m: EditableMissao, ativo: boolean) {
    try {
      await upsertOverride.mutateAsync({
        source_key: m.source_key,
        origem: m.origem,
        categoria: m.categoria,
        xp_recompensa: m.xp_recompensa,
        terapeuta_id: terapeutaId,
        defaults: { titulo: m.titulo, descricao: m.descricao, acao_imediata: m.acao_imediata },
        override: { ativo },
      });
      toast.success(ativo ? 'Missão ativada' : 'Missão oculta para o paciente');
    } catch (e: any) {
      toast.error('Falha ao alterar', { description: e.message });
    }
  }

  // Auto missions list with current override applied
  const items = autoMissoes.map((m) => {
    const ov = overrides[m.source_key];
    return {
      ...m,
      titulo: ov?.titulo ?? m.titulo,
      descricao: ov?.descricao ?? m.descricao,
      ativo: ov?.ativo ?? true,
      isOverridden: !!ov && (ov.titulo !== m.titulo || ov.descricao !== m.descricao),
    };
  });

  const ativasCount = items.filter((i) => i.ativo).length + manuais.filter((m) => m.ativo).length;

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <Wand2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-bold leading-tight">Missões sugeridas — visão do profissional</h4>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Edite título e descrição, oculte do paciente ou adicione manuais. {ativasCount} ativas
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowAdd(true)} className="h-8 text-xs gap-1">
            <Plus className="icon-sm" />
            Nova missão
          </Button>
        </div>

        <div className="space-y-2">
          {items.map((m) => {
            const isEditing = editingKey === m.source_key;
            const ob = origemBadge[m.origem] || origemBadge.myid;
            return (
              <div
                key={m.source_key}
                className={`p-3 rounded-lg border bg-background/60 ${m.ativo ? '' : 'opacity-60'}`}
              >
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <Badge variant="outline" className={`text-[9px] h-4 px-1.5 font-bold ${ob.cls}`}>
                    {ob.label}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                    {categoriaLabel[m.categoria] || m.categoria}
                  </Badge>
                  <span className="text-[10px] text-primary font-bold">+{m.xp_recompensa}XP</span>
                  {m.isOverridden && (
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/30">
                      Editado
                    </Badge>
                  )}
                  <div className="ml-auto flex items-center gap-1">
                    <Switch
                      checked={m.ativo}
                      onCheckedChange={(v) => toggleAtivo(m, v)}
                      aria-label={m.ativo ? 'Ocultar do paciente' : 'Mostrar para o paciente'}
                    />
                    {m.ativo ? (
                      <Eye className="icon-sm text-muted-foreground" />
                    ) : (
                      <EyeOff className="icon-sm text-muted-foreground" />
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={draftTitulo}
                      onChange={(e) => setDraftTitulo(e.target.value)}
                      placeholder="Título da missão"
                      className="h-8 text-sm"
                    />
                    <Textarea
                      value={draftDescricao}
                      onChange={(e) => setDraftDescricao(e.target.value)}
                      placeholder="Descrição que o paciente verá"
                      rows={3}
                      className="text-xs"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setEditingKey(null)} className="h-7 text-xs gap-1">
                        <X className="h-3 w-3" /> Cancelar
                      </Button>
                      <Button size="sm" onClick={() => saveEdit(m)} className="h-7 text-xs gap-1">
                        <Save className="h-3 w-3" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground leading-tight">{m.titulo}</p>
                      <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{m.descricao}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => startEdit(m)} className="h-7 w-7 shrink-0">
                      <Pencil className="icon-sm" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {/* Manual missions */}
          {manuais.map((m) => (
            <ManualRow key={m.id} missao={m} onRemove={() => removeMissao.mutate(m.id)} />
          ))}

          {items.length === 0 && manuais.length === 0 && (
            <p className="text-[11px] text-muted-foreground text-center py-3">
              Nenhuma missão gerada ainda. Conclua a avaliação para gerar sugestões automáticas.
            </p>
          )}
        </div>

        <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1 border-t border-border/40">
          <Trophy className="h-3 w-3 text-primary/60" />
          As alterações aparecem em tempo real no portal do paciente.
        </p>
      </CardContent>

      <AddManualDialog
        open={showAdd}
        onOpenChange={setShowAdd}
        onSubmit={async (data) => {
          try {
            await addManual.mutateAsync({ terapeuta_id: terapeutaId, ...data });
            toast.success('Missão criada');
            setShowAdd(false);
          } catch (e: any) {
            toast.error('Falha ao criar', { description: e.message });
          }
        }}
      />
    </Card>
  );
}

function ManualRow({ missao, onRemove }: { missao: PacienteMissao; onRemove: () => void }) {
  const ob = origemBadge.manual;
  return (
    <div className={`p-3 rounded-lg border bg-background/60 ${missao.ativo ? '' : 'opacity-60'}`}>
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <Badge variant="outline" className={`text-[9px] h-4 px-1.5 font-bold ${ob.cls}`}>
          {ob.label}
        </Badge>
        <Badge variant="outline" className="text-[9px] h-4 px-1.5">
          {categoriaLabel[missao.categoria] || missao.categoria}
        </Badge>
        <span className="text-[10px] text-primary font-bold">+{missao.xp_recompensa}XP</span>
        <Button size="icon" variant="ghost" onClick={onRemove} className="h-7 w-7 ml-auto text-destructive">
          <Trash2 className="icon-sm" />
        </Button>
      </div>
      <p className="text-xs font-semibold text-foreground leading-tight">{missao.titulo}</p>
      {missao.descricao && (
        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{missao.descricao}</p>
      )}
    </div>
  );
}

function AddManualDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (d: {
    titulo: string;
    descricao?: string;
    acao_imediata?: string;
    categoria: string;
    xp_recompensa: number;
  }) => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState<'urgente' | 'importante' | 'oportunidade' | 'positivo'>('importante');
  const [xp, setXp] = useState(10);

  function reset() {
    setTitulo(''); setDescricao(''); setCategoria('importante'); setXp(10);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova missão para o paciente</DialogTitle>
          <DialogDescription>Aparece no portal junto às missões automáticas.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold mb-1 block">Título</label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Caminhar 20 min ao ar livre" />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block">Descrição</label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} placeholder="Instruções claras para o paciente." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block">Categoria</label>
              <Select value={categoria} onValueChange={(v) => setCategoria(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="importante">Importante</SelectItem>
                  <SelectItem value="oportunidade">Oportunidade</SelectItem>
                  <SelectItem value="positivo">Ponto Forte</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block">XP</label>
              <Input type="number" inputMode="numeric" min={0} max={500} value={xp || ''} onChange={(e) => setXp(e.target.value === '' ? 0 : Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            disabled={!titulo.trim()}
            onClick={() => {
              onSubmit({ titulo: titulo.trim(), descricao: descricao.trim() || undefined, categoria, xp_recompensa: xp });
              reset();
            }}
          >
            Criar missão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Helper exposed for callers that need a deterministic source_key
export { toSourceKey };
