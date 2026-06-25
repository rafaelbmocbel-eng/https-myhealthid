import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import JSZip from 'jszip';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Download, Loader2, CheckCircle2, AlertCircle, FileArchive, Database } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// Tables to export. Supabase RLS already scopes rows to the logged-in user (terapeuta_id),
// so a plain SELECT * returns only what the user owns.
const TABLES: string[] = [
  'profiles', 'config_agenda', 'config_clinica', 'perfis_profissionais',
  'clinicas', 'clinica_membros', 'equipe_membros',
  'pacientes', 'paciente_servicos', 'paciente_missoes',
  'agendamentos', 'agenda_lista_espera', 'ausencias_terapeuta',
  'controle_sessoes', 'pacotes_sessoes',
  'avaliacoes', 'avaliacoes_identidade', 'avaliacoes_cob_zero', 'avaliacoes_voz',
  'myid_avaliacoes', 'myid_acoes_checklist',
  'protocolos', 'protocolo_fases', 'protocolo_tratamentos', 'protocolo_progressao', 'protocolo_templates', 'protocolos_cob_zero',
  'notas_prontuario', 'evolucao_paciente', 'historia_vida_paciente', 'diagnosticos_paciente',
  'antropometria', 'body_composition', 'sinais_vitais', 'testes_funcionais_paciente',
  'exames_importados', 'atestados_medicos', 'documentos_emitidos',
  'prescricoes_exercicios', 'prescricoes_paciente', 'progresso_exercicios', 'exercicios_biblioteca',
  'planos_treino', 'planos_alimentares', 'recordatorios_24h', 'meal_logs', 'water_logs', 'daily_logs', 'sleep_logs', 'health_metrics',
  'studio_treinos', 'studio_treino_exercicios', 'studio_execucoes', 'studio_execucao_exercicios', 'studio_medidas', 'studio_notas', 'studio_periodizacoes',
  'pagamentos_paciente', 'pagamentos_paciente_auditoria', 'despesas', 'vendas', 'repasse_config', 'convenios', 'assinaturas',
  'tiss_config', 'tiss_guias', 'tiss_guia_procedimentos', 'tiss_lotes',
  'funil_config', 'funil_leads', 'links_avaliacao', 'links_agenda_paciente', 'links_rastreaveis',
  'eventos', 'evento_inscricoes', 'evento_perguntas', 'evento_respostas', 'eventos_clinicos_anatomicos',
  'crm_cadencias', 'crm_cadencia_passos', 'crm_cadencia_execucoes',
  'chat_mensagens', 'mensagens_whatsapp', 'whatsapp_conversas', 'whatsapp_mensagens_inbox',
  'whatsapp_automacoes', 'whatsapp_templates', 'whatsapp_hsm_templates', 'whatsapp_notas',
  'whatsapp_contatos_bloqueados', 'whatsapp_filtros_salvos', 'whatsapp_intencoes',
  'notificacoes', 'notificacao_envios', 'notificacao_regras', 'notificacao_inteligente_config',
  'preferencias_notificacao', 'tracking_config',
  'recompensas_catalogo', 'recompensas_resgates',
  'wearable_sync_log', 'wearable_alertas', 'wellness_assinaturas',
  'termos_consentimento', 'pesquisas_nps',
  'escalas_psicologia', 'planos', 'uso_ia_mensal',
  'agente_broadcasts', 'agente_disparos',
  'respostas_avaliacao_paciente', 'clinica_pacientes_lixeira', 'clinica_convites',
];

type Status = 'idle' | 'running' | 'done' | 'error';
type RowResult = { table: string; rows: number; error?: string };

function toCsv(rows: any[]): string {
  if (!rows.length) return '';
  const cols = Array.from(
    rows.reduce<Set<string>>((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set())
  );
  const esc = (v: any) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const header = cols.map(c => `"${c}"`).join(',');
  const body = rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n');
  return '\ufeff' + header + '\n' + body;
}

async function fetchAll(table: string): Promise<any[]> {
  const all: any[] = [];
  const pageSize = 1000;
  let from = 0;
  // Limit to 200k rows per table as a safety bound
  while (from < 200_000) {
    const { data, error } = await supabase
      .from(table as any)
      .select('*')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export default function ExportarDados() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<Status>('idle');
  const [current, setCurrent] = useState('');
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<RowResult[]>([]);

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const runExport = async () => {
    setStatus('running');
    setResults([]);
    setProgress(0);
    const zip = new JSZip();
    const folder = zip.folder('myhealthid-export')!;
    const localResults: RowResult[] = [];

    for (let i = 0; i < TABLES.length; i++) {
      const table = TABLES[i];
      setCurrent(table);
      try {
        const rows = await fetchAll(table);
        if (rows.length > 0) {
          folder.file(`${table}.csv`, toCsv(rows));
        }
        localResults.push({ table, rows: rows.length });
      } catch (e: any) {
        localResults.push({ table, rows: 0, error: e.message || 'Erro' });
      }
      setResults([...localResults]);
      setProgress(Math.round(((i + 1) / TABLES.length) * 100));
    }

    // Manifest
    const manifest = {
      exported_at: new Date().toISOString(),
      user_id: user?.id,
      user_email: user?.email,
      tables: localResults,
      total_rows: localResults.reduce((s, r) => s + r.rows, 0),
      note:
        'Export gerado pelo My Health ID. Inclui apenas dados aos quais este usuário tem acesso (RLS). ' +
        'Não inclui auth.users (senhas) nem arquivos de Storage.',
    };
    folder.file('_manifest.json', JSON.stringify(manifest, null, 2));

    try {
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `myhealthid-export-${stamp}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
      toast({ title: 'Exportação concluída', description: `${manifest.total_rows} registros em ${TABLES.length} tabelas.` });
    } catch (e: any) {
      setStatus('error');
      toast({ title: 'Erro ao gerar ZIP', description: e.message, variant: 'destructive' });
    }
    setCurrent('');
  };

  const totalRows = results.reduce((s, r) => s + r.rows, 0);
  const errorCount = results.filter(r => r.error).length;

  return (
    <AppLayout>
      <div className="container py-4 sm:py-6 max-w-3xl pb-32">
        <div className="mb-5">
          <div className="eyebrow-accent mb-1.5">Configurações · Backup</div>
          <h1 className="h-page">Exportar todos os dados</h1>
          <p className="text-caption mt-1">
            Baixe um ZIP com CSV de todas as tabelas do seu app.
          </p>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="icon-sm text-primary" />
              O que está incluído
            </CardTitle>
            <CardDescription>
              {TABLES.length} tabelas — pacientes, agendamentos, MyID, prontuário, pagamentos,
              eventos, CRM, WhatsApp, exercícios, evolução, etc.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
              <AlertCircle className="icon-sm shrink-0 mt-0.5" />
              <div>
                <strong>Não incluso:</strong> logins/senhas dos usuários (tabela <code>auth.users</code>)
                e arquivos de Storage. Senhas precisarão ser redefinidas se você migrar para outro
                projeto. Arquivos de Storage devem ser baixados manualmente.
              </div>
            </div>

            <Button
              onClick={runExport}
              disabled={status === 'running'}
              size="lg"
              className="w-full gap-2"
            >
              {status === 'running' ? (
                <><Loader2 className="icon-sm animate-spin" /> Exportando…</>
              ) : (
                <><Download className="icon-sm" /> Exportar tudo (ZIP)</>
              )}
            </Button>

            {status !== 'idle' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {current ? `Baixando ${current}…` : status === 'done' ? 'Concluído' : ''}
                  </span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <Progress value={progress} className="h-2" />
                <div className="text-xs text-muted-foreground">
                  {results.length} / {TABLES.length} tabelas · {totalRows.toLocaleString('pt-BR')} registros
                  {errorCount > 0 && <span className="text-destructive"> · {errorCount} erros</span>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Database className="icon-sm" /> Detalhes por tabela
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-auto rounded-xl border border-border/40 divide-y divide-border/40">
                {results.map(r => (
                  <div key={r.table} className="flex items-center justify-between px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.error ? (
                        <AlertCircle className="icon-xs text-destructive shrink-0" />
                      ) : (
                        <CheckCircle2 className="icon-xs text-emerald-600 shrink-0" />
                      )}
                      <span className="font-mono truncate">{r.table}</span>
                    </div>
                    <span className={r.error ? 'text-destructive' : 'text-muted-foreground tabular-nums'}>
                      {r.error ? r.error : `${r.rows.toLocaleString('pt-BR')} linhas`}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
