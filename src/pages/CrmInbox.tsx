import { useState, useEffect, useRef, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Search, Send, MessageCircle, Phone, User, Loader2, Zap, StickyNote,
  Trash2, Plus, Sparkles, Bot, Paperclip, Image as ImageIcon, FileText,
  X, Pencil, SmilePlus, ArrowLeft, MoreVertical, Copy, CheckCheck,
  ChevronDown, AlertCircle, Clock, UserCheck,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import WhatsappAutomacoes from '@/pages/WhatsappAutomacoes';
import { useWhatsappConversas, useWhatsappMensagens, type WAConversa } from '@/hooks/useWhatsappInbox';
import { useWhatsappTemplates, useWhatsappNotas, useGlobalMessageSearch, useAtribuirConversa, getSLAStatus } from '@/hooks/useWhatsappExtras';
import { buildTemplateContext, aplicarVariaveis, TEMPLATE_VARIAVEIS } from '@/utils/whatsappTemplateVars';
import { formatPhoneNumber } from '@/utils/whatsapp';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ─── Types ───────────────────────────────────────────────────────────────────
type FilaTab = 'todas' | 'minhas' | 'nao_atribuidas' | 'atrasadas';
type ColunaWS = 'pendentes' | 'andamento' | 'conversas' | 'fechadas';
interface ReplyTo { id: string; content: string; isMine: boolean }

// ─── Constants ───────────────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: 'novo',       label: 'Novo',        color: '#38bdf8', cls: 'bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800' },
  { key: 'qualificado',label: 'Qualificado', color: '#fb923c', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800' },
  { key: 'agendado',   label: 'Agendado',    color: '#a78bfa', cls: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800' },
  { key: 'fechado',    label: 'Fechado',     color: '#34d399', cls: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800' },
  { key: 'perdido',    label: 'Perdido',     color: '#f87171', cls: 'bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800' },
];

const AVATAR_PALETTE = ['#EF5350','#EC407A','#AB47BC','#7E57C2','#42A5F5','#26C6DA','#26A69A','#66BB6A','#FFA726','#FF7043'];

const QUICK_EMOJIS = ['😊','👋','❤️','✅','🙏','😂','👍','🤝','💪','🌟','😍','🎉','📅','⏰','💙','✨','🏃','💊','🩺','📋'];

const COLUNAS: { key: ColunaWS; label: string }[] = [
  { key: 'pendentes', label: 'Pendentes' },
  { key: 'andamento', label: 'Andamento' },
  { key: 'conversas', label: 'Conversas' },
  { key: 'fechadas',  label: 'Fechadas'  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getAvatarColor(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function getStage(key?: string | null) {
  return PIPELINE_STAGES.find(s => s.key === (key || 'novo')) ?? PIPELINE_STAGES[0];
}

function colunaDe(c: WAConversa): ColunaWS {
  const st = c.pipeline_stage || 'novo';
  if (st === 'fechado' || st === 'perdido') return 'fechadas';
  if ((c.nao_lidas || 0) > 0) return 'pendentes';
  if (st === 'qualificado' || st === 'agendado') return 'andamento';
  return 'conversas';
}

function fmtTime(dt: string) {
  const d = new Date(dt);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Ontem';
  return format(d, 'dd/MM/yy');
}

function fmtDateSep(dt: string) {
  const d = new Date(dt);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

// ─── WaAvatar ────────────────────────────────────────────────────────────────
function WaAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const color = getAvatarColor(name);
  const initials = name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
  return (
    <div
      className="rounded-full shrink-0 flex items-center justify-center text-white font-semibold select-none"
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function CrmInbox({ embedded = false }: { embedded?: boolean } = {}) {
  const [busca, setBusca] = useState('');
  const [filaTab, setFilaTab] = useState<FilaTab>('todas');
  const [coluna, setColuna] = useState<ColunaWS>('pendentes');
  const [userId, setUserId] = useState<string | null>(null);
  const [selecionada, setSelecionada] = useState<WAConversa | null>(null);
  const { data: conversas = [], isLoading } = useWhatsappConversas();
  const { data: idsGlobais = [] } = useGlobalMessageSearch(busca);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const baseFiltradas = useMemo(() => conversas.filter(c => {
    const q = busca.toLowerCase().trim();
    if (q) {
      const matchMeta = (c.nome_contato || '').toLowerCase().includes(q) || c.telefone.includes(q);
      const matchMsg  = q.length >= 3 && idsGlobais.includes(c.id);
      if (!matchMeta && !matchMsg) return false;
    }
    if (filaTab === 'minhas') return c.atribuido_a === userId;
    if (filaTab === 'nao_atribuidas') return !c.atribuido_a;
    if (filaTab === 'atrasadas') { const s = getSLAStatus(c); return s.status === 'atrasado' || s.status === 'em_breve'; }
    return true;
  }), [conversas, busca, idsGlobais, filaTab, userId]);

  const counts = useMemo(() => ({
    col: {
      pendentes: baseFiltradas.filter(c => colunaDe(c) === 'pendentes').length,
      andamento: baseFiltradas.filter(c => colunaDe(c) === 'andamento').length,
      conversas: baseFiltradas.filter(c => colunaDe(c) === 'conversas').length,
      fechadas:  baseFiltradas.filter(c => colunaDe(c) === 'fechadas').length,
    } as Record<ColunaWS, number>,
    fila: {
      todas:          conversas.length,
      minhas:         conversas.filter(c => c.atribuido_a === userId).length,
      nao_atribuidas: conversas.filter(c => !c.atribuido_a).length,
      atrasadas:      conversas.filter(c => { const s = getSLAStatus(c); return s.status === 'atrasado' || s.status === 'em_breve'; }).length,
    } as Record<FilaTab, number>,
  }), [baseFiltradas, conversas, userId]);

  const filtradas = useMemo(() => baseFiltradas.filter(c => colunaDe(c) === coluna), [baseFiltradas, coluna]);

  const FILA_TABS: [FilaTab, string][] = [
    ['todas', 'Todas'], ['minhas', 'Minhas'], ['nao_atribuidas', 'Sem dono'], ['atrasadas', '⏰ SLA'],
  ];

  const panelLeft = cn(
    'flex flex-col border-r border-border/30 bg-background w-full md:w-[390px] shrink-0',
    selecionada ? 'hidden md:flex' : 'flex',
  );

  return (
    <Shell embedded={embedded}>
      <div className={cn('flex overflow-hidden', embedded ? 'h-[calc(100dvh-160px)]' : 'h-[calc(100dvh-64px)]')}>

        {/* ── LEFT PANEL ── */}
        <div className={panelLeft}>

          {/* WA-style top bar */}
          <div className="h-14 px-4 flex items-center gap-3 bg-[#008069] dark:bg-[#202c33] shrink-0">
            <MessageCircle className="h-5 w-5 text-white/90" />
            <span className="text-white font-semibold flex-1 text-[15px]">WhatsApp</span>
            <BotConfigPanelBtn />
          </div>

          {/* Search */}
          <div className="px-3 py-2 bg-[#f0f2f5] dark:bg-[#111b21] shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar ou iniciar nova conversa"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9 pr-8 h-9 rounded-full bg-white dark:bg-[#2a3942] border-0 shadow-none text-sm focus-visible:ring-1"
              />
              {busca && (
                <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex gap-1.5 px-3 py-2 bg-[#f0f2f5] dark:bg-[#111b21] overflow-x-auto scrollbar-none shrink-0">
            {FILA_TABS.map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFilaTab(k)}
                className={cn(
                  'shrink-0 flex items-center gap-1 text-[11px] px-3 py-1 rounded-full border transition-all font-medium',
                  filaTab === k
                    ? 'bg-[#e7f8ef] dark:bg-[#005c4b]/60 border-[#25D366]/60 text-[#008069] dark:text-[#25D366]'
                    : 'bg-white dark:bg-[#2a3942] border-border/40 text-muted-foreground',
                )}
              >
                {label}
                {counts.fila[k] > 0 && <span className="opacity-60">{counts.fila[k]}</span>}
              </button>
            ))}
          </div>

          {/* Column tabs */}
          <div className="flex border-b border-border/30 bg-background shrink-0">
            {COLUNAS.map(col => {
              const active = coluna === col.key;
              const n = counts.col[col.key];
              return (
                <button
                  key={col.key}
                  onClick={() => setColuna(col.key)}
                  className={cn(
                    'flex-1 py-2.5 text-[11px] font-medium flex items-center justify-center gap-1 transition-colors border-b-2',
                    active
                      ? 'border-[#008069] dark:border-[#25D366] text-[#008069] dark:text-[#25D366]'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {n > 0 && (
                    <span className={cn(
                      'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold',
                      active ? 'bg-[#25D366] text-white' : 'bg-muted text-muted-foreground',
                    )}>{n}</span>
                  )}
                  {col.label}
                </button>
              );
            })}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
                <MessageCircle className="h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">Nenhuma conversa em <strong>{COLUNAS.find(c => c.key === coluna)?.label}</strong></p>
              </div>
            ) : filtradas.map((c, i) => (
              <ConversaItem
                key={c.id}
                conversa={c}
                ativa={selecionada?.id === c.id}
                userId={userId}
                last={i === filtradas.length - 1}
                onClick={() => setSelecionada(c)}
              />
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={cn('flex-1 flex flex-col min-w-0', !selecionada && 'hidden md:flex')}>
          {selecionada ? (
            <ChatPanel
              key={selecionada.id}
              conversa={selecionada}
              userId={userId}
              onBack={() => setSelecionada(null)}
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-5 bg-[#f0f2f5] dark:bg-[#222e35]">
              <div className="p-8 rounded-full bg-white/40 dark:bg-white/5">
                <MessageCircle className="h-16 w-16 text-[#008069] dark:text-[#25D366] opacity-50" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-xl font-semibold text-foreground/80">WhatsApp Clínico</h3>
                <p className="text-sm text-muted-foreground max-w-xs">Selecione uma conversa para ver as mensagens</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </Shell>
  );
}

// ─── ConversaItem ─────────────────────────────────────────────────────────────
function ConversaItem({ conversa: c, ativa, userId, last, onClick }: {
  conversa: WAConversa; ativa: boolean; userId: string | null; last: boolean; onClick: () => void;
}) {
  const sla   = getSLAStatus(c);
  const stage = getStage(c.pipeline_stage);
  const name  = c.nome_contato || formatPhoneNumber(c.telefone);
  const time  = c.ultima_mensagem_em ? fmtTime(c.ultima_mensagem_em) : '';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
        ativa ? 'bg-[#f0f2f5] dark:bg-[#2a3942]' : 'hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942]/50',
        !last && 'border-b border-border/20',
      )}
    >
      <WaAvatar name={name} size={50} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-[14px] font-semibold text-foreground truncate">{name}</span>
          <span className={cn('text-[11px] shrink-0 tabular-nums', c.nao_lidas > 0 ? 'text-[#25D366] font-semibold' : 'text-muted-foreground')}>
            {time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] text-muted-foreground truncate flex items-center gap-1">
            {c.ultima_direcao === 'saida' && <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#53bdeb]" />}
            {c.ultima_mensagem || '—'}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            {sla.status === 'atrasado' && <span className="h-2 w-2 rounded-full bg-destructive" />}
            {c.nao_lidas > 0 && (
              <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#25D366] text-white text-[11px] font-bold">
                {c.nao_lidas > 99 ? '99+' : c.nao_lidas}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
            <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: stage.color }} />
            {stage.label}
          </span>
          {c.intencao_atual && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 truncate max-w-[90px]">
              {c.intencao_atual}
            </span>
          )}
          {c.atribuido_a === userId && (
            <span className="text-[10px] text-[#008069] dark:text-[#25D366] font-semibold">• minha</span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────
function ChatPanel({ conversa, userId, onBack }: { conversa: WAConversa; userId: string | null; onBack: () => void }) {
  const [texto, setTexto] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [transcribingId, setTranscribingId] = useState<string | null>(null);
  const [buscaMsg, setBuscaMsg] = useState('');
  const [showBusca, setShowBusca] = useState(false);
  const [showBotSheet, setShowBotSheet] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef  = useRef<HTMLInputElement>(null);
  const endRef       = useRef<HTMLDivElement>(null);
  const taRef        = useRef<HTMLTextAreaElement>(null);
  const { data: mensagens = [], enviar, marcarLida } = useWhatsappMensagens(conversa.id);
  const { data: templates = [], incrementarUso } = useWhatsappTemplates();

  const sugestoes = useMemo(() => {
    const m = texto.match(/^\/(\S*)$/);
    if (!m) return [];
    const q = m[1].toLowerCase();
    return templates.filter(t => t.atalho.slice(1).toLowerCase().startsWith(q)).slice(0, 6);
  }, [texto, templates]);

  const mensagensFiltradas = useMemo(() => {
    const q = buscaMsg.toLowerCase().trim();
    if (!q) return mensagens;
    return mensagens.filter(m => (m.conteudo || '').toLowerCase().includes(q) || (m.transcricao || '').toLowerCase().includes(q));
  }, [mensagens, buscaMsg]);

  const grupos = useMemo(() => {
    const gs: { date: Date; msgs: typeof mensagens }[] = [];
    for (const msg of mensagensFiltradas) {
      const d = new Date(msg.created_at);
      const last = gs[gs.length - 1];
      if (!last || !isSameDay(last.date, d)) gs.push({ date: d, msgs: [msg] });
      else last.msgs.push(msg);
    }
    return gs;
  }, [mensagensFiltradas]);

  useEffect(() => { marcarLida.mutate(); }, [conversa.id]);
  useEffect(() => { if (!buscaMsg) endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [mensagens.length, buscaMsg]);

  async function handleSend(content?: string) {
    const t = (content ?? texto).trim();
    if (!t) return;
    setTexto('');
    setReplyTo(null);
    if (taRef.current) { taRef.current.style.height = 'auto'; }
    try { await enviar.mutateAsync({ conversa, texto: t }); } catch { setTexto(t); }
  }

  async function handleMediaUpload(file: File, mediaType: 'image' | 'document') {
    const max = mediaType === 'image' ? 5 * 1024 * 1024 : 16 * 1024 * 1024;
    if (file.size > max) { toast.error(`Arquivo maior que ${max / 1024 / 1024}MB`); return; }
    setUploadingMedia(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');
      const ext  = file.name.split('.').pop() || (mediaType === 'image' ? 'jpg' : 'pdf');
      const path = `${user.id}/${conversa.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('whatsapp-media').upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('whatsapp-media').getPublicUrl(path);
      const caption = texto.trim() || undefined;
      setTexto('');
      await enviar.mutateAsync({ conversa, texto: caption, mediaUrl: publicUrl, mediaType, fileName: file.name });
      toast.success(mediaType === 'image' ? 'Imagem enviada' : 'Documento enviado');
    } catch (e: any) {
      toast.error('Erro ao enviar: ' + e.message);
    } finally {
      setUploadingMedia(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (docInputRef.current)  docInputRef.current.value  = '';
    }
  }

  async function aplicarTemplate(tpl: typeof templates[number]) {
    try {
      const ctx = await buildTemplateContext(conversa);
      setTexto(aplicarVariaveis(tpl.conteudo, ctx));
      incrementarUso(tpl.id);
    } catch {
      const nome = (conversa.nome_contato || '').split(' ')[0] || 'olá';
      setTexto(tpl.conteudo.replace(/\{nome\}/g, nome));
      incrementarUso(tpl.id);
    }
    taRef.current?.focus();
  }

  async function transcrever(msgId: string) {
    setTranscribingId(msgId);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-transcribe', { body: { mensagem_id: msgId } });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || 'falha');
      toast.success('Áudio transcrito com IA');
    } catch (e: any) {
      toast.error('Erro: ' + e.message);
    } finally { setTranscribingId(null); }
  }

  const name  = conversa.nome_contato || formatPhoneNumber(conversa.telefone);
  const botOn = (conversa as any).bot_ativo;
  const turnos = (conversa as any).turnos_bot ?? 0;
  const atencao = (conversa as any).requer_atencao;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="shrink-0 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-border/20">
        <div className="h-14 px-3 flex items-center gap-2.5">
          <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 text-foreground" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <WaAvatar name={name} size={40} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold text-foreground truncate leading-tight">{name}</span>
              <PipelineChip conversa={conversa} />
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{formatPhoneNumber(conversa.telefone)}</span>
              {atencao && (
                <span className="text-destructive flex items-center gap-0.5 font-medium">
                  <AlertCircle className="h-3 w-3" /> Atenção
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setShowBusca(v => !v)}>
              <Search className="h-4 w-4" />
            </Button>
            <BotToggle conversa={conversa} />
            <NotasButton conversaId={conversa.id} />
            {conversa.paciente_id && (
              <Link to={`/pacientes/${conversa.paciente_id}`}>
                <Button variant="ghost" size="icon" className="h-9 w-9" title="Ver perfil do paciente">
                  <User className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <AtribuirButton conversa={conversa} userId={userId} />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-1">
                <button onClick={() => setShowBotSheet(true)} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" /> Bot &amp; Automações
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* In-conversation search */}
        {showBusca && (
          <div className="px-3 pb-2 flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              autoFocus
              placeholder="Buscar nesta conversa..."
              value={buscaMsg}
              onChange={e => setBuscaMsg(e.target.value)}
              className="h-8 text-sm bg-white dark:bg-[#2a3942] border-0 shadow-none"
            />
            {buscaMsg && <span className="text-[11px] text-muted-foreground whitespace-nowrap">{mensagensFiltradas.length} resultado{mensagensFiltradas.length !== 1 ? 's' : ''}</span>}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setShowBusca(false); setBuscaMsg(''); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Bot status strip */}
      {botOn && (
        <div className="shrink-0 px-4 py-1.5 flex items-center gap-2 bg-[#e7f8ef] dark:bg-[#005c4b]/20 border-b border-[#25D366]/20">
          <Bot className="h-3.5 w-3.5 text-[#25D366] shrink-0" />
          <span className="text-[11px] text-[#008069] dark:text-[#25D366]">
            Bot IA ativo · {turnos} turno{turnos !== 1 ? 's' : ''}
          </span>
          {turnos >= 4 && <span className="text-[10px] text-amber-600 dark:text-amber-400">· próximo do limite</span>}
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ backgroundColor: 'var(--wa-bg)' }}
      >
        <style>{`:root{--wa-bg:#efeae2} .dark{--wa-bg:#0b141a}`}</style>

        {grupos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 py-16 text-center">
            <MessageCircle className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">{buscaMsg ? 'Nenhuma mensagem encontrada' : 'Sem mensagens ainda'}</p>
          </div>
        )}

        {grupos.map(g => (
          <div key={g.date.toISOString()}>
            <div className="flex justify-center my-3">
              <span className="text-[11px] px-3 py-1 rounded-full bg-white/80 dark:bg-[#182229]/90 text-muted-foreground shadow-sm">
                {fmtDateSep(g.date.toISOString())}
              </span>
            </div>
            <div className="space-y-[3px]">
              {g.msgs.map(m => (
                <MsgBubble
                  key={m.id}
                  msg={m}
                  transcribingId={transcribingId}
                  onTranscrever={transcrever}
                  onReply={() => setReplyTo({
                    id: m.id,
                    content: m.conteudo || m.transcricao || '[mídia]',
                    isMine: m.direcao === 'saida',
                  })}
                />
              ))}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Template suggestions */}
      {sugestoes.length > 0 && (
        <div className="shrink-0 border-t border-border/40 bg-card/95 backdrop-blur-sm p-2 max-h-44 overflow-y-auto">
          {sugestoes.map(t => (
            <button key={t.id} onClick={() => aplicarTemplate(t)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-muted flex items-start gap-2 transition-colors">
              <Badge variant="outline" className="text-[10px] font-mono shrink-0">{t.atalho}</Badge>
              <div className="min-w-0">
                <div className="text-xs font-medium">{t.titulo}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t.conteudo}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Reply preview */}
      {replyTo && (
        <div className="shrink-0 px-4 py-2 bg-muted/50 border-t border-border/30 flex items-center gap-3">
          <div className="w-1 h-10 rounded-full bg-[#25D366] shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-[#008069] dark:text-[#25D366]">
              {replyTo.isMine ? 'Você' : (conversa.nome_contato?.split(' ')[0] || 'Contato')}
            </div>
            <div className="text-xs text-muted-foreground truncate">{replyTo.content}</div>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f, 'image'); }} />
      <input ref={docInputRef} type="file" accept="application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleMediaUpload(f, 'document'); }} />

      <div className="shrink-0 px-3 py-3 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-border/10 flex items-end gap-2">
        <EmojiBtn onPick={e => { setTexto(t => t + e); taRef.current?.focus(); }} />
        <AttachBtn uploading={uploadingMedia} onImage={() => fileInputRef.current?.click()} onDoc={() => docInputRef.current?.click()} />
        <div className="flex-1 min-w-0">
          <textarea
            ref={taRef}
            rows={1}
            placeholder={replyTo ? 'Responder…' : 'Mensagem… use / para templates'}
            value={texto}
            onChange={e => {
              setTexto(e.target.value);
              e.currentTarget.style.height = 'auto';
              e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 130) + 'px';
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={enviar.isPending}
            className="w-full resize-none rounded-xl bg-white dark:bg-[#2a3942] border-0 shadow-none px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 min-h-[40px] max-h-[130px] overflow-y-auto leading-relaxed placeholder:text-muted-foreground"
          />
        </div>
        <TemplatesPopover templates={templates} onPick={aplicarTemplate} />
        <Button
          onClick={() => handleSend()}
          disabled={enviar.isPending}
          className="h-10 w-10 rounded-full p-0 shrink-0 bg-[#008069] hover:bg-[#006a57] dark:bg-[#00a884] dark:hover:bg-[#008069] border-0"
        >
          {enviar.isPending ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Send className="h-5 w-5 text-white" />}
        </Button>
      </div>

      {/* Bot config sheet */}
      <Sheet open={showBotSheet} onOpenChange={setShowBotSheet}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b sticky top-0 bg-background z-10">
            <SheetTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Bot &amp; Automações</SheetTitle>
          </SheetHeader>
          <WhatsappAutomacoes embedded />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────
function MsgBubble({ msg, transcribingId, onTranscrever, onReply }: {
  msg: any; transcribingId: string | null; onTranscrever: (id: string) => void; onReply: () => void;
}) {
  const isSent = msg.direcao === 'saida';
  const isBot  = msg.metadata?.bot;

  function copyMsg() {
    navigator.clipboard.writeText(msg.conteudo || msg.transcricao || '');
    toast.success('Copiado');
  }

  return (
    <div className={cn('flex group items-end gap-1.5', isSent ? 'justify-end' : 'justify-start')}>

      {/* Action buttons (appear on hover, opposite side of bubble) */}
      <div className={cn(
        'flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-end mb-1',
        isSent ? 'order-first' : 'order-last',
      )}>
        <button onClick={onReply} title="Responder"
          className="h-7 w-7 rounded-full bg-white/80 dark:bg-[#202c33]/80 border border-border/30 flex items-center justify-center hover:bg-muted shadow-sm">
          <svg className="h-3.5 w-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
        </button>
        {(msg.conteudo || msg.transcricao) && (
          <button onClick={copyMsg} title="Copiar"
            className="h-7 w-7 rounded-full bg-white/80 dark:bg-[#202c33]/80 border border-border/30 flex items-center justify-center hover:bg-muted shadow-sm">
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Bubble */}
      <div className={cn(
        'max-w-[72%] px-3 py-2 shadow-sm text-sm relative',
        isSent
          ? 'bg-[#dcf8c6] dark:bg-[#005c4b] text-gray-900 dark:text-gray-100 rounded-[18px] rounded-tr-[5px]'
          : 'bg-white dark:bg-[#202c33] text-gray-900 dark:text-gray-100 rounded-[18px] rounded-tl-[5px]',
      )}>

        {/* Bot badge */}
        {isBot && (
          <div className="flex items-center gap-1 mb-1.5">
            <Bot className="h-3 w-3 text-[#008069] dark:text-[#25D366]" />
            <span className="text-[10px] font-medium text-[#008069] dark:text-[#25D366]">Bot IA</span>
          </div>
        )}

        {/* Audio */}
        {msg.tipo === 'audio' && msg.midia_url && (
          <div className="space-y-1.5 min-w-[180px]">
            <audio controls src={msg.midia_url} className="h-8 w-full max-w-[260px]" />
            {msg.transcricao ? (
              <div className={cn('text-xs italic border-l-2 pl-2', isSent ? 'border-[#008069]/40 text-gray-700 dark:text-gray-300' : 'border-muted-foreground/30 text-muted-foreground')}>
                "{msg.transcricao}"
              </div>
            ) : !isSent && (
              <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 px-2 text-muted-foreground hover:text-foreground"
                disabled={transcribingId === msg.id} onClick={() => onTranscrever(msg.id)}>
                {transcribingId === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                Transcrever com IA
              </Button>
            )}
          </div>
        )}

        {/* Image */}
        {msg.tipo === 'imagem' && msg.midia_url && (
          <a href={msg.midia_url} target="_blank" rel="noreferrer" className="block mb-1.5">
            <img src={msg.midia_url} alt="" className="rounded-xl max-w-full max-h-52 object-cover" />
          </a>
        )}

        {/* Document */}
        {msg.tipo === 'documento' && msg.midia_url && (
          <a href={msg.midia_url} target="_blank" rel="noreferrer"
            className={cn('flex items-center gap-2.5 mb-1.5 p-2 rounded-xl', isSent ? 'bg-black/10 dark:bg-white/10' : 'bg-muted/40')}>
            <div className="h-9 w-9 rounded-lg bg-[#008069] flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold">Documento</div>
              <div className="text-[10px] opacity-70">PDF · Toque para abrir</div>
            </div>
          </a>
        )}

        {/* Text */}
        {msg.conteudo && (
          <div className="whitespace-pre-wrap break-words leading-relaxed">{msg.conteudo}</div>
        )}

        {/* Time + status */}
        <div className={cn('flex items-center justify-end gap-1 mt-0.5', isSent ? 'text-[#008069]/60 dark:text-[#25D366]/50' : 'text-muted-foreground/60')}>
          <span className="text-[10px] tabular-nums">
            {new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isSent && (
            msg.status === 'enviando'
              ? <Clock className="h-3 w-3" />
              : msg.status === 'erro'
                ? <span className="text-destructive text-xs">!</span>
                : msg.status === 'lida'
                  ? <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />
                  : <CheckCheck className="h-3.5 w-3.5 opacity-50" />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Pipeline Stage Chip ──────────────────────────────────────────────────────
function PipelineChip({ conversa }: { conversa: WAConversa }) {
  const [open, setOpen] = useState(false);
  const st = getStage(conversa.pipeline_stage);

  async function mudar(key: string) {
    setOpen(false);
    const { error } = await supabase.from('whatsapp_conversas').update({ pipeline_stage: key }).eq('id', conversa.id);
    if (error) toast.error('Erro: ' + error.message);
    else toast.success(`Estágio → ${PIPELINE_STAGES.find(s => s.key === key)?.label}`);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold transition-colors', st.cls)}>
          <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
          {st.label}
          <ChevronDown className="h-2.5 w-2.5 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="bottom" className="w-44 p-1">
        {PIPELINE_STAGES.map(s => (
          <button key={s.key} onClick={() => mudar(s.key)}
            className={cn('w-full text-left px-3 py-1.5 rounded-md text-xs flex items-center gap-2 hover:bg-muted transition-colors',
              s.key === (conversa.pipeline_stage || 'novo') && 'bg-muted font-semibold')}>
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

// ─── Emoji Button ─────────────────────────────────────────────────────────────
function EmojiBtn({ onPick }: { onPick: (e: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground shrink-0">
          <SmilePlus className="h-5 w-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-60 p-2">
        <div className="grid grid-cols-5 gap-0.5">
          {QUICK_EMOJIS.map(e => (
            <button key={e} onClick={() => onPick(e)}
              className="text-[22px] h-10 w-full flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
              {e}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Attach Button ────────────────────────────────────────────────────────────
function AttachBtn({ uploading, onImage, onDoc }: { uploading: boolean; onImage(): void; onDoc(): void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground shrink-0" disabled={uploading}>
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Paperclip className="h-5 w-5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" side="top" className="w-40 p-1">
        <button onClick={onImage} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-violet-500" /> Imagem
        </button>
        <button onClick={onDoc} className="w-full text-left px-3 py-2 rounded-md hover:bg-muted text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-rose-500" /> PDF
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ─── Bot Config Panel Btn (header of left panel) ──────────────────────────────
function BotConfigPanelBtn() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="icon" className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/20" onClick={() => setOpen(true)}>
        <Bot className="h-4 w-4" />
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
          <SheetHeader className="px-4 pt-4 pb-2 border-b sticky top-0 bg-background z-10">
            <SheetTitle className="flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Bot &amp; Automações</SheetTitle>
          </SheetHeader>
          <WhatsappAutomacoes embedded />
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── Templates Popover ────────────────────────────────────────────────────────
function TemplatesPopover({ templates, onPick }: {
  templates: ReturnType<typeof useWhatsappTemplates>['data'];
  onPick: (t: any) => void;
}) {
  const [openMgr, setOpenMgr] = useState(false);
  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground hover:text-foreground shrink-0" title="Respostas rápidas">
            <Zap className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" side="top" className="w-80 p-0 overflow-hidden">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-xs font-semibold">Respostas rápidas</span>
            <Button size="sm" variant="ghost" className="h-7 px-2 gap-1 text-xs" onClick={() => setOpenMgr(true)}>
              <Pencil className="h-3 w-3" /> Gerenciar
            </Button>
          </div>
          <div className="max-h-64 overflow-y-auto p-1">
            {(templates ?? []).length === 0 ? (
              <div className="text-xs text-muted-foreground p-4 text-center">
                Nenhum template.{' '}
                <Button variant="link" className="h-auto p-0 text-xs" onClick={() => setOpenMgr(true)}>Criar</Button>
              </div>
            ) : (templates ?? []).map(t => (
              <button key={t.id} onClick={() => onPick(t)}
                className="w-full text-left p-2 rounded-md hover:bg-muted flex items-start gap-2 transition-colors">
                <Badge variant="outline" className="text-[10px] font-mono shrink-0">{t.atalho}</Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium">{t.titulo}</div>
                  <div className="text-[11px] text-muted-foreground line-clamp-2">{t.conteudo}</div>
                </div>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <TemplatesManager open={openMgr} onOpenChange={setOpenMgr} />
    </>
  );
}

// ─── Templates Manager ────────────────────────────────────────────────────────
function TemplatesManager({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: templates = [], salvar, remover } = useWhatsappTemplates();
  const [edit, setEdit] = useState<{ id?: string; atalho: string; titulo: string; conteudo: string } | null>(null);

  async function handleSalvar() {
    if (!edit) return;
    const atalho = edit.atalho.startsWith('/') ? edit.atalho : `/${edit.atalho}`;
    if (atalho.length < 2 || !edit.titulo.trim() || !edit.conteudo.trim()) { toast.error('Preencha atalho, título e conteúdo.'); return; }
    try {
      await salvar.mutateAsync({ id: edit.id, atalho, titulo: edit.titulo.trim(), conteudo: edit.conteudo });
      toast.success('Template salvo');
      setEdit(null);
    } catch (e: any) { toast.error('Erro: ' + e.message); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Respostas rápidas</DialogTitle></DialogHeader>
        {!edit ? (
          <div className="space-y-3">
            <Button size="sm" onClick={() => setEdit({ atalho: '/', titulo: '', conteudo: '' })} className="w-full gap-1.5">
              <Plus className="h-4 w-4" /> Novo template
            </Button>
            <div className="space-y-1.5 max-h-[50dvh] overflow-y-auto pr-1">
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">
                  Crie atalhos como <code className="font-mono">/oi</code> e use no chat digitando <code>/</code>.
                </p>
              )}
              {templates.map(t => (
                <div key={t.id} className="rounded-xl border border-border/40 p-2.5 flex items-start gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">{t.atalho}</Badge>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{t.titulo}</div>
                    <div className="text-[11px] text-muted-foreground line-clamp-2">{t.conteudo}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="h-7 px-1.5"
                    onClick={() => setEdit({ id: t.id, atalho: t.atalho, titulo: t.titulo, conteudo: t.conteudo })}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-1.5 text-destructive hover:text-destructive"
                    onClick={async () => { await remover.mutateAsync(t.id); toast.success('Removido'); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <div className="text-[11px] font-semibold mb-1.5">Variáveis disponíveis</div>
              <div className="flex flex-wrap gap-1">
                {TEMPLATE_VARIAVEIS.map(v => (
                  <Badge key={v.chave} variant="secondary" className="text-[10px] font-mono" title={v.descricao}>{'{' + v.chave + '}'}</Badge>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[120px_1fr] gap-2">
              <div>
                <Label className="text-xs">Atalho</Label>
                <Input value={edit.atalho} onChange={e => setEdit({ ...edit, atalho: e.target.value })} placeholder="/oi" className="font-mono" />
              </div>
              <div>
                <Label className="text-xs">Título</Label>
                <Input value={edit.titulo} onChange={e => setEdit({ ...edit, titulo: e.target.value })} placeholder="Saudação inicial" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Conteúdo</Label>
              <Textarea value={edit.conteudo} onChange={e => setEdit({ ...edit, conteudo: e.target.value })}
                placeholder="Olá {nome}! Confirmando sua sessão {próxima_sessão}. Responda SIM ou REAGENDAR." rows={5} />
              <div className="mt-1.5 flex flex-wrap gap-1">
                {TEMPLATE_VARIAVEIS.map(v => (
                  <button key={v.chave} type="button" title={v.descricao}
                    onClick={() => setEdit(s => s ? { ...s, conteudo: s.conteudo + '{' + v.chave + '}' } : s)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border/60 hover:bg-muted">
                    {'{' + v.chave + '}'}
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button>
              <Button onClick={handleSalvar} disabled={salvar.isPending}>
                {salvar.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Notas Button ─────────────────────────────────────────────────────────────
function NotasButton({ conversaId }: { conversaId: string }) {
  const [nova, setNova] = useState('');
  const { data: notas = [], adicionar, remover } = useWhatsappNotas(conversaId);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9" title="Notas internas">
          <StickyNote className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500" /> Notas internas
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <Textarea placeholder="Nota privada sobre este contato..." value={nova} onChange={e => setNova(e.target.value)} rows={2} />
            <Button size="sm" onClick={async () => { if (nova.trim()) { await adicionar.mutateAsync(nova.trim()); setNova(''); } }}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2">
            {notas.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Nenhuma nota ainda</div>}
            {notas.map(n => (
              <div key={n.id} className="rounded-xl border border-border/40 bg-amber-50/30 dark:bg-amber-900/10 p-3">
                <div className="text-xs whitespace-pre-wrap">{n.conteudo}</div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleString('pt-BR')}</span>
                  <Button variant="ghost" size="sm" className="h-6 text-muted-foreground hover:text-destructive" onClick={() => remover.mutate(n.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Bot Toggle ───────────────────────────────────────────────────────────────
function BotToggle({ conversa }: { conversa: WAConversa }) {
  const [ativo, setAtivo] = useState((conversa as any).bot_ativo ?? true);
  useEffect(() => { setAtivo((conversa as any).bot_ativo ?? true); }, [conversa.id, (conversa as any).bot_ativo]);
  const toggle = async (v: boolean) => {
    setAtivo(v);
    const { error } = await supabase.from('whatsapp_conversas').update({ bot_ativo: v }).eq('id', conversa.id);
    if (error) { toast.error('Erro: ' + error.message); setAtivo(!v); }
    else toast.success(v ? 'Bot ativado' : 'Bot pausado');
  };
  return (
    <div className="hidden sm:flex items-center gap-1.5 h-9 px-2 rounded-lg border border-border/40 bg-background/60" title={ativo ? 'Bot ativo nesta conversa' : 'Bot pausado'}>
      <Bot className="h-3.5 w-3.5 text-muted-foreground" />
      <Switch checked={ativo} onCheckedChange={toggle} className="scale-75" />
    </div>
  );
}

// ─── Atribuir Button ──────────────────────────────────────────────────────────
function AtribuirButton({ conversa, userId }: { conversa: WAConversa; userId: string | null }) {
  const atribuir = useAtribuirConversa();
  const minha   = conversa.atribuido_a && conversa.atribuido_a === userId;
  const semDono = !conversa.atribuido_a;
  return (
    <Button
      variant={minha ? 'default' : semDono ? 'outline' : 'ghost'}
      size="icon"
      className="h-9 w-9"
      title={minha ? 'Minha — clique para liberar' : semDono ? 'Assumir conversa' : 'Atribuída a outro'}
      onClick={() => { if (!userId) return; atribuir.mutate({ conversa_id: conversa.id, atribuido_a: minha ? null : userId }); }}
    >
      <UserCheck className="h-4 w-4" />
    </Button>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────
function Shell({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <>{children}</>;
  return <AppLayout>{children}</AppLayout>;
}
