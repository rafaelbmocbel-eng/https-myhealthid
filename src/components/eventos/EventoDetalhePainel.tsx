import { useState } from 'react';
import { useEventoDetalhe, useEventoRespostas, useMarcarInscricaoPaga, type Evento, type EventoInscricao, type EventoPergunta } from '@/hooks/useEventos';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Users, UserPlus, UserCheck, Copy, ChevronRight, DollarSign, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { getBaseUrl } from '@/utils/linkUrls';

interface Props {
  eventoId: string;
  evento: Evento | null;
  onBack: () => void;
}

export default function EventoDetalhePainel({ eventoId, evento, onBack }: Props) {
  const { data, isLoading } = useEventoDetalhe(eventoId);
  const marcarPago = useMarcarInscricaoPaga();
  const [selectedInscricao, setSelectedInscricao] = useState<string | null>(null);

  if (!evento) return null;

  const inscritos = data?.inscricoes || [];
  const perguntas = data?.perguntas || [];
  const novos = inscritos.filter(i => !i.ja_era_paciente).length;
  const ativos = inscritos.filter(i => i.ja_era_paciente).length;
  const valorUnit = Number(evento.valor) || 0;
  const pagosCount = inscritos.filter(i => i.pago).length;
  const pendentesCount = inscritos.length - pagosCount;
  const receitaConfirmada = pagosCount * valorUnit;
  const receitaPendente = pendentesCount * valorUnit;

  const copyLink = () => {
    navigator.clipboard.writeText(`${getBaseUrl()}/evento/${eventoId}`);
    toast.success('Link copiado!');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground">{evento.titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {format(new Date(evento.data_evento + 'T12:00:00'), "dd 'de' MMMM, yyyy", { locale: ptBR })}
            {' · '}{evento.horario_inicio?.slice(0, 5)} – {evento.horario_fim?.slice(0, 5)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
          <Copy className="h-4 w-4" /> Link público
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{inscritos.length}</div>
            <div className="text-xs text-muted-foreground">Total inscritos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <UserPlus className="h-5 w-5 mx-auto mb-1 text-emerald-500" />
            <div className="text-2xl font-bold">{novos}</div>
            <div className="text-xs text-muted-foreground">Novos clientes</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <UserCheck className="h-5 w-5 mx-auto mb-1 text-primary" />
            <div className="text-2xl font-bold">{ativos}</div>
            <div className="text-xs text-muted-foreground">Já eram pacientes</div>
          </CardContent>
        </Card>
      </div>

      {/* Receita (apenas eventos pagos) */}
      {evento.cobrar_pagamento && valorUnit > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-emerald-500" /> Receita do evento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <div className="text-lg font-bold text-emerald-600">R$ {receitaConfirmada.toFixed(2)}</div>
                <div className="text-[11px] text-muted-foreground">Confirmada ({pagosCount})</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-600">R$ {receitaPendente.toFixed(2)}</div>
                <div className="text-[11px] text-muted-foreground">Pendente ({pendentesCount})</div>
              </div>
              <div>
                <div className="text-lg font-bold">R$ {(receitaConfirmada + receitaPendente).toFixed(2)}</div>
                <div className="text-[11px] text-muted-foreground">Potencial total</div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 text-center">
              Valor unitário: R$ {valorUnit.toFixed(2)} · Confirme pagamentos manualmente abaixo quando receber o PIX.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Inscriptions list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Inscritos ({inscritos.length}{evento.vagas_max ? `/${evento.vagas_max}` : ''})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !inscritos.length ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma inscrição ainda</p>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-2">
                {inscritos.map((ins, idx) => (
                  <div
                    key={ins.id}
                    className="w-full p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => setSelectedInscricao(ins.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="font-medium text-sm truncate">{ins.nome}</span>
                          <Badge variant={ins.ja_era_paciente ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                            {ins.ja_era_paciente ? 'Paciente ativo' : 'Novo'}
                          </Badge>
                          {evento.cobrar_pagamento && (
                            <Badge variant={ins.pago ? 'default' : 'destructive'} className="text-[10px] shrink-0">
                              {ins.pago ? 'Pago' : 'Pendente'}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 pl-7">
                          {ins.email && <span>{ins.email}</span>}
                          {ins.telefone && <span> · {ins.telefone}</span>}
                          <span> · {format(new Date(ins.created_at), 'dd/MM HH:mm')}</span>
                        </div>
                      </button>
                      {perguntas.length > 0 && (
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground shrink-0 mt-1 cursor-pointer"
                          onClick={() => setSelectedInscricao(ins.id)}
                        />
                      )}
                    </div>
                    {evento.cobrar_pagamento && (
                      <div className="mt-2 pl-7">
                        <Button
                          variant={ins.pago ? 'outline' : 'default'}
                          size="sm"
                          className="h-7 text-[11px] gap-1.5"
                          disabled={marcarPago.isPending}
                          onClick={(e) => {
                            e.stopPropagation();
                            marcarPago.mutate({ inscricaoId: ins.id, pago: !ins.pago });
                          }}
                        >
                          {ins.pago ? (
                            <><XCircle className="h-3 w-3" /> Desmarcar pago</>
                          ) : (
                            <><CheckCircle2 className="h-3 w-3" /> Confirmar pagamento</>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Respostas dialog */}
      <RespostasDialog
        inscricaoId={selectedInscricao}
        perguntas={perguntas}
        inscrito={inscritos.find(i => i.id === selectedInscricao)}
        open={!!selectedInscricao}
        onClose={() => setSelectedInscricao(null)}
      />
    </div>
  );
}

function RespostasDialog({ inscricaoId, perguntas, inscrito, open, onClose }: {
  inscricaoId: string | null; perguntas: EventoPergunta[]; inscrito?: EventoInscricao; open: boolean; onClose: () => void;
}) {
  const { data: respostas } = useEventoRespostas(open ? inscricaoId : null);

  const getResp = (perguntaId: string) => {
    const r = respostas?.find((r: any) => r.pergunta_id === perguntaId);
    if (!r) return '—';
    const val = r.resposta;
    if (typeof val === 'boolean') return val ? 'Sim' : 'Não';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'string') return val;
    if (Array.isArray(val)) return val.join(', ');
    if (val && typeof val === 'object' && 'value' in val) return String(val.value);
    return JSON.stringify(val);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Respostas — {inscrito?.nome}</DialogTitle>
        </DialogHeader>

        {/* Contact info */}
        {inscrito && (
          <div className="text-xs text-muted-foreground space-y-0.5 pb-2 border-b border-border">
            {inscrito.email && <p>📧 {inscrito.email}</p>}
            {inscrito.telefone && <p>📱 {inscrito.telefone}</p>}
            <p>📅 Inscrito em {format(new Date(inscrito.created_at), "dd/MM/yyyy 'às' HH:mm")}</p>
          </div>
        )}

        <div className="space-y-3">
          {perguntas.map((p, idx) => (
            <div key={p.id} className="space-y-1">
              <div className="text-sm font-medium">{idx + 1}. {p.pergunta}</div>
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                {getResp(p.id)}
              </div>
            </div>
          ))}
          {!perguntas.length && <p className="text-sm text-muted-foreground">Nenhuma pergunta configurada</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
