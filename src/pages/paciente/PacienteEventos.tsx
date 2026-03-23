import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, Users, CheckCircle2, Loader2, Ticket } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import PacienteLayout from '@/components/paciente/PacienteLayout';
import ProtectedPatientRoute from '@/components/paciente/ProtectedPatientRoute';

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  data_evento: string;
  horario_inicio: string;
  horario_fim: string;
  local: string | null;
  vagas_max: number | null;
  cobrar_pagamento: boolean;
  valor: number;
  link_pagamento: string | null;
  descricao_formulario: string | null;
}

interface Pergunta {
  id: string;
  ordem: number;
  tipo: string;
  pergunta: string;
  opcoes: string[];
  obrigatoria: boolean;
}

export default function PacienteEventos() {
  const { user } = useAuth();
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);
  const [paciente, setPaciente] = useState<{ id: string; nome: string; email: string | null; telefone: string | null; terapeuta_id: string } | null>(null);
  const [inscricoes, setInscricoes] = useState<Set<string>>(new Set());

  // Dialog state
  const [selectedEvento, setSelectedEvento] = useState<Evento | null>(null);
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [respostas, setRespostas] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [vagasMap, setVagasMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    // Get patient info including terapeuta_id in one query
    const { data: pac } = await supabase
      .from('pacientes')
      .select('id, nome, email, telefone, terapeuta_id')
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!pac) { setLoading(false); return; }
    setPaciente(pac);

    // Get active events from this therapist
    const today = new Date().toISOString().split('T')[0];
    const { data: evts } = await supabase
      .from('eventos')
        .select('id, titulo, descricao, descricao_formulario, data_evento, horario_inicio, horario_fim, local, vagas_max, cobrar_pagamento, valor, link_pagamento')
      .eq('terapeuta_id', pac.terapeuta_id)
      .eq('ativo', true)
      .gte('data_evento', today)
      .order('data_evento', { ascending: true });

    setEventos(evts || []);

    // Check which events the patient is already inscribed
    if (evts && evts.length > 0) {
      const { data: insc } = await supabase
        .from('evento_inscricoes')
        .select('evento_id')
        .eq('paciente_id', pac.id)
        .neq('status', 'cancelado');

      const inscSet = new Set((insc || []).map(i => i.evento_id));
      setInscricoes(inscSet);

      // Get vacancy counts
      const vMap: Record<string, number> = {};
      for (const ev of evts) {
        if (ev.vagas_max) {
          const { count } = await supabase
            .from('evento_inscricoes')
            .select('*', { count: 'exact', head: true })
            .eq('evento_id', ev.id)
            .neq('status', 'cancelado');
          vMap[ev.id] = ev.vagas_max - (count || 0);
        }
      }
      setVagasMap(vMap);
    }

    setLoading(false);
  };

  const openInscricao = async (evento: Evento) => {
    setSelectedEvento(evento);
    setRespostas({});
    // Load questions
    const { data: pergs } = await supabase
      .from('evento_perguntas')
      .select('*')
      .eq('evento_id', evento.id)
      .order('ordem') as any;
    setPerguntas(pergs || []);
  };

  const handleInscrever = async () => {
    if (!selectedEvento || !paciente) return;

    for (const p of perguntas) {
      const value = respostas[p.id];
      const isEmptyArray = Array.isArray(value) && value.length === 0;
      if (p.obrigatoria && (value === undefined || value === '' || value === null || isEmptyArray)) {
        toast.error(`Responda: "${p.pergunta}"`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const resp = await supabase.functions.invoke('evento-inscricao', {
        body: {
          evento_id: selectedEvento.id,
          nome: paciente.nome,
          email: paciente.email || null,
          telefone: paciente.telefone || null,
          paciente_id: paciente.id,
          respostas: perguntas.map(p => ({ pergunta_id: p.id, resposta: respostas[p.id] ?? null })),
        },
      });
      if (resp.error) throw new Error(resp.error.message);
      if (resp.data?.error) throw new Error(resp.data.error);

      toast.success('Inscrição confirmada!');
      setInscricoes(prev => new Set([...prev, selectedEvento.id]));
      setSelectedEvento(null);
    } catch (e: any) {
      toast.error(e.message || 'Erro ao inscrever');
    }
    setSubmitting(false);
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
      opacity: 1, y: 0,
      transition: { delay: i * 0.06, duration: 0.35 },
    }),
  };

  return (
    <ProtectedPatientRoute>
      <PacienteLayout>
        <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
          <h1 className="text-lg font-bold text-foreground">Eventos</h1>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : eventos.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                <Ticket className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                <p className="text-sm">Nenhum evento disponível no momento.</p>
              </CardContent>
            </Card>
          ) : (
            eventos.map((ev, i) => {
              const jaInscrito = inscricoes.has(ev.id);
              const vagasRest = ev.vagas_max ? vagasMap[ev.id] : null;
              const esgotado = vagasRest !== null && vagasRest !== undefined && vagasRest <= 0;

              return (
                <motion.div key={ev.id} variants={fadeUp} initial="hidden" animate="visible" custom={i}>
                  <Card className="overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <h2 className="text-sm font-bold text-foreground">{ev.titulo}</h2>
                        {jaInscrito && (
                          <Badge variant="outline" className="bg-accent/10 text-accent-foreground border-accent/20 text-[10px] shrink-0">
                            <CheckCircle2 className="h-3 w-3 mr-0.5" /> Inscrito
                          </Badge>
                        )}
                      </div>

                      {ev.descricao && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{ev.descricao}</p>
                      )}

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-primary" />
                          {format(new Date(ev.data_evento + 'T12:00:00'), "EEE, dd MMM", { locale: ptBR })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {ev.horario_inicio?.slice(0, 5)} – {ev.horario_fim?.slice(0, 5)}
                        </span>
                        {ev.local && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-primary" />
                            {ev.local}
                          </span>
                        )}
                        {vagasRest !== null && vagasRest !== undefined && (
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            {vagasRest > 0 ? `${vagasRest} vaga${vagasRest > 1 ? 's' : ''}` : 'Esgotado'}
                          </span>
                        )}
                      </div>

                      {ev.cobrar_pagamento && ev.valor > 0 && (
                        <div className="text-xs font-semibold text-primary">
                          R$ {Number(ev.valor).toFixed(2)}
                        </div>
                      )}

                      {!jaInscrito && !esgotado && (
                        <Button size="sm" className="w-full" onClick={() => openInscricao(ev)}>
                          Inscrever-se
                        </Button>
                      )}
                      {jaInscrito && ev.cobrar_pagamento && ev.link_pagamento && (
                        <Button size="sm" variant="outline" className="w-full" asChild>
                          <a href={ev.link_pagamento} target="_blank" rel="noopener noreferrer">
                            Realizar Pagamento
                          </a>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Inscription Dialog */}
        <Dialog open={!!selectedEvento} onOpenChange={() => setSelectedEvento(null)}>
          <DialogContent className="max-w-md max-h-[85dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base">Inscrição – {selectedEvento?.titulo}</DialogTitle>
            </DialogHeader>

            {perguntas.length > 0 ? (
              <div className="space-y-4">
                {selectedEvento?.descricao_formulario && (
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground whitespace-pre-line">
                    {selectedEvento.descricao_formulario}
                  </div>
                )}

                {perguntas.map(p => (
                  <div key={p.id} className="space-y-2">
                    <Label className="text-sm">{p.pergunta}{p.obrigatoria && ' *'}</Label>

                    {p.tipo === 'text' && (
                      <Textarea
                        value={respostas[p.id] || ''}
                        onChange={e => setRespostas({ ...respostas, [p.id]: e.target.value })}
                        placeholder="Sua resposta..."
                        rows={2}
                      />
                    )}

                    {p.tipo === 'multiple_choice' && (
                      <RadioGroup value={respostas[p.id] || ''} onValueChange={v => setRespostas({ ...respostas, [p.id]: v })}>
                        {(p.opcoes as string[]).filter(Boolean).map((op, idx) => (
                          <div key={idx} className="flex items-center space-x-2">
                            <RadioGroupItem value={op} id={`${p.id}-${idx}`} />
                            <Label htmlFor={`${p.id}-${idx}`} className="font-normal text-sm">{op}</Label>
                          </div>
                        ))}
                      </RadioGroup>
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

                    {p.tipo === 'multiple_select' && (
                      <div className="space-y-2">
                        {(p.opcoes as string[]).filter(Boolean).map((op, idx) => {
                          const current = Array.isArray(respostas[p.id]) ? respostas[p.id] : [];
                          const checked = current.includes(op);

                          return (
                            <label key={idx} className="flex items-center gap-2 text-sm font-normal cursor-pointer">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(nextChecked) => {
                                  const nextValues = nextChecked
                                    ? [...current, op]
                                    : current.filter((item: string) => item !== op);

                                  setRespostas({ ...respostas, [p.id]: nextValues });
                                }}
                              />
                              <span>{op}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {p.tipo === 'boolean' && (
                      <RadioGroup value={respostas[p.id] ?? ''} onValueChange={v => setRespostas({ ...respostas, [p.id]: v })}>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sim" id={`${p.id}-sim`} />
                          <Label htmlFor={`${p.id}-sim`} className="font-normal text-sm">Sim</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="nao" id={`${p.id}-nao`} />
                          <Label htmlFor={`${p.id}-nao`} className="font-normal text-sm">Não</Label>
                        </div>
                      </RadioGroup>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Confirme sua inscrição no evento.</p>
            )}

            <Button onClick={handleInscrever} disabled={submitting} className="w-full mt-2">
              {submitting ? 'Inscrevendo...' : 'Confirmar Inscrição'}
            </Button>
          </DialogContent>
        </Dialog>
      </PacienteLayout>
    </ProtectedPatientRoute>
  );
}
