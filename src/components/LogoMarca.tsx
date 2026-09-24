import logoMark from '@/assets/logo-myhealthid-mark.png';

// Logo oficial (símbolo de digitais + nome) para cabeçalhos. Única fonte da
// marca nas telas — trocar a identidade visual é mudar só aqui.
export default function LogoMarca({
  tamanho = 28,
  fundo = 'claro',
  className = '',
}: {
  tamanho?: number;
  fundo?: 'claro' | 'escuro';
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 select-none ${className}`}>
      <img
        src={logoMark}
        alt=""
        aria-hidden="true"
        width={tamanho}
        height={tamanho}
        // Em fundo escuro o contorno escuro das digitais some: placa clara atrás.
        className={`object-contain shrink-0 ${fundo === 'escuro' ? 'rounded-lg bg-white p-0.5' : ''}`}
        style={{ width: tamanho, height: tamanho }}
      />
      <span
        className={`font-extrabold tracking-tight whitespace-nowrap ${fundo === 'escuro' ? 'text-white' : 'text-[#0E1B3D] dark:text-white'}`}
        style={{ fontSize: Math.round(tamanho * 0.62) }}
      >
        My Health <span className="text-[#12B5C9]">ID</span>
      </span>
    </span>
  );
}
