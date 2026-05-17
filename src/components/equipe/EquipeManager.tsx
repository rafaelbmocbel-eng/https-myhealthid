import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useEquipe, CORES_PREDEFINIDAS } from '@/hooks/useEquipe';
import { Users, Plus, Trash2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function EquipeManager() {
  const { membros, loading, addMembro, updateMembro, removeMembro } = useEquipe();
  const [novoNome, setNovoNome] = useState('');
  const [novaCor, setNovaCor] = useState(CORES_PREDEFINIDAS[0]);
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!novoNome.trim()) return;
    setAdding(true);
    await addMembro(novoNome.trim(), novaCor);
    setNovoNome('');
    // Pick next unused color
    const usedColors = membros.map(m => m.cor);
    const next = CORES_PREDEFINIDAS.find(c => !usedColors.includes(c)) || CORES_PREDEFINIDAS[0];
    setNovaCor(next);
    setAdding(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="clinical-card mb-4 sm:mb-5">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Equipe / Profissionais</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Cadastre os membros da sua equipe. Cada profissional terá uma <strong>cor única</strong> que aparecerá nos agendamentos.
      </p>

      {/* Lista de membros */}
      <div className="space-y-2 mb-4">
        {membros.map(m => (
          <div key={m.id} className="flex items-center gap-3 p-3 rounded-xl border bg-card">
            <div className="h-8 w-8 rounded-full shrink-0 border-2 border-background shadow-sm" style={{ backgroundColor: m.cor }} />
            <div className="flex-1 min-w-0">
              <Input
                defaultValue={m.nome}
                className="h-8 text-sm font-medium border-none bg-transparent p-0 focus-visible:ring-0"
                onBlur={e => {
                  if (e.target.value !== m.nome) updateMembro(m.id, { nome: e.target.value });
                }}
              />
            </div>
            <div className="flex items-center gap-1">
              {CORES_PREDEFINIDAS.map(cor => (
                <button
                  key={cor}
                  onClick={() => updateMembro(m.id, { cor })}
                  className={cn(
                    'h-5 w-5 rounded-full border-2 transition-all',
                    m.cor === cor ? 'border-foreground scale-110 ring-1 ring-foreground/20' : 'border-transparent opacity-50 hover:opacity-100',
                  )}
                  style={{ backgroundColor: cor }}
                />
              ))}
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeMembro(m.id)}>
              <Trash2 className="icon-sm" />
            </Button>
          </div>
        ))}
      </div>

      {/* Adicionar novo */}
      <div className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-muted-foreground/20">
        <div className="flex items-center gap-1 shrink-0">
          {CORES_PREDEFINIDAS.slice(0, 6).map(cor => (
            <button
              key={cor}
              onClick={() => setNovaCor(cor)}
              className={cn(
                'h-5 w-5 rounded-full border-2 transition-all',
                novaCor === cor ? 'border-foreground scale-110' : 'border-transparent opacity-40 hover:opacity-80',
              )}
              style={{ backgroundColor: cor }}
            />
          ))}
        </div>
        <Input
          placeholder="Nome do profissional"
          value={novoNome}
          onChange={e => setNovoNome(e.target.value)}
          className="h-8 text-sm flex-1"
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
        <Button size="sm" className="h-8 gap-1" onClick={handleAdd} disabled={adding || !novoNome.trim()}>
          {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
          Adicionar
        </Button>
      </div>
    </div>
  );
}
