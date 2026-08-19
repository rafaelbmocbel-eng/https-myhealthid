// Vitrine do Avatar Clínico (estilo aprovado pelo Rafael) — corpo limpo + achados
// por SISTEMA + cards + legenda. Sem login/Supabase; achados de exemplo. Espelha
// o BodyAvatarVisual da página do profissional.

const SISTEMA_COR: Record<string, string> = {
  musculoesqueletico: '#fb923c',
  nervoso: '#818cf8',
  circulatorio: '#ef4444',
  digestorio: '#34d399',
};

const FINDINGS = [
  { cx: 72, cy: 90, sistema: 'musculoesqueletico', label: 'Ombro D.', tipo: 'Tendinopatia', status: 'Ativo', delay: '0s' },
  { cx: 106, cy: 28, sistema: 'nervoso', label: 'Cabeça', tipo: 'Enxaqueca', status: 'Ativo', delay: '0.6s' },
  { cx: 92, cy: 118, sistema: 'circulatorio', label: 'Tórax', tipo: 'Palpitação', status: 'Obs.', delay: '1.1s' },
  { cx: 100, cy: 152, sistema: 'digestorio', label: 'Abdômen', tipo: 'Refluxo', status: 'Resolvido', delay: '1.6s' },
];

const LEGENDA = [
  { key: 'musculoesqueletico', label: 'Musculoesq.' },
  { key: 'nervoso', label: 'Nervoso' },
  { key: 'circulatorio', label: 'Circulatório' },
  { key: 'digestorio', label: 'Digestório' },
];

const statusStyle = (s: string): { background: string; color: string } =>
  s === 'Resolvido'
    ? { background: '#dcfce7', color: '#15803d' }
    : s === 'Obs.'
      ? { background: '#fef3c7', color: '#b45309' }
      : { background: '#fee2e2', color: '#dc2626' };

export default function AvatarClinicoShowcase() {
  return (
    <div style={{ width: '100%' }}>
      <style>{`
        @keyframes avPing4 {0%{transform:scale(1);opacity:.7}65%{transform:scale(3.2);opacity:0}100%{transform:scale(1);opacity:0}}
        .avshow2 .ping{animation:avPing4 2.6s ease-out infinite;transform-box:fill-box;transform-origin:center}
        @media (prefers-reduced-motion:reduce){.avshow2 .ping{animation:none}}
      `}</style>
      <div className="avshow2" style={{ display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '100%' }}>
        {/* corpo com achados por sistema */}
        <svg viewBox="0 0 200 330" width="170" height="280" fill="none" aria-label="Avatar Clínico — mapa por sistemas" style={{ flex: 'none', maxWidth: '100%', color: '#0E1B26' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: '1 1 180px', minWidth: 0 }}>
          {FINDINGS.map((d) => {
            const cor = SISTEMA_COR[d.sistema];
            return (
              <div key={d.label} style={{ border: `1px solid ${cor}35`, borderRadius: '14px', background: '#fff', padding: '12px 14px', boxShadow: '0 2px 12px -7px rgba(11,31,51,.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: cor }}>{d.label}</span>
                  <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 9px', borderRadius: '999px', ...statusStyle(d.status) }}>{d.status}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#57697A' }}>{d.tipo}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* legenda de sistemas */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: '18px', justifyContent: 'center' }}>
        {LEGENDA.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#57697A' }}>
            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: SISTEMA_COR[s.key] }} />
            {s.label}
          </span>
        ))}
      </div>

      <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', marginTop: '12px', fontStyle: 'italic' }}>
        O avatar é atualizado automaticamente a cada avaliação por voz ou presencial.
      </p>
    </div>
  );
}
