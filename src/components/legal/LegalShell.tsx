import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import logoMark from '@/assets/logo-myhealthid-mark.png';

// Casca visual das páginas legais (Privacidade, Termos). Fundo claro, Inter,
// mesma identidade da home do cliente. Conteúdo passa como children.
export default function LegalShell({
  titulo,
  atualizadoEm,
  children,
}: {
  titulo: string;
  atualizadoEm: string;
  children: React.ReactNode;
}) {
  return (
    <div className="legal">
      <Helmet>
        <title>{titulo} · My Health ID</title>
        <meta name="robots" content="index,follow" />
      </Helmet>
      <style>{`
        .legal{
          --navy:#0B1F33; --cyan:#0E9BBD; --ink:#0E1B26; --muted:#57697A;
          --bg:#F7FAFB; --surface:#fff; --line:#E2EAEE;
          background:var(--bg); color:var(--ink); min-height:100vh;
          font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif;
          line-height:1.65; -webkit-font-smoothing:antialiased;
        }
        .legal *{box-sizing:border-box}
        .legal .top{position:sticky; top:0; z-index:10; background:color-mix(in srgb,var(--bg) 88%, transparent); backdrop-filter:blur(10px); border-bottom:1px solid var(--line)}
        .legal .top-in{max-width:820px; margin-inline:auto; padding:14px 22px; display:flex; align-items:center; gap:14px}
        .legal .brand{display:flex; align-items:center; gap:9px; font-weight:800; font-size:17px; letter-spacing:-.01em; color:var(--navy)}
        .legal .brand img{width:28px; height:28px; object-fit:contain}
        .legal .back{margin-left:auto; display:inline-flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:var(--muted); text-decoration:none}
        .legal .back:hover{color:var(--cyan)}
        .legal .wrap{max-width:820px; margin-inline:auto; padding:34px 22px 80px}
        .legal h1{font-size:clamp(26px,4vw,34px); font-weight:800; letter-spacing:-.02em; color:var(--navy); margin:0 0 6px; line-height:1.1}
        .legal .meta{font-size:13.5px; color:var(--muted); margin-bottom:28px}
        .legal h2{font-size:19px; font-weight:700; color:var(--navy); margin:30px 0 8px; letter-spacing:-.01em}
        .legal h3{font-size:15.5px; font-weight:700; color:var(--ink); margin:18px 0 4px}
        .legal p{margin:0 0 12px; color:#33424f}
        .legal ul{margin:0 0 12px; padding-left:20px}
        .legal li{margin:0 0 6px; color:#33424f}
        .legal a{color:var(--cyan); text-decoration:none}
        .legal a:hover{text-decoration:underline}
        .legal strong{color:var(--ink)}
        .legal .note{background:#fff; border:1px solid var(--line); border-radius:14px; padding:14px 16px; font-size:14px; color:var(--muted); margin:18px 0}
        .legal .foot{max-width:820px; margin-inline:auto; padding:0 22px 40px; font-size:13px; color:#94a3b8}
        .legal .foot a{color:#94a3b8; text-decoration:underline}
      `}</style>

      <header className="top">
        <div className="top-in">
          <Link to="/" className="brand"><img src={logoMark} alt="" />My Health ID</Link>
          <Link to="/" className="back"><ArrowLeft size={16} /> Voltar ao início</Link>
        </div>
      </header>

      <main className="wrap">
        <h1>{titulo}</h1>
        <p className="meta">Última atualização: {atualizadoEm}</p>
        {children}
      </main>

      <div className="foot">
        My Health ID · <Link to="/privacidade">Privacidade</Link> · <Link to="/termos">Termos de uso</Link>
      </div>
    </div>
  );
}
