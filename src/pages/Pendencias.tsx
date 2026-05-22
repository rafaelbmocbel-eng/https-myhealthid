import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Globe, MessageCircle, Instagram, Mail, CreditCard, Shield,
  Smartphone, Bell, Users, Image as ImageIcon, FileText, Search,
  Lock, Phone, Calendar, Palette, Share2, DollarSign, BookOpen,
  ChevronRight, CheckCircle2, Circle, Sparkles,
} from 'lucide-react';
import PageHeader from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type Prioridade = 'alta' | 'media' | 'baixa';

interface Pendencia {
  id: string;
  titulo: string;
  descricao: string;
  categoria: string;
  prioridade: Prioridade;
  icon: React.ComponentType<{ className?: string }>;
  acao?: { label: string; to?: string; href?: string };
}

const PENDENCIAS: Pendencia[] = [
  // ===== Presença Digital =====
  {
    id: 'website',
    titulo: 'Criar site profissional',
    descricao: 'Landing page com sua bio, especialidades, depoimentos e CTA para agendar. Use o Funil de Vendas como ponto de partida.',
    categoria: 'Presença Digital',
    prioridade: 'alta',
    icon: Globe,
    acao: { label: 'Configurar funil', to: '/crm?tab=funil' },
  },
  {
    id: 'dominio',
    titulo: 'Comprar domínio próprio',
    descricao: 'Substitua o subdomínio padrão por algo como seunome.com.br. Aumenta credibilidade e SEO.',
    categoria: 'Presença Digital',
    prioridade: 'alta',
    icon: Globe,
  },
  {
    id: 'logo',
    titulo: 'Logo e identidade visual',
    descricao: 'Crie logo, paleta de cores e tipografia consistentes. Aplicar em portal, e-mails e materiais.',
    categoria: 'Presença Digital',
    prioridade: 'media',
    icon: Palette,
    acao: { label: 'Configurações', to: '/configuracoes' },
  },
  {
    id: 'fotos',
    titulo: 'Banco de fotos profissionais',
    descricao: 'Fotos suas, do consultório e de exercícios. Use em site, redes e prontuário.',
    categoria: 'Presença Digital',
    prioridade: 'media',
    icon: ImageIcon,
  },

  // ===== Comunicação =====
  {
    id: 'whatsapp',
    titulo: 'Ativar WhatsApp (Z-API)',
    descricao: 'Conecte sua instância Z-API para receber mensagens na inbox, enviar lembretes automáticos e ativar o bot de agendamento.',
    categoria: 'Comunicação',
    prioridade: 'alta',
    icon: MessageCircle,
    acao: { label: 'Configurar WhatsApp', to: '/configuracoes?tab=whatsapp' },
  },
  {
    id: 'whatsapp-bot',
    titulo: 'Ativar bot WhatsApp por paciente',
    descricao: 'Ative o bot para responder confirmações, reagendamentos e dúvidas frequentes 24/7.',
    categoria: 'Comunicação',
    prioridade: 'media',
    icon: Sparkles,
    acao: { label: 'Pacientes', to: '/pacientes' },
  },
  {
    id: 'instagram',
    titulo: 'Conectar Instagram profissional',
    descricao: 'Crie conta business, publique conteúdo de educação, depoimentos e cases. Link na bio para o funil.',
    categoria: 'Comunicação',
    prioridade: 'alta',
    icon: Instagram,
  },
  {
    id: 'email-dominio',
    titulo: 'E-mail com domínio próprio',
    descricao: 'contato@seudominio.com.br. Aumenta confiança e taxa de entrega de e-mails transacionais.',
    categoria: 'Comunicação',
    prioridade: 'media',
    icon: Mail,
  },
  {
    id: 'telefone',
    titulo: 'Telefone de atendimento',
    descricao: 'Linha dedicada (pode ser virtual) para pacientes que preferem ligação.',
    categoria: 'Comunicação',
    prioridade: 'baixa',
    icon: Phone,
  },

  // ===== Marketing =====
  {
    id: 'trafego-pago',
    titulo: 'Configurar tráfego pago',
    descricao: 'Meta Ads e Google Ads para captação. Conecte pixel, defina público e crie primeiras campanhas.',
    categoria: 'Marketing',
    prioridade: 'media',
    icon: Share2,
    acao: { label: 'CRM Tráfego', to: '/trafego' },
  },
  {
    id: 'seo',
    titulo: 'Otimizar SEO da landing page',
    descricao: 'Título, meta description, palavras-chave locais ("fisioterapeuta em [cidade]"), schema de local business.',
    categoria: 'Marketing',
    prioridade: 'media',
    icon: Search,
  },
  {
    id: 'google-meu-negocio',
    titulo: 'Google Meu Negócio',
    descricao: 'Cadastre o consultório no Google Maps com horário, fotos, telefone e link para agendamento.',
    categoria: 'Marketing',
    prioridade: 'alta',
    icon: Globe,
  },
  {
    id: 'conteudo',
    titulo: 'Calendário de conteúdo',
    descricao: 'Defina 2-3 posts/semana sobre dor, postura, exercícios. Reaproveite em stories e reels.',
    categoria: 'Marketing',
    prioridade: 'baixa',
    icon: FileText,
  },

  // ===== Operações =====
  {
    id: 'agenda-config',
    titulo: 'Configurar horários da agenda',
    descricao: 'Defina turnos, duração padrão das sessões, intervalos e dias de atendimento.',
    categoria: 'Operações',
    prioridade: 'alta',
    icon: Calendar,
    acao: { label: 'Configurar agenda', to: '/configuracoes?tab=agenda' },
  },
  {
    id: 'servicos-precos',
    titulo: 'Cadastrar serviços e preços',
    descricao: 'Sessões avulsas, pacotes, avaliações. Aparecem no funil, portal e financeiro.',
    categoria: 'Operações',
    prioridade: 'alta',
    icon: DollarSign,
    acao: { label: 'Configurações', to: '/configuracoes?tab=servicos' },
  },
  {
    id: 'pix',
    titulo: 'Cadastrar chave PIX',
    descricao: 'Necessário para o funil de vendas gerar pagamentos instantâneos.',
    categoria: 'Operações',
    prioridade: 'alta',
    icon: CreditCard,
    acao: { label: 'Configurar', to: '/configuracoes' },
  },
  {
    id: 'sumup-cartao',
    titulo: 'Pagamentos por cartão (SumUp)',
    descricao: 'Conecte SumUp para cobrar no cartão direto pelo portal do paciente.',
    categoria: 'Operações',
    prioridade: 'media',
    icon: CreditCard,
  },
  {
    id: 'equipe',
    titulo: 'Cadastrar equipe (se clínica)',
    descricao: 'Adicione outros profissionais, recepção e configure permissões.',
    categoria: 'Operações',
    prioridade: 'baixa',
    icon: Users,
    acao: { label: 'Configurações', to: '/configuracoes?tab=equipe' },
  },

  // ===== Conteúdo Clínico =====
  {
    id: 'diretrizes',
    titulo: 'Catálogo de diretrizes de tratamento',
    descricao: 'Cadastre protocolos base por queixa (lombalgia, cervicalgia, pós-op) para reuso.',
    categoria: 'Conteúdo Clínico',
    prioridade: 'media',
    icon: BookOpen,
  },
  {
    id: 'exercicios',
    titulo: 'Biblioteca de exercícios',
    descricao: 'Cadastre exercícios com fotos/vídeos para prescrição no portal.',
    categoria: 'Conteúdo Clínico',
    prioridade: 'media',
    icon: ImageIcon,
  },
  {
    id: 'soap-templates',
    titulo: 'Personalizar templates SOAP',
    descricao: 'Adapte modelos de evolução (Inicial, Retorno, Alta) ao seu fluxo.',
    categoria: 'Conteúdo Clínico',
    prioridade: 'baixa',
    icon: FileText,
  },

  // ===== Pacientes =====
  {
    id: 'portal-paciente',
    titulo: 'Divulgar Portal do Paciente',
    descricao: 'Compartilhe o link com pacientes ativos para acompanhamento gamificado.',
    categoria: 'Pacientes',
    prioridade: 'alta',
    icon: Smartphone,
    acao: { label: 'Pacientes', to: '/pacientes' },
  },
  {
    id: 'pwa-install',
    titulo: 'Orientar instalação do PWA',
    descricao: 'Pacientes podem instalar o portal como app no celular. Mais engajamento e notificações push.',
    categoria: 'Pacientes',
    prioridade: 'baixa',
    icon: Smartphone,
  },
  {
    id: 'nps',
    titulo: 'Ativar pesquisas NPS',
    descricao: 'Medir satisfação pós-alta. Promotores viram depoimentos e indicações.',
    categoria: 'Pacientes',
    prioridade: 'baixa',
    icon: Bell,
  },

  // ===== Compliance & Segurança =====
  {
    id: 'lgpd',
    titulo: 'Termo de consentimento LGPD',
    descricao: 'Configure o termo que pacientes aceitam ao se cadastrar. Obrigatório por lei.',
    categoria: 'Compliance',
    prioridade: 'alta',
    icon: Shield,
  },
  {
    id: 'politica-privacidade',
    titulo: 'Política de privacidade no site',
    descricao: 'Página pública descrevendo coleta, uso e armazenamento de dados.',
    categoria: 'Compliance',
    prioridade: 'alta',
    icon: FileText,
  },
  {
    id: 'webhook-secret',
    titulo: 'Proteger webhook do WhatsApp',
    descricao: 'Adicionar segredo no webhook Z-API para impedir injeção de mensagens falsas.',
    categoria: 'Compliance',
    prioridade: 'media',
    icon: Lock,
  },
  {
    id: 'backup',
    titulo: 'Exportar backup periódico',
    descricao: 'Exporte relatórios e dados de pacientes mensalmente como redundância.',
    categoria: 'Compliance',
    prioridade: 'baixa',
    icon: Shield,
  },
];

const STORAGE_KEY = 'pendencias-app-feito-v1';

const CATEGORIA_ORDEM = [
  'Presença Digital',
  'Comunicação',
  'Marketing',
  'Operações',
  'Conteúdo Clínico',
  'Pacientes',
  'Compliance',
];

const PRIORIDADE_LABEL: Record<Prioridade, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
};

const PRIORIDADE_CLASSE: Record<Prioridade, string> = {
  alta: 'bg-red-500/10 text-red-600 border-red-500/20',
  media: 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  baixa: 'bg-muted text-muted-foreground border-border/40',
};

export default function Pendencias() {
  const [feito, setFeito] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [filtro, setFiltro] = useState<'todas' | 'pendentes' | 'feitas'>('pendentes');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...feito]));
    } catch {
      /* ignore */
    }
  }, [feito]);

  const toggle = (id: string) => {
    setFeito(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const total = PENDENCIAS.length;
  const concluidas = PENDENCIAS.filter(p => feito.has(p.id)).length;
  const progresso = Math.round((concluidas / total) * 100);

  const filtradas = useMemo(() => {
    if (filtro === 'pendentes') return PENDENCIAS.filter(p => !feito.has(p.id));
    if (filtro === 'feitas') return PENDENCIAS.filter(p => feito.has(p.id));
    return PENDENCIAS;
  }, [filtro, feito]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, Pendencia[]>();
    for (const p of filtradas) {
      if (!map.has(p.categoria)) map.set(p.categoria, []);
      map.get(p.categoria)!.push(p);
    }
    return CATEGORIA_ORDEM
      .map(cat => ({ cat, itens: map.get(cat) || [] }))
      .filter(c => c.itens.length > 0);
  }, [filtradas]);

  return (
    <div className="container max-w-5xl py-6 sm:py-8">
      <PageHeader
        eyebrow="Setup do App"
        title="Pendências do App"
        subtitle="Checklist completo de tudo que você ainda precisa configurar para colocar sua operação no ar."
      />

      {/* Progresso */}
      <Card className="p-5 sm:p-6 mb-5 rounded-xl border-border/40 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-caption">Progresso geral</div>
            <div className="h-section mt-1">
              {concluidas} de {total} concluídas
            </div>
          </div>
          <div className="text-3xl font-bold tabular-nums text-primary">
            {progresso}%
          </div>
        </div>
        <Progress value={progresso} className="h-2" />
      </Card>

      {/* Filtros */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {([
          { key: 'pendentes', label: `Pendentes (${total - concluidas})` },
          { key: 'todas', label: `Todas (${total})` },
          { key: 'feitas', label: `Feitas (${concluidas})` },
        ] as const).map(opt => (
          <button
            key={opt.key}
            onClick={() => setFiltro(opt.key)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors shrink-0',
              filtro === opt.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border/40 hover:text-foreground',
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Lista por categoria */}
      <div className="space-y-6">
        {porCategoria.map(({ cat, itens }) => (
          <section key={cat}>
            <h2 className="h-card mb-3 px-1">{cat}</h2>
            <div className="space-y-2">
              {itens.map(p => {
                const Icon = p.icon;
                const isFeito = feito.has(p.id);
                return (
                  <Card
                    key={p.id}
                    className={cn(
                      'p-4 sm:p-5 rounded-xl border-border/40 shadow-xs transition-all',
                      isFeito && 'opacity-60 bg-muted/30',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggle(p.id)}
                        aria-label={isFeito ? 'Marcar como pendente' : 'Marcar como feito'}
                        className="shrink-0 mt-0.5"
                      >
                        {isFeito ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground/40 hover:text-foreground transition-colors" />
                        )}
                      </button>

                      <div className="shrink-0 mt-0.5 h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={cn(
                            'text-sm font-semibold',
                            isFeito && 'line-through text-muted-foreground',
                          )}>
                            {p.titulo}
                          </h3>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] px-1.5 py-0 h-4 font-medium', PRIORIDADE_CLASSE[p.prioridade])}
                          >
                            {PRIORIDADE_LABEL[p.prioridade]}
                          </Badge>
                        </div>
                        <p className="text-caption mt-1">{p.descricao}</p>

                        {p.acao && !isFeito && (
                          p.acao.to ? (
                            <Link
                              to={p.acao.to}
                              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:underline"
                            >
                              {p.acao.label}
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <a
                              href={p.acao.href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-primary hover:underline"
                            >
                              {p.acao.label}
                              <ChevronRight className="h-3 w-3" />
                            </a>
                          )
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}

        {porCategoria.length === 0 && (
          <Card className="p-10 text-center rounded-xl border-border/40">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
            <h3 className="h-card">Tudo pronto por aqui!</h3>
            <p className="text-caption mt-1">Você concluiu todas as pendências desse filtro.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
