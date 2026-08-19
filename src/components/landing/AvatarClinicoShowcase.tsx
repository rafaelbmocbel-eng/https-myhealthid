// Vitrine do Avatar Clínico para as páginas públicas — réplica fiel da tela real
// do app (Mapa Corporal por sistemas). Sem login/Supabase; achados de exemplo.
// Cores/ícones/rótulos de sistema espelham SISTEMA_CONFIG/SISTEMA_CHART_COLOR
// (AvatarClinicoCard.tsx). Dots dos achados são coloridos pelo STATUS (crônico =
// âmbar), como no app; a legenda mostra a cor do SISTEMA.
import { Zap, Brain, Wind, Dna, Droplets, Stethoscope, Heart, Shield, Waves, Eye, HeartPulse } from 'lucide-react';

const SISTEMAS = [
  { key: 'musculoesqueletico', label: 'Musculoesquelético', cor: '#a855f7', Icon: Zap, ativo: true },
  { key: 'nervoso', label: 'Nervoso', cor: '#3b82f6', Icon: Brain, ativo: true },
  { key: 'respiratorio', label: 'Respiratório', cor: '#06b6d4', Icon: Wind, ativo: true },
  { key: 'endocrino', label: 'Endócrino', cor: '#eab308', Icon: Dna, ativo: true },
  { key: 'urinario', label: 'Urinário', cor: '#6366f1', Icon: Droplets, ativo: true },
  { key: 'digestorio', label: 'Digestório', cor: '#f97316', Icon: Stethoscope, ativo: false },
  { key: 'circulatorio', label: 'Circulatório', cor: '#ef4444', Icon: Heart, ativo: false },
  { key: 'reprodutor', label: 'Reprodutor', cor: '#ec4899', Icon: HeartPulse, ativo: false },
  { key: 'tegumentar', label: 'Tegumentar', cor: '#78716c', Icon: Shield, ativo: false },
  { key: 'linfatico', label: 'Linfático', cor: '#84cc16', Icon: Waves, ativo: false },
  { key: 'sensorial', label: 'Sensorial', cor: '#10b981', Icon: Eye, ativo: false },
];

// Achados de exemplo (iguais aos da tela real): musculoesquelético, crônico.
const ACHADOS = [
  { label: 'Ombro D', tipo: 'Lesão em manguito rotador direito', status: 'Crônico', cx: 78, cy: 150 },
  { label: 'Joelho E', tipo: 'Condropatia patelar esquerda', status: 'Crônico', cx: 132, cy: 320 },
];

const AMBER = '#eab308'; // status crônico

export default function AvatarClinicoShowcase() {
  return (
    <div style={{ width: '100%', color: '#0E1B26' }}>
      <style>{`
        @keyframes avPing3 {0%{transform:scale(1);opacity:.55}70%{transform:scale(3);opacity:0}100%{transform:scale(1);opacity:0}}
        .avshow .ping{animation:avPing3 2.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
        @media (prefers-reduced-motion:reduce){.avshow .ping{animation:none}}
      `}</style>
      <div className="avshow">
        {/* Abas */}
        <div style={{ display: 'flex', gap: '6px', background: '#EDF3F5', borderRadius: '12px', padding: '4px', marginBottom: '12px' }}>
          {['Mapa Corporal', 'Achados', 'Evolução'].map((t, i) => (
            <div key={t} style={{ flex: 1, textAlign: 'center', fontSize: '12px', fontWeight: 600, padding: '7px 4px', borderRadius: '9px', background: i === 0 ? '#fff' : 'transparent', color: i === 0 ? '#0E1B26' : '#57697A', boxShadow: i === 0 ? '0 1px 4px rgba(11,31,51,.12)' : 'none' }}>{t}</div>
          ))}
        </div>

        {/* Anterior / Posterior */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'inline-flex', gap: '4px', background: '#EDF3F5', borderRadius: '10px', padding: '3px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '5px 12px', borderRadius: '8px', background: '#fff', color: '#0E1B26', boxShadow: '0 1px 4px rgba(11,31,51,.12)' }}>Anterior</span>
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '5px 12px', borderRadius: '8px', color: '#94a3b8' }}>Posterior</span>
          </div>
        </div>

        {/* Fileira de ícones de sistemas — quebra linha no mobile (nada colado na borda) */}
        <div style={{ display: 'flex', gap: '7px', justifyContent: 'center', flexWrap: 'wrap', maxWidth: '100%', marginBottom: '8px' }}>
          {SISTEMAS.map((s) => (
            <div key={s.key} title={s.label} style={{ position: 'relative', flex: 'none', width: '34px', height: '34px', borderRadius: '10px', border: '1px solid #E2EAEE', background: '#fff', display: 'grid', placeItems: 'center', color: s.ativo ? s.cor : '#b6c2ca' }}>
              <s.Icon size={16} strokeWidth={2} />
              {s.ativo && <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '7px', height: '7px', borderRadius: '50%', background: AMBER, border: '1.5px solid #fff' }} />}
            </div>
          ))}
        </div>

        {/* Corpo + achados */}
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
          <svg viewBox="0 0 220 420" width="180" height="344" style={{ flex: 'none', maxWidth: '100%' }} aria-label="Avatar Clínico — mapa corporal">
            {/* sombra */}
            <ellipse cx="110" cy="410" rx="52" ry="6" fill="#0E1B26" opacity="0.06" />
            {/* pernas */}
            <path d="M92 250 Q88 320 90 388" stroke="#cbd5e1" strokeWidth="26" strokeLinecap="round" fill="none" opacity="0.6" />
            <path d="M128 250 Q132 320 130 388" stroke="#cbd5e1" strokeWidth="26" strokeLinecap="round" fill="none" opacity="0.6" />
            {/* braços */}
            <path d="M70 150 Q44 210 46 262" stroke="#cbd5e1" strokeWidth="22" strokeLinecap="round" fill="none" opacity="0.55" />
            <path d="M150 150 Q176 210 174 262" stroke="#cbd5e1" strokeWidth="22" strokeLinecap="round" fill="none" opacity="0.55" />
            {/* tronco */}
            <rect x="66" y="132" width="88" height="130" rx="30" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="2" />
            {/* pescoço + cabeça */}
            <rect x="100" y="112" width="20" height="20" rx="6" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="1.6" />
            <circle cx="110" cy="72" r="42" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
            {/* dots dos achados (âmbar = crônico) */}
            {ACHADOS.map((a) => (
              <g key={a.label}>
                <circle cx={a.cx} cy={a.cy} r="16" fill={AMBER} opacity="0.28" className="ping" />
                <circle cx={a.cx} cy={a.cy} r="11" fill={AMBER} opacity="0.9" />
                <circle cx={a.cx} cy={a.cy} r="4.5" fill="#fff" opacity="0.9" />
              </g>
            ))}
          </svg>

          {/* Cards de achados */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 150px', minWidth: 0 }}>
            {ACHADOS.map((a) => (
              <div key={a.label} style={{ border: '1px solid #a855f733', borderRadius: '12px', background: '#fff', padding: '10px 12px', boxShadow: '0 2px 10px -6px rgba(11,31,51,.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#a855f7' }}>{a.label}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', background: '#fef3c7', color: '#b45309' }}>{a.status}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#57697A' }}>{a.tipo}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Legenda de sistemas (ativos) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: '14px', justifyContent: 'center' }}>
          {SISTEMAS.filter((s) => s.ativo).map((s) => (
            <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#57697A' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.cor }} />
              {s.label}
            </span>
          ))}
        </div>

        <p style={{ fontSize: '11.5px', color: '#94a3b8', textAlign: 'center', marginTop: '12px', fontStyle: 'italic' }}>
          O avatar é atualizado automaticamente a cada avaliação por voz ou presencial.
        </p>
      </div>
    </div>
  );
}
