import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bluetooth, Loader2, Save, Target } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { celula, type StatusCelula } from '@/lib/dinamometria/celulaBle';
import { REGIOES, UF, movimentosDaAnalise, nomeSlot, type Lado, type Slot } from '@/lib/dinamometria/analise';
import ExecucaoProtocoloDialog, { type Etapa, type ResultadoEtapa } from '@/components/dinamometria/ExecucaoProtocoloDialog';
import { cn } from '@/lib/utils';

type TipoAlvo = 'pct' | 'kg';
interface Registro { titulo: string; alvoKg: number | null; picosKg: number[]; segundosNoAlvo: number }

const fmt = (v: number | null | undefined, d = 1) => (v == null ? '—' : v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }));

// Treino isométrico com a célula: alvo por % do pico do último teste (por
// músculo e lado) ou em kg, tempo no alvo e registro da sessão no prontuário.
export default function DinamometriaTreino() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusCelula>(celula.status);
  useEffect(() => celula.onStatus(setStatus), []);

  const [cfg, setCfg] = useState(() => {
    const padrao = { regiao: 'joelho', grupo: 'ag' as 'ag' | 'an', lados: 'DE' as 'D' | 'E' | 'DE', tipoAlvo: 'pct' as TipoAlvo, pct: 70, kg: 20, tolerancia: 10, tempoForca: 10, repeticoes: 5, descanso: 30, preparo: 3 };
    try { return { ...padrao, ...JSON.parse(localStorage.getItem('mh.din.treino') || '{}') }; } catch { return padrao; }
  });
  useEffect(() => { try { localStorage.setItem('mh.din.treino', JSON.stringify(cfg)); } catch { /* sem armazenamento — só não lembra */ } }, [cfg]);
  const [aberto, setAberto] = useState(false);
  const [feitos, setFeitos] = useState<Registro[]>([]);
  const [salvando, setSalvando] = useState(false);

  const { data: paciente } = useQuery({
    queryKey: ['din-treino-paciente', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any).from('pacientes').select('id, nome, sobrenome').eq('id', id).maybeSingle();
      return data as { id: string; nome: string; sobrenome: string | null } | null;
    },
  });

  // Pico de cada músculo/lado no último teste de força (kgf).
  const { data: ultimoTeste } = useQuery({
    queryKey: ['din-treino-ultimo', id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any).from('exames_presenciais').select('data_exame, dados')
        .eq('paciente_id', id).eq('tipo', 'dinamometria').order('data_exame', { ascending: false }).order('created_at', { ascending: false }).limit(1);
      const e = (data || [])[0];
      if (!e) return null;
      const picos: Record<string, number> = {};
      for (const m of movimentosDaAnalise(e.dados?.analise)) {
        for (const [k, v] of Object.entries(m.slots)) if (v?.metricas?.pico) picos[`${m.regiao}:${k}`] = v.metricas.pico / UF.kgf;
      }
      return { data: e.data_exame as string, picos };
    },
  });

  const lados: Lado[] = cfg.lados === 'DE' ? ['D', 'E'] : [cfg.lados as Lado];
  const etapas: Etapa[] = useMemo(() => lados.map((l) => {
    const k = `${cfg.grupo}${l}` as Slot;
    const pico = ultimoTeste?.picos[`${cfg.regiao}:${k}`] ?? null;
    const alvoKg = cfg.tipoAlvo === 'kg' ? cfg.kg : (pico ? (pico * cfg.pct) / 100 : null);
    return { id: `${cfg.regiao}:${k}`, titulo: nomeSlot(cfg.regiao, k), alvoKg };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [cfg, ultimoTeste]);
  const semAlvo = etapas.some((e) => !e.alvoKg);

  const aoEtapa = (etapaId: string, r: ResultadoEtapa) => {
    const e = etapas.find((x) => x.id === etapaId);
    setFeitos((p) => [...p, { titulo: e?.titulo || etapaId, alvoKg: e?.alvoKg ?? null, picosKg: r.picosKg, segundosNoAlvo: r.segundosNoAlvo }]);
  };

  const salvar = async () => {
    if (!user || !id || !feitos.length) return;
    setSalvando(true);
    try {
      const linhas = feitos.map((f) => {
        const media = f.picosKg.length ? f.picosKg.reduce((a, b) => a + b, 0) / f.picosKg.length : 0;
        return `• ${f.titulo}: alvo ${fmt(f.alvoKg)} kgf · picos ${f.picosKg.map((p) => fmt(p)).join(' / ')} kgf (média ${fmt(media)}) · ${fmt(f.segundosNoAlvo)} s no alvo`;
      });
      const { error } = await (supabase as any).from('notas_prontuario').insert({
        paciente_id: id,
        terapeuta_id: user.id,
        tipo: 'treino_dinamometria',
        titulo: `Treino isométrico — ${REGIOES[cfg.regiao]?.l || cfg.regiao}`,
        descricao: `${cfg.repeticoes}× ${cfg.tempoForca}s, descanso ${cfg.descanso}s, faixa ±${cfg.tolerancia}%.\n${linhas.join('\n')}`,
        dados_extras: { config: cfg, series: feitos },
      });
      if (error) throw error;
      toast.success('Treino salvo no prontuário');
      setFeitos([]);
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui salvar o treino.');
    } finally {
      setSalvando(false);
    }
  };

  const Rg = REGIOES[cfg.regiao];
  const nome = paciente ? `${paciente.nome} ${paciente.sobrenome || ''}`.trim() : 'Paciente';

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <PageHeader title="Treino com dinamometria" subtitle={nome} eyebrow="Dinamometria" icon={<Target className="icon-md" />} back={`/dinamometria?paciente=${id}`} />

        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="font-semibold">Exercício</p>
            {status.conectado ? (
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{status.nome}</span>
            ) : (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => celula.conectar().catch((e: any) => { if (e?.name !== 'NotFoundError') toast.error(e?.message || 'Não consegui conectar.'); })}>
                <Bluetooth className="h-3.5 w-3.5" /> Conectar célula
              </Button>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Articulação</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(REGIOES).map(([k, r]) => (
                <button key={k} type="button" onClick={() => setCfg((c: typeof cfg) => ({ ...c, regiao: k }))} aria-pressed={cfg.regiao === k}
                  className={cn('rounded-full border px-3 py-1 text-sm transition-colors', cfg.regiao === k ? 'border-primary bg-primary/10 font-medium' : 'border-border text-muted-foreground hover:bg-muted')}>
                  {r.l}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Músculo</Label>
              <Select value={cfg.grupo} onValueChange={(v) => setCfg((c: typeof cfg) => ({ ...c, grupo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="ag">{Rg?.ag}</SelectItem><SelectItem value="an">{Rg?.an}</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lado</Label>
              <Select value={cfg.lados} onValueChange={(v) => setCfg((c: typeof cfg) => ({ ...c, lados: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="DE">Direito e esquerdo</SelectItem><SelectItem value="D">Só direito</SelectItem><SelectItem value="E">Só esquerdo</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <p className="font-semibold">Alvo e volume</p>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {([['pct', '% do último teste'], ['kg', 'Carga em kg']] as [TipoAlvo, string][]).map(([m, l]) => (
              <button key={m} type="button" onClick={() => setCfg((c: typeof cfg) => ({ ...c, tipoAlvo: m }))} aria-pressed={cfg.tipoAlvo === m}
                className={cn('rounded-md px-3 py-1 text-xs', cfg.tipoAlvo === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {cfg.tipoAlvo === 'pct' ? (
              <div className="space-y-1"><Label className="text-xs">Intensidade (% do pico)</Label><Input inputMode="numeric" value={cfg.pct} onChange={(e) => setCfg((c: typeof cfg) => ({ ...c, pct: Math.min(100, Math.max(5, Number(e.target.value) || 0)) }))} /></div>
            ) : (
              <div className="space-y-1"><Label className="text-xs">Alvo (kgf)</Label><Input inputMode="decimal" value={cfg.kg} onChange={(e) => setCfg((c: typeof cfg) => ({ ...c, kg: Math.max(0.5, Number(e.target.value.replace(',', '.')) || 0) }))} /></div>
            )}
            <div className="space-y-1"><Label className="text-xs">Faixa aceita (± %)</Label><Input inputMode="numeric" value={cfg.tolerancia} onChange={(e) => setCfg((c: typeof cfg) => ({ ...c, tolerancia: Math.min(50, Math.max(2, Number(e.target.value) || 0)) }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Sustentação (s)</Label><Input inputMode="numeric" value={cfg.tempoForca} onChange={(e) => setCfg((c: typeof cfg) => ({ ...c, tempoForca: Math.max(1, Number(e.target.value) || 0) }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Repetições</Label><Input inputMode="numeric" value={cfg.repeticoes} onChange={(e) => setCfg((c: typeof cfg) => ({ ...c, repeticoes: Math.min(20, Math.max(1, Number(e.target.value) || 0)) }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Descanso (s)</Label><Input inputMode="numeric" value={cfg.descanso} onChange={(e) => setCfg((c: typeof cfg) => ({ ...c, descanso: Math.max(0, Number(e.target.value) || 0) }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Contagem antes (s)</Label><Input inputMode="numeric" value={cfg.preparo} onChange={(e) => setCfg((c: typeof cfg) => ({ ...c, preparo: Math.max(1, Number(e.target.value) || 0) }))} /></div>
          </div>
          <div className="text-xs space-y-0.5">
            {etapas.map((e) => (
              <p key={e.id}>{e.titulo}: <b>{e.alvoKg ? `${fmt(e.alvoKg)} kgf` : 'sem alvo'}</b>
                {cfg.tipoAlvo === 'pct' && ultimoTeste?.picos[e.id] ? <span className="text-muted-foreground"> ({cfg.pct}% de {fmt(ultimoTeste.picos[e.id])} kgf)</span> : null}
              </p>
            ))}
            {cfg.tipoAlvo === 'pct' && semAlvo && (
              <p className="text-amber-700 dark:text-amber-400">Sem teste de força salvo para este músculo/lado. Faça o teste primeiro ou use "Carga em kg".</p>
            )}
            {ultimoTeste && <p className="text-muted-foreground">Último teste: {new Date(`${ultimoTeste.data}T12:00:00`).toLocaleDateString('pt-BR')}</p>}
          </div>
          <Button className="w-full h-11 gap-2" disabled={!status.conectado || semAlvo} onClick={() => setAberto(true)}>
            <Target className="h-4 w-4" /> Iniciar treino
          </Button>
        </Card>

        {feitos.length > 0 && (
          <Card className="p-4 space-y-2">
            <p className="font-semibold">Séries desta sessão</p>
            {feitos.map((f, i) => {
              const media = f.picosKg.length ? f.picosKg.reduce((a, b) => a + b, 0) / f.picosKg.length : 0;
              return (
                <div key={i} className="text-sm border-b last:border-0 pb-1.5">
                  <p className="font-medium">{f.titulo} <span className="text-xs text-muted-foreground font-normal">alvo {fmt(f.alvoKg)} kgf</span></p>
                  <p className="text-xs text-muted-foreground tabular-nums">Picos {f.picosKg.map((p) => fmt(p)).join(' · ')} kgf · média {fmt(media)} · {fmt(f.segundosNoAlvo)} s no alvo</p>
                </div>
              );
            })}
            <Button className="gap-1.5" onClick={salvar} disabled={salvando}>
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar treino no prontuário
            </Button>
          </Card>
        )}

        <ExecucaoProtocoloDialog
          open={aberto}
          onOpenChange={setAberto}
          etapas={etapas}
          config={{ tempoForca: cfg.tempoForca, repeticoes: cfg.repeticoes, descanso: cfg.descanso, preparo: cfg.preparo, tolerancia: cfg.tolerancia / 100 }}
          modo="treino"
          onEtapa={aoEtapa}
          onFim={() => toast.success('Treino concluído. Salve no prontuário.')}
        />
      </div>
    </AppLayout>
  );
}
