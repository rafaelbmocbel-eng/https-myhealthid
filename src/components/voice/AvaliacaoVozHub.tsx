import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Mic, RefreshCw, FilePlus2, Trash2, History, ArrowLeft, Loader2, Calendar, ClipboardCheck, Plus,
} from 'lucide-react';
import VoiceAssessment from './VoiceAssessment';

type ServiceType = 'identidade' | 'cobzero' | 'studio';

interface Props {
  pacienteId: string;
  patientName: string;
  serviceType?: ServiceType;
  contextPrefix?: string;
  perfilProfissional?: string;
  onAssessmentComplete?: () => void;
  onPainExtracted?: (findings: Array<{ region_id: string; intensity: number; structures: string[] }>) => void;
  painRegionsCatalog?: { regions: Array<{ id: string; label: string }>; catalog?: Record<string, { categories: Record<string, string[]> }> };
  painMap?: Record<string, number>;
}

interface AvalRow {
  id: string;
  created_at: string;
  updated_at: string;
  queixa_principal: string | null;
  classificacao_severidade: string | null;
  resultado: any;
  transcricao: string | null;
}

type View = 'loading' | 'summary' | 'new' | 'update' | 'history';

function summarizeForAI(a: AvalRow): string {
  const r = a.resultado || {};
  const parts: string[] = [];
  parts.push('--- AVALIAÇÃO ANTERIOR (use como base; atualize, não repita) ---');
  if (a.queixa_principal) parts.push(`Queixa anterior: ${a.queixa_principal}`);
  if (r.resumo_clinico) parts.push(`Resumo: ${r.resumo_clinico}`);
  if (r.dor?.descricao) parts.push(`Dor anterior (EVA ${r.dor.eva ?? '-'}): ${r.dor.descricao}`);
  if (Array.isArray(r.hipoteses_diagnosticas) && r.hipoteses_diagnosticas.length) {
    parts.push(`Hipóteses anteriores: ${r.hipoteses_diagnosticas.map((h: any) => h?.hipotese || h).filter(Boolean).join('; ')}`);
  }
  if (r.funcionalidade) parts.push(`Funcionalidade: ${typeof r.funcionalidade === 'string' ? r.funcionalidade : JSON.stringify(r.funcionalidade).slice(0, 400)}`);
  parts.push('--- FIM AVALIAÇÃO ANTERIOR ---');
  parts.push('Agora descrevo a EVOLUÇÃO/ATUALIZAÇÃO desta sessão:');
  return parts.join('\n');
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function AvaliacaoVozHub(props: Props) {
  const { pacienteId, patientName, serviceType = 'identidade', contextPrefix, perfilProfissional, onAssessmentComplete, onPainExtracted, painRegionsCatalog, painMap } = props;
  const { toast } = useToast();
  const [view, setView] = useState<View>('loading');
  const [rows, setRows] = useState<AvalRow[]>([]);
  const [toDelete, setToDelete] = useState<AvalRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('avaliacoes_voz')
      .select('id, created_at, updated_at, queixa_principal, classificacao_severidade, resultado, transcricao')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });
    if (error) {
      toast({ title: 'Erro ao carregar avaliações', description: error.message, variant: 'destructive' });
      setRows([]);
    } else {
      setRows((data as any) || []);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setView(v => (v === 'loading' ? 'summary' : v));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const last = rows[0] ?? null;

  const updatePrefix = useMemo(() => {
    if (view !== 'update' || !last) return contextPrefix;
    return [summarizeForAI(last), contextPrefix].filter(Boolean).join('\n\n');
  }, [view, last, contextPrefix]);

  const handleDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    const { error } = await supabase.from('avaliacoes_voz').delete().eq('id', toDelete.id);
    setBusy(false);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Avaliação excluída', description: 'Removida do histórico.' });
      setToDelete(null);
      await load();
    }
  };

  const afterComplete = async () => {
    await load();
    setView('summary');
    onAssessmentComplete?.();
  };

  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando avaliações…
      </div>
    );
  }

  // ===== NEW =====
  if (view === 'new') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('summary')} className="text-xs">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
          </Button>
          <Badge variant="outline" className="text-[10px]">Nova avaliação · anterior fica no histórico</Badge>
        </div>
        <VoiceAssessment
          key={`new-${Date.now()}`}
          mode="voice"
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          contextPrefix={contextPrefix}
          onAssessmentComplete={afterComplete}
          onPainExtracted={onPainExtracted}
          painRegionsCatalog={painRegionsCatalog}
          painMap={painMap}
          perfilProfissional={perfilProfissional}
        />
      </div>
    );
  }

  // ===== UPDATE =====
  if (view === 'update' && last) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('summary')} className="text-xs">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
          </Button>
          <Badge variant="outline" className="text-[10px] bg-primary/5">
            <RefreshCw className="h-3 w-3 mr-1" /> Atualizando avaliação de {fmtDate(last.created_at)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground rounded-md bg-muted/40 p-2">
          A IA usará a avaliação anterior como base. Grave/descreva apenas o que mudou — a versão será reescrita e <strong>substituirá</strong> a anterior (mantendo a data original).
        </p>
        <VoiceAssessment
          key={`update-${last.id}`}
          mode="voice"
          serviceType={serviceType}
          pacienteId={pacienteId}
          patientName={patientName}
          contextPrefix={updatePrefix}
          updateExistingId={last.id}
          onAssessmentComplete={afterComplete}
          onPainExtracted={onPainExtracted}
          painRegionsCatalog={painRegionsCatalog}
          painMap={painMap}
          perfilProfissional={perfilProfissional}
        />
      </div>
    );
  }

  // ===== HISTORY =====
  if (view === 'history') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setView('summary')} className="text-xs">
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Voltar
          </Button>
          <Badge variant="secondary" className="text-[10px]">{rows.length} avaliações</Badge>
        </div>
        {rows.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Nenhuma avaliação ainda.</div>
        ) : (
          <ul className="space-y-2">
            {rows.map(r => (
              <li key={r.id} className="rounded-xl border border-border/40 shadow-xs p-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" /> {fmtDate(r.created_at)}
                    {r.classificacao_severidade && (
                      <Badge variant="outline" className="text-[10px]">{r.classificacao_severidade}</Badge>
                    )}
                  </div>
                  <div className="text-sm mt-1 line-clamp-2">
                    {r.queixa_principal || r.resultado?.resumo_clinico || r.transcricao?.slice(0, 140) || 'Sem resumo'}
                  </div>
                </div>
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0"
                  onClick={() => setToDelete(r)}
                  title="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação remove permanentemente a avaliação de <strong>{toDelete && fmtDate(toDelete.created_at)}</strong> do histórico. Notas já enviadas ao prontuário não são afetadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // ===== SUMMARY (default) =====
  if (!last) {
    // Nenhuma avaliação — abre direto em modo "new"
    return (
      <div className="space-y-3">
        <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
          <Mic className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-3">Este paciente ainda não tem avaliação por voz.</p>
          <Button size="sm" onClick={() => setView('new')}>
            <Plus className="h-4 w-4 mr-1" /> Iniciar primeira avaliação
          </Button>
        </div>
      </div>
    );
  }

  const r = last.resultado || {};
  const eva = r?.dor?.eva;
  const hipoteses: any[] = Array.isArray(r.hipoteses_diagnosticas) ? r.hipoteses_diagnosticas : [];

  return (
    <div className="space-y-3">
      {/* Card resumo da última avaliação */}
      <div className="rounded-xl border border-border/40 shadow-xs p-4 sm:p-5 bg-card space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
              <span>Última avaliação por voz</span>
              <span>·</span>
              <Calendar className="h-3 w-3" />
              <span>{fmtDate(last.created_at)}</span>
            </div>
            <h3 className="text-base font-semibold mt-1 line-clamp-2">
              {last.queixa_principal || r.resumo_clinico?.slice(0, 120) || 'Avaliação registrada'}
            </h3>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {last.classificacao_severidade && (
              <Badge variant="outline" className="text-[11px]">{last.classificacao_severidade}</Badge>
            )}
            {typeof eva === 'number' && (
              <Badge variant="secondary" className="text-[11px]">EVA {eva}/10</Badge>
            )}
            {hipoteses.length > 0 && (
              <span className="text-[10px] text-muted-foreground">{hipoteses.length} hipótese(s)</span>
            )}
          </div>
        </div>

        {r.resumo_clinico && (
          <p className="text-sm text-muted-foreground line-clamp-3">{r.resumo_clinico}</p>
        )}

        {/* Ações principais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <Button size="sm" onClick={() => setView('update')} className="w-full">
            <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setView('new')} className="w-full">
            <FilePlus2 className="h-4 w-4 mr-1" /> Nova
          </Button>
          <Button size="sm" variant="outline" onClick={() => setView('history')} className="w-full">
            <History className="h-4 w-4 mr-1" /> Histórico
            {rows.length > 1 && <span className="ml-1 text-[10px] text-muted-foreground">({rows.length})</span>}
          </Button>
          <Button
            size="sm" variant="outline"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => setToDelete(last)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Excluir
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground border-t pt-2">
          <strong>Atualizar</strong> reprocessa com IA usando esta avaliação como base e substitui a versão atual.
          <strong> Nova</strong> mantém esta no histórico.
        </p>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir avaliação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove permanentemente a avaliação de <strong>{toDelete && fmtDate(toDelete.created_at)}</strong>. Notas já enviadas ao prontuário não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={busy} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
