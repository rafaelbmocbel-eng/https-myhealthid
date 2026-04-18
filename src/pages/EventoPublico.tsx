import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Calendar, Clock, MapPin, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Evento {
  id: string; titulo: string; descricao: string | null; descricao_formulario: string | null;
  data_evento: string; horario_inicio: string; horario_fim: string; local: string | null;
  vagas_max: number | null; cobrar_pagamento: boolean; valor: number;
  ativo: boolean;
}

interface EventoPagamento {
  pix_chave: string | null; pix_tipo: string | null; pix_nome: string | null;
  link_pagamento: string | null; valor: number | null;
}

interface Pergunta {
  id: string; ordem: number; tipo: string; pergunta: string; opcoes: string[]; obrigatoria: boolean;
  limite_por_opcao: number | null;
}

export default function EventoPublico() {
  const { eventoId } = useParams<{ eventoId: string }>();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [vagasRestantes, setVagasRestantes] = useState<number | null>(null);
  const [pagamentoInfo, setPagamentoInfo] = useState<EventoPagamento | null>(null);
  const [inscricaoId, setInscricaoId] = useState<string | null>(null);
  const [optionCounts, setOptionCounts] = useState<Record<string, Record<string, number>>>({});

  // Patient detection (when already logged in to portal) — enables 1-click registration
  const [pacienteLogado, setPacienteLogado] = useState<{ id: string; nome: string; sobrenome: string | null; email: string | null; telefone: string | null } | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [respostas, setRespostas] = useState<Record<string, any>>({});

  // Detect logged-in patient (portal session) — auto-fill form for 1-click signup
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled || !session?.user) return;
        const { data: pac } = await supabase
          .from('pacientes')
          .select('id, nome, sobrenome, email, telefone')
          .eq('user_id', session.user.id)
          .maybeSingle();
        if (!cancelled && pac) {
          setPacienteLogado(pac as any);
          setNome(`${pac.nome} ${pac.sobrenome || ''}`.trim());
          setEmail(pac.email || '');
          setTelefone(pac.telefone || '');
        }
      } catch (_) { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!eventoId) return;
    loadEvento();
  }, [eventoId]);

  const loadEvento = async () => {
    const { data: ev } = await supabase
      .from('eventos_publicos')
      .select('*')
      .eq('id', eventoId!)
      .eq('ativo', true)
      .single() as any;

    if (!ev) { setError('Evento não encontrado ou já encerrado'); setLoading(false); return; }
    setEvento(ev);

    const { data: pergs } = await supabase
      .from('evento_perguntas')
      .select('*')
      .eq('evento_id', eventoId!)
      .order('ordem') as any;
    
    const perguntasList: Pergunta[] = (pergs || []).map((p: any) => ({
      ...p,
      limite_por_opcao: p.limite_por_opcao ?? null,
    }));
    setPerguntas(perguntasList);

    // Check global vagas using secure RPC (no PII exposed)
    if (ev.vagas_max) {
      const { data: inscCount } = await supabase
        .rpc('count_evento_inscricoes', { p_evento_id: eventoId! }) as any;
      setVagasRestantes(ev.vagas_max - (inscCount || 0));
    }

    // Load option counts for questions with limits
    const questionsWithLimits = perguntasList.filter(p => p.limite_por_opcao && (p.tipo === 'multiple_choice' || p.tipo === 'multiple_select'));
    if (questionsWithLimits.length > 0) {
      const { data: allRespostas } = await supabase
        .from('evento_respostas')
        .select('pergunta_id, resposta, inscricao_id')
        .in('pergunta_id', questionsWithLimits.map(q => q.id)) as any;

      // Only count responses from non-cancelled inscriptions using secure RPC
      const { data: activeInscricoes } = await supabase
        .rpc('get_active_inscricao_ids', { p_evento_id: eventoId! }) as any;
      const activeIds = new Set((activeInscricoes || []).map((i: any) => i.id));

      const counts: Record<string, Record<string, number>> = {};
      for (const r of (allRespostas || [])) {
        if (!activeIds.has(r.inscricao_id)) continue;
        const pid = r.pergunta_id;
        if (!counts[pid]) counts[pid] = {};
        const val = r.resposta;
        if (typeof val === 'string') {
          counts[pid][val] = (counts[pid][val] || 0) + 1;
        } else if (val && typeof val === 'object' && 'value' in val) {
          const sv = String(val.value);
          counts[pid][sv] = (counts[pid][sv] || 0) + 1;
        } else if (Array.isArray(val)) {
          for (const v of val) {
            counts[pid][v] = (counts[pid][v] || 0) + 1;
          }
        }
      }
      setOptionCounts(counts);
    }

    setLoading(false);
  };

  const isOptionFull = (pergunta: Pergunta, option: string): boolean => {
    if (!pergunta.limite_por_opcao) return false;
    const count = optionCounts[pergunta.id]?.[option] || 0;
    return count >= pergunta.limite_por_opcao;
  };

  const getAvailableOptions = (pergunta: Pergunta): string[] => {
    return (pergunta.opcoes as string[]).filter(Boolean).filter(op => !isOptionFull(pergunta, op));
  };

  const handleSubmit = async () => {
    if (!nome.trim()) { toast.error('Informe seu nome'); return; }
    if (!telefone.trim()) { toast.error('Informe seu WhatsApp'); return; }
    if (!email.trim()) { toast.error('Informe seu e-mail'); return; }

    for (const p of perguntas) {
      if (p.obrigatoria) {
        const available = getAvailableOptions(p);
        // If all options are full for a required choice question, skip validation
        if ((p.tipo === 'multiple_choice' || p.tipo === 'multiple_select') && available.length === 0) continue;
        const val = respostas[p.id];
        if (val === undefined || val === '' || (Array.isArray(val) && val.length === 0)) {
          toast.error(`Responda: "${p.pergunta}"`); return;
        }
      }
    }

    setSubmitting(true);
    try {
      const resp = await supabase.functions.invoke('evento-inscricao', {
        body: {
          evento_id: eventoId,
          nome: nome.trim(),
          email: email.trim() || null,
          telefone: telefone.trim() || null,
          paciente_id: pacienteLogado?.id || null,
          respostas: perguntas.map(p => ({ pergunta_id: p.id, resposta: respostas[p.id] ?? null })),
        },
      });
      if (resp.error) throw new Error(resp.error.message);
      if (resp.data?.error) throw new Error(resp.data.error);
      const newInscricaoId = resp.data?.inscricao_id;
      setInscricaoId(newInscricaoId);
      // Load payment info via secure RPC if event charges payment
      if (evento?.cobrar_pagamento && newInscricaoId) {
        const { data: pagData } = await supabase.rpc('get_evento_pagamento', {
          p_evento_id: eventoId!,
          p_inscricao_id: newInscricaoId,
        }) as any;
        if (pagData && pagData.length > 0) {
          setPagamentoInfo(pagData[0]);
        }
      }
      setSubmitted(true);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao inscrever');
    }
    setSubmitting(false);
  };

  const toggleMultiSelect = (perguntaId: string, option: string) => {
    const current: string[] = respostas[perguntaId] || [];
    if (current.includes(option)) {
      setRespostas({ ...respostas, [perguntaId]: current.filter(o => o !== option) });
    } else {
      setRespostas({ ...respostas, [perguntaId]: [...current, option] });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted">
        <div className="animate-pulse text-muted-foreground">Carregando evento...</div>
      </div>
    );
  }

  if (error || !evento) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-destructive" />
            <p className="font-medium">{error || 'Evento não encontrado'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 text-center space-y-3">
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-500" />
            <h2 className="text-xl font-bold">Inscrição Confirmada!</h2>
            <p className="text-sm text-muted-foreground">
              Você está inscrito(a) no evento <strong>{evento.titulo}</strong>.
            </p>
            {pagamentoInfo?.link_pagamento && (
              <Button asChild className="w-full mt-4">
                <a href={pagamentoInfo.link_pagamento} target="_blank" rel="noopener noreferrer">Realizar Pagamento</a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Event info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-xl">{evento.titulo}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {evento.descricao && <p className="text-foreground text-sm mb-3">{evento.descricao}</p>}
            {(evento as any).descricao_formulario && (
              <p className="text-foreground text-sm mb-3 whitespace-pre-line">{(evento as any).descricao_formulario}</p>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {format(new Date(evento.data_evento + 'T12:00:00'), "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              {evento.horario_inicio?.slice(0, 5)} – {evento.horario_fim?.slice(0, 5)}
            </div>
            {evento.local && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                {evento.local}
              </div>
            )}
            {vagasRestantes !== null && (
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {vagasRestantes > 0 ? `${vagasRestantes} vaga${vagasRestantes > 1 ? 's' : ''} restante${vagasRestantes > 1 ? 's' : ''}` : 'Vagas esgotadas'}
              </div>
            )}
            {evento.cobrar_pagamento && evento.valor > 0 && (
              <div className="mt-2 p-2 rounded-lg bg-accent/10 text-accent-foreground font-medium">
                Valor: R$ {Number(evento.valor).toFixed(2)}
              </div>
            )}
          </CardContent>
        </Card>

        {vagasRestantes !== null && vagasRestantes <= 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              Vagas esgotadas para este evento.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Registration form */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sua inscrição</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Nome completo *</Label>
                  <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" />
                </div>
                <div>
                  <Label>WhatsApp *</Label>
                  <Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
                </div>
                <div>
                  <Label>E-mail *</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
                </div>
              </CardContent>
            </Card>

            {/* Questionnaire */}
            {perguntas.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Questionário</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {perguntas.map(p => {
                    const availableOpts = getAvailableOptions(p);
                    const allOpts = (p.opcoes as string[]).filter(Boolean);

                    return (
                      <div key={p.id} className="space-y-2">
                        <Label className="text-sm font-medium">{p.pergunta}{p.obrigatoria && ' *'}</Label>

                        {p.tipo === 'text' && (
                          <Textarea
                            value={respostas[p.id] || ''}
                            onChange={e => setRespostas({ ...respostas, [p.id]: e.target.value })}
                            placeholder="Sua resposta..."
                            rows={2}
                          />
                        )}

                        {p.tipo === 'multiple_choice' && (
                          availableOpts.length === 0 ? (
                            <p className="text-sm text-muted-foreground italic">Todas as opções estão esgotadas.</p>
                          ) : (
                            <RadioGroup value={respostas[p.id] || ''} onValueChange={v => setRespostas({ ...respostas, [p.id]: v })}>
                              {allOpts.map((op, i) => {
                                const full = isOptionFull(p, op);
                                if (full) return null;
                                const remaining = p.limite_por_opcao ? p.limite_por_opcao - (optionCounts[p.id]?.[op] || 0) : null;
                                return (
                                  <div key={i} className="flex items-center space-x-2">
                                    <RadioGroupItem value={op} id={`${p.id}-${i}`} />
                                    <Label htmlFor={`${p.id}-${i}`} className="font-normal">
                                      {op}
                                      {remaining !== null && (
                                        <span className="text-xs text-muted-foreground ml-1">({remaining} vaga{remaining > 1 ? 's' : ''})</span>
                                      )}
                                    </Label>
                                  </div>
                                );
                              })}
                            </RadioGroup>
                          )
                        )}

                        {p.tipo === 'multiple_select' && (
                          availableOpts.length === 0 && p.limite_por_opcao ? (
                            <p className="text-sm text-muted-foreground italic">Todas as opções estão esgotadas.</p>
                          ) : (
                            <div className="space-y-2">
                              {allOpts.map((op, i) => {
                                const full = isOptionFull(p, op);
                                if (full) return null;
                                const remaining = p.limite_por_opcao ? p.limite_por_opcao - (optionCounts[p.id]?.[op] || 0) : null;
                                return (
                                  <div key={i} className="flex items-center space-x-2">
                                    <Checkbox
                                      id={`${p.id}-ms-${i}`}
                                      checked={(respostas[p.id] || []).includes(op)}
                                      onCheckedChange={() => toggleMultiSelect(p.id, op)}
                                    />
                                    <Label htmlFor={`${p.id}-ms-${i}`} className="font-normal">
                                      {op}
                                      {remaining !== null && (
                                        <span className="text-xs text-muted-foreground ml-1">({remaining} vaga{remaining > 1 ? 's' : ''})</span>
                                      )}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          )
                        )}

                        {p.tipo === 'scale' && (
                          <div className="space-y-2">
                            <Slider
                              value={[respostas[p.id] ?? 5]}
                              onValueChange={([v]) => setRespostas({ ...respostas, [p.id]: v })}
                              max={10} min={0} step={1}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>0</span>
                              <span className="font-medium text-foreground">{respostas[p.id] ?? 5}</span>
                              <span>10</span>
                            </div>
                          </div>
                        )}

                        {p.tipo === 'boolean' && (
                          <RadioGroup value={respostas[p.id] ?? ''} onValueChange={v => setRespostas({ ...respostas, [p.id]: v })}>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="sim" id={`${p.id}-sim`} />
                              <Label htmlFor={`${p.id}-sim`} className="font-normal">Sim</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="nao" id={`${p.id}-nao`} />
                              <Label htmlFor={`${p.id}-nao`} className="font-normal">Não</Label>
                            </div>
                          </RadioGroup>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
              {submitting ? 'Inscrevendo...' : 'Confirmar Inscrição'}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
