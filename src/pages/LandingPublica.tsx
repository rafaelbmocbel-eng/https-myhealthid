import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import LogoIcon from '@/components/LogoIcon';
import logoBranco from '@/assets/logo-myhealthid-branco.png';
import {
  ArrowRight, ShieldCheck, Sparkles, CalendarDays,
  MessageSquare, Activity, Lock, CheckCircle2,
  Mic, LayoutDashboard, ClipboardList,
} from 'lucide-react';
import { useState } from 'react';

// ── MyID ring data (demo values) ─────────────────────────────────────────────
const MYID_DIMS = [
  { key: 'D',   label: 'Dor',          score: 7.5, color: '#EF4444' },
  { key: 'EFI', label: 'Atividades',   score: 3.0, color: '#F97316' },
  { key: 'P',   label: 'Emoções',      score: 6.5, color: '#A855F7' },
  { key: 'I',   label: 'Mudanças',     score: 8.0, color: '#3B82F6' },
  { key: 'R',   label: 'Sono',         score: 5.5, color: '#06B6D4' },
  { key: 'AF',  label: 'Movimento',    score: 7.0, color: '#10B981' },
  { key: 'NUT', label: 'Alimentação',  score: 8.5, color: '#84CC16' },
  { key: 'HID', label: 'Hidratação',   score: 9.0, color: '#22D3EE' },
  { key: 'ERG', label: 'Postura',      score: 4.0, color: '#F59E0B' },
  { key: 'C',   label: 'Vida pessoal', score: 7.8, color: '#EC4899' },
  { key: 'N',   label: 'Sinais',       score: 8.2, color: '#6366F1' },
];
const MYID_AVG = (MYID_DIMS.reduce((s, d) => s + d.score, 0) / MYID_DIMS.length).toFixed(1);

// ── MyID 3D Rings visual ──────────────────────────────────────────────────────
function MyIDRingsVisual() {
  const gap = 13;
  const innerR = 22;
  const maxR = innerR + (MYID_DIMS.length - 1) * gap;
  const vb = maxR + 14;

  return (
    <>
      <style>{`
        .myid-3d { display: flex; justify-content: center; }
        @keyframes myidCenterPulse {
          0%,100% { opacity: 0.6; }
          50%     { opacity: 1; }
        }
        .myid-center-glow { animation: myidCenterPulse 3s ease-in-out infinite; }
      `}</style>
      <div className="myid-3d">
        <svg
          viewBox={`-${vb} -${vb} ${vb * 2} ${vb * 2}`}
          width="300" height="300"
          style={{ overflow: 'visible' }}
          aria-label="MyID — identidade biopsicossocial"
        >
          <defs>
            <radialGradient id="myidGlowGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="#0891B2" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#0891B2" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Glow behind rings */}
          <circle cx="0" cy="0" r={maxR + 10} fill="url(#myidGlowGrad)" />

          {/* Concentric rings */}
          {MYID_DIMS.map((d, i) => {
            const r = innerR + i * gap;
            const c = 2 * Math.PI * r;
            const arc = (d.score / 10) * c;
            return (
              <g key={d.key}>
                {/* Track */}
                <circle cx="0" cy="0" r={r} fill="none"
                  stroke={d.color} strokeWidth="7" opacity="0.14" />
                {/* Score arc */}
                <circle cx="0" cy="0" r={r} fill="none"
                  stroke={d.color} strokeWidth="7"
                  strokeDasharray={`${arc.toFixed(2)} ${c.toFixed(2)}`}
                  strokeLinecap="round"
                  transform="rotate(-90)"
                />
                {/* Dimension label at score endpoint */}
                {(() => {
                  const angle = ((d.score / 10) * 360 - 90) * (Math.PI / 180);
                  const lx = (r + 11) * Math.cos(angle);
                  const ly = (r + 11) * Math.sin(angle);
                  if (d.score < 0.15 || d.score > 9.85) return null;
                  return (
                    <text x={lx} y={ly + 3} textAnchor="middle" fill={d.color}
                      fontSize="6.5" fontWeight="700" fontFamily="system-ui,sans-serif"
                      opacity="0.85">
                      {d.key}
                    </text>
                  );
                })()}
              </g>
            );
          })}

          {/* Center badge */}
          <circle cx="0" cy="0" r={innerR + 4} fill="#0891B2" opacity="0.15"
            className="myid-center-glow" />
          <circle cx="0" cy="0" r={innerR - 1} fill="#0891B2" />
          <text x="0" y="-4" textAnchor="middle" fill="white"
            fontSize="7" fontWeight="700" letterSpacing="0.1em"
            fontFamily="system-ui,sans-serif" opacity="0.8">
            MyID
          </text>
          <text x="0" y="8" textAnchor="middle" fill="white"
            fontSize="13" fontWeight="800"
            fontFamily="Georgia,'Times New Roman',serif">
            {MYID_AVG}
          </text>
        </svg>
      </div>
    </>
  );
}

// ── Sistema corporal → cor (paleta unificada landing + app) ───────────────────
const SISTEMA_COR: Record<string, string> = {
  musculoesqueletico: '#fb923c',
  nervoso:            '#818cf8',
  digestorio:         '#34d399',
  circulatorio:       '#ef4444',
  respiratorio:       '#ec4899',
  urinario:           '#60a5fa',
  endocrino:          '#fbbf24',
};

const SISTEMAS_LEGENDA = [
  { key: 'musculoesqueletico', label: 'Musculoesq.' },
  { key: 'nervoso',            label: 'Nervoso'     },
  { key: 'circulatorio',       label: 'Circulatório'},
  { key: 'digestorio',         label: 'Digestório'  },
];

// Demo: 4 sistemas diferentes para ilustrar a codificação por cor
const AVATAR_FINDINGS = [
  { cx: 72,  cy: 90,  sistema: 'musculoesqueletico', label: 'Ombro D.',  tipo: 'Tendinopatia', status: 'Ativo',     delay: '0s'   },
  { cx: 106, cy: 28,  sistema: 'nervoso',            label: 'Cabeça',    tipo: 'Enxaqueca',    status: 'Ativo',     delay: '0.6s' },
  { cx: 92,  cy: 118, sistema: 'circulatorio',       label: 'Tórax',     tipo: 'Palpitação',   status: 'Obs.',      delay: '1.1s' },
  { cx: 100, cy: 152, sistema: 'digestorio',         label: 'Abdômen',   tipo: 'Refluxo',      status: 'Resolvido', delay: '1.6s' },
];

function BodyAvatarVisual() {
  return (
    <>
      <style>{`
        @keyframes avPing {
          0%   { transform: scale(1); opacity: 0.7; }
          65%  { transform: scale(3.2); opacity: 0; }
          100% { transform: scale(1); opacity: 0; }
        }
        .av-ping {
          animation: avPing 2.6s ease-out infinite;
          transform-box: fill-box;
          transform-origin: center;
        }
      `}</style>
      <svg viewBox="0 0 200 330" width="155" height="255" fill="none" aria-label="Avatar Clínico">
        {/* ── Silhueta clean ── */}
        <circle cx="100" cy="32" r="24" stroke="currentColor" strokeWidth="1.8" opacity="0.20"
          fill="currentColor" fillOpacity="0.05" />
        <rect x="93" y="54" width="14" height="14" rx="4"
          fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeWidth="1.4" opacity="0.18" />
        <path d="M66 80 Q58 120 62 168 Q80 176 100 176 Q120 176 138 168 Q142 120 134 80 Q118 74 100 74 Q82 74 66 80 Z"
          stroke="currentColor" strokeWidth="1.8" opacity="0.20" fill="currentColor" fillOpacity="0.05" />
        <path d="M66 84 Q46 110 42 164" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.12" fill="none"/>
        <path d="M134 84 Q154 110 158 164" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.12" fill="none"/>
        <path d="M86 174 Q82 230 82 278 Q82 296 86 306" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity="0.12" fill="none"/>
        <path d="M114 174 Q118 230 118 278 Q118 296 114 306" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity="0.12" fill="none"/>

        {/* ── Dots por sistema ── */}
        {AVATAR_FINDINGS.map((d) => {
          const cor = SISTEMA_COR[d.sistema];
          return (
            <g key={d.label}>
              <circle cx={d.cx} cy={d.cy} r="6" fill={cor} className="av-ping"
                style={{ animationDelay: d.delay }} />
              <circle cx={d.cx} cy={d.cy} r="6" fill={cor} />
              <circle cx={d.cx} cy={d.cy} r="2.5" fill="white" opacity="0.65" />
            </g>
          );
        })}
      </svg>
    </>
  );
}

// ── Data ──────────────────────────────────────────────────────────────────────
const beneficiosPro = [
  { icon: Mic,           titulo: 'Avaliação por Voz com IA',            texto: 'Grave a consulta e a IA estrutura o SOAP, diagnóstico, achados clínicos e diretriz de tratamento — em segundos, sem digitar nada.' },
  { icon: ClipboardList, titulo: 'Diretriz de Tratamento por Fases',    texto: 'Plano em 4 fases — Alívio, Carga Progressiva, Retorno Funcional e Manutenção — gerado com base em evidências clínicas.' },
  { icon: ClipboardList, titulo: 'Prontuário Inteligente',              texto: 'SOAP, red flags, CIF, hipóteses diagnósticas e evolução do paciente — organizados, editáveis e sincronizados em tempo real.' },
  { icon: CalendarDays,  titulo: 'Agenda com Controle de Expediente',   texto: 'Confirmação de atendimentos, painel de fechamento de dia e registro de pacientes avulsos — tudo na mesma tela.' },
  { icon: Activity,      titulo: 'Avatar Clínico do Paciente',          texto: 'Mapa anatômico 3D atualizado automaticamente com os achados de cada avaliação. Evolução visual e rastreável sessão a sessão.' },
  { icon: MessageSquare, titulo: 'Proposta Comercial em PDF',           texto: 'Transforme a diretriz em uma proposta profissional para clínicas e convênios — gerada automaticamente com 1 clique.' },
];

const beneficiosPac = [
  { icon: LayoutDashboard, titulo: 'Portal do Paciente',               texto: 'Acesse avaliações, condutas, exercícios e mensagens do seu profissional em um portal seguro — no app ou no navegador.' },
  { icon: Activity,        titulo: 'Acompanhe Sua Evolução',           texto: 'Visualize sua progressão fase a fase, os objetivos de cada etapa e os critérios de alta — com linguagem que você entende.' },
  { icon: ShieldCheck,     titulo: 'Histórico Clínico Centralizado',   texto: 'Todas as suas avaliações e diretrizes armazenadas com segurança — para levar a qualquer consulta, a qualquer momento.' },
];

const planosProfissional = [
  {
    nome: 'Individual', preco: '149', periodo: 'por mês · 1 profissional', destaque: false,
    items: ['Avaliações ilimitadas por voz e texto', 'Diretrizes de tratamento com IA', 'Prontuário inteligente completo', 'Agenda com controle de expediente', 'Portal do paciente incluso', 'Até 100 pacientes ativos'],
  },
  {
    nome: 'Clínica', preco: '390', periodo: 'por mês · até 5 profissionais', destaque: true,
    items: ['Tudo do plano Individual', 'Múltiplos profissionais na equipe', 'Dashboard de gestão da clínica', 'Propostas comerciais em PDF', 'Pacientes ilimitados', 'Suporte prioritário'],
  },
  {
    nome: 'Enterprise', preco: null, periodo: 'Redes e grupos de saúde', destaque: false,
    items: ['Profissionais ilimitados', 'Integração com sistemas existentes', 'Treinamento e onboarding dedicado', 'SLA garantido e conta gerenciada', 'Contrato e preço personalizados', 'LGPD e segurança avançada'],
  },
];

const planosPaciente = [
  {
    nome: 'Básico',
    preco: 'Gratuito',
    subtitulo: 'ao ser cadastrado por um profissional',
    cor: 'emerald',
    items: [
      'Score MyID nas 11 dimensões biopsicossociais',
      'Portal de acompanhamento do tratamento',
      'Acesso à diretriz e exercícios prescritos',
      '1 insight automático por dimensão',
      'Histórico de avaliações e evolução',
    ],
    cta: 'Acessar portal',
    href: '/paciente/login',
  },
  {
    nome: 'MyID Premium',
    preco: 'Em breve',
    subtitulo: 'análise profunda personalizada por IA',
    cor: 'violet',
    items: [
      'Tudo do plano Básico',
      'Insights detalhados em todas as 11 dimensões',
      'Plano de ação personalizado por IA',
      'Recomendações para melhorar cada score',
      'Evolução e tendências ao longo do tempo',
      'Compartilhamento com equipe multidisciplinar ilimitado',
    ],
    cta: 'Entrar na lista de espera',
    href: '/paciente/login',
  },
];

const depoimentos = [
  { nome: 'Camila Martins',  cargo: 'Fisioterapeuta · Clínica CM Reabilitação', texto: 'A avaliação por voz mudou completamente minha rotina. Antes gastava 40 minutos documentando — agora levo 5. E a diretriz que a IA gera é clinicamente sólida.',       iniciais: 'CM', cor: 'bg-cyan-600' },
  { nome: 'Rafael Oliveira', cargo: 'Gestor · Espaço Saúde Integrada',          texto: 'Minha clínica tem 4 fisioterapeutas e o My Health ID centralizou tudo. Prontuário, agenda, evolução — sem planilha, sem papel. Os pacientes adoram o portal.',          iniciais: 'RO', cor: 'bg-emerald-600' },
  { nome: 'Fernanda Santos', cargo: 'Fisioterapeuta Ortopédica · Autônoma',     texto: 'O que me conquistou foi a diretriz por fases. Consigo mostrar ao paciente exatamente onde ele está e o que vem pela frente — isso aumentou muito a adesão ao tratamento.', iniciais: 'FS', cor: 'bg-violet-600' },
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LandingPublica() {
  const { user, authReady } = useAuth();
  const [_menuOpen, setMenuOpen] = useState(false);

  if (authReady && user) {
    if (user.user_metadata?.is_patient === true) return <Navigate to="/paciente/dashboard" replace />;
    return <Navigate to="/hoje" replace />;
  }

  return (
    <div className="min-h-dvh bg-background text-foreground overflow-x-clip">
      <Helmet>
        <title>My Health ID — Plataforma Clínica com IA para Profissionais de Saúde</title>
        <meta name="description" content="Plataforma de IA clínica com MyID biopsicossocial, avatar clínico e avaliação por voz. Para fisioterapeutas, médicos e clínicas. Teste grátis 14 dias." />
        <link rel="canonical" href="https://www.myhealthid.com.br/" />
        <meta property="og:title" content="My Health ID — IA Clínica" />
        <meta property="og:description" content="MyID, avatar clínico, avaliação por voz e prontuário inteligente — em uma única plataforma." />
        <meta property="og:url" content="https://www.myhealthid.com.br/" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2 shrink-0" onClick={() => setMenuOpen(false)}>
            <LogoIcon size={30} />
            <span className="font-semibold tracking-tight text-sm hidden sm:block">My Health ID</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#myid"          className="hover:text-foreground transition-colors">MyID</a>
            <a href="#avatar"        className="hover:text-foreground transition-colors">Avatar Clínico</a>
            <a href="#profissionais" className="hover:text-foreground transition-colors">Profissionais</a>
            <a href="#precos"        className="hover:text-foreground transition-colors">Planos</a>
          </nav>
          {/* Duas entradas claras e equilibradas: Cliente e Profissional. */}
          <div className="flex items-center gap-2">
            <Link to="/paciente/login"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/50 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
              Cliente
            </Link>
            <Link to="/profissional"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
              ⚕ Profissional
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="pointer-events-none absolute inset-0 -z-10" style={{
          background: 'radial-gradient(ellipse 70% 55% at 72% 35%, hsl(var(--primary) / 0.09), transparent 65%), radial-gradient(ellipse 50% 40% at 15% 80%, color-mix(in srgb, #059669 5%, transparent), transparent 55%)',
        }} />
        <div className="mx-auto max-w-6xl px-4 pt-12 sm:pt-16 pb-14 sm:pb-24">
          {/* A página começa com a marca */}
          <div className="mb-12 flex justify-center">
            <img src={logoBranco} alt="My Health ID — Sua saúde, sua identidade." className="w-full max-w-sm sm:max-w-md h-auto" loading="eager" />
          </div>
          <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Plataforma de IA Clínica
              </div>
              <h1 className="text-4xl font-bold leading-[1.07] tracking-tight text-balance sm:text-5xl lg:text-[3.4rem]">
                A clínica mais inteligente começa com uma{' '}
                <span className="text-primary">avaliação</span>.
              </h1>
              <p className="mt-5 text-base leading-relaxed text-muted-foreground sm:text-lg max-w-[44ch]">
                IA que transforma a voz do profissional em prontuário completo, diretriz de tratamento por fases e acompanhamento do paciente — tudo em uma plataforma.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link to="/auth?modo=cadastro"
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
                  Começar como profissional <ArrowRight className="h-4 w-4" />
                </Link>
                <Link to="/paciente/login"
                  className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 px-5 py-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors">
                  Sou cliente
                </Link>
              </div>
              <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> 14 dias grátis</span>
                <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito</span>
                <span className="inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5 text-primary" /> LGPD compliant</span>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-2.5">
                <span className="text-xs text-muted-foreground">Disponível em:</span>
                <a href="#app" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 transition-colors">🍎 App Store</a>
                <a href="#app" className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:border-primary/40 transition-colors">▶ Google Play</a>
              </div>
            </div>

            {/* App mockup */}
            <div className="rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-border/50 bg-muted/50 px-4 py-2.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <div className="ml-2 flex-1 h-4 rounded bg-border/60 opacity-50" />
              </div>
              <div className="p-4 flex flex-col gap-3">
                <div className="rounded-xl border border-border/50 bg-background p-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">Ana Costa · Fisioterapia</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Sessão 7 de 12 · Avaliação hoje</div>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">IA ativa</span>
                  </div>
                  <div className="mt-2.5 h-1.5 rounded-full bg-border overflow-hidden">
                    <div className="h-full w-[78%] rounded-full bg-primary" />
                  </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-background p-3.5">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Diretriz de Tratamento</span>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Confirmada</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { label: 'Fase 1\nAlívio',   cls: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400' },
                      { label: 'Fase 2\nCarga',    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' },
                      { label: 'Fase 3\nRetorno',  cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' },
                      { label: 'Manutenção',       cls: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400' },
                    ].map(({ label, cls }) => (
                      <div key={label} className={`rounded-lg p-1.5 text-center text-[9px] font-bold leading-tight whitespace-pre-line ${cls}`}>{label}</div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border/50 bg-background p-3.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Agenda · Hoje</div>
                  <div className="flex flex-col gap-1.5">
                    {[
                      { hora: '09:00', nome: 'João Mendes', status: '✓ Atendido',    cls: 'text-emerald-600 dark:text-emerald-400' },
                      { hora: '10:30', nome: 'Carla Lima',  status: '● Em andamento', cls: 'text-primary' },
                      { hora: '14:00', nome: 'Pedro Souza', status: 'Confirmado',     cls: 'text-muted-foreground opacity-60' },
                    ].map(({ hora, nome, status, cls }) => (
                      <div key={hora} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{hora} · {nome}</span>
                        <span className={`text-[10px] font-semibold ${cls}`}>{status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <div className="border-b border-border/40 bg-muted/30">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-10 sm:grid-cols-4">
          {[
            { num: '+1.200', label: 'Profissionais ativos' },
            { num: '+18.000', label: 'Avaliações geradas com IA' },
            { num: '+340', label: 'Clínicas parceiras' },
            { num: '98%', label: 'Satisfação dos profissionais' },
          ].map(({ num, label }) => (
            <div key={label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-primary sm:text-4xl">{num}</div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          SEÇÃO 1 — MyID: A Impressão Digital da Saúde
      ══════════════════════════════════════════════════════════ */}
      <section id="myid" className="bg-card border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="grid grid-cols-1 gap-14 items-center lg:grid-cols-2">

            {/* 3D rings visualization */}
            <div className="flex flex-col items-center gap-6 order-2 lg:order-1">
              <MyIDRingsVisual />

              {/* Dimension legend */}
              <div className="grid grid-cols-3 gap-x-5 gap-y-2 sm:grid-cols-4">
                {MYID_DIMS.map((d) => (
                  <div key={d.key} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} />
                    <span className="text-[10px] text-muted-foreground font-medium">{d.label}</span>
                    <span className="text-[10px] font-bold ml-auto" style={{ color: d.color }}>{d.score}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground text-center max-w-[28ch]">
                Valores de demonstração. Cada paciente tem o seu próprio MyID.
              </p>
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2">
              <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">MyID — Identidade Biopsicossocial</div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.6rem] leading-tight text-balance">
                Única como uma<br />impressão digital.
              </h2>
              <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-[46ch]">
                O MyID é a personificação da saúde do seu paciente. Assim como uma impressão digital, ele é irrepetível — um mapa biopsicossocial com <strong className="text-foreground font-semibold">11 dimensões</strong> que vai da dor à vida pessoal, do sono à alimentação.
              </p>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-[46ch]">
                A cada avaliação, o MyID evolui. O profissional vê com precisão onde intervir. O paciente vê sua saúde melhorar — em números, em cores, em tempo real.
              </p>

              <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { icon: '🧬', titulo: '11 dimensões',        desc: 'Da dor à vida pessoal, sono, alimentação e sinais do corpo.' },
                  { icon: '📈', titulo: 'Evolução contínua',   desc: 'O score muda a cada sessão e reflete o progresso real.' },
                  { icon: '🔗', titulo: 'Interdisciplinar',    desc: 'Qualquer profissional de saúde entende o MyID do paciente.' },
                  { icon: '🛡', titulo: 'Privado e seguro',    desc: 'Cada MyID pertence somente ao seu paciente — LGPD by design.' },
                ].map(({ icon, titulo, desc }) => (
                  <div key={titulo} className="flex gap-3 rounded-xl border border-border/40 bg-background p-3.5">
                    <span className="text-xl leading-none shrink-0">{icon}</span>
                    <div>
                      <div className="text-xs font-bold mb-0.5">{titulo}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <Link to="/auth?modo=cadastro"
                className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
                Experimentar o MyID <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features: Profissionais ── */}
      <section id="profissionais" className="bg-background border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="mb-12">
            <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Para Fisioterapeutas, Médicos e Clínicas</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Tudo que você precisa para<br className="hidden sm:block" /> clinicar com mais inteligência</h2>
            <p className="mt-3 text-muted-foreground max-w-[52ch] text-base leading-relaxed">Avaliação por IA, prontuário integrado, diretrizes baseadas em evidências e controle de agenda — tudo em um lugar.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {beneficiosPro.map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="rounded-2xl border border-border/40 bg-card p-5 shadow-xs transition-all hover:border-primary/30 hover:shadow-md">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold mb-1.5">{titulo}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          SEÇÃO 2 — Avatar Clínico: A Memória do Corpo
      ══════════════════════════════════════════════════════════ */}
      <section id="avatar" className="bg-card border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="grid grid-cols-1 gap-14 items-center lg:grid-cols-2">

            {/* Text */}
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">Avatar Clínico</div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-[2.6rem] leading-tight text-balance">
                A memória do corpo<br />do seu paciente.
              </h2>
              <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-[46ch]">
                O Avatar Clínico guarda o histórico completo — região por região, avaliação por avaliação. Cada achado fica registrado no mapa anatômico e evolui com o tratamento.
              </p>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-[46ch]">
                Isso transforma o cuidado <strong className="text-foreground font-semibold">verdadeiramente individual</strong> em interdisciplinar: o resultado de um profissional pode ser levado a qualquer outro agente da saúde, sem perder contexto.
              </p>

              <div className="mt-8 flex flex-col gap-3">
                {[
                  { cor: 'bg-red-500',    titulo: 'Achados ativos',          desc: 'Queixas e diagnósticos em tratamento, visíveis no mapa anatômico.' },
                  { cor: 'bg-emerald-500', titulo: 'Regiões recuperadas',    desc: 'Histórico de áreas que melhoraram — evidência do progresso real.' },
                  { cor: 'bg-amber-500',  titulo: 'Em observação',           desc: 'Sinais que precisam de atenção, sem diagnóstico definitivo ainda.' },
                  { cor: 'bg-violet-500', titulo: 'Compartilhamento seguro', desc: 'O avatar pode ser levado a médicos, psicólogos, nutricionistas — qualquer especialidade.' },
                ].map(({ cor, titulo, desc }) => (
                  <div key={titulo} className="flex items-start gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full mt-1.5 shrink-0 ${cor}`} />
                    <div>
                      <span className="text-sm font-semibold">{titulo}</span>
                      <span className="text-sm text-muted-foreground"> — {desc}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Link to="/auth?modo=cadastro"
                className="mt-8 inline-flex items-center gap-2 rounded-lg border border-primary text-primary px-5 py-2.5 text-sm font-semibold hover:bg-primary/8 transition-colors">
                Ver o Avatar Clínico <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            {/* Body Avatar visual + finding cards */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-start gap-5">
                {/* Body silhouette */}
                <div className="text-foreground shrink-0">
                  <BodyAvatarVisual />
                </div>

                {/* Finding cards — cor do sistema no label e na borda */}
                <div className="flex flex-col gap-2.5 pt-4 w-[170px]">
                  {AVATAR_FINDINGS.map(({ sistema, label, tipo, status }) => {
                    const cor = SISTEMA_COR[sistema];
                    const badgeCls = status === 'Resolvido'
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                      : status === 'Obs.'
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                      : 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300';
                    return (
                      <div key={label}
                        className="rounded-xl border bg-card px-3 py-2.5 shadow-sm"
                        style={{ borderColor: `${cor}35` }}>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-[12px] font-bold" style={{ color: cor }}>{label}</span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${badgeCls}`}>{status}</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">{tipo}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legenda de sistemas */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
                {SISTEMAS_LEGENDA.map(({ key, label }) => (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: SISTEMA_COR[key] }} />
                    <span className="text-[10px] text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-muted-foreground text-center max-w-[34ch]">
                O avatar é atualizado automaticamente a cada avaliação por voz ou presencial.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features: Pacientes ── */}
      <section id="pacientes" className="bg-background border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="mb-12">
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">Para Pacientes</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Seu histórico de saúde,<br className="hidden sm:block" /> sempre com você</h2>
            <p className="mt-3 text-muted-foreground max-w-[52ch] text-base leading-relaxed">O My Health ID dá ao paciente visibilidade real sobre seu tratamento, progresso e próximos passos — diretamente no celular.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {beneficiosPac.map(({ icon: Icon, titulo, texto }) => (
              <div key={titulo} className="rounded-2xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-bold mb-1.5">{titulo}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{texto}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-500/25 bg-emerald-50/60 dark:bg-emerald-950/20 p-5 sm:p-6">
            <div>
              <p className="font-semibold text-sm sm:text-base">Você é paciente e quer acessar seu histórico?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Acesse o portal com o código que seu profissional enviou, ou baixe o app.</p>
            </div>
            <Link to="/paciente/login"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors shrink-0">
              Acessar meu histórico <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Planos do Paciente ── */}
      <section className="bg-card border-b border-border/40">
        <div className="mx-auto max-w-5xl px-4 py-16 sm:py-24">
          <div className="mb-12 text-center">
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-2">Planos para Pacientes</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Cuide da sua saúde com<br className="hidden sm:block" /> mais profundidade</h2>
            <p className="mt-3 text-muted-foreground max-w-[46ch] mx-auto">Do acesso básico ao acompanhamento profundo com IA — escolha o que faz sentido para o seu momento.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 max-w-2xl mx-auto">
            {planosPaciente.map((plano) => (
              <div key={plano.nome}
                className={`relative rounded-2xl border p-6 ${plano.cor === 'violet' ? 'border-violet-400/40 bg-violet-50/60 dark:bg-violet-950/20' : 'border-emerald-400/40 bg-emerald-50/60 dark:bg-emerald-950/20'}`}>
                {plano.cor === 'violet' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white whitespace-nowrap">
                    Mais completo
                  </div>
                )}
                <div className={`text-xs font-bold uppercase tracking-wider mb-2 ${plano.cor === 'violet' ? 'text-violet-600 dark:text-violet-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                  {plano.nome}
                </div>
                <div className={`text-3xl font-bold tracking-tight ${plano.cor === 'violet' ? 'text-violet-700 dark:text-violet-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                  {plano.preco}
                </div>
                <div className="text-xs text-muted-foreground mt-1 mb-5">{plano.subtitulo}</div>
                <ul className="flex flex-col gap-2 mb-6">
                  {plano.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className={`h-4 w-4 shrink-0 mt-0.5 ${plano.cor === 'violet' ? 'text-violet-500' : 'text-emerald-500'}`} />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link to={plano.href}
                  className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${plano.cor === 'violet' ? 'bg-violet-600 text-white hover:bg-violet-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                  {plano.cta} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section className="bg-background border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="mb-12">
            <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Como Funciona</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">De avaliação a diretriz<br className="hidden sm:block" /> em menos de 5 minutos</h2>
          </div>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              { n: '1', titulo: 'Grave ou descreva o caso', texto: 'Fale livremente sobre o paciente — queixa, histórico, exame físico. A IA interpreta a linguagem clínica e estrutura tudo automaticamente.' },
              { n: '2', titulo: 'Revise e confirme a diretriz', texto: 'A IA apresenta o plano por fases com objetivos, técnicas e critérios de progressão. Edite se quiser e confirme com 1 clique para o prontuário.' },
              { n: '3', titulo: 'Acompanhe a evolução', texto: 'Monitore o progresso, controle sessões, atualize o avatar clínico e mantenha o paciente informado — tudo conectado, sessão a sessão.' },
            ].map(({ n, titulo, texto }) => (
              <div key={n} className="flex gap-5 group">
                <div className="text-4xl font-bold text-border group-hover:text-primary transition-colors leading-none shrink-0 w-10"
                  style={{ fontFamily: "Georgia,'Times New Roman',serif" }}>{n}</div>
                <div>
                  <h3 className="font-bold mb-2">{titulo}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── App section ── */}
      <section id="app" className="bg-primary text-primary-foreground border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="grid grid-cols-1 gap-12 items-center lg:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-3">App Nativo</div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl leading-tight">Disponível no iOS<br />e Android</h2>
              <p className="mt-4 opacity-75 leading-relaxed max-w-[42ch]">O My Health ID funciona no navegador e também como app nativo — com a mesma experiência completa.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                {[{ icon: '🍎', label: 'Baixar na', name: 'App Store' }, { icon: '▶', label: 'Disponível no', name: 'Google Play' }].map(({ icon, label, name }) => (
                  <a key={name} href="#"
                    className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 hover:bg-white/20 transition-colors">
                    <span className="text-2xl leading-none">{icon}</span>
                    <span>
                      <span className="block text-[10px] opacity-65 uppercase tracking-wider">{label}</span>
                      <span className="block text-sm font-bold">{name}</span>
                    </span>
                  </a>
                ))}
              </div>
              <p className="mt-4 text-xs opacity-40">Em breve nas lojas · Use o site agora mesmo</p>
            </div>
            <div className="flex justify-center lg:justify-end">
              <div className="w-52 rounded-[28px] border-4 border-white/15 bg-card shadow-2xl overflow-hidden">
                <div className="flex h-6 items-center justify-center bg-muted/50">
                  <div className="h-2.5 w-14 rounded-full bg-border/60" />
                </div>
                <div className="bg-background p-3 flex flex-col gap-2.5">
                  <div className="flex justify-between items-center border-b border-border/50 pb-2 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span>Minha Saúde</span>
                    <span className="text-emerald-500">● Ativo</span>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card p-2.5">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Tratamento atual</div>
                    <div className="text-xs font-semibold">Fisioterapia Ortopédica</div>
                    <div className="mt-1 inline-block rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[8px] font-bold text-emerald-600 dark:text-emerald-400">Fase 2 — Carga</div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                        <div className="h-full w-1/2 rounded-full bg-emerald-500" />
                      </div>
                      <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">6/12</span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-card p-2.5">
                    <div className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground mb-1">MyID Score</div>
                    <div className="text-lg font-bold text-primary">{MYID_AVG} <span className="text-xs font-normal text-muted-foreground">/ 10</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-border overflow-hidden">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${(parseFloat(MYID_AVG) / 10) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing (profissionais) ── */}
      <section id="precos" className="bg-background border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="mb-12 text-center">
            <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Planos Profissionais</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Escolha o plano ideal<br className="hidden sm:block" /> para sua prática</h2>
            <p className="mt-3 text-muted-foreground">Comece grátis por 14 dias. Sem cartão de crédito.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 items-start">
            {planosProfissional.map((plano) => (
              <div key={plano.nome}
                className={`relative rounded-2xl border p-7 shadow-xs ${plano.destaque ? 'border-primary shadow-md ring-2 ring-primary/20' : 'border-border/50 bg-card'}`}>
                {plano.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground whitespace-nowrap">
                    Mais popular
                  </div>
                )}
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{plano.nome}</div>
                {plano.preco ? (
                  <>
                    <div className="text-4xl font-bold tracking-tight">
                      <sup className="text-xl align-super mr-0.5">R$</sup>{plano.preco}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{plano.periodo}</div>
                  </>
                ) : (
                  <>
                    <div className="text-2xl font-bold">Sob consulta</div>
                    <div className="text-xs text-muted-foreground mt-1">{plano.periodo}</div>
                  </>
                )}
                <hr className="my-5 border-border/50" />
                <ul className="flex flex-col gap-2.5">
                  {plano.items.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />{item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {plano.nome === 'Enterprise' ? (
                    <a href="mailto:contato@myhealthid.com.br"
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors">
                      Falar com a equipe
                    </a>
                  ) : (
                    <Link to="/auth?modo=cadastro"
                      className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${plano.destaque ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90' : 'border border-primary text-primary hover:bg-primary/8'}`}>
                      Começar grátis
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Depoimentos ── */}
      <section id="depoimentos" className="bg-card border-b border-border/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
          <div className="mb-12 text-center">
            <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Depoimentos</div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">O que dizem os profissionais<br className="hidden sm:block" /> que já usam o My Health ID</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {depoimentos.map(({ nome, cargo, texto, iniciais, cor }) => (
              <figure key={nome} className="rounded-2xl border border-border/40 bg-background p-6 shadow-xs flex flex-col">
                <div className="text-amber-400 text-sm mb-3">★★★★★</div>
                <blockquote className="text-sm leading-relaxed text-foreground/90 italic flex-1">"{texto}"</blockquote>
                <figcaption className="flex items-center gap-3 border-t border-border/40 pt-4 mt-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full text-white text-xs font-bold shrink-0 ${cor}`}>{iniciais}</div>
                  <div>
                    <div className="text-sm font-semibold">{nome}</div>
                    <div className="text-xs text-muted-foreground">{cargo}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── Segurança ── */}
      <section className="border-b border-border/40 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-20">
          <div className="grid grid-cols-1 gap-10 items-center md:grid-cols-2">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-primary mb-2">Segurança & Conformidade</div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Dados clínicos protegidos por design.</h2>
              <p className="mt-3 text-muted-foreground">Construído sobre infraestrutura cloud com Row-Level Security no banco, consentimentos LGPD versionados e isolamento total entre profissionais.</p>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                { icon: ShieldCheck, label: 'LGPD compliant',  sub: 'Termos versionados' },
                { icon: Lock,        label: 'RLS no banco',    sub: 'Isolamento por usuário' },
                { icon: ShieldCheck, label: 'Backups diários', sub: 'Cloud gerenciada' },
                { icon: Lock,        label: 'Lente travada',   sub: 'Sem acesso cross-profissional' },
              ].map(({ icon: Icon, label, sub }) => (
                <li key={label} className="flex items-start gap-3 rounded-xl border border-border/40 bg-card p-4 shadow-xs">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{label}</div>
                    <div className="text-xs text-muted-foreground">{sub}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── CTA Final — Dual ── */}
      <section className="bg-gradient-to-br from-primary via-primary to-primary/80">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 text-center text-primary-foreground">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance leading-tight">
            Pronto para transformar<br className="hidden sm:block" /> sua prática clínica?
          </h2>
          <p className="mt-4 opacity-75 max-w-[44ch] mx-auto leading-relaxed">
            Junte-se a mais de 1.200 profissionais que já avaliam, documentam e acompanham seus pacientes com inteligência artificial.
          </p>
          <div className="mt-10 mx-auto max-w-xl grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-left">
              <div className="text-base font-bold mb-2">⚕ Sou Profissional de Saúde</div>
              <p className="text-sm opacity-70 mb-5 leading-relaxed">Quero automatizar avaliações, gerar diretrizes com IA e controlar minha agenda.</p>
              <Link to="/auth?modo=cadastro"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-primary hover:bg-white/90 transition-colors">
                Acessar plataforma <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-6 text-left">
              <div className="text-base font-bold mb-2">● Sou Paciente</div>
              <p className="text-sm opacity-70 mb-5 leading-relaxed">Quero acompanhar meu tratamento e acessar meu histórico clínico com segurança.</p>
              <Link to="/paciente/login"
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition-colors">
                Acessar meu portal <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <p className="mt-6 text-xs opacity-40">14 dias grátis para profissionais · Sem cartão · Cancele quando quiser</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/40 bg-background">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <LogoIcon size={20} />
            <span>© {new Date().getFullYear()} My Health ID · LGPD compliant</span>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-center">
            <a href="#" className="hover:text-foreground">Termos de uso</a>
            <a href="#" className="hover:text-foreground">Privacidade</a>
            <Link to="/auth" className="hover:text-foreground">Profissional</Link>
            <Link to="/paciente/login" className="hover:text-foreground">Paciente</Link>
            <a href="mailto:contato@myhealthid.com.br" className="hover:text-foreground">Contato</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
