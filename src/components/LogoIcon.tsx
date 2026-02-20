export default function LogoIcon({ size = 40, className = '', light = false }: { size?: number; className?: string; light?: boolean }) {
  const navy = light ? 'hsl(213, 55%, 22%)' : '#ffffff';
  const gold = 'hsl(40, 95%, 52%)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer circle */}
      <circle cx="50" cy="50" r="46" stroke={navy} strokeWidth="3.5" fill="none" />
      {/* Fingerprint arcs - gold */}
      <path d="M28 50 A22 22 0 0 1 72 50" stroke={gold} strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 41 A19 19 0 0 1 68 41" stroke={gold} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M32 59 A19 19 0 0 0 68 59" stroke={gold} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M37 34 A14 14 0 0 1 63 34" stroke={gold} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      <path d="M37 66 A14 14 0 0 0 63 66" stroke={gold} strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Person silhouette */}
      <circle cx="50" cy="40" r="5.5" fill={navy} />
      <path d="M41 57 Q41 48 50 48 Q59 48 59 57" stroke={navy} strokeWidth="3" strokeLinecap="round" fill="none" />
      {/* Arms up */}
      <path d="M43 52 L35 43" stroke={navy} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M57 52 L65 43" stroke={navy} strokeWidth="2.5" strokeLinecap="round" />
      {/* Corner dots */}
      <circle cx="18" cy="50" r="2.5" fill={navy} />
      <circle cx="82" cy="50" r="2.5" fill={navy} />
      <circle cx="50" cy="18" r="2.5" fill={navy} />
      <circle cx="50" cy="82" r="2.5" fill={navy} />
    </svg>
  );
}
