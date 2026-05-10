import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import { useEventos, useEventoDetalhe, type Evento, type EventoPergunta, type EventoCategoria, type EventoPublicoAlvo, type RecorrenciaConfig } from '@/hooks/useEventos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Calendar, Plus, Trash2, Users, Eye, Copy, Check, X, MapPin, Clock, DollarSign, Pencil, FileText, Archive, Video, Repeat, Lock, Globe } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { getBaseUrl } from '@/utils/linkUrls';
import EventoDetalhePainel from '@/components/eventos/EventoDetalhePainel';

interface PerguntaForm {
  tipo: 'text' | 'multiple_choice' | 'multiple_select' | 'scale' | 'boolean';
  pergunta: string;
  opcoes: string[];
  obrigatoria: boolean;
  limite_por_opcao?: number | null;
}

const DEFAULT_PERGUNTA: PerguntaForm = { tipo: 'text', pergunta: '', opcoes: [''], obrigatoria: true, limite_por_opcao: null };

export const CATEGORIAS: { value: EventoCategoria; label: string; icon: string }[] = [
  { value: 'aula_online', label: 'Aula online', icon: '🎥' },
  { value: 'workshop', label: 'Workshop', icon: '🛠️' },
  { value: 'live', label: 'Live / Tira-dúvidas', icon: '🎙️' },
  { value: 'triagem', label: 'Triagem gratuita', icon: '🎁' },
  { value: 'desafio', label: 'Desafio', icon: '🏆' },
  { value: 'sazonal', label: 'Sazonal', icon: '🎉' },
  { value: 'outro', label: 'Outro', icon: '📌' },
];

export const categoriaLabel = (c?: string) => CATEGORIAS.find(x => x.value === c)?.label || 'Outro';
export const categoriaIcon = (c?: string) => CATEGORIAS.find(x => x.value === c)?.icon || '📌';

const RECOVERY_TEMPLATE: PerguntaForm[] = [
  { tipo: 'boolean', pergunta: 'VOCÊ CONFIRMA SUA PRESENÇA?', opcoes: [], obrigatoria: true, limite_por_opcao: null },
  { tipo: 'multiple_choice', pergunta: 'ESCOLHA SEU HORÁRIO PARA INÍCIO (montagem de lista por ordem de preenchimento)', opcoes: ['8H', '9H', '10H', '11H', '12H'], obrigatoria: true, limite_por_opcao: 5 },
  { tipo: 'multiple_select', pergunta: 'Qual seu objetivo com o RECOVERY? (marque até 2)', opcoes: ['Alívio de dores musculares', 'Melhorar mobilidade articular', 'Aprender técnicas de autocuidado', 'Socializar com colegas'], obrigatoria: true, limite_por_opcao: null },
  { tipo: 'text', pergunta: 'Alguma área específica do corpo que gostaria de trabalhar? (Ex.: lombar, ombros, joelhos)', opcoes: [], obrigatoria: true, limite_por_opcao: null },
];

export default function Eventos() {
  const { data: eventos, isLoading, criarEvento, editarEvento, salvarPerguntas, toggleEvento, deletarEvento } = useEventos();
  const [openCreate, setOpenCreate] = useState(false);
  const [selectedEvento, setSelectedEvento] = useState<string | null>(null);
  const [editingQuestionario, setEditingQuestionario] = useState<string | null>(null);
  const [editingEvento, setEditingEvento] = useState<string | null>(null);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [descricaoFormulario, setDescricaoFormulario] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFim, setHorarioFim] = useState('12:00');
  const [local, setLocal] = useState('');
  const [vagasMax, setVagasMax] = useState<number | ''>('');
  const [cobrarPagamento, setCobrarPagamento] = useState(false);
  const [valor, setValor] = useState<number>(0);
  const [pixChave, setPixChave] = useState('');
  const [pixTipo, setPixTipo] = useState('cpf');
  const [pixNome, setPixNome] = useState('');
  const [linkPagamento, setLinkPagamento] = useState('');
  const [perguntas, setPerguntas] = useState<PerguntaForm[]>([{ ...DEFAULT_PERGUNTA }]);
  const [categoria, setCategoria] = useState<EventoCategoria>('outro');
  const [linkVideo, setLinkVideo] = useState('');
  const [publicoAlvo, setPublicoAlvo] = useState<EventoPublicoAlvo>('publico');
  const [recorrenciaTipo, setRecorrenciaTipo] = useState<'nao' | 'diaria' | 'semanal'>('nao');
  const [recorrenciaIntervalo, setRecorrenciaIntervalo] = useState<number>(1);
  const [recorrenciaOcorrencias, setRecorrenciaOcorrencias] = useState<number>(4);

  const resetForm = () => {
    setTitulo(''); setDescricao(''); setDescricaoFormulario(''); setDataEvento(''); setHorarioInicio('09:00');
    setHorarioFim('12:00'); setLocal(''); setVagasMax(''); setCobrarPagamento(false);
    setValor(0); setPixChave(''); setPixTipo('cpf'); setPixNome(''); setLinkPagamento('');
    setPerguntas([{ ...DEFAULT_PERGUNTA }]);
    setCategoria('outro'); setLinkVideo(''); setPublicoAlvo('publico');
    setRecorrenciaTipo('nao'); setRecorrenciaIntervalo(1); setRecorrenciaOcorrencias(4);
  };

  const applyTemplate = () => {
    setPerguntas(RECOVERY_TEMPLATE.map(p => ({ ...p, opcoes: [...p.opcoes] })));
    setDescricaoFormulario('Para finalidade de registro das pessoas que virão participar da sessão de RECOVERY, estamos coletando informações para organização de uma lista de participantes.\n\nSUGESTÃO: TRAZER TOALHA E MUDA DE ROUPA');
    toast.success('Template Recovery aplicado!');
  };

  const handleCreate = () => {
    if (!titulo || !dataEvento) { toast.error('Título e data são obrigatórios'); return; }
    const validPerguntas = perguntas.filter(p => p.pergunta.trim());
    criarEvento.mutate({
      titulo, descricao: descricao || null, descricao_formulario: descricaoFormulario || null,
      data_evento: dataEvento,
      horario_inicio: horarioInicio, horario_fim: horarioFim,
      local: local || null, vagas_max: vagasMax || null,
      cobrar_pagamento: cobrarPagamento, valor: cobrarPagamento ? valor : 0,
      pix_chave: pixChave || null, pix_tipo: pixTipo || 'cpf', pix_nome: pixNome || null,
      link_pagamento: linkPagamento || null, ativo: true,
      perguntas: validPerguntas,
    } as any, {
      onSuccess: () => { setOpenCreate(false); resetForm(); },
    });
  };

  const addPergunta = () => setPerguntas([...perguntas, { ...DEFAULT_PERGUNTA }]);
  const removePergunta = (i: number) => setPerguntas(perguntas.filter((_, idx) => idx !== i));
  const updatePergunta = (i: number, field: keyof PerguntaForm, value: any) => {
    const next = [...perguntas];
    (next[i] as any)[field] = value;
    if (field === 'tipo' && value !== 'multiple_choice' && value !== 'multiple_select') next[i].opcoes = [''];
    setPerguntas(next);
  };
  const addOpcao = (i: number) => {
    const next = [...perguntas];
    next[i].opcoes = [...next[i].opcoes, ''];
    setPerguntas(next);
  };
  const updateOpcao = (pi: number, oi: number, val: string) => {
    const next = [...perguntas];
    next[pi].opcoes[oi] = val;
    setPerguntas(next);
  };
  const removeOpcao = (pi: number, oi: number) => {
    const next = [...perguntas];
    next[pi].opcoes = next[pi].opcoes.filter((_, idx) => idx !== oi);
    setPerguntas(next);
  };

  const copyLink = (eventoId: string) => {
    const url = `${getBaseUrl()}/evento/${eventoId}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  if (selectedEvento) {
    return (
      <AppLayout>
        <EventoDetalhePainel
          eventoId={selectedEvento}
          evento={eventos?.find(e => e.id === selectedEvento) || null}
          onBack={() => setSelectedEvento(null)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Eventos</h1>
            <p className="text-sm text-muted-foreground">Crie eventos, colete inscrições e questionários</p>
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo Evento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Criar Evento</DialogTitle>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-4">
                <div className="space-y-4 pb-4">
                  <EventoFormFields
                    titulo={titulo} setTitulo={setTitulo}
                    descricao={descricao} setDescricao={setDescricao}
                    descricaoFormulario={descricaoFormulario} setDescricaoFormulario={setDescricaoFormulario}
                    dataEvento={dataEvento} setDataEvento={setDataEvento}
                    horarioInicio={horarioInicio} setHorarioInicio={setHorarioInicio}
                    horarioFim={horarioFim} setHorarioFim={setHorarioFim}
                    local={local} setLocal={setLocal}
                    vagasMax={vagasMax} setVagasMax={setVagasMax}
                    cobrarPagamento={cobrarPagamento} setCobrarPagamento={setCobrarPagamento}
                    valor={valor} setValor={setValor}
                    pixChave={pixChave} setPixChave={setPixChave}
                    pixTipo={pixTipo} setPixTipo={setPixTipo}
                    pixNome={pixNome} setPixNome={setPixNome}
                    linkPagamento={linkPagamento} setLinkPagamento={setLinkPagamento}
                  />

                  <Separator />

                  {/* Questions */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Questionário</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={applyTemplate} className="gap-1 text-xs">
                          <FileText className="h-3 w-3" /> Template Recovery
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={addPergunta} className="gap-1">
                          <Plus className="h-3 w-3" /> Pergunta
                        </Button>
                      </div>
                    </div>

                    <PerguntasEditor
                      perguntas={perguntas}
                      onUpdate={updatePergunta}
                      onRemove={removePergunta}
                      onAddOpcao={addOpcao}
                      onUpdateOpcao={updateOpcao}
                      onRemoveOpcao={removeOpcao}
                    />
                  </div>

                  <Button onClick={handleCreate} disabled={criarEvento.isPending} className="w-full">
                    {criarEvento.isPending ? 'Criando...' : 'Criar Evento'}
                  </Button>
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>

        {/* Event list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : !eventos?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Nenhum evento criado ainda</p>
              <p className="text-xs mt-1">Clique em "Novo Evento" para começar</p>
            </CardContent>
          </Card>
        ) : (() => {
          const todayStr = new Date().toISOString().split('T')[0];
          const proximos = eventos.filter(e => e.data_evento >= todayStr);
          const encerrados = eventos.filter(e => e.data_evento < todayStr);
          const renderGrid = (list: typeof eventos, emptyMsg: string) => (
            list.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{emptyMsg}</CardContent></Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map(ev => (
                  <EventoCard
                    key={ev.id}
                    evento={ev}
                    onView={() => setSelectedEvento(ev.id)}
                    onCopy={() => copyLink(ev.id)}
                    onToggle={() => toggleEvento.mutate({ id: ev.id, ativo: !ev.ativo })}
                    onDelete={() => { if (confirm('Deletar evento?')) deletarEvento.mutate(ev.id); }}
                    onEditQuestionario={() => setEditingQuestionario(ev.id)}
                    onEditEvento={() => setEditingEvento(ev.id)}
                  />
                ))}
              </div>
            )
          );
          return (
            <Tabs defaultValue="proximos" className="w-full">
              <TabsList className="grid w-full grid-cols-2 max-w-sm">
                <TabsTrigger value="proximos" className="gap-1.5">
                  <Calendar className="icon-sm" /> Próximos
                  {proximos.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{proximos.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="encerrados" className="gap-1.5">
                  <Archive className="icon-sm" /> Encerrados
                  {encerrados.length > 0 && <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{encerrados.length}</Badge>}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="proximos" className="mt-4">
                {renderGrid(proximos, 'Nenhum evento próximo.')}
              </TabsContent>
              <TabsContent value="encerrados" className="mt-4">
                {renderGrid(encerrados, 'Nenhum evento encerrado ainda.')}
              </TabsContent>
            </Tabs>
          );
        })()}

        {/* Edit Questionario Dialog */}
        {editingQuestionario && (
          <EditarQuestionarioDialog
            eventoId={editingQuestionario}
            open={!!editingQuestionario}
            onClose={() => setEditingQuestionario(null)}
            salvarPerguntas={salvarPerguntas}
          />
        )}

        {/* Edit Evento Dialog */}
        {editingEvento && (
          <EditarEventoDialog
            evento={eventos?.find(e => e.id === editingEvento) || null}
            open={!!editingEvento}
            onClose={() => setEditingEvento(null)}
            editarEvento={editarEvento}
          />
        )}
      </div>
    </AppLayout>
  );
}

/* ─── Shared form fields component ─── */
function EventoFormFields({
  titulo, setTitulo, descricao, setDescricao, descricaoFormulario, setDescricaoFormulario,
  dataEvento, setDataEvento, horarioInicio, setHorarioInicio, horarioFim, setHorarioFim,
  local, setLocal, vagasMax, setVagasMax,
  cobrarPagamento, setCobrarPagamento, valor, setValor,
  pixChave, setPixChave, pixTipo, setPixTipo, pixNome, setPixNome,
  linkPagamento, setLinkPagamento,
}: {
  titulo: string; setTitulo: (v: string) => void;
  descricao: string; setDescricao: (v: string) => void;
  descricaoFormulario: string; setDescricaoFormulario: (v: string) => void;
  dataEvento: string; setDataEvento: (v: string) => void;
  horarioInicio: string; setHorarioInicio: (v: string) => void;
  horarioFim: string; setHorarioFim: (v: string) => void;
  local: string; setLocal: (v: string) => void;
  vagasMax: number | ''; setVagasMax: (v: number | '') => void;
  cobrarPagamento: boolean; setCobrarPagamento: (v: boolean) => void;
  valor: number; setValor: (v: number) => void;
  pixChave: string; setPixChave: (v: string) => void;
  pixTipo: string; setPixTipo: (v: string) => void;
  pixNome: string; setPixNome: (v: string) => void;
  linkPagamento: string; setLinkPagamento: (v: string) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Label>Título *</Label>
          <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Sábado de Recovery" />
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição do evento</Label>
          <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes do evento..." rows={2} />
        </div>
        <div className="sm:col-span-2">
          <Label>Texto introdutório do formulário</Label>
          <Textarea value={descricaoFormulario} onChange={e => setDescricaoFormulario(e.target.value)} placeholder="Texto que aparecerá no topo do formulário de inscrição..." rows={3} />
        </div>
        <div>
          <Label>Data *</Label>
          <Input type="date" value={dataEvento} onChange={e => setDataEvento(e.target.value)} />
        </div>
        <div>
          <Label>Local</Label>
          <Input value={local} onChange={e => setLocal(e.target.value)} placeholder="Endereço ou online" />
        </div>
        <div>
          <Label>Horário Início</Label>
          <Input type="time" value={horarioInicio} onChange={e => setHorarioInicio(e.target.value)} />
        </div>
        <div>
          <Label>Horário Fim</Label>
          <Input type="time" value={horarioFim} onChange={e => setHorarioFim(e.target.value)} />
        </div>
        <div>
          <Label>Vagas (vazio = ilimitado)</Label>
          <Input type="number" value={vagasMax} onChange={e => setVagasMax(e.target.value ? Number(e.target.value) : '')} min={1} />
        </div>
      </div>

      <Separator />

      {/* Payment */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Switch checked={cobrarPagamento} onCheckedChange={setCobrarPagamento} />
          <Label>Cobrar pagamento</Label>
        </div>
        {cobrarPagamento && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-2 border-l-2 border-accent/30">
            <div>
              <Label>Valor (R$)</Label>
              <Input type="number" value={valor} onChange={e => setValor(Number(e.target.value))} min={0} step={0.01} />
            </div>
            <div>
              <Label>Chave PIX</Label>
              <Input value={pixChave} onChange={e => setPixChave(e.target.value)} placeholder="CPF, e-mail ou telefone" />
            </div>
            <div>
              <Label>Tipo PIX</Label>
              <Select value={pixTipo} onValueChange={setPixTipo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cpf">CPF</SelectItem>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="aleatoria">Chave aleatória</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome do beneficiário</Label>
              <Input value={pixNome} onChange={e => setPixNome(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="sm:col-span-2">
              <Label>Link de pagamento (opcional)</Label>
              <Input value={linkPagamento} onChange={e => setLinkPagamento(e.target.value)} placeholder="https://..." />
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/* ─── Perguntas Editor ─── */
function PerguntasEditor({ perguntas, onUpdate, onRemove, onAddOpcao, onUpdateOpcao, onRemoveOpcao }: {
  perguntas: PerguntaForm[];
  onUpdate: (i: number, field: keyof PerguntaForm, value: any) => void;
  onRemove: (i: number) => void;
  onAddOpcao: (i: number) => void;
  onUpdateOpcao: (pi: number, oi: number, val: string) => void;
  onRemoveOpcao: (pi: number, oi: number) => void;
}) {
  return (
    <>
      {perguntas.map((p, i) => (
        <Card key={i} className="border-dashed">
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 space-y-2">
                <Input value={p.pergunta} onChange={e => onUpdate(i, 'pergunta', e.target.value)} placeholder={`Pergunta ${i + 1}`} />
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={p.tipo} onValueChange={v => onUpdate(i, 'tipo', v)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto livre</SelectItem>
                      <SelectItem value="multiple_choice">Escolha única</SelectItem>
                      <SelectItem value="multiple_select">Múltipla escolha</SelectItem>
                      <SelectItem value="scale">Escala (0-10)</SelectItem>
                      <SelectItem value="boolean">Sim/Não</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Switch checked={p.obrigatoria} onCheckedChange={v => onUpdate(i, 'obrigatoria', v)} />
                    <span className="text-xs text-muted-foreground">Obrigatória</span>
                  </div>
                </div>
                {(p.tipo === 'multiple_choice' || p.tipo === 'multiple_select') && (
                  <div className="space-y-1 pl-2">
                    {p.opcoes.map((op, oi) => (
                      <div key={oi} className="flex items-center gap-1">
                        <Input value={op} onChange={e => onUpdateOpcao(i, oi, e.target.value)} placeholder={`Opção ${oi + 1}`} className="h-8 text-sm" />
                        {p.opcoes.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onRemoveOpcao(i, oi)}>
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="ghost" size="sm" onClick={() => onAddOpcao(i)} className="text-xs">+ Opção</Button>
                    <div className="flex items-center gap-2 mt-1">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap">Vagas por opção:</Label>
                      <Input
                        type="number"
                        value={p.limite_por_opcao ?? ''}
                        onChange={e => onUpdate(i, 'limite_por_opcao', e.target.value ? Number(e.target.value) : null)}
                        placeholder="Ilimitado"
                        className="h-7 w-28 text-xs"
                        min={1}
                      />
                    </div>
                  </div>
                )}
              </div>
              {perguntas.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(i)} className="text-destructive shrink-0">
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

/* ─── Edit Questionario Dialog ─── */
function EditarQuestionarioDialog({ eventoId, open, onClose, salvarPerguntas }: {
  eventoId: string; open: boolean; onClose: () => void; salvarPerguntas: any;
}) {
  const { data } = useEventoDetalhe(eventoId);
  const [perguntas, setPerguntas] = useState<PerguntaForm[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (data?.perguntas && !initialized) {
      setPerguntas(data.perguntas.map(p => ({
        tipo: p.tipo as PerguntaForm['tipo'],
        pergunta: p.pergunta,
        opcoes: Array.isArray(p.opcoes) ? [...(p.opcoes as string[])] : [''],
        obrigatoria: p.obrigatoria,
        limite_por_opcao: (p as any).limite_por_opcao ?? null,
      })));
      setInitialized(true);
    }
  }, [data, initialized]);

  const addPergunta = () => setPerguntas([...perguntas, { ...DEFAULT_PERGUNTA }]);
  const removePergunta = (i: number) => setPerguntas(perguntas.filter((_, idx) => idx !== i));
  const updatePergunta = (i: number, field: keyof PerguntaForm, value: any) => {
    const next = [...perguntas];
    (next[i] as any)[field] = value;
    if (field === 'tipo' && value !== 'multiple_choice' && value !== 'multiple_select') next[i].opcoes = [''];
    setPerguntas(next);
  };
  const addOpcao = (i: number) => {
    const next = [...perguntas];
    next[i].opcoes = [...next[i].opcoes, ''];
    setPerguntas(next);
  };
  const updateOpcao = (pi: number, oi: number, val: string) => {
    const next = [...perguntas];
    next[pi].opcoes[oi] = val;
    setPerguntas(next);
  };
  const removeOpcao = (pi: number, oi: number) => {
    const next = [...perguntas];
    next[pi].opcoes = next[pi].opcoes.filter((_, idx) => idx !== oi);
    setPerguntas(next);
  };

  const handleSave = () => {
    const validPerguntas = perguntas.filter(p => p.pergunta.trim());
    salvarPerguntas.mutate({ eventoId, perguntas: validPerguntas }, {
      onSuccess: () => { setInitialized(false); onClose(); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={() => { setInitialized(false); onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Questionário</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-3 pb-4">
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" onClick={addPergunta} className="gap-1">
                <Plus className="h-3 w-3" /> Pergunta
              </Button>
            </div>

            {perguntas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma pergunta. Clique em "+ Pergunta" para adicionar.</p>
            )}

            <PerguntasEditor
              perguntas={perguntas}
              onUpdate={updatePergunta}
              onRemove={removePergunta}
              onAddOpcao={addOpcao}
              onUpdateOpcao={updateOpcao}
              onRemoveOpcao={removeOpcao}
            />

            <Button onClick={handleSave} disabled={salvarPerguntas.isPending} className="w-full">
              {salvarPerguntas.isPending ? 'Salvando...' : 'Salvar Questionário'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Evento Dialog (ALL fields) ─── */
function EditarEventoDialog({ evento, open, onClose, editarEvento }: {
  evento: Evento | null; open: boolean; onClose: () => void; editarEvento: any;
}) {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [descricaoFormulario, setDescricaoFormulario] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('09:00');
  const [horarioFim, setHorarioFim] = useState('12:00');
  const [local, setLocal] = useState('');
  const [vagasMax, setVagasMax] = useState<number | ''>('');
  const [cobrarPagamento, setCobrarPagamento] = useState(false);
  const [valor, setValor] = useState<number>(0);
  const [pixChave, setPixChave] = useState('');
  const [pixTipo, setPixTipo] = useState('cpf');
  const [pixNome, setPixNome] = useState('');
  const [linkPagamento, setLinkPagamento] = useState('');

  useEffect(() => {
    if (evento) {
      setTitulo(evento.titulo || '');
      setDescricao(evento.descricao || '');
      setDescricaoFormulario(evento.descricao_formulario || '');
      setDataEvento(evento.data_evento || '');
      setHorarioInicio(evento.horario_inicio?.slice(0, 5) || '09:00');
      setHorarioFim(evento.horario_fim?.slice(0, 5) || '12:00');
      setLocal(evento.local || '');
      setVagasMax(evento.vagas_max ?? '');
      setCobrarPagamento(evento.cobrar_pagamento);
      setValor(evento.valor || 0);
      setPixChave(evento.pix_chave || '');
      setPixTipo(evento.pix_tipo || 'cpf');
      setPixNome(evento.pix_nome || '');
      setLinkPagamento(evento.link_pagamento || '');
    }
  }, [evento]);

  const handleSave = () => {
    if (!evento) return;
    if (!titulo || !dataEvento) { toast.error('Título e data são obrigatórios'); return; }
    editarEvento.mutate({
      id: evento.id,
      titulo,
      descricao: descricao || null,
      descricao_formulario: descricaoFormulario || null,
      data_evento: dataEvento,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      local: local || null,
      vagas_max: vagasMax || null,
      cobrar_pagamento: cobrarPagamento,
      valor: cobrarPagamento ? valor : 0,
      pix_chave: pixChave || null,
      pix_tipo: pixTipo || 'cpf',
      pix_nome: pixNome || null,
      link_pagamento: linkPagamento || null,
    }, {
      onSuccess: () => onClose(),
    });
  };

  if (!evento) return null;

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Editar Evento</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-4">
          <div className="space-y-4 pb-4">
            <EventoFormFields
              titulo={titulo} setTitulo={setTitulo}
              descricao={descricao} setDescricao={setDescricao}
              descricaoFormulario={descricaoFormulario} setDescricaoFormulario={setDescricaoFormulario}
              dataEvento={dataEvento} setDataEvento={setDataEvento}
              horarioInicio={horarioInicio} setHorarioInicio={setHorarioInicio}
              horarioFim={horarioFim} setHorarioFim={setHorarioFim}
              local={local} setLocal={setLocal}
              vagasMax={vagasMax} setVagasMax={setVagasMax}
              cobrarPagamento={cobrarPagamento} setCobrarPagamento={setCobrarPagamento}
              valor={valor} setValor={setValor}
              pixChave={pixChave} setPixChave={setPixChave}
              pixTipo={pixTipo} setPixTipo={setPixTipo}
              pixNome={pixNome} setPixNome={setPixNome}
              linkPagamento={linkPagamento} setLinkPagamento={setLinkPagamento}
            />
            <Button onClick={handleSave} disabled={editarEvento.isPending} className="w-full">
              {editarEvento.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Event Card ─── */
function EventoCard({ evento, onView, onCopy, onToggle, onDelete, onEditQuestionario, onEditEvento }: {
  evento: Evento; onView: () => void; onCopy: () => void; onToggle: () => void; onDelete: () => void; onEditQuestionario: () => void; onEditEvento: () => void;
}) {
  const isPast = new Date(evento.data_evento) < new Date(new Date().toDateString());
  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-base leading-tight">{evento.titulo}</CardTitle>
          <Badge variant={evento.ativo && !isPast ? 'default' : 'secondary'}>
            {isPast ? 'Encerrado' : evento.ativo ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Calendar className="icon-sm" />
            {format(new Date(evento.data_evento + 'T12:00:00'), "dd 'de' MMMM, yyyy", { locale: ptBR })}
          </div>
          <div className="flex items-center gap-2">
            <Clock className="icon-sm" />
            {evento.horario_inicio?.slice(0, 5)} – {evento.horario_fim?.slice(0, 5)}
          </div>
          {evento.local && (
            <div className="flex items-center gap-2">
              <MapPin className="icon-sm" />
              <span className="truncate">{evento.local}</span>
            </div>
          )}
          {evento.cobrar_pagamento && (
            <div className="flex items-center gap-2">
              <DollarSign className="icon-sm" />
              R$ {Number(evento.valor).toFixed(2)}
            </div>
          )}
          {evento.vagas_max && (
            <div className="flex items-center gap-2">
              <Users className="icon-sm" />
              {evento.vagas_max} vagas
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 pt-1">
          <Button variant="outline" size="sm" onClick={onView} className="flex-1 gap-1.5 h-8">
            <Eye className="icon-sm" /> Ver
          </Button>
          <div className="flex items-center gap-0.5">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onEditEvento} title="Editar evento">
              <Pencil className="icon-sm" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onEditQuestionario} title="Questionário">
              <FileText className="icon-sm" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={onCopy} title="Copiar link">
              <Copy className="icon-sm" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggle} title={evento.ativo ? 'Desativar' : 'Ativar'}>
              {evento.ativo ? <X className="icon-sm" /> : <Check className="icon-sm" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={onDelete} title="Deletar">
              <Trash2 className="icon-sm" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
