import { useMemo, useState } from 'react';
import { Search, MessageCircle, Copy, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getPortalUrl } from '@/utils/linkUrls';

export interface PortalPacienteItem {
  id: string;
  nome: string;
  sobrenome?: string | null;
  telefone?: string | null;
  email?: string | null;
  portal_token?: string | null;
}

// Envio em massa do portal do cliente pelo WhatsApp. Cada cliente recebe o LINK
// PESSOAL dele (getPortalUrl com portal_token), que vincula pelo token — funciona
// com ou sem e-mail no cadastro. Um botão por cliente abre a conversa já com a
// mensagem e o link.
export default function EnviarPortalDialog({ pacientes, nomeClinica, onClose }: {
  pacientes: PortalPacienteItem[];
  nomeClinica?: string;
  onClose: () => void;
}) {
  const [busca, setBusca] = useState('');
  const [enviados, setEnviados] = useState<Set<string>>(new Set());

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pacientes.filter((p) => !q || `${p.nome} ${p.sobrenome || ''}`.toLowerCase().includes(q));
  }, [pacientes, busca]);

  const semLink = pacientes.filter((p) => !p.portal_token).length;
  const semTel = pacientes.filter((p) => !(p.telefone || '').replace(/\D/g, '')).length;
  const clinica = (nomeClinica || '').trim();

  const msgDe = (p: PortalPacienteItem, url: string) =>
    `Olá ${p.nome}! ${clinica ? `Aqui é da ${clinica}. ` : ''}Esse é o seu acesso ao Portal do Paciente:\n${url}\n\nÉ só abrir, cadastrar seu e-mail e criar uma senha para entrar. 🙂`;

  const enviarWhats = (p: PortalPacienteItem, url: string) => {
    const tel = (p.telefone || '').replace(/\D/g, '');
    const num = tel.length >= 12 ? tel : `55${tel}`; // adiciona DDI 55 se veio sem
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msgDe(p, url))}`, '_blank');
    setEnviados((s) => new Set(s).add(p.id));
  };
  const copiar = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success('Link copiado!'); }
    catch { toast.error('Não consegui copiar — selecione e copie manualmente.'); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="text-base">Enviar portal do cliente</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-[11px] text-muted-foreground">
            Cada cliente recebe o <b>link pessoal</b> dele — funciona mesmo sem e-mail no cadastro (o vínculo é pelo link).
            Toque em <b>WhatsApp</b> pra abrir a conversa com a mensagem pronta.
          </p>
          {(semLink > 0 || semTel > 0) && (
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-2 text-[11px] text-amber-800 dark:text-amber-300">
              {semTel > 0 && <>· {semTel} cliente(s) <b>sem telefone</b> (dá pra copiar o link e enviar por outro meio).<br /></>}
              {semLink > 0 && <>· {semLink} cliente(s) <b>sem link</b> gerado (abra e salve o cadastro dele uma vez).</>}
            </div>
          )}
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input className="h-9 pl-8" placeholder="Filtrar por nome…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="space-y-1.5 max-h-[58vh] overflow-y-auto">
            {lista.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-6">Nenhum cliente.</p>
            ) : lista.map((p) => {
              const url = p.portal_token ? getPortalUrl(p.portal_token) : '';
              const tel = (p.telefone || '').replace(/\D/g, '');
              return (
                <div key={p.id} className="rounded-lg border border-border/50 p-2.5 flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate flex items-center gap-1.5">
                      {p.nome} {p.sobrenome || ''}
                      {enviados.has(p.id) && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {tel ? p.telefone : 'sem telefone'} · {p.email ? 'com e-mail' : 'sem e-mail'}
                    </p>
                  </div>
                  {url ? (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button size="sm" disabled={!tel} onClick={() => enviarWhats(p, url)}
                        className="h-8 gap-1.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white">
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Copiar link" onClick={() => copiar(url)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground shrink-0">sem link</span>
                  )}
                </div>
              );
            })}
          </div>
          <Button variant="outline" className="w-full" onClick={onClose}>Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
