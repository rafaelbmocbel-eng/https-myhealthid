import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, XCircle, CalendarDays, Clock, CheckCircle2, Phone, ArrowLeft } from 'lucide-react';
import { shareViaWhatsApp } from '@/utils/whatsapp';
import { Button } from '@/components/ui/button';
import logoMyHealthId from '@/assets/logo-my-health-id.jpg';
import { format, addDays, startOfWeek, isSameDay, isAfter, parseISO, addMinutes, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

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
}

interface TerapeutaInfo {
  nome: string;
  sobrenome: string;
  telefone?: string;
  especialidade?: string;
  bio?: string;
  user_id: string;
}

interface SelectedSlot {
  data: Date;
  hora: string;
  dataInicio: Date;
  dataFim: Date;
}

export default function AgendaPublica() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [terapeuta, setTerapeuta] = useState<TerapeutaInfo | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [agendamentos, setAgendamentos] = useState<Slot[]>([]);
  const [semanaOffset, setSemanaOffset] = useState(0);

  // Self-booking states
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [sucesso, setSucesso] = useState(false);
  const [erroBooking, setErroBooking] = useState<string | null>(null);

  // New patient registration state
  const [newPacData, setNewPacData] = useState({
    nome: '',
    sobrenome: '',
    email: '',
    telefone: '',
  });

  useEffect(() => {
    if (!token) { setErro('Link inválido.'); setLoading(false); return; }
    (async () => {
      try {
        const { data: linkData, error: linkError } = await supabase
          .from('links_agenda_paciente')
          .select('*')
          .eq('token', token)
          .maybeSingle();

        if (linkError || !linkData) { setErro('Link não encontrado.'); setLoading(false); return; }
        if (linkData.status !== 'ativo') { setErro('Este link foi cancelado.'); setLoading(false); return; }
        if (new Date(linkData.data_expiracao!) < new Date()) { setErro('Este link expirou.'); setLoading(false); return; }

        setLinkInfo(linkData as LinkInfo);

        // Update access tracking
        await supabase
          .from('links_agenda_paciente')
          .update({
            acessos_totais: (linkData.acessos_totais || 0) + 1,
            data_ultimo_acesso: new Date().toISOString(),
            ...(!linkData.data_primeiro_acesso ? { data_primeiro_acesso: new Date().toISOString() } : {}),
          })
          .eq('id', linkData.id);

        const [{ data: profileData }, { data: cfg }, { data: ags }] = await Promise.all([
          supabase
            .from('profiles')
            .select('nome, sobrenome, telefone, especialidade, bio, user_id')
            .eq('user_id', linkData.terapeuta_id)
            .maybeSingle(),
          supabase
            .from('config_agenda')
            .select('horario_inicio, horario_fim, duracao_padrao, dias_semana, intervalo_entre_sessoes, vagas_por_horario')
            .eq('terapeuta_id', linkData.terapeuta_id)
            .maybeSingle(),
          supabase
            .from('agendamentos')
            .select('data_inicio, data_fim, status')
            .eq('terapeuta_id', linkData.terapeuta_id)
            .gte('data_inicio', new Date().toISOString())
            .lte('data_inicio', addDays(new Date(), 42).toISOString())
            .order('data_inicio'),
        ]);

        if (profileData) setTerapeuta(profileData as TerapeutaInfo);
        if (cfg) setConfig(cfg);
        setAgendamentos((ags || []) as Slot[]);
      } catch {
        setErro('Erro ao carregar. Tente novamente.');
      }
      setLoading(false);
    })();
  }, [token]);

  const getSlotsDisponiveisDaSemana = () => {
    if (!config) return [];
    const hoje = new Date();
    const inicioSemana = startOfWeek(addDays(hoje, semanaOffset * 7), { weekStartsOn: 1 });
    const dias: { data: Date; slots: { hora: string; disponivel: boolean; dataInicio: Date; dataFim: Date }[] }[] = [];
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
      const slots: { hora: string; disponivel: boolean; dataInicio: Date; dataFim: Date }[] = [];
      let minutoAtual = hIni * 60;

      while (minutoAtual + duracao <= hFim * 60) {
        const h = Math.floor(minutoAtual / 60);
        const m = minutoAtual % 60;
        const horaStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;

        const slotInicio = new Date(dia);
        slotInicio.setHours(h, m, 0, 0);
        const slotFim = addMinutes(slotInicio, duracao);

        // Don't show past slots for today
        if (isSameDay(dia, hoje) && slotInicio < hoje) {
          minutoAtual += duracao + intervalo;
          continue;
        }

        const vagasMax = config.vagas_por_horario || 1;
        const ocupadas = agendamentos.filter(ag => {
          if (ag.status === 'cancelado') return false;
          const agStart = parseISO(ag.data_inicio).getTime();
          const agEnd = parseISO(ag.data_fim).getTime();
          return slotInicio.getTime() < agEnd && slotFim.getTime() > agStart;
        }).length;

        slots.push({ hora: horaStr, disponivel: ocupadas < vagasMax, dataInicio: slotInicio, dataFim: slotFim });
        minutoAtual += duracao + intervalo;
      }

      if (slots.length > 0) dias.push({ data: dia, slots });
    }
    return dias;
  };

  const handleConfirmarComCadastro = async () => {
    if (!selectedSlot || !linkInfo) return;

    // Se for link geral, validar campos obrigatórios
    if (!linkInfo.paciente_id && (!newPacData.nome || !newPacData.telefone)) {
      setErroBooking('Nome e WhatsApp são obrigatórios para novos pacientes.');
      return;
    }

    setConfirmando(true);
    setErroBooking(null);

    try {
      let patientId = linkInfo.paciente_id;

      // Fluxo para NOVO PACIENTE ou LINK GERAL
      if (!patientId) {
        // 1. Verificar se paciente já existe pelo telefone para este terapeuta
        const { data: existingPac } = await supabase
          .from('pacientes')
          .select('id')
          .eq('terapeuta_id', linkInfo.terapeuta_id)
          .eq('telefone', newPacData.telefone)
          .maybeSingle();

        if (existingPac) {
          patientId = existingPac.id;
        } else {
          // 2. Criar novo paciente
          const { data: newPac, error: pacError } = await supabase
            .from('pacientes')
            .insert({
              terapeuta_id: linkInfo.terapeuta_id,
              nome: newPacData.nome,
              sobrenome: newPacData.sobrenome,
              email: newPacData.email,
              telefone: newPacData.telefone,
              ativo: true,
            })
            .select()
            .single();

          if (pacError) throw pacError;
          patientId = newPac.id;
        }
      }

      // 3. Checagem de concorrência antes de inserir
      const vagasMax = config.vagas_por_horario || 1;
      const { data: agsAtuais } = await supabase
        .from('agendamentos')
        .select('data_inicio, data_fim, status')
        .eq('terapeuta_id', linkInfo.terapeuta_id)
        .neq('status', 'cancelado')
        .lt('data_inicio', selectedSlot.dataFim.toISOString())
        .gt('data_fim', selectedSlot.dataInicio.toISOString());

      const sobreposicoes = agsAtuais ? agsAtuais.length : 0;
      if (sobreposicoes >= vagasMax) {
        setErroBooking('Oops! Outro paciente acabou de reservar esse horário. Por favor, escolha outro.');
        setConfirmando(false);
        // Atualizar lista de agendamentos localmente para sumir a vaga
        const { data: agsRefresh } = await supabase
          .from('agendamentos')
          .select('data_inicio, data_fim, status')
          .eq('terapeuta_id', linkInfo.terapeuta_id)
          .gte('data_inicio', new Date().toISOString())
          .lte('data_inicio', addDays(new Date(), 42).toISOString())
          .order('data_inicio');
        if (agsRefresh) setAgendamentos(agsRefresh as Slot[]);
        return;
      }

      // 4. Criar agendamento
      const { error } = await supabase.from('agendamentos').insert({
        terapeuta_id: linkInfo.terapeuta_id,
        paciente_id: patientId,
        data_inicio: selectedSlot.dataInicio.toISOString(),
        data_fim: selectedSlot.dataFim.toISOString(),
        status: 'pendente',
        tipo_atendimento: linkInfo.paciente_id ? 'retorno' : 'primeira_consulta',
        titulo: linkInfo.paciente_id ? 'Auto-agendamento' : `Novo Paciente: ${newPacData.nome}`,
      });

      if (error) {
        console.error('Booking error:', error);
        setErroBooking('Não foi possível confirmar o horário. Tente outro ou entre em contato.');
        setConfirmando(false);
        return;
      }

      // Atualizar estado local
      setAgendamentos(prev => [...prev, {
        data_inicio: selectedSlot.dataInicio.toISOString(),
        data_fim: selectedSlot.dataFim.toISOString(),
        status: 'pendente',
      }]);

      setSucesso(true);
    } catch (e: any) {
      console.error('Error in booking flow:', e);
      setErroBooking('Erro de conexão ao processar agendamento.');
    }
    setConfirmando(false);
  };

  // Loading
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  // Error
  if (erro) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
      <XCircle className="h-16 w-16 text-destructive" />
      <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
      <p className="text-muted-foreground text-center max-w-sm">{erro}</p>
    </div>
  );

  // Success screen (Premium WOW)
  if (sucesso && selectedSlot) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm clinical-card border-2 border-primary/20 bg-gradient-to-b from-card to-primary/5 p-8 text-center space-y-6 shadow-2xl animate-scale-in">
        <div className="relative mx-auto">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mx-auto animate-bounce-subtle">
            <CheckCircle2 className="h-14 w-14 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 shadow-md">
            <img src={logoMyHealthId} alt="Logo" className="h-8 w-8 rounded-lg object-cover" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-foreground tracking-tight">Tudo Certo!</h2>
          <p className="text-sm text-muted-foreground">Sua reserva foi enviada com sucesso para análise.</p>
        </div>

        <div className="bg-background/80 backdrop-blur border rounded-2xl p-5 shadow-inner">
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Horário Selecionado</p>
          <p className="text-sm font-bold text-foreground capitalize">
            {format(selectedSlot.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
          <p className="text-3xl font-black text-primary mt-1">{selectedSlot.hora}</p>
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">Profissional:</p>
            <p className="text-sm font-bold text-foreground">{terapeuta?.nome} {terapeuta?.sobrenome}</p>
          </div>
        </div>

        <div className="space-y-3">
          {terapeuta?.telefone && (
            <Button
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-lg"
              onClick={() => {
                const msg = `Olá, ${terapeuta.nome}! Acabei de reservar um horário para ${format(selectedSlot.data, "dd/MM/yyyy")} às ${selectedSlot.hora} pela agenda online.`;
                shareViaWhatsApp(terapeuta.telefone || '', msg);
              }}
            >
              <Phone className="h-4 w-4" />
              Avisar via WhatsApp
            </Button>
          )}
          <Button variant="ghost" className="w-full text-[11px] text-muted-foreground hover:text-primary" onClick={() => window.location.reload()}>
            Fazer outro agendamento
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground italic">
          * Fique atento ao seu celular, você receberá uma confirmação em breve.
        </p>
      </div>
    </div>
  );

  // Confirmation screen
  if (selectedSlot) return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedSlot(null); setErroBooking(null); }}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="font-bold text-sm text-foreground">Confirmar Horário</h1>
            <p className="text-xs text-muted-foreground">Revise e confirme seu agendamento</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-10 space-y-6">
        <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
          <div className="bg-primary/5 border-b px-5 py-4 text-center">
            <CalendarDays className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-lg font-bold text-foreground capitalize">
              {format(selectedSlot.data, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="p-5 text-center border-b">
            <p className="text-3xl font-black text-primary">{selectedSlot.hora}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Duração: {config?.duracao_padrao || 45} minutos
            </p>
          </div>

          {!linkInfo.paciente_id && (
            <div className="p-5 space-y-4 bg-muted/10">
              <div className="space-y-2">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Seus Dados</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground ml-1">Nome</label>
                    <input
                      type="text"
                      placeholder="Nome"
                      className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      value={newPacData.nome}
                      onChange={e => setNewPacData(d => ({ ...d, nome: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground ml-1">Sobrenome</label>
                    <input
                      type="text"
                      placeholder="Sobrenome"
                      className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                      value={newPacData.sobrenome}
                      onChange={e => setNewPacData(d => ({ ...d, sobrenome: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground ml-1">WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={newPacData.telefone}
                    onChange={e => setNewPacData(d => ({ ...d, telefone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground ml-1">E-mail (opcional)</label>
                  <input
                    type="email"
                    placeholder="email@exemplo.com"
                    className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={newPacData.email}
                    onChange={e => setNewPacData(d => ({ ...d, email: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-5 text-center space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Profissional: <strong className="text-foreground">{terapeuta ? `${terapeuta.nome} ${terapeuta.sobrenome}` : 'Terapeuta'}</strong></p>
              {terapeuta?.especialidade && <p className="text-xs">{terapeuta.especialidade}</p>}
            </div>
          </div>
        </div>

        {erroBooking && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-sm text-destructive text-center">
            {erroBooking}
          </div>
        )}

        <Button
          className="w-full h-12 text-base font-bold bg-gradient-to-r from-primary to-primary/80"
          onClick={handleConfirmarComCadastro}
          disabled={confirmando}
        >
          {confirmando ? (
            <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Reservando...</>
          ) : (
            <><CheckCircle2 className="h-5 w-5 mr-2" /> Confirmar Agendamento</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center">
          Ao confirmar, o horário ficará reservado como <strong>pendente</strong> até a confirmação do profissional.
        </p>
      </div>
    </div>
  );

  // Main slot grid
  const semanasDias = getSlotsDisponiveisDaSemana();
  const temSlotsLivres = semanasDias.some(d => d.slots.some(s => s.disponivel));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-4 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={logoMyHealthId} alt="Logo" className="h-10 w-10 rounded-xl object-cover shrink-0" />
            <div>
              <h1 className="font-bold text-sm text-foreground">
                Agenda Online{terapeuta ? ` — ${terapeuta.nome} ${terapeuta.sobrenome}` : ''}
              </h1>
              <p className="text-xs text-muted-foreground">
                {terapeuta?.especialidade || 'Fisioterapeuta'} · Reserve seu horário
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1 animate-pulse">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Horários Disponíveis
          </Badge>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Terapeuta Profile Card */}
        {terapeuta && (
          <div className="clinical-card !p-0 overflow-hidden border-2 border-primary/10 shadow-lg animate-slide-in">
            <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-5 flex flex-col sm:flex-row items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-black ring-4 ring-white shadow-md shrink-0">
                {terapeuta.nome[0]}{terapeuta.sobrenome[0]}
              </div>
              <div className="text-center sm:text-left flex-1">
                <h2 className="text-xl font-bold text-foreground">{terapeuta.nome} {terapeuta.sobrenome}</h2>
                <p className="text-primary font-semibold text-sm">{terapeuta.especialidade || 'Especialista em Saúde'}</p>
                {terapeuta.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-2 italic">"{terapeuta.bio}"</p>}
              </div>
            </div>
            <div className="px-5 py-3 bg-card border-t flex items-center justify-around gap-4 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Duração</p>
                <p className="text-sm font-bold text-foreground">{config?.duracao_padrao || 45} min</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Atendimento</p>
                <p className="text-sm font-bold text-foreground">Presencial</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Localização</p>
                <p className="text-sm font-bold text-foreground">Clínica</p>
              </div>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
          <p className="text-xs text-primary font-medium flex items-center justify-center gap-2">
            <CalendarDays className="h-4 w-4" /> Toque em um horário em azul para reservar sua consulta
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={() => setSemanaOffset(prev => Math.max(0, prev - 1))} disabled={semanaOffset === 0}>
            ← Anterior
          </Button>
          <span className="text-sm font-medium text-foreground">
            {semanaOffset === 0 ? 'Esta semana' : `+${semanaOffset} semana${semanaOffset > 1 ? 's' : ''}`}
          </span>
          <Button variant="outline" size="sm" onClick={() => setSemanaOffset(prev => Math.min(5, prev + 1))}>
            Próxima →
          </Button>
        </div>

        {/* Slots */}
        {semanasDias.length === 0 || !temSlotsLivres ? (
          <div className="text-center py-10 border rounded-xl border-dashed text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhum horário disponível nesta semana</p>
            <p className="text-sm mt-1">Navegue para a próxima semana.</p>
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
                    <span className="text-xs text-muted-foreground ml-auto">
                      {livres.length} horário{livres.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="p-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots.map(slot => (
                      <button
                        key={slot.hora}
                        disabled={!slot.disponivel}
                        className={`flex items-center justify-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium transition-all border ${slot.disponivel
                          ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary hover:text-primary-foreground cursor-pointer active:scale-95'
                          : 'border-muted bg-muted/30 text-muted-foreground cursor-not-allowed line-through opacity-50'
                          }`}
                        onClick={() => {
                          if (!slot.disponivel) return;
                          setSelectedSlot({
                            data,
                            hora: slot.hora,
                            dataInicio: slot.dataInicio,
                            dataFim: slot.dataFim,
                          });
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

        {/* WhatsApp fallback */}
        {terapeuta?.telefone && (
          <div className="border rounded-xl p-4 bg-muted/20 text-center space-y-2">
            <Phone className="h-5 w-5 mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Prefere outro horário? Entre em contato pelo WhatsApp.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                const msg = `Olá${terapeuta ? `, ${terapeuta.nome}` : ''}! Gostaria de agendar um horário. Poderia verificar a disponibilidade?`;
                shareViaWhatsApp(terapeuta?.telefone || '', msg);
              }}
            >
              <Phone className="h-3 w-3 mr-1" /> Contatar via WhatsApp
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
