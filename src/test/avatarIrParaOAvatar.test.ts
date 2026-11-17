import { describe, it, expect } from 'vitest';
import { SUB_ABA_DO_AVATAR, subAbaInicialDaVisaoGeral, visaoGeralMostraOAvatar } from '@/lib/avatar/irParaOAvatar';

const layout = (corpo: boolean) => [
  { id: 'diagnostico', visivel: true },
  { id: 'corpo', visivel: corpo },
  { id: 'jornada', visivel: true },
];

describe('visaoGeralMostraOAvatar', () => {
  it('a sub-aba do Avatar é a "corpo"', () => {
    expect(SUB_ABA_DO_AVATAR).toBe('corpo');
  });
  it('só quando a sub-aba "corpo" existe E está visível', () => {
    expect(visaoGeralMostraOAvatar(layout(true))).toBe(true);
    expect(visaoGeralMostraOAvatar(layout(false))).toBe(false);
    expect(visaoGeralMostraOAvatar([])).toBe(false);
    expect(visaoGeralMostraOAvatar([{ id: 'diagnostico', visivel: true }])).toBe(false);
    expect(visaoGeralMostraOAvatar([{ id: 'corpo', visivel: false }])).toBe(false);
  });
  it('outra sub-aba visível não conta como Avatar', () => {
    expect(visaoGeralMostraOAvatar([{ id: 'jornada', visivel: true }, { id: 'diagnostico', visivel: true }])).toBe(false);
  });
});

describe('subAbaInicialDaVisaoGeral', () => {
  it('com o pedido e a sub-aba do Avatar visível, abre nela', () => {
    expect(subAbaInicialDaVisaoGeral(layout(true), true, 'diagnostico')).toBe('corpo');
  });
  it('sem o pedido, abre na padrão', () => {
    expect(subAbaInicialDaVisaoGeral(layout(true), false, 'diagnostico')).toBe('diagnostico');
  });
  it('com o pedido mas sem a sub-aba do Avatar, abre na padrão (nunca numa sub-aba que não existe)', () => {
    expect(subAbaInicialDaVisaoGeral(layout(false), true, 'diagnostico')).toBe('diagnostico');
    expect(subAbaInicialDaVisaoGeral([], true, 'diagnostico')).toBe('diagnostico');
  });
});
