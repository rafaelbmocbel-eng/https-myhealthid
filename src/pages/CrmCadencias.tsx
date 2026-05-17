import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Trash2, Zap, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const ESTAGIOS = [
  { v: "novo", l: "Novo Lead" },
  { v: "qualificado", l: "Qualificado" },
  { v: "agendado", l: "Agendado" },
  { v: "fechado", l: "Fechado" },
  { v: "perdido", l: "Perdido" },
];

export default function CrmCadencias({ embedded = false }: { embedded?: boolean } = {}) {
  const [cadencias, setCadencias] = useState<any[]>([]);
  const [passosByCad, setPassosByCad] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  async function carregar() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: cads } = await supabase.from("crm_cadencias")
      .select("*").eq("terapeuta_id", user.id).order("created_at");
    setCadencias(cads || []);
    if (cads?.length) {
      const { data: passos } = await supabase.from("crm_cadencia_passos")
        .select("*").in("cadencia_id", cads.map(c => c.id)).order("ordem");
      const map: Record<string, any[]> = {};
      (passos || []).forEach(p => { (map[p.cadencia_id] ||= []).push(p); });
      setPassosByCad(map);
    }
    setLoading(false);
  }
  useEffect(() => { carregar(); }, []);

  async function criarCadencia() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("crm_cadencias").insert({
      terapeuta_id: user.id, nome: "Nova cadência", estagio_gatilho: "novo", ativo: true,
    });
    if (error) toast.error(error.message); else carregar();
  }

  async function atualizar(id: string, patch: any) {
    const { error } = await supabase.from("crm_cadencias").update(patch).eq("id", id);
    if (error) toast.error(error.message); else carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta cadência e todos os passos?")) return;
    await supabase.from("crm_cadencias").delete().eq("id", id);
    carregar();
  }

  async function addPasso(cadId: string) {
    const atuais = passosByCad[cadId] || [];
    const { error } = await supabase.from("crm_cadencia_passos").insert({
      cadencia_id: cadId,
      ordem: (atuais.length + 1),
      delay_horas: 24,
      mensagem: "Olá {nome}, tudo bem?",
    });
    if (error) toast.error(error.message); else carregar();
  }

  async function atualizarPasso(id: string, patch: any) {
    const { error } = await supabase.from("crm_cadencia_passos").update(patch).eq("id", id);
    if (error) toast.error(error.message); else carregar();
  }

  async function delPasso(id: string) {
    await supabase.from("crm_cadencia_passos").delete().eq("id", id);
    carregar();
  }

  return (
    <div className={embedded ? 'p-3 sm:p-5' : 'min-h-screen bg-background p-3 sm:p-6 max-w-5xl mx-auto'}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {!embedded && <Link to="/crm?tab=pipeline"><Button variant="ghost" size="icon"><ArrowLeft className="icon-md" /></Button></Link>}
          <div>
            <h1 className="h-page flex items-center gap-2"><Zap className="icon-md text-primary" /> Cadências de Follow-up</h1>
            <p className="text-caption text-muted-foreground">Sequências automáticas disparadas quando o lead muda de estágio</p>
          </div>
        </div>
        <Button onClick={criarCadencia}><Plus className="icon-sm" /> Nova</Button>
      </div>

      {loading ? <div className="text-center py-12 text-muted-foreground">Carregando…</div> :
        cadencias.length === 0 ? (
          <Card className="p-8 text-center">
            <Zap className="icon-xl text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground mb-4">Nenhuma cadência configurada</p>
            <Button onClick={criarCadencia}><Plus className="icon-sm" /> Criar primeira cadência</Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {cadencias.map(cad => (
              <Card key={cad.id} className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Input
                    className="flex-1 min-w-[200px] font-semibold"
                    value={cad.nome}
                    onChange={e => setCadencias(cs => cs.map(c => c.id === cad.id ? { ...c, nome: e.target.value } : c))}
                    onBlur={e => atualizar(cad.id, { nome: e.target.value })}
                  />
                  <Select value={cad.estagio_gatilho} onValueChange={v => atualizar(cad.id, { estagio_gatilho: v })}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ESTAGIOS.map(e => <SelectItem key={e.v} value={e.v}>{e.l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Switch checked={cad.ativo} onCheckedChange={v => atualizar(cad.id, { ativo: v })} />
                    <Label className="text-caption">{cad.ativo ? "Ativa" : "Pausada"}</Label>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => excluir(cad.id)}>
                    <Trash2 className="icon-sm text-destructive" />
                  </Button>
                </div>

                <div className="space-y-2 pl-2 border-l-2 border-primary/30">
                  {(passosByCad[cad.id] || []).map((p, i) => (
                    <div key={p.id} className="flex gap-2 items-start">
                      <Badge variant="outline" className="mt-2 shrink-0">{i + 1}</Badge>
                      <div className="flex items-center gap-1 mt-2 shrink-0">
                        <Clock className="icon-xs text-muted-foreground" />
                        <Input
                          type="number" min={0} className="w-16 h-8"
                          defaultValue={p.delay_horas}
                          onBlur={e => atualizarPasso(p.id, { delay_horas: parseInt(e.target.value) || 0 })}
                        />
                        <span className="text-caption text-muted-foreground">h</span>
                      </div>
                      <Textarea
                        rows={2} className="flex-1"
                        defaultValue={p.mensagem}
                        onBlur={e => atualizarPasso(p.id, { mensagem: e.target.value })}
                        placeholder="Mensagem (use {nome} para nome do paciente)"
                      />
                      <Button variant="ghost" size="icon" className="mt-1" onClick={() => delPasso(p.id)}>
                        <Trash2 className="icon-xs text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => addPasso(cad.id)} className="ml-2">
                    <Plus className="icon-xs" /> Adicionar passo
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );
}
