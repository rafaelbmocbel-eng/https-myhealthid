import { Link, Navigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useRef } from 'react';
import logoMark from '@/assets/logo-myhealthid-mark.png';
import logoMarkBranco from '@/assets/logo-myhealthid-mark-branco.png';

// Home pública FOCADA NO CLIENTE (B2C). O profissional tem o site próprio em
// /profissional. Conceito: a impressão digital = "sua identidade clínica" (MyID).

const CSS = `
.clh{
  --navy:#0B1F33; --navy-2:#0E2942;
  --cyan:#2ACBE8; --cyan-deep:#0FA6C8;
  --emerald:#12B981; --emerald-deep:#0B8F63;
  --bg:#F4F7F8; --surface:#FFFFFF; --surface-2:#EEF3F5;
  --ink:#0E1B26; --muted:#57697A; --line:#E1E9ED;
  --band:#0B1F33; --band-ink:#EAF3F7; --band-muted:#9DB4C4; --band-line:#21384d;
  --shadow:0 18px 40px -24px rgba(11,31,51,.35);
  --display:'Bricolage Grotesque','Inter',system-ui,sans-serif;
  --body:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono',ui-monospace,monospace;
  background:var(--bg); color:var(--ink); font-family:var(--body);
  line-height:1.6; font-size:17px; -webkit-font-smoothing:antialiased;
}
@media (prefers-color-scheme:dark){
  .clh{
    --bg:#081018; --surface:#0E1F2C; --surface-2:#0B1925;
    --ink:#E7F1F6; --muted:#93A8B6; --line:#1C3244;
    --shadow:0 18px 44px -24px rgba(0,0,0,.6);
  }
}
.clh *{box-sizing:border-box}
.clh h1,.clh h2,.clh h3,.clh h4{font-family:var(--display); font-weight:700; line-height:1.05; text-wrap:balance; margin:0}
.clh p{margin:0}
.clh a{color:inherit; text-decoration:none}
.clh .wrap{max-width:1120px; margin-inline:auto; padding-inline:22px}
.clh .eyebrow{font-family:var(--mono); font-weight:600; font-size:12px; letter-spacing:.16em; text-transform:uppercase}

.clh header{position:sticky; top:0; z-index:20; background:color-mix(in srgb,var(--bg) 86%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line)}
.clh .nav{display:flex; align-items:center; gap:20px; height:64px}
.clh .brand{display:flex; align-items:center; gap:10px; font-family:var(--display); font-weight:800; font-size:18px; letter-spacing:-.01em}
.clh .brand .mark{width:30px; height:30px; flex:none; object-fit:contain}
.clh .nav .links{display:flex; gap:22px; margin-left:14px; font-size:14.5px; color:var(--muted); font-weight:500}
.clh .nav .links a:hover{color:var(--ink)}
.clh .nav .right{margin-left:auto; display:flex; align-items:center; gap:14px}
.clh .pro-link{font-size:13.5px; color:var(--muted); font-weight:500; display:inline-flex; align-items:center; gap:5px}
.clh .pro-link:hover{color:var(--cyan-deep)}
.clh .btn{display:inline-flex; align-items:center; gap:8px; border-radius:11px; font-weight:600; font-size:15px; padding:11px 18px; cursor:pointer; border:1px solid transparent; transition:transform .12s ease, box-shadow .2s ease, background .2s}
.clh .btn:active{transform:translateY(1px)}
.clh .btn-emerald{background:var(--emerald); color:#fff; box-shadow:0 10px 24px -12px var(--emerald)}
.clh .btn-emerald:hover{background:var(--emerald-deep)}
.clh .btn-ghost{background:transparent; border-color:var(--line); color:var(--ink)}
.clh .btn-ghost:hover{border-color:var(--muted)}
.clh .btn-sm{padding:8px 14px; font-size:14px; border-radius:10px}
.clh .btn-cyan-ghost{background:transparent; border-color:rgba(42,203,232,.4); color:#cdeef7}
.clh .btn-cyan-ghost:hover{background:rgba(42,203,232,.12)}

.clh .hero{background:radial-gradient(120% 130% at 78% 12%, #123a5c 0%, var(--navy-2) 42%, var(--navy) 100%); color:var(--band-ink); position:relative; overflow:hidden; border-bottom:1px solid var(--band-line)}
.clh .hero-grid{display:grid; grid-template-columns:1.05fr .95fr; gap:36px; align-items:center; padding:72px 0 84px}
.clh .hero .eyebrow{color:var(--cyan)}
.clh .hero h1{font-size:clamp(38px,6.2vw,62px); font-weight:700; letter-spacing:-.02em; margin:16px 0 0}
.clh .hero h1 .glow{color:var(--cyan)}
.clh .hero .lede{color:var(--band-muted); font-size:clamp(16px,2vw,19px); max-width:34ch; margin-top:20px}
.clh .hero .cta-row{display:flex; flex-wrap:wrap; gap:12px; margin-top:30px}
.clh .hero .trust{display:flex; align-items:center; gap:10px; margin-top:20px; color:#89a4b6; font-size:13.5px; font-family:var(--mono)}
.clh .dot{width:6px; height:6px; border-radius:50%; background:var(--cyan); box-shadow:0 0 10px var(--cyan)}
.clh .fp{position:relative; aspect-ratio:1; width:100%; max-width:440px; margin-inline:auto}
.clh .fp canvas{width:100%; height:100%; display:block}
.clh .fp .score{position:absolute; inset:0; display:grid; place-content:center; text-align:center}
.clh .fp .score b{font-family:var(--display); font-weight:700; font-size:44px; color:#eafaff; line-height:1}
.clh .fp .score span{font-family:var(--mono); font-size:11px; letter-spacing:.14em; color:#7fdff3; text-transform:uppercase}

.clh section{padding:72px 0}
.clh .sec-head{max-width:56ch}
.clh .sec-head .eyebrow{color:var(--cyan-deep)}
.clh .sec-head h2{font-size:clamp(26px,3.6vw,38px); letter-spacing:-.02em; margin-top:12px}
.clh .sec-head p{color:var(--muted); margin-top:12px; font-size:17px}

.clh .steps{display:grid; grid-template-columns:repeat(3,1fr); gap:18px; margin-top:40px; counter-reset:s}
.clh .step{background:var(--surface); border:1px solid var(--line); border-radius:16px; padding:24px; box-shadow:var(--shadow)}
.clh .step .n{counter-increment:s; font-family:var(--mono); font-weight:600; font-size:13px; color:var(--cyan-deep); letter-spacing:.1em}
.clh .step .n::before{content:"0" counter(s)}
.clh .step h3{font-size:19px; margin:12px 0 8px; letter-spacing:-.01em}
.clh .step p{color:var(--muted); font-size:15px}

.clh .dims{background:var(--band); color:var(--band-ink); border-block:1px solid var(--band-line)}
.clh .dims .eyebrow{color:var(--cyan)}
.clh .dims h2{color:var(--band-ink)}
.clh .dims .sec-head p{color:var(--band-muted)}
.clh .dim-grid{display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:36px}
.clh .dim{border:1px solid var(--band-line); border-radius:14px; padding:18px; background:linear-gradient(180deg, rgba(42,203,232,.05), transparent)}
.clh .dim .code{font-family:var(--mono); font-size:12px; color:var(--cyan); letter-spacing:.08em}
.clh .dim h3{font-size:16px; margin-top:8px; color:#eaf4f8; letter-spacing:-.01em}
.clh .dim p{color:var(--band-muted); font-size:13px; margin-top:4px}

.clh .tiers{display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-top:42px}
.clh .tier{border:1px solid var(--line); border-radius:16px; padding:28px; background:var(--surface); display:flex; flex-direction:column; box-shadow:var(--shadow)}
.clh .tier.feature{border-color:transparent; background:linear-gradient(180deg,var(--navy-2),var(--navy)); color:var(--band-ink); position:relative}
.clh .tier .kicker{font-family:var(--mono); font-size:12px; letter-spacing:.12em; text-transform:uppercase; color:var(--muted)}
.clh .tier.feature .kicker{color:var(--cyan)}
.clh .tier .price{font-family:var(--display); font-weight:700; font-size:30px; margin:8px 0 2px; letter-spacing:-.02em}
.clh .tier ul{list-style:none; padding:0; margin:18px 0 24px; display:flex; flex-direction:column; gap:11px; font-size:15px}
.clh .tier li{display:flex; gap:10px; align-items:flex-start}
.clh .tier li svg{flex:none; margin-top:3px}
.clh .tier.feature li{color:#d5e7f0}
.clh .tier .note{font-size:12.5px; color:var(--muted); margin-top:auto}
.clh .tier.feature .note{color:var(--band-muted)}
.clh .tier .btn{width:100%; justify-content:center}
.clh .badge{position:absolute; top:18px; right:18px; font-family:var(--mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--navy); background:var(--cyan); padding:4px 9px; border-radius:999px; font-weight:600}

.clh .connect{background:var(--surface-2); border:1px solid var(--line); border-radius:20px; padding:34px; display:flex; align-items:center; gap:26px; flex-wrap:wrap}
.clh .connect .txt{flex:1; min-width:260px}
.clh .connect h3{font-size:23px; letter-spacing:-.01em}
.clh .connect p{color:var(--muted); margin-top:8px}

.clh .pro-band{border-top:1px solid var(--line); background:var(--bg)}
.clh .pro-band .inner{display:flex; align-items:center; gap:18px; flex-wrap:wrap; padding:26px 0}
.clh .pro-band .k{font-family:var(--mono); font-size:11.5px; letter-spacing:.14em; text-transform:uppercase; color:var(--cyan-deep)}
.clh .pro-band h3{font-size:19px; letter-spacing:-.01em}
.clh .pro-band p{color:var(--muted); font-size:14.5px; margin-top:2px}
.clh .pro-band .go{margin-left:auto}

.clh footer{background:var(--band); color:var(--band-muted); border-top:1px solid var(--band-line)}
.clh .foot{display:flex; justify-content:space-between; gap:30px; flex-wrap:wrap; padding:44px 0 30px}
.clh .foot .brand{color:var(--band-ink)}
.clh .foot a{color:var(--band-muted); font-size:14px; display:block; margin-top:9px}
.clh .foot a:hover{color:var(--cyan)}
.clh .foot h4{font-family:var(--mono); font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:#6f8aa0; margin:0 0 4px}
.clh .foot .col{min-width:150px}
.clh .legal{border-top:1px solid var(--band-line); padding:16px 0; font-size:12.5px; color:#6f8aa0; display:flex; justify-content:space-between; gap:14px; flex-wrap:wrap; font-family:var(--mono)}

@media (max-width:860px){
  .clh .hero-grid{grid-template-columns:1fr; gap:26px; padding:52px 0 60px}
  .clh .fp{max-width:340px; order:-1}
  .clh .steps{grid-template-columns:1fr}
  .clh .dim-grid{grid-template-columns:1fr 1fr}
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

const DIMS = [
  ['N', 'Neuro', 'Sensibilização e sinais do sistema nervoso.'],
  ['I', 'Inflamatório', 'Sinais de inflamação e irritação de tecidos.'],
  ['F', 'Funcional', 'O que a dor te impede de fazer no dia a dia.'],
  ['C', 'Comportamental', 'Sono, estresse e hábitos que alimentam a dor.'],
  ['P', 'Postural', 'Padrões de postura e movimento.'],
  ['E', 'Estrutural', 'Aspectos articulares e músculo-esqueléticos.'],
  ['R', 'Recuperação', 'Como seu corpo se restabelece e responde.'],
  ['D', 'Dor', 'Intensidade, tipo e ritmo da sua dor.'],
];

// Canvas "impressão digital clínica": anéis ondulados concêntricos (identidade)
// + 8 marcações radiais (as dimensões do MyID). Respeita reduced-motion.
function useFingerprint(ref: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const W = c.width, H = c.height, cx = W / 2, cy = H / 2;
    const reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    const RINGS = 26, N = 8;
    const seed = Array.from({ length: RINGS }, (_, i) => ({
      a1: 0.06 + (i % 5) * 0.015, a2: 0.03 + (i % 3) * 0.01,
      p1: i * 0.7, p2: i * 1.9, k1: 3 + (i % 4), k2: 5 + (i % 3),
    }));
    let raf = 0;
    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      const breathe = reduce ? 0 : Math.sin(t * 0.0006) * 0.5 + 0.5;
      const maxR = W * 0.44;
      for (let r = 0; r < RINGS; r++) {
        const s = seed[r];
        const base = maxR * (r + 1.2) / (RINGS + 1.2);
        const alpha = 0.10 + 0.5 * (1 - r / RINGS);
        ctx.beginPath();
        for (let a = 0; a <= Math.PI * 2 + 0.02; a += 0.03) {
          const wob = Math.sin(a * s.k1 + s.p1 + t * 0.0004) * s.a1
            + Math.sin(a * s.k2 - s.p2 - t * 0.00025) * s.a2;
          const rr = base * (1 + wob * (0.5 + 0.5 * breathe));
          const x = cx + Math.cos(a) * rr;
          const y = cy + Math.sin(a) * rr * 0.98;
          if (a === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        const mix = r / RINGS;
        const R = Math.round(42 + mix * (18 - 42));
        const G = Math.round(203 + mix * (185 - 203));
        const B = Math.round(232 + mix * (129 - 232));
        ctx.strokeStyle = `rgba(${R},${G},${B},${alpha.toFixed(3)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      for (let d = 0; d < N; d++) {
        const ang = (d / N) * Math.PI * 2 - Math.PI / 2;
        const r1 = maxR * 1.0, r2 = maxR * 1.09;
        const pulse = reduce ? 0.6 : (0.4 + 0.6 * (Math.sin(t * 0.0012 + d) * 0.5 + 0.5));
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
        ctx.lineTo(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2);
        ctx.strokeStyle = `rgba(122,224,243,${pulse.toFixed(2)})`;
        ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * r2, cy + Math.sin(ang) * r2, 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(122,224,243,${pulse.toFixed(2)})`;
        ctx.fill();
      }
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    if (reduce) draw(0); else raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [ref]);
}

export default function LandingPublica() {
  const { user, authReady } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useFingerprint(canvasRef);

  // Já logado: leva pro lugar certo (paciente → portal; profissional → app).
  if (authReady && user) {
    if (user.user_metadata?.is_patient === true) return <Navigate to="/paciente/dashboard" replace />;
    return <Navigate to="/hoje" replace />;
  }

  return (
    <div className="clh">
      <Helmet>
        <title>My Health ID — Entenda sua saúde</title>
        <meta name="description" content="Faça seu MyID grátis: entenda o que está por trás da sua dor em 8 dimensões, receba dicas personalizadas e encontre o profissional certo." />
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
            <a href="#planos">Planos</a>
            <a href="#conectar">Encontrar profissional</a>
          </nav>
          <div className="right">
            <Link className="pro-link" to="/profissional">Sou profissional <span aria-hidden="true">→</span></Link>
            <Link className="btn btn-ghost btn-sm" to="/paciente/login">Entrar</Link>
          </div>
        </div>
      </header>

      <div className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">MyID · sua identidade clínica</div>
            <h1>Descubra o que está por trás da <span className="glow">sua dor</span>.</h1>
            <p className="lede">O MyID mapeia sua saúde em 8 dimensões e te devolve um retrato claro — com dicas personalizadas e o caminho pro profissional certo.</p>
            <div className="cta-row">
              <Link className="btn btn-emerald" to="/paciente/login">Fazer meu MyID grátis</Link>
              <Link className="btn btn-cyan-ghost" to="/demo">Ver como funciona</Link>
            </div>
            <div className="trust"><span className="dot" /> Leva ~10 minutos · Dados protegidos pela LGPD</div>
          </div>
          <div className="fp">
            <canvas ref={canvasRef} width={880} height={880} aria-label="Impressão digital clínica gerada pelo MyID" />
            <div className="score"><b>MyID</b><span>seu retrato único</span></div>
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
            <div className="step"><div className="n" /><h3>Responda o MyID</h3><p>Um questionário guiado sobre sua dor, seu corpo e sua rotina. Sem jargão, do seu jeito.</p></div>
            <div className="step"><div className="n" /><h3>Receba seu retrato</h3><p>Suas 8 dimensões em cores e números, com uma devolutiva clara e dicas seguras geradas pra você.</p></div>
            <div className="step"><div className="n" /><h3>Conecte com um profissional</h3><p>Leve seu MyID a qualquer profissional de saúde — ou encontre um pela nossa vitrine.</p></div>
          </div>
        </div>
      </section>

      <section className="dims" id="dims">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">O que o MyID enxerga</div>
            <h2>Sua dor não é um número só. São 8 dimensões.</h2>
            <p>Dor raramente tem uma causa única. O MyID separa o que costuma vir misturado — pra você e pro seu profissional agirem no lugar certo.</p>
          </div>
          <div className="dim-grid">
            {DIMS.map(([code, title, desc]) => (
              <div className="dim" key={code}>
                <div className="code">{code}</div>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="planos">
        <div className="wrap">
          <div className="sec-head">
            <div className="eyebrow">Planos</div>
            <h2>Comece de graça. Vá além quando quiser.</h2>
            <p>O essencial é gratuito pra sempre. O Premium entra quando você quer um acompanhamento montado por um profissional.</p>
          </div>
          <div className="tiers">
            <div className="tier">
              <div className="kicker">Grátis</div>
              <div className="price">R$ 0</div>
              <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Pra você se conhecer e começar.</p>
              <ul>
                <li><Check c="var(--emerald)" /> Avaliação MyID completa</li>
                <li><Check c="var(--emerald)" /> Relatório de avaliação (devolutiva)</li>
                <li><Check c="var(--emerald)" /> Dicas de saúde geradas por IA</li>
                <li><Check c="var(--emerald)" /> Vitrine para encontrar um profissional</li>
              </ul>
              <Link className="btn btn-emerald" to="/paciente/login">Fazer meu MyID grátis</Link>
            </div>

            <div className="tier feature">
              <span className="badge">Premium</span>
              <div className="kicker">Acompanhado</div>
              <div className="price">Sob acompanhamento</div>
              <p style={{ color: 'var(--band-muted)', fontSize: '14px' }}>Seu retrato vira um plano, montado por gente de verdade.</p>
              <ul>
                <li><Check c="var(--cyan)" /> Tudo do plano grátis</li>
                <li><Check c="var(--cyan)" /> Avatar clínico montado por um profissional</li>
                <li><Check c="var(--cyan)" /> Questionários baseados em evidência científica</li>
                <li><Check c="var(--cyan)" /> Planos de treino, dicas e nutrição personalizados</li>
              </ul>
              <p className="note">Os planos não substituem um profissional. Planos mais elaborados pedem acompanhamento presencial.</p>
              <Link className="btn btn-cyan-ghost" to="/paciente/login" style={{ marginTop: '16px' }}>Conhecer o Premium</Link>
            </div>
          </div>
        </div>
      </section>

      <section id="conectar">
        <div className="wrap">
          <div className="connect">
            <div className="txt">
              <h3>Ainda não tem um profissional?</h3>
              <p>A gente te conecta. Encontre fisioterapeutas e profissionais de saúde que entendem o seu MyID — e continue seu cuidado com quem é do seu lado.</p>
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
            <div className="brand" style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <img src={logoMarkBranco} alt="" aria-hidden="true" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
              My Health ID
            </div>
            <p style={{ color: 'var(--band-muted)', fontSize: '14px', marginTop: '10px' }}>Sua saúde, sua identidade. Entenda sua saúde, do seu jeito.</p>
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
