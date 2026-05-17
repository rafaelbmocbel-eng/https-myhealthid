/**
 * Serene Premium — testes estáticos de ritmo de espaçamento.
 *
 * Lê arquivos-fonte e valida que:
 *  - Páginas (Pacientes, Eventos, Configuracoes) usam o wrapper
 *    `container py-4 sm:py-6` e hero `mb-5 sm:mb-7`.
 *  - Cards de Configurações usam `mb-4 sm:mb-5` (nunca `mb-6`).
 *  - Card shadcn mantém `p-4 sm:p-5` no header/content.
 *
 * Estes testes pegam regressões sem precisar abrir o browser em
 * cada largura alvo (360, 390, 414×896 retrato/paisagem).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from '@testing-library/react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

const PAGES = [
  'src/pages/Pacientes.tsx',
  'src/pages/Eventos.tsx',
  'src/pages/Configuracoes.tsx',
];

const CONFIG_COMPONENTS = [
  'src/components/equipe/EquipeManager.tsx',
  'src/components/configuracoes/ConfigClinica.tsx',
  'src/components/configuracoes/ControleMensal.tsx',
  'src/components/configuracoes/TurnosEditor.tsx',
  'src/components/configuracoes/AusenciasManager.tsx',
];

describe('Serene Premium — ritmo de espaçamento', () => {
  describe('Wrapper de página (container py-4 sm:py-6)', () => {
    it.each(PAGES)('%s usa container py-4 sm:py-6', (file) => {
      const src = read(file);
      expect(src).toMatch(/container\s+py-4\s+sm:py-6/);
    });
  });

  describe('Hero (mb-5 sm:mb-7)', () => {
    it.each(PAGES)('%s usa mb-5 sm:mb-7 no hero', (file) => {
      const src = read(file);
      expect(src).toMatch(/mb-5\s+sm:mb-7/);
    });
  });

  describe('Cards de Configurações — sem mb-6/mb-8 (Serene Premium)', () => {
    it.each(CONFIG_COMPONENTS)(
      '%s não contém mb-6 ou mb-8 em clinical-card',
      (file) => {
        const src = read(file);
        // Procura especificamente classes Tailwind mb-6/mb-8 em strings
        // de className. Tokens dentro de comentários ou nomes de variáveis
        // (ex: `mb-6px`) não disparam — usamos boundary de palavra.
        expect(src).not.toMatch(/\bmb-6\b/);
        expect(src).not.toMatch(/\bmb-8\b/);
      },
    );

    it.each(CONFIG_COMPONENTS)(
      '%s usa mb-4 sm:mb-5 entre cards',
      (file) => {
        const src = read(file);
        // Pelo menos uma ocorrência do padrão Serene
        expect(src).toMatch(/mb-4\s+sm:mb-5/);
      },
    );
  });

  describe('Card shadcn — padding interno', () => {
    it('CardHeader renderiza com p-4 sm:p-5', () => {
      const { container } = render(
        <Card>
          <CardHeader data-testid="header">x</CardHeader>
        </Card>,
      );
      const header = container.querySelector('[data-testid="header"]');
      expect(header?.className).toMatch(/\bp-4\b/);
      expect(header?.className).toMatch(/sm:p-5/);
    });

    it('CardContent renderiza com p-4 sm:p-5', () => {
      const { container } = render(
        <Card>
          <CardContent data-testid="content">x</CardContent>
        </Card>,
      );
      const content = container.querySelector('[data-testid="content"]');
      expect(content?.className).toMatch(/\bp-4\b/);
      expect(content?.className).toMatch(/sm:p-5/);
    });

    it('Card raiz tem rounded-xl + border-border/40 + shadow-xs', () => {
      const { container } = render(<Card data-testid="card">x</Card>);
      const card = container.querySelector('[data-testid="card"]');
      expect(card?.className).toMatch(/rounded-xl/);
      expect(card?.className).toMatch(/border-border\/40/);
      expect(card?.className).toMatch(/shadow-xs/);
    });
  });
});
