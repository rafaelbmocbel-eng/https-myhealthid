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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { render } from '@testing-library/react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

const PAGES = [
  'src/pages/Pacientes.tsx',
  'src/pages/Eventos.tsx',
  'src/pages/Configuracoes.tsx',
];

// Componentes ATIVOS críticos de layout (Serene Premium aplicado).
// Ampliar esta lista sempre que um componente passar pela passada de design.
const CRITICAL_LAYOUT_COMPONENTS = [
  // Configurações
  'src/components/equipe/EquipeManager.tsx',
  'src/components/configuracoes/ConfigClinica.tsx',
  'src/components/configuracoes/ControleMensal.tsx',
  'src/components/configuracoes/TurnosEditor.tsx',
  'src/components/configuracoes/AusenciasManager.tsx',
  // Banner global que aparece no topo de Configurações
  'src/components/AiCreditsBanner.tsx',
  // Componentes compartilhados de layout
  'src/components/ui/card.tsx',
  'src/components/ui/section-title.tsx',
];

/**
 * Arquivos isentos do guarda global. Razões aceitas:
 *  - Serviços DESCONTINUADOS (cobzero, identidade, protocolo, método-identidade)
 *    cujo CSS legado deve ficar congelado como histórico.
 *  - Componentes que escolheram outro ritmo verticalmente justificado
 *    (ex.: Dashboard/Index com seções largas) e que NÃO seguem o padrão
 *    `mb-4 sm:mb-5` por decisão de design.
 *
 * IMPORTANTE: adicionar a esta lista exige justificativa em PR review.
 */
const LEGACY_ALLOWLIST: RegExp[] = [
  /\/cobzero\//,
  /\/identidade\//,
  /\/protocolo\//,
  /MetodoIdentidade\.tsx$/,
  /CobZero\.tsx$/,
  /\/myid\//,           // Blocos MyID legados (relatórios)
  /PacienteDashboardCobZero\.tsx$/,
  /PacienteDashboardIdentidade\.tsx$/,
  /RelatorioCobZero\.tsx$/,
  /RelatorioIdentidade\.tsx$/,
  // Páginas com layout de hero amplo intencional (sweep não concluído)
  /pages\/Index\.tsx$/,
  /pages\/Relatorios\.tsx$/,
  /pages\/Protocolos\.tsx$/,
  /pages\/GestaoVendas\.tsx$/,
  /pages\/Agenda\.tsx$/,
  /pages\/PacientePerfil\.tsx$/,
  // Componentes Patient* com layouts próprios
  /PatientIntegratedDashboard\.tsx$/,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

function findCardViolations(filePath: string): string[] {
  const src = readFileSync(filePath, 'utf8');
  const violations: string[] = [];
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    // 1) clinical-card + mb-6/mb-8 no mesmo className
    if (/clinical-card[^"'`]*\bmb-(6|8)\b/.test(line)) {
      violations.push(`${filePath}:${i + 1} → clinical-card + mb-6/8`);
    }
    // 2) Card shadcn (rounded-xl + border) com mb-6/8 no mesmo className
    if (/rounded-xl[^"'`]*\bborder[^"'`]*\bp-[45]\b[^"'`]*\bmb-(6|8)\b/.test(line)) {
      violations.push(`${filePath}:${i + 1} → card (rounded-xl+border+p-4/5) + mb-6/8`);
    }
  });
  return violations;
}

describe('Serene Premium — ritmo de espaçamento', () => {
  describe('Wrapper de página (container py-4 sm:py-6)', () => {
    it.each(PAGES)('%s usa container py-4 sm:py-6', (file) => {
      const src = read(file);
      expect(src).toMatch(/container\s+py-4\s+sm:py-6/);
    });
  });

  describe('Hero — ritmo Serene Premium', () => {
    it.each(PAGES)('%s usa hero mb-5 sm:mb-7 OU container space-y-4 sm:space-y-5', (file) => {
      const src = read(file);
      const hasHeroMargin = /mb-5\s+sm:mb-7/.test(src);
      const hasContainerStack = /space-y-4\s+sm:space-y-5/.test(src);
      expect(hasHeroMargin || hasContainerStack).toBe(true);
    });
  });

  describe('Componentes críticos — sem mb-6/mb-8 e usam ritmo Serene', () => {
    it.each(CRITICAL_LAYOUT_COMPONENTS)(
      '%s não contém mb-6 ou mb-8',
      (file) => {
        const src = read(file);
        expect(src).not.toMatch(/\bmb-6\b/);
        expect(src).not.toMatch(/\bmb-8\b/);
      },
    );
  });

  describe('Componentes de Configurações — usam mb-4 sm:mb-5 entre cards', () => {
    const configOnly = CRITICAL_LAYOUT_COMPONENTS.filter((f) =>
      /configuracoes|equipe/.test(f),
    );
    it.each(configOnly)('%s usa mb-4 sm:mb-5', (file) => {
      const src = read(file);
      expect(src).toMatch(/mb-4\s+sm:mb-5/);
    });
  });

  describe('Guarda GLOBAL — nenhum card interno reintroduz mb-6/mb-8', () => {
    it('toda a base src/ (exceto allowlist) está livre de "clinical-card + mb-6/8" e "card shadcn + mb-6/8"', () => {
      const root = resolve(process.cwd(), 'src');
      const files = walk(root).filter((f) => {
        const rel = f.replace(resolve(process.cwd()) + '/', '');
        return !LEGACY_ALLOWLIST.some((rx) => rx.test(rel));
      });
      const violations = files.flatMap(findCardViolations);
      if (violations.length > 0) {
        // Mensagem amigável listando arquivos infratores
        throw new Error(
          'Violações Serene Premium detectadas:\n' +
            violations.map((v) => '  • ' + v).join('\n') +
            '\n\nUse mb-4 sm:mb-5 entre cards ou adicione à LEGACY_ALLOWLIST com justificativa.',
        );
      }
      expect(violations).toEqual([]);
    });
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
