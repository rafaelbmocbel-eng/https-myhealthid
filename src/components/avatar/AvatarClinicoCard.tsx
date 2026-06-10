import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Activity, Plus, Trash2, Pencil, Stethoscope } from 'lucide-react';
import { REGIONS, STRUCTURES } from '@/components/presencial/Body3DAvatar';
import {
  useEventosAnatomicos, useSaveEventoAnatomico, useDeleteEventoAnatomico,
  corEvento, type EventoAnatomico, type SistemaCorporal, type StatusEvento, type OrigemAchado,
} from '@/hooks/useEventosAnatomicos';

const FRONT_OUTLINE =
  'M120 18 C 138 18 152 34 152 54 C 152 70 144 84 132 90 L 134 104 C 156 110 178 118 184 132 L 192 168 L 200 230 L 204 280 L 196 308 L 188 308 L 184 282 L 176 232 L 168 178 L 160 168 L 158 220 L 156 280 L 162 360 L 158 430 L 152 500 L 138 506 L 134 500 L 132 430 L 128 360 L 124 280 L 116 280 L 112 360 L 108 430 L 106 500 L 102 506 L 88 500 L 82 430 L 78 360 L 84 280 L 82 220 L 80 168 L 72 178 L 64 232 L 56 282 L 52 308 L 44 308 L 36 280 L 40 230 L 48 168 L 56 132 C 62 118 84 110 106 104 L 108 90 C 96 84 88 70 88 54 C 88 34 102 18 120 18 Z';

const SISTEMAS_F1: SistemaCorporal[] = ['musculoesqueletico', 'nervoso'];
const SISTEMA_LABEL: Record<SistemaCorporal, string> = {
  musculoesqueletico: 'Musculoesquelético',
  nervoso: 'Nervoso',
  cardiovascular: 'Cardiovascular',
  respiratorio: 'Respiratório',
  digestorio: 'Digestório',
  endocrino: 'Endócrino',
  urinario: 'Urinário',
  reprodutor: 'Reprodutor',
  tegumentar: 'Tegumentar',
  linfatico: 'Linfático',
  sensorial: 'Sensorial',
};
const STATUS_LABEL: Record<StatusEvento, string> = {
  ativo: 'Ativo', em_tratamento: 'Em tratamento', resolvido: 'Resolvido', cronico: 'Crônico',
};
const ORIGEM_LABEL: Record<OrigemAchado, string> = {
  subjetivo_myid: 'MyID (paciente)',
  exame_clinico: 'Exame clínico',
  exame_imagem: 'Exame de imagem',
  voz_ia: 'Voz / IA',
  autocadastro_paciente: 'Autocadastro',
  outro: 'Outro',
};

interface Props {
  pacienteId: string;
}

export default function AvatarClinicoCard({ pacienteId }: Props) {
  const { data: eventos = [], isLoading } = useEventosAnatomicos(pacienteId);
  const saveMut = useSaveEventoAnatomico();
  const deleteMut = useDeleteEventoAnatomico(pacienteId);

  const [sistemasAtivos, setSistemasAtivos] = useState<SistemaCorporal[]>(SISTEMAS_F1);
  const [view, setView] = useState<'front' | 'back'>('front');
  const [sheetRegiao, setSheetRegiao] = useState<string | null>(null);
  const [editing, setEditing] = useState<Partial<EventoAnatomico> | null>(null);

  const eventosFiltrados = useMemo(
    () => eventos.filter(e => sistemasAtivos.includes(e.sistema)),
    [eventos, sistemasAtivos],
  );

  // dominante por região = maior severidade (e não-resolvido prioritário)
  const corPorRegiao = useMemo(() => {
    const map: Record<string, string> = {};
    const peso = (e: EventoAnatomico) =>
      (e.status === 'resolvido' ? 0 : 10) + e.severidade;
    eventosFiltrados.forEach(ev => {
      const prev = map[ev.regiao_id + '__peso'];
      if (!prev || (peso(ev) > Number(prev))) {
        map[ev.regiao_id] = corEvento(ev);
        map[ev.regiao_id + '__peso'] = String(peso(ev));
      }
    });
    return map;
  }, [eventosFiltrados]);

  const regioes = REGIONS.filter(r => r.view === view);
  const eventosDaRegiao = (rid: string) => eventosFiltrados.filter(e => e.regiao_id === rid);

  const abrirSheet = (rid: string) => {
    setSheetRegiao(rid);
    setEditing(null);
  };

  const novoAchado = () => {
    setEditing({
      paciente_id: pacienteId,
      regiao_id: sheetRegiao!,
      sistema: 'musculoesqueletico',
      origem: 'exame_clinico',
      tipo_achado: '',
      severidade: 1,
      status: 'ativo',
      visivel_paciente: false,
      data_inicio: new Date().toISOString().slice(0, 10),
    });
  };

  const regiao = sheetRegiao ? REGIONS.find(r => r.id === sheetRegiao) : null;
  const estruturasCat = regiao ? STRUCTURES[regiao.id] || {} : {};
  const todasEstruturas = Object.values(estruturasCat).flat();

  const handleSave = async () => {
    if (!editing?.tipo_achado?.trim()) return;
    await saveMut.mutateAsync(editing as any);
    setEditing(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Stethoscope className="icon-sm shrink-0" />
          Avatar Clínico Anatômico
          <Badge variant="outline" className="ml-auto text-[10px]">Sprint F1</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Mapa de achados clínicos por região. Complementar à Impressão Digital MyID.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Toggles de sistema */}
        <div className="flex flex-wrap gap-1.5">
          {SISTEMAS_F1.map(s => {
            const active = sistemasAtivos.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() =>
                  setSistemasAtivos(prev =>
                    prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s],
                  )
                }
                className={`text-[11px] px-2.5 py-1 rounded-full border transition ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border/50'
                }`}
              >
                {SISTEMA_LABEL[s]}
              </button>
            );
          })}
        </div>

        {/* Toggle frente / costas */}
        <div className="flex gap-1 bg-muted/40 rounded-lg p-1 w-fit mx-auto">
          {(['front', 'back'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-[11px] px-3 py-1 rounded-md transition ${
                view === v ? 'bg-background shadow-sm font-semibold' : 'text-muted-foreground'
              }`}
            >
              {v === 'front' ? 'Anterior' : 'Posterior'}
            </button>
          ))}
        </div>

        {/* Silhueta */}
        <div className="mx-auto" style={{ maxWidth: 260 }}>
          <svg viewBox="0 0 240 520" className="w-full h-auto" style={{ maxHeight: 480 }}>
            <defs>
              <clipPath id="avc-clip">
                <path d={FRONT_OUTLINE} />
              </clipPath>
            </defs>
            <g clipPath="url(#avc-clip)">
              <path d={FRONT_OUTLINE} fill="hsl(var(--muted))" opacity={0.35} />
              {regioes.map(r => {
                const fill = corPorRegiao[r.id];
                return (
                  <path
                    key={r.id}
                    d={r.d}
                    fill={fill || 'transparent'}
                    fillOpacity={fill ? 0.7 : 0}
                    stroke="hsl(var(--border))"
                    strokeWidth={0.6}
                    className="cursor-pointer hover:opacity-80"
                    onClick={() => abrirSheet(r.id)}
                  />
                );
              })}
            </g>
            <path d={FRONT_OUTLINE} fill="none" stroke="hsl(var(--foreground))" strokeWidth={1.2} opacity={0.6} />
          </svg>
        </div>

        {/* Legenda */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] justify-center text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#dc2626]" /> Ativo grave</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#fb923c]" /> Ativo leve</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316]" /> Em tratamento</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#eab308]" /> Crônico</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#9ca3af]" /> Resolvido</span>
        </div>

        {/* Lista resumida */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-2">Carregando…</p>
        ) : eventosFiltrados.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">
            Nenhum achado registrado. Toque em uma região para adicionar.
          </p>
        ) : (
          <div className="space-y-1.5">
            {eventosFiltrados.slice(0, 6).map(ev => {
              const reg = REGIONS.find(r => r.id === ev.regiao_id);
              return (
                <button
                  key={ev.id}
                  onClick={() => abrirSheet(ev.regiao_id)}
                  className="w-full flex items-center gap-2 text-left p-2 rounded-lg hover:bg-muted/40 transition"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: corEvento(ev) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">
                      {ev.tipo_achado} <span className="text-muted-foreground">· {reg?.label || ev.regiao_id}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {STATUS_LABEL[ev.status]} · {SISTEMA_LABEL[ev.sistema]} · {ORIGEM_LABEL[ev.origem]}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Sheet de região */}
      <Sheet open={!!sheetRegiao} onOpenChange={(o) => { if (!o) { setSheetRegiao(null); setEditing(null); } }}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{regiao?.label || 'Região'}</SheetTitle>
          </SheetHeader>

          {!editing && (
            <div className="mt-4 space-y-2">
              {sheetRegiao && eventosDaRegiao(sheetRegiao).length === 0 && (
                <p className="text-xs text-muted-foreground">Sem achados nessa região.</p>
              )}
              {sheetRegiao && eventosDaRegiao(sheetRegiao).map(ev => (
                <div key={ev.id} className="border border-border/50 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-start gap-2">
                    <span className="w-2.5 h-2.5 rounded-full mt-1 shrink-0" style={{ background: corEvento(ev) }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ev.tipo_achado}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {STATUS_LABEL[ev.status]} · sev {ev.severidade}/4 · {SISTEMA_LABEL[ev.sistema]}
                        {ev.estrutura && ` · ${ev.estrutura}`}
                        {ev.diagnostico_cid && ` · ${ev.diagnostico_cid}`}
                      </p>
                      {ev.notas_clinicas && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{ev.notas_clinicas}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditing(ev)}>
                        <Pencil className="icon-xs" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(ev.id)}>
                        <Trash2 className="icon-xs text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              <Button onClick={novoAchado} className="w-full" size="sm">
                <Plus className="icon-xs mr-1" /> Adicionar achado
              </Button>
            </div>
          )}

          {editing && (
            <div className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de achado *</Label>
                <Input
                  placeholder="ex: Tendinopatia, Parestesia, Dor mecânica…"
                  value={editing.tipo_achado || ''}
                  onChange={e => setEditing({ ...editing, tipo_achado: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sistema</Label>
                  <Select value={editing.sistema} onValueChange={(v: any) => setEditing({ ...editing, sistema: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SISTEMAS_F1.map(s => (
                        <SelectItem key={s} value={s}>{SISTEMA_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Origem</Label>
                  <Select value={editing.origem} onValueChange={(v: any) => setEditing({ ...editing, origem: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(ORIGEM_LABEL) as OrigemAchado[]).map(o => (
                        <SelectItem key={o} value={o}>{ORIGEM_LABEL[o]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Estrutura (opcional)</Label>
                <Select
                  value={editing.estrutura || '__none__'}
                  onValueChange={(v) => setEditing({ ...editing, estrutura: v === '__none__' ? null : v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— nenhuma —</SelectItem>
                    {todasEstruturas.map(e => (
                      <SelectItem key={e} value={e}>{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">CID-10 (opcional)</Label>
                  <Input
                    placeholder="ex: M54.5"
                    value={editing.diagnostico_cid || ''}
                    onChange={e => setEditing({ ...editing, diagnostico_cid: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Severidade (0–4)</Label>
                  <Input
                    type="number" min={0} max={4}
                    value={editing.severidade ?? 1}
                    onChange={e => setEditing({ ...editing, severidade: Math.min(4, Math.max(0, +e.target.value)) })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Status</Label>
                  <Select value={editing.status} onValueChange={(v: any) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as StatusEvento[]).map(s => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Início</Label>
                  <Input
                    type="date"
                    value={editing.data_inicio || ''}
                    onChange={e => setEditing({ ...editing, data_inicio: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Notas clínicas</Label>
                <Textarea
                  rows={3}
                  placeholder="Mecanismo, exame, conduta…"
                  value={editing.notas_clinicas || ''}
                  onChange={e => setEditing({ ...editing, notas_clinicas: e.target.value })}
                />
              </div>

              <div className="flex items-center justify-between border-t pt-3">
                <div>
                  <p className="text-xs font-medium">Visível ao paciente</p>
                  <p className="text-[10px] text-muted-foreground">
                    Versão simplificada no portal
                  </p>
                </div>
                <Switch
                  checked={!!editing.visivel_paciente}
                  onCheckedChange={(v) => setEditing({ ...editing, visivel_paciente: v })}
                />
              </div>

              <SheetFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saveMut.isPending || !editing.tipo_achado?.trim()}>
                  <Activity className="icon-xs mr-1" /> Salvar achado
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Card>
  );
}
