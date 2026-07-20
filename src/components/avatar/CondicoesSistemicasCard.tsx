import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { HeartPulse, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Condições SISTÊMICAS não pertencem a uma região anatômica — pertencem a um
// SISTEMA do corpo. Ficam guardadas como evento com regiao_id='sistemico' (fora
// do mapa do corpo), com o sistema certo, então acendem o sistema no avatar e
// alimentam os motores de IA (planos/diretrizes) como o resto dos achados.
const REGIAO_SISTEMICA = 'sistemico';

type Sistema =
  | 'musculoesqueletico' | 'nervoso' | 'cardiovascular' | 'respiratorio'
  | 'digestorio' | 'endocrino' | 'urinario' | 'reprodutor' | 'tegumentar'
  | 'linfatico' | 'sensorial';

const SIST_LABEL: Record<Sistema, string> = {
  musculoesqueletico: 'Musculoesquelético', nervoso: 'Nervoso / Mental', cardiovascular: 'Cardiovascular',
  respiratorio: 'Respiratório', digestorio: 'Digestório', endocrino: 'Endócrino / Metabólico',
  urinario: 'Urinário', reprodutor: 'Reprodutor', tegumentar: 'Pele', linfatico: 'Linfático / Sangue', sensorial: 'Sensorial',
};

const SIST_COR: Record<Sistema, string> = {
  musculoesqueletico: '#a855f7', nervoso: '#6366f1', cardiovascular: '#ef4444',
  respiratorio: '#06b6d4', digestorio: '#f97316', endocrino: '#10b981',
  urinario: '#8b5cf6', reprodutor: '#ec4899', tegumentar: '#f59e0b', linfatico: '#84cc16', sensorial: '#14b8a6',
};

// Condições comuns já mapeadas ao sistema (com CID quando aplicável).
const CONDICOES: { label: string; sistema: Sistema; cid?: string }[] = [
  { label: 'Hipertensão arterial', sistema: 'cardiovascular', cid: 'I10' },
  { label: 'Dislipidemia (colesterol alto)', sistema: 'cardiovascular', cid: 'E78' },
  { label: 'Diabetes mellitus', sistema: 'endocrino', cid: 'E11' },
  { label: 'Hipotireoidismo', sistema: 'endocrino', cid: 'E03' },
  { label: 'Hipertireoidismo', sistema: 'endocrino', cid: 'E05' },
  { label: 'Obesidade', sistema: 'endocrino', cid: 'E66' },
  { label: 'Ansiedade', sistema: 'nervoso', cid: 'F41' },
  { label: 'Depressão', sistema: 'nervoso', cid: 'F32' },
  { label: 'Insônia', sistema: 'nervoso', cid: 'G47.0' },
  { label: 'Enxaqueca', sistema: 'nervoso', cid: 'G43' },
  { label: 'Fibromialgia', sistema: 'nervoso', cid: 'M79.7' },
  { label: 'Artrite reumatoide', sistema: 'musculoesqueletico', cid: 'M06' },
  { label: 'Reumatismo / Artrose', sistema: 'musculoesqueletico', cid: 'M15' },
  { label: 'Osteoporose', sistema: 'musculoesqueletico', cid: 'M81' },
  { label: 'Asma', sistema: 'respiratorio', cid: 'J45' },
  { label: 'DPOC', sistema: 'respiratorio', cid: 'J44' },
  { label: 'Refluxo / Gastrite', sistema: 'digestorio', cid: 'K21' },
  { label: 'Doença renal crônica', sistema: 'urinario', cid: 'N18' },
  { label: 'Anemia', sistema: 'linfatico', cid: 'D64' },
];

const SEVERIDADES = [
  { v: 1, label: 'Leve / controlada' },
  { v: 2, label: 'Moderada' },
  { v: 3, label: 'Importante' },
  { v: 4, label: 'Grave / descompensada' },
];

interface Props { pacienteId: string; }

export default function CondicoesSistemicasCard({ pacienteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [escolha, setEscolha] = useState<string>('');   // label da lista ou 'outra'
  const [customLabel, setCustomLabel] = useState('');
  const [customSistema, setCustomSistema] = useState<Sistema>('endocrino');
  const [sev, setSev] = useState(2);
  const [obs, setObs] = useState('');

  const { data: condicoes = [], isLoading } = useQuery({
    queryKey: ['condicoes-sistemicas', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any).from('eventos_clinicos_anatomicos')
        .select('id, tipo_achado, sistema, severidade, diagnostico_cid, notas_clinicas')
        .eq('paciente_id', pacienteId).eq('regiao_id', REGIAO_SISTEMICA).neq('status', 'resolvido')
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // Agrupa as condições por sistema (ordem: mais itens primeiro).
  const porSistema = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const c of condicoes as any[]) { const arr = m.get(c.sistema) || []; arr.push(c); m.set(c.sistema, arr); }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [condicoes]);

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ['condicoes-sistemicas', pacienteId] });
    qc.invalidateQueries({ queryKey: ['eventos-anatomicos', pacienteId] }); // atualiza o avatar
  };

  const adicionar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Sem sessão');
      const daLista = CONDICOES.find(c => c.label === escolha);
      const label = daLista ? daLista.label : customLabel.trim();
      const sistema = daLista ? daLista.sistema : customSistema;
      const cid = daLista?.cid || null;
      if (!label) throw new Error('Escolha ou digite a condição');
      const { error } = await (supabase as any).from('eventos_clinicos_anatomicos').insert({
        paciente_id: pacienteId,
        terapeuta_id: user.id,
        regiao_id: REGIAO_SISTEMICA,
        sistema,
        origem: 'exame_clinico',
        tipo_achado: label,
        diagnostico_cid: cid,
        severidade: sev,
        status: 'cronico',
        notas_clinicas: obs.trim() || null,
        visivel_paciente: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Condição adicionada ao avatar');
      setOpen(false); setEscolha(''); setCustomLabel(''); setObs(''); setSev(2);
      invalidar();
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao adicionar'),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('eventos_clinicos_anatomicos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Removida'); invalidar(); },
    onError: (e: any) => toast.error(e.message),
  });

  const daLista = CONDICOES.find(c => c.label === escolha);
  const ehOutra = escolha === 'outra';

  return (
    <Card className="border-border/40 shadow-xs">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-base">
          <HeartPulse className="icon-sm text-rose-600 shrink-0" /> Condições sistêmicas
        </CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1">
          <Plus className="icon-sm" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-[11px] text-muted-foreground -mt-1">
          Ansiedade, hipertensão, diabetes, reumatismo… — condições que afetam o corpo todo. Não marcam uma região, mas acendem o <strong>sistema</strong> no avatar e entram na IA dos planos.
        </p>
        {isLoading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : condicoes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">Nenhuma condição sistêmica registrada.</p>
        ) : (
          <div className="space-y-2.5">
            {porSistema.map(([sis, lista]) => {
              const cor = SIST_COR[sis as Sistema] || '#64748b';
              return (
                <div key={sis} className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cor }} />
                    <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: cor }}>{SIST_LABEL[sis as Sistema] || sis}</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pl-3.5">
                    {lista.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border border-border/50 bg-muted/40 text-[11px]">
                        <span className="font-medium">{c.tipo_achado}</span>
                        {c.severidade >= 3 && <span className="text-[8px] font-bold px-1 rounded bg-red-100 text-red-700">grave</span>}
                        <button onClick={() => remover.mutate(c.id)} className="h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center" title="Remover">
                          <Trash2 className="h-2.5 w-2.5 text-destructive" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar condição sistêmica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Condição</label>
              <Select value={escolha} onValueChange={setEscolha}>
                <SelectTrigger><SelectValue placeholder="Escolha uma condição" /></SelectTrigger>
                <SelectContent>
                  {CONDICOES.map(c => <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>)}
                  <SelectItem value="outra">Outra (digitar)…</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {daLista && (
              <p className="text-[11px] text-muted-foreground">Sistema: <strong>{SIST_LABEL[daLista.sistema]}</strong>{daLista.cid ? ` · CID ${daLista.cid}` : ''}</p>
            )}

            {ehOutra && (
              <div className="space-y-2">
                <Input placeholder="Nome da condição" value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
                <div>
                  <label className="text-xs text-muted-foreground">Sistema afetado</label>
                  <Select value={customSistema} onValueChange={(v) => setCustomSistema(v as Sistema)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(SIST_LABEL) as Sistema[]).map(s => <SelectItem key={s} value={s}>{SIST_LABEL[s]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground">Gravidade / controle</label>
              <Select value={String(sev)} onValueChange={(v) => setSev(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERIDADES.map(s => <SelectItem key={s.v} value={String(s.v)}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Input placeholder="Observação (medicação, controle…) — opcional" value={obs} onChange={e => setObs(e.target.value)} />

            <Button className="w-full" disabled={adicionar.isPending || (!escolha) || (ehOutra && !customLabel.trim())}
              onClick={() => adicionar.mutate()}>
              {adicionar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Adicionar ao avatar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
