import { useEffect, useMemo, useState } from 'react';
import { useLinksRastreaveis } from '@/hooks/useLinksRastreaveis';
import { ORIGENS_PRESET, MIDIAS_PRESET, buildUtmUrl, destinoToUrl, type Destino } from '@/utils/utmBuilder';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/ui/empty-state';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Link2, Copy, QrCode, Trash2, Check, ExternalLink, Plus, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type DestinoTipo = Destino['tipo'];

const DESTINOS: { value: DestinoTipo; label: string; emoji: string }[] = [
  { value: 'funil', label: 'Funil de vendas', emoji: '🎯' },
  { value: 'cadastro', label: 'Cadastro público', emoji: '📝' },
  { value: 'evento', label: 'Evento', emoji: '📅' },
  { value: 'myid', label: 'MyID público', emoji: '🧬' },
  { value: 'custom', label: 'Outra URL', emoji: '🌐' },
];

export default function CrmTrafegoLinks() {
  const { user } = useAuth();
  const { links, isLoading, criar, toggleAtivo, excluir } = useLinksRastreaveis();

  const [label, setLabel] = useState('');
  const [destinoTipo, setDestinoTipo] = useState<DestinoTipo>('funil');
  const [funilSlug, setFunilSlug] = useState('');
  const [cadastroSlug, setCadastroSlug] = useState('');
  const [eventoSlug, setEventoSlug] = useState('');
  const [myidToken, setMyidToken] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  const [origem, setOrigem] = useState('instagram');
  const [midia, setMidia] = useState('feed');
  const [campanha, setCampanha] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [termo, setTermo] = useState('');

  const [qrOpen, setQrOpen] = useState<null | { url: string; label: string; data: string }>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Pré-carregar funil e eventos do usuário
  const { data: funil } = useQuery({
    queryKey: ['funil-config-slug', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('funil_config')
        .select('slug, mensagem_boas_vindas')
        .eq('terapeuta_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: eventos = [] } = useQuery({
    queryKey: ['eventos-list-slug', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('eventos')
        .select('id, titulo, ativo')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('created_at', { ascending: false });
      return (data || []) as { id: string; titulo: string }[];
    },
    enabled: !!user?.id,
  });

  const { data: profile } = useQuery({
    queryKey: ['config-agenda-slug', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('config_agenda')
        .select('slug')
        .eq('terapeuta_id', user!.id)
        .maybeSingle();
      return data as { slug?: string } | null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (funil?.slug && !funilSlug) setFunilSlug(funil.slug);
  }, [funil?.slug]);
  useEffect(() => {
    if (profile?.slug && !cadastroSlug) setCadastroSlug(profile.slug);
  }, [profile?.slug]);
  useEffect(() => {
    if (eventos[0]?.id && !eventoSlug) setEventoSlug(eventos[0].id);
  }, [eventos]);

  const destino: Destino | null = useMemo(() => {
    switch (destinoTipo) {
      case 'funil': return funilSlug ? { tipo: 'funil', slug: funilSlug } : null;
      case 'cadastro': return cadastroSlug ? { tipo: 'cadastro', slug: cadastroSlug } : null;
      case 'evento': return eventoSlug ? { tipo: 'evento', slug: eventoSlug } : null;
      case 'myid': return myidToken ? { tipo: 'myid', token: myidToken } : null;
      case 'custom': return customUrl ? { tipo: 'custom', url: customUrl } : null;
      default: return null;
    }
  }, [destinoTipo, funilSlug, cadastroSlug, eventoSlug, myidToken, customUrl]);

  const utms = useMemo(() => ({
    utm_source: origem,
    utm_medium: midia,
    utm_campaign: campanha || undefined,
    utm_content: conteudo || undefined,
    utm_term: termo || undefined,
  }), [origem, midia, campanha, conteudo, termo]);

  const urlBase = destino ? destinoToUrl(destino) : '';
  const urlFinal = urlBase ? buildUtmUrl(urlBase, utms) : '';

  const podeSalvar = !!urlFinal && !!label.trim() && !!origem && !!campanha.trim();

  const onSubmit = async () => {
    if (!podeSalvar) {
      toast.error('Preencha rótulo, destino, origem e campanha.');
      return;
    }
    await criar.mutateAsync({
      label: label.trim(),
      url_destino: urlBase,
      url_final: urlFinal,
      utms,
    });
    setLabel('');
    setCampanha('');
    setConteudo('');
    setTermo('');
  };

  const copyUrl = async (url: string, id: string) => {
    await navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Link copiado');
    setTimeout(() => setCopiedId(null), 1500);
  };

  const openQr = async (url: string, label: string) => {
    const data = await QRCode.toDataURL(url, { width: 360, margin: 2 });
    setQrOpen({ url, label, data });
  };

  return (
    <div className="p-3 sm:p-5 space-y-5">
      {/* Header */}
      <div>
        <h2 className="h-section">Links rastreáveis</h2>
        <p className="text-caption">
          Gere URLs com UTM para identificar de onde vêm seus leads (Instagram, Ads, e-mail…). Os parâmetros são lidos automaticamente nas páginas públicas e salvos no lead/paciente.
        </p>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Form */}
        <Card className="lg:col-span-3 p-4 sm:p-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lk-label">Rótulo interno</Label>
            <Input
              id="lk-label"
              placeholder="Ex.: Story IG lançamento setembro"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>

          {/* Destino */}
          <div className="space-y-2">
            <Label>Destino</Label>
            <div className="flex flex-wrap gap-2">
              {DESTINOS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDestinoTipo(d.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition',
                    destinoTipo === d.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted/60',
                  )}
                >
                  <span>{d.emoji}</span>
                  {d.label}
                </button>
              ))}
            </div>

            {destinoTipo === 'funil' && (
              <Input
                placeholder={funil?.slug ? funil.slug : 'slug do seu funil'}
                value={funilSlug}
                onChange={(e) => setFunilSlug(e.target.value)}
              />
            )}
            {destinoTipo === 'cadastro' && (
              <Input
                placeholder={profile?.slug || 'slug do cadastro público'}
                value={cadastroSlug}
                onChange={(e) => setCadastroSlug(e.target.value)}
              />
            )}
            {destinoTipo === 'evento' && (
              eventos.length > 0 ? (
                <Select value={eventoSlug} onValueChange={setEventoSlug}>
                  <SelectTrigger><SelectValue placeholder="Selecione um evento" /></SelectTrigger>
                  <SelectContent>
                    {eventos.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>{ev.titulo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">Nenhum evento ativo. Crie um em Eventos.</p>
              )
            )}
            {destinoTipo === 'myid' && (
              <Input
                placeholder="token de avaliação MyID"
                value={myidToken}
                onChange={(e) => setMyidToken(e.target.value)}
              />
            )}
            {destinoTipo === 'custom' && (
              <Input
                type="url"
                placeholder="https://..."
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
              />
            )}
          </div>

          {/* Origem */}
          <div className="space-y-2">
            <Label>Origem (utm_source)</Label>
            <div className="flex flex-wrap gap-2">
              {ORIGENS_PRESET.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    setOrigem(o.value);
                    if (o.medium) setMidia(o.medium);
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition',
                    origem === o.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-muted/60',
                  )}
                >
                  <span>{o.emoji}</span>
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mídia + Campanha */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lk-medium">Mídia (utm_medium)</Label>
              <Select value={midia} onValueChange={setMidia}>
                <SelectTrigger id="lk-medium"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MIDIAS_PRESET.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lk-camp">Campanha (utm_campaign)*</Label>
              <Input
                id="lk-camp"
                placeholder="lancamento_setembro"
                value={campanha}
                onChange={(e) => setCampanha(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lk-cont">Conteúdo (utm_content)</Label>
              <Input
                id="lk-cont"
                placeholder="banner_topo"
                value={conteudo}
                onChange={(e) => setConteudo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lk-term">Termo (utm_term)</Label>
              <Input
                id="lk-term"
                placeholder="postura+escoliose"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </div>
          </div>

          <Button onClick={onSubmit} disabled={!podeSalvar || criar.isPending} className="w-full">
            {criar.isPending ? <Loader2 className="icon-sm animate-spin mr-2" /> : <Plus className="icon-sm mr-2" />}
            Gerar e salvar link
          </Button>
        </Card>

        {/* Preview */}
        <Card className="lg:col-span-2 p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="h-card">Pré-visualização</h3>
            <p className="text-caption">A URL será montada ao vivo.</p>
          </div>
          <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs break-all min-h-[88px]">
            {urlFinal || <span className="text-muted-foreground">Selecione destino e origem para ver a URL.</span>}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!urlFinal}
              onClick={() => urlFinal && copyUrl(urlFinal, 'preview')}
            >
              {copiedId === 'preview' ? <Check className="icon-sm mr-1.5" /> : <Copy className="icon-sm mr-1.5" />}
              Copiar
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={!urlFinal}
              onClick={() => urlFinal && openQr(urlFinal, label || 'Link rastreável')}
            >
              <QrCode className="icon-sm mr-1.5" /> QR Code
            </Button>
          </div>
        </Card>
      </div>

      {/* Histórico */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 sm:p-5 border-b">
          <h3 className="h-card">Histórico de links</h3>
          <p className="text-caption">Acompanhe e reutilize seus links gerados.</p>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><Loader2 className="icon-md animate-spin text-muted-foreground" /></div>
        ) : links.length === 0 ? (
          <EmptyState
            icon={<Link2 className="icon-xl" />}
            title="Nenhum link ainda"
            description="Crie seu primeiro link rastreável usando o formulário acima."
          />
        ) : (
          <div className="divide-y">
            {links.map((l) => (
              <div key={l.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{l.label}</span>
                    {!l.ativo && <Badge variant="outline" className="text-[10px]">inativo</Badge>}
                    <Badge variant="secondary" className="text-[10px]">{l.cliques} cliques</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    {l.utms.utm_source && <Badge variant="outline" className="text-[10px]">src: {l.utms.utm_source}</Badge>}
                    {l.utms.utm_medium && <Badge variant="outline" className="text-[10px]">med: {l.utms.utm_medium}</Badge>}
                    {l.utms.utm_campaign && <Badge variant="outline" className="text-[10px]">camp: {l.utms.utm_campaign}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground break-all line-clamp-2">{l.url_final}</p>
                </div>
                <div className="flex items-center gap-1.5 sm:flex-col sm:items-end">
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyUrl(l.url_final, l.id)} title="Copiar">
                      {copiedId === l.id ? <Check className="icon-sm text-emerald-600" /> : <Copy className="icon-sm" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openQr(l.url_final, l.label)} title="QR Code">
                      <QrCode className="icon-sm" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Abrir">
                      <a href={l.url_final} target="_blank" rel="noreferrer"><ExternalLink className="icon-sm" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('Excluir este link?')) excluir.mutate(l.id); }} title="Excluir">
                      <Trash2 className="icon-sm" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={l.ativo} onCheckedChange={(v) => toggleAtivo.mutate({ id: l.id, ativo: v })} />
                    <span className="text-[10px] text-muted-foreground">Ativo</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* QR Modal */}
      <Dialog open={!!qrOpen} onOpenChange={(o) => !o && setQrOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{qrOpen?.label}</DialogTitle>
          </DialogHeader>
          {qrOpen && (
            <div className="flex flex-col items-center gap-3">
              <img src={qrOpen.data} alt="QR Code" className="rounded-lg border" />
              <p className="text-xs text-muted-foreground break-all text-center">{qrOpen.url}</p>
              <div className="flex gap-2 w-full">
                <Button variant="outline" className="flex-1" onClick={() => copyUrl(qrOpen.url, 'modal')}>
                  <Copy className="icon-sm mr-1.5" /> Copiar URL
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <a href={qrOpen.data} download={`qr-${(qrOpen.label || 'link').replace(/\s+/g, '-')}.png`}>
                    <QrCode className="icon-sm mr-1.5" /> Baixar PNG
                  </a>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
