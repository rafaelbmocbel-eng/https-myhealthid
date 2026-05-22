import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Instagram, Users, Eye, Heart, MessageCircle, TrendingUp,
  Calendar, Send, AtSign, Image as ImageIcon, Video, Sparkles,
  CheckCircle2, AlertCircle, Plus, ExternalLink, Info,
} from 'lucide-react';
import { toast } from 'sonner';

type Sub = 'inbox' | 'insights' | 'publicar' | 'comentarios';

const SUBS: { key: Sub; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'inbox', label: 'DMs', icon: MessageCircle },
  { key: 'insights', label: 'Insights', icon: TrendingUp },
  { key: 'publicar', label: 'Publicar', icon: Send },
  { key: 'comentarios', label: 'Coments & Menções', icon: AtSign },
];

// ============ MOCKS ============
const MOCK_CONTA = {
  username: '@suaclinica',
  nome: 'Sua Clínica',
  seguidores: 4287,
  seguindo: 312,
  posts: 184,
  conectado: false, // mock — toggle visual
};

const MOCK_DMS = [
  { id: '1', user: '@mariana.silva', avatar: '🧑‍🦰', msg: 'Oi! Vi seu reels e queria agendar uma avaliação 🙏', tempo: '2min', naoLida: true },
  { id: '2', user: '@pedro.fit', avatar: '🧑', msg: 'Vocês atendem dor lombar crônica?', tempo: '18min', naoLida: true },
  { id: '3', user: '@juliacosta', avatar: '👩', msg: 'Obrigada pelo atendimento de ontem!', tempo: '1h', naoLida: false },
  { id: '4', user: '@rafa.runner', avatar: '🏃', msg: 'Quanto custa o plano mensal?', tempo: '3h', naoLida: false },
];

const MOCK_INSIGHTS = {
  alcance7d: 12847,
  alcanceVar: 18.4,
  impressoes7d: 23104,
  impressoesVar: 12.1,
  visitas7d: 487,
  visitasVar: -4.2,
  novos7d: 94,
  novosVar: 22.0,
};

const MOCK_POSTS = [
  { id: 'p1', tipo: 'reel', cover: '🎥', legenda: '3 erros que pioram sua dor lombar', curtidas: 482, coments: 37, alcance: 8410, dias: 2 },
  { id: 'p2', tipo: 'foto', cover: '📸', legenda: 'Avaliação MyID — antes e depois', curtidas: 218, coments: 14, alcance: 3120, dias: 5 },
  { id: 'p3', tipo: 'reel', cover: '🎥', legenda: 'Postura no home office', curtidas: 941, coments: 62, alcance: 14200, dias: 7 },
  { id: 'p4', tipo: 'carrossel', cover: '🖼️', legenda: '5 sinais de que você precisa de fisio', curtidas: 367, coments: 28, alcance: 5840, dias: 11 },
];

const MOCK_AGENDADOS = [
  { id: 'a1', tipo: 'reel', legenda: 'Dica rápida: alongamento de pescoço em 60s', data: '2026-05-24T18:00:00', status: 'agendado' },
  { id: 'a2', tipo: 'carrossel', legenda: 'Por que MyID é diferente?', data: '2026-05-26T09:30:00', status: 'agendado' },
];

const MOCK_COMENTS = [
  { id: 'c1', user: '@ana.lima', post: '3 erros que pioram...', msg: 'Salvei demais!! 🙌', tempo: '12min', tipo: 'comentario' },
  { id: 'c2', user: '@carlosfit', post: '—', msg: 'Mencionou @suaclinica em um story', tempo: '34min', tipo: 'mencao' },
  { id: 'c3', user: '@lu.movimento', post: 'Postura no home office', msg: 'Vocês atendem em quais cidades?', tempo: '1h', tipo: 'comentario' },
];

// ============ COMPONENTE ============
export default function CrmTrafegoInstagram() {
  const [sub, setSub] = useState<Sub>('inbox');
  const [conectado, setConectado] = useState(MOCK_CONTA.conectado);

  return (
    <div className="p-3 sm:p-5 space-y-4 max-w-6xl mx-auto">
      <ConnectionCard conectado={conectado} onConnect={() => {
        toast.info('Conexão real exige App Meta. Por enquanto, dados de demonstração.');
        setConectado(true);
      }} onDisconnect={() => setConectado(false)} />

      {!conectado ? (
        <DemoBanner />
      ) : null}

      <Tabs value={sub} onValueChange={(v) => setSub(v as Sub)}>
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <TabsList className="bg-muted/60 inline-flex">
            {SUBS.map((s) => (
              <TabsTrigger key={s.key} value={s.key} className="text-xs gap-1.5">
                <s.icon className="icon-xs" />
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="inbox" className="mt-4"><InboxDMs /></TabsContent>
        <TabsContent value="insights" className="mt-4"><Insights /></TabsContent>
        <TabsContent value="publicar" className="mt-4"><Publicar /></TabsContent>
        <TabsContent value="comentarios" className="mt-4"><Comentarios /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============ CONNECTION CARD ============
function ConnectionCard({ conectado, onConnect, onDisconnect }: { conectado: boolean; onConnect: () => void; onDisconnect: () => void }) {
  return (
    <Card className="rounded-xl border-border/40 shadow-xs p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
          conectado ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
        )}>
          <Instagram className="icon-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="h-card">{conectado ? MOCK_CONTA.username : 'Instagram não conectado'}</h3>
            {conectado && (
              <Badge variant="outline" className="text-[10px] gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="icon-xs" /> Demo
              </Badge>
            )}
          </div>
          <p className="text-caption">
            {conectado
              ? `${MOCK_CONTA.seguidores.toLocaleString('pt-BR')} seguidores · ${MOCK_CONTA.posts} posts`
              : 'Conecte sua conta Business/Creator para gerenciar DMs, insights e publicações.'}
          </p>
        </div>
        {conectado ? (
          <Button variant="ghost" size="sm" onClick={onDisconnect}>Desconectar</Button>
        ) : (
          <Button size="sm" onClick={onConnect} className="gap-1.5">
            <Instagram className="icon-xs" /> Conectar
          </Button>
        )}
      </div>
    </Card>
  );
}

function DemoBanner() {
  return (
    <Card className="rounded-xl border-amber-500/30 bg-amber-500/5 p-3 sm:p-4">
      <div className="flex items-start gap-2">
        <Info className="icon-sm text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 text-xs text-foreground/80 space-y-1">
          <p className="font-medium">Você está vendo dados de demonstração.</p>
          <p className="text-muted-foreground">
            Para conectar de verdade, você precisa de: (1) conta Instagram <b>Profissional</b> (Business ou Creator), (2) vinculada a uma <b>Página do Facebook</b>, e (3) um App no Meta for Developers com Instagram Graph API. Me chame quando estiver pronto.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ============ INBOX DMS ============
function InboxDMs() {
  const naoLidas = MOCK_DMS.filter((d) => d.naoLida).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="h-card">Mensagens diretas</h3>
          <p className="text-caption">{naoLidas} não lidas · sincronizadas com /crm/inbox</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => toast.info('Abriria /crm/inbox com filtro Instagram')}>
          <ExternalLink className="icon-xs" /> Ver na inbox
        </Button>
      </div>
      <Card className="rounded-xl border-border/40 shadow-xs divide-y divide-border/40 overflow-hidden">
        {MOCK_DMS.map((dm) => (
          <button
            key={dm.id}
            onClick={() => toast.info(`Abriria conversa com ${dm.user}`)}
            className="w-full flex items-center gap-3 p-3 sm:p-4 hover:bg-muted/40 transition-colors text-left"
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg shrink-0">{dm.avatar}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{dm.user}</span>
                {dm.naoLida && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">{dm.msg}</p>
            </div>
            <span className="text-[10px] text-muted-foreground shrink-0">{dm.tempo}</span>
          </button>
        ))}
      </Card>
    </div>
  );
}

// ============ INSIGHTS ============
function Insights() {
  const kpis = [
    { label: 'Alcance (7d)', value: MOCK_INSIGHTS.alcance7d, var: MOCK_INSIGHTS.alcanceVar, icon: Eye },
    { label: 'Impressões (7d)', value: MOCK_INSIGHTS.impressoes7d, var: MOCK_INSIGHTS.impressoesVar, icon: TrendingUp },
    { label: 'Visitas ao perfil', value: MOCK_INSIGHTS.visitas7d, var: MOCK_INSIGHTS.visitasVar, icon: Users },
    { label: 'Novos seguidores', value: MOCK_INSIGHTS.novos7d, var: MOCK_INSIGHTS.novosVar, icon: Heart },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="rounded-xl border-border/40 shadow-xs p-4">
            <div className="flex items-center justify-between mb-2">
              <k.icon className="icon-sm text-muted-foreground" />
              <span className={cn(
                'text-[10px] font-medium px-1.5 py-0.5 rounded',
                k.var >= 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
              )}>
                {k.var >= 0 ? '+' : ''}{k.var.toFixed(1)}%
              </span>
            </div>
            <div className="text-2xl font-semibold tracking-tight">{k.value.toLocaleString('pt-BR')}</div>
            <p className="text-caption mt-0.5">{k.label}</p>
          </Card>
        ))}
      </div>

      <div>
        <h3 className="h-card mb-2">Posts recentes</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MOCK_POSTS.map((p) => (
            <Card key={p.id} className="rounded-xl border-border/40 shadow-xs p-3 flex gap-3">
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center text-2xl shrink-0">{p.cover}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="outline" className="text-[9px] px-1 py-0">{p.tipo}</Badge>
                  <span className="text-[10px] text-muted-foreground">há {p.dias}d</span>
                </div>
                <p className="text-xs line-clamp-2 mb-2">{p.legenda}</p>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Heart className="icon-xs" /> {p.curtidas}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="icon-xs" /> {p.coments}</span>
                  <span className="flex items-center gap-1"><Eye className="icon-xs" /> {p.alcance.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ PUBLICAR ============
function Publicar() {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<'feed' | 'reel' | 'story'>('feed');
  const [legenda, setLegenda] = useState('');
  const [data, setData] = useState('');

  const handleAgendar = () => {
    if (!legenda.trim() || !data) {
      toast.error('Preencha a legenda e a data');
      return;
    }
    toast.success('Post agendado (demo)');
    setOpen(false);
    setLegenda(''); setData('');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="h-card">Agendados</h3>
          <p className="text-caption">{MOCK_AGENDADOS.length} posts na fila</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="icon-xs" /> Novo post
        </Button>
      </div>

      <Card className="rounded-xl border-border/40 shadow-xs divide-y divide-border/40 overflow-hidden">
        {MOCK_AGENDADOS.map((a) => (
          <div key={a.id} className="p-3 sm:p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {a.tipo === 'reel' ? <Video className="icon-sm" /> : <ImageIcon className="icon-sm" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px] px-1 py-0">{a.tipo}</Badge>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="icon-xs" />
                  {new Date(a.data).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs truncate mt-0.5">{a.legenda}</p>
            </div>
            <Badge className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" variant="outline">
              Agendado
            </Badge>
          </div>
        ))}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo post</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">Tipo</label>
              <div className="grid grid-cols-3 gap-2">
                {(['feed', 'reel', 'story'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTipo(t)}
                    className={cn(
                      'p-2 rounded-lg border text-xs capitalize transition-colors',
                      tipo === t ? 'border-primary bg-primary/5 text-primary' : 'border-border/40 text-muted-foreground hover:bg-muted/40'
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">Mídia</label>
              <button className="w-full h-32 rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center text-muted-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors">
                <ImageIcon className="icon-md mb-1" />
                <span className="text-xs">Arraste ou clique para enviar</span>
              </button>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">Legenda</label>
              <Textarea
                value={legenda}
                onChange={(e) => setLegenda(e.target.value)}
                placeholder="Escreva a legenda... #fisioterapia"
                rows={4}
              />
              <button className="text-[10px] text-primary mt-1 flex items-center gap-1 hover:underline">
                <Sparkles className="icon-xs" /> Gerar com IA
              </button>
            </div>
            <div>
              <label className="text-xs font-medium mb-1.5 block">Agendar para</label>
              <Input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleAgendar} className="gap-1.5">
              <Calendar className="icon-xs" /> Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ COMENTÁRIOS ============
function Comentarios() {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="h-card">Comentários e menções</h3>
        <p className="text-caption">Interaja sem sair do CRM</p>
      </div>
      <Card className="rounded-xl border-border/40 shadow-xs divide-y divide-border/40 overflow-hidden">
        {MOCK_COMENTS.map((c) => (
          <div key={c.id} className="p-3 sm:p-4 flex items-start gap-3">
            <div className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
              c.tipo === 'mencao' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-primary/10 text-primary'
            )}>
              {c.tipo === 'mencao' ? <AtSign className="icon-sm" /> : <MessageCircle className="icon-sm" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                <span className="text-sm font-medium">{c.user}</span>
                <span className="text-[10px] text-muted-foreground">· {c.tempo}</span>
                {c.post !== '—' && <span className="text-[10px] text-muted-foreground truncate">em &ldquo;{c.post}&rdquo;</span>}
              </div>
              <p className="text-xs text-foreground/80 mb-2">{c.msg}</p>
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => toast.info('Abriria resposta')}>
                  Responder
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => toast.success('Marcado como lido')}>
                  Marcar lido
                </Button>
              </div>
            </div>
          </div>
        ))}
      </Card>

      <Card className="rounded-xl border-border/40 shadow-xs p-4 bg-muted/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="icon-sm text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <b>Dica:</b> quando você conectar o Instagram real, comentários com palavras como &ldquo;preço&rdquo;, &ldquo;agendar&rdquo; ou &ldquo;quanto custa&rdquo; podem ser auto-encaminhados para um lead no funil.
          </p>
        </div>
      </Card>
    </div>
  );
}
