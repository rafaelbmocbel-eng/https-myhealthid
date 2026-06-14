import { useState, useMemo } from 'react';
import { useTimelineCompleta, useHistoriaVida, TIPO_CORES, TIPO_LABELS, type TipoEvento, type EventoTimeline } from '@/hooks/useTimelineCompleta';
import { useHistoriaVidaMutation } from '@/hooks/useTimelineCompleta';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Plus, Filter, Heart, Stethoscope, Pill, Scissors, Baby, Zap, AlertTriangle, Star, Activity } from 'lucide-react';
import { format, getYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TIPO_ICONS: Record<string, React.ReactNode> = {
  nascimento:         <Baby className="h-3.5 w-3.5" />,
  cirurgia:           <Scissors className="h-3.5 w-3.5" />,
  trauma:             <Zap className="h-3.5 w-3.5" />,
  diagnostico:        <Stethoscope className="h-3.5 w-3.5" />,
  internacao:         <Activity className="h-3.5 w-3.5" />,
  medicamento:        <Pill className="h-3.5 w-3.5" />,
  alergia:            <AlertTriangle className="h-3.5 w-3.5" />,
  vacina:             <Heart className="h-3.5 w-3.5" />,
  gestacao:           <Baby className="h-3.5 w-3.5" />,
  parto:              <Baby className="h-3.5 w-3.5" />,
  acidente:           <Zap className="h-3.5 w-3.5" />,
  fratura:            <Activity className="h-3.5 w-3.5" />,
  procedimento:       <Scissors className="h-3.5 w-3.5" />,
  alta:               <Star className="h-3.5 w-3.5" />,
  remissao:           <Star className="h-3.5 w-3.5" />,
  inicio_tratamento:  <Activity className="h-3.5 w-3.5" />,
  marco_tratamento:   <Star className="h-3.5 w-3.5" />,
  outro:              <Activity className="h-3.5 w-3.5" />,
};

const TIPO_HISTORIA_LABELS: Record<string, string> = {
  nascimento: 'Nascimento', cirurgia: 'Cirurgia', trauma: 'Trauma',
  diagnostico: 'Diagnóstico', internacao: 'Internação', medicamento: 'Medicamento',
  alergia: 'Alergia', vacina: 'Vacina', gestacao: 'Gestação', parto: 'Parto',
  acidente: 'Acidente', fratura: 'Fratura', procedimento: 'Procedimento',
  alta: 'Alta médica', remissao: 'Remissão', inicio_tratamento: 'Início do tratamento',
  marco_tratamento: 'Marco do tratamento', outro: 'Outro',
};

const SISTEMAS_CORPORAIS = [
  'musculoesqueletico', 'nervoso', 'digestorio', 'circulatorio',
  'respiratorio', 'endocrino', 'urinario', 'reprodutor', 'tegumentar',
  'linfatico', 'sensorial',
];

const FILTROS_TIPO: { key: TipoEvento | 'todos' | 'historia_estruturada'; label: string }[] = [
  { key: 'todos', label: 'Tudo' },
  { key: 'historia_vida', label: 'Hist. de vida' },
  { key: 'sessao_concluida', label: 'Sessões' },
  { key: 'nota_prontuario', label: 'Prontuário' },
  { key: 'myid', label: 'MyID' },
  { key: 'evento_anatomico', label: 'Achados' },
  { key: 'diagnostico', label: 'Diagnósticos' },
  { key: 'exame', label: 'Exames' },
  { key: 'avaliacao_voz', label: 'Voz' },
  { key: 'escala', label: 'Escalas' },
  { key: 'composicao_corporal', label: 'Composição' },
  { key: 'mensagem_whatsapp', label: 'WhatsApp' },
];

interface NovoEvento {
  data_evento: string;
  tipo: string;
  titulo: string;
  descricao: string;
  sistema_corporal: string;
  severidade: string;
  profissional_registro: string;
}

const NOVO_DEFAULT: NovoEvento = {
  data_evento: new Date().toISOString().slice(0, 10),
  tipo: 'outro', titulo: '', descricao: '',
  sistema_corporal: '', severidade: '0', profissional_registro: '',
};

export default function TimelineVidaCompleta({ pacienteId }: { pacienteId: string }) {
  const { data: eventos = [], isLoading } = useTimelineCompleta(pacienteId);
  const { adicionar } = useHistoriaVidaMutation(pacienteId);
  const [filtro, setFiltro] = useState<string>('todos');
  const [busca, setBusca] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [novo, setNovo] = useState<NovoEvento>(NOVO_DEFAULT);

  const eventosFiltrados = useMemo(() => {
    let list = eventos;
    if (filtro !== 'todos') list = list.filter(e => e.tipo === filtro);
    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(e =>
        e.titulo.toLowerCase().includes(q) ||
        (e.descricao || '').toLowerCase().includes(q) ||
        (e.sistema_corporal || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [eventos, filtro, busca]);

  // Agrupa por ano
  const porAno = useMemo(() => {
    const map = new Map<number, EventoTimeline[]>();
    for (const e of eventosFiltrados) {
      const y = getYear(new Date(e.data));
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(e);
    }
    return Array.from(map.entries()).sort((a, b) => b[0] - a[0]);
  }, [eventosFiltrados]);

  async function handleAdicionar() {
    if (!novo.titulo.trim() || !novo.data_evento) { toast.error('Preencha pelo menos data e título'); return; }
    try {
      await adicionar.mutateAsync({
        data_evento: novo.data_evento,
        tipo: novo.tipo,
        titulo: novo.titulo.trim(),
        descricao: novo.descricao || null,
        sistema_corporal: novo.sistema_corporal || null,
        severidade: parseInt(novo.severidade) || 0,
        profissional_registro: novo.profissional_registro || null,
      });
      setNovo(NOVO_DEFAULT);
      setAddOpen(false);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  }

  const totalEventos = eventos.length;
  const anosAtivos = porAno.length;

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-base font-semibold">Linha do tempo completa</h3>
          <p className="text-xs text-muted-foreground">
            {totalEventos} eventos · {anosAtivos} ano{anosAtivos !== 1 ? 's' : ''}
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" /> Registrar evento de vida
        </Button>
      </div>

      {/* Busca + filtros */}
      <div className="space-y-2">
        <Input
          placeholder="Buscar evento, diagnóstico, nota..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-1">
          {FILTROS_TIPO.map(f => (
            <button
              key={f.key}
              onClick={() => setFiltro(f.key)}
              className={cn(
                'shrink-0 text-[11px] px-2.5 py-1 rounded-full border transition-all font-medium',
                filtro === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background border-border/60 text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Vazio */}
      {!isLoading && eventosFiltrados.length === 0 && (
        <div className="text-center py-12">
          <Activity className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum evento encontrado</p>
        </div>
      )}

      {/* Timeline agrupada por ano */}
      {porAno.map(([ano, evs]) => (
        <div key={ano}>
          {/* Separador de ano */}
          <div className="flex items-center gap-3 my-4">
            <div className="h-px flex-1 bg-border/50" />
            <span className="text-xs font-bold text-muted-foreground px-2 py-0.5 rounded-full border border-border/60 bg-muted/30">
              {ano}
            </span>
            <div className="h-px flex-1 bg-border/50" />
          </div>

          <div className="relative pl-5">
            {/* Linha vertical */}
            <div className="absolute left-[7px] top-0 bottom-0 w-px bg-border/40" />

            <div className="space-y-2">
              {evs.map(ev => (
                <EventoCard key={ev.id} evento={ev} />
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Dialog: Novo evento de vida */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-500" />
              Registrar evento de vida
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Data *</Label>
                <Input type="date" value={novo.data_evento} onChange={e => setNovo(n => ({ ...n, data_evento: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Tipo *</Label>
                <Select value={novo.tipo} onValueChange={v => setNovo(n => ({ ...n, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_HISTORIA_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Título *</Label>
              <Input value={novo.titulo} onChange={e => setNovo(n => ({ ...n, titulo: e.target.value }))} placeholder="Ex: Apendicectomia de urgência, Fratura no tornozelo..." />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={novo.descricao} onChange={e => setNovo(n => ({ ...n, descricao: e.target.value }))} rows={3} placeholder="Detalhes, cirurgião, hospital, complicações, recuperação..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Sistema corporal</Label>
                <Select value={novo.sistema_corporal} onValueChange={v => setNovo(n => ({ ...n, sistema_corporal: v }))}>
                  <SelectTrigger><SelectValue placeholder="(opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {SISTEMAS_CORPORAIS.map(s => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Severidade</Label>
                <Select value={novo.severidade} onValueChange={v => setNovo(n => ({ ...n, severidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0 — Sem impacto</SelectItem>
                    <SelectItem value="1">1 — Leve</SelectItem>
                    <SelectItem value="2">2 — Moderado</SelectItem>
                    <SelectItem value="3">3 — Grave</SelectItem>
                    <SelectItem value="4">4 — Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Profissional que registrou</Label>
              <Input value={novo.profissional_registro} onChange={e => setNovo(n => ({ ...n, profissional_registro: e.target.value }))} placeholder="Ex: Dr. João, Fisio Maria..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAdicionar} disabled={adicionar.isPending || !novo.titulo || !novo.data_evento}>
              {adicionar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar evento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventoCard({ evento: ev }: { evento: EventoTimeline }) {
  const cores = TIPO_CORES[ev.tipo];
  const label = TIPO_LABELS[ev.tipo];
  const isHistoriaVida = ev.tipo === 'historia_vida';
  const isNascimento = ev.metadata?.is_nascimento;

  return (
    <div className="flex gap-3 group">
      {/* Ponto na linha */}
      <div className={cn(
        'h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center mt-0.5 -ml-[3px] bg-background transition-transform group-hover:scale-125',
        isNascimento ? 'border-rose-500 bg-rose-100' :
        isHistoriaVida ? 'border-rose-400' :
        ev.tipo === 'sessao_concluida' ? 'border-emerald-500' :
        ev.tipo === 'diagnostico' ? 'border-red-500' :
        'border-border',
      )} />

      {/* Conteúdo */}
      <div className={cn(
        'flex-1 min-w-0 rounded-xl border px-3 py-2 mb-1 transition-all',
        cores,
        isNascimento && 'ring-2 ring-rose-300 dark:ring-rose-700',
      )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              <Badge className={cn('text-[10px] px-1.5 py-0 border-0', cores)} variant="outline">
                {label}
              </Badge>
              {ev.sistema_corporal && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-background/50 border-border/40">
                  {ev.sistema_corporal}
                </Badge>
              )}
              {ev.severidade !== undefined && ev.severidade > 0 && (
                <span className={cn('text-[10px] font-bold',
                  ev.severidade >= 3 ? 'text-red-600' : ev.severidade >= 2 ? 'text-amber-600' : 'text-muted-foreground',
                )}>
                  {'●'.repeat(ev.severidade)}{'○'.repeat(4 - ev.severidade)}
                </span>
              )}
            </div>
            <div className="text-xs font-semibold leading-tight truncate">{ev.titulo}</div>
            {ev.descricao && (
              <div className="text-[11px] opacity-80 mt-0.5 line-clamp-2">{ev.descricao}</div>
            )}
          </div>
          <time className="text-[10px] opacity-60 shrink-0 tabular-nums whitespace-nowrap">
            {format(new Date(ev.data), 'dd/MM/yyyy', { locale: ptBR })}
          </time>
        </div>
      </div>
    </div>
  );
}
