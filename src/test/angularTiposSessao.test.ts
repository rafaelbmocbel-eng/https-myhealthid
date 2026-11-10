import { describe, expect, it } from 'vitest';
import { paresDireitoEsquerdo, vistaBaseDaSessao, vistaDaSessao, VISTAS_DA_SESSAO } from '@/lib/angular/tiposSessao';

describe('tiposSessao: vistas', () => {
  it('as quatro posições da sessão, na ordem de fotografar', () => {
    expect(VISTAS_DA_SESSAO).toEqual(['frente', 'perfil_d', 'perfil_e', 'costas']);
  });

  it('converte a posição da sessão em vista e lado do banco, e de volta', () => {
    expect(vistaBaseDaSessao('perfil_d')).toEqual({ vista: 'perfil', lado: 'D' });
    expect(vistaBaseDaSessao('perfil_e')).toEqual({ vista: 'perfil', lado: 'E' });
    expect(vistaBaseDaSessao('frente')).toEqual({ vista: 'frente' });
    expect(vistaDaSessao('perfil', 'E')).toBe('perfil_e');
    expect(vistaDaSessao('costas')).toBe('costas');
  });

  it('perfil de nota antiga, sem lado, não tem posição na sessão', () => {
    expect(vistaDaSessao('perfil')).toBeNull();
    expect(vistaDaSessao('perfil', null)).toBeNull();
  });
});

describe('tiposSessao: direito x esquerdo', () => {
  it('forma pares pelo sufixo -d/-e e dá a diferença D − E com uma casa', () => {
    const r = paresDireitoEsquerdo([
      { id: 'ombros', graus: 1.2 },
      { id: 'braco-d', graus: 8.5 },
      { id: 'braco-e', graus: 5.25 },
      { id: 'joelho-e', graus: 170 },
    ]);
    expect(r.map((p) => p.base)).toEqual(['braco', 'joelho']);
    expect(r[0].diferenca).toBe(3.3);
    expect(r[1].direito).toBeNull();
    expect(r[1].diferenca).toBeNull();
  });

  it('não subtrai valores de unidades diferentes nem inventa par', () => {
    const r = paresDireitoEsquerdo([
      { id: 'x-d', graus: 10, unidade: 'cm' },
      { id: 'x-e', graus: 4 },
    ]);
    expect(r[0].diferenca).toBeNull();
    expect(paresDireitoEsquerdo([{ id: 'dedo', graus: 1 }])).toEqual([]);
  });
});
