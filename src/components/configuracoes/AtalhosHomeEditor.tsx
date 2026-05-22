import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { RotateCcw, LayoutGrid } from 'lucide-react';
import { useHomeAtalhos } from '@/hooks/useHomeAtalhos';

export default function AtalhosHomeEditor() {
  const { ativos, toggle, reset, catalogo } = useHomeAtalhos();

  return (
    <div className="clinical-card">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <LayoutGrid className="icon-sm text-muted-foreground" />
          <h2 className="h-section">Atalhos da Home</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={reset} className="gap-1.5 h-8 text-xs">
          <RotateCcw className="icon-xs" /> Restaurar
        </Button>
      </div>
      <p className="text-caption mb-4">
        Escolha quais botões aparecem na seção de atalhos da página inicial.
      </p>

      <div className="space-y-1.5">
        {catalogo.map(item => {
          const Icon = item.icon;
          const checked = ativos.includes(item.id);
          return (
            <label
              key={item.id}
              htmlFor={`atalho-${item.id}`}
              className="flex items-center gap-3 rounded-xl border border-border/40 p-3 cursor-pointer hover:bg-muted/30 transition"
            >
              <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
                <Icon className="icon-sm text-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{item.label}</div>
                <div className="text-[11px] text-muted-foreground truncate">{item.descricao}</div>
              </div>
              <Switch
                id={`atalho-${item.id}`}
                checked={checked}
                onCheckedChange={() => toggle(item.id)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
