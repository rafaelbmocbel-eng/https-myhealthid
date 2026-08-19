// Vitrine do Avatar Clínico para as páginas públicas — representa o avatar REAL
// do app (mapa de achados por SISTEMA do corpo), sem depender de login/Supabase.
// Cores/rótulos de sistema espelham SISTEMA_CHART_COLOR/SISTEMA_CONFIG do app
// (AvatarClinicoCard.tsx). Achados são de exemplo.

const SISTEMA_COR: Record<string, string> = {
  musculoesqueletico: '#a855f7',
  nervoso: '#3b82f6',
  circulatorio: '#ef4444',
  digestorio: '#f97316',
  respiratorio: '#06b6d4',
  endocrino: '#eab308',
};

const FINDINGS = [
  { cx: 72, cy: 90, sistema: 'musculoesqueletico', label: 'Ombro D.', tipo: 'Tendinopatia', status: 'Ativo', delay: '0s' },
  { cx: 106, cy: 28, sistema: 'nervoso', label: 'Cabeça', tipo: 'Enxaqueca', status: 'Ativo', delay: '0.6s' },
  { cx: 92, cy: 118, sistema: 'circulatorio', label: 'Tórax', tipo: 'Palpitação', status: 'Em obs.', delay: '1.1s' },
  { cx: 100, cy: 152, sistema: 'digestorio', label: 'Abdômen', tipo: 'Refluxo', status: 'Resolvido', delay: '1.6s' },
];

const LEGENDA = [
  { key: 'musculoesqueletico', label: 'Musculoesq.' },
  { key: 'nervoso', label: 'Nervoso' },
  { key: 'circulatorio', label: 'Circulatório' },
  { key: 'digestorio', label: 'Digestório' },
  { key: 'respiratorio', label: 'Respiratório' },
  { key: 'endocrino', label: 'Endócrino' },
];

const statusStyle = (s: string): { background: string; color: string } =>
  s === 'Resolvido'
    ? { background: '#dcfce7', color: '#15803d' }
    : s === 'Em obs.'
      ? { background: '#fef3c7', color: '#b45309' }
      : { background: '#fee2e2', color: '#dc2626' };

export default function AvatarClinicoShowcase() {
  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes avPing2 {0%{transform:scale(1);opacity:.7}65%{transform:scale(3.2);opacity:0}100%{transform:scale(1);opacity:0}}
        .avshow .ping{animation:avPing2 2.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
        @media (prefers-reduced-motion:reduce){.avshow .ping{animation:none}}
      `}</style>
      <div className="avshow" style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* corpo com achados por sistema */}
        <svg viewBox="0 0 200 330" width="160" height="264" fill="none" aria-label="Avatar Clínico — mapa por sistemas" style={{ flex: 'none', color: '#0E1B26' }}>
          <circle cx="100" cy="32" r="24" stroke="currentColor" strokeWidth="1.8" opacity="0.20" fill="currentColor" fillOpacity="0.05" />
          <rect x="93" y="54" width="14" height="14" rx="4" fill="currentColor" fillOpacity="0.07" stroke="currentColor" strokeWidth="1.4" opacity="0.18" />
          <path d="M66 80 Q58 120 62 168 Q80 176 100 176 Q120 176 138 168 Q142 120 134 80 Q118 74 100 74 Q82 74 66 80 Z" stroke="currentColor" strokeWidth="1.8" opacity="0.20" fill="currentColor" fillOpacity="0.05" />
          <path d="M66 84 Q46 110 42 164" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.12" fill="none" />
          <path d="M134 84 Q154 110 158 164" stroke="currentColor" strokeWidth="9" strokeLinecap="round" opacity="0.12" fill="none" />
          <path d="M86 174 Q82 230 82 278 Q82 296 86 306" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity="0.12" fill="none" />
          <path d="M114 174 Q118 230 118 278 Q118 296 114 306" stroke="currentColor" strokeWidth="12" strokeLinecap="round" opacity="0.12" fill="none" />
          {FINDINGS.map((d) => {
            const cor = SISTEMA_COR[d.sistema];
            return (
              <g key={d.label}>
                <circle cx={d.cx} cy={d.cy} r="6" fill={cor} className="ping" style={{ animationDelay: d.delay }} />
                <circle cx={d.cx} cy={d.cy} r="6" fill={cor} />
                <circle cx={d.cx} cy={d.cy} r="2.5" fill="white" opacity="0.7" />
              </g>
            );
          })}
        </svg>

        {/* cards de achados */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '168px', flex: 1 }}>
          {FINDINGS.map((d) => {
            const cor = SISTEMA_COR[d.sistema];
            return (
              <div key={d.label} style={{ border: `1px solid ${cor}35`, borderRadius: '12px', background: '#fff', padding: '10px 12px', boxShadow: '0 2px 10px -6px rgba(11,31,51,.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: cor }}>{d.label}</span>
                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '999px', ...statusStyle(d.status) }}>{d.status}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#57697A' }}>{d.tipo}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* legenda de sistemas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: '16px' }}>
        {LEGENDA.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#57697A' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: SISTEMA_COR[s.key] }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
