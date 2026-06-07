import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileScan, Upload, Loader2, Eye, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface Props { pacienteId: string; }

export default function ImportarExameCard({ pacienteId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [verExame, setVerExame] = useState<any | null>(null);

  const { data: exames = [] } = useQuery({
    queryKey: ['exames-importados', pacienteId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('exames_importados').select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
  });

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
      if (!ACCEPTED.includes(file.type)) throw new Error('Use JPG, PNG ou WebP (PDF: tire um print)');
      if (file.size > 10 * 1024 * 1024) throw new Error('Arquivo > 10MB');
      const base64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(',')[1]);
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke('import-exame', {
        body: { paciente_id: pacienteId, file_base64: base64, mime: file.type, file_name: file.name },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as any;
    },
    onSuccess: (d) => {
      toast.success(d?.vitais_importados ? 'Exame importado + sinais vitais atualizados' : 'Exame importado');
      qc.invalidateQueries({ queryKey: ['exames-importados', pacienteId] });
      qc.invalidateQueries({ queryKey: ['sinais-vitais', pacienteId] });
    },
    onError: (e: any) => toast.error(e.message || 'Erro ao importar'),
  });

  const apagar = async (id: string) => {
    if (!confirm('Apagar este exame?')) return;
    await (supabase as any).from('exames_importados').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['exames-importados', pacienteId] });
  };

  return (
    <Card className="rounded-xl border-border/40 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FileScan className="icon-sm text-primary" /> Importar Exame (IA)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Envie uma foto/imagem do exame (JPG, PNG, WebP). A IA extrai automaticamente parâmetros, achados e sinais vitais.
        </p>
        <input
          ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) importMut.mutate(f); e.currentTarget.value = ''; }}
        />
        <Button size="sm" onClick={() => inputRef.current?.click()} disabled={importMut.isPending} className="w-full">
          {importMut.isPending ? <Loader2 className="icon-xs animate-spin mr-2" /> : <Upload className="icon-xs mr-2" />}
          {importMut.isPending ? 'Analisando exame...' : 'Selecionar imagem do exame'}
        </Button>

        {exames.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum exame importado.</p>
        )}

        {exames.map((e: any) => {
          const d = e.dados_extraidos || {};
          return (
            <div key={e.id} className="p-3 rounded-lg border border-border/40 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate flex items-center gap-2">
                    <FileText className="icon-xs text-primary shrink-0" />
                    {d.nome_exame || 'Exame'}
                    {d.tipo && <Badge variant="outline" className="text-[10px]">{d.tipo}</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {d.data_exame ? new Date(d.data_exame).toLocaleDateString('pt-BR') : new Date(e.created_at).toLocaleDateString('pt-BR')}
                    {Array.isArray(d.valores) && d.valores.length > 0 && ` · ${d.valores.length} valor(es)`}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setVerExame(e)}>
                    <Eye className="icon-xs" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => apagar(e.id)}>
                    <Trash2 className="icon-xs text-destructive" />
                  </Button>
                </div>
              </div>
              {d.resumo && <p className="text-xs text-foreground/80 line-clamp-2">{d.resumo}</p>}
            </div>
          );
        })}
      </CardContent>

      <Dialog open={!!verExame} onOpenChange={(o) => !o && setVerExame(null)}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">
              {verExame?.dados_extraidos?.nome_exame || 'Exame importado'}
            </DialogTitle>
          </DialogHeader>
          {verExame && (() => {
            const d = verExame.dados_extraidos || {};
            return (
              <div className="space-y-3 text-sm">
                {d.resumo && (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">Resumo</div>
                    <p className="text-foreground/90">{d.resumo}</p>
                  </div>
                )}
                {Array.isArray(d.valores) && d.valores.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">Valores</div>
                    <div className="rounded-lg border border-border/40 overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/40">
                          <tr>
                            <th className="text-left p-2">Parâmetro</th>
                            <th className="text-left p-2">Valor</th>
                            <th className="text-left p-2">Ref.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.valores.map((v: any, i: number) => (
                            <tr key={i} className={v.alterado ? 'bg-destructive/5' : ''}>
                              <td className="p-2 font-medium">{v.parametro}</td>
                              <td className="p-2">{v.valor} {v.unidade}{v.alterado && <span className="ml-1 text-destructive">⚠</span>}</td>
                              <td className="p-2 text-muted-foreground">{v.referencia || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {Array.isArray(d.achados) && d.achados.length > 0 && (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">Achados</div>
                    <ul className="list-disc list-inside space-y-0.5 text-foreground/90">
                      {d.achados.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  </div>
                )}
                {d.conclusao && (
                  <div>
                    <div className="text-[10px] uppercase text-muted-foreground tracking-wide mb-1">Conclusão</div>
                    <p className="text-foreground/90">{d.conclusao}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
