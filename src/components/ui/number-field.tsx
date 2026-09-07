import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';

type InputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'>;

interface NumberFieldProps extends InputProps {
  value: number | null | undefined;
  onValueChange: (n: number) => void;
  min?: number;
  max?: number;
  /** Permite casas decimais (vírgula ou ponto). */
  decimal?: boolean;
  /** Valor aplicado quando o campo é deixado vazio (default: min ?? 0). */
  emptyValue?: number;
}

// Campo numérico que NÃO trava a edição: o usuário pode APAGAR e deixar o campo
// vazio enquanto digita (o pai continua guardando um número). O problema antigo
// era `onChange={setX(parseInt(e.target.value) || fallback)}` — apagar dava
// NaN||fallback e o número "voltava", impedindo limpar o campo. Aqui o rascunho
// é uma string local; só normalizamos (fallback + min/max) ao sair do campo.
export function NumberField({
  value, onValueChange, min, max, decimal, emptyValue, inputMode, ...rest
}: NumberFieldProps) {
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  const focado = useRef(false);

  // Sincroniza com o valor externo quando o campo NÃO está em edição
  // (ex.: "usar como base" preenche os campos por fora).
  useEffect(() => {
    if (!focado.current) setDraft(value == null ? '' : String(value));
  }, [value]);

  const sanitizar = (raw: string) => {
    if (decimal) {
      let s = raw.replace(',', '.').replace(/[^0-9.]/g, '');
      const i = s.indexOf('.');
      if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, ''); // só um ponto
      return s;
    }
    return raw.replace(/[^0-9]/g, '');
  };

  const parse = (s: string) => (decimal ? parseFloat(s) : parseInt(s, 10));

  return (
    <Input
      {...rest}
      type="text"
      inputMode={inputMode ?? (decimal ? 'decimal' : 'numeric')}
      value={draft}
      onFocus={(e) => { focado.current = true; rest.onFocus?.(e); }}
      onChange={(e) => {
        const s = sanitizar(e.target.value);
        setDraft(s);
        if (s !== '' && s !== '.' && s !== '-') {
          let n = parse(s);
          if (!Number.isNaN(n)) {
            if (max != null && n > max) n = max; // só teto durante a digitação
            onValueChange(n);
          }
        }
        // vazio: NÃO força fallback aqui — deixa o campo limpo para o usuário digitar
      }}
      onBlur={(e) => {
        focado.current = false;
        const s = sanitizar(e.target.value);
        if (s === '' || s === '.' || s === '-' || Number.isNaN(parse(s))) {
          const fb = emptyValue ?? min ?? 0;
          onValueChange(fb);
          setDraft(String(fb));
        } else {
          let n = parse(s);
          if (min != null && n < min) n = min;
          if (max != null && n > max) n = max;
          onValueChange(n);
          setDraft(String(n));
        }
        rest.onBlur?.(e);
      }}
    />
  );
}

export default NumberField;
