import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Pencil, Check, X, CheckCircle2, Circle, Loader2,
  FileText, Brain, Activity, HeartPulse, AlertTriangle,
  Target, Tags, ListChecks, Stethoscope,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { buildSoapFromVoice } from '@/components/prontuario/SoapNoteForm';

interface Props {
  pacienteId: string;
  avaliacaoId: string;
  resultado: any;
  transcricao?: string | null;
}

type SecaoKey =
  | 'soap'
  | 'resumo_clinico'
  | 'dor'
  | 'funcionalidade'
  | 'psicossocial'
  | 'red_flags'
  | 'hipoteses'
  | 'cif'
  | 'diretriz';

interface SecaoDef {
  key: SecaoKey;
  titulo: string;
  emoji: string;
  Icon: React.ComponentType<{ className?: string }>;
  builder: (r: any, transcricao?: string | null) => string;
}

function arrText(arr: any): string {
  if (!arr) return '';
  if (Array.isArray(arr)) return arr.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(', ');
  return String(arr);
}

function objToText(obj: any): string {
  if (!obj) return '';
  if (typeof obj === 'string') return obj;
  if (Array.isArray(obj)) return obj.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');
  return Object.entries(obj)
    .map(([k, v]) => `${k.replace(/_/g, ' ')}: ${typeof v === 'string' ? v : Array.isArray(v) ? arrText(v) : JSON.stringify(v)}`)
    .join('\n');
}

const SECOES: SecaoDef[] = [
  {
    key: 'soap',
    titulo: 'SOAP',
    emoji: '📝',
    Icon: FileText,
    builder: (r, t) => {
      const s = buildSoapFromVoice(r, t || undefined);
      return `S — SUBJETIVO\n${s.subjectivo}\n\nO — OBJETIVO\n${s.objetivo}\n\nA — AVALIAÇÃO\n${s.avaliacao}\n\nP — PLANO\n${s.plano}`;
    },
  },
  {
    key: 'resumo_clinico',
    titulo: 'Resumo Clínico',
    emoji: '📋',
    Icon: Stethoscope,
    builder: (r) => r?.resumo_clinico || '',
  },
  {
    key: 'dor',
    titulo: 'Análise da Dor',
    emoji: '🩹',
    Icon: HeartPulse,
    builder: (r) => {
      const d = r?.dor;
      if (!d) return '';
      const lines = [
        d.localizacao && `Localização: ${d.localizacao}`,
        d.intensidade_eva != null && `EVA: ${d.intensidade_eva}/10`,
        d.tipo && `Tipo: ${d.tipo}`,
        d.fatores_agravantes && `Agrava: ${arrText(d.fatores_agravantes)}`,
        (d.fatores_aliviantes || d.fatores_atenuantes) && `Alivia: ${arrText(d.fatores_aliviantes || d.fatores_atenuantes)}`,
      ].filter(Boolean);
      return lines.join('\n');
    },
  },
  {
    key: 'funcionalidade',
    titulo: 'Funcionalidade',
    emoji: '🏃',
    Icon: Activity,
    builder: (r) => objToText(r?.funcionalidade),
  },
  {
    key: 'psicossocial',
    titulo: 'Fatores Psicossociais',
    emoji: '🧠',
    Icon: Brain,
    builder: (r) => objToText(r?.fatores_psicossociais || r?.psicossocial),
  },
  {
    key: 'red_flags',
    titulo: 'Red Flags',
    emoji: '🚨',
    Icon: AlertTriangle,
    builder: (r) => {
      const rf = r?.red_flags || r?.redflags;
      if (!rf || (Array.isArray(rf) && rf.length === 0)) return '';
      if (Array.isArray(rf)) {
        return rf.map((f: any, i: number) => `${i + 1}. ${typeof f === 'string' ? f : f.descricao || f.flag || JSON.stringify(f)}`).join('\n');
      }
      return objToText(rf);
    },
  },
  {
    key: 'hipoteses',
    titulo: 'Hipóteses Diagnósticas',
    emoji: '🎯',
    Icon: Target,
    builder: (r) => {
      const h = r?.hipoteses_diagnosticas;
      if (!Array.isArray(h) || h.length === 0) return '';
      return h.map((x: any, i: number) =>
        `${i + 1}. ${x.diagnostico || x.hipotese || ''}${x.probabilidade ? ` (${x.probabilidade})` : ''}${x.evidencia ? `\n   Evidência: ${x.evidencia}` : ''}`
      ).join('\n');
    },
  },
  {
    key: 'cif',
    titulo: 'Mapeamento CIF',
    emoji: '🏷️',
    Icon: Tags,
    builder: (r) => {
      const c = r?.cif_codes;
      if (!Array.isArray(c) || c.length === 0) return '';
      return c.map((x: any) => `• ${x.codigo || x.code || ''} — ${x.descricao || x.label || x.titulo || ''}${x.severidade != null ? ` (sev ${x.severidade})` : ''}`).join('\n');
    },
  },
  {
    key: 'diretriz',
    titulo: 'Diretriz de Tratamento',
    emoji: '🎯',
    Icon: ListChecks,
    builder: (r) => {
      const d = r?.diretriz_tratamento;
      if (!d || typeof d !== 'object') return '';
      const fases = Object.entries(d);
      if (fases.length === 0) return '';
      return fases.map(([k, v]: [string, any]) => {
        const titulo = k.replace(/_/g, ' ').replace(/\bfase\b/i, 'Fase').replace(/^\w/, (c) => c.toUpperCase());
        const exs = v?.exercicios || v?.exercises;
        const tecs = v?.tecnicas || v?.techniques;
        const parts: string[] = [`▸ ${titulo}`];
        if (v?.objetivo) parts.push(`   Objetivo: ${v.objetivo}`);
        if (v?.frequencia || v?.frequencia_sugerida) parts.push(`   Frequência: ${v.frequencia || v.frequencia_sugerida}`);
        if (Array.isArray(exs) && exs.length) parts.push(`   Exercícios:\n${exs.map((e: any) => `     • ${typeof e === 'string' ? e : e.nome || JSON.stringify(e)}`).join('\n')}`);
        if (Array.isArray(tecs) && tecs.length) parts.push(`   Técnicas:\n${tecs.map((t: any) => `     • ${typeof t === 'string' ? t : t.nome || JSON.stringify(t)}`).join('\n')}`);
        if (v?.criterios_progressao || v?.criterios) parts.push(`   Critérios: ${v.criterios_progressao || v.criterios}`);
        return parts.join('\n');
      }).join('\n\n');
    },
  },
];

export default function AvaliacaoSecoesEditaveis({ pacienteId, avaliacaoId, resultado, transcricao }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Initial texts from assessment + persisted edits
  const meta = resultado?._secoes || {};
  const editadasIniciais: Record<string, string> = meta.editadas || {};
  const confirmadasIniciais: SecaoKey[] = Array.isArray(meta.confirmadas) ? meta.confirmadas : [];

  const [textos, setTextos] = useState<Record<SecaoKey, string>>(() => {
    const init = {} as Record<SecaoKey, string>;
    SECOES.forEach((s) => {
      init[s.key] = editadasIniciais[s.key] ?? s.builder(resultado, transcricao);
    });
    return init;
  });
  const [confirmadas, setConfirmadas] = useState<Set<SecaoKey>>(new Set(confirmadasIniciais));
  const [editando, setEditando] = useState<SecaoKey | null>(null);
  const [rascunho, setRascunho] = useState<string>('');
  const [saving, setSaving] = useState<SecaoKey | null>(null);

  // Look up existing note for this avaliacao
  const { data: notaExistente } = useQuery({
    queryKey: ['nota-avaliacao-presencial', avaliacaoId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('notas_prontuario')
        .select('id')
        .eq('paciente_id', pacienteId)
        .eq('tipo', 'avaliacao_presencial')
        .eq('referencia_id', avaliacaoId)
        .maybeSingle();
      return data;
    },
    enabled: !!avaliacaoId && !!pacienteId,
  });

  const secoesDisponiveis = useMemo(
    () => SECOES.filter((s) => textos[s.key]?.trim().length > 0),
    [textos]
  );

  const iniciarEdicao = (key: SecaoKey) => {
    setRascunho(textos[key] || '');
    setEditando(key);
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setRascunho('');
  };

  const salvarEdicao = async (key: SecaoKey) => {
    setSaving(key);
    try {
      const novosTextos = { ...textos, [key]: rascunho };
      setTextos(novosTextos);

      // Persist edit in avaliacoes_voz.resultado._secoes.editadas
      const novoResultado = {
        ...resultado,
        _secoes: {
          ...(resultado?._secoes || {}),
          editadas: { ...editadasIniciais, [key]: rascunho },
          confirmadas: Array.from(confirmadas),
        },
      };
      await supabase.from('avaliacoes_voz').update({ resultado: novoResultado }).eq('id', avaliacaoId);

      // If section is already confirmed, sync the prontuario note
      if (confirmadas.has(key)) {
        await sincronizarProntuario(confirmadas, novosTextos);
      }

      setEditando(null);
      toast({ title: 'Edição salva' });
      qc.invalidateQueries({ queryKey: ['avaliacao-voz-latest', pacienteId] });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const toggleConfirmacao = async (key: SecaoKey) => {
    const nova = new Set(confirmadas);
    const estavaConfirmada = nova.has(key);
    if (estavaConfirmada) nova.delete(key);
    else nova.add(key);

    setSaving(key);
    try {
      setConfirmadas(nova);

      // Persist confirmadas in avaliacoes_voz
      const novoResultado = {
        ...resultado,
        _secoes: {
          ...(resultado?._secoes || {}),
          editadas: editadasIniciais,
          confirmadas: Array.from(nova),
        },
      };
      await supabase.from('avaliacoes_voz').update({ resultado: novoResultado }).eq('id', avaliacaoId);

      await sincronizarProntuario(nova, textos);

      toast({
        title: estavaConfirmada ? 'Removida do prontuário' : '✅ Enviada ao prontuário',
      });
      qc.invalidateQueries({ queryKey: ['notas-prontuario'] });
      qc.invalidateQueries({ queryKey: ['prontuario'] });
      qc.invalidateQueries({ queryKey: ['nota-avaliacao-presencial', avaliacaoId] });
    } catch (e: any) {
      // rollback UI
      setConfirmadas(new Set(estavaConfirmada ? [...confirmadas] : [...confirmadas].filter((k) => k !== key)));
      toast({ title: 'Erro', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(null);
    }
  };

  const sincronizarProntuario = async (
    setConf: Set<SecaoKey>,
    textosAtuais: Record<SecaoKey, string>,
  ) => {
    if (!user) return;
    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const incluidas = SECOES.filter((s) => setConf.has(s.key) && textosAtuais[s.key]?.trim());

    // If nothing confirmed, delete the note
    if (incluidas.length === 0) {
      if (notaExistente?.id) {
        await (supabase as any).from('notas_prontuario').delete().eq('id', notaExistente.id);
      }
      return;
    }

    const partes: string[] = [`📅 AVALIAÇÃO PRESENCIAL — ${dataAtual}`];
    incluidas.forEach((s) => {
      partes.push(`\n${s.emoji} ${s.titulo.toUpperCase()}\n${textosAtuais[s.key]}`);
    });
    const descricao = partes.join('\n');

    const payload = {
      paciente_id: pacienteId,
      terapeuta_id: user.id,
      tipo: 'avaliacao_presencial',
      titulo: `Avaliação Presencial — ${dataAtual}`,
      descricao,
      dados_extras: {
        versao_revisao: 3,
        modo: 'secoes_independentes',
        data_avaliacao: new Date().toISOString(),
        avaliacao_voz_id: avaliacaoId,
        secoes_confirmadas: incluidas.map((s) => s.key),
      },
      referencia_id: avaliacaoId,
    };

    if (notaExistente?.id) {
      await (supabase as any).from('notas_prontuario').update(payload).eq('id', notaExistente.id);
    } else {
      const { data } = await (supabase as any).from('notas_prontuario').insert(payload).select('id').single();
      // Update cache so subsequent toggles see the id
      qc.setQueryData(['nota-avaliacao-presencial', avaliacaoId], data);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="h-section">Seções da Avaliação</h3>
          <p className="text-caption text-muted-foreground">
            Edite cada parte e confirme as que devem ir para o prontuário.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {confirmadas.size}/{secoesDisponiveis.length} no prontuário
        </Badge>
      </div>

      {secoesDisponiveis.map((s) => {
        const confirmada = confirmadas.has(s.key);
        const editandoEsta = editando === s.key;
        const savingEsta = saving === s.key;
        const Icon = s.Icon;

        return (
          <Card
            key={s.key}
            className={`rounded-xl border-border/40 shadow-xs transition ${
              confirmada ? 'border-emerald-500/40 bg-emerald-500/5' : ''
            }`}
          >
            <CardHeader className="pb-2 flex flex-row items-start justify-between gap-2 space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Icon className="icon-sm text-primary shrink-0" />
                <span>{s.emoji} {s.titulo}</span>
                {confirmada && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 text-[10px] gap-1">
                    <CheckCircle2 className="icon-xs" /> No prontuário
                  </Badge>
                )}
              </CardTitle>
              {!editandoEsta && (
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 gap-1"
                    onClick={() => iniciarEdicao(s.key)}
                    disabled={savingEsta}
                  >
                    <Pencil className="icon-xs" />
                    <span className="text-xs">Editar</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={confirmada ? 'outline' : 'default'}
                    className="h-7 px-2 gap-1"
                    onClick={() => toggleConfirmacao(s.key)}
                    disabled={savingEsta}
                  >
                    {savingEsta ? (
                      <Loader2 className="icon-xs animate-spin" />
                    ) : confirmada ? (
                      <Circle className="icon-xs" />
                    ) : (
                      <Check className="icon-xs" />
                    )}
                    <span className="text-xs">
                      {confirmada ? 'Remover' : 'Confirmar'}
                    </span>
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="pt-0">
              {editandoEsta ? (
                <div className="space-y-2">
                  <Textarea
                    value={rascunho}
                    onChange={(e) => setRascunho(e.target.value)}
                    rows={Math.min(20, Math.max(4, rascunho.split('\n').length + 1))}
                    className="text-sm font-mono"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={cancelarEdicao} disabled={savingEsta}>
                      <X className="icon-xs mr-1" /> Cancelar
                    </Button>
                    <Button size="sm" onClick={() => salvarEdicao(s.key)} disabled={savingEsta}>
                      {savingEsta ? <Loader2 className="icon-xs animate-spin mr-1" /> : <Check className="icon-xs mr-1" />}
                      Salvar edição
                    </Button>
                  </div>
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap font-sans text-foreground/90 leading-relaxed">
                  {textos[s.key]}
                </pre>
              )}
            </CardContent>
          </Card>
        );
      })}

      {secoesDisponiveis.length === 0 && (
        <Card className="rounded-xl border-dashed">
          <CardContent className="p-6 text-center text-caption text-muted-foreground">
            Nenhuma seção disponível nesta avaliação.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
