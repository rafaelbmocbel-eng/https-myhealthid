import logoSrc from '@/assets/logo-myhealthid.jpg';

export default function LogoIcon({ size = 40, className = '' }: { size?: number; className?: string; light?: boolean }) {
  return (
    <img
      src={logoSrc}
      alt="My Health ID"
      width={size}
      height={size}
      className={`rounded-full object-cover ${className}`}
    />
  );
}
