import logoSrc from '@/assets/logo-myhealthid.jpg';

export default function LogoIcon({
  size = 40,
  className = '',
  glow = false
}: {
  size?: number;
  className?: string;
  glow?: boolean
}) {
  return (
    <div
      className={`relative inline-block ${glow ? 'animate-pulse-slow' : ''}`}
      style={{ width: size, height: size }}
    >
      {glow && (
        <div
          className="absolute inset-0 rounded-full blur-md opacity-50 transition-all duration-1000"
          style={{ background: 'hsl(40 95% 52%)' }}
        />
      )}
      <img
        src={logoSrc}
        alt="My Health ID"
        width={size}
        height={size}
        className={`relative rounded-full object-cover border-2 border-white/10 shadow-lg ${className}`}
      />
    </div>
  );
}
