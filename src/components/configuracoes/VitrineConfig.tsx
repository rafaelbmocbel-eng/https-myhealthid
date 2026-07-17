import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Store, Eye, X, Plus, Loader2, ExternalLink, CheckCircle2, XCircle, Monitor, Building2, Globe, AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePlanoAtivo } from '@/hooks/usePlanoAtivo';

type VitrineData = {
  vitrine_ativo: boolean;
  vitrine_nome_exibicao: string;
  vitrine_bio: string;
  vitrine_especialidades: string[];
  vitrine_convenios: string[];
  vitrine_cidade: string;
  vitrine_valor_sessao: string;
  vitrine_foto_url: string;
  vitrine_modalidade: 'presencial' | 'online' | 'ambos';
};

type Solicitacao = {
  id: string;
  paciente_user_id: string;
  status: string;
  mensagem: string | null;
  created_at: string;
};

const ESPECIALIDADES_SUGESTOES = [
  'Psicologia', 'Fisioterapia', 'Nutrição', 'Educação Física',
  'Fonoaudiologia', 'Terapia Ocupacional', 'Psiquiatria', 'Neuropsicologia',
  'Acupuntura', 'Pilates', 'Osteopatia',
];

export default function VitrineConfig() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: plano } = usePlanoAtivo();
  const assinaturaAtiva = plano != null && ['ativa', 'trial'].includes(plano.status) && (plano.data_fim == null || new Date(plano.data_fim) > new Date());
  const diasRestantes = plano?.data_fim ? differenceInDays(new Date(plano.data_fim), new Date()) : null;

  const [form, setForm] = useState<VitrineData>({
    vitrine_ativo: false,
    vitrine_nome_exibicao: '',
    vitrine_bio: '',
    vitrine_especialidades: [],
    vitrine_convenios: [],
    vitrine_cidade: '',
    vitrine_valor_sessao: '',
    vitrine_foto_url: '',
    vitrine_modalidade: 'presencial',
  });
  const [novaEspecialidade, setNovaEspecialidade] = useState('');
  const [novoConvenio, setNovoConvenio] = useState('');

  const { data: config, isLoading } = useQuery({
    queryKey: ['config-clinica-vitrine', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('config_clinica')
        .select('vitrine_ativo,vitrine_nome_exibicao,vitrine_bio,vitrine_especialidades,vitrine_convenios,vitrine_cidade,vitrine_valor_sessao,vitrine_foto_url,responsavel,cidade')
        .eq('terapeuta_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: solicitacoes = [] } = useQuery({
    queryKey: ['solicitacoes-conexao', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('solicitacoes_conexao')
        .select('id,paciente_user_id,status,mensagem,created_at')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Solicitacao[];
    },
  });

  useEffect(() => {
    if (!config) return;
    setForm({
      vitrine_ativo: config.vitrine_ativo ?? false,
      vitrine_nome_exibicao: config.vitrine_nome_exibicao || config.responsavel || '',
      vitrine_bio: config.vitrine_bio || '',
      vitrine_especialidades: config.vitrine_especialidades || [],
      vitrine_convenios: config.vitrine_convenios || [],
      vitrine_cidade: config.vitrine_cidade || config.cidade || '',
      vitrine_valor_sessao: config.vitrine_valor_sessao?.toString() || '',
      vitrine_foto_url: config.vitrine_foto_url || '',
      vitrine_modalidade: (config as any).vitrine_modalidade || 'presencial',
    });
  }, [config]);

  const mutSave = useMutation({
    mutationFn: async (data: VitrineData) => {
      const payload = {
        vitrine_ativo: data.vitrine_ativo,
        vitrine_nome_exibicao: data.vitrine_nome_exibicao || null,
        vitrine_bio: data.vitrine_bio || null,
        vitrine_especialidades: data.vitrine_especialidades,
        vitrine_convenios: data.vitrine_convenios,
        vitrine_cidade: data.vitrine_cidade || null,
        vitrine_valor_sessao: data.vitrine_valor_sessao ? parseFloat(data.vitrine_valor_sessao) : null,
        vitrine_foto_url: data.vitrine_foto_url || null,
        vitrine_modalidade: data.vitrine_modalidade,
      };
      const { error } = await supabase
        .from('config_clinica')
        .update(payload)
        .eq('terapeuta_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Vitrine atualizada');
      qc.invalidateQueries({ queryKey: ['config-clinica-vitrine'] });
    },
    onError: () => toast.error('Erro ao salvar. Tente novamente.'),
  });

  const mutResponder = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'aceita' | 'recusada' }) => {
      if (status === 'aceita') {
        // Aceitar VINCULA o paciente (terapeuta_id + selo vitrine) via RPC
        // SECURITY DEFINER — só marcar "aceita" não o fazia aparecer nos Pacientes.
        const { error } = await supabase.rpc('aceitar_solicitacao_conexao', { p_id: id });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('solicitacoes_conexao')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id)
          .eq('terapeuta_id', user!.id);
        if (error) throw error;
      }
    },
    onSuccess: (_, { status }) => {
      toast.success(status === 'aceita' ? 'Paciente aceito e vinculado! Já aparece em Pacientes.' : 'Solicitação recusada');
      qc.invalidateQueries({ queryKey: ['solicitacoes-conexao'] });
      qc.invalidateQueries({ queryKey: ['pacientes-com-servicos'] });
    },
  });

  const addTag = (field: 'vitrine_especialidades' | 'vitrine_convenios', value: string) => {
    const clean = value.trim();
    if (!clean) return;
    if (form[field].includes(clean)) return;
    setForm((f) => ({ ...f, [field]: [...f[field], clean] }));
    if (field === 'vitrine_especialidades') setNovaEspecialidade('');
    else setNovoConvenio('');
  };

  const removeTag = (field: 'vitrine_especialidades' | 'vitrine_convenios', value: string) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((x) => x !== value) }));
  };

  if (isLoading) {
    return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const pendentes = solicitacoes.filter((s) => s.status === 'pendente');
  const vitrineUrl = `${window.location.origin}/portaldocliente/terapeuta/${user?.id}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-bold text-base">Vitrine Pública</h2>
            <p className="text-xs text-muted-foreground">Apareça para pacientes que buscam um terapeuta</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{form.vitrine_ativo ? 'Visível' : 'Oculto'}</span>
          <Switch
            checked={form.vitrine_ativo}
            onCheckedChange={(v) => setForm((f) => ({ ...f, vitrine_ativo: v }))}
          />
        </div>
      </div>

      {/* Banner de status da assinatura */}
      {!assinaturaAtiva && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Assinatura necessária</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug mt-0.5">
              Você precisa de uma assinatura ativa para aparecer no marketplace de pacientes.{' '}
              <a href="/precos" className="font-semibold underline">Ver planos</a>
            </p>
          </div>
        </div>
      )}

      {assinaturaAtiva && plano?.status === 'trial' && diasRestantes !== null && diasRestantes <= 7 && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <Clock className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Trial expirando em {diasRestantes} dia{diasRestantes !== 1 ? 's' : ''}</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 leading-snug mt-0.5">
              Após o período trial, você sairá do marketplace automaticamente.{' '}
              <a href="/precos" className="font-semibold underline">Assinar agora</a>
            </p>
          </div>
        </div>
      )}

      {assinaturaAtiva && plano?.status === 'ativa' && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            Assinatura <strong>{plano.plano_nome}</strong> ativa — você pode aparecer no marketplace enquanto mantiver o plano.
          </p>
        </div>
      )}

      {form.vitrine_ativo && assinaturaAtiva && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
          <Eye className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-xs text-blue-700 dark:text-blue-400 flex-1 min-w-0 truncate">
            Seu perfil está visível em: <a href={vitrineUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{vitrineUrl}</a>
          </p>
          <a href={vitrineUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
          </a>
        </div>
      )}

      {form.vitrine_ativo && !assinaturaAtiva && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted border border-border">
          <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Vitrine ativada, mas você só aparecerá no marketplace com uma assinatura ativa.
          </p>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label>Nome de exibição</Label>
          <Input
            value={form.vitrine_nome_exibicao}
            onChange={(e) => setForm((f) => ({ ...f, vitrine_nome_exibicao: e.target.value }))}
            placeholder="Como quer aparecer para os pacientes"
          />
        </div>

        <div>
          <Label>Cidade</Label>
          <Input
            value={form.vitrine_cidade}
            onChange={(e) => setForm((f) => ({ ...f, vitrine_cidade: e.target.value }))}
            placeholder="São Paulo"
          />
        </div>

        <div>
          <Label>Valor da sessão (R$)</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={form.vitrine_valor_sessao}
            onChange={(e) => setForm((f) => ({ ...f, vitrine_valor_sessao: e.target.value }))}
            placeholder="Ex: 150"
          />
        </div>

        <div>
          <Label>Modalidade de atendimento</Label>
          <Select
            value={form.vitrine_modalidade}
            onValueChange={(v) => setForm((f) => ({ ...f, vitrine_modalidade: v as VitrineData['vitrine_modalidade'] }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="presencial">
                <span className="flex items-center gap-2"><Building2 className="h-3.5 w-3.5" /> Presencial</span>
              </SelectItem>
              <SelectItem value="online">
                <span className="flex items-center gap-2"><Monitor className="h-3.5 w-3.5" /> Online</span>
              </SelectItem>
              <SelectItem value="ambos">
                <span className="flex items-center gap-2"><Globe className="h-3.5 w-3.5" /> Presencial + Online</span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="sm:col-span-2">
          <Label>URL da foto de perfil</Label>
          <Input
            value={form.vitrine_foto_url}
            onChange={(e) => setForm((f) => ({ ...f, vitrine_foto_url: e.target.value }))}
            placeholder="https://..."
          />
          <p className="text-[11px] text-muted-foreground mt-1">Cole o link de uma imagem pública (ex: do Google Drive, Dropbox ou seu site).</p>
        </div>

        <div className="sm:col-span-2">
          <Label>Apresentação / Bio</Label>
          <Textarea
            value={form.vitrine_bio}
            onChange={(e) => setForm((f) => ({ ...f, vitrine_bio: e.target.value }))}
            placeholder="Descreva brevemente sua abordagem, experiência e o que pode oferecer aos pacientes..."
            rows={3}
          />
        </div>
      </div>

      {/* Especialidades */}
      <div>
        <Label className="mb-2 block">Especialidades</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.vitrine_especialidades.map((e) => (
            <Badge key={e} variant="outline" className="gap-1 border-primary/30 text-primary/80">
              {e}
              <button onClick={() => removeTag('vitrine_especialidades', e)} className="ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={novaEspecialidade}
            onChange={(e) => setNovaEspecialidade(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('vitrine_especialidades', novaEspecialidade))}
            placeholder="Digite e pressione Enter"
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" className="h-8" onClick={() => addTag('vitrine_especialidades', novaEspecialidade)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {ESPECIALIDADES_SUGESTOES.filter((s) => !form.vitrine_especialidades.includes(s)).slice(0, 6).map((s) => (
            <button
              key={s}
              onClick={() => addTag('vitrine_especialidades', s)}
              className="text-[10px] px-2 py-0.5 rounded-full border border-dashed border-border hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      </div>

      {/* Convênios */}
      <div>
        <Label className="mb-2 block">Convênios aceitos</Label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {form.vitrine_convenios.map((c) => (
            <Badge key={c} variant="secondary" className="gap-1">
              {c}
              <button onClick={() => removeTag('vitrine_convenios', c)} className="ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={novoConvenio}
            onChange={(e) => setNovoConvenio(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag('vitrine_convenios', novoConvenio))}
            placeholder="Ex: Unimed, Bradesco Saúde..."
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" className="h-8" onClick={() => addTag('vitrine_convenios', novoConvenio)}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <Button onClick={() => mutSave.mutate(form)} disabled={mutSave.isPending} className="w-full sm:w-auto">
        {mutSave.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
        Salvar vitrine
      </Button>

      {/* Solicitações de pacientes */}
      {solicitacoes.length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            Solicitações de pacientes
            {pendentes.length > 0 && (
              <Badge className="h-5 px-1.5 text-[10px]">{pendentes.length} nova{pendentes.length !== 1 ? 's' : ''}</Badge>
            )}
          </h3>
          <div className="space-y-2">
            {solicitacoes.map((s) => (
              <Card key={s.id} className="p-3 border-border/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">Paciente {s.paciente_user_id.slice(0, 8)}…</p>
                    {s.mensagem && (
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{s.mensagem}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-1">
                      {format(new Date(s.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.status === 'pendente' ? (
                      <>
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => mutResponder.mutate({ id: s.id, status: 'aceita' })}
                          disabled={mutResponder.isPending}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Aceitar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => mutResponder.mutate({ id: s.id, status: 'recusada' })}
                          disabled={mutResponder.isPending}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Recusar
                        </Button>
                      </>
                    ) : s.status === 'aceita' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Aceita
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-600 border-red-200 text-[10px]">
                        <XCircle className="h-3 w-3 mr-1" /> Recusada
                      </Badge>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
