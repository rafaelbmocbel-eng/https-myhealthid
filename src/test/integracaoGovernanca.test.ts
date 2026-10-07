import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import {
  AVISO_PADRAO_PLANO, FONTE_CLIENTE_BASE, avisoAposEdicao, baseDoCliente, lerGovernanca, rodapeGovernanca, rotuloSelo,
} from '../lib/governanca';
import { idadeEmAnos, interpretarRespostaGeracao, resumoMotivosBloqueio } from '../lib/geracaoPlano';

const planoLiberado = {
  titulo: 'Treino',
  fases: [{ nome: 'F1' }],
  _governanca: {
    versao: 1,
    versao_plano: 2,
    fonte: { tipo: 'ia', modelo: 'gemini-2.5-flash', funcao: 'gerar-plano-treino', insumos: ['MyID'], parametros: [] },
    acompanhamento: { reavaliar_em_semanas: 4, indicadores: [{ id: 'rpe', nome: 'Esforço percebido', como_medir: 'Escala 0-10', quando_agir: 'Conversar com o profissional' }] },
    aprovacao: { por_user_id: 'u1', por_nome: 'Ana Souza', em: '2026-10-01T15:00:00Z', versao: 2 },
  },
};

describe('baseDoCliente', () => {
  it('descarta a governança e o acompanhamento que o paciente pode ter forjado', () => {
    const forjado = {
      titulo: 'Meu treino',
      fases: [{ nome: 'F1', sessoes: [] }],
      baseadoEm: { objetivo: 'saúde' },
      acompanhamento: { reavaliar_em_semanas: 52, indicadores: [] },
      _governanca: {
        fonte: { tipo: 'ia', modelo: 'forjado' },
        aprovacao: { por_nome: 'Dr. Falso', em: '2026-01-01T00:00:00Z', versao: 9 },
        triagem: { nivel: 'liberado', motivos: [], override: null },
        revisao_seguranca: { risco_geral: 'baixo' },
      },
    };
    const base = baseDoCliente(forjado, new Date('2026-10-07T12:00:00Z')) as Record<string, unknown>;

    expect(base.titulo).toBe('Meu treino');
    expect(base.baseadoEm).toEqual({ objetivo: 'saúde' });
    expect(base.fases).toEqual(forjado.fases);
    expect(base).not.toHaveProperty('acompanhamento');

    const gov = lerGovernanca(base);
    expect(gov?.aprovacao).toBeNull();
    expect(gov?.triagem).toBeNull();
    expect(gov?.revisao_seguranca).toBeNull();
    expect(gov?.fonte?.tipo).toBe(FONTE_CLIENTE_BASE);
    expect(gov?.fonte?.modelo).toBeNull();
    expect(gov?.fonte?.gerado_em).toBeNull();
  });

  it('não muta o original e aceita conteúdo vazio ou inválido', () => {
    const original = { _governanca: { aprovacao: { por_nome: 'X' } }, a: 1 };
    baseDoCliente(original);
    expect(original._governanca.aprovacao.por_nome).toBe('X');
    expect(lerGovernanca(baseDoCliente(null))?.fonte?.tipo).toBe(FONTE_CLIENTE_BASE);
    expect(lerGovernanca(baseDoCliente('texto'))?.fonte?.tipo).toBe(FONTE_CLIENTE_BASE);
    expect(lerGovernanca(baseDoCliente([1, 2]))?.fonte?.tipo).toBe(FONTE_CLIENTE_BASE);
  });

  it('o selo de um plano que nasceu do cliente cita a base do cliente, nunca a IA do servidor', () => {
    const base = baseDoCliente({ fases: [] });
    expect(rotuloSelo(lerGovernanca(base), false)).toBe('Rascunho');
    const liberado = { ...base, _governanca: { ...(base._governanca as object), aprovacao: { por_nome: 'Ana', em: '2026-10-01T15:00:00Z', versao: 1 } } };
    expect(rotuloSelo(lerGovernanca(liberado), true)).toBe(
      'Liberado por Ana em 01/10/2026 · v1 · Fonte: base montada pelo cliente com IA + revisão profissional',
    );
  });
});

describe('rodapeGovernanca', () => {
  it('plano do profissional liberado: quem liberou, data, versão, fonte e a reavaliação', () => {
    const r = rodapeGovernanca(planoLiberado, { origem: 'profissional', aprovado: true });
    expect(r.selo).toBe('Liberado por Ana Souza em 01/10/2026 · v2 · Fonte: IA (gemini-2.5-flash) + revisão profissional');
    expect(r.reavaliacao).toBe('Reavaliar em 4 semanas (até 29/10/2026)');
    expect(r.aviso).toBe(AVISO_PADRAO_PLANO);
  });

  it('plano do cliente nunca afirma liberação, mesmo com aprovação no conteúdo', () => {
    const r = rodapeGovernanca(planoLiberado, { origem: 'cliente', aprovado: true });
    expect(r.selo).toBeNull();
    expect(r.reavaliacao).toBeNull();
    expect(r.aviso).toBe(AVISO_PADRAO_PLANO);
  });

  it('legado liberado sem registro e rascunho têm o rótulo certo e não inventam reavaliação', () => {
    expect(rodapeGovernanca({ fases: [] }, { origem: 'profissional', aprovado: true })).toMatchObject({
      selo: 'Liberado antes do registro de aprovação', reavaliacao: null,
    });
    const rascunho = rodapeGovernanca({ ...planoLiberado, _governanca: { ...planoLiberado._governanca, aprovacao: undefined } }, { origem: 'profissional', aprovado: false });
    expect(rascunho.selo).toBe('Rascunho');
    expect(rascunho.reavaliacao).toBeNull();
  });

  it('a aprovação gravada no conteúdo não vale se a coluna aprovado diz que é rascunho', () => {
    const r = rodapeGovernanca(planoLiberado, { origem: 'profissional', aprovado: false });
    expect(r.selo).toBe('Rascunho');
    expect(r.reavaliacao).toBeNull();
  });

  it('singular quando a reavaliação é em 1 semana', () => {
    const um = { _governanca: { ...planoLiberado._governanca, acompanhamento: { reavaliar_em_semanas: 1, indicadores: [] } } };
    expect(rodapeGovernanca(um, { origem: 'profissional', aprovado: true }).reavaliacao).toBe('Reavaliar em 1 semana (até 08/10/2026)');
  });
});

describe('avisoAposEdicao', () => {
  it('plano que não estava liberado: só confirma', () => {
    expect(avisoAposEdicao('Treino', false, false)).toEqual({ nivel: 'sucesso', mensagem: 'Treino atualizado' });
  });

  it('plano liberado que voltou para rascunho avisa, sem dizer que continua liberado', () => {
    const a = avisoAposEdicao('Treino', true, false);
    expect(a.nivel).toBe('aviso');
    expect(a.mensagem).toMatch(/voltou para rascunho/);
    expect(a.mensagem).toMatch(/libere de novo/);
  });

  it('plano liberado cujo conteúdo não mudou continua liberado', () => {
    const a = avisoAposEdicao('Treino', true, true);
    expect(a.nivel).toBe('sucesso');
    expect(a.mensagem).toMatch(/continua liberado/);
  });

  it('sem saber o estado depois do salvamento, avisa com cautela', () => {
    expect(avisoAposEdicao('Plano', true, null).nivel).toBe('aviso');
    expect(avisoAposEdicao('Plano', true, undefined).nivel).toBe('aviso');
  });
});

describe('interpretarRespostaGeracao', () => {
  const bloqueio = { nivel: 'bloqueia', motivos: [{ codigo: 'menor', rotulo: 'Menor de 18 anos', detalhe: '', origem: 'cadastro', nivel: 'bloqueia' }], dadosAusentes: [], pode_prosseguir_profissional: true };

  it('{ok:false, bloqueio} vira bloqueio, não erro', () => {
    const r = interpretarRespostaGeracao({ ok: false, bloqueio });
    expect(r.tipo).toBe('bloqueio');
    if (r.tipo === 'bloqueio') {
      expect(r.bloqueio.nivel).toBe('bloqueia');
      expect(r.bloqueio.pode_prosseguir_profissional).toBe(true);
    }
  });

  it('ok:true com plano devolve o plano', () => {
    const r = interpretarRespostaGeracao({ ok: true, plano: { titulo: 'T' } });
    expect(r).toEqual({ tipo: 'plano', plano: { titulo: 'T' } });
  });

  it('ok:true vence um bloqueio presente por engano', () => {
    expect(interpretarRespostaGeracao({ ok: true, plano: { titulo: 'T' }, bloqueio }).tipo).toBe('plano');
  });

  it('erro textual, resposta vazia e plano inválido lançam (nunca viram plano)', () => {
    expect(() => interpretarRespostaGeracao({ error: 'Créditos esgotados' })).toThrow('Créditos esgotados');
    expect(() => interpretarRespostaGeracao(null)).toThrow();
    expect(() => interpretarRespostaGeracao({ ok: true })).toThrow();
    expect(() => interpretarRespostaGeracao({ ok: true, plano: [] })).toThrow();
    expect(() => interpretarRespostaGeracao({ ok: false })).toThrow();
  });

  it('bloqueio malformado não libera a geração', () => {
    expect(() => interpretarRespostaGeracao({ ok: false, bloqueio: { nivel: 'qualquer' } })).toThrow();
  });
});

describe('idadeEmAnos e resumoMotivosBloqueio', () => {
  it('conta a idade completa e respeita o aniversário', () => {
    expect(idadeEmAnos('2000-10-08', new Date('2026-10-07T12:00:00'))).toBe(25);
    expect(idadeEmAnos('2000-10-07', new Date('2026-10-07T12:00:00'))).toBe(26);
    expect(idadeEmAnos('2000-10-07T00:00:00Z', new Date('2026-10-07T12:00:00'))).toBe(26);
  });

  it('devolve null para ausente, inválida ou futura', () => {
    expect(idadeEmAnos(null)).toBeNull();
    expect(idadeEmAnos('')).toBeNull();
    expect(idadeEmAnos('lixo')).toBeNull();
    expect(idadeEmAnos('2099-01-01', new Date('2026-10-07T12:00:00'))).toBeNull();
  });

  it('resume até três motivos', () => {
    const motivo = (n: number) => ({ codigo: `c${n}`, rotulo: `Motivo ${n}`, detalhe: '', origem: '', nivel: 'confirmar' as const });
    const base = { nivel: 'confirmar' as const, dadosAusentes: [], pode_prosseguir_profissional: true };
    expect(resumoMotivosBloqueio({ ...base, motivos: [] })).toMatch(/triagem/);
    expect(resumoMotivosBloqueio({ ...base, motivos: [motivo(1), motivo(2)] })).toBe('Motivo 1, Motivo 2');
    expect(resumoMotivosBloqueio({ ...base, motivos: [1, 2, 3, 4, 5].map(motivo) })).toBe('Motivo 1, Motivo 2, Motivo 3 e mais 2');
  });
});
