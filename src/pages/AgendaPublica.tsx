import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, XCircle, CalendarDays, Clock, CheckCircle2, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import logoMetodo from '@/assets/logo-metodo-identidade.jpg';
import { format, addDays, startOfWeek, isSameDay, isAfter, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LinkInfo {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  data_expiracao: string;
}

interface Slot {
  data_inicio: string;
  data_fim: string;
  status: string;
  paciente_id?: string;
}

export default function AgendaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [agendamentos, setAgendamentos] = useState<Slot[]>([]);
  const [semanaOffset, setSemanaOffset] = useState(0);
  const [solicitado, setSolicitado] = useState(false);

  useEffect(() => {
    if (!token) { setErro('Link inválido.'); setLoading(false); return; }
    (async () => {
      try {
        // Valida o link
        const { data: linkData, error: linkError } = await supabase
          .from('links_agenda_paciente')
          .select('id, paciente_id, terapeuta_id, data_expiracao, status')
          .eq('token', token)
          .maybeSingle();

        if (linkError || !linkData) { setErro('Link não encontrado.'); setLoading(false); return; }
        if (linkData.status !== 'ativo') { setErro('Este link foi cancelado.'); setLoading(false); return; }
        if (new Date(linkData.data_expiracao!) < new Date()) { setErro('Este link expirou.'); setLoading(false); return; }

        setLinkInfo(linkData as LinkInfo);

        // Busca configuração da agenda (pública: horários de atendimento)
        const { data: cfg } = await supabase
          .from('config_agenda')
          .select('horario_inicio, horario_fim, duracao_padrao, dias_semana, intervalo_entre_sessoes')
          .eq('terapeuta_id', linkData.terapeuta_id)
          .maybeSingle();
        if (cfg) setConfig(cfg);

        // Busca agendamentos do terapeuta nas próximas semanas (apenas datas/status, sem dados de paciente)
        const inicio = new Date();
        const fim = addDays(inicio, 42); // 6 semanas
        const { data: ags } = await supabase
          .from('agendamentos')
          .select('data_inicio, data_fim, status, paciente_id')
          .eq('terapeuta_id', linkData.terapeuta_id)
          .gte('data_inicio', inicio.toISOString())
          .lte('data_inicio', fim.toISOString())
          .order('data_inicio');
        setAgendamentos((ags || []) as Slot[]);
      } catch {
        setErro('Erro ao carregar. Tente novamente.');
      }
      setLoading(false);
    })();
  }, [token]);

  // Gera slots disponíveis para a semana atual
  const getSlotsDisponiveisDaSemana = () => {
    if (!config) return [];
    const hoje = new Date();
    const inicioSemana = startOfWeek(addDays(hoje, semanaOffset * 7), { weekStartsOn: 1 });
    const dias: { data: Date; slots: { hora: string; disponivel: boolean }[] }[] = [];
    const diasSemanaMap: Record<string, number> = { seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, dom: 0 };
    const diasAtivos = Object.entries(config.dias_semana as Record<string, boolean>)
      .filter(([, ativo]) => ativo)
      .map(([dia]) => diasSemanaMap[dia]);

    for (let i = 0; i < 7; i++) {
      const dia = addDays(inicioSemana, i);
      if (!isAfter(dia, hoje) && !isSameDay(dia, hoje)) continue;
      if (!diasAtivos.includes(dia.getDay())) continue;

      const [hIni] = (config.horario_inicio || '08:00:00').split(':').map(Number);
      const [hFim] = (config.horario_fim || '18:00:00').split(':').map(Number);
      const duracao = config.duracao_padrao || 45;
      const intervalo = config.intervalo_entre_sessoes || 0;
      const slots: { hora: string; disponivel: boolean }[] = [];
      let minutoAtual = hIni * 60;

      while (minutoAtual + duracao <= hFim * 60) {
        const h = Math.floor(minutoAtual / 60).toString().padStart(2, '0');
        const m = (minutoAtual % 60).toString().padStart(2, '0');
        const horaStr = `${h}:${m}`;
        const slotInicio = new Date(dia);
        slotInicio.setHours(Number(h), Number(m), 0, 0);

        const ocupado = agendamentos.some(ag => {
          const agStart = parseISO(ag.data_inicio);
          return isSameDay(agStart, dia) &&
            agStart.getHours() === Number(h) &&
            agStart.getMinutes() === Number(m) &&
            ag.status !== 'cancelado';
        });

        slots.push({ hora: horaStr, disponivel: !ocupado });
        minutoAtual += duracao + intervalo;
      }

      if (slots.length > 0) dias.push({ data: dia, slots });
    }
    return dias;
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (erro) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
      <XCircle className="h-16 w-16 text-destructive" />
      <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
      <p className="text-muted-foreground text-center max-w-sm">{erro}</p>
    </div>
  );

  if (solicitado) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-6">
      <img src={logoMetodo} alt="Logo" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <div className="text-center max-w-sm">
        <h2 className="text-2xl font-bold text-foreground mb-2">Solicitação Enviada!</h2>
        <p className="text-muted-foreground">Seu terapeuta irá confirmar o horário em breve. Fique atento ao WhatsApp!</p>
      </div>
    </div>
  );

  const semanasDias = getSlotsDisponiveisDaSemana();
  const temSlotsLivres = semanasDias.some(d => d.slots.some(s => s.disponivel));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <img src={logoMetodo} alt="Logo" className="h-10 w-10 rounded-xl object-cover shrink-0" />
          <div>
            <h1 className="font-bold text-sm text-foreground">Agenda — Método Identidade</h1>
            <p className="text-xs text-muted-foreground">Verifique horários disponíveis para sua sessão</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Navegação de semana */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSemanaOffset(prev => Math.max(0, prev - 1))} disabled={semanaOffset === 0}>
            ← Semana anterior
          </Button>
          <span className="text-sm font-medium text-foreground">
            {semanaOffset === 0 ? 'Esta semana' : `+${semanaOffset} semana${semanaOffset > 1 ? 's' : ''}`}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSemanaOffset(prev => prev + 1)}>
            Próxima semana →
          </Button>
        </div>

        {/* Slots por dia */}
        {semanasDias.length === 0 || !temSlotsLivres ? (
          <div className="text-center py-10 border rounded-xl border-dashed text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum horário disponível nesta semana</p>
            <p className="text-sm mt-1">Navegue para a próxima semana ou entre em contato com seu terapeuta.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {semanasDias.map(({ data, slots }) => {
              const livres = slots.filter(s => s.disponivel);
              if (livres.length === 0) return null;
              return (
                <div key={data.toISOString()} className="border rounded-xl overflow-hidden">
                  <div className="bg-primary/5 border-b px-4 py-2.5 flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm capitalize">
                      {format(data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">{livres.length} horário{livres.length > 1 ? 's' : ''} livre{livres.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="p-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots.map(slot => (
                      <button
                        key={slot.hora}
                        disabled={!slot.disponivel}
                        className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-xs font-medium transition-all border ${
                          slot.disponivel
                            ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer'
                            : 'border-muted bg-muted/30 text-muted-foreground cursor-not-allowed line-through'
                        }`}
                        onClick={() => {
                          if (!slot.disponivel) return;
                          const msg = `Olá! Gostaria de solicitar um horário para o dia ${format(data, "dd/MM/yyyy", { locale: ptBR })} às ${slot.hora}. Poderia confirmar a disponibilidade?`;
                          window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
                          setSolicitado(true);
                        }}
                      >
                        <Clock className="h-2.5 w-2.5 shrink-0" />
                        {slot.hora}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Contato direto */}
        <div className="border rounded-xl p-4 bg-muted/20 text-center space-y-2">
          <Phone className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Prefere marcar diretamente? Entre em contato com seu terapeuta pelo WhatsApp.
          </p>
          <p className="text-xs text-muted-foreground">
            Ao clicar em um horário disponível, abriremos o WhatsApp com uma mensagem pronta.
          </p>
        </div>
      </div>
    </div>
  );
}
