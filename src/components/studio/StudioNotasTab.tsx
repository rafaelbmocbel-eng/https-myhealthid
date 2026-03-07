import { useState } from 'react';
import { useStudioNotas } from '@/hooks/useStudioData';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, StickyNote, Trash2, Save, Loader2, Target, ClipboardList } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import ResumoProntuario from '@/components/paciente/ResumoProntuario';

interface Props {
  pacienteId: string;
  showSummary?: boolean;
}

export default function StudioNotasTab({ pacienteId, showSummary = false }: Props) {
  const { notas, isLoading, adicionarNota, deletarNota } = useStudioNotas(pacienteId);
  const [showForm, setShowForm] = useState(false);
  const [conteudo, setConteudo] = useState('');
  const [tipo, setTipo] = useState('observacao');

  const handleSave = async () => {
    if (!conteudo.trim()) return;
    await adicionarNota.mutateAsync({ paciente_id: pacienteId, conteudo, tipo });
    setConteudo('');
    setShowForm(false);
  };

  const TIPO_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
    observacao: { icon: StickyNote, label: 'Observação', color: 'bg-amber-100 text-amber-700' },
    planejamento: { icon: Target, label: 'Planejamento', color: 'bg-studio-light text-studio' },
    avaliacao: { icon: ClipboardList, label: 'Avaliação', color: 'bg-blue-100 text-blue-700' },
  };

  return (
    <div className="space-y-6">
      {showSummary && <ResumoProntuario pacienteId={pacienteId} />}

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-foreground">Anotações do Educador</h3>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-3.5 w-3.5" /> Nova Nota
        </Button>
      </div>

      {showForm && (
        <Card className="border-studio/30 border-2">
          <CardContent className="pt-4 pb-4 space-y-3">
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="observacao">🗒️ Observação</SelectItem>
                <SelectItem value="planejamento">🎯 Planejamento</SelectItem>
                <SelectItem value="avaliacao">📋 Avaliação</SelectItem>
              </SelectContent>
            </Select>
            <Textarea placeholder="Escreva suas observações, planejamento ou análise..." value={conteudo} onChange={e => setConteudo(e.target.value)} className="min-h-[100px]" />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button size="sm" className="bg-gradient-studio text-white gap-1" onClick={handleSave} disabled={adicionarNota.isPending}>
                {adicionarNota.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-studio" /></div>
      ) : notas.length === 0 ? (
        <Card className="border-dashed border-2 border-studio/20">
          <CardContent className="py-10 text-center">
            <StickyNote className="h-10 w-10 mx-auto mb-3 text-studio/30" />
            <p className="font-semibold text-foreground">Nenhuma anotação</p>
            <p className="text-sm text-muted-foreground mt-1">Registre observações, planejamentos e avaliações</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notas.map((nota: any) => {
            const config = TIPO_CONFIG[nota.tipo] || TIPO_CONFIG.observacao;
            const Icon = config.icon;
            return (
              <div key={nota.id} className="p-3 rounded-xl border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={cn('text-[10px] gap-1', config.color)}>
                    <Icon className="h-2.5 w-2.5" /> {config.label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {format(parseISO(nota.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deletarNota.mutate(nota.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-foreground whitespace-pre-wrap">{nota.conteudo}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
