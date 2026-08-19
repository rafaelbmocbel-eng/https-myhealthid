import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { Fingerprint, Activity, Users } from 'lucide-react';
import logoMark from '@/assets/logo-myhealthid-mark.png';
import logoBranco from '@/assets/logo-myhealthid-branco.png';
import MyIDFingerprint from '@/components/myid/MyIDFingerprint';
import AvatarClinicoShowcase from '@/components/landing/AvatarClinicoShowcase';
import { DEMO_RINGS, DEMO_MYID } from './landingDemo';

// Home pública FOCADA NO CLIENTE (B2C), fundo claro. O profissional tem o site
// próprio em /profissional. Conceito: a impressão digital = "sua identidade
// clínica" (MyID). Mostra o gráfico do MyID e o Avatar Clínico de verdade.

const CSS = `
.clh{
  --navy:#0B1F33;
  --cyan:#0E9BBD; --cyan-soft:#E6F7FB;
  --emerald:#10B981; --emerald-deep:#0B8F63;
  --bg:#F7FAFB; --surface:#FFFFFF; --surface-2:#EDF3F5;
  --ink:#0E1B26; --muted:#57697A; --line:#E2EAEE;
  --shadow:0 20px 44px -28px rgba(11,31,51,.28);
  /* Mesma tipografia da página do profissional (Inter) — capricho consistente */
  --display:'Inter',system-ui,sans-serif;
  --body:'Inter',system-ui,sans-serif;
  --mono:'Inter',system-ui,sans-serif;
  background:var(--bg); color:var(--ink); font-family:var(--body);
  line-height:1.6; font-size:17px; -webkit-font-smoothing:antialiased;
}
.clh *{box-sizing:border-box}
/* Segurança responsiva: deixa filhos de grid/flex encolherem e nada estoura a largura */
.clh img,.clh svg{max-width:100%}
.clh .hero-grid>*,.clh .avatar-grid>*,.clh .tiers>*,.clh .steps>*,.clh .dim-group>*,.clh .connect>*,.clh .pro-band>*{min-width:0}
.clh h1,.clh h2,.clh h3,.clh h4{font-family:var(--display); font-weight:700; line-height:1.06; text-wrap:balance; margin:0; color:var(--navy)}
.clh p{margin:0}
.clh a{color:inherit; text-decoration:none}
.clh .wrap{max-width:1120px; margin-inline:auto; padding-inline:22px}
.clh .eyebrow{font-family:var(--body); font-weight:700; font-size:12px; letter-spacing:.14em; text-transform:uppercase; color:var(--cyan)}

.clh header{position:sticky; top:0; z-index:20; background:color-mix(in srgb,var(--bg) 88%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line)}
.clh .nav{display:flex; align-items:center; gap:20px; height:64px}
.clh .brand{display:flex; align-items:center; gap:10px; font-family:var(--display); font-weight:800; font-size:18px; letter-spacing:-.01em; color:var(--navy)}
.clh .brand .mark{width:30px; height:30px; flex:none; object-fit:contain}
.clh .nav .links{display:flex; gap:22px; margin-left:14px; font-size:14.5px; color:var(--muted); font-weight:500}
.clh .nav .links a:hover{color:var(--ink)}
.clh .nav .right{margin-left:auto; display:flex; align-items:center; gap:14px}
.clh .pro-link{font-size:13.5px; color:var(--muted); font-weight:500; display:inline-flex; align-items:center; gap:5px}
.clh .pro-link:hover{color:var(--cyan)}
.clh .btn{display:inline-flex; align-items:center; gap:8px; border-radius:11px; font-weight:600; font-size:15px; padding:11px 18px; cursor:pointer; border:1px solid transparent; transition:transform .12s ease, box-shadow .2s ease, background .2s}
.clh .btn:active{transform:translateY(1px)}
.clh .btn-emerald{background:var(--emerald); color:#fff; box-shadow:0 12px 26px -12px var(--emerald)}
.clh .btn-emerald:hover{background:var(--emerald-deep)}
.clh .btn-ghost{background:transparent; border-color:var(--line); color:var(--ink)}
.clh .btn-ghost:hover{border-color:var(--muted)}
.clh .btn-sm{padding:8px 14px; font-size:14px; border-radius:10px}

.clh .hero{position:relative; overflow:hidden; border-bottom:1px solid var(--line); background:
  radial-gradient(120% 90% at 50% 0%, var(--cyan-soft) 0%, transparent 55%),
  linear-gradient(180deg, #FFFFFF 0%, var(--bg) 100%)}
.clh .hero-center{display:flex; flex-direction:column; align-items:center; text-align:center; gap:26px; padding:44px 0 60px}
.clh .hero-logo{width:100%; max-width:360px; height:auto}
.clh .hero-copy{max-width:640px; display:flex; flex-direction:column; align-items:center}
.clh .hero h1{font-size:clamp(34px,5.4vw,56px); font-weight:700; letter-spacing:-.02em; margin:14px 0 0}
.clh .hero h1 .glow{color:var(--cyan)}
.clh .hero .lede{color:var(--muted); font-size:clamp(16px,2vw,19px); max-width:52ch; margin-top:18px}
.clh .cta-row{display:flex; flex-wrap:wrap; gap:12px; margin-top:28px; justify-content:center}
.clh .trust{display:flex; align-items:center; gap:10px; margin-top:18px; color:var(--muted); font-size:13.5px; font-family:var(--mono)}
.clh .dot{width:6px; height:6px; border-radius:50%; background:var(--emerald)}
.clh .hero-center .myid-card{width:100%; max-width:440px}

/* Cartão do gráfico MyID */
.clh .myid-card{background:var(--surface); border:1px solid var(--line); border-radius:22px; box-shadow:var(--shadow); padding:20px 16px 10px; position:relative}
.clh .myid-card .cap{display:flex; align-items:center; justify-content:space-between; padding:0 6px 6px}
.clh .myid-card .cap .t{font-family:var(--mono); font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted)}
.clh .myid-card .cap .pill{font-family:var(--mono); font-size:11px; font-weight:600; color:var(--cyan); background:var(--cyan-soft); border-radius:999px; padding:3px 9px}
.clh .myid-card .fp-wrap{max-width:420px; margin-inline:auto}

.clh section{padding:70px 0}
.clh .sec-head{max-width:56ch}
.clh .sec-head h2{font-size:clamp(26px,3.6vw,38px); letter-spacing:-.02em; margin-top:12px}
.clh .sec-head p{color:var(--muted); margin-top:12px; font-size:17px}

.clh .steps{display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:40px; counter-reset:s}
.clh .step{background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:24px; box-shadow:var(--shadow); transition:border-color .2s, box-shadow .2s}
.clh .step:hover{border-color:color-mix(in srgb,var(--cyan) 35%, transparent)}
.clh .step-ic{width:44px; height:44px; border-radius:12px; background:var(--cyan-soft); color:var(--cyan); display:grid; place-items:center}
.clh .step h3{font-size:19px; margin:14px 0 8px; letter-spacing:-.01em}
.clh .step p{color:var(--muted); font-size:15px}

.clh .dims{background:var(--surface-2); border-block:1px solid var(--line)}
.clh .dim-group{display:grid; grid-template-columns:1fr 1fr; gap:28px; margin-top:32px}
.clh .col-tag{font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; font-weight:600}
.clh .dim-grid{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:14px}
.clh .dim{border:1px solid var(--line); border-radius:14px; padding:16px; background:var(--surface)}
.clh .dim h3{font-size:15px; letter-spacing:-.01em}
.clh .dim p{color:var(--muted); font-size:12.5px; margin-top:4px}

/* Avatar */
.clh .avatar-grid{display:grid; grid-template-columns:1.15fr .85fr; gap:40px; align-items:center; margin-top:8px}
.clh .avatar-stage{background:linear-gradient(180deg,#fff,var(--surface-2)); border:1px solid var(--line); border-radius:22px; box-shadow:var(--shadow); padding:22px; min-width:0; overflow:hidden}

.clh .tiers{display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:42px}
.clh .tier{border:1px solid var(--line); border-radius:16px; padding:28px; background:var(--surface); display:flex; flex-direction:column; box-shadow:var(--shadow)}
.clh .tier.feature{border-color:var(--cyan); box-shadow:0 20px 44px -24px rgba(14,155,189,.4)}
.clh .tier .kicker{font-family:var(--mono); font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted)}
.clh .tier.feature .kicker{color:var(--cyan)}
.clh .tier .price{font-family:var(--display); font-weight:700; font-size:30px; margin:8px 0 2px; letter-spacing:-.02em; color:var(--navy)}
.clh .tier ul{list-style:none; padding:0; margin:18px 0 24px; display:flex; flex-direction:column; gap:11px; font-size:15px}
.clh .tier li{display:flex; gap:10px; align-items:flex-start}
.clh .tier li svg{flex:none; margin-top:3px}
.clh .tier .note{font-size:12.5px; color:var(--muted); margin-top:auto}
.clh .tier .btn{width:100%; justify-content:center}
.clh .badge{position:absolute; top:18px; right:18px; font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:#fff; background:var(--cyan); padding:4px 9px; border-radius:999px; font-weight:600}

.clh .connect{background:var(--surface); border:1px solid var(--line); border-radius:20px; padding:34px; display:flex; align-items:center; gap:26px; flex-wrap:wrap; box-shadow:var(--shadow)}
.clh .connect .txt{flex:1; min-width:260px}
.clh .connect h3{font-size:23px; letter-spacing:-.01em}
.clh .connect p{color:var(--muted); margin-top:8px}

.clh .pro-band{border-top:1px solid var(--line); background:var(--surface-2)}
.clh .pro-band .inner{display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:26px 0}
.clh .pro-band .k{font-family:var(--mono); font-size:11.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--cyan)}
.clh .pro-band h3{font-size:19px; letter-spacing:-.01em}
.clh .pro-band p{color:var(--muted); font-size:14.5px; margin-top:2px}
.clh .pro-band .go{margin-left:auto}

.clh footer{background:var(--surface); border-top:1px solid var(--line)}
.clh .foot{display:flex; justify-content:space-between; gap:30px; flex-wrap:wrap; padding:44px 0 30px}
.clh .foot a{color:var(--muted); font-size:14px; display:block; margin-top:9px}
.clh .foot a:hover{color:var(--cyan)}
.clh .foot h4{font-family:var(--mono); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); margin:0 0 4px}
.clh .foot .col{min-width:150px}
.clh .legal{border-top:1px solid var(--line); padding:16px 0; font-size:12.5px; color:var(--muted); display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap; font-family:var(--mono)}

@media (max-width:860px){
  .clh .hero-center{gap:22px; padding:32px 0 48px}
  .clh .hero-logo{max-width:280px}
  .clh .steps{grid-template-columns:1fr}
  .clh .dim-group{grid-template-columns:1fr; gap:22px}
  .clh .dim-grid{grid-template-columns:1fr 1fr}
  .clh .avatar-grid{grid-template-columns:1fr; gap:24px}
  .clh .tiers{grid-template-columns:1fr}
  .clh .nav .links{display:none}
  .clh .pro-band .go{margin-left:0; width:100%}
}
@media (prefers-reduced-motion:reduce){.clh *{animation:none!important}}
`;

const Check = ({ c }: { c: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12.5l4 4 10-10" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// As dimensões REAIS do MyID (rótulos exatos do app — MyIDFingerprint).
// Anéis internos = SUSTENTO (o que te sustenta) · Anéis externos = PRESSÃO.
// São 11 dimensões; a Medicação (MED) é um valor EXTRA que ajusta o cálculo.
const SUSTENTO = [
  ['Sono e energia', 'Como você descansa e se recupera.'],
  ['Vida pessoal', 'Trabalho, família e finanças.'],
  ['Movimento', 'Seu nível de atividade física.'],
  ['Hidratação', 'Como seu corpo está hidratado.'],
  ['Alimentação', 'A qualidade da sua nutrição.'],
  ['Postura no dia', 'Ergonomia e hábitos posturais.'],
];
const PRESSAO = [
  ['Dor', 'Intensidade, tipo e regiões afetadas.'],
  ['Suas atividades do dia', 'O que a dor te impede de fazer.'],
  ['Cabeça e emoções', 'Medo de movimento, estresse, expectativa.'],
  ['Mudanças recentes', 'Gatilhos que antecederam o quadro.'],
  ['Sinais do corpo', 'Sinais sistêmicos e histórico relevante.'],
];

export default function LandingPublica() {
  const { user, authReady } = useAuth();

  if (authReady && user) {
    if (user.user_metadata?.is_patient === true) return <Navigate to="/paciente/dashboard" replace />;
    return <Navigate to="/hoje" replace />;
  }

  return (
    <div className="clh">
      <Helmet>
        <title>My Health ID — Sua saúde, sua identidade</title>
        <meta name="description" content="Faça seu MyID grátis: entenda o que está por trás da sua dor em 11 dimensões, veja seu Avatar Clínico, receba dicas personalizadas e encontre o profissional certo." />
      </Helmet>
      <style>{CSS}</style>

      <header>
        <div className="wrap nav">
          <a className="brand" href="/">
            <img className="mark" src={logoMark} alt="" aria-hidden="true" />
            My Health ID
          </a>
          <nav className="links">
            <a href="#como">Como funciona</a>
            <a href="#dims">O MyID</a>
            <a href="#avatar">Avatar Clínico</a>
            <a href="#planos">Planos</a>
          </nav>
          <div className="right">
            <Link className="pro-link" to="/profissional">Sou profissional <span aria-hidden="true">→</span></Link>
            <Link className="btn btn-ghost btn-sm" to="/paciente/login">Entrar</Link>
          </div>
        </div>
      </header>

      <div className="hero">
        <div className="wrap hero-center">
          {/* A página começa com a marca */}
          <img className="hero-logo" src={logoBranco} alt="My Health ID — Sua saúde, sua identidade." loading="eager" />

          {/* Logo depois, os círculos do MyID */}
          <div className="myid-card">
            <div className="cap">
              <span className="t">Seu retrato MyID</span>
              <span className="pill">exemplo</span>
            </div>
            <div className="fp-wrap">
              <MyIDFingerprint rings={DEMO_RINGS} myidScore={DEMO_MYID} />
            </div>
          </div>

          <div className="hero-copy">
            <div className="eyebrow">MyID · sua identidade clínica</div>
            <h1>Descubra o que está por trás da <span className="glow">sua dor</span>.</h1>
            <p className="lede">O MyID mapeia sua saúde em 11 dimensões e te devolve um retrato claro — com dicas personalizadas e o caminho pro profissional certo.</p>
            <div className="cta-row">
              <Link className="btn btn-emerald" to="/paciente/login">Fazer meu MyID grátis</Link>
              <Link className="btn btn-ghost" to="/demo">Ver como funciona</Link>
            </div>
            <div className="trust"><span className="dot" /> Leva ~10 minutos · Dados protegidos pela LGPD</div>
          </div>
        </div>
      </div>

      <section id="como">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Como funciona</div>
            <h2>Três passos até entender sua saúde</h2>
            <p>Você começa sozinho, no seu tempo. O MyID transforma como você se sente num retrato que faz sentido — e te mostra o próximo passo.</p>
          </div>
          <div className="steps">
            <div className="step"><div className="step-ic"><Fingerprint size={20} /></div><h3>Responda o MyID</h3><p>Um questionário guiado sobre sua dor, seu corpo e sua rotina. Sem jargão, do seu jeito.</p></div>
            <div className="step"><div className="step-ic"><Activity size={20} /></div><h3>Receba seu retrato</h3><p>Suas 11 dimensões em cores e números, com sua devolutiva e dicas geradas pra você.</p></div>
            <div className="step"><div className="step-ic"><Users size={20} /></div><h3>Vá além com um profissional</h3><p>Conecte-se a um profissional pra ter resultados mais completos: avatar montado, achados revisados e acompanhamento.</p></div>
          </div>
        </div>
      </section>

      <section className="dims" id="dims">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">O que o MyID enxerga</div>
            <h2>Sua dor não é um número só. São 11 dimensões.</h2>
            <p>O MyID é biopsicossocial: ele pesa o equilíbrio entre o que te <b>sustenta</b> (sono, vida pessoal, movimento, hidratação, alimentação, postura) e o que te <b>pressiona</b> (dor, atividades, emoções, mudanças, sinais do corpo) — e mostra qual está puxando mais. Um retrato de 0 a 100 (quanto maior, melhor).</p>
          </div>

          <div className="dim-group">
            <div className="dim-col">
              <div className="col-tag" style={{ color: 'var(--emerald)' }}>Anéis internos · Sustento</div>
              <div className="dim-grid">
                {SUSTENTO.map(([title, desc]) => (
                  <div className="dim" key={title}><h3>{title}</h3><p>{desc}</p></div>
                ))}
              </div>
            </div>
            <div className="dim-col">
              <div className="col-tag" style={{ color: '#EF4444' }}>Anéis externos · Pressão</div>
              <div className="dim-grid">
                {PRESSAO.map(([title, desc]) => (
                  <div className="dim" key={title}><h3>{title}</h3><p>{desc}</p></div>
                ))}
              </div>
            </div>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '18px' }}>
            + <b>Medicação</b> — um valor <b>extra</b> que ajusta o cálculo conforme o que você usa. Escala de <b>Excelente</b> a <b>Crítico Severo</b>.
          </p>
        </div>
      </section>

      <section id="avatar">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Avatar Clínico</div>
            <h2>A memória do seu corpo.</h2>
            <p>Cada achado fica registrado no mapa anatômico, organizado por <b>sistema do corpo</b> (musculoesquelético, nervoso, circulatório, digestório…) — e evolui a cada avaliação.</p>
          </div>
          <div className="avatar-grid">
            <div className="avatar-stage">
              <AvatarClinicoShowcase />
            </div>
            <div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <li style={{ display: 'flex', gap: '10px' }}><Check c="var(--emerald)" /> <span><b>Achados por sistema do corpo</b> — cada queixa no lugar e no sistema certo.</span></li>
                <li style={{ display: 'flex', gap: '10px' }}><Check c="var(--emerald)" /> <span><b>Evolui com o tratamento</b> — de <i>ativo</i> a <i>em tratamento</i> e <i>resolvido</i>, ao longo do tempo.</span></li>
                <li style={{ display: 'flex', gap: '10px' }}><Check c="var(--emerald)" /> <span><b>Montado por um profissional</b> (no Premium) — os achados são revisados antes de entrar no seu mapa.</span></li>
                <li style={{ display: 'flex', gap: '10px' }}><Check c="var(--emerald)" /> <span><b>Interdisciplinar</b> — seu mapa vai com você pra qualquer profissional de saúde, sem perder contexto.</span></li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="planos">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Planos</div>
            <h2>Comece de graça. Vá além quando quiser.</h2>
            <p>Você faz o MyID <b>sozinho e grátis</b> e já recebe seu retrato + dicas. Quer resultados <b>mais completos</b> — avatar montado, planos e acompanhamento? Aí você se <b>conecta a um profissional</b> ou entra no <b>Premium</b>.</p>
          </div>
          <div className="tiers">
            <div className="tier">
              <div className="kicker">Grátis · sozinho</div>
              <div className="price">R$ 0</div>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Faça sem profissional. Um retrato essencial pra você se conhecer e começar.</p>
              <ul>
                <li><Check c="var(--emerald)" /> Avaliação MyID (versão essencial)</li>
                <li><Check c="var(--emerald)" /> Seu retrato e devolutiva</li>
                <li><Check c="var(--emerald)" /> Dicas de saúde geradas por IA</li>
                <li><Check c="var(--emerald)" /> Vitrine para encontrar um profissional</li>
              </ul>
              <Link className="btn btn-emerald" to="/paciente/login">Fazer meu MyID grátis</Link>
            </div>

            <div className="tier feature">
              <span className="badge">Completo</span>
              <div className="kicker">Com um profissional ou Premium</div>
              <div className="price">Mais completo</div>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Com um profissional de verdade por trás, seu retrato vira acompanhamento.</p>
              <ul>
                <li><Check c="var(--cyan)" /> Tudo do plano grátis, com resultados mais completos</li>
                <li><Check c="var(--cyan)" /> Avatar Clínico montado por um profissional</li>
                <li><Check c="var(--cyan)" /> Questionários baseados em evidência científica</li>
                <li><Check c="var(--cyan)" /> Planos de treino, dicas e nutrição personalizados</li>
              </ul>
              <p className="note">Ligue-se a um profissional agora. O <b>Premium</b> (self-service) vem em breve. Os planos não substituem um profissional — os mais elaborados pedem acompanhamento presencial.</p>
              <Link className="btn btn-ghost" to="/portaldocliente/vitrine" style={{ marginTop: '16px' }}>Encontrar um profissional</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="conectar">
        <div className="wrap">
          <div className="connect">
            <div className="txt">
              <h3>Conecte-se a um profissional e vá além.</h3>
              <p>Ao se ligar a um profissional, seu MyID fica <b>mais completo</b>: avatar montado, achados revisados e acompanhamento de verdade. Encontre fisioterapeutas e profissionais de saúde que entendem o seu retrato — sem sair do app.</p>
            </div>
            <Link className="btn btn-emerald" to="/portaldocliente/vitrine">Encontrar um profissional</Link>
          </div>
        </div>
      </section>

      <div className="pro-band">
        <div className="wrap inner">
          <div>
            <div className="k">Para profissionais</div>
            <h3>É fisioterapeuta ou profissional de saúde?</h3>
            <p>Avaliação por voz, prontuário e diretriz de tratamento — o My Health ID para a sua clínica.</p>
          </div>
          <Link className="btn btn-ghost go" to="/profissional">Ver a plataforma profissional →</Link>
        </div>
      </div>

      <footer>
        <div className="wrap foot">
          <div style={{ maxWidth: '260px' }}>
            <div className="brand">
              <img className="mark" src={logoMark} alt="" aria-hidden="true" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
              My Health ID
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '10px' }}>Sua saúde, sua identidade. Entenda sua saúde, do seu jeito.</p>
          </div>
          <div className="col">
            <h4>Cliente</h4>
            <Link to="/paciente/login">Fazer o MyID</Link>
            <Link to="/portaldocliente/vitrine">Encontrar profissional</Link>
            <Link to="/paciente/login">Entrar no portal</Link>
          </div>
          <div className="col">
            <h4>Profissional</h4>
            <Link to="/profissional">A plataforma</Link>
            <Link to="/profissional">Planos e preços</Link>
            <Link to="/auth">Entrar</Link>
          </div>
          <div className="col">
            <h4>Confiança</h4>
            <a href="#">Privacidade (LGPD)</a>
            <a href="#">Termos de uso</a>
            <a href="#">Segurança dos dados</a>
          </div>
        </div>
        <div className="wrap legal">
          <span>© 2026 My Health ID · Belém/PA</span>
          <span>Seus dados são seus. Criptografados e protegidos pela LGPD.</span>
        </div>
      </footer>
    </div>
  );
}
