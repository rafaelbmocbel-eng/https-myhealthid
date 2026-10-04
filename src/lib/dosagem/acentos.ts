import type { Modalidade } from './tipos';

// Uma cor por modalidade. `l` = tom do tema claro; `d` = tom do tema escuro
// (mais claro, para manter o contraste). Triplas HSL sem "hsl()" para entrar em
// variáveis CSS.
export const ACENTOS: Record<Modalidade, { l: string; d: string }> = {
  laser: { l: '347 77% 46%', d: '347 90% 72%' },
  ultrassom: { l: '199 89% 36%', d: '199 95% 66%' },
  ondas_choque: { l: '26 90% 42%', d: '34 95% 62%' },
  tens: { l: '262 65% 50%', d: '262 90% 76%' },
  nmes: { l: '158 80% 28%', d: '158 70% 56%' },
  russa: { l: '292 65% 42%', d: '292 85% 74%' },
  interferencial: { l: '186 85% 28%', d: '186 80% 56%' },
};

export const estiloAcento = (m: Modalidade) =>
  ({ '--acc-l': ACENTOS[m].l, '--acc-d': ACENTOS[m].d }) as React.CSSProperties;

// Classes (strings estáticas para o Tailwind enxergar) que usam as variáveis acima.
export const ACC = {
  texto: 'text-[hsl(var(--acc-l))] dark:text-[hsl(var(--acc-d))]',
  suave: 'bg-[hsl(var(--acc-l)/0.07)] dark:bg-[hsl(var(--acc-d)/0.13)]',
  suaveForte: 'bg-[hsl(var(--acc-l)/0.14)] dark:bg-[hsl(var(--acc-d)/0.22)]',
  borda: 'border-[hsl(var(--acc-l)/0.28)] dark:border-[hsl(var(--acc-d)/0.38)]',
  solido: 'bg-[hsl(var(--acc-l))] text-white dark:bg-[hsl(var(--acc-d))] dark:text-slate-950',
  anel: 'ring-[hsl(var(--acc-l)/0.40)] dark:ring-[hsl(var(--acc-d)/0.50)]',
  gradiente:
    'bg-gradient-to-br from-[hsl(var(--acc-l)/0.15)] via-[hsl(var(--acc-l)/0.05)] to-transparent dark:from-[hsl(var(--acc-d)/0.24)] dark:via-[hsl(var(--acc-d)/0.08)] dark:to-transparent',
  halo: 'bg-gradient-to-b from-[hsl(var(--acc-l)/0.12)] to-transparent [mask-image:radial-gradient(80%_100%_at_50%_0%,black_35%,transparent)] [-webkit-mask-image:radial-gradient(80%_100%_at_50%_0%,black_35%,transparent)] dark:from-[hsl(var(--acc-d)/0.18)] dark:to-transparent',
  traco: 'stroke-[hsl(var(--acc-l))] dark:stroke-[hsl(var(--acc-d))]',
  preench: 'fill-[hsl(var(--acc-l))] dark:fill-[hsl(var(--acc-d))]',
  preenchSuave: 'fill-[hsl(var(--acc-l)/0.14)] dark:fill-[hsl(var(--acc-d)/0.22)]',
} as const;
